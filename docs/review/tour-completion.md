# Fifteen-Minute Tour Tester Brief

This brief governs the timed evaluation of introductory guided tours for each paper by non-specialist testers.

## Evidence Format

Tour test records must contain:
- `reviewer`: tester ID from `docs/OWNERS.md`
- `role`: `tour-tester`
- `scope`: paper slug and tour ID (e.g. `special-relativity:fifteen-minute-tour`)
- `revisions`: git revisions of tour steps and UI components tested
- `date`: ISO 8601 completion date
- `result`: `accepted`, `accepted-with-changes`, `rejected`, `needs-rereview`
- `notes`: elapsed time per step, points of friction, navigation hurdles
- `file`: output record path under `content/reviews/<slug>/tour-completion.yaml`

## Tour Testing Protocol

1. **Target Audience:** Testers with no specialized physics background.
2. **Time Budget:** The complete tour path must be navigable within approximately 15 minutes.
3. **Step Progression:** Each step must present a concise core concept, a visual or interactive anchor, and an intuitive transition to the next step.
4. **Self-Contained Discovery:** Testers must be able to understand the central problem and Einstein's key move without requiring external reference materials.

## Sign-off

The tester records time metrics, user experience feedback, and signs the record in `content/reviews/<slug>/tour-completion.yaml`.
