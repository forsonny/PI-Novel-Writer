# Change 24: recover and verify the preserved integration checkpoint

The live completion branch was inspected at `cd95b6c5003dc277e3573370cdb8ae30871e65fb`.
Its source-snapshot artifact identifies that exact commit and contains the scene
pipeline and Pi adapter (Changes 18 and 19). The later conversation checkpoint
contains Changes 20 through 23. Those local changes have been recovered without
replacing the remote branch's newer verification/transport configuration.

Verification on 13 September 2026: `npm run check` passes, including syntax,
strict TypeScript and 107 regression tests. Review inspected the worker isolation,
call allowance, exact-text append, dependency binding and atomic acceptance paths.
The recovered artifacts have not been represented as already pushed. The current
GitHub connection supplies reads, not repository writes. Subsequent changes are
recorded as local Git commits and delivered with a patch against the inspected
remote snapshot.

Local runtime: Node 22.16.0. The supported floor remains 22.19.0. Remote CI for the
preceding snapshot passed on 22.19.0; that is not a remote CI result for these local
changes. No paid provider calls or human literary study were executed.
