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
- **Decider:** not yet assigned. The bead requires the decider to be the project owner or the editorial owner named in `am-gov-owners-and-reviewers-hte`, which is an open human gate with no owner named.
- **Status:** AWAITING RATIFICATION. This entry is a recommendation and is **not binding** until the project owner or a named editorial owner ratifies it. No dependent bead may cite it as a settled decision.
- **Date:** 2026-09-15.

### 1. Locked Dependency and Tool Version Inventory

Every runtime library, build tool, and runtime environment is pinned to an exact version. Floating ranges (`^` or `~`) are prohibited in `package.json`.

| Category | Package / Tool | Locked Version | License | Scope | Selection Rationale |
|---|---|---|---|---|---|
| **Runtime** | `node` | `22.13.4` (LTS) | MIT | Build / Server | Node LTS matching `@types/node: ^22.13.4`; used by `next build` and Next CLI locally, in CI, and on Vercel. Recorded in `package.json:engines.node`. |
| **Runtime** | `bun` | `1.4.0` | MIT | Test / Script | Pinned in `packageManager: "bun@1.4.0"`. Executes tests, data pipelines, and verified scripts with native `--isolate` support. |
| **Framework** | `next` | `15.5.25` | MIT | App Core | Next.js 15 App Router (`output: 'export'` / static pre-rendering). Version 15.5.25 patches 34 security advisories present in 15.2.0 (including RCE GHSA-9qr9-h5gf-34mp and RSC DoS CVEs). |
| **Framework** | `react` | `19.0.0` | MIT | Client / UI | Matched to Next.js 15.5 App Router core. Zero client-side hydration drift. |
| **Framework** | `react-dom` | `19.0.0` | MIT | Client / UI | DOM renderer for React 19. |
| **Language** | `typescript` | `5.7.3` | Apache-2.0 | Development | Strict TypeScript compiler for build validation and CI `tsc --noEmit`. |
| **Styling** | `tailwindcss` | `3.4.17` | MIT | Build | Tailwind v3 CSS token architecture. Keeps root `tailwind.config.ts` allowlisted in architecture gate without v4 breaking configuration changes. |
| **Styling** | `postcss` | `8.5.26` | MIT | Build | PostCSS processor; pinned via override to 8.5.26 to eliminate source map path traversal CVEs (GHSA-r28c-9q8g-f849). |
| **Styling** | `autoprefixer` | `10.4.20` | MIT | Build | Vendor prefixing for cross-browser CSS rules. |
| **Icons** | `lucide-react` | `0.475.0` | ISC | Client / UI | Lightweight, tree-shakeable iconography for UI chrome and laboratory controls. |
| **Math** | `katex` | `0.18.4` | MIT | Build / Client | Static KaTeX rendering HTML plus MathML at build time; restricted trust callback for interactive tokens (`\htmlClass`, `\htmlData`). |
| **3D Engine** | `three` | `0.185.1` | MIT | Client (Lazy) | Direct Three.js only where 2D projections lose spatial information. React Three Fiber is explicitly omitted (Discrepancy 7.1). |
| **Types** | `@types/three` | `0.185.4` | MIT | Development | Type definitions for direct Three.js scene graphs. |
| **Facsimile** | `pdfjs-dist` | `6.3.289` | Apache-2.0 | Client (Lazy) | Primary facsimile viewer engine; worker loaded lazily from same-origin `/pdf.worker.min.mjs` under strict CSP. |
| **Schemas** | `zod` | `4.4.3` | MIT | Build / Data | Declarative schema validation for content compiler and provenance receipts. Build-time execution avoids runtime `unsafe-eval` JIT compilation. |
| **Archive** | `fflate` | `0.8.3` | MIT | Build / Scripts | Fast, zero-dependency zip/decompression utility for bundle and asset scripts. |
| **Content** | `js-yaml` | `4.1.0` | MIT | Build / Content | Strict YAML parser for declarative content records under `content/`. |
| **Content** | `marked` | `15.0.7` | MIT | Build / Content | Constrained Markdown parser enforcing closed node allowlist (no raw HTML, no executable MDX). |
| **Search** | `minisearch` | `7.1.2` | MIT | Build / Client | Lightweight (under 8 kB gzipped) client-side search indexing engine over build-time pre-indexed paper tokens. Chosen over FlexSearch due to deterministic serialization and zero memory leak profile. |
| **Font Tool** | `fonttools` (`pyftsubset`) | `4.56.0` | Apache-2.0 | Build / Scripts | Reproducible subsetting of Newsreader, Plus Jakarta Sans, and JetBrains Mono fonts without omitting German diacritics, Greek letters, or mathematical notation. |
| **Linter** | `@biomejs/biome` | `2.5.8` | MIT / Apache-2.0 | Development | High-speed linting, code formatting, and syntax verification. |
| **Testing** | `playwright` | `1.62.1` | Apache-2.0 | Testing | Browser automation harness driving headless Chromium, WebKit, and Firefox acceptance suites. |
| **Testing** | `@axe-core/playwright` | `4.10.1` | MPL-2.0 | Testing | Automated WCAG AA accessibility compliance verification in end-to-end tests. |
| **Scanner** | `ubs` | `3.0.0` | MIT | Development | Ultimate Bug Scanner; local static analysis gate. |
| **Deployment** | `vercel` | `59.10.0` | Apache-2.0 | Deployment | Vercel CLI driving candidate-then-promote deployment pipeline (`vercel build`, `vercel deploy --prebuilt`). |

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
    "replacement": "curl -s -S -f -H "x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}" "${DEPLOYMENT_URL}${ENDPOINT}""
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
4. **Toolchain Alignment:** The Node.js version (`22.13.4`), Bun version (`1.4.0`), and Vercel CLI version (`59.10.0`) are documented as the canonical toolchain. Local developers, CI pipelines, and Vercel project settings must align to these versions.

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
