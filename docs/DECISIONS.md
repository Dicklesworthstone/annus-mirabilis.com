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
- **Decider:** Jeff Emanuel, project owner. Ratified 2026-09-15 in the orchestration session; recorded by SandyCedar on the owner's explicit instruction. `docs/OWNERS.md` does not exist yet and remains owned by `am-gov-owners-and-reviewers-hte`; the project owner ratified directly, which the records' own wording permits ("the project owner **or** a named editorial owner").
- **Status:** RATIFIED 2026-09-15 by the project owner. This entry is **binding**. Dependent beads may now cite it as a settled decision.
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

---

## D-2026-09-15-stack-versions

- **Question:** Which exact versions of each framework, runtime, library, and tool does the project lock at kickoff, and which Content-Security-Policy (CSP) strategy do they make possible?
- **Options:**
  - **A. Bleeding-edge / Canaries:** Adopt Next.js 16 canaries, React 19.3+, and latest unpinned dependencies. *Risk:* Frequent breaking changes, unstable APIs, build flakiness, and framework churn that conflicts with Rule 0/Rule 2 and diverts effort from the scientific critical path.
  - **B. Locked Donor-Matched Stable Stack (recommended):** Retain the donor's proven architectural stack—Next.js 15 (App Router), React 19.0, TypeScript 5.7+ strict, Biome 2.5, Bun 1.4 for isolated tests, Tailwind 3.4, KaTeX 0.18, direct Three.js 0.185 (no React Three Fiber), pdfjs-dist, and Zod—locking exact supported patch releases that resolve security advisories (e.g. Next.js 15.5.25 to eliminate earlier Next 15 CVEs), validated by an empirical browser compatibility probe.
  - **C. Legacy Pages Router or Alternative Frameworks (Refused):** Refused under AGENTS.md Rule 2 (Zero tolerance for legacy Pages Router or second app roots).
- **Choice:** **Option B (Locked Donor-Matched Stable Stack)**.
- **Reason:** Grounded directly in Master Plan §2.4 ("A framework migration is never part of the scientific critical path. Select current supported, mutually compatible versions at kickoff after a compatibility and security review, then lock them."), Plan §20 ("framework and library versions to lock"), and the empirical compatibility probe executed in Chromium and WebKit. Locking stable, security-cleared versions matching the donor's proven extraction seams eliminates framework churn and unblocks application scaffolding.
- **Prepared by:** `DarkSnow` (swarm agent, `am-gov-decision-stack-versions-6ax`), adopting the evidence from the session scratch compatibility probe.
- **Decider:** Jeff Emanuel, project owner. Ratified 2026-09-15 in the orchestration session; recorded by SandyCedar on the owner's explicit instruction. `docs/OWNERS.md` does not exist yet and remains owned by `am-gov-owners-and-reviewers-hte`; the project owner ratified directly, which the records' own wording permits ("the project owner **or** a named editorial owner").
- **Status:** RATIFIED 2026-09-15 by the project owner. This entry is **binding**. Dependent beads may now cite it as a settled decision.
- **Date:** 2026-09-15.

### 1. Locked Dependency and Tool Version Inventory

Every runtime library, build tool, and runtime environment is pinned to an exact version. Floating ranges (`^` or `~`) are prohibited in `package.json`.

**The Evidence column, added 2026-09-19 (`am-niyd`).** These rows are not all evidenced the same
way, and a licence review must not read the table as uniformly machine-checked. Each row declares
what stands behind its version and licence cells:

- **`collector`** (10 rows) — the `license-inventory` gate reads this package from the manifests on
  disk and emits it into `THIRD_PARTY_NOTICES.md`. The version and licence recorded here are
  compared against that output, and a disagreement fails the gate.
- **`probe-only`** (4 rows) — exercised once by the 2026-09-15 compatibility probe recorded in §3
  below, and by nothing since. That probe ran in a session scratch directory that no longer
  exists, so no standing check reads these rows. All four are also absent from `package.json`:
  they are pinned for capabilities not yet adopted.
- **`unchecked`** (11 rows) — neither. Hand-maintained, and nothing in this repository verifies the
  version or the licence. Five of them (`node`, `bun`, `fonttools`, `ubs`, `vercel`) are local
  binaries or runtimes that the collectors cannot reach at all, because the collectors read npm
  manifests and a local CLI has none.

The column is itself checked. `src/testing/docs/noticeLayers.test.ts` recomputes every row's class
from `THIRD_PARTY_NOTICES.md` and from §3's own probe sentence, and fails when a declared class
disagrees with the evidence that actually exists.

A class states what evidence exists, not whether a row is right. `unchecked` does not mean wrong,
and `collector` does not mean the dependency is appropriate: only that the version and licence in
the row match what the collector found on disk.

| Category | Package / Tool | Locked Version | License | Evidence | Scope | Selection Rationale |
|---|---|---|---|---|---|---|
| **Runtime** | `node` | `22.13.1` (LTS) | MIT | `unchecked` | Build / Server | Node 22 LTS ("Jod"), released 2025-01-21; the latest release in the 22.13 line, which ends at 22.13.1. Used by `next build` and Next CLI locally, in CI, and on Vercel. Recorded in `package.json:engines.node`, which is the authority for this cell. The separate `@types/node` pin is `22.13.4`; types-package versions do not track Node releases, and this row previously carried that number by mistake (corrected 2026-09-19, `am-g8zs`). |
| **Runtime** | `bun` | `1.4.0` | MIT | `unchecked` | Test / Script | Pinned in `packageManager: "bun@1.4.0"`. Executes tests, data pipelines, and verified scripts with native `--isolate` support. |
| **Framework** | `next` | `15.5.25` | MIT | `collector` | App Core | Next.js 15 App Router (`output: 'export'` / static pre-rendering). Version 15.5.25 patches 34 security advisories present in 15.2.0 (including RCE GHSA-9qr9-h5gf-34mp and RSC DoS CVEs). |
| **Framework** | `react` | `19.0.0` | MIT | `collector` | Client / UI | Matched to Next.js 15.5 App Router core. Zero client-side hydration drift. |
| **Framework** | `react-dom` | `19.0.0` | MIT | `collector` | Client / UI | DOM renderer for React 19. |
| **Language** | `typescript` | `5.7.3` | Apache-2.0 | `collector` | Development | Strict TypeScript compiler for build validation and CI `tsc --noEmit`. |
| **Styling** | `tailwindcss` | `3.4.17` | MIT | `probe-only` | Build | Tailwind v3 CSS token architecture. Keeps root `tailwind.config.ts` allowlisted in architecture gate without v4 breaking configuration changes. |
| **Styling** | `postcss` | `8.5.26` | MIT | `collector` | Build | PostCSS processor; pinned via override to 8.5.26 to eliminate source map path traversal CVEs (GHSA-r28c-9q8g-f849). |
| **Styling** | `autoprefixer` | `10.4.20` | MIT | `probe-only` | Build | Vendor prefixing for cross-browser CSS rules. |
| **Icons** | `lucide-react` | `0.475.0` | ISC | `unchecked` | Client / UI | Lightweight, tree-shakeable iconography for UI chrome and laboratory controls. |
| **Math** | `katex` | `0.18.4` | MIT | `collector` | Build / Client | Static KaTeX rendering HTML plus MathML at build time; restricted trust callback for interactive tokens (`\htmlClass`, `\htmlData`). |
| **3D Engine** | `three` | `0.185.1` | MIT | `unchecked` | Client (Lazy) | Direct Three.js only where 2D projections lose spatial information. React Three Fiber is explicitly omitted (Discrepancy 7.1). |
| **Types** | `@types/three` | `0.185.4` | MIT | `unchecked` | Development | Type definitions for direct Three.js scene graphs. |
| **Facsimile** | `pdfjs-dist` | `6.3.289` | Apache-2.0 | `probe-only` | Client (Lazy) | Primary facsimile viewer engine; worker loaded lazily from same-origin `/pdf.worker.min.mjs` under strict CSP. |
| **Schemas** | `zod` | `4.4.3` | MIT | `probe-only` | Build / Data | Declarative schema validation for content compiler and provenance receipts. Build-time execution avoids runtime `unsafe-eval` JIT compilation. |
| **Archive** | `fflate` | `0.8.3` | MIT | `unchecked` | Build / Scripts | Fast, zero-dependency zip/decompression utility for bundle and asset scripts. |
| **Content** | `js-yaml` | `4.1.0` | MIT | `collector` | Build / Content | Strict YAML parser for declarative content records under `content/`. |
| **Content** | `marked` | `15.0.7` | MIT | `unchecked` | Build / Content | Constrained Markdown parser enforcing closed node allowlist (no raw HTML, no executable MDX). |
| **Search** | `minisearch` | `7.1.2` | MIT | `unchecked` | Build / Client | Lightweight (under 8 kB gzipped) client-side search indexing engine over build-time pre-indexed paper tokens. Chosen over FlexSearch due to deterministic serialization and zero memory leak profile. |
| **Font Tool** | `fonttools` (`pyftsubset`) | `4.56.0` | MIT | `unchecked` | Build / Scripts | Reproducible subsetting of Newsreader, Plus Jakarta Sans, and JetBrains Mono fonts without omitting German diacritics, Greek letters, or mathematical notation. |
| **Linter** | `@biomejs/biome` | `2.5.8` | MIT / Apache-2.0 | `collector` | Development | High-speed linting, code formatting, and syntax verification. |
| **Testing** | `playwright` | `1.62.1` | Apache-2.0 | `collector` | Testing | Browser automation harness driving headless Chromium, WebKit, and Firefox acceptance suites. |
| **Testing** | `@axe-core/playwright` | `4.10.1` | MPL-2.0 | `collector` | Testing | Automated WCAG AA accessibility compliance verification in end-to-end tests. |
| **Scanner** | `ubs` | `3.0.0` | MIT | `unchecked` | Development | Ultimate Bug Scanner; local static analysis gate. **Version and licence UNVERIFIED and known to disagree with the installed binary — read the verification note below this table before relying on this row.** |
| **Deployment** | `vercel` | `59.10.0` | Apache-2.0 | `unchecked` | Deployment | Vercel CLI driving candidate-then-promote deployment pipeline (`vercel build`, `vercel deploy --prebuilt`). |

