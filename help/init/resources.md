# /PNW-init — Resources

Default project settings include title `Untitled Novel`, novel format, structured
workflow, third-limited past tense, 90,000 target words, 2,000 daily words, and
context budgets of system 2000, bible 4000, summaries 4000, recent prose 6000,
current scene 3000, and voice profile 500.

Full initialization creates `.pi/APPEND_SYSTEM.md` from the package guidance only
when no installed copy exists. Later package upgrades do not update it. Merge new
guidance manually while preserving author additions. `.pi/AGENTS.md` is likewise
created only when absent.

Full setup does not replace existing premise, beat-sheet, voice, timeline or
continuity files: it refuses before creating project settings. Quick setup does
not create or replace those files.

The opening scene has chapter/scene/title/POV/location/timeline/status,
characters_present, plot_threads, tags and summary metadata. No created/updated or
stored word-count fields are added.

Initialization starts in novel format. Short stories scan `manuscript/scenes`;
flash fiction scans only `manuscript/story.md`. Changing the format setting alone
does not convert the initialized chapter layout and can hide existing prose.
Do not change it to short/flash without a separately verified conversion; that
onboarding conversion remains unsupported.
