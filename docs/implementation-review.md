# Beyond Fluency implementation review

Base: 0.2.2 / 1ce34a1593595d30cfa1889cfef8dbb7dbc42e84.

Changes are implemented and checked sequentially on feat/beyond-fluency-reviewed. A passing engineering check is not evidence of literary efficacy. Live model behavior and blind human reading are separate validation tasks.

## Change 01: Baseline verification

Add syntax checks and initial regression tests before changing runtime behavior. Tests cover Unicode/newline round trips, normalized entity lookup, and declared entrypoint existence. CI uses an explicitly pinned Pi development host. Production installation and manuscript files are not changed by this step.

Review: behavior-neutral test infrastructure. CI outcome must be inspected before the next change.

## Change 02: Trusted scene paths and portable file handling

Scope: allowlist executable scene metadata; derive paths/chapter addresses from the scan; reject duplicate scene addresses; reject project escapes and dangling/outside symlink ancestors before reading scenes; protect the prose backup path. Preserve unknown author metadata on disk. Use unique write temporaries and portable filenames; do not make case-sensitive paths equal on Linux.

Verification: 9 local tests passed with the pinned Pi host available. Tests include metadata path override, prototype keys, prefix tricks, outside/dangling symlinks, duplicate addresses, root aliases, and Unicode. Diff reviewed. A root-symlink canonical-path round-trip issue was found during review and repaired before acceptance. This is filesystem containment, not an OS sandbox against concurrent hostile directory replacement.

## Change 03: Credential-free, preview-bound Git publication

Scope: replace shell interpolation, token-bearing remotes, blanket staging, forced initial pushes, and automatic README overwrites. Connect configures a credential-free remote without publishing. Publication requires a content-bound preview, rejects private paths and secret-like content, verifies staged Git objects, and uses normal push. Existing local commits can be explicitly retried after a network failure. Legacy credential cleanup is preview-first and does not pretend to erase logs/history or revoke tokens.

Verification: 14 local tests passed. Additional fixtures test URL/branch rejection, private paths, literal shell-like commit messages, stale previews, unrelated staged changes, CRLF clean filters, secret-like content, and nested repositories. Review found and repaired a CRLF/index-hash mismatch and the missing retry path for an existing commit. Repository hooks/filters remain Git's trusted local configuration; this is not an OS sandbox. Full strict typechecking is the next independent infrastructure change; existing core callback annotations need correction for the pinned host.