**The `ubs` row specifically (added 2026-09-19, `am-niyd`).** The Evidence column above marks this
row `unchecked`. What follows is why that matters more here than for the other ten, and what a
reconciler must not do.

- **`ubs` is covered by none of the five collectors**, because it is a local binary rather
  than an npm dependency. It appears zero times in every
  `artifacts/test-logs/license-inventory/*.jsonl` and `license-notice/*.jsonl` run, and
  `scripts/license-inventory/` contains no reference to this document.
- **The recorded version is known to disagree with the installed tool.** This table records
  `3.0.0`; `ubs --version` on the reference machine reports `UBS Meta-Runner v5.0.3`. Two major
  versions apart. Which one is the project's pin is **not decided here** and must not be guessed:
  putting a plausible number into this document is exactly the failure this note exists to
  prevent.
- **A version change in this table is a licence question, not a number edit.** The `MIT` in this
  row was recorded against `3.0.0`. It is not evidence about `5.0.3`, and reconciling the version
  without re-checking the licence of the version actually chosen would leave a licence claim
  standing on a version nobody verified it against.
- Note for whoever reconciles it: `ubs --version` prints a trailing `(git <hash>)` which is **this
  repository's HEAD at invocation**, not an ubs build id. Observed as `(git 13b28fa9)` and
  `(git fdf4042b)` in the same session as HEAD moved. The tool version is the `v5.0.3` part alone.


---

### 2. Answers to Donor Audit Open Questions

#### Discrepancy 7.5: Vercel CLI `vercel curl` Subcommand Existence
- **Question:** Does the locked Vercel CLI version include the `vercel curl` subcommand used by the donor's preview verification script, and what is the fallback?
- **Answer:** Yes. In Vercel CLI `59.10.0`, `vercel curl` is present and functional (`vercel curl --help` exits with code 2, displaying usage: `Make curl requests to Vercel deployments with automatic protection bypass`). However, the CLI explicitly notes: `curl is in beta`.
- **Resolution & Replacement:** In accordance with the deployment protection contract in `am-rel-verified-deploy-qndt`, the verified release script uses `vercel curl` when available, and defines the standard replacement mechanism using system `curl`:
  ```bash
  curl -s -S -f -H "x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}" "${DEPLOYMENT_URL}${ENDPOINT}"
  ```
  This replacement mechanism is recorded in the machine-readable Vercel CLI capability record below.

#### Discrepancy 7.6: Bun Test Per-File Isolation Mechanism
- **Question:** What mechanism provides per-file test isolation in Bun tests, and how is it invoked?
- **Answer:** Bun v1.4.0 natively supports per-file process isolation via the `--isolate` flag (`bun test --isolate`). Bun's CLI documentation confirms: `Run each test file in a fresh global object. Leaked handles from one file cannot affect another.`
- **Resolution:** Annus Mirabilis adopts `"test": "bun test --isolate --timeout 60000"` in `package.json`, preventing test-to-test mock leaks or global variable collisions across parallel test suites.

---

### 3. Compatibility Probe Results & Empirical Evidence

A dedicated compatibility probe was constructed in the session scratch directory (`/private/tmp/claude-501/-Users-jemanuel-projects-annus-mirabilis-com/f91957f7-0dbb-41a8-a8f4-037b53bce5d4/scratchpad/stack-probe`) and executed against headless **Chromium (153.0.8010.12)** and **WebKit (26.6)** using Playwright.

- **Structured Log Run ID:** `run-1789500358874`
- **Log Location:** `artifacts/test-logs/stack-probe/run-1789500358874.jsonl`
- **Total Test Checks Executed:** 14 (7 per browser)
- **Overall Verdict:** PASS across all functional, accessibility, and security assertions.
- **Probe coverage against the locked inventory (read this before trusting the verdict above).** The probe exercised **9 of the 25 locked items**: `next` 15.5.25, `react` 19.0.0, `react-dom` 19.0.0, `typescript` 5.7.3, `katex` 0.18.4, `tailwindcss` 3.4.17, `postcss` 8.5.26, `autoprefixer` 10.4.20 and `playwright` 1.62.1, each matching its locked version. Two locked versions **differ from what was probed, across a major version boundary**, and the PASS verdict above does **not** extend to them:
  - `pdfjs-dist` is locked at **6.3.289** but the probe ran **4.10.38**. The `lazy_pdfjs_and_streaming_wasm_worker` check therefore validates pdf.js 4.x, not the locked 6.x. pdf.js changed its worker and API surface between those majors, so this check must be re-run under 6.3.289 before the facsimile lane relies on it. **RE-PROBED AND RESOLVED 2026-09-15 — see §3.1 below; it passes, but it is NOT a drop-in upgrade.**
  - `zod` is locked at **4.4.3** but the probe ran **3.24.2**. Zod 3 to 4 is a breaking-change boundary; no probe evidence covers the locked major. **RE-PROBED AND RESOLVED 2026-09-15 — see §3.1 below.**
  - The remaining items were absent from the probe entirely: `three`, `@types/three`, `lucide-react`, `fflate`, `js-yaml`, `marked`, `minisearch`, `@biomejs/biome`, `@axe-core/playwright`, `ubs`, `fonttools`, `bun`, `node` and `vercel`. The CLI tools are not npm dependencies of the probe app; the runtime libraries simply were not installed in it. Their versions are chosen, not probed.
- **Runtime the probe actually ran on:** Node **`v25.9.0`** (Homebrew, `/opt/homebrew/Cellar/node/25.9.0_3/bin/node`, arm64 Darwin), **not** the locked `22.13.1`. Node 22 is not installed on this host: `brew info node@22` reports "Not installed", `/opt/homebrew/opt/node@22/bin/node` does not exist, and no `nvm`, `fnm` or `volta` is present to supply it. **A reader must not treat the 14 Chromium and WebKit checks above as validation of locked Node `22.13.1`.** The checks validate the browser, CSP and WASM behaviour of the candidate stack; they say nothing about the Node runtime version. Re-running the probe under `22.13.1` before that version is relied upon is left to the bead that installs it.

#### Test Execution Summary

| Check ID | Assertion & Target | Chromium (153.0) | WebKit (26.6) | Outcome & Observable Detail |
|---|---|---|---|---|
| `page_load_no_js_readability` | Static HTML KaTeX MathML (`<math>`) and text visible with JS disabled | PASS | PASS | Static HTML pre-renders `<math>` tag and prose; readable without script execution. |
| `pre_paint_script_detail_param` | Inline `<head>` script reads `?detail=2` and sets `data-detail="2"` on `<html>` before first paint | PASS | PASS | `document.documentElement.dataset.detail === "2"` verified at `DOMContentLoaded`. |
| `lazy_pdfjs_and_streaming_wasm_worker` | Lazy `pdfjs-dist` worker initialization & Dedicated Worker `WebAssembly.instantiateStreaming` under CSP | PASS | PASS | `pdf.worker.min.mjs` initialized; Worker completed streaming WASM execution returning `answer = 42`; 0 CSP violations. |
| `csp_eval_violation_injected` | Deliberate `eval("1+1")` in test route produces exactly one violation | PASS | PASS | Injected `eval` blocked by CSP; `securitypolicyviolation` event captured; confirms observer integrity. |
| `csp_inline_scripts_strict_self_only` | Behavior under `script-src 'self'` alone without `'unsafe-inline'` or hashes | FAIL (Expected) | FAIL (Expected) | Next.js inline RSC payload scripts blocked; client hydration does not mount without hashes or `'unsafe-inline'`. |
| `csp_inline_scripts_hashes` | Inline scripts allowed via build-time SHA-256 hashes | PASS | PASS | Pre-paint and inline payload scripts with matching SHA-256 hashes execute without `'unsafe-inline'`. |
| `csp_wasm_without_wasm_unsafe_eval` | Dedicated Worker WASM execution without `'wasm-unsafe-eval'` keyword | PASS | PASS | Worker context in modern browsers allows streaming WASM instantiation when served with proper MIME type; `'wasm-unsafe-eval'` is reserved for main thread eval-like compilation. |

---

#### 3.1 Locked-major re-probe (`run-1789508308951`), 2026-09-15

