# /PNW-next — Resources

Stage order is: no project; no bible; bible but no outline; outline but no drafted
scene; any drafted scene missing a scene-summary file; unfinished outlined work;
pending suggestions; all scenes polished/final; otherwise first draft complete.

The detector does not call `novel_summary_refresh`, validate summary hashes, inspect
chapter-summary freshness, or prove that editing occurred. It counts outline files
and uses scene status labels as workflow signals.

Reported words are an estimate based on body length divided by five and currently
assume novel chapter paths. Use `/PNW-status` or `analyze_wordcount` for actual word
splitting.
