# /PNW-load — Help Reference

`/PNW-load [path]` loads the novel whose `project.json` is at the given path; no
argument means the current working directory. Opening Pi directly in a novel folder
also attempts to load it at session start.

Loading reads project settings and scans scenes according to format. It does not
validate all expected folders, activate tools conditionally, move files, change the
terminal directory, or update installed project guidance. Registered tools remain
available but report “No project loaded” when needed.

A malformed settings file or unreadable scene can make loading fail. Switching
novels replaces only in-memory active state. An autonomous run pauses when the
loaded novel changes and never resumes automatically after startup.
