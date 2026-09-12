# /PNW-load — Walkthrough

If Pi opened in the novel folder, first run `/PNW-status`; the project may already
be loaded automatically. Otherwise run `/PNW-load <path>`.

Loading another novel does not change the terminal's working directory and does not
modify either novel. Any active autonomous run pauses and requires explicit resume
only after the intended novel is loaded and inspected.

If loading fails, verify that the path contains readable JSON project settings and
that scene files match the configured format. `novel_validate` checks only a small
set of scene metadata issues; its `fix` option is currently not implemented.

Cloned novels do not need local extension dependencies inside the novel folder.
Load this package through Pi, then load the novel.
