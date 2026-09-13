# Change 31: whole-snapshot recovery and safe store-lock inspection

Added a read-only restoration preview and an explicit author-only apply command. Restoring a verified ancestor creates a new accepted child snapshot containing the earlier prose, state, voice, registries and evidence together. Recent history and idempotency records are retained. Working files remain untouched; export accepted prose before deciding how to reconcile manual edits. Restoring is not a new literary approval or permission grant.

Store locks now record host identity. Inspection/recovery rejects live, foreign-machine and malformed/legacy owners rather than stealing their locks. Unknown old locks require external owner inspection. No model-accessible restore tool exists.

Review: 134 tests, strict types and syntax checks pass locally. New fixtures cover stale/altered previews, complete state restoration, retained later artifacts and working wording, injected failure before HEAD publication, and live/foreign/unknown locks. These are local-filesystem guarantees, not protection against concurrent hostile processes or a guarantee of power-loss durability on every filesystem.
