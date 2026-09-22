# /PNW-progress — Help Reference

`/PNW-progress` shows current manuscript words, project daily/total goals, an
estimated “written today” value, seven UTC-date snapshots, and current-session
usage when available.

The dashboard is informational; displaying it does not request another model
response or resume paused writing.

History stores total manuscript words at the latest agent turn on each UTC date.
Today's displayed change is current total minus yesterday's stored total; if no
yesterday snapshot exists, it treats the entire manuscript as today's words. It is
not a precise activity ledger.

`progress_set_goal` updates `dailyWordGoal` and/or `targetWordCount` in project
settings and synchronizes stored goals. `progress_overview` returns snapshots,
current words and session usage. No project-lifetime billing or sprint history is
kept.
