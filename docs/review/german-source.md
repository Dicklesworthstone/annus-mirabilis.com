# German Source Reviewer Brief

This brief governs the German source review of the German critical edition text and English translations for the Annus Mirabilis edition.

## Evidence Format

Every German source review must be recorded as a structured review record containing:
- `reviewer`: stable reviewer ID from `docs/OWNERS.md`
- `role`: `german-source-reviewer`
- `scope`: paper slug and covered section IDs (e.g. `brownian-motion:s1-s3`)
- `revisions`: source and translation git revisions reviewed
- `date`: ISO 8601 date of completion
- `result`: one of `accepted`, `accepted-with-changes`, `rejected`, `needs-rereview`
- `notes`: reviewer findings, nuances, and qualitative assessments
- `file`: target output path under `content/reviews/<slug>/german-source.yaml`

## Materials

Reviewers must work directly from:
1. The pinned primary facsimile PDF scan in `public/papers/pdfs/`
2. The generated review packet produced via:
   ```bash
   bun scripts/build-review-packet.ts --paper <slug>
   ```
   (Use `--part part-1` or `--part part-2` for the special relativity paper, and `--include-gloss` for the mass–energy paper).

The review packet aligns diplomatic German transcriptions, facsimile page crops, English sentence units, notation mappings, and historical term markers side-by-side.

## German Fidelity

Compare every page's German blocks directly against the facsimile page image. Review page-by-page, never by spot check.
- Verify typography, spelling, archaic orthography, punctuation, and footnotes.
- Displayed equations must be verified symbol-by-symbol against the original typesetting.
- Page comparisons are recorded in `page-comparison.yaml` with fields `comparedBy`, `date`, and `result`.

## Translation Accuracy

Review entire sections as continuous physical and logical arguments:
- Preserve epistemic modality: terms such as "suggests", "must", "under these assumptions", and "to this approximation" carry distinct mathematical and logical weight and must not be conflated.
- Original notation is never translated or modernized in the primary translation face (e.g. Einstein's velocity $V$ in the 1905 paper must not be silently replaced with modern $c$).
- Substantive inline and display equations must align precisely with the German text.

## Disagreements

When the translation or diplomatic transcription departs from previous translations or secondary literature:
- Disagreements are recorded in `content/reviews/<slug>/disagreements.yaml` with unit id, German reading, English rendering or gloss, witness readings consulted, resolution, reason, and substantive flag.
- Major substantive departures are cross-referenced in the paper's provenance receipt (`docs/provenance/<key>.md`).

## Focus Items

Each paper specifies critical interpretive passages requiring explicit verification:
- Sign off all focus items listed in `content/reviews/<slug>/german-source-focus.yaml` citing the exact sentence IDs examined.

## Sign-off

Reviewers complete their assigned review template and import it into the repository using:
```bash
bun scripts/import-review-record.ts <filled template> --packet <tool-run-id>
```
If the underlying content changed since packet generation, the import tool will reject with `stale-unit`, requiring a diff review (`--since-packet <tool-run-id>`).

## Two Reviewers

For extensive papers (especially `special-relativity` with 31 pages):
- Review work may be partitioned between two qualified German source reviewers (e.g. one reviewer for German fidelity and one for translation accuracy, or divided across Part 1 and Part 2).
- Each reviewer signs only the scope they evaluated.
- No reviewer may evaluate material they personally drafted, translated, glossed, or edited.