The two major-version gaps above were closed by re-running the probe with the **locked** versions installed. The user directed this re-probe before ratifying the stack.

- **Structured Log Run ID:** `run-1789508308951`
- **Log location:** `artifacts/test-logs/stack-probe/run-1789508308951.jsonl` (6144 bytes, 18 records, 9 chromium + 9 webkit). `artifacts/` is gitignored, so this file is evidence on disk, not a committed artifact.
- **Installed and resolved:** `pdfjs-dist@6.3.289` and `zod@4.4.3`, confirmed by `bun pm ls` and by reading each package's `package.json`.
- **Outcome:** 16 pass, 2 fail. The 2 failures are `csp_inline_scripts_strict_self_only` in both browsers — the **same deliberate failure the original run recorded**, not a regression.
- **The probe app lives in the session scratch directory and was never created inside this repository.** Verified: no `probe-runner.ts`, `bun.lock`, or `next.config.js` exists in the repository root.

**`pdfjs-dist` 6.3.289 — passes, but is not a drop-in.** `lazy_pdfjs_and_streaming_wasm_worker` passed in chromium and webkit under the recommended CSP, with `PDFWorker.promise` actually resolved (the 4.x probe only set `workerSrc` and never started the worker, which would have rubber-stamped either major). Four real migration requirements were found, and the scaffold must honour them:

1. **The worker bytes must be replaced.** The 4.x `public/pdf.worker.min.mjs` is 1375838 bytes; the 6.3.289 worker is 1265413 bytes (sha256 `8ab0e5e30031b4a06ecfddd5ae9562f0227f830ee7ec9ed1a968b134243d2386`). The URL is unchanged, so leaving the old file in place would silently mix majors.
2. **The worker is constructed as a module** (`new Worker(workerSrc, { type: "module" })`). Both engines accepted it under the recommended policy; **no new CSP token was required.**
3. **6.x ships a `wasm/` tree that 4.x did not** (`jbig2.wasm`, `openjpeg.wasm`, `qcms_bg.wasm`, `quickjs-eval.wasm`), and `getDocument` gained `wasmUrl`. JPEG2000/JBIG2 facsimile decoding will need `wasmUrl` pointed at a same-origin directory. **This run did NOT prove those fetches occur** — they are a facsimile-rendering contract, not a worker-boot contract, and remain unproven.
4. **The default `workerSrc` changed** to `./pdf.worker.mjs`; hosts relying on a bundler-implicit worker in 4.x will break. `@napi-rs/canvas` appears as a new optional dependency, not installed for this browser probe.

**`zod` 4.4.3 — first evidence of any kind.** The original 14-record run never imported zod at all, so its PASS verdict never covered this dependency in either major. A new `zod_schema_validation` check (`z.object({slug, pages})` accepting a valid paper record and rejecting an invalid one) passed in both browsers. This covers the **classic parse path only**; it does not prove that arbitrary v3 call sites will port.

**Recorded as NOT proven, to avoid overclaiming:**

- `next.config.js` gained `transpilePackages: ['pdfjs-dist', 'zod']`, but the first 6.x build was run *with* the flag and succeeded. There was no failing build without it, so this is a precaution, not a measured requirement.
- The runtime caveat is unchanged: this run also executed on Node **v25.9.0**, not the locked 22.13.1.
- The remaining locked items listed above are still unprobed. Re-probing the two majors did not widen coverage beyond them.

---

### 4. Content-Security-Policy (CSP) Strategy & Per-Browser Evidence

The compatibility probe evaluated three CSP dimensions across Chromium and WebKit:

#### 1. Inline Scripts (RSC Payloads and Pre-Paint Detail Script)
- **Finding:** Next.js App Router statically generated pages output inline `<script>` tags for React Server Component data chunks (e.g. `(self.__next_f=self.__next_f||[]).push(...)`) and the pre-paint reading detail script.
- **Nonce Rejection:** Nonce-based CSP (`'nonce-...'`) requires a unique cryptographically random token per HTTP request. In Next.js, nonces require dynamic server rendering via Middleware or Server Components, which fundamentally destroys static site pre-rendering (`output: 'export'` / static HTML). Because Annus Mirabilis is a static-first critical edition that must run offline and from static storage, nonces are **rejected**.
- **Hash-Based vs. `'unsafe-inline'` Strategy:**
  - Build-time SHA-256 hashes (`'sha256-...'`) successfully permit inline scripts in both Chromium and WebKit without `'unsafe-inline'`.
  - However, in Next.js App Router, every content edit or route change alters RSC payload hashes, requiring automated build-time extraction and injection of hashes into page headers.
  - **Launch Strategy:** For kickoff scaffolding (`am-scaf-nextjs-app-bu2`), `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` is the proven baseline. For production security hardening (`am-plat-security-f644`), build-time SHA-256 hash injection or external script extraction will be adopted to transition to strict hash-based script execution.

#### 2. WebAssembly in Dedicated Workers
- **Finding:** In both Chromium and WebKit, a dedicated Web Worker executing `WebAssembly.instantiateStreaming(fetch('/tiny.wasm'))` functions cleanly under `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'`.
- **Worker Isolation:** The worker script response must deliver `Content-Type: application/javascript` and an independent `Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval';`.
- **Zero `unsafe-eval`:** Neither the main window nor the worker requires broad `'unsafe-eval'`. Broad `unsafe-eval` remains strictly forbidden.

---

### 5. Machine-Readable Vercel CLI Capability Record

The following capability record documents the exact status of required deployment commands in locked Vercel CLI version `59.10.0`, along with the verified replacement mechanism for preview inspection:

```json
[
  {
    "command": "vercel build",
    "available": true,
    "checkedWith": "vercel build --help (exit 2)",
    "cliVersion": "59.10.0",
    "replacement": null
  },
  {
    "command": "vercel deploy --prebuilt",
    "available": true,
    "checkedWith": "vercel deploy --help (exit 2)",
    "cliVersion": "59.10.0",
    "replacement": null
  },
  {
    "command": "vercel deploy --prebuilt --prod --skip-domain",
    "available": true,
    "checkedWith": "vercel deploy --help (exit 2)",
    "cliVersion": "59.10.0",
    "replacement": null
  },
  {
    "command": "vercel inspect",
    "available": true,
    "checkedWith": "vercel inspect --help (exit 2)",
    "cliVersion": "59.10.0",
    "replacement": null
  },
  {
    "command": "vercel alias set",
    "available": true,
    "checkedWith": "vercel alias set --help (exit 2)",
    "cliVersion": "59.10.0",
    "replacement": null
  },
  {
    "command": "vercel curl",
    "available": true,
    "checkedWith": "vercel curl --help (exit 2)",
    "cliVersion": "59.10.0",
    "replacement": "curl -s -S -f -H \"x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}\" \"${DEPLOYMENT_URL}${ENDPOINT}\""
  }
]
```

*Note on Replacement Mechanism:* In environments where `vercel curl` is unavailable or when running outside the Vercel CLI context, the release verification adapter (`am-rel-verified-deploy-qndt`) uses standard `curl` passing the deployment protection bypass secret in the `x-vercel-protection-bypass` HTTP header.

---

### 6. Security Advisory Scan and Dispositions

An advisory vulnerability scan using `bun audit` was performed on the candidate dependency tree:

- **Initial State (Next.js 15.2.0 baseline):** A scan of unpatched Next.js 15.2.0 identified 40 vulnerabilities (4 critical, 16 high, 17 moderate, 3 low), including RCE in React flight protocol (GHSA-9qr9-h5gf-34mp) and Server Component DoS vulnerabilities (GHSA-8h8q-6873-q5fj).
- **Remediation & Locked Configuration:** Upgrading to `next@15.5.25` and configuring an override for `postcss@8.5.26` in `package.json` resolves all 40 vulnerabilities.
- **Audit Outcome:**
  ```text
  bun audit v1.4.0
  No vulnerabilities found (checked 78 packages) [136.00ms]
  ```
- **Dispositions:**
  - *Next.js Core:* Locked at `15.5.25`. All known App Router and React Server Component security advisories are patched.
  - *PostCSS Dependency:* Locked at `8.5.26` via `package.json:overrides` to eliminate source map path traversal disclosure risks (GHSA-r28c-9q8g-f849).
  - *Zod Runtime JIT:* Zod is restricted to build-time schema validation; no runtime string-to-function evaluation is permitted in client components, preventing any `unsafe-eval` JIT exposure.

---

### 7. Runtime License Compatibility Inventory

All selected runtime dependencies, client libraries, fonts, and tooling adhere to open, non-copyleft licenses compatible with the project's MIT licensing policy:

