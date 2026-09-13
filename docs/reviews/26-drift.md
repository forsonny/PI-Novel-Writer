# Change 26: frozen conditional drift observations

Added scene and overlapping within-scene windows keyed by focalizer, function,
pressure, distance and voice epoch. Reference ranges carry method versions,
calibration status and source records. Empty or unmatched calibration is reported
as uncalibrated; short samples are insufficient evidence. Licensed deviations are
retained. A triage alert requires both lexical and form proxies, never only sentence
length. No model call, rewrite, adaptive baseline change, literary score or invented
confidence interval is produced by this monitor.

Verification: syntax, strict TypeScript and 117 tests pass. Four added tests cover
missing calibration, short samples, epoch matching, exact offsets, overlapping
windows, frozen ranges, licensed ritual repetition, multi-family alarms, invalid
proportions and conflicting baselines. The first outside-range position is only a
descriptive observation. Semantic voice, human judgments and statistical change
point significance remain explicitly unassessed, rather than fabricated.
