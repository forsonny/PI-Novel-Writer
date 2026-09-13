# Change 28: managed autonomous integration and completion boundaries

Managed start/resume requires an explicit call/token allowance and delegated governance. The author command grants the selected model a session-local worker budget through the host event bus, not through saved files or model tools. Pause revokes that permission and aborts active workers. Automatic continuation is bounded, persisted, and separately identified from worker cost accounting.

Completion reads current files and a captured accepted snapshot. It requires planned scene coverage, exact working/accepted agreement, current dependencies and summaries, correct order, and complete current chapter/arc/manuscript model audits. Status labels and legacy self-review records cannot substitute. Research-mode human evaluation is not manufactured by automatic completion. The completed export uses accepted prose. Managed checkpoints recognize accepted artifact changes without requiring a second copy of private evidence in public notes.

During managed unattended runs, generic shell execution and direct writes to prose, summaries, private control files, or outside the novel are blocked at the host tool hook. Registered pipeline functions retain their own validation; the hook is not an OS sandbox against trusted extensions.

Review: all 124 local regression tests, strict TypeScript and syntax checks pass. Fixtures exercise accepted versus merely final-labeled sources, manual edits, complete sequence audit coverage, explicit grant, pause revocation, unauthorized start, and raw mutation rejection. No provider calls or human evaluation were performed. Node 22.16.0 is below the supported CI floor; remote confirmation of these new changes remains outstanding.