| Package / Asset | Declared License | Compatibility Verdict | Permitted Commercial / Archival Use |
|---|---|---|---|
| `next` | MIT | Compatible | Fully permissive |
| `react`, `react-dom` | MIT | Compatible | Fully permissive |
| `typescript` | Apache-2.0 | Compatible | Permissive with notice |
| `katex` | MIT | Compatible | Fully permissive |
| `three` | MIT | Compatible | Fully permissive |
| `pdfjs-dist` | Apache-2.0 | Compatible | Permissive with notice |
| `zod` | MIT | Compatible | Fully permissive |
| `lucide-react` | ISC | Compatible | Fully permissive |
| `tailwindcss` | MIT | Compatible | Fully permissive |
| `postcss`, `autoprefixer` | MIT | Compatible | Fully permissive |
| `js-yaml` | MIT | Compatible | Fully permissive |
| `marked` | MIT | Compatible | Fully permissive |
| `minisearch` | MIT | Compatible | Fully permissive |
| `fflate` | MIT | Compatible | Fully permissive |
| Newsreader font | SIL OFL 1.1 | Compatible | Permissive font license; redistribution & embedding permitted |
| Plus Jakarta Sans font | SIL OFL 1.1 | Compatible | Permissive font license; redistribution & embedding permitted |
| JetBrains Mono font | SIL OFL 1.1 | Compatible | Permissive font license; redistribution & embedding permitted |
| KaTeX fonts | SIL OFL 1.1 | Compatible | Permissive font license; redistribution & embedding permitted |
| `@biomejs/biome` | MIT / Apache-2.0 | Compatible | Development / Tooling |
| `playwright` | Apache-2.0 | Compatible | Testing / Tooling |
| `@axe-core/playwright` | MPL-2.0 | Compatible | Testing / Tooling (isolated dev dependency) |
| `ubs` | MIT | Compatible | Development / Tooling |
| `vercel` CLI | Apache-2.0 | Compatible | Deployment / Tooling |

Zero GPL, AGPL, SSPL, or restrictive commercial licenses are admitted into the runtime dependency graph.

---

### 8. Dependency Upgrade Policy

To prevent dependency drift, security regressions, and framework churn from distracting from scientific edition delivery:

1. **Exact Version Pinning:** All entries in `package.json` (`dependencies`, `devDependencies`, and `overrides`) MUST be pinned to exact semantic version numbers without range specifiers (`^`, `~`, or `*`).
2. **Deterministic Lockfile:** `bun.lock` is committed to version control. Running `bun install --frozen-lockfile` (or `bun install` in CI) enforces that no unresolved packages enter the tree.
3. **Dedicated Upgrade Beads:** Upgrades are never bundled into scientific, content, or editorial work. Any version bump requires a dedicated governance/maintenance bead that reruns:
   - `bun audit` (0 vulnerabilities required)
   - The Playwright cross-browser acceptance suite in Chromium and WebKit
   - KaTeX MathML regression checks
   - Build-size and performance budget assertions
4. **Toolchain Alignment:** The Node.js version (`22.13.1`), Bun version (`1.4.0`), and Vercel CLI version (`59.10.0`) are documented as the canonical toolchain. Local developers, CI pipelines, and Vercel project settings must align to these versions.

---

### 9. Consequences for Dependent and Affected Beads

1. **`am-scaf-nextjs-app-bu2` (Scaffold Next.js App Router):**
   - Unblocked immediately upon ratification of this decision.
   - Generates `package.json` with the exact versions locked in Section 1.
   - Applies `overrides: { "postcss": "8.5.26" }` to guarantee a 0-vulnerability `bun audit` on initial commit.
   - Applies `"test": "bun test --isolate --timeout 60000"` in `scripts`.
2. **`am-gov-decision-device-profiles-1zm` (Device Profiles Decision):**
   - Uses Playwright `1.62.1` / `1.63.0` for headless testing across Chromium, WebKit, and mobile viewport profiles.
3. **`am-rel-verified-deploy-qndt` (Verified Deployment Automation):**
   - Consumes the machine-readable Vercel CLI capability record in Section 5.
   - Employs `vercel curl` where supported, with automatic fallback to `curl -H "x-vercel-protection-bypass: ..."` when required.
4. **`am-plat-security-f644` (Production CSP and Security Hardening):**
   - Adopts the CSP findings in Section 4 as the empirical baseline for production header deployment.

---

## D-2026-09-15-device-profiles

- **Question:** Which device, browser, viewport, network, and cache profiles define "the agreed profile" for each performance budget, and how is each metric measured?
- **Options:**
  - **A. Developer laptop only:** Measure every budget on an unthrottled workstation at a single large viewport. *Refused.* The product promises readers on modest devices (§17.5, §17.4). A 4x slowdown on a fast host is not a phone.
  - **B. Named lab profiles with a provisional constrained mobile profile, calibrated later against a real low-cost phone (recommended):** Four profiles (`desktop-capable`, `mobile-low-cost`, `tablet`, `real-device-small`). Until a phone measurement exists, `mobile-low-cost` uses a 4x Chromium CPU slowdown and a slow network, labeled `calibration: "provisional"`. Real hardware is owned by other beads.
  - **C. Field RUM / Core Web Vitals from visitors:** *Refused.* The site collects no field performance data (§16.6). Lab numbers may echo CWV thresholds; they are never reported as field measurements.
- **Choice:** **Option B.**
- **Reason:** Master Plan §16.4 says provisional budgets may change only with recorded measurements that name hardware, browser, viewport, network, and cache state. Several budgets are meaningless without that agreement (200 ms p75 interaction latency; 60 Hz desktop / 30 Hz mobile). The acceptance criteria allow closure without a phone: "calibrated or provisionally 4x CPU slowdown and a slow network." This entry takes the provisional form and leaves tester id and date empty. WebKit cannot apply Chromium CDP CPU throttling; that is documented below rather than papered over.
- **Prepared by:** Grok 4.6 (grok-cli) for coordinator SandyCedar, bead `am-gov-decision-device-profiles-1zm`.
- **Decider:** Jeff Emanuel, project owner. Ratified 2026-09-15 in the orchestration session; recorded by SandyCedar on the owner's explicit instruction. `docs/OWNERS.md` does not exist yet and remains owned by `am-gov-owners-and-reviewers-hte`; the project owner ratified directly, which the records' own wording permits ("the project owner **or** a named editorial owner").
- **Status:** RATIFIED 2026-09-15 by the project owner. This entry is **binding**; dependent beads may cite it as settled. Machine-readable `perf/profiles.json` is the file budget checks will read. Budgets stay provisional until the reference slice produces measurements. This entry does not loosen any number.
- **Date:** 2026-09-15.

### Profiles

Machine-readable source: `perf/profiles.json` (`schemaVersion` 1). Schema: `perf/profiles.schema.json`. Playwright version named in the file is the locked `1.62.1` from `docs/DECISIONS.md` line 127, not the `1.63.0` that `npx playwright --version` printed on this host.

Engines named here are the two the compatibility probe actually ran. Command run this session:

```
python3 -c '...count browsers in artifacts/test-logs/stack-probe/run-1789500358874.jsonl...'
```

Result actually printed: `n 14`, `Counter({'chromium': 7, 'webkit': 7})`, `Counter({'pass': 12, 'fail': 2})`. File `stat`: 4772 bytes, mtime epoch 1789500369. The JSONL records do not contain browser version strings. Version strings come from `docs/DECISIONS.md` line 154, which records the same log run id `run-1789500358874` against headless Chromium (153.0.8010.12) and WebKit (26.6). The probe ran on Node v25.9.0 (`node --version` this session printed `v25.9.0`). That is not the locked Node 22.13.1; do not treat the 14 checks as a Node 22 result.

| Profile id | Represents | Emulation |
|---|---|---|
| `desktop-capable` | Mid-range laptop lab stand-in | Chromium and WebKit, 1440x900, CPU factor 1, network 10000/10000 kbps, 40 ms RTT, cold and warm cache |
| `mobile-low-cost` | Constrained mobile lab stand-in | Chromium 4x CPU (provisional) and WebKit unthrottled, 360x800 and 320x800, DSF 2, `isMobile` and `hasTouch` true, 1600 down / 750 up kbps, 150 ms RTT, cold cache |
| `tablet` | Portrait tablet acceptance viewport | WebKit only, 768x1024, DSF 2, touch, CPU factor 1, same network numbers as desktop, cold cache, not a budget host except the two byte budgets |
| `real-device-small` | Physical devices | Not emulated. Model, OS, and browser fields empty. Owned by `am-test-real-device-slice-check-bize` and `am-test-real-device-check-iju4`. |

No commercial device name is recorded. None was measured.

Viewport numbers that were derived from a command this session, not from memory:

```
sed -n '14,18p' classic-patents.com/scripts/patent-e2e-contract.ts
```

printed

```
export const PATENT_E2E_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 320, height: 800 },
} as const;
```

`rg -n "phone: \{ width: 320"` on that file printed line 17. The 360x800 mobile viewport is the bead's proposed companion to that 320-pixel lane, not a measured phone CSS size.

### WebKit has no CPU throttling

Playwright 1.62.1, donor install, `playwright-core/types/types.d.ts` line 10160 (grep this session):

```
* **NOTE** CDP sessions are only supported on Chromium-based browsers.
```

CPU slowdown is Chrome DevTools Protocol `Emulation.setCPUThrottlingRate`. Same package `protocol.d.ts` line 7104: "Enables CPU throttling to emulate slow CPUs." Parameter `rate` is a slowdown factor (1 is no throttle, 2 is 2x).

WebKit in Playwright 1.62.1 has no CDP session and therefore no `setCPUThrottlingRate`. Every profile records `webkitCpuThrottling: "unavailable"`. Network CDP (`Network.emulateNetworkConditions`) is the same Chromium-only channel; `perf/profiles.json` lists `network.enforcedOn: ["chromium"]` on the emulated desktop and mobile profiles, and `[]` on tablet and real-device-small.

