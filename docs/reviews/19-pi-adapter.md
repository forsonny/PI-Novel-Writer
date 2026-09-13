# Change 19: Pi commands, bounded authorization and scene tools

Connect the scene pipeline to the package through `novel-literary.ts`. The author
can preview/apply migration, authorize a session call/token allowance, inspect,
run, pause and accept prepared jobs. Model-call tools expose schemas, preparation,
status, execution and delegated acceptance. Only explicit host commands create
execution grants or record author acceptance. Loading does neither.

Verification: syntax, strict TypeScript and all 90 local tests pass. Real dispatch
fixtures run the review-to-accept path, reject unapproved and over-budget calls,
revoke permission on model/session/user changes, reject concurrent leases, retain
failed-call expenditure and preserve migration source text. Review corrected an
object-key-order address comparison and a revoked-but-still-cancelling worker
state that otherwise could have permitted premature inspection. Shared mock
fixtures were moved out of the executable test module to avoid duplicate tests.

Limits: token accounting is an explicit approximation, not a price guarantee.
An author command approves a candidate, not a fabricated independent reader study.
The parent Pi agent is not an OS sandbox; worker calls themselves have no tools or
parent history. Accepted snapshots remain distinct from editable Markdown.
