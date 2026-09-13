# Change 25: snapshot export and format-correct progress

Added explicit working-draft versus accepted-snapshot export with a private source
manifest. Accepted export captures one immutable snapshot, uses its reading order,
preserves prose even when an assessment is stale, and can require complete/current
coverage. It does not incorporate subsequent working-file edits. Scene separators
now follow actual positions rather than numeric scene IDs. Repeated exports do not
overwrite earlier files. Conflicting accepted reading positions fail explicitly.

Progress uses the same resolved files and word-count function for all four formats.
It checks summary source hashes rather than file presence alone, includes accepted
coverage, and no longer labels status flags as proof of draft completeness or
literary readiness. Existing local compilation remains available.

Verification: syntax, strict TypeScript and 113 tests pass. New fixtures cover all
formats, actual progress dispatch, sparse addresses, snapshot-versus-working edits,
stale voice dependencies, manuscript hashes and duplicate accepted positions. An
incorrect expected word count in the new fixture was corrected after counting its
four words. No literary efficacy or human evaluation is asserted.
