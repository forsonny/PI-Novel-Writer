// Git integration: no credentials in project files, no automatic force pushes,
// no blanket staging, and no publication as a side effect of connecting.
import fs from 'node:fs';
import path from 'node:path';
import { Type } from 'typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { getProject, refreshProject } from './novel-core.ts';
import { writeText, readText, validateFilename } from './utils/platform.ts';
import { projectPath } from './utils/safety.ts';
import { git, githubUrl, gitBranch, previewGit, commitPreview, requireRepositoryRoot, redactGitOutput } from './utils/git.ts';

const configName = '.pi/github.json';
interface Config { version: 2; remote: string; branch: string; credentialMode: 'git-helper' }
const result = (value: unknown) => ({ content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }], details: {} });
function project() {
  const p = getProject(); if (!p) throw new Error('No project loaded'); return p;
}
function loadConfig(root: string): Config {
  const file = projectPath(root, configName);
  if (!fs.existsSync(file)) throw new Error('Not connected. Use /PNW-github-connect <url>');
  const raw = JSON.parse(readText(file));
  if (raw.token) throw new Error('Legacy project credential found. Run novel_github_credentials_cleanup with preview=true, then explicitly approve cleanup. Configure authentication using your Git credential helper');
  return { version: 2, remote: githubUrl(raw.remote), branch: gitBranch(raw.branch), credentialMode: 'git-helper' };
}
async function verifyRemote(root: string, config: Config) {
  await requireRepositoryRoot(root);
  const remote = (await git(root, ['remote', 'get-url', 'origin'])).trim();
  if (githubUrl(remote) !== config.remote) throw new Error('Origin differs from the approved remote');
  const branch = (await git(root, ['symbolic-ref', '--short', 'HEAD'])).trim();
  if (branch !== config.branch) throw new Error('Current branch differs from the approved branch');
}
async function connect(url: string, branch?: string) {
  const p = project(); const remote = githubUrl(url);
  let existing = false;
  try { await git(p.rootPath, ['rev-parse', '--git-dir']); existing = true; } catch { /* new repository */ }
  if (!existing) await git(p.rootPath, ['init', '--initial-branch', gitBranch(branch || 'main')]);
  await requireRepositoryRoot(p.rootPath);
  const current = gitBranch((await git(p.rootPath, ['symbolic-ref', '--short', 'HEAD'])).trim());
  if (branch && gitBranch(branch) !== current) throw new Error('Switch branches explicitly before connecting. No branch was changed');
  const oldFile = projectPath(p.rootPath, configName);
  if (fs.existsSync(oldFile) && JSON.parse(readText(oldFile)).token) throw new Error('Clean up the legacy credential explicitly before reconnecting');
  const remotes = (await git(p.rootPath, ['remote'])).split(/\s+/);
  await git(p.rootPath, remotes.includes('origin') ? ['remote', 'set-url', 'origin', remote] : ['remote', 'add', 'origin', remote]);
  const config: Config = { version: 2, remote, branch: current, credentialMode: 'git-helper' };
  writeText(oldFile, JSON.stringify(config, null, 2) + '\n');
  return `Configured ${remote} on ${current}. Nothing was committed or pushed. Authentication uses Git's configured credential helper; never paste tokens into chat.`;
}
async function publishCommit(expectedHead: string) {
  const p = project(); const config = loadConfig(p.rootPath); await verifyRemote(p.rootPath, config);
  const head = (await git(p.rootPath, ['rev-parse', 'HEAD'])).trim();
  if (head !== expectedHead || !/^[a-f0-9]{40,64}$/.test(expectedHead)) throw new Error('Local commit changed; review it again before publishing');
  await git(p.rootPath, ['push', 'origin', `HEAD:refs/heads/${config.branch}`]);
  return { commit: head, remote: config.remote, branch: config.branch };
}
async function push(message: string, paths: string[] | undefined, expectedHash?: string) {
  const p = project(); const config = loadConfig(p.rootPath); await verifyRemote(p.rootPath, config);
  if (!expectedHash) return previewGit(p.rootPath, paths);
  if (!paths?.length) throw new Error('Provide the exact previewed paths');
  const commit = await commitPreview(p.rootPath, message, paths, expectedHash);
  try { await git(p.rootPath, ['push', 'origin', `HEAD:refs/heads/${config.branch}`]); }
  catch (error) { throw new Error(`Local commit ${commit} is retained. Push failed without rewriting remote history: ${(error as Error).message}`); }
  return { commit, remote: config.remote, branch: config.branch, paths };
}
async function pull() {
  const p = project(); const config = loadConfig(p.rootPath); await verifyRemote(p.rootPath, config);
  if ((await git(p.rootPath, ['status', '--porcelain'])).trim()) throw new Error('Working tree is not clean. Save or resolve changes before pulling');
  const output = await git(p.rootPath, ['pull', '--ff-only', 'origin', config.branch]);
  refreshProject(); return output.trim() || 'Already up to date';
}

