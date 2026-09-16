# History-of-Science Reviewer Brief

This brief governs the historical, contextual, and epistemic verification of historical claims, knowledge cards, and timeline entries in Annus Mirabilis.

## Evidence Format

History review records must contain:
- `reviewer`: stable reviewer ID from `docs/OWNERS.md`
- `role`: `history-reviewer`
- `scope`: paper slug or knowledge domain (e.g. `light-quanta:historical-context`)
- `revisions`: git revisions of historical cards, essays, and notes reviewed
- `date`: ISO 8601 completion date
- `result`: `accepted`, `accepted-with-changes`, `rejected`, `needs-rereview`
- `notes`: archival source citations, timeline adjustments, historiographical context
- `file`: output record path under `content/reviews/<slug>/history.yaml`

## Epistemic Integrity & The 1904 Boundary

The historical discovery paths are strictly bounded by what was scientifically known and available prior to 1905:
1. **Four Historical Categories:**
   - A proposition was **publicly available** before the end of 1904.
   - There is direct **evidence Einstein knew or used** it.
   - The **paper itself cites or asserts** it.
   - The site uses it in a **plausible pedagogical reconstruction** ("A route you could take").
2. **Four Shelf Verification Queues:**
   - `available-1904`: verified published and accessible by December 31, 1904.
   - `parallel-work`: independent contemporary 1905 work (e.g. Smoluchowski on Brownian motion, Poincaré on relativity).
   - `later-confirmation`: post-1905 experimental and theoretical validations (e.g. Perrin 1908–1909, Millikan 1916).
   - `pedagogical-reconstruction`: modern explanatory aids clearly flagged as retrospective lenses (e.g. Minkowski 1908 spacetime geometry).
3. **The Narrowed Sign-off:**
   - Historical cards whose dates or attributions have been restricted or qualified carry an explicit `narrowed` sign-off.
   - **Exit Condition Rule:** An `open` historical card or unverified attribution queue entry represents an unmet quality gate exit condition and blocks release certification.

## Sign-off

The reviewer verifies all shelf cards, essays, and historian's margins against primary sources, recording findings in `content/reviews/<slug>/history.yaml`.
