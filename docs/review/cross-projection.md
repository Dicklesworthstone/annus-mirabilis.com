# Cross-Projection Reviewer Brief

This brief governs the cross-projection consistency review that traces a single core physical claim across all eleven projections of the edition.

## Evidence Format

Cross-projection review records must contain:
- `reviewer`: stable reviewer ID from `docs/OWNERS.md`
- `role`: `cross-projection-reviewer`
- `scope`: paper slug and selected anchor ID (e.g. `brownian-motion:s5-p1`)
- `revisions`: git revisions of all eleven projections reviewed
- `date`: ISO 8601 completion date
- `result`: `accepted`, `accepted-with-changes`, `rejected`, `needs-rereview`
- `notes`: detailed cross-face parity assessment and findings log
- `file`: output record path under `content/reviews/<slug>/cross-projection.yaml`

## The Eleven Projections (in Reading Order)

The cross-projection reviewer selects a claim with nuanced physical qualifications and traces it across all eleven projections in exact reading order:
1. **German source block:** Diplomatic transcription of the original Annalen der Physik text.
2. **Aligned translation unit:** Sentence-aligned English translation preserving modality.
3. **R0 reading:** First-encounter overview and historical context.
4. **R2 reading:** Full explanation designed for educated general readers.
5. **R3 reading:** Formal derivation showing every intermediate mathematical step.
6. **Equation record with authored spoken form:** Semantic expression tree with canonical quantity bindings and screen-reader speech rendering.
7. **Instrument whose weave predicate lights the claim:** Interactive visualizer or simulation whose spec-clause highlights the exact premise or conclusion.
8. **Results card:** Summary card stating physical consequences, limits, and uncertainties.
9. **Printed chapter:** Formatted broadside / print edition projection.
10. **Accessible equivalent:** Nonvisual text alternative or tactile table for screen-reader users.
11. **Fifteen-minute tour:** Guided introductory journey step.

## Four Review Verdicts

Each projection receives one of four verdicts:
- `supported`: The claim is represented accurately with all necessary physical premises and limits.
- `qualified`: The claim is represented with deliberate, clearly stated approximations and bridges.
- `discrepant`: The representation contradicts or alters the meaning of the source claim.
- `absent`: The claim is omitted where required in that projection.

## Seven Finding Kinds

Any defect identified during review must be categorized into one of seven finding kinds:
1. `unsupported-claim`
2. `dropped-qualification`
3. `notation-drift`
4. `missing-accessible-bridge`
5. `broken-weave-link`
6. `misaligned-step`
7. `unexplained-jump`

## Self-Review Prohibition

The cross-projection reviewer must have authored none of the eleven projections under review for that paper.

## Sign-off

The reviewer completes the cross-projection matrix and records findings in `content/reviews/<slug>/cross-projection.yaml`.
