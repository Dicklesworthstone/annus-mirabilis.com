# Definition of Done Audit: Brownian Motion (`ap-17-549`)

- **Bead:** `am-dod-brownian-2k4y`
- **Paper:** *Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen* (Ann. Phys. (4) 17, 549–560, 1905)
- **Bibliographic Key:** `ap-17-549`
- **Audited Commit / Build Identity:** `2ae73e4`
- **Audit Date:** 2026-09-16
- **Auditor:** `agent:WildCrane` (Automated Coding Agent, Wave Two)
- **Governance Reference:** [`docs/OWNERS.md`](../../docs/OWNERS.md)
- **Overall Status:** **INCOMPLETE (1 of 9 Items Passed, 8 Items Open/Incomplete, Exit Conditions Open)**

---

## Proof Hierarchy & Epistemic Conventions

Per **AGENTS.md** and orchestrator instruction, every finding below is assigned an explicit proof class from the project hierarchy:
1. `field`: Direct physical observation on real external hardware or live human study participants. *(Not available / Not performed in this environment).*
2. `live`: Running process inspection in a live browser or server environment.
3. `capture-and-replay`: Verified recording and deterministic bitwise playback.
4. `unit`: Automated unit/integration test assertions passing in CI/CLI.
5. `planted-red`: Automated test verifying failure modes and negative controls.
6. `static`: Direct filesystem, schema, and AST inspection.
7. `desk-inference`: Logical deduction from design documents or platform specifications.
8. `ABSENT` / `NOT PERFORMED`: Required artifact, study, or review does not exist.

---

## 1. Item 1: Complete Paper Text (§1–§5, Introduction, Closing)

- **Requirement:** Every original paragraph, displayed equation, substantive inline equation, footnote, qualification, date-line, acknowledgment, and reference has a place in the edition. Complete coverage across §§1–5, Introduction, and Closing.
- **Check Performed:** Inspected [`content/papers/brownian-motion.json`](../../content/papers/brownian-motion.json) and authored argument inventory under [`content/arguments/brownian-motion/`](../../content/arguments/brownian-motion/).
- **Findings:**
  - `content/papers/brownian-motion.json` declares only sections `s4` (§4) and `s5` (§5).
  - Sections `s1` (Osmotic pressure), `s2` (Osmotic pressure from molecular-kinetic standpoint), `s3` (Diffusion of suspended particles), the historical Introduction, and Closing date-lines are **absent** from content manifests.
  - Manifest explicitly states: `status: "explanation-preview"`, `sourceStatus: "in-preparation"`, with notice: *"Section headings identify the argument being discussed, not a completed source inventory."*
- **Proof Class:** `static` (file inspection of `content/papers/brownian-motion.json`).
- **Outcome:** **INCOMPLETE** (Owning bead: `am-cm-source-manifest-6qa`, `am-ep-brownian-complete-6xe`).

---

## 2. Item 2: Bilingual Edition and Interlinear Gloss

- **Requirement:**
  1. Pinned facsimile PDF with page-to-section mapping.
  2. Reviewed German diplomatic transcription ledger.
  3. Sentence-aligned English translation.
  4. Interlinear gloss units for required sections.
  5. Attributed German source reviews for translation (`am-edn-review-german-brownian-cfh`) and gloss (`am-edn-review-german-gloss-brownian-1s9x`).
- **Check Performed:** Inspected `public/`, `content/`, and [`docs/OWNERS.md`](../../docs/OWNERS.md). Checked running reader component notices in [`src/reader/PaperReader.tsx`](../../src/reader/PaperReader.tsx).
- **Findings:**
  - Pinned facsimile scan `ap-17-549.pdf`: **ABSENT** from `public/`.
  - Reviewed German ledger: **ABSENT** from `content/`.
  - Aligned English translation: **ABSENT**; only newly authored explanatory text in modern notation exists.
  - Interlinear gloss units: **ABSENT** (structural Batch D wait: `am-edn-gloss-brownian-or6t`).
  - German source reviews: **NOT PERFORMED**. Roles `open-german-source-brownian-motion` and `open-glossator-brownian` in `docs/OWNERS.md` remain `open: recruiting`.
  - Running site behavior: German, English, gloss, and facsimile faces render explicit *"not yet available"* placeholder notices.
