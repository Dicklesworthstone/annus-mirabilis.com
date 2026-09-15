# Project Decisions

A binding record of architectural, governance, and editorial decisions for Annus Mirabilis.
Each entry follows the shared decision format: question, options, choice, reason, decider,
date, evidence, beads unblocked, and revisit trigger.

---

## D-2026-09-15-companion-at-launch

- **Question:** Does the `molecular-dimensions` companion record (*Eine neue Bestimmung der Moleküldimensionen*, Ann. Phys. 19, 289–306 [1906] and correction 34, 591–592 [1911]) ship with the launch of the complete four-paper edition, or after it?
- **Options:**
  - **A. Ship at launch (scoped):** The launch waits for the complete companion record: pinned facsimiles for the dissertation, 1906 supplement, and 1911 correction; a scoped ledger and translation; the viscosity-relation derivation; the sugar-data fixtures; and the Avogadro lab's third panel, all built after the four flagship papers pass their definitions of done. *Risk:* Schedule and review pressure delay the launch of the core four papers.
  - **B. Ship after launch:** The companion is deferred immediately. Launch ships strictly with the four papers. The Avogadro lab launches with its two available panels (electrolytic and Brownian) and an honest, non-interactive "in preparation" third panel; the About page and timeline retain the historical context explaining the count.
  - **C. Timeboxed (recommended):** Consistent with Master Plan §3.7 and §20, companion work starts only after all four flagship papers pass their definitions of done. The companion ships at launch if and only if its acceptance gate (`am-companion-review-pfh8` closed) passes by a recorded milestone before `am-launch-readiness-audit-sc9b` starts; otherwise it is deferred cleanly without delaying the launch.
- **Choice:** **Option C (Timeboxed)**.
- **Reason:** Grounded directly in Master Plan §3.7 ("Status: companion record. It is not on the hero, it is not one of 'the four,' it is built only after the four are complete (§19), and it is scoped to the sections the Avogadro lab needs. It does not become a fifth flagship by accretion.") and §20 ("whether the companion record ships at launch or after"). Launching the four core papers must not be held hostage by the companion dissertation, yet if the companion's scoped translation, ledgers, and acceptance pass before the Batch H exit audit is complete, shipping it at launch enriches the Avogadro lab's third determination and connections material. Option C provides the exact balance: attempt within the defined timebox, but auto-trigger deferral if not ready.
- **Prepared by:** `IvoryJay` (swarm agent, `am-gov-decision-companion-at-launch-936`), as a recommendation adopting the position stated in Master Plan §3.7 and §20.
- **Decider:** not yet assigned. The bead requires the decider to be the project owner or the editorial owner named in `am-gov-owners-and-reviewers-hte`, which is an open human gate with no owner named.
- **Status:** AWAITING RATIFICATION. This entry is a recommendation and is **not binding** until the project owner or a named editorial owner ratifies it. No dependent bead may cite it as a settled decision.
- **Date:** 2026-09-15.
- **Timebox Milestone:** When `am-disc-batch-h-exit-audit-r8xq` is otherwise complete (all non-companion discovery and connections criteria satisfied) and before `am-launch-readiness-audit-sc9b` starts. Specifically, `am-companion-review-pfh8` must be closed by this milestone. If `am-companion-review-pfh8` is closed by that milestone, the companion ships at launch. If it is open at that milestone, deferral executes immediately without delaying the launch audit.
- **Deferral Procedure:**
  If the timebox milestone expires without `am-companion-review-pfh8` being closed:
  1. The coordinator, with the user's recorded approval, removes the dependency edges from `am-disc-batch-h-exit-audit-r8xq` to the companion beads (`am-companion-dissertation-record-nbvv`, `am-companion-review-pfh8`, `am-ref-viscosity-suspension-c9lp`, `am-src-facsimile-dissertation-2mp`, `am-src-ledger-dissertation-ppm7`, `am-data-bancelin-1911-94um`).
  2. The coordinator marks the deferred beads with a comment citing `D-2026-09-15-companion-at-launch`.
  3. The deferred beads are moved under `am-ep-later-gap` if the user requests.
  4. At build time, the content compiler and release manifest validator omit `molecular-dimensions` from `publishedPapers`.
  5. The Avogadro lab renders panel 3 in an honest "in preparation" state.
  6. The `/papers` catalogue shows `molecular-dimensions` with status "in preparation".
  7. The fixture table audit records the `molecular-dimensions` row as deferred, never passing.
- **Evidence:**
  - Master Plan `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md` §1.1, §3.7, §3.8, §13.3, §14.2, §19.3, §20, §21.
  - Graph dependency analysis in `.beads/issues.jsonl` verifying that `am-launch-readiness-audit-sc9b` depends on `am-disc-batch-h-exit-audit-r8xq`, which currently blocks on `am-companion-dissertation-record-nbvv` and `am-companion-review-pfh8`.
