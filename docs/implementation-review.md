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

## Change 04: Strict typechecking and real extension dispatch fixtures

Scope: add strict TypeScript checking for every extension and test, portable syntax/test runners, a pinned development dependency lock, and real extension registration/scene-summary fixtures for all four manuscript formats. Correct existing file-queue callbacks to return promises, capture project state in queued callbacks, and preserve literal review-status types. No errors are suppressed with ts-ignore or a reduced file include set.

Verification: `npm run check` passes, including 18 tests. `npm ci --dry-run --offline` validates lock consistency locally. Local Node is 22.16.0, below the package's supported floor; the required remote check uses Node 22.19.0 and `npm ci`. The existing extension adapters still contain legacy `any` annotations; all new domain modules will use typed interfaces and runtime validation. Startup fixtures confirm that loading does not begin an autonomous paid run.

## Change 05: Version the source crosswalk

Scope: preserve all 56 Chapter 5 distinctions, their 48 Appendix B families, separate rubric scales, explicit method/scope and source cause-family namespaces, and named R0-R10 passes. No detector or automatic style judgment is claimed. Source differences and implementation decisions are documented instead of silently reconciled.

Verification: strict typecheck and 21 regression tests pass. Mapping checks specifically prevent loss of character-reset/focalization and fragmentation/caricature/copying distinctions; invalid severity values fail without rescaling. This step does not change generated prose.

## Change 06: Stable scene identities and source versions

Scope: assign immutable UUIDs on new scene creation, retain IDs across moves, record split/merge lineage, expose current prose hashes, and support expected-source checks. Existing files are not migrated on read. Canonical JSON hashing rejects non-finite, cyclic, sparse, reserved-key and otherwise lossy values. Numeric scene addresses remain compatibility positions.

Verification: strict checking and 24 tests pass. Real tool tests cover move/split ID preservation, duplicate IDs, rejected stale writes, no-change legacy scans and merge-self rejection. Review added adjacency enforcement to avoid merging unrelated scenes under a misleading tool description. Legacy callers may omit expected hashes; managed literary acceptance will require them at its gateway.
