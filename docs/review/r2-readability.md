# Non-Physicist R2 Readability Reviewer Brief

This brief governs the independent readability evaluation of the R2 (Full Explanation) reading face by non-physicist reviewers.

## Evidence Format

Readability review records must contain:
- `reviewer`: stable reviewer ID from `docs/OWNERS.md`
- `role`: `r2-readability-reviewer`
- `scope`: paper slug and evaluated section range
- `revisions`: git revisions of R2 explanatory text reviewed
- `date`: ISO 8601 completion date
- `result`: `accepted`, `accepted-with-changes`, `rejected`, `needs-rereview`
- `notes`: obstacles encountered, jargon flags, comprehension breaks
- `file`: output record path under `content/reviews/<slug>/r2-readability.yaml`

## Non-Physicist Reviewer Criteria

The R2 reading face is designed for motivated general readers, students, and educated non-physicists.
- **Reviewer Qualification:** The reviewer must **not** possess an advanced degree or professional training in physics. This ensures genuine diagnostic testing of explanatory clarity.
- **No Prerequisite Dead Ends:** If an unfamiliar concept or mathematical operation appears without an accessible definition or worked example, it must be flagged.
- **Tone & Rigor:** The explanation must neither assume advanced formalism nor condescend with misleading, over-simplified popularizations.

## Review Protocol

1. Read through the R2 narrative continuously from start to finish.
2. Verify that every transition between paragraphs follows logically.
3. Test interactive diagrams and colorized equations to ensure they illuminate rather than obscure the text.
4. Complete the 15-minute introductory path to ensure the essential argument is comprehensible within a single reading session.

## Sign-off

The reviewer completes their evaluation notes and signs off in `content/reviews/<slug>/r2-readability.yaml`.
