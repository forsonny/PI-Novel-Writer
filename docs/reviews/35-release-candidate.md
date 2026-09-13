# Change 35: release candidate packaging and non-writing CI

Prepared version 0.3.0-rc.1 with an updated lockfile, implementation traceability,
managed/legacy workflow distinctions, author command help and an explicit
unvalidated-research boundary. Removed the temporary queued-patch executor and CI
commit/push step. The normal CI workflow has read-only repository permission,
does not persist checkout credentials, and defines a three-platform 22.19.0 matrix.
This matrix still needs to execute for the final local changes.

Added package-content verification: every declared extension, structural schema,
required data file and shipped script must be present, relative module imports
must resolve within the package, and development/private files cannot leak into
the installable tarball. Added repository ignores for private control directories
and generated archives. No installed novel files are modified by packaging.

Final local verification: syntax, strict TypeScript, 29 exported/runtime schema
comparisons, and all 147 regression tests pass, with zero skipped. The package check
verifies required files, module imports and private-file exclusions. An offline
npm ci dry-run checks lock consistency, with the expected warning that local Node
22.16.0 is below the supported 22.19.0 floor. This is not a fresh installation test
or supported-runtime CI success. Full logs are delivered outside the installable
package. No live provider calls, paid generation, human readers, GitHub push, PR,
merge or npm publication occurred during this local completion phase.

Package archives and the exact-base patch are generated after this commit and
verified separately against the imported remote snapshot. A validated local
release candidate is not a proven literary system or an already merged release.
