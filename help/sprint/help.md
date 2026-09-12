# /PNW-sprint — Help Reference

`/PNW-sprint [minutes]` starts an in-session countdown; invalid or missing duration
defaults to 25 minutes. Only one sprint can run at a time.

The footer updates every five seconds. At expiry it reports net manuscript word
change and words/minute. It does not report daily-goal progress or save a durable
sprint record. Editing or deletion can produce zero or negative net words.

The timer is session-local. Session shutdown clears it. The implementation listens
for an abort signal, but there is no dedicated stop-sprint command; do not promise
that an ordinary chat request will stop it reliably.
