# /PNW-bible — Help Reference

List all world-building bible entries and view entry stats.

---

## Command

### `/PNW-bible`

**Usage:**
```
/PNW-bible
```

**Parameters:** none

**What it does:**
1. Scans all five bible subdirectories (characters, locations, items, factions, world)
2. Reads each entry's frontmatter (name, type, priority, aliases, tags)
3. Reads the first line of each entry's body as a content snippet
4. Renders a summary table grouped by type

**Requirements:** A project must be loaded (`/PNW-init` or `/PNW-load`)

**When to use:**
- After a world-building session to confirm entries were created correctly
- Before a drafting session to remind yourself what exists in the bible
- When the AI seems unaware of a character or location (check if the entry exists)
- After running the `world-building` or `character-interview` skill

---

## Dashboard Output

```
=== BIBLE ENTRIES ===

CHARACTERS (4)
  Elara Voss           [high]    aliases: Elara, Voss    — Elara is a former messenger...
  Commander Drath      [high]    aliases: Drath          — The Brotherhood's field...
  Sienna               [medium]  aliases: Si             — Elara's childhood friend...
  The Archivist        [low]     aliases: none           — An unnamed keeper of...

LOCATIONS (3)
  Ashenveil            [high]    aliases: The Vale       — A dying forest city carved...
  The Capital          [medium]  aliases: none           — Seat of the Concord's power...
  Ember Gate           [high]    aliases: The Gate       — The only passage between...

ITEMS (1)
  The Messenger Seal   [medium]  aliases: The Seal       — A brass disc stamped with...

FACTIONS (2)
  The Brotherhood      [high]    aliases: Brotherhood    — A militant order that...
  The Concord          [high]    aliases: Concord        — The ruling body of the...

WORLD (1)
  Magic System         [high]    aliases: none           — Memory costs: each casting...

Total: 11 entries
```

---

## AI-Callable Bible Tools

### `bible_create`

Create a new world-building entry file.

**Parameters:**

| Parameter | Type     | Required | Description                                                  |
|-----------|----------|----------|--------------------------------------------------------------|
| `type`    | string   | yes      | Entry type: `character`, `location`, `item`, `faction`, `world` |
| `name`    | string   | yes      | Canonical name                                               |
| `aliases` | string[] | no       | Alternative names (used for context injection matching)      |
| `priority`| string   | no       | `high`, `medium`, or `low` (controls injection priority)     |
| `tags`    | string[] | no       | Descriptive tags (e.g. `["protagonist", "mage"]`)            |
| `content` | string   | no       | Full prose body of the entry (Markdown)                      |

**File created:** `bible/{type}s/{name}.md` (e.g. `bible/characters/Elara-Voss.md`)

**What it does:**
- Writes the entry file with YAML frontmatter
- Updates the in-memory bible index so the AI can find it by name or alias
- Entries with `priority: high` are preferentially injected into AI context

---

### `bible_read`

Read a bible entry by canonical name or alias.

**Parameters:**

| Parameter     | Type   | Required | Description                          |
|---------------|--------|----------|--------------------------------------|
| `nameOrAlias` | string | yes      | Canonical name or any registered alias |

**Returns:** Full frontmatter + body of the entry.

**Error states:**
- `"Bible entry not found: <name>"` — check spelling or use `/PNW-bible` to see all names

---

### `bible_update`

Update a bible entry's metadata or body.

**Parameters:**

| Parameter     | Type     | Required | Description                             |
|---------------|----------|----------|-----------------------------------------|
| `nameOrAlias` | string   | yes      | Entry to update                         |
| `aliases`     | string[] | no       | Replace alias list                      |
| `priority`    | string   | no       | Change priority                         |
| `tags`        | string[] | no       | Replace tag list                        |
| `content`     | string   | no       | Replace full prose body                 |

---

### `bible_delete`

Archive a bible entry (non-destructive — moves to `notes/deleted-bible/`).

**Parameters:**

| Parameter     | Type   | Required | Description        |
|---------------|--------|----------|--------------------|
| `nameOrAlias` | string | yes      | Entry to archive   |

---

### `bible_list`

List entries with optional filtering. Used by the AI for lookups.

**Parameters:**

| Parameter  | Type   | Required | Description                                           |
|------------|--------|----------|-------------------------------------------------------|
| `type`     | string | no       | Filter by type: character, location, item, faction, world |
| `priority` | string | no       | Filter by priority: high, medium, low                 |

---

### `bible_search`

Search bible content by keyword or regex.

**Parameters:**

| Parameter | Type    | Required | Description                        |
|-----------|---------|----------|------------------------------------|
| `query`   | string  | yes      | Search string                      |
| `regex`   | boolean | no       | Treat query as a regex pattern     |

**Returns:** List of matching entries with the matching line highlighted.

**When to use:**
- Find all entries that mention a specific character or location
- Locate entries that reference a plot event
- Search for inconsistencies across entries

---

### `bible_consistency_check`

Compare the live bible entries against `continuity/facts.json` to find stale facts.

**Parameters:** none

**Returns:** List of facts that no longer match their source bible entries, or
"All facts are consistent with bible entries."

---

## Bible Entry Priority and Context Injection

The AI context system injects bible entries automatically based on:

1. **Priority** — `high` entries are always candidates; `medium` and `low`
   are injected only if budget allows
2. **Relevance** — entries whose names or aliases appear in the current scene's
   frontmatter (`characters_present`, `location`) are prioritized
3. **Budget** — controlled by `contextBudget.bible` in `project.json` (default: 3000 tokens)

Set frequently-referenced characters and locations to `priority: high` to ensure
they stay in context during long sessions.
