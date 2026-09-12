# Change 12: isolated Pi role workers

Implemented bounded sketch, draft, extraction, diagnosis, validation, revision,
comparison and sequence-audit workers with distinct versioned prompts. A worker
uses the current Pi ModelRegistry.complete API with exactly one supplied message,
no tools, no parent conversation, no filesystem access and no resource discovery.
This is a deliberate implementation adaptation of S11: stateless model-runtime
calls provide the required role isolation without creating general agent sessions.
Provider credentials stay inside Pi's normal resolver. No new provider is selected.

Each call checks session-local permission, role/project consistency, packet hash,
model identity, schema overhead and output reserve. Cancellation and timeouts deny
late acceptance. SDK retries are disabled where supported. JSON/schema errors,
truncation and attempted tool calls are failed outputs, retained with private
provenance. Missing/zero-priced usage remains unknown billing rather than a claim
that the call is free. Raw hidden thinking is not retained in the worker record.

Review and verification: all 60 regression tests, syntax and strict TypeScript
checks pass locally. Five added tests exercise actual call construction through a
mock registry, denied execution, tampering, malformed responses, truncation,
attempted tools, pause during a call, timeout and schema-budget overflow. No live
provider call or human literary evaluation was performed. A packet's instruction
boundary cannot guarantee a model will obey it; no external tool is available even
if the model attempts to request one.
