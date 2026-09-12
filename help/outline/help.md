# /PNW-outline — Help Reference

`/PNW-outline` lists Markdown files under `outline/chapters`, using filename chapter
number plus frontmatter title/purpose (or limited heading fallbacks). It does not
show the beat sheet body, POV, timeline, scene counts, or manuscript agreement.

Tools create/read/update chapter outlines and upsert scene-card sections.
`outline_chapter_update` supports a replacement body plus optional `title`,
`timeline`, and `scenes` metadata. `outline_scene_card_create` keeps the stored
scene count at least as high as the scene-card number.

`outline_chapter_reorder` renames one outline and one manuscript directory; it does
not shift intervening chapters or comprehensively repair scene metadata/references.
It is blocked during autonomous writing. Inspect and validate manually afterward.
