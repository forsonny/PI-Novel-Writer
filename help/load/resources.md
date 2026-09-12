# /PNW-load — Resources

The active state contains the absolute root, parsed project settings, and a scene
map. Bible and outline lookups scan disk when called; there is no loaded persistent
bible or outline index.

Scene scanning follows format:
- novel/novella: `manuscript/chapters/<number>/*.md`
- short-story: `manuscript/scenes/*.md`, chapter 1
- flash-fiction: `manuscript/story.md`, scene 1

Before agent starts and tool calls, the project is refreshed from disk. Loading
emits a project-loaded event for extension coordination. It does not validate
folder completeness or rewrite files.
