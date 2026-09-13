# Change 33: runtime-derived schemas and large-manuscript storage verification

Exported 28 JSON structural schemas from one TypeBox runtime catalogue, including
voice, contracts, epistemic state, revisions, audits, store versions and evaluation
records. The Pi schema tool exposes the catalogue while retaining existing short
names. A regeneration/check command and exact source comparison tests prevent
schema drift. Semantic validation still runs in the domain code.
Review corrected the adapter catalogue spread and added an actual tool-dispatch
test, rather than assuming exported files were also exposed through Pi.

Review: strict typechecking, syntax and 144 local tests pass. A synthetic
100,000-word, 50-scene fixture checks immutable snapshot export, reading order,
separators, content integrity after a newer scene update, and strict rejection of
unreviewed coverage. It is a storage/integration stress test with no provider or
human literary evaluation, not a novel-writing experiment. No test is skipped.

Attempted to obtain Node 22.19.0 from the official distribution to run the supported
floor locally, but this environment could not resolve nodejs.org. The observed
local runtime remains 22.16.0. A configured CI matrix does not count as an executed
CI result. Remote verification of the final local changes remains outstanding.
