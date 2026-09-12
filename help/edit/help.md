# /PNW-edit — Help Reference

`/PNW-edit` displays an editing-mode notice. It does not activate hidden tools,
select a scene, analyze prose, or change files.

Analysis tools load evidence for the AI to assess:
- `analyze_pacing`: scene prose plus an editorial task.
- `analyze_dialogue`: scene prose plus a dialogue task.
- `analyze_continuity`: scene prose, facts, character states and timeline.
- `analyze_readability`: scene prose plus a readability task.
- `analyze_wordcount`: actual per-scene and total word counts.

They do not calculate fixed pacing percentages, dialogue statistics, grade levels,
or semantic continuity verdicts. The AI must cite the prose and distinguish
supported, uncertain and contradicted findings.

`edit_suggest` queues a proposed exact replacement. `edit_line` changes an
inclusive line range immediately and retains the prior scene version.