- **Proof Class:** `static` (directory and file inspection) + `unit` ([`src/testing/checkRegistry.test.ts`](../../src/testing/checkRegistry.test.ts)).
- **Outcome:** **OPEN / NOT PERFORMED / ABSENT** (Owning beads: `am-edn-review-german-brownian-cfh`, `am-edn-review-german-gloss-brownian-1s9x`, `am-edn-gloss-brownian-or6t`).

---

## 3. Item 3: Explanations & Foundation Connections

- **Requirement:** Four readings for every section (Overview, Mathematical Derivation, Physical Intuition, Historical/Critical Moves), with no prerequisite dead ends and seamless navigation to foundational concepts.
- **Check Performed:** Audited argument definitions in [`content/arguments/brownian-motion/`](../../content/arguments/brownian-motion/) and foundations in [`content/foundations/`](../../content/foundations/).
- **Findings:**
  - 6 argument records are authored for §4 and §5:
    1. [`arg-bm-observable.json`](../../content/arguments/brownian-motion/arg-bm-observable.json)
    2. [`arg-bm-independent-steps.json`](../../content/arguments/brownian-motion/arg-bm-independent-steps.json)
    3. [`arg-bm-diffusion-equation.json`](../../content/arguments/brownian-motion/arg-bm-diffusion-equation.json)
    4. [`arg-bm-gaussian.json`](../../content/arguments/brownian-motion/arg-bm-gaussian.json)
    5. [`arg-bm-diffusivity.json`](../../content/arguments/brownian-motion/arg-bm-diffusivity.json)
    6. [`arg-bm-inference.json`](../../content/arguments/brownian-motion/arg-bm-inference.json)
  - 18 foundation concepts are authored and linked: `random-walks`, `diffusion-equation`, `gaussian-distributions`, `mean-variance-rms`, `taylor-expansion`, `error-and-inference`, etc.
  - Return-stack navigation state and focus restoration are verified by [`src/testing/readerNavigation.test.mjs`](../../src/testing/readerNavigation.test.mjs).
  - Sections §1–§3 lack authored arguments and four-reading projections.
- **Proof Class:** `unit` ([`src/testing/readingContent.test.mjs`](../../src/testing/readingContent.test.mjs), [`src/testing/readerNavigation.test.mjs`](../../src/testing/readerNavigation.test.mjs)) + `static`.
- **Outcome:** **INCOMPLETE** (§4–§5 reference slice covered; §§1–3 open).

---

## 4. Item 4: Results Face Cards & Misconception Ledger

- **Requirement:**
  1. Results face cards for all 1905 Brownian predictions (displacement law $\lambda_x = \sqrt{2Dt}$, Avogadro constant calculation, temperature/viscosity dependence, microscopic scale inference).
  2. Misconception ledger with at least 5 entries (8 authored target), opening instruments at declared mode (e.g. `bm-04:kicks-off`) or registered preset (e.g. `bm-08-noise-only`).
- **Check Performed:** Checked content directory for results cards and misconception ledgers; inspected open bead status.
- **Findings:**
  - Results face cards bead `am-bm-results-cards-ft8k`: **OPEN**.
  - Misconception ledger bead `am-bm-misconceptions-2hk1`: **OPEN**.
  - No misconception records or results cards exist under `content/` for Brownian motion.
- **Proof Class:** `static` (directory inspection).
- **Outcome:** **OPEN / ABSENT** (Owning beads: `am-bm-results-cards-ft8k`, `am-bm-misconceptions-2hk1`).

---

## 5. Item 5: Scientific Instruments (BM-01 to BM-08 and Kitchen Mode)

