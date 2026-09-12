# Beyond Fluency implementation review

Base: 0.2.2 / 1ce34a1593595d30cfa1889cfef8dbb7dbc42e84.

Changes are implemented and checked sequentially on feat/beyond-fluency-reviewed. A passing engineering check is not evidence of literary efficacy. Live model behavior and blind human reading are separate validation tasks.

## Change 01: Baseline verification

Add syntax checks and initial regression tests before changing runtime behavior. Tests cover Unicode/newline round trips, normalized entity lookup, and declared entrypoint existence. CI uses an explicitly pinned Pi development host. Production installation and manuscript files are not changed by this step.

Review: behavior-neutral test infrastructure. CI outcome must be inspected before the next change.

## Change 02: Trusted scene paths and portable file handling

Scope: allowlist executable scene metadata; derive paths/chapter addresses from the scan; reject duplicate scene addresses; reject project escapes and dangling/outside symlink ancestors before reading scenes; protect the prose backup path. Preserve unknown author metadata on disk. Use unique write temporaries and portable filenames; do not make case-sensitive paths equal on Linux.

Verification: 9 local tests passed with the pinned Pi host available. Tests include metadata path override, prototype keys, prefix tricks, outside/dangling symlinks, duplicate addresses, root aliases, and Unicode. Diff reviewed. A root-symlink canonical-path round-trip issue was found during review and repaired before acceptance. This is filesystem containment, not an OS sandbox against concurrent hostile directory replacement.
