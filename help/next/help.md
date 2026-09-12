# /PNW-next — Help Reference

`/PNW-next` reports one of nine heuristic workflow stages and a few suggested
next actions. It works with no novel loaded and shows Stage 1.

The detector counts bible entries, chapter-outline files, scene statuses, pending
suggestions, and an approximate word total. Stage 5 checks only whether drafted
scenes are missing scene-summary files; it does not detect stale hashes or missing
chapter summaries. Run `novel_summary_refresh` for real summary freshness.

Important heuristics: no bible entries always produces Stage 2, even if other work
exists; pending suggestions produce Stage 8 after drafting is otherwise complete;
all scenes polished/final produce Stage 9. Word count is estimated from body
characters for novel-style paths and can differ from `/PNW-status`.