- **Requirement:** Instruments BM-01 through BM-08 and Kitchen mode, each with dispatcher case, instance-scoped owner, teaching tape identities, passing fixtures, honest execution labels (`notModeled`), predict mode or recorded exemption, show-the-code, embed routes, 320px responsive layout, and reduced motion.
- **Check Performed:** Audited [`src/experiments/`](../../src/experiments/), [`src/workers/`](../../src/workers/), [`src/app/lab/`](../../src/app/lab/), and test suites.
- **Status by Instrument:**
  1. **BM-01 (Tracer Ensemble):** **BUILT**. Instance-scoped owner ([`src/experiments/bm01/`](../../src/experiments/bm01/)), Worker host ([`src/workers/host/bm01Host.ts`](../../src/workers/host/bm01Host.ts)), route `/lab/bm-01`. Teaching tape `einstein-0-8-micron` audited in [`src/testing/teachingTapes.test.ts`](../../src/testing/teachingTapes.test.ts).
  2. **BM-02 (Osmotic Pressure Balance):** **UNBUILT** (`src/experiments/bm02/` absent).
  3. **BM-03 (Dynamic Equilibrium):** **UNBUILT** (`src/experiments/bm03/` absent).
  4. **BM-04 (Microscopic Kick Simulation):** **UNBUILT** (`src/experiments/bm04/` absent).
  5. **BM-05 (Random Walk Simulator):** **BUILT**. Worker host ([`src/workers/host/bm05Host.ts`](../../src/workers/host/bm05Host.ts)), route `/lab/bm-05`. Tested by [`src/testing/bm05Controls.test.mjs`](../../src/testing/bm05Controls.test.mjs) and [`src/testing/bm05Worker.test.mjs`](../../src/testing/bm05Worker.test.mjs).
  6. **BM-06 (Diffusion Field / FTCS):** **BUILT**. Worker host ([`src/workers/host/bm06Host.ts`](../../src/workers/host/bm06Host.ts)), route `/lab/bm-06`. Stability refusal tested in [`src/testing/ftcs.test.mjs`](../../src/testing/ftcs.test.mjs).
  7. **BM-07 (Molecular Number Inference):** **BUILT**. Worker host ([`src/workers/host/bm07Host.ts`](../../src/workers/host/bm07Host.ts)), route `/lab/bm-07`. Teaching tape `perrins-count` audited in [`src/testing/teachingTapes.test.ts`](../../src/testing/teachingTapes.test.ts).
  8. **BM-08 (Microscope Observation / Camera):** **BUILT**. Worker host ([`src/workers/host/bm08Host.ts`](../../src/workers/host/bm08Host.ts)), route `/lab/bm-08`.
  9. **Kitchen Mode (`/kitchen`):** **UNBUILT** (`am-bm-kitchen-page-ny2o` open).
  10. **Show-the-code:** In flight under `am-inst-show-the-code-4brv`.
  11. **Embed Routes (`/embed/lab/[experiment]`):** **UNBUILT** (`am-inst-embed-route-rnyg` open).
- **Proof Class:** `unit` (15 passing instrument/worker test suites) + `static`.
- **Outcome:** **INCOMPLETE** (5 of 8 core instruments built; BM-02..BM-04, kitchen mode, and embed routes unbuilt).

---

## 6. Item 6: Journey II (Discovery Sequence)

- **Requirement:** Front door and side door; no-algebra first encounter (`entrance-brownian-motion`); dated and sourced shelf cards; worked forks (e.g. Naegeli fork, kicks-off branch); check steps live from snapshot.
- **Check Performed:** Inspected [`src/app/discover/brownian-motion/page.tsx`](../../src/app/discover/brownian-motion/page.tsx) and open bead dependencies.
- **Findings:**
  - Discover route exists as an early prototype layout at `/discover/brownian-motion`.
  - Journey II shelf cards bead `am-disc-journey-ii-shelf-zbli`: **OPEN**.
  - Journey II chain bead `am-disc-journey-ii-chain-pl6u`: **OPEN**.
  - Worked non-paper branches and live snapshot check steps are not complete.
