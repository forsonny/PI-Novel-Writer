# /PNW-sprint — Resources

A sprint stores its start word total, remaining seconds, and timer only in memory.
Every five seconds it recomputes total scene-body words. Expiry reports
`endWords - startWords` and divides by the requested minutes.

No sprint array, start/end timestamps, or WPM history is written to
`.pi/progress.json`. The daily progress system separately stores total-word
snapshots after agent turns.

The footer API is used only when available. Closing the session clears the timer.
There is no enforced maximum duration and no dedicated cancellation command.
