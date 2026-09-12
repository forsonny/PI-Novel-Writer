# /PNW-init — Resources

Default project settings include title `Untitled Novel`, novel format, structured
workflow, third-limited past tense, 90,000 target words, 2,000 daily words, and
context budgets of system 2000, bible 4000, summaries 4000, recent prose 6000,
current scene 3000, and voice profile 500.

Full initialization creates `.pi/APPEND_SYSTEM.md` from the package guidance only
when no installed copy exists. Later package upgrades do not update it. Merge new
guidance manually while preserving author additions. `.pi/AGENTS.md` is likewise
created only when absent.

The opening scene has chapter/scene/title/POV/location/timeline/status,
characters_present, plot_threads, tags and summary metadata. No created/updated or
stored word-count fields are added.

Short-story and flash-fiction layouts are used only after the configured format is
changed; initialization starts in novel format.
