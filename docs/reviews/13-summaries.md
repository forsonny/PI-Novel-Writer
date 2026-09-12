# Change 13: source-bound summaries and dependency freshness

Wired summary_source and required expectedSourceHash into the actual summary tools.
Chapter fingerprints include canonical scene order. Additional document dependencies
are validated and checked both on save and retrieval. Missing, malformed, changed or
escaped dependencies make a summary stale rather than factually false. Automatic
context selection, refresh reporting and autonomous completion use the same test.
Legacy summaries remain readable with their binding explicitly labeled legacy.
Neither a matching hash nor a saved summary certifies reading or factual accuracy.

Review found that autonomous completion had its own hash-only freshness check;
replaced it with the shared dependency-aware check. Updated the autonomous skill so
existing workflows learn the source-hash requirement. Added a chapter-reorder test
rather than testing only scene text replacement.

Verification: 64 tests pass, including actual tool registration, stale-source save
rejection, upstream dependency invalidation, invalid dependency paths and chapter
reordering. Syntax and strict TypeScript checks pass. No model calls were made.
