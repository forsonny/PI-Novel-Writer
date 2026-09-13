# Change 32: offline evaluation, ablation records, and honest resource summaries

Added runtime-validated study, frozen-trial and external-reader records; all five
length tiers, the original extension baseline, B0-B6/P, fifteen declared ablations
and three negative controls. The offline CLI creates reproducible counterbalanced
pairs without changing prose, stores decoding keys separately, retains complete
private inputs including failed/rejected text, and reports unpaired trials. It
never calls a model, collects readers or grants generation permission.

The resource inspector counts durable worker reservations, including interrupted
and failed calls. Known subtotals and missing values are separate; coordinator,
compaction, external editing and unobserved costs are explicitly outside its scope.

Review: syntax, strict types and 141 local tests pass. New tests check blinding,
exact whitespace, reproducible order, counterbalance, rights restrictions, stale
text, duplicate responses, ties, unknown costs, interrupted calls and CLI dispatch.
Review added actual ablation treatment identity (not just a configuration list),
unpaired-trial reporting, immutable full inputs and decoding-key validation. A new
test incorrectly called a declared ablation undeclared; its setup was corrected.

These are evaluation preparation and descriptive-analysis tools, not completed
experiments or a statistical inference package. Human identity/reading and supplied
provenance are not independently verified. Advanced mixed-effects models and power
analysis require an actual preregistered study and independent reader data. No
novel-length efficacy, calibrated reliability or superiority claim is made.
