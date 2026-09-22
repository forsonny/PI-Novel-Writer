# /PNW-init — Walkthrough

1. Open Pi in a separate folder intended for one novel.
2. Run `/PNW-init` for the full workspace, or `/PNW-init --quick` only when you
   intentionally want settings plus an opening scene.
3. Run `/PNW-status`, then the getting-started workflow or edit project settings.
4. For an autonomous manuscript, provide the complete brief to `/PNW-auto start`.
   For supervised work, use premise, bible and outline workflows as desired.

Do not initialize over an existing `project.json` or `manuscript/`; the command
will refuse. Load that work instead. Do not delete project settings to “reset” an
existing novel; use a separate folder.

Full setup also refuses existing premise, beat-sheet, voice, timeline or continuity
placeholder files before making changes. Preserve those files and import them
into a separately initialized workspace rather than overwriting them.

When upgrading an older novel, do not rerun initialization. Compare the current
package guidance with `.pi/APPEND_SYSTEM.md`, remove the old summary-reading ban,
and merge corrections without overwriting author additions.
