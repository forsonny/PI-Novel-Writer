# /PNW-status — Resources

Data comes from project settings and scanned scene files. Word count splits scene
bodies on whitespace, regardless of status. Numeric gaps are checked only between
the smallest and largest discovered chapter/scene numbers; planned empty chapters
outside that range are not known.

The dashboard's session usage is recomputed from available Pi session entries,
including assistant/tool and compaction/branch-summary usage. It is an estimate,
not billing, and is omitted when unavailable.

`novel_chapter_list` and `novel_scene_list` return text tables, not JSON arrays.
Neither includes chapter titles from outlines.