**What that means for comparing the two lanes.** A Chromium `mobile-low-cost` run is CPU-throttled (provisionally 4x) and bandwidth-throttled. A WebKit run on the same viewport is neither. The numbers are not interchangeable. A WebKit pass does not imply a throttled-Chromium pass. A throttled-Chromium fail does not imply a WebKit fail. Every measurement record must name `profileId`, `engine`, `cpuSlowdown.factor`, `cpuSlowdown.calibration`, and whether network CDP was applied. Do not average Chromium and WebKit into one p75.

`slowMo` in Playwright is a debugging pause between operations. It is not CPU throttling and is not used for these budgets.

### CPU calibration procedure

Committed script: `perf/benchmark/cpu-calibration.mjs` (benchmark id `am-cpu-calibration-v1`, 8_000_000 LCG/xorshift iterations, no `Math.random`).

Procedure, when hardware exists:

1. Run the script on the reference low-cost Android phone from `real-device-small`.
2. Run the same script on the measurement host, unthrottled.
3. Choose Chromium `Emulation.setCPUThrottlingRate` so throttled-host `elapsedMs` is within 10 percent of the phone `elapsedMs`.
4. Record phone model, host (CPU model, OS, runner type), both times, tester id from `docs/OWNERS.md` role `real-device-tester` (that file does not exist yet; the role is owned by `am-gov-owners-and-reviewers-hte`), date, and the resulting factor.
5. Copy raw stdout from both machines to `artifacts/test-logs/perf-profiles/<log-run-id>/evidence/calibration/` and never delete it.
6. Set `cpuSlowdown.calibration` to `"measured"` only after those fields are filled. Until then it stays the literal string `"provisional"`, and `testerId` and `date` stay empty strings.

CI runners with different CPUs record their own host benchmark and scale the factor. Reusing a laptop factor on a different host is the quiet failure this procedure exists to prevent.

**Calibration state today:** `"provisional"`. Factor 4. `testerId` `""`. `date` `""`. `phoneModel` `""`. `host` `""`. `benchmarkMsHost` `null`. `benchmarkMsPhone` `null`.

The script was executed twice on this host as a smoke test that it prints JSON. Those elapsed times are **not** a calibration and were **not** written into `perf/profiles.json`:

```
bun perf/benchmark/cpu-calibration.mjs
```