- **Beads Unblocked:**
  - `am-src-facsimile-dissertation-2mp` (Unblocked to pin facsimiles and draft receipts for `ap-19-289` and `ap-34-591`).
- **Revisit Trigger:**
  - The arrival of the timebox milestone during Batch H (`am-disc-batch-h-exit-audit-r8xq` execution), or explicit user direction to defer earlier (Option B) if facsimile or transcription review encounters insurmountable obstacles.

### Consequences for Dependent and Affected Beads

1. **`am-disc-avogadro-lab-pfi7` (Avogadro Lab):**
   - Must implement and test both states at build time without runtime environment branching.
   - If companion is admitted: Panel 3 renders the live viscosity-factor relation ($\eta^* = \eta(1 + 2.5\varphi)$) and Bancelin 1911 dataset.
   - If companion is deferred: Panel 3 renders an honest, non-interactive "in preparation" card showing only the two available determinations (electrolytic and Brownian) with zero manufactured placeholder values or fake data.
2. **`am-companion-dissertation-record-nbvv` (Companion Record):**
   - Authoring and review must remain strictly scoped to what the Avogadro lab needs (§3.7).
   - Work starts only after all four flagship papers pass their definitions of done.
   - Must close acceptance (`am-companion-review-pfh8`) by the Batch H exit audit milestone, or trigger deferral.
3. **`am-ref-viscosity-suspension-c9lp` (Viscosity Evaluator):**
   - Evaluator (`invertRadiusAndMolecularNumber`, `propagateUncertainty`, factor presets) is implemented to support the Avogadro lab and What-Can-You-Infer Case 3.
   - If companion is deferred at launch, the host reference evaluator remains tested in code but customer-facing pages show "in preparation".
4. **`am-ver-fixture-table-audit-nh5` (Fixture Table Audit):**
   - If companion ships at launch: The historical fixture row (`ap-19-289` / `ap-34-591`) must exist, be labeled by kind, and pass.
   - If companion is deferred: The fixture table audit explicitly records the `molecular-dimensions` row as `deferred`, never passing and never failing the launch audit.
5. **`am-disc-batch-h-exit-audit-r8xq` (Batch H Exit Audit):**
   - Companion edges stay until the timebox milestone.
   - If `am-companion-review-pfh8` is closed before or during Batch H audit completion, the companion criteria pass.
   - If not closed when Batch H is otherwise complete, the coordinator with user approval removes incoming companion edges per the deferral procedure.
6. **`am-launch-readiness-audit-sc9b` (Launch Readiness Audit):**
   - Readiness audit enforces honest representation of the chosen state.
   - If companion is shipped: Confirms complete companion review, fixtures, and inclusion in `publishedPapers`.
   - If companion is deferred: Asserts that no public page advertises the companion as available, `/papers` shows "in preparation", Avogadro lab panel 3 is honest "in preparation", and `molecular-dimensions` is absent from `publishedPapers`.
7. **`am-design-papers-index-afnu` (Papers Catalogue):**
   - Four flagship papers remain on the hero and primary catalogue index.
   - `molecular-dimensions` appears in the secondary catalogue labeled "companion", with dynamic status: "Available" if shipped, or "In Preparation" if deferred.
8. **`am-disc-cross-journey-exercises-j53n` (Cross-Journey Exercises):**
   - Route 3 (three-ways-to-count-atoms synthesis) activates its full three-way comparison only when the companion record exists.
   - When deferred, route 3 presents the two-way synthesis (Brownian displacement and blackbody radiation entropy) with a note that the viscosity determination is in preparation.
9. **`am-tour-evening-and-course-5kcb` (Tours and Course):**
   - Session 7 of the full course includes the companion record only if it ships (derived at build time from `Paper` record and `docs/DECISIONS.md`).
   - When companion is deferred, session 7 carries the explicit note that the Avogadro lab's third determination is in preparation.
10. **`am-rel-release-manifest-3gna` (Release Manifest Validator):**
    - The release manifest validator permits `molecular-dimensions` in `publishedPapers` only if `docs/DECISIONS.md` records it as shipped at launch.
    - If deferred, the manifest validator rejects any release containing `molecular-dimensions` in `publishedPapers`.
11. **`am-disc-timeline-xzef` (Timeline):**
    - Dissertation cards exist on Track 1. If companion is deferred, cards drop to year precision and do not link to a reader face; if companion ships, cards link to the companion edition anchor.
    - Both states preserve the Section 3.8 "four or five" historical note.
12. **`am-reason-what-can-you-infer-pqwb` (What-Can-You-Infer Workbench):**
    - Case 3 (radius and molecular number identifiability from viscosity) renders live intersection and table if companion is compiled; if compiled without companion, Case 3 displays an honest in-preparation card.
13. **`am-src-facsimile-dissertation-2mp` (Facsimile Dissertation):**
    - Unblocked immediately by this decision: acquisition and receipt drafting for `ap-19-289` and `ap-34-591` can proceed.
