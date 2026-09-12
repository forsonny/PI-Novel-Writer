# /PNW-init — Help Reference

`/PNW-init` creates a full novel workspace. It refuses to run when either
`project.json` or `manuscript/` already exists; use `/PNW-load` instead.

Full initialization creates the project settings, folder structure, placeholder
premise/outline/voice files, continuity and timeline records, an opening scene,
`.gitattributes`, appended `.gitignore` rules, `.pi/AGENTS.md`, and
`.pi/APPEND_SYSTEM.md` when that file does not already exist.

`/PNW-init --quick` creates project settings, `.pi/`, Git text/ignore rules, and
one opening scene. It does **not** create the full folder tree, placeholders,
continuity records, or project guidance copies.

Initialization does not ask setup questions; run the getting-started workflow or
edit project settings afterward. It loads the new novel immediately.
