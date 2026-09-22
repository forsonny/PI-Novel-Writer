# /PNW-outline — Help Reference

`/PNW-outline` lists Markdown files under `outline/chapters`, using filename chapter
number plus frontmatter title/purpose (or limited heading fallbacks). It does not
show the beat sheet body, POV, timeline, scene counts, or manuscript agreement.

Tools create/read/update chapter outlines and upsert scene-card sections.
`outline_chapter_update` supports a replacement body plus optional `title`,
`timeline`, and `scenes` metadata. `outline_scene_card_create` keeps the stored
scene count at least as high as the scene-card number.

`outline_chapter_reorder` moves one novel/novella chapter to an unoccupied positive
number. An occupied or ambiguous destination is refused before changing anything.
Scene addresses are updated immediately and stable identities/prose are preserved.
It does not shift intervening chapters or rewrite plot references in plans and
summaries. It is blocked during autonomous writing; review those references afterward.

Scene chapter moves are supported only for novels/novellas. Short stories can be
split into adjacent scenes in their existing scene folder; flash fiction stays a
single scene and refuses splitting. Unsupported operations leave prose untouched.

Completed scene moves and merges retain their retired source files privately
under `.pnw/retained`; originals are not permanently deleted.
