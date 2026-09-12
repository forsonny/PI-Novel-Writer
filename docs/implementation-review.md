# Beyond Fluency implementation review

Base: 0.2.2 / 1ce34a1593595d30cfa1889cfef8dbb7dbc42e84.

Changes are implemented and checked sequentially on feat/beyond-fluency-reviewed. A passing engineering check is not evidence of literary efficacy. Live model behavior and blind human reading are separate validation tasks.

## Change 01: Baseline verification

Add syntax checks and initial regression tests before changing runtime behavior. Tests cover Unicode/newline round trips, normalized entity lookup, and declared entrypoint existence. CI uses an explicitly pinned Pi development host. Production installation and manuscript files are not changed by this step.

Review: behavior-neutral test infrastructure. CI outcome must be inspected before the next change.