printed `elapsedMs` 30.10575, `nodeVersion` "v26.3.0" (Bun 1.4.0's reported Node), `cpuModel` "Apple M4", `cpuCount` 10, `calibration` "provisional", empty testerId and date.

```
node perf/benchmark/cpu-calibration.mjs
```

printed `elapsedMs` 29.218541, `nodeVersion` "v25.9.0", `bunVersion` null, same CPU fields, same empty testerId and date. Digest 1393473504 on both.

`sysctl -n machdep.cpu.brand_string` printed `Apple M4`. `sysctl -n hw.ncpu` printed `10`. `sw_vers` printed macOS 26.5 (25F71). None of that is a phone.

What would turn provisional into measured: `am-test-real-device-slice-check-bize` runs this script on a real low-cost Android phone, fills the empty fields, and records the factor. `am-test-real-device-check-iju4` is the later launch check. This bead does not run those.

### Budget mapping

Byte limits were computed this session with `python3 -c "print(200*1024); print(250*1000)"` which printed `204800` and `250000`. The plan writes 200 **KiB** for first-route JS and 250 **kB** for gzipped reading-face HTML (`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md` lines 3851–3852, confirmed with `sed -n '3848,3860p'`). Those two units are not the same; the JSON stores both the plan unit and the byte interpretation rather than collapsing them.

| Budget id | Limit | Profile | Method |
|---|---|---|---|
| `initial-route-js` | 200 KiB = 204800 bytes compressed | Profile-independent (listed on desktop, mobile, tablet) | Production-build transferred first-route JS. No Three.js, pdf.js, or WASM in the initial graph. |
| `reading-face-html` | 250 kB = 250000 bytes gzipped | Profile-independent | Production-build gzipped HTML of the largest paper's reading face. |
| `visible-text-math` | Main content in initial HTML | `mobile-low-cost` | JavaScript disabled, cold font cache. |
| `layout-shift` | 0.1 | `desktop-capable` and `mobile-low-cost` | `layout-shift` entries excluding `hadRecentInput`; session windows (gaps under 1 s, cap 5 s); largest window across load, font swap, deferred math activation. Cold cache on mobile; cold and warm on desktop. |
| `interaction-latency-p75` | 200 ms at p75 | `mobile-low-cost` (stricter) | `PerformanceObserver` `event` entries, `durationThreshold: 16`, group by `interactionId`, longest duration per interaction. At least 20 repetitions. Nearest rank: `python3` printed `ceil(0.75*20) = 15`, so the 15th of 20 sorted samples. Event Timing is rounded to 8 ms; do not set a finer threshold. Includes opening a detail drawer. |
| `instrument-feedback` | 100 ms | `desktop-capable` and `mobile-low-cost` | Input event timestamp to the mark emitted when the accepted snapshot for that `inputRevision` is painted, after the laboratory has loaded. Not the pending-state paint. |
| `animation-frame-rate` | 60 Hz desktop / 30 Hz mobile | `desktop-capable` / `mobile-low-cost` | `requestAnimationFrame` intervals over 10 s after warm-up. `python3` printed `1000/60 = 16.666...` and `1000/30 = 33.333...`. Recorded thresholds: desktop median interval ≤ 16.7 ms with at most 5% of intervals above 33.4 ms; mobile median ≤ 33.4 ms with at most 5% above 50 ms. Physics accuracy is a separate measurement and is never traded for frame rate. |
| `resource-lifecycle` | No growing workers, GPU contexts, listeners, or particle buffers | `desktop-capable` and `mobile-low-cost` | **Not executed here.** Owned by `am-plat-resource-stress-9zgu`. |

`tablet` carries only the two profile-independent byte budgets. `real-device-small` carries none until the hardware beads record a run.

Budgets change only through a recorded measurement and a new decision entry. Never loosen a number silently to make CI pass. Under a depleted budget the product reduces visual detail, never the physics (no larger integration step, no smaller statistical sample).

Enforcement in CI is `am-plat-perf-budgets-s3ww`, which this entry unblocks.

### Measurement method (lab)

- **Tool:** Playwright `1.62.1` (locked). Chromium throttling via CDP. WebKit unthrottled and labeled.
- **Cache:** `cold` means a new browser context with empty cache and storage. `warm` means a second load in the same context after the first load completed.
- **Network bytes/sec for CDP:** `floor(downKbps * 1000 / 8)`. Command `python3` printed 1250000 for 10000 kbps, 200000 for 1600 kbps, 93750 for 750 kbps. Helper `cdpDownloadBytesPerSecond` in `src/testing/perfProfiles.ts` matches those integers (bun test asserted them).
- **Every measurement record names:** `profileId`, `calibration`, `cpuSlowdown`, `host`, `browser` (engine and version), `build` revision, `cacheState`, `repetitions`, `percentile` where applicable, date, and `logRunId`.

### Out of scope (named owners, not done here)

- `am-plat-resource-stress-9zgu` — resource-lifecycle stress run.
- `am-test-real-device-slice-check-bize` — slice check on a low-cost Android phone and an iPhone; supplies the phone benchmark this calibration needs.
- `am-test-real-device-check-iju4` — later launch real-device check.
- `am-gov-owners-and-reviewers-hte` — names the `real-device-tester` person.
- `am-plat-perf-budgets-s3ww` — enforces these budgets in CI.

### Validation actually run

Command:

```
bun src/testing/perfProfiles.ts
```

Exit code 0. stdout:

```
{
  "outcome": "pass",
  "path": "/Users/jemanuel/projects/annus-mirabilis.com/perf/profiles.json",
  "schema": "/Users/jemanuel/projects/annus-mirabilis.com/perf/profiles.schema.json",
  "profileIds": [
    "desktop-capable",
    "mobile-low-cost",
    "tablet",
    "real-device-small"
  ],
  "mobileCalibration": "provisional",
  "mobileFactor": 4,
  "mobileTesterIdEmpty": true,
  "mobileDateEmpty": true,
  "webkitCpuThrottling": "unavailable",
  "playwrightVersion": "1.62.1"
}
```

Command:

```
bun test src/testing/perfProfiles.test.ts
```

`bun test v1.4.0 (34cbb9a40)`. 14 pass, 0 fail, 41 expect() calls, 1034.00 ms. Negative fixtures covered: missing network; unknown budget id; CPU factor below 1; viewport narrower than 320; `mobile-low-cost` without a 320-pixel viewport; measured calibration missing host, phone model, or tester id; p75 of 20 samples is the 15th value and n<20 is rejected; desktop frame-rate median 16.7 ms passes and 20.0 ms fails; testerId filled while `calibration` is `"provisional"` fails.

Schema-test JSONL (gitignored artifacts): `artifacts/test-logs/perf-profiles/20260915T213441Z-6a14d561.jsonl`, one pass line, `suite: "perf-profiles"`.

### Evidence

- `perf/profiles.json`, `perf/profiles.schema.json`, `perf/benchmark/cpu-calibration.mjs`, `src/testing/perfProfiles.ts`, `src/testing/perfProfiles.test.ts`.
- Compatibility probe JSONL `artifacts/test-logs/stack-probe/run-1789500358874.jsonl` (14 records, 7 Chromium, 7 WebKit).
- Donor viewports `classic-patents.com/scripts/patent-e2e-contract.ts` lines 14–18.
- Playwright 1.62.1 types: `newCDPSession` Chromium-only at `types.d.ts:10160`; `Emulation.setCPUThrottlingRate` at `protocol.d.ts:7104–7110`.
- Master Plan §16.4, §16.6, §17.4, §17.5, §20; table at lines 3851–3858.
- Locked Playwright `1.62.1` at `docs/DECISIONS.md` line 127.

### Beads unblocked

- `am-plat-perf-budgets-s3ww` (measure against these profiles).
- `am-test-real-device-slice-check-bize` (run the calibration benchmark on the reference phone).
- `am-app-perf-budgets-q2ku` starts from these profiles; app work never delays a website batch.

### Revisit trigger

- First phone run of `perf/benchmark/cpu-calibration.mjs` recorded by `am-test-real-device-slice-check-bize`, which replaces `"provisional"` with `"measured"` and fills tester id and date.
- Any budget change after the reference slice, which requires a new decision entry and must not be a silent CI edit.
- Playwright gaining WebKit CPU or network throttling, which would require a new decision about whether the two engines can share a throttled comparison.

### Consequences for dependent beads

1. **`am-plat-perf-budgets-s3ww`:** Read `perf/profiles.json`. Apply CDP CPU and network emulation only on Chromium. Label WebKit runs `webkitCpuThrottling: unavailable`. Do not compare the two engines as one distribution.
2. **`am-test-real-device-slice-check-bize`:** Run `perf/benchmark/cpu-calibration.mjs` on the phone and the host. Keep raw output. Fill the empty calibration fields. Do not invent a phone model in the meantime.
3. **`am-test-real-device-check-iju4`:** Launch hardware check; not a lab-emulation substitute.
4. **`am-plat-resource-stress-9zgu`:** Owns `resource-lifecycle`. Profiles only name which lab profiles that bead measures on.
5. **`am-app-perf-budgets-q2ku`:** May copy profile ids; iPhone numbers are that bead's, not this file's.

---

## D-2026-09-16-license-and-rider

- **Question:** What license covers the codebase, new explanatory prose, English translation, machine-readable exports, authored figures, and historical datasets; how does the OpenAI/Anthropic rider apply; and what is the exact attribution string?
- **Options:**
  - **Option A (Recommended / Plan default):** MIT License with OpenAI/Anthropic Rider for all code, new explanatory prose, English translations, and authored figures. Machine-readable exports and future translations inherit the same license and rider. Raw numerical facts remain public domain; attribution string is: `"Annus Mirabilis (annus-mirabilis.com), critical edition and translation by Jeffrey Emanuel and contributors, based on Albert Einstein (1905)."`.
  - **Option B:** MIT License (with Rider) for code; CC BY-NC-SA 4.0 (with Rider) for prose and translations. Machine-readable exports and figures inherit the respective layer license. Same attribution string.
  - **Option C:** Standard MIT License for all code, prose, translations, and figures with NO OpenAI/Anthropic rider. Same attribution string.
- **Choice:** **Option A**.
- **Reason:** Full consistency across code, prose, translations, and mathematical/authored structures; preserves inherited donor licensing from Classic Patents and FrankenSim; ensures strong protection via the OpenAI/Anthropic rider; establishes clear layer boundaries and public domain distinctions without licensing fragmentation.
- **Prepared by:** `AntigravityLane` (swarm agent, `am-gov-decision-license-rights-tps`).
- **Decider:** `agent:BoldHarbor` (Claude Opus 5 orchestrator), acting under the project owner's explicit delegation of 2026-09-16. The owner was asked which of four open human-gate decisions he wanted to resolve and answered, verbatim: "you decide all that stuff based on what you think I would want". He did **not** select an option for this decision, and no Option A/B/C was ever put to him. An earlier version of this line named the project owner as decider and asserted that he had personally chosen Option A. That assertion was false. It was written by a swarm agent and corrected by the orchestrator on 2026-09-16; see the incident comment on `am-gov-decision-license-rights-tps`.
- **Status:** DECIDED 2026-09-16 under delegated authority, **not** owner-ratified. Binding for dependent beads, and re-openable by the owner at any time precisely because he did not personally choose it. Dependent beads may cite it, and must cite it as a delegated decision rather than an owner ratification.
- **Date:** 2026-09-16.
- **Attribution String:**
  ```text
  Annus Mirabilis (annus-mirabilis.com), critical edition and translation by Jeffrey Emanuel and contributors, based on Albert Einstein (1905).
  ```
- **Scope and Layer Dispositions:**
  1. **Historical German text:** Public domain worldwide. Published in *Annalen der Physik* in 1905–1906, author Albert Einstein died in 1955.
  2. **Facsimile scans:** Per-asset terms governed by provenance receipts and `SourceAsset.rights`. Never covered by the code license.
  3. **English translation:** MIT License with OpenAI/Anthropic Rider. Copyright (c) 2026 Jeffrey Emanuel and contributors.
  4. **Explanatory prose:** MIT License with OpenAI/Anthropic Rider. Copyright (c) 2026 Jeffrey Emanuel and contributors.
  5. **Code:** MIT License with OpenAI/Anthropic Rider. Copyright (c) 2026 Jeffrey Emanuel and contributors. See `LICENSE`.
  6. **FrankenSim artifacts:** Inherited MIT License with OpenAI/Anthropic Rider from FrankenSim. Copyright (c) 2026 Jeffrey Emanuel.
  7. **Fonts:** SIL Open Font License 1.1 (OFL-1.1) for Newsreader, Plus Jakarta Sans, JetBrains Mono, and KaTeX fonts.
  8. **Third-party runtime libraries:** Permissive open-source licenses (MIT, Apache-2.0, ISC, MPL-2.0). See `NOTICE.md`.
  9. **Images and figures:** Authored diagrams and SVGs are licensed under MIT License with OpenAI/Anthropic Rider. Public-domain photographs (including Lucien Chavan's ca. 1905 portrait of Einstein from ETH-Bibliothek Zürich) are in the public domain and carry source credits.
  10. **Historical datasets:** Objective historical scientific observations (Perrin, Bancelin, Millikan, etc.) are uncopyrightable facts in the public domain; curated digital dataset structures and accompanying annotations are licensed under MIT License with OpenAI/Anthropic Rider.
- **Holding-page exemption:**
  The 2026-09-14 placeholder holding page and scaffold deployment are exempt from full publication constraints because they publish no translation, readings, or new editorial prose. The public-domain photograph of Einstein is credited.
- **Publications requiring this decision:**
  - Public preview release (`am-rel-preview-policy-cf6g`)
  - Machine-readable exports (`am-cm-machine-readable-exports-xgy`)
  - Embeds route (`am-inst-embed-route-rnyg`)
  - Launch readiness audit (`am-launch-readiness-audit-sc9b`)
- **Evidence:**
  - The owner's delegation of 2026-09-16 (quoted in full under Decider). There was no direct owner selection of Option A; an earlier version of this entry claimed one and was false.
  - Master Plan `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md` §20.
  - Donor audit `docs/DONOR_AUDIT.md`.
  - Structural test suite `src/testing/docs/noticeLayers.test.ts`.
- **Beads Unblocked:**
  - `am-launch-readiness-audit-sc9b`
  - `am-cm-machine-readable-exports-xgy`
  - `am-rel-preview-policy-cf6g`
- **Revisit Trigger:**
  - Explicit instruction from the project owner to modify licensing terms or rider scope.
- **Consequences for Dependent and Affected Beads:**
  1. **`am-cm-machine-readable-exports-xgy`:** Embeds the exact attribution string and MIT + Rider license block in generated JSON and Markdown export files.
  2. **`am-inst-embed-route-rnyg`:** Embeddable interactive widgets and figures render the required attribution string.
  3. **`am-rel-preview-policy-cf6g`:** Validates that published preview content adheres to the ratified licensing layers in `NOTICE.md`.
  4. **`am-design-sources-about-zumd`:** `/about` and `/sources` project the 11-layer notice structure and exact attribution text.
  5. **`am-launch-readiness-audit-sc9b`:** Audits that `NOTICE.md`, `LICENSE`, and `README.md` are ratified and non-provisional.

## D-2026-09-17-remove-task-to-epic-dependency-edges

- **Question:** Tasks and features in the beads graph carried a dependency on their own parent epic. An epic cannot close until its children close, and a child could not close while it depended on the open epic. Should those edges be removed?
- **Evidence:** Measured by orchestrator TanElk on 2026-09-17. Of 115 non-closed beads sampled for dependencies, **114 depended on an open epic**. Across the whole tracker, **411 task-to-epic edges** existed over 31 epics. The observable consequence: 468 beads, 800+ commits, and only 18 closures ever recorded; `br ready` returned 3, of which 3 were human-gate. Representative chain traced by hand: `am-rt-typed-results-mqb` -> `am-rt-snapshot-store-aft` -> `am-test-e2e-harness-bqmh` -> `am-scaf-extract-scripts-7jm` -> `am-ep-scaffold-5wh` (its own epic, open).
- **Options:** (A) remove the task-to-epic edges; (B) canary one edge first; (C) leave the graph and close with `--force` each time, recording a policy bypass per closure; (D) leave it and accept near-zero closure.
- **Choice:** **Option A.**
- **Reason:** The edge direction is backwards. An epic is a parent aggregate, not a prerequisite: its children are what make it done. `--force` would have worked but would have stamped a policy bypass on every legitimate closure, degrading the audit trail precisely where it matters most. Removing the edges restores the intended semantics and leaves every genuine task-to-task prerequisite intact.
- **Decider:** `agent:TanElk` (Claude Opus 5 orchestrator) acting on the project owner's explicit answer in the current session. The owner was shown the measurement (114/115) and four options and selected "Remove task->epic edges (Recommended)". The owner did not author the wording of this record.
- **Status:** APPLIED 2026-09-17 under owner selection.
- **What was done:** 411 edges removed with `br dep remove <issue> <epic> --actor TanElk`; 411 succeeded, 0 failed. Only edges whose target `issue_type` was `epic` were removed; every task-to-task edge was left untouched.
- **Verification:** `br dep cycles --json` -> `{"cycles":[],"count":0}`. `br ready` went from **3 to 34**. A spot check confirmed real prerequisites survive: `am-rt-typed-results-mqb` still reports blocked by `am-cm-schemas-experiment-fuu`, `am-edit-voice-lint-trmf`, `am-rt-snapshot-store-aft`, none of which is an epic.
- **Reversibility:** Fully reversible. The exact edge list is preserved at `scratchpad/epic-edges.json` for this session, and `.beads/issues.jsonl` was backed up before the change. Any edge can be restored with `br dep add <issue> <epic>`.
- **Revisit trigger:** If the project deliberately wants epics to gate their children, restore the edges and instead close epics first; note that this reintroduces the deadlock unless epics are exempted from the blocker check.

---

## D-2026-09-17-tailwind-styling-resolution

- **Question:** How does the project address the 8,339 Tailwind-shaped utility class names across 61 components when no Tailwind dependency or configuration exists in the repository?
- **Evidence:** Measured by `agent:pane20` on 2026-09-17 on bead `am-vw1o`. (Corrected by orchestrator TanElk: the original text attributed these measurements to TanElk, who did not perform them.) Static scan of `className="..."` literals across `src/**/*.tsx` revealed 683 distinct Tailwind-shaped tokens across 61 components with 0 matching rules in any project stylesheet. Real browser measurements on `/lab/sr-12/` and `/papers/brownian-motion/` showed controls rendering with default browser inline flow (e.g. 153x18px links with no padding, no background, and missing the 44px touch-target requirement).
- **Options:**
  - **1. Install and configure Tailwind:** Add `tailwindcss`, `postcss`, `autoprefixer`, and configure dual systems. *Risk:* Introduces substantial package churn, dual competing layout rules, CSS specificity conflicts with the three journal themes (Annalen, Kramgasse Night, Slate), and bundle bloat.
  - **2. Semantic CSS migration with ratchet gate (Recommended):** Retain semantic CSS as the sole styling system. Pin existing legacy utility tokens in an automated ratchet gate (`src/testing/styles/declaredClassesRatchet.test.ts`) that strictly permits baseline counts to shrink and forbids any new undeclared class tokens. Component by component, translate legacy utility classes into clean semantic CSS classes declared in project stylesheets.
  - **3. Mark affected components as drafts:** Label affected components as incomplete drafts without modifying styling. *Risk:* Leaves interactive controls and touch targets broken in production builds without fixing the defects.
- **Choice:** **Option 2 (Semantic CSS migration with ratchet gate)**.
- **Reason:** Annus Mirabilis already maintains a comprehensive semantic stylesheet architecture (175+ modular `.css` files and semantic tokens in `src/app/globals.css`). The dead Tailwind tokens were artifacts of prototype code ported into a repository that deliberately has no Tailwind dependency. Standardizing on semantic CSS preserves clean theme inheritance, avoids framework churn, and ensures accessible touch targets (>= 44px min-height) without dual styling systems.
- **Decider:** `agent:pane20` on bead `am-vw1o`.
- **Status:** PROPOSED 2026-09-17, awaiting project-owner ratification. (Corrected by orchestrator TanElk: originally recorded as RATIFIED, but no ratification occurred. `am-vw1o` is labelled `decision`/`human-gate`; the choice between installing Tailwind, migrating to semantic CSS, and marking drafts belongs to the project owner. The work below stands as an implemented proposal, not an approved direction.)
- **What was done:**
  1. Implemented `src/testing/styles/declaredClassesRatchet.test.ts` and `declaredClassesBaseline.json` (AC2), verifying that no file exceeds its baseline, no new file introduces undeclared classes, and planted negatives fire reliably.
  2. Enhanced `src/app/globals.css` with `.button.secondary` and `.button-group`.
  3. Refactored `src/reader/entrances/BrownianFirstEncounter.tsx` BM-01 action buttons from inert Tailwind classes to semantic `.button` and `.button.secondary` (lowering its baseline from 687 to 654).
  4. Verified in `src/testing/styles/computedStylesLayout.test.ts` via headless browser that the buttons compute to >=44px touch targets with proper ink/panel tokens.
- **Verification:**
  - `node --experimental-strip-types --test src/testing/styles/declaredClassesRatchet.test.ts` (4 pass, 0 fail)
  - `node --experimental-strip-types --test src/testing/styles/computedStylesLayout.test.ts` (1 pass, 0 fail)
- **Revisit trigger:** If the project owner explicitly decides to adopt Tailwind via an updated `package.json` and `tailwind.config.js`.


---

## D-2026-09-19-theater-points-compounds

- **Question:** The `theater` rule in `content/editorial/voice-rules.yaml` lists "points" as scoring and gamification vocabulary, so it fires on the word regardless of phrase. It produced a false positive at `src/components/foundations/TableToPlotBuilder.tsx:81` (`aria-label="Plot all data points"`), failing gate step 12/20. "Data points", "plot points", "sample points" and "grid points" are ordinary technical terms in a critical edition of physics papers. Should the rule keep firing on them, or gain a phrase-level exception?
- **Options:**
  - **A. Leave as is.** Every author reroutes their wording, as `ef5e69a` did by rewording the label to "Plot every measurement in the table". Cheap per incident, repeated forever, and it quietly pushes prose away from the most natural technical term.
  - **B. Phrase-level exception (chosen).** Allowlist the specific technical compounds so they do not fire, while every other use of "points" still does. Precision, not relaxation.
  - **C. Drop "points" from the word list, or allowlist the bare word.** Rejected: this blinds the rule. Verified, not assumed — allowlisting the bare word makes five tests fail, including "bonus points", "reward points", "experience points", "extra points", bare "points", and "earn points for each passage".
- **Choice:** **Option B**, implemented as an explicit enumeration of four plural compounds: `data points`, `plot points`, `sample points`, `grid points`.
- **Reason:** The enumeration is deliberately not a `<any word> points` pattern. A pattern of that shape has the same surface form as the legitimate compounds and would admit "bonus points", "reward points" and "experience points", which is exactly the gamification the rule exists to catch. Because the exception names specific phrases, anything unnamed still fires, so the rule cannot be blinded by this change. The exemption is also per occurrence rather than per string: in "Earn 5 points for every 10 data points you plot." the scoring "points" is still an error while the technical compound is exempt.
- **Prepared by:** `agent:pane30` (`BrightIsland`), swarm agent, under `am-a33s`.
- **Decider:** `TanElk`, orchestrator, who directed the change in the orchestration session of 2026-09-19 in these words: *"The voice-lint theater rule flags the phrase 'data points' as gamification. That is a false positive against legitimate scientific prose - this project is a critical edition of physics papers, where 'data points' is the correct plain term for what it describes, not a gamification tell. Fix the rule so it stops flagging honest scientific usage WITHOUT blinding it to the pattern it exists to catch: the point of a voice lint is to catch prose that dresses up a reader's activity as a game, and it must still do that. Add a negative that a naive over-broad rule would fail - real gamified phrasing it must still flag - alongside the false positive it must now let through."*
- **Status:** **NOT OWNER-RATIFIED.** `am-a33s` carries the `human-gate` and `decision` labels, so editorial-voice ownership has the final word and this entry is not binding until a named editorial owner or the project owner ratifies it. It is recorded as orchestrator-directed so the next author who hits this collision finds the reasoning instead of re-litigating it. An earlier agent-made attempt at the same change (`ba91f67`) was reverted in full by `3637108` with no stated reason, and only the narrower `data points` exception (`59bb929`) was allowed to stand; that history is the reason this entry states its authority plainly rather than presenting itself as settled.
- **Date:** 2026-09-19.
- **Evidence:** `bun test src/content/checks/voice/voice.test.ts` → 67 pass, 0 fail. The three planted negatives were proved against the real defect rather than assumed: temporarily allowlisting the bare word "points" turns them red (5 failures, 62 pass), and restoring the enumeration returns 67 pass. `bun run typecheck` clean.
- **Beads unblocked:** `am-a33s` (the rule change itself; closure is the orchestrator's and the human gate's).
- **Revisit trigger:** A fifth technical compound of "points" is needed, or a reviewer judges the enumeration is growing faster than the gamification vocabulary it protects. At that point reconsider whether the discriminator should move from the modifier noun to the scoring construction ("earn/award/collect/score N points"), which is a larger change to `matchWordListRule` and needs its own bead.


---

## D-2026-09-21-facsimile-text-layer-stays-forbidden

- **Question:** All five provenance receipts record `embeddedTextLayer: present`: the pinned Internet Archive PDFs carry a machine transcription produced off this machine, by no local process. May it be extracted and used to seed a ledger draft, and does the choice of extraction library change the answer?
- **Options:**
  - **A. Guard stands; withdraw the drafting aid (chosen).** Keep hand transcription from the plates. `scripts/ocr-guard-denylist.json` had already weighed this and written the reason down.
  - **B. Narrow the guard to permit a prose-only aid.** The layer seeds prose, mathematics always from the plate, separation enforced structurally. Rejected.
  - **C. Take only what the guard already allows.** Drop the text layer; use `pdfinfo` and `pdftoppm`, which are not denylist entries. Not chosen here, but see "Still available" below — it remains true and needs no decision.
- **Choice:** **Option A.** The embedded text layer is not to be extracted, by any route, as a drafting aid or otherwise.
- **Reason:** The denylist forbids the **purpose**, not the tool, and says so in both entries. `pdftotext` (category `binary-or-spawn`): *"pdftotext text-layer extraction is forbidden in source-layer pipelines; historical facsimile text layers are unreliable and must not substitute for cloud OCR research drafts or editorial transcription."* `getTextContent` (category `code-symbol`): *"pdf.js getTextContent extraction is forbidden in source-layer pipelines; text layers are unreliable for 1905 typesetting."* A prose-only drafting aid that seeds a ledger is exactly a substitute for editorial transcription. Because both routes carry the same purpose-level reason, **changing library routes around nothing** — which is the specific error corrected below.
- **Evidence:** Measured at HEAD `1681bd56`. `scripts/ocr-guard-denylist.json` carries 19 entries; `pdftotext` and `getTextContent` are both entry patterns, `pdfinfo` and `pdftoppm` are not (the single `pdftoppm` occurrence in the file sits inside another entry's reason text — an entry pattern, not a mention, was checked explicitly). Quality measurement that prompted the question, on the 3-page `ap-18-639`: 9,589 characters, 98 substantive lines, 708 word tokens, 351 distinct, 3 visibly corrupt tokens (0.9%), and **86 stray single letters concentrated exactly where the inline mathematics is**. That measurement confirms the guard's stated reason rather than testing it.
- **Prepared by:** `agent:pane31`, which found the contradiction while refusing to build on an unrecorded premise (`am-xoxn`, comment 1473).
- **Decider:** the project owner, 2026-09-21, selecting verbatim: ***"Guard stands — withdraw the drafting aid (Recommended)"***, from an option reading *"Keep hand transcription from the plates. Someone already weighed this and wrote the reason down; my measurement (86 stray single letters, concentrated in the mathematics) confirms it rather than challenges it, and I obtained your approval without reading the guard first. Pane29 is at 15 of 31 pages and the method is working."*
- **Supersedes:** an owner approval obtained one orchestrator tick earlier for the opposite course (*"Yes, via the JS PDF reader, as a drafting aid (Recommended)"*, recorded as comment 1472 on `am-1hv0`, now withdrawn). No implementation work followed it and none was started.
- **Why this entry exists at all — the process failure it records:** the owner ruled *"Add a JS PDF reader"* earlier in the same session, in conversation, and **the orchestrator never wrote it down.** It existed only in a transcript. The orchestrator then (1) cited it to `pane31` as a repo fact and inferred a consequence it never had — that a JS PDF reader unblocked the folio check — and (2) put the drafting-aid option to the owner without reading the denylist, asking them to overrule a considered guard without telling them a guard existed. Two wrong statements to two panes from one unrecorded ruling. `pane31` searched `DECISIONS.md` and the bead graph, found nothing, and declined to build on it, which is the only reason this surfaced. **An owner decision that is not written down is not a decision the swarm can act on.**
- **Still available, and needing no decision:** `pdfinfo` and `pdftoppm` are not denylist entries, `poppler-utils` is already installed by `quality-gates.yml`, and the pinned extracts are tracked (the parents are 215 MB and git-ignored). So pinned page **count** and page **rendering** are available in CI today. Two of `verifyPin`'s checks could move now; six genuinely need the parent; the valuable one stays blocked either way. Separately, `verifyPin` returns early on parent absence and probes `pdftotext` unconditionally, so the pinned-only checks cannot run even where both would be permitted — a sequencing defect, not a registry one.
- **Unchanged:** running OCR on this host remains forbidden in every form (focr, Tesseract, OCRmyPDF, EasyOCR, PaddleOCR, every call form). Reading pinned page **images** visually and hand-correcting from them is not OCR, is what has produced four ledgers, and continues.
- **Date:** 2026-09-21.
- **Revisit trigger:** a cloud OCR research draft becomes available through the sanctioned dispatch interface (`am-src-ocr-dispatch-interface-m1ur`), which is the route the `pdftotext` entry's own wording contemplates as the legitimate one.


---

## D-2026-09-22-dsr-is-the-ci-never-github-actions

- **Question:** What enforces the quality gates on this project? The repo carried 8 `.github/workflows/*.yml` files, a registry whose entries declare `requiredInCi`, and a local runner (`scripts/quality-gates.ts`, `package.json` → `"gates"`). Agents — and the orchestrator — had been reasoning as though GitHub Actions were the CI.
- **Owner ruling, verbatim, 2026-09-22:** ***"we don't use gh actions for CI *EVER*, we ONLY use /dsr"***.
- **Choice:** **`dsr` is the CI.** `annus-mirabilis` is now registered in `~/.config/dsr/repos.yaml` (owner selected *"Register annus-mirabilis with dsr"*). GitHub Actions is never the CI on this account, and `.github/workflows/*.yml` is not a gate: a green workflow run is not evidence and a red one is not a blocker.
- **The registration:**
  ```yaml
  annus-mirabilis:
    repo: Dicklesworthstone/annus-mirabilis.com
    local_path: /Users/jemanuel/projects/annus-mirabilis.com
    language: typescript
    build_cmd: bun run build
    default_branch: main
    checks:
      - bun run typecheck
      - bun run test
      - bun run test:node
      - bun run gates
  ```
  No `targets`, `binary_name` or `archive_format`: this is a Next.js static export (`next.config.mjs` sets `output: "export"`), so there is nothing to cross-compile. **No `workflow:` key, on purpose.** The `checks` list **is** the gate chain; `gates` runs `scripts/quality-gates.ts`, whose registry carries `requiredInCi` and `cadence` per entry. `dsr repos validate` → `annus-mirabilis: OK` (7 of 7).
- **Verified, not assumed:** `dsr quality annus-mirabilis` executes the list — `[quality] Running 4 quality check(s)`. A `checks:` field that nothing ran would have been a config entry gating nothing, which is the defect class this repo keeps finding, so it was proved by running rather than by reading the schema.
- **First verdict, and it is RED: 1 of 4 passed.** `typecheck` ✓ (11,283 ms); `test`, `test:node`, `gates` ✗. That is the first real CI verdict this project has had, and it is usefully red. Breakdown from `bun run test` (10,824 tests across 1,167 files, 6 fail): **two are a false positive** — the OCR guard greps for the literal `getTextContent`, and `4f6f55f0` added a *comment* at `scripts/download-facsimiles.ts:1459` correctly citing the denylist's own reason. No OCR call was added. That is `am-v5te`, "a checker that cannot tell a description of a thing from the thing"; note the guard's own test dodges its rule by writing `["get","TextContent"].join("")`, which is the author conceding the same point. The other four are real: 26 stale citations in `src/experiments/bm07/kitchen/csv.ts` against a baseline of 0, the untested-refusal census moving 119 → 171, a drifted citation at `argument.ts:1546`, and the `ap-17-891` receipt retraction test.
- **Decider:** the project owner, 2026-09-22, in the words quoted above and by selecting *"Register annus-mirabilis with dsr"*.
- **Why this entry exists:** because the previous owner ruling in this area was never written down, and the orchestrator then cited it wrongly to two panes — see `D-2026-09-21-facsimile-text-layer-stays-forbidden`. Every owner decision is now written to `DECISIONS.md` and to a bead comment in the tick it is obtained.
- **Consequence for the graph:** 20 of 417 open beads reason about workflows or GitHub Actions and need re-scoping. `am-h0nb` ("quality-gates.yml can essentially never complete") is a bead about a runner we do not use. `ciGateWiring.test.ts` (`9a471c86`) is well-built and verified red-on-removal by plant, but asserts "every `requiredInCi` gate is executed by some **workflow job**" — the right assertion pointed at the wrong artefact, and its referent must become the dsr `checks` chain.
- **Date:** 2026-09-22.
- **Revisit trigger:** dsr gains or loses the ability to run a check chain for a non-binary project, or the gate chain grows a step that needs a build host rather than this machine.
