# /PNW-suggestions — Walkthrough

Step-by-step guide to the suggestion workflow from generation to applied edits.

---

## Part 1: How Suggestions Are Created

Suggestions appear in the queue in two ways:

**1. Editing skills generate them automatically**

When you run a dev-edit, line-edit, or copy-edit skill, the AI generates
suggestions and stores them via `edit_suggest` — without changing any scene
files. You review them afterward.

**2. You ask the AI directly**

> "Suggest improvements to scene 3.2 — the pacing feels slow"

The AI analyzes the scene and calls `edit_suggest` for each recommended change.
It may also call `analyze_pacing` first if it needs data to inform its suggestions.

---

## Part 2: Reviewing Suggestions

```
/PNW-suggestions
```

Read through the list. For each suggestion, ask yourself:
- Does this change improve the prose?
- Does it maintain my voice?
- Is the original text actually a problem?

You are always in control. The AI cannot apply changes without your explicit
`edit_accept` call.

---

## Part 3: Accepting Suggestions

### Accept one

> "Accept edit-1710000000001"

The AI calls `edit_accept` and confirms:
```
Accepted. Scene 2.3 updated: "She ran quickly toward the door." ->
"She ran for the door." (line 34)
```

### Accept a group

> "Accept all the adverb removal suggestions — edit-1710000000001,
> edit-1710000000004, and edit-1710000000007"

The AI processes each one in sequence.

### Accept all remaining suggestions for a scene

> "Accept all pending suggestions for scene 2.3"

The AI calls `edit_list_suggestions(chapter: 2, scene: 3)`, identifies
the pending ones, and accepts each.

---

## Part 4: Rejecting Suggestions

### Reject one

> "Reject edit-1710000000003. I want to keep the explicit 'urgently' —
> Drath's POV uses heightened labeling intentionally."

The AI calls `edit_reject(id: "...", reason: "intentional POV style choice")`.
The scene is unchanged.

### Reject an entire category

> "Reject all suggestions that change dialogue tags from 'said' to action beats.
> I prefer conventional attribution."

---

## Part 5: Modifying and Accepting

When the AI's direction is right but the exact wording is not:

**Step 1 — Modify:**
> "Modify edit-1710000000002: change the proposed text to 'Something had shifted
> in the room and she couldn't say what.'"

AI calls `edit_modify(id: "...", new_suggested_text: "...")`.

**Step 2 — Accept:**
> "Accept edit-1710000000002"

The modified version is what gets applied to the scene.

---

## Part 6: Clearing the Queue Efficiently

After a long editing pass, you may have 20-40 pending suggestions. A
systematic approach:

**Round 1 — Quick rejections**
```
/PNW-suggestions
```
Read through and immediately reject anything obviously wrong:
> "Reject edit-...001, edit-...003, edit-...009. Those change my intentional
> stylistic choices."

**Round 2 — Accept the clear wins**
> "Accept edit-...002, edit-...004, edit-...005, edit-...006"

**Round 3 — Handle edge cases**
For the remaining suggestions that need more thought, read each scene in
context before deciding.

---

## Part 7: Suggestion Hygiene

### When "original text not found" error occurs

The scene file was manually edited after the suggestion was created, and
the original text no longer exists verbatim.

Options:
1. Reject the suggestion (it may have been effectively superseded by your manual edit)
2. Check if the edit still makes sense and apply it manually via `edit_line`

### When too many suggestions pile up

A large backlog is demotivating. After finishing a drafting phase, process
suggestions chapter by chapter rather than letting them accumulate across
the whole project.

Recommended: process suggestions for chapter N before beginning to draft
chapter N+1.

### Keeping the history clean

Accepted and rejected suggestions are never deleted. The history is useful for:
- Remembering why a line was changed
- Undoing a change (find the original text in the rejected suggestion)
- Reviewing what the AI recommended during a particular editing pass

---

## Part 8: Full Editing Session Flow

```
1. /PNW-edit                          enter editing mode
2. Ask AI: "Run the dev-edit skill on chapter 2"
3. /PNW-suggestions                   review generated suggestions
4. Process suggestions (accept/reject/modify)
5. Ask AI: "Run the line-edit skill on chapter 2"
6. /PNW-suggestions                   second round of suggestions
7. Process suggestions
8. Ask AI: "Mark all chapter 2 scenes as revised"
9. /PNW-status                        verify status update
```
