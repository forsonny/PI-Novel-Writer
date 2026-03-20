# /PNW-bible — Walkthrough

Step-by-step guide to building and maintaining the world bible.

---

## Part 1: Why a Bible Matters

The bible is the AI's ground truth for your world. Every named character,
location, faction, item, and world rule you define here is automatically
injected into the AI's context when relevant — before every turn.

Without bible entries, the AI can only work from what it sees in the current
conversation. With a rich bible, it can maintain character voice, avoid
continuity errors, and stay grounded in your world's rules across an entire
novel.

---

## Part 2: Your First Entries — Setting Up the Bible

### Recommended approach: Use the skills

The `world-building` and `character-interview` skills guide you through
structured creation of entries with the right fields.

**Run:**
Ask the AI: "Run the world-building skill"

The skill walks you through each type (locations, factions, world rules) with
targeted questions. At the end, the AI calls `bible_create` for each entry.

**For characters:**
Ask the AI: "Run the character-interview skill for Elara Voss"

This skill conducts a deep interview and creates a rich character entry.

---

### Manual creation

You can also create entries directly:

**Character:**
> "Create a bible entry for Elara Voss. She is the protagonist, a former
> messenger now fugitive. Aliases: Elara. Priority: high. She is late 20s,
> fiercely pragmatic, with a talent for reading people's intentions. She
> carries guilt over a message she failed to deliver."

The AI calls:
```
bible_create(
  type: "character",
  name: "Elara Voss",
  aliases: ["Elara"],
  priority: "high",
  content: "..."
)
```

**Location:**
> "Create a bible entry for Ashenveil. A dying forest city carved into ancient
> trees. Priority: high. The bark has turned grey, the canopy is thinning.
> Aliases: The Vale, Ash City."

---

### Verify after creation

```
/PNW-bible
```

You should see the new entry in the appropriate section. If it does not appear,
ask the AI to run `bible_list` and check for creation errors.

---

## Part 3: Updating Entries as the Story Evolves

Characters change. Locations are revealed to have secrets. Factions shift
allegiances. Your bible entries should reflect these developments.

### After a scene reveals new information

> "Update Elara Voss's bible entry. Add to her entry that she now knows the
> Brotherhood's command structure after the confrontation in chapter 3."

The AI calls `bible_update` to append this to her entry body.

### After a character dies or a faction dissolves

You have two options:
1. Update the entry with a note about the event (keeps history)
2. Delete and archive the entry (`bible_delete`)

For most cases, option 1 is better — the AI can reference the character's
history even after their death.

---

## Part 4: Searching the Bible

The `bible_search` tool is powerful for large projects.

### Find all entries mentioning a place

> "Search the bible for 'Ashenveil'"

The AI calls `bible_search(query: "Ashenveil")` and returns every entry
that mentions the city — useful for checking consistency.

### Find contradictions before editing

Before revising a plot point:
> "Search the bible for any entries that mention the Ember Gate's location"

Lets you find all entries that will need updating if you change the detail.

---

## Part 5: Checking Consistency

After a long drafting or editing session, facts in your manuscript may have
diverged from bible entries.

```
bible_consistency_check
```

This compares `continuity/facts.json` (auto-updated as scenes are advanced
to `revised` or `final` status) against the current bible entries. It
reports any mismatch.

**Common follow-up:**
> "Update the Ashenveil entry to reflect the current description in the manuscript"

---

## Part 6: Bible Size and Context Budget

Bible entries consume the `contextBudget.bible` token budget (default: 3000).
For large projects with 20+ characters, you may hit this limit.

**Strategies:**
- Set secondary characters to `priority: medium` or `low`
- Keep entry bodies focused on facts the AI needs (not historical flavor text)
- Increase `contextBudget.bible` in `project.json` if needed (reduce other budgets)

**Check your budget:** Ask the AI to run `context_budget_report`.

---

## Part 7: The Bible vs. the Outline

| Bible                            | Outline                               |
|----------------------------------|---------------------------------------|
| Who characters are               | What happens in each chapter          |
| What locations look like         | Scene-by-scene breakdown              |
| World rules and systems          | Narrative purpose and arc             |
| Faction structures               | Emotional trajectory per chapter      |

Both are injected into AI context. They complement each other — the bible
provides depth, the outline provides structure.
