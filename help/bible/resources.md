# /PNW-bible — Resources

Technical reference for bible file format, storage, and context injection.

---

## File Structure

```
<project-root>/
  bible/
    characters/
      Elara-Voss.md
      Commander-Drath.md
    locations/
      Ashenveil.md
      Ember-Gate.md
    items/
      Messenger-Seal.md
    factions/
      The-Brotherhood.md
      The-Concord.md
    world/
      Magic-System.md
```

**Filename rules:**
- Derived from the canonical `name` field: spaces replaced with `-`
- Extension: `.md`
- Case-sensitive on case-sensitive filesystems; use consistent casing

---

## Bible Entry Format

```yaml
---
type: character
name: Elara Voss
aliases:
  - Elara
  - Voss
priority: high
tags:
  - protagonist
  - fugitive
  - mage
---
Elara is a former messenger now wanted by the Brotherhood. Late 20s, fiercely
pragmatic, with a talent for reading people's intentions before they act.

She carries guilt over a sealed message she failed to deliver three years ago —
a message that, she later learns, contained a peace negotiation the Brotherhood
intercepted and destroyed.

**Physical:** Medium height, close-cropped dark hair, a burn scar on her left
forearm from the Night of Embers.

**Voice:** Terse, precise. Asks exactly the question she wants answered and
nothing more. Rarely volunteers personal information.

**Arc:** Begins the story in denial about her own culpability. Ends having
accepted responsibility and used it as motivation rather than paralysis.
```

---

## Frontmatter Schema

| Field      | Type     | Required | Values                                              |
|------------|----------|----------|-----------------------------------------------------|
| `type`     | string   | yes      | `character`, `location`, `item`, `faction`, `world` |
| `name`     | string   | yes      | Canonical name used for injection and lookup        |
| `aliases`  | string[] | no       | Alternative names; all registered in the index      |
| `priority` | string   | no       | `high`, `medium`, `low` (default: `medium`)         |
| `tags`     | string[] | no       | Descriptive tags for searching and filtering        |

---

## Bible Index

The in-memory bible index maps every name and alias to a file path:

```
"Elara Voss"      -> bible/characters/Elara-Voss.md
"Elara"           -> bible/characters/Elara-Voss.md
"Voss"            -> bible/characters/Elara-Voss.md
"Commander Drath" -> bible/characters/Commander-Drath.md
"Drath"           -> bible/characters/Commander-Drath.md
```

The index is rebuilt on every `/PNW-load`. Adding a new entry mid-session
updates the index immediately.

---

## Context Injection

Bible entries are injected into the AI context inside the `[STORY CONTEXT]` block:

```
[STORY CONTEXT]
--- BIBLE ENTRIES ---
[character:high] Elara Voss
  Elara is a former messenger...

[character:high] Commander Drath
  The Brotherhood's field commander...

[location:high] Ashenveil
  A dying forest city...
...
```

**Injection order:**
1. All `high` priority entries, sorted by type (characters first, then locations)
2. `medium` priority entries that fit within the remaining budget
3. `low` priority entries if budget still allows

**Budget:** Controlled by `contextBudget.bible` in `project.json` (default: 3000 tokens;
1 token ~= 4 characters).

---

## Deletion / Archive

`bible_delete` moves entries to `notes/deleted-bible/`, not the system trash.
They can be recovered by moving the file back to the appropriate `bible/` subdirectory.

---

## Tool Reference

### `/PNW-bible` command

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                      |
| Description    | List bible entries and stats                     |
| Usage          | `/PNW-bible`                                     |
| Side effect    | Read-only                                        |

### `bible_create`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                      |
| Label          | Create Bible Entry                               |
| Input          | type, name, aliases, priority, tags, content     |
| Output         | Path of created file                             |
| Side effect    | Writes entry file; updates in-memory index       |

### `bible_read`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                      |
| Label          | Read Bible Entry                                 |
| Input          | nameOrAlias                                      |
| Output         | Full frontmatter and body                        |

### `bible_update`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                      |
| Label          | Update Bible Entry                               |
| Input          | nameOrAlias, aliases?, priority?, tags?, content?|
| Output         | Confirmation with updated path                   |
| Side effect    | Rewrites file; updates index                     |

### `bible_delete`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                      |
| Label          | Delete Bible Entry                               |
| Input          | nameOrAlias                                      |
| Output         | Confirmation of archive path                     |
| Side effect    | Moves file to notes/deleted-bible/               |

### `bible_list`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                      |
| Label          | List Bible Entries                               |
| Input          | type?, priority?                                 |
| Output         | Array of entry refs with name, type, priority    |

### `bible_search`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                      |
| Label          | Search Bible                                     |
| Input          | query, regex?                                    |
| Output         | Matching entries with highlighted lines          |

### `bible_consistency_check`

| Field          | Detail                                           |
|----------------|--------------------------------------------------|
| Registered in  | `extensions/novel-bible.ts`                      |
| Label          | Bible Consistency Check                          |
| Input          | none                                             |
| Output         | Stale facts or "All facts consistent"            |

---

## Related Files

| File                          | Purpose                                         |
|-------------------------------|-------------------------------------------------|
| `extensions/novel-bible.ts`   | All bible tools and /PNW-bible command          |
| `bible/`                      | Entry files directory                           |
| `continuity/facts.json`       | Extracted facts for consistency checking        |
| `help/outline/help.md`        | Chapter outlines (complementary to bible)       |
| `help/summarize/help.md`      | Summaries that reference bible entries          |