- **Proof Class:** `static` (route and bead inspection).
- **Outcome:** **OPEN / INCOMPLETE** (Owning beads: `am-disc-journey-ii-shelf-zbli`, `am-disc-journey-ii-chain-pl6u`).

---

## 7. Item 7: Historian's Margin

- **Requirement:** Seven required historian's-margin records and velocity-warning note with primary sources.
- **Check Performed:** Checked content directory and bead status for `am-bm-margin-entries-7fa4`.
- **Findings:**
  - Bead `am-bm-margin-entries-7fa4`: **OPEN**.
  - Margin records for Brownian reception, historical debates (e.g., Gouy, Poincaré, Perrin), and instantaneous velocity warning are not yet authored in `content/`.
- **Proof Class:** `static` (file and bead check).
- **Outcome:** **OPEN / ABSENT** (Owning bead: `am-bm-margin-entries-7fa4`).

---

## 8. Item 8: Tour and Acceptance Scenario

- **Requirement:**
  1. Fifteen-minute tour completed by a non-physicist reader who stated the claim in one sentence (`am-bm-review-reader-x77h`).
  2. Full §17.6 acceptance scenario with a reader unfamiliar with algebra plus separate nonvisual check (`am-bm-acceptance-scenario-vjn4`).
- **Check Performed:** Inspected [`docs/OWNERS.md`](../../docs/OWNERS.md) roles and bead status.
- **Findings:**
  - Non-physicist readability review bead `am-bm-review-reader-x77h`: **OPEN**. In `docs/OWNERS.md`, role `open-r2-readability-brownian-motion` is `open: recruiting`.
  - §17.6 acceptance scenario bead `am-bm-acceptance-scenario-vjn4`: **OPEN**.
  - Neither live user study nor accessibility co-design session has been conducted on live human participants.
- **Proof Class:** `static` (`docs/OWNERS.md` registry inspection).
- **Outcome:** **OPEN / NOT PERFORMED** (Owning beads: `am-bm-review-reader-x77h`, `am-bm-acceptance-scenario-vjn4`).

---

## 9. Item 9: Gates and Automated Acceptance Suites

- **Requirement:** Clean passing gates across compilation, typecheck, lint, format, tests, build, ubs, WASM verification, and browser Playwright suites.
- **Check Performed:** Executed all repository gates at commit `2ae73e4`.
- **Gate Execution Evidence:**
  - `bun run prepare:content`: **PASSED** (exit code 0; 1 paper, 18 foundations compiled, 3 equations compiled).
  - `bun run typecheck`: **PASSED** (exit code 0; 0 errors repository-wide).
  - `bun run format:check`: **PASSED** (exit code 0; 0 formatting errors).
  - `bun test`: **PASSED** (exit code 0; 1,788 passed / 0 failed across 228 test files).
  - `bun run build`: **PASSED** (exit code 0; Next.js 15.5.25 App Router build succeeded).
  - WASM verification script (`verify-wasm-artifacts`, planned/unbuilt): **NOT PERFORMED** (No WASM artifacts exist yet; all physics run via TypeScript reference evaluators).
  - Browser Acceptance Suites (`am-bm-slice-e2e-sbqu`, `am-bm-e2e-complete-gmdb`): **OPEN** (Playwright test harness pending execution in CI).
  - Editorial Reviews: **OPEN / RECRUITING** in [`docs/OWNERS.md`](../../docs/OWNERS.md).
- **Proof Class:** `unit` / `static` (automated runner execution).
- **Outcome:** **PASSED (Static & Unit Gates) / OPEN (Browser E2E & Human Reviews)**.

---

## 10. Batch C Exit Evidence & Inference-Laboratory Closure

1. **Coverage:**
   - **Status:** **INCOMPLETE**. Sections §4 and §5 are covered; §§1–3, Introduction, and Closing remain in preparation.
