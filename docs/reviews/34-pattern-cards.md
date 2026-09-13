# Change 34: contextual pattern definitions reach the actual diagnostic worker

Final integration review found that the diagnostic worker received the complete
56-to-48 title crosswalk, but not the detailed evidence/intervention/overcorrection
cards from the blueprint. Added all 56 contextual cards, preserving 48 family
mappings, separate subtype definitions, family-level cause hypotheses and a
no-action rule. A scoped revision receives relevant cards only. Ordinary drafting
does not receive the full diagnostic bank. A read-only Pi tool provides the index
or selected cards, and the runtime-derived schema catalogue now contains 29 files.

Review: syntax, strict types and 147 local tests pass. New tests validate every
card, preserve subtype distinctions and immutable copies, exercise actual tool
dispatch and intercept the isolated diagnostic packet to confirm that evidence
questions and paired risks actually reach the critic. The larger diagnostic input
is included in existing token estimation and reservation checks.

The cards paraphrase the supplied source and reviewed crosswalk. They are not an
experimentally validated taxonomy, provenance classifier or automatic blacklist.
Their cause candidates remain hypotheses, and schema validity is not proof of a
critic's literary judgment. Live model and reader evaluation remain outstanding.