export default function novelGithubExtension(pi: ExtensionAPI) {
  const show = (value: unknown) => pi.sendMessage({ customType: 'markdown', content: result(value).content[0].text, display: true });
  pi.registerTool({
    name: 'novel_github_token_set', label: 'Legacy Credential Notice',
    description: 'Deprecated: never stores credentials. Configure Git authentication outside chat.',
    parameters: Type.Object({ token: Type.Optional(Type.String()) }),
    async execute() { return result('No token was stored. Configure your Git credential helper outside chat. A token pasted into a model conversation should be rotated through GitHub.'); },
  });
  pi.registerTool({
    name: 'novel_github_credentials_cleanup', label: 'Clean Legacy Git Credentials',
    description: 'Preview or explicitly remove legacy credentials from project config and clean the origin URL. Does not change Git history or revoke tokens.',
    parameters: Type.Object({ preview: Type.Optional(Type.Boolean()) }),
    async execute(_id, params) {
      const p = project(); await requireRepositoryRoot(p.rootPath);
      const file = projectPath(p.rootPath, configName);
      const raw = fs.existsSync(file) ? JSON.parse(readText(file)) : {};
      const origin = (await git(p.rootPath, ['remote', 'get-url', 'origin'])).trim();
      const url = new URL(origin); const embedded = Boolean(url.username || url.password); url.username = ''; url.password = '';
      const remote = githubUrl(url.toString());
      if (params.preview !== false) return result({ savedCredential: Boolean(raw.token), embeddedCredential: embedded, remote, action: 'Remove legacy token field and URL credentials; configure Git helper separately. No history rewriting.' });
      const branch = gitBranch(raw.branch || (await git(p.rootPath, ['symbolic-ref', '--short', 'HEAD'])).trim());
      await git(p.rootPath, ['remote', 'set-url', 'origin', remote]);
      writeText(file, JSON.stringify({ version: 2, remote, branch, credentialMode: 'git-helper' }, null, 2) + '\n');
      return result('Legacy credential fields removed. Existing chat logs, filesystem backups, and Git history were not altered. Rotate previously exposed tokens separately.');
    },
  });
  pi.registerTool({
    name: 'novel_github_status', label: 'GitHub Status', description: 'Read repository status without publishing or displaying credentials.',
    parameters: Type.Object({}),
    async execute() {
      const p = project(); await requireRepositoryRoot(p.rootPath);
      return result({ root: p.rootPath, branch: (await git(p.rootPath, ['symbolic-ref', '--short', 'HEAD'])).trim(), status: redactGitOutput(await git(p.rootPath, ['status', '--short'])) });
    },
  });
  pi.registerTool({
    name: 'novel_github_connect', label: 'Connect GitHub Remote', description: 'Configure a clean remote. Does not commit, push, change existing branches, or save credentials.',
    parameters: Type.Object({ url: Type.String(), branch: Type.Optional(Type.String()) }),
    async execute(_id, p) { return result(await connect(p.url, p.branch)); },
  });
  pi.registerTool({
    name: 'novel_github_preview', label: 'Preview Git Publication', description: 'Read exact eligible changed paths and content-bound preview hash. Private state/logs/credentials are excluded.',
    parameters: Type.Object({ paths: Type.Optional(Type.Array(Type.String())) }),
    async execute(_id, p) { return result(await previewGit(project().rootPath, p.paths)); },
  });
  pi.registerTool({
    name: 'novel_github_push', label: 'Commit and Push Previewed Files', description: 'Without expectedHash, preview only. With expectedHash and exact paths, commit checked bytes and push normally. Never force-push.',
    parameters: Type.Object({ message: Type.String(), paths: Type.Optional(Type.Array(Type.String())), expectedHash: Type.Optional(Type.String()) }),
    async execute(_id, p) { return result(await push(p.message, p.paths, p.expectedHash)); },
  });
  pi.registerTool({
    name: 'novel_github_push_commit', label: 'Push Existing Local Commit', description: 'Explicitly publish an already-reviewed local HEAD, including retry after a failed push. Does not create a commit or force-push.',
    parameters: Type.Object({ expectedHead: Type.String() }), async execute(_id, p) { return result(await publishCommit(p.expectedHead)); },
  });
  pi.registerTool({
    name: 'novel_github_pull', label: 'Fast-forward Git Pull', description: 'Pull only with a clean working tree and fast-forward history.',
    parameters: Type.Object({}), async execute() { return result(await pull()); },
  });
  pi.registerCommand('PNW-github', { description: 'Preview repository changes', handler: async () => { show(await previewGit(project().rootPath)); } });
  pi.registerCommand('PNW-github-connect', { description: 'Configure remote without publishing: <url>', handler: async args => { show(await connect(args.trim())); } });
  pi.registerCommand('PNW-github-push', {
    description: 'Preview eligible changed files and confirm before pushing: [commit message]',
    handler: async (args, ctx) => {
      const preview = await previewGit(project().rootPath);
      show(preview);
      if (!preview.paths.length) {
        show('No eligible working-tree changes. Existing local commits may still need publication.');
        if (preview.head !== 'unborn' && ctx.hasUI && await ctx.ui.confirm('Push existing commit?', preview.head)) show(await publishCommit(preview.head));
        return;
      }
      if (!ctx.hasUI || !(await ctx.ui.confirm('Commit and push these exact files?', preview.paths.join('\n')))) return;
      show(await push(args.trim() || 'Update manuscript', preview.paths, preview.hash));
    },
  });
  pi.registerCommand('PNW-github-pull', { description: 'Fast-forward pull with a clean working tree', handler: async () => { show(await pull()); } });
  pi.registerCommand('PNW-github-clone', {
    description: 'Clone with Git credential helper: <url> [directory-name]',
    handler: async (args, ctx) => {
      const [raw, specified, ...extra] = args.trim().split(/\s+/);
      if (!raw || extra.length) throw new Error('Usage: /PNW-github-clone <url> [directory-name]');
      const remote = githubUrl(raw); const name = specified || remote.split('/').at(-1)!.replace(/\.git$/, '');
      if (!validateFilename(name).valid || name === '.' || name === '..') throw new Error('Use one portable directory name');
      const target = projectPath(ctx.cwd, name);
      if (fs.existsSync(target)) throw new Error('Clone destination already exists');
      await git(ctx.cwd, ['clone', '--', remote, target]);
      show(`Cloned into ${target}. Inspect imported instructions before loading this project.`);
    },
  });
}