2. **No Modern-Constant Circularity:**
   - **Status:** **OPEN**. Reference physics models support historical constant sets (`einstein-1905-brownian-printed` in [`src/physics/reference/constants.ts`](../../src/physics/reference/constants.ts)); audit bead `am-ver-no-circularity-audit-6vj` is open.
3. **The §17.6 Acceptance Scenario:**
   - **Status:** **NOT PERFORMED** (bead `am-bm-acceptance-scenario-vjn4` open; recruiting human participant).
4. **Inference-Laboratory Closure Condition (Plan §19.4):**
   - Reference diffusion and synthetic inference tests pass: [`src/testing/inferenceSynthetic.test.mjs`](../../src/testing/inferenceSynthetic.test.mjs) (exit 0).
   - Stokes–Einstein $D$ and RMS $\lambda_x$ evaluations match 1905 printed values ($0.795\,\mu\text{m}$ at 1 s, $6.16\,\mu\text{m}$ at 60 s in [`src/testing/diffusion.einsteinPrinted.test.ts`](../../src/testing/diffusion.einsteinPrinted.test.ts)).
   - Kitchen home microscope mode and video tracking pipeline remain **unbuilt** (`am-bm-kitchen-page-ny2o` open).

---

## 11. Gap Matrix & Owning Beads

| DoD Item | Category | Live Status | Owning Open Bead |
|---|---|---|---|
| Item 1 | Complete Paper Text (§1–§5, Intro, Close) | INCOMPLETE (§4–5 only) | `am-cm-source-manifest-6qa`, `am-ep-brownian-complete-6xe` |
| Item 2 | Facsimile, German Ledger, Gloss, Reviews | OPEN / ABSENT | `am-edn-review-german-brownian-cfh`, `am-edn-review-german-gloss-brownian-1s9x`, `am-edn-gloss-brownian-or6t` |
| Item 3 | Explanations & Four Readings | INCOMPLETE (§4–5 only) | `am-read-parallel-readings-0a2`, `am-ep-brownian-complete-6xe` |
| Item 4 | Results Cards & Misconceptions | OPEN / ABSENT | `am-bm-results-cards-ft8k`, `am-bm-misconceptions-2hk1` |
| Item 5 | Instruments BM-01..08, Kitchen, Embed | INCOMPLETE (5 of 8 built) | `am-inst-embed-route-rnyg`, `am-bm-kitchen-page-ny2o`, `am-inst-show-the-code-4brv` |
| Item 6 | Journey II (Chain, Shelf Cards, Forks) | OPEN / INCOMPLETE | `am-disc-journey-ii-shelf-zbli`, `am-disc-journey-ii-chain-pl6u` |
| Item 7 | Historian's Margin Entries | OPEN / ABSENT | `am-bm-margin-entries-7fa4` |
| Item 8 | Tour & Non-Physicist Scenario | OPEN / NOT PERFORMED | `am-bm-review-reader-x77h`, `am-bm-acceptance-scenario-vjn4` |
| Item 9 | Gates, E2E, Editorial Acceptance | INCOMPLETE (Core gates PASS; E2E/Reviews OPEN) | `am-bm-e2e-complete-gmdb`, `am-bm-review-physics-arfv` |
| Exit | Batch C Exit & Inference Closure | INCOMPLETE | `am-ep-brownian-complete-6xe`, `am-ver-no-circularity-audit-6vj` |

---

## 12. Conclusion and Next Steps

This audit strictly confirms that the Brownian motion paper is at the **Batch B reference slice** milestone, covering the core physical mechanism in §§4–5 and five interactive instruments (BM-01, BM-05, BM-06, BM-07, BM-08).

The bead `am-dod-brownian-2k4y` must **remain OPEN** until the upstream blocker beads listed above deliver the complete 5-section source edition, facsimile, German/gloss reviews, remaining instruments (BM-02..BM-04, kitchen mode), Journey II discovery chain, and human review ratifications.
