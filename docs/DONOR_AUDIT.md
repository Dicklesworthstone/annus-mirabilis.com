# Donor and Numerical Owner Audit

**Audit Date:** 2026-09-15  
**Auditor:** LilacCanyon (`antigravity`, model `gemini-3.8-flash-high`)  
**Status:** In Progress (Sections 1–4 drafted incrementally per coordinator directive)  
**Owning Bead:** `am-gov-donor-audit-0wa`

---

## 1. Identity

### 1.1 Architecture Donor: classic-patents.com

- **Repository URL:** `https://github.com/Dicklesworthstone/classic-patents.com`
- **Local Checkout Path:** `/Users/jemanuel/projects/classic-patents.com`
- **Pinned Commit Hash:** `da11ff475902728fd8dd1d9db9f3af37c16ec8a5`
- **Commit Date:** `2026-09-05 19:35:02 -0400` (`2026-09-05T19:35:02-04:00`)
- **Commit Author:** Jeff Emanuel `<jeff141421@gmail.com>`
- **Commit Subject:** `feat(ui): enhance 2D/3D patent simulations, laboratory visualizers, and interactive timeline`
- **Revision Status:** Pinned revision is current `HEAD` of the local checkout (`git -C ~/projects/classic-patents.com rev-parse HEAD`).
- **Retrieval Method:** Local clone inspection via `git show`, `git ls-tree`, `git cat-file`.

### 1.2 Numerical Owner: FrankenSim

- **Repository URL:** `https://github.com/Dicklesworthstone/frankensim`
- **Local Checkout Path:** `/Users/jemanuel/projects/frankensim`
- **Pinned Commit Hash (Kickoff Pin):** `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`
  - **Commit Date:** `2026-09-13 22:22:09 -0400` (`2026-09-13T22:22:09-04:00`)
  - **Commit Author:** Jeff Emanuel `<35050222+Dicklesworthstone@users.noreply.github.com>`
  - **Commit Subject:** `feat(conduction): differentiate cooling through temperature-dependent conductivity`
  - **Role:** The authoritative pinned revision that Annus Mirabilis builds and verifies against at kickoff.
- **Second Inspected Revision:** `88a4819abe7a361d278759aabec962604f87a00c`
  - **Commit Date:** `2026-09-14 09:07:46 -0400` (`2026-09-14T09:07:46-04:00`)
  - **Commit Author:** Jeff Emanuel `<35050222+Dicklesworthstone@users.noreply.github.com>`
  - **Commit Subject:** `feat(cli): schedule independent component powers across coupled thermal transients`
  - **Role:** Earlier planning inspection revision, documented for diff comparison and corroboration.
- **Ancestry Relationship:** Determined deterministically by command:
  - `git -C ~/projects/frankensim merge-base --is-ancestor 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 88a4819abe7a361d278759aabec962604f87a00c` exited `0` (TRUE).
  - `git -C ~/projects/frankensim merge-base --is-ancestor 88a4819abe7a361d278759aabec962604f87a00c 5bbbfae6f7de614422f6f97f5798a3e00f8ad813` exited `1` (FALSE).
  - **Verdict:** `5bbbfae6f7de614422f6f97f5798a3e00f8ad813` IS an ancestor of `88a4819abe7a361d278759aabec962604f87a00c`, proving that `88a4819abe7a361d278759aabec962604f87a00c` is the later revision.
- **Inspected Revisions.** Each inspection is attributed to the document that performed it, with the
files that inspection actually opened, so a later reader can tell an inspected revision from the
pinned one and can see what each inspection did and did not look at:

| Revision | Commit date | Pinned | Inspecting document | Files that inspection opened |
|---|---|---|---|---|
| `5bbbfae6f7de614422f6f97f5798a3e00f8ad813` | `2026-09-13T22:22:09-04:00` | **Yes, the kickoff pin** | This audit, during the `am-gov-donor-audit-0wa` implementation session | `crates/fs-wasm/Cargo.toml`; `crates/fs-wasm/src/lib.rs`; `crates/fs-rand/src/philox.rs`; the workspace crate listing |
| `88a4819abe7a361d278759aabec962604f87a00c` | `2026-09-14T09:07:46-04:00` | No | `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA.md` and `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA_V2.md` (7 and 8 citations of the hash respectively) | `README` capability boundaries; root `Cargo.toml` workspace layout and nightly policy; `crates/fs-rand/src/lib.rs`; `crates/fs-qty/src/lib.rs`; `crates/fs-wasm/Cargo.toml`; `crates/fs-demo-physics-wasm/src/lib.rs`; the opening declarations and heat-update portion of `crates/fs-wasm/src/lib.rs` |

  The pinned revision is the **older** of the two. That is deliberate, and it is stated here so that
no reader infers that the pin is simply the newest revision available.
- **Ancestry Evidence On Disk.** The ancestry result, the commit list, and the per-crate diff stat
are saved under `artifacts/donor-audit/20260915T182531Z-sandycedar/`:
  - `ancestry.txt`: both `merge-base --is-ancestor` runs with their exit codes and the verdict.
  - `log-older-to-newer.txt`: the 3 commits between the revisions (`88a4819a`, `f12c84cd`, `268f2399`).
  - `diff-stat-five-crates.txt`: the empty diff stat over `crates/fs-wasm`, `crates/fs-rand`, `crates/fs-qty`, `crates/fs-sparse`, and `crates/fs-demo-physics-wasm`.

  `artifacts/` is never committed: `.gitignore` keeps test, audit, and retained-failure evidence
local or attached to CI runs. The commands that produced these files are recorded verbatim in
section 2, so any reader can regenerate the evidence from the two hashes without this directory.

---

## 2. Method and Limits

### 2.1 Inspection Scope & Limitations

This audit is **source and document inspection**, not an execution audit.
- **What was inspected:** Repository manifests (`package.json`, `Cargo.toml`, `rust-toolchain.toml`), source code files, documentation, test files, and git commit objects at the pinned revisions.
- **What was NOT executed:** Donor test suites (`bun test`), browser end-to-end tests (`playwright`), production builds (`next build`), donor WASM artifact builds (`cargo build --target wasm32-unknown-unknown`), and native simulation sliders were **NOT** executed.
- **Reporting Rule:** Reported catalog counts and code metrics represent documentation facts and static analysis at the inspected snapshot, trusted strictly from manifest declarations and executing code over prose.

### 2.2 Executed Checks and Command Log

The following deterministic commands were executed in the local environment to establish audit facts:

1. **Commit Resolution & Commit Date Verification:**
   - Command: `git -C /Users/jemanuel/projects/classic-patents.com cat-file -e da11ff475902728fd8dd1d9db9f3af37c16ec8a5^{commit}`
   - Result: Exit 0.
   - Command: `git -C /Users/jemanuel/projects/classic-patents.com log -1 --format="commit %H%ndate: %ci (%cI)%nauthor: %an <%ae>%nsubject: %s" da11ff475902728fd8dd1d9db9f3af37c16ec8a5`
   - Result: Exit 0. Output confirmed commit date `2026-09-05 19:35:02 -0400`.
   - Command: `git -C /Users/jemanuel/projects/frankensim cat-file -e 5bbbfae6f7de614422f6f97f5798a3e00f8ad813^{commit}`
   - Result: Exit 0.
   - Command: `git -C /Users/jemanuel/projects/frankensim log -1 --format="commit %H%ndate: %ci (%cI)%nauthor: %an <%ae>%nsubject: %s" 5bbbfae6f7de614422f6f97f5798a3e00f8ad813`
   - Result: Exit 0. Output confirmed commit date `2026-09-13 22:22:09 -0400`.
   - Command: `git -C /Users/jemanuel/projects/frankensim cat-file -e 88a4819abe7a361d278759aabec962604f87a00c^{commit}`
   - Result: Exit 0.
   - Command: `git -C /Users/jemanuel/projects/frankensim log -1 --format="commit %H%ndate: %ci (%cI)%nauthor: %an <%ae>%nsubject: %s" 88a4819abe7a361d278759aabec962604f87a00c`
   - Result: Exit 0. Output confirmed commit date `2026-09-14 09:07:46 -0400`.

2. **FrankenSim Ancestry Verification:**
   - Command: `git -C /Users/jemanuel/projects/frankensim merge-base --is-ancestor 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 88a4819abe7a361d278759aabec962604f87a00c`
   - Result: Exit 0 (5bbbfae IS ancestor of 88a4819).
   - Command: `git -C /Users/jemanuel/projects/frankensim merge-base --is-ancestor 88a4819abe7a361d278759aabec962604f87a00c 5bbbfae6f7de614422f6f97f5798a3e00f8ad813`
   - Result: Exit 1 (88a4819 IS NOT ancestor of 5bbbfae).

3. **FrankenSim Inter-Revision Log & Diff Stat:**
   - Command: `git -C /Users/jemanuel/projects/frankensim log --oneline 5bbbfae6f7de614422f6f97f5798a3e00f8ad813..88a4819abe7a361d278759aabec962604f87a00c`
   - Result: 3 commits (`88a4819a`, `f12c84cd`, `268f2399`).
   - Command: `git -C /Users/jemanuel/projects/frankensim diff --stat 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 88a4819abe7a361d278759aabec962604f87a00c -- crates/fs-wasm crates/fs-rand crates/fs-qty crates/fs-sparse crates/fs-demo-physics-wasm`
   - Result: Empty diff stat (0 files changed across those 5 key crates between 5bbbfae and 88a4819).

4. **Donor LICENSE SHA-256 Check:**
   - Command: `git -C /Users/jemanuel/projects/classic-patents.com show da11ff475902728fd8dd1d9db9f3af37c16ec8a5:LICENSE | shasum -a 256`
   - Result: `32a82e0a5754e72e51fae44b65a936c831c07376f21c90f5fb9e76897fcc3509  -`

5. **Reuse Seam Path Existence Verification:**
   - Method: Every donor path cited in the section 5 reuse table's first column was checked at the pinned revision, with `git cat-file -e <hash>:<path>` for files and `git ls-tree -d <hash> -- <dir>` for directories.
   - Result: 62 paths checked, 61 present, 1 absent. `public/patents/facsimiles/` does not exist at the pinned revision; `git ls-tree` of `public/patents/` returns `facsimile-pages`, `figures`, `pdfs`, `source-text`, and `transcripts`, and the real directory is `public/patents/facsimile-pages/` with 109 files. Section 5 states the corrected path and the exception is recorded as discrepancy 7.7.
   - Correction: an earlier revision of this log reported "100% of tested paths confirmed present" over 39 paths. That claim was wrong on both the count and the result, and is retracted here rather than quietly overwritten.

---

## 3. Manifest Facts

### 3.1 Architecture Donor: classic-patents.com Manifest (`package.json`)

Source citation: `classic-patents.com:package.json` at commit `da11ff475902728fd8dd1d9db9f3af37c16ec8a5`.

#### Declared Runtime Dependencies

| Package | Declared Version | Purpose in Donor |
|---|---|---|
| `@types/three` | `^0.185.4` | TypeScript definitions for Three.js 3D runtime |
| `katex` | `^0.18.4` | Mathematical formula rendering (HTML + MathML) |
| `lucide-react` | `^0.475.0` | UI icon library |
| `next` | `^15.2.0` | Next.js App Router framework |
| `pdfjs-dist` | `6.3.289` | PDF parsing and canvas rendering for primary facsimiles |
| `react` | `^19.0.0` | React UI library |
| `react-dom` | `^19.0.0` | React DOM bindings |
| `three` | `^0.185.1` | Direct Three.js 3D physics scene rendering |
| `zod` | `^4.4.3` | Schema validation for curated editions and API records |

*Notice on missing packages:* Although some architectural prose mentions React Three Fiber (`@react-three/fiber`), it is **not** declared in `package.json`. Classic Patents uses direct, imperative Three.js via `ThreeStudioScene.ts`.

#### Declared Development Dependencies

| Package | Declared Version | Purpose in Donor |
|---|---|---|
| `@biomejs/biome` | `2.5.8` | Formatter and linter |
| `@types/bun` | `^1.3.14` | TypeScript types for Bun execution environment |
| `@types/katex` | `^0.16.8` | TypeScript types for KaTeX |
| `@types/node` | `^22.13.4` | TypeScript types for Node.js |
| `@types/react` | `^19.0.10` | TypeScript types for React 19 |
| `@types/react-dom` | `^19.0.4` | TypeScript types for React DOM 19 |
| `autoprefixer` | `^10.4.20` | PostCSS vendor prefixer |
| `fflate` | `0.8.3` | Fast compression / zip utility |
| `playwright` | `^1.62.1` | Headless browser engine for E2E acceptance suites |
| `postcss` | `^8.5.2` | CSS processing pipeline |
| `tailwindcss` | `^3.4.17` | Utility-first CSS styling framework |
| `typescript` | `^5.7.3` | Strict TypeScript compiler |

#### Lockfile, Engine & Runtime Expectations

- **Lockfile Format:** `bun.lock` (text format introduced in Bun 1.2+; git blob `9e31a78d948bd6441b851584f5d796eb54e5e340`). No legacy binary `bun.lockb` is present.
- **Node.js Engine Expectations:** No `engines` field is declared in `package.json`. The presence of `@types/node: ^22.13.4` indicates Node 22 API compatibility targets for scripts.
- **Bun Version & Test Isolation:** Scripts target Bun runtime (`@types/bun: ^1.3.14`). The standard test script (`package.json:15`) is:
  ```json
  "test": "bun test --isolate --timeout 60000"
  ```
  **Per-file test isolation mechanism:** The donor relies on the `--isolate` flag of the native `bun test` runner. This guarantees that each test file runs in an isolated process context, preventing global state mutation (such as module-level caches or prototype extensions) from leaking between test suites.
- **Playwright Version:** `^1.62.1`, used in `scripts/deployment-verification.ts` and `scripts/e2e-patent-vertical-slices.ts` for browser sweep verification.

#### Vercel CLI Commands Called in Donor Scripts

The donor deployment scripts (`scripts/verified-production-deploy.ts` and `scripts/deployment-target.ts`) explicitly invoke the following `vercel` CLI commands:

| Command Invocation | File & Line | Purpose |
|---|---|---|
| `vercel pull --yes` | `scripts/verified-production-deploy.ts:381` | Fetch project environment settings and configuration |
| `vercel build --prod` | `scripts/verified-production-deploy.ts:384` | Produce production Build Output API v3 bundle locally |
| `vercel deploy --prebuilt --prod` | `scripts/verified-production-deploy.ts:391` | Upload and deploy the prebuilt `.vercel/output` artifact |
| `vercel alias set <previewUrl> <hostname>` | `scripts/verified-production-deploy.ts:403` | Atomically promote verified preview URL to public hostnames |
| `vercel inspect <url>` | `scripts/verified-production-deploy.ts:404, 414` | Inspect deployment status, readiness, and alias assignments |
| `vercel curl --deployment <d> <path> -- --silent --show-error --write-out ...` | `scripts/verified-production-deploy.ts:294` | Fetch and assert protected preview HTTP status before promotion |
| `vercel link --project <name>` | `scripts/deployment-target.ts:36, 57` | Link workspace to canonical production Vercel project |

**Build Output API Requirement:** `scripts/verified-production-deploy.ts` lines 242–244 explicitly assert:
```ts
if (config.version !== 3) {
  throw new Error("Vercel output config is not a version 3 Build Output API artifact.");
}
```
This confirms that the donor scripts assume a Vercel CLI version emitting version 3 Build Output specifications.

#### Donor Production Identity Constants

Defined in `scripts/deployment-verification.ts` (lines 14–23) and `scripts/verified-production-deploy.ts` (line 24):
- `CANONICAL_VERCEL_PROJECT_ID`: `"prj_eeVw8BqcY9iO2e0VEQyS5i6rZkE0"`
- `CANONICAL_VERCEL_ORG_ID`: `"team_F5Q3EH8Qxu3nDEOyEZLcQPe6"`
- `CANONICAL_VERCEL_PROJECT_NAME`: `"classic-patents"`
- `CANONICAL_PLATFORM_HOSTNAME`: `"classic-patents.vercel.app"`
- `CANONICAL_PUBLIC_HOSTNAMES`: `["classic-patents.com", "www.classic-patents.com"]`
- `DEPLOYMENT_LOCK_PORT`: `45267` (`45_267`)
- Critical Verification Routes:
  - Wright detail page: `/patents/us-821393-wright-flyer`
  - Complete source delivery endpoint: `/patents/us-4063220-metcalfe-ethernet`

---

### 3.2 Numerical Owner: FrankenSim Manifest (`Cargo.toml`)

Source citation: `frankensim:Cargo.toml` at commit `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`.

- **Workspace Layout:** Virtual workspace containing 117 member crates, managing leaf numerics, physics kernels, campaign pipelines, and tooling.
- **Cargo Resolver:** `resolver = "3"`
- **Rust Edition:** `2024`
- **License:** `MIT OR Apache-2.0`
- **Sibling Patch:**
  ```toml
  [patch.crates-io]
  asupersync = { path = "../asupersync" }
  ```
- **Workspace Lint Policies:**
  - `unsafe_code = "deny"` across all workspace crates (modules requiring unsafe must register in `docs/CONVENTIONS.md` with explicit `SAFETY.md`).
  - `missing_docs = "warn"`
  - Clippy pedantic warnings enabled with deliberate numerical-kernel exceptions: `cast_possible_truncation`, `cast_possible_wrap`, `cast_precision_loss`, `cast_sign_loss`, `neg_cmp_op_on_partial_ord` (NaN-aware guards), `manual_midpoint` (preserves half-sum physics semantics).
- **Profile Configuration:**
  - `profile.dev.package.fsqlite*`: Forced to `opt-level = 1` for SQLite engine crates to prevent unoptimized VDBE interpreter performance collapse in debug tests.
  - `profile.release`: `lto = "thin"`, `codegen-units = 1`, `debug = "line-tables-only"`.

#### FrankenSim Toolchain Pin (`rust-toolchain.toml`)

Source citation: `frankensim:rust-toolchain.toml` at commit `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`.

- **Channel:** `nightly-2026-07-06`
- **Compiler Version:** `rustc 1.99.0-nightly (3659db0d3 2026-07-05)`
- **Components:** `["rustfmt", "clippy"]`
- **Rationale:** Pinned per bead `go7a` to eliminate CI/local lint drift while supporting const-generic dimension arithmetic in `fs-qty`.

#### `crates/fs-wasm` Dependency Graph

Source citation: `crates/fs-wasm/Cargo.toml` at commit `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`.

`crates/fs-wasm` is configured as a standalone workspace (`[workspace]`) with `crate-type = ["cdylib", "rlib"]` and `unsafe_code = "forbid"`. It declares dependencies across several layers:

1. **Leaf Numerical Crates:**
   - `fs-sparse`: Sparse matrix representations (CSR, CSC) and SpMV kernels
   - `fs-cheb`: Chebyshev polynomial approximations and spectral grids
   - `fs-rand`: Counter-based Philox PRNG and normal distribution sampling
   - `fs-math`: Special mathematical functions and floating-point utilities
   - `fs-ivl`: Interval arithmetic and verified bounds
   - `fs-ad`: Automatic differentiation primitives
   - `fs-fft`: Fast Fourier transforms
   - `fs-la`: Dense linear algebra (BLAS/LAPACK-style operations)
   - `fs-ga`: Geometric algebra and multivector operations

2. **Upper-Stack Physical Kernels:**
   - `fs-geom`: Geometric algorithms and computational geometry
   - `fs-feec`: Finite element exterior calculus
   - `fs-flux`: Fluid dynamics (Navier-Stokes) and flux balance
   - `fs-cutfem`: Cut finite element method
   - `fs-solver`: Non-linear and iterative equation solvers
   - `fs-bo`: Bayesian optimization routines
   - `fs-xform`: Coordinate transformations and kinematic chains
   - `fs-dfo`: Derivative-free optimization
   - `fs-symmetry`: Spatial and geometric symmetry detection
   - `fs-solid`: Solid mechanics and elasticity
   - `fs-rep-mesh`: Surface mesh representations and boundary extraction

3. **Campaign, Flagship & Support Crates (Tier IV / V):**
   - `fs-evidence`: Structured verification receipts and determinism logging
   - `fs-sos`: Sum-of-squares polynomial optimization
   - `fs-robust`: Robust control and uncertainty certification
   - `fs-tropical`: Tropical algebra and shortest-path dynamic programming
   - `fs-voi`: Value of information metrics
   - `fs-spectral`: Advanced spectral operators and eigensolvers
   - `fs-couple`: Multi-physics coupled field stepping
   - `fs-duct`: Acoustic duct and wave propagation models
   - `fs-rep-neural`: Neural representation evaluators
   - `fs-viz`: Visual projection data pipelines
   - `fs-shapeprog`: Shape programming and geometric morphing
   - `fs-archive`: Model serialization and snapshot compression
   - `fs-fab`: Digital fabrication and toolpath validation
   - `fs-assimilate`: Data assimilation and state estimation
   - `fs-toleralloc`: Tolerance allocation and sensitivity analysis
   - `fs-lattice`: Lattice infill optimization (Note: additive manufacturing infill, NOT crystal lattice physics)
   - `fs-truss`: Structural truss analysis
   - `fs-eproc`: Event processing pipelines
   - `fs-lbm`: Lattice Boltzmann fluid dynamics
   - `fs-ornith`: Flapping-wing aerodynamic flight model
   - `fs-vessel`: Marine vessel hydrodynamics
   - `fs-frame`: Structural frame dynamics
   - `fs-bem`: Boundary element method
   - `fs-vpm`: Vortex particle method
   - `fs-race`: Vehicle racing trajectory optimization
   - `fs-render`: Offscreen software rendering rasterizer
   - `fs-scenario`: Scenario execution harness
   - `fs-uq`: Uncertainty quantification
   - `fs-material`: Physical material properties database
   - `fs-alloc`: Custom allocators and arena memory
   - `fs-exec`: Pipeline execution supervisor
   - `fs-qty`: Physical quantity representation and dimensional analysis

4. **Certified E2E Campaign Crates:**
   - `fs-robustopt-e2e`, `fs-metamat-e2e`, `fs-flutter-e2e`, `fs-schedule-e2e`, `fs-truss-e2e`, `fs-oed-e2e`, `fs-neuroshape-e2e`, `fs-grammar-e2e`, `fs-adaptbo-e2e`, `fs-flowcert-e2e`

5. **Target-Specific Wasm Dependencies (`cfg(target_arch = "wasm32")`):**
   - `wasm-bindgen`: `0.2`
   - `asupersync`: Path dependency to `../../../asupersync` with `features = ["wasm-browser-prod"]`
   - `getrandom`: `0.4` with `features = ["wasm_js"]`

*Architectural Implication:* Because `crates/fs-wasm/Cargo.toml` pulls in this vast constellation of upper-stack and campaign crates, the standard `fs-wasm` artifact is excessively heavy for a browser reading experience. This establishes the critical necessity for Annus Mirabilis to build a dedicated **feature-selected slim artifact** (`am-fs-slim-artifact-0yh`) containing only the needed numerical leaves.

---

## 4. Findings

Each finding from Plan §2.2 has been re-verified against the local repositories at the pinned revisions (`classic-patents.com:da11ff475902728fd8dd1d9db9f3af37c16ec8a5` and `frankensim:5bbbfae6f7de614422f6f97f5798a3e00f8ad813`).

Status values follow the strict closed vocabulary: `confirmed`, `changed`, `not-present`, or `unchecked`.

### Finding 4.1: Separation of Source Layers

- **Statement:** The donor strictly separates the pinned facsimile, the reviewed transcription ledger, the visitor-facing authored edition, and editorial explanation. A later layer is never permitted to masquerade as an earlier one.
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `classic-patents.com:src/data/patents/sourceTextValidation.ts`: lines 145–182 and 205–265 enforce that a reviewed ledger cannot substitute editorial text for facsimile wording; lines 205–240 validate manually authored page anchors against PDF page counts; lines 285–295 assert that a reviewed transcription must not be a partial note or page summary.
  - `classic-patents.com:src/components/patents/PinnedPdfFacsimile.tsx`: lines 50–70 render the literal primary document via PDF.js without editorial annotations.
  - `classic-patents.com:src/data/editions/parallelReadings.ts`: lines 1–25 define parallel readings explicitly as editorial interpretations, completely distinct from OCR cleanups or diplomatic transcripts.

### Finding 4.2: Multidimensional Coverage

- **Statement:** Coverage is multidimensional: catalogue records, reviewed ledgers, accepted editions, patent-specific WASM surfaces, generic-WASM consumers, and typed-host-only records are distinct numbers and cannot be collapsed into a single completeness percentage.
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `classic-patents.com:src/physics/coverageManifest.ts`: lines 15–19 define `WasmSurfaceKind` (`none`, `generic-wasm`, `interpretive-wasm`, `patent-specific-wasm`); lines 76–93 define `PatentCoverageSummary` with 16 distinct metrics: `total`, `pinnedFacsimiles`, `reviewedLedgers`, `publishedEditions`, `candidateEditions`, `heldEditions`, `rejectedEditions`, `facsimileOnlyRecords`, `sourceBoundedRecords`, `patentSpecificWasm`, `interpretiveWasm`, `genericWasm`, `typedHostOnly`, `sharedBusUpdaters`, `sharedBusSnapshots`, and `missingSharedBus`.

### Finding 4.3: Equation Schema, Term Interaction & Redesign Seams

- **Statement:** The equation schema links symbols, roles, units, sentence fragments, colors, and telemetry, supporting term selection, keyboard navigation, color-blind mode, and live values. KaTeX renders HTML plus MathML using a restricted trust callback. Seams requiring redesign include telemetry lookup by human label and permissive token matching (`variableId.startsWith("var_" + id)`).
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `classic-patents.com:src/components/ui/ColorizedEquation.tsx`:
    - Line 117 contains the permissive token match: `variableId.startsWith(\`var_\${variable.id}\`) || ...`, which relies on substring matching instead of exact canonical quantity IDs.
    - Lines 162–213 implement `colorBlindMode` toggling and accessibility aria labels (`aria-pressed={colorBlindMode}`).
    - Line 337 wires `onKeyDown={handleFormulaKeyDown}` for keyboard navigation over math symbols, with the arrow-key step map at lines 46 and 48 (`ArrowLeft: -1`, `ArrowRight: 1`). Lines 360–445, cited here previously, define `PlainEnglishFragment` and `PlainEnglishDecoder` and contain no keyboard handling.
  - `classic-patents.com:src/components/ui/LatexRenderer.tsx`: lines 19–32 implement `trustInteractiveTokenMarkup` as a restricted KaTeX trust callback that strictly allowlists `htmlId` and `htmlClass` attributes while refusing arbitrary URLs or script injections.
  - `classic-patents.com:src/types/equation.ts`: lines 10–55 define the equation data structure linking symbols, descriptions, units, and color assignments.

### Finding 4.4: `usePatentPhysics` State Management

- **Statement:** `usePatentPhysics` keeps module-global maps keyed by patent ID and increments a control-change tick that is a UI event counter, not a physical solver step.
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `classic-patents.com:src/physics/usePatentPhysics.ts`:
    - Lines 18–22 declare module-global state:
      ```ts
      const listenersMap = new Map<string, Set<Listener>>();
      const stateMap = new Map<string, Record<string, number>>();
      const tickMap = new Map<string, number>();
      const changeMap = new Map<string, ParamChange | null>();
      ```
    - Lines 40–43 implement `bumpTick` (line 39 is blank):
      ```ts
      function bumpTick(patentId: string, change: ParamChange | null) {
        tickMap.set(patentId, (tickMap.get(patentId) ?? 0) + 1);
        changeMap.set(patentId, change);
      }
      ```
      This increment is triggered by user slider manipulations (UI events) rather than numerical integrator time steps.

### Finding 4.5: `DualProjectionViewer` Scoping and Bundle Boundaries

- **Statement:** `DualProjectionViewer` accepts server-resolved per-patent equation data instead of importing the aggregate registry (which comments cite as ~976 KB). The September 2026 donor build measured home first-load JavaScript at 192 kB.
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `classic-patents.com:src/components/patents/DualProjectionViewer.tsx`:
    - Line 43: `/** One server-resolved companion map; never import the all-patent registry here. */`
    - Lines 49–50: `/** Per-patent colorized equations, resolved on the server (colorizedEquations.ts is a 976KB all-patents record that must never enter the client bundle wholesale). */`
    - Line 151–158: `DualProjectionViewer` component accepts `colorizedEquations: ColorizedEquationType[]` as a scoped prop.

### Finding 4.6: Runtime Provenance States in `coverageManifest.ts`

- **Statement:** `coverageManifest.ts` distinguishes packaged surfaces, loaded artifacts, typed refusal boundaries, and accepted steps; `HONEST_PLACEHOLDER`, `TS_FALLBACK`, and `WASM` are distinct execution states.
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `classic-patents.com:src/physics/coverageManifest.ts`:
    - Line 21: `export type RuntimeProvenance = "WASM" | "TS_FALLBACK" | "HONEST_PLACEHOLDER";` (line 22 is blank)
    - Lines 24–32: `WasmSurfaceDescriptor` explicitly types `refusalBoundary: "typed-wasm" | "host-decoder" | "none"` and `provesSharedBusSource?: boolean`.
    - Lines 65–72: distinguishes `wasmArtifactPresent`, `admittedProvenance`, and `coldStartProvenance: "HONEST_PLACEHOLDER"`.

### Finding 4.7: FrankenSim Physics Capabilities, APIs & Limits

- **Statement:**
  - `fs-wasm` depends on `fs-rand` (Philox4x32-10 PRNG, normal sampling, versioned checkpoints) and `fs-sparse` (CSR Laplacians).
  - `heat_frames` is a fixed two-blob 2D demonstration with a hard-coded initial field and dimensionless step, taking no diffusion coefficient, spacing, or profile.
  - `fs-qty` represents base-dimension exponents as integers (`i8`) over six base dimensions.
  - `fs-demo-physics-wasm` shows the typed accepted/refusal JSON envelope with version identity and explicit no-claims.
  - No ready Brownian, radiation, or special-relativity product API was found in the inspected FrankenSim revision.
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `frankensim:crates/fs-wasm/Cargo.toml`: line 21 (`fs-sparse = { path = "../fs-sparse" }`), line 23 (`fs-rand = { path = "../fs-rand" }`). Lines 24 and 26 hold `fs-math` and `fs-ad`, not these two.
  - `frankensim:crates/fs-rand/src/philox.rs`: line 31 (`pub fn philox4x32_10(mut ctr: [u32; 4], mut key: [u32; 2]) -> [u32; 4]`); line 58 (`pub fn philox4x32_10_batch<const L: usize>(ctr: &[[u32; 4]; L], key: [u32; 2]) -> [[u32; 4]; L]`).
  - `frankensim:crates/fs-rand/src/lib.rs`: lines 192–305 implement canonical binary serialization, schema checks, and version validation for `StreamCheckpoint`; line 579 exposes `pub fn next_normal(&mut self) -> f64`.
  - `frankensim:crates/fs-wasm/src/lib.rs` (1206 lines): line 252 defines the inner `pub fn heat_frames(n_in: usize, frames_in: usize, steps_per_frame_in: usize) -> Vec<f64>`, with lines 249 to 251 its doc comment. Line 1000 defines the exported `#[wasm_bindgen]` wrapper `pub fn heat_frames(n, frames, steps_per_frame)` inside `mod wasm`, which delegates to `super::heat_frames` at line 1001. Both are recorded because the exported wrapper, not the inner function, is the surface a browser calls. Initial condition hardcodes two Gaussians `g(0.3, 0.3, 0.07) - g(0.7, 0.68, 0.08)`, fixed `dt = 0.20`, taking no thermal diffusivity, grid pitch, or custom initial profile.
  - `frankensim:crates/fs-qty/src/lib.rs`: line 42 defines `pub const DIMENSION_COUNT: usize = 6;` and line 50 defines `pub struct Dims(pub [i8; DIMENSION_COUNT]);` over `[m, kg, s, K, A, mol]`. Lines 9 to 13 are module documentation and line 35 is `use core::fmt;`; neither defines either item.
  - `frankensim:crates/fs-demo-physics-wasm/src/lib.rs`: lines 16–25 document typed-refusal JSON envelope contract (`{"ok": ...}` or `{"refusal": {"code","message","ranked_repairs"}}`) and explicit no-claims; `impl Refusal` begins at line 57 and `fn json(&self) -> String` at line 58.
  - API Search Results: Search command `git -C ~/projects/frankensim grep -i -E '(brownian|langevin|planck_radiation|lorentz_boost|einstein_relativity)' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/` returned 0 matches across all crates. (Absence in search is recorded as an empirical search result, not proof of non-existence).
  - Corroboration between revisions: Both `5bbbfae6f7de614422f6f97f5798a3e00f8ad813` (2026-09-13) and `88a4819abe7a361d278759aabec962604f87a00c` (2026-09-14) were examined. A diff stat between them for `crates/fs-wasm`, `crates/fs-rand`, `crates/fs-qty`, `crates/fs-sparse`, and `crates/fs-demo-physics-wasm` produced 0 diffs. The facts are identical across both revisions.

### Finding 4.8: Headless Browser Acceptance Contract

- **Statement:** The browser acceptance harness checks source identities, exact routes, source assets, URL-restored views, actual controls, telemetry and refusal behavior, 320 px screens, keyboard and touch interactions, reduced motion compliance, and retains failure evidence upon failure.
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `classic-patents.com:scripts/patent-e2e-contract.ts`: lines 14–18 define `PATENT_E2E_VIEWPORTS`, with `desktop` at line 15, `tablet` at 16, and `phone: { width: 320, height: 800 }` at line 17; line 39 declares `export interface PatentE2EScenario` capturing source identity, route, controls, and figure assets. Line 13 is blank, and the range 13–15 cited here previously excluded the phone viewport it named.
  - `classic-patents.com:scripts/e2e-patent-vertical-slices.ts`:
    - Lines 400, 440, 464, and 1673–1737 capture and assert complete failure evidence packages (full-page PNG screenshot, DOM snapshot, diagnostic JSON, and Playwright execution trace).
    - Lines 1023–1024 and 1448–1457 test keyboard tab navigation and focus visibility.
    - Line 1068 tests pointer and touch interactions.
    - Lines 1429–1434 verify media query `(prefers-reduced-motion: reduce)`.

### Finding 4.9: Third-Party Requests in Donor Chrome

- **Statement:** Every analytics or telemetry script, remote font, CDN reference, external image, and runtime fetch found in donor layout, Open Graph routes, and error boundaries must be identified so UI extraction can strip them per AGENTS.md policy.
- **Status:** `confirmed`
- **File & Line Evidence:**
  - **Remote Fonts:** In `classic-patents.com:src/app/layout.tsx:2–3`, fonts are loaded via `next/font/google`:
    ```ts
    import { JetBrains_Mono, Newsreader, Plus_Jakarta_Sans } from "next/font/google";
    ```
    While `next/font/google` downloads fonts at build time in Next.js, Annus Mirabilis policy explicitly requires self-hosting pre-downloaded, subset WOFF2 fonts under `public/fonts/` with zero reliance on external build-time Google APIs.
  - **Analytics / Tracking Scripts:** Search for `next/script`, `gtag`, `google-analytics`, `plausible`, and `segment` in `src/app/` and `src/components/layout/` returned 0 matches. No runtime analytics scripts are present.
  - **Open Graph Image Routes:** `classic-patents.com:src/app/opengraph-image.tsx` and `classic-patents.com:src/app/patents/[id]/opengraph-image.tsx` declare `export const dynamic = "force-static"` and render pure inline JSX with CSS shapes and unicode glyphs. No external runtime images or fetches are invoked.
  - **External Links:** Informational links to `https://github.com/Dicklesworthstone/classic-patents.com` appear in `src/components/layout/Footer.tsx:102` and `src/components/layout/Header.tsx:169`. These must be updated to the Annus Mirabilis repository during extraction.

---

## 5. Reuse Table

The reuse table adapts Plan §2.3. Every path listed was checked against the pinned donor tree at commit `da11ff475902728fd8dd1d9db9f3af37c16ec8a5`, using `git cat-file -e <hash>:<path>` for files and `git ls-tree -d <hash> -- <dir>` for directories. Of the 62 donor paths cited in the first column, 61 resolved at the pinned revision and one did not: `public/patents/facsimiles/`, the path named in the plan, does not exist there. The row below states the corrected path, `public/patents/facsimile-pages/`, which holds 109 files at the pinned revision.

| Donor Seam / Verified Path | Decision | Adaptation in Annus Mirabilis | License Notice Requirement | Extracting Bead |
|---|---|---|---|---|
| **Facsimile & Source Architecture**<br>`public/patents/facsimile-pages/`<br>`public/patents/transcripts/`<br>`src/data/editions/`<br>`src/data/patents/sourceTextValidation.ts` | **Reuse architecture** | Bilingual critical edition (German source face + English translation), sentence-level many-to-many alignment, section-scoped notation concordance, separately attributed notes | MIT + Rider | `am-bm-slice-e2e-sbqu`<br>`am-read-facsimile-face-er0` |
| **KaTeX Math Rendering**<br>`src/components/ui/LatexRenderer.tsx`<br>(includes `TextWithLatex`, `HudText`) | **Adapt** | Build-time static KaTeX (HTML + MathML); client hydrates term and operation interaction only; malformed math fails build closed | MIT + Rider | `am-scaf-extract-ui-components-c31` |
| **Colorized Equations & Interaction**<br>`src/components/ui/ColorizedEquation.tsx`<br>`src/components/ui/colorPalette.ts`<br>`src/components/ui/equationValueFormatting.ts`<br>`src/types/equation.ts` | **Refactor** | Exact canonical quantity IDs (eliminate `variableId.startsWith("var_" + id)` token matching and human-label lookups), operation-level derivations, expression trees | MIT + Rider | `am-scaf-extract-ui-components-c31`<br>`am-eq-expression-tree-8kl` |
| **Dual Projection Viewer (component)**<br>`src/components/patents/DualProjectionViewer.tsx` | **Redesign input, never copy-and-rename** | The monolith is not extracted. Its interaction ideas inform a reader shell with independently loaded panels (German source, English translation, explanation, discovery, laboratory), built new by `am-read-bilingual-faces-pao` | N/A (no code copied) | None (redesign input, no destination path) |
| **View Mode Addressing**<br>`src/components/patents/patentViewMode.ts` | **Reuse** | `?view=` deep links preserved as admitted reader state | MIT + Rider | `am-scaf-extract-ui-components-c31` |
| **Parallel Readings & Addressing**<br>`src/data/editions/parallelReadings.ts` | **Replace addressing model** | Replace block-index addressing with permanent, immutable content IDs (`s<n>-p<m>-s<k>`); inserting paragraphs never shifts annotations | MIT + Rider | `am-cm-id-scheme-8bn`<br>`am-scaf-extract-runtime-utilities-99y` |
| **Physics State Bus**<br>`src/physics/usePatentPhysics.ts` | **Redesign input, never copy-and-rename** | Not extracted. `am-rt-snapshot-store-aft` builds a new ownership layer: module-global maps keyed by patent id are replaced by instance-scoped experiments, one immutable snapshot per revision, and an observer change never restarts the world | N/A (no code copied) | None (redesign input, no destination path) |
| **Deterministic Control Tapes**<br>`src/physics/controlTape.ts`<br>`src/physics/tickScheduler.ts`<br>`src/physics/transport.ts`<br>`src/physics/paramAliases.ts` | **Reuse with new identities** | Deterministic tapes, host-fed time, cross-paper parameter aliasing via canonical quantity IDs rather than arbitrary strings | MIT + Rider | `am-scaf-extract-runtime-utilities-99y` |
| **WASM Runtime & Evaluators**<br>`src/physics/genericWasm.ts`<br>`src/physics/useGenericWasmSource.ts`<br>`src/physics/wasmArtifacts.test.ts`<br>`src/physics/lie.ts`<br>`src/physics/qty.ts`<br>`src/physics/intervals.ts`<br>`src/physics/energyLedger.ts` | **Reuse** | Honest execution labeling (`wasm`, `ts-fallback`, `unloaded`); rational dimensional exponents; validated interval bounds; energy ledgers | MIT + Rider | `am-scaf-extract-runtime-utilities-99y` |
| **Multidimensional Coverage**<br>`src/physics/coverageManifest.ts` | **Extend** | Source, translation, argument, instrument, accessibility, and numerical coverage stay separate dimensions; no single aggregated score | MIT + Rider | `am-scaf-extract-runtime-utilities-99y`<br>`am-cm-coverage-ledger-0ip` |
| **Spec Clause Weave**<br>`src/physics/specClauses.ts` | **Generalize** | Highlight the exact premise or conclusion an instrument currently demonstrates as an informative pointer, never decorative truth glow | MIT + Rider | `am-scaf-extract-runtime-utilities-99y`<br>`am-read-result-weave-jex` |
| **Visual Modules & 3D/2D Integration**<br>`src/components/patents/visuals/three/ThreeStudioScene.ts`<br>`src/components/patents/visuals/three/StudioKernelChips.tsx` | **Selectively adapt** | 2D first (Canvas/SVG) for spacetime event geometry and probability distributions; direct Three.js only where 2D loses spatial information | MIT + Rider | `am-scaf-extract-ui-components-c31` |
| **Historical Glossary / Concordance**<br>`src/components/patents/ArchaicGlossaryModal.tsx`<br>`src/data/esotericPatentTerms.ts` | **Refactor** | Section-scoped notation concordance and period vocabulary, never a global dictionary keyed by spelling | MIT + Rider | `am-scaf-extract-ui-components-c31` |
| **Visualizer Controls & Telemetry**<br>`src/components/patents/PhysicsTelemetryBadge.tsx`<br>`src/components/patents/PhysicsTelemetryBadgeHeader.tsx`<br>`src/components/ui/SensitivitySlider.tsx`<br>`src/components/patents/visuals/ControlTapeScrubber.tsx`<br>`src/components/patents/visuals/ClaimConstraintToggle.tsx` | **Adapt** | Numeric input entry beside every slider; probe toggles keyed to physical results; WCAG AA contrast compliance | MIT + Rider | `am-scaf-extract-ui-components-c31` |
| **Facsimile Viewer & PDF Worker**<br>`src/components/patents/PinnedPdfFacsimile.tsx`<br>`src/components/patents/usePinnedPdfFacsimile.ts`<br>`public/pdfjs/` | **Reuse** | Facsimile viewer with page mapping to sections and equations; self-hosted pdf.js worker assets | MIT + Rider (components);<br>Apache-2.0 (`public/pdfjs`) | `am-scaf-extract-ui-components-c31`<br>`am-read-facsimile-face-er0` |
| **Layout Chrome & Core UI**<br>`src/components/layout/Header.tsx`<br>`src/components/layout/Footer.tsx`<br>`src/components/layout/ThemeToggle.tsx`<br>`src/components/layout/PatentSearchPalette.tsx`<br>`src/app/opengraph-image.tsx`<br>`src/app/robots.ts`<br>`src/app/sitemap.ts`<br>`src/app/error.tsx`<br>`src/app/global-error.tsx`<br>`src/app/not-found.tsx` | **Reuse** | Three custom themes (Annalen, Kramgasse Night, Slate); build-time static search index; zero external scripts or analytics | MIT + Rider | `am-scaf-extract-ui-components-c31` |
| **Verified Production Deployment**<br>`scripts/verified-production-deploy.ts`<br>`scripts/deployment-target.ts`<br>`scripts/deployment-verification.ts`<br>`scripts/smoke-test-deployment.ts`<br>`scripts/app-router-architecture.ts` | **Reuse** | Candidate-then-promote release pipeline; fail-closed verification against unpromoted preview URL before DNS alias promotion | MIT + Rider | `am-scaf-extract-scripts-7jm`<br>`am-scaf-architecture-gate-l1p`<br>`am-rel-verified-deploy-qndt` |
| **Acceptance & Verification Harness**<br>`scripts/verify-data.ts`<br>`scripts/e2e-patent-vertical-slices.ts`<br>`scripts/patent-e2e-contract.ts`<br>`docs/PATENT_E2E_HARNESS.md` | **Adapt** | Adapt for content compiler (`verify-content.ts`) and paper vertical-slice browser acceptance suite | MIT + Rider | `am-scaf-extract-scripts-7jm`<br>`am-bm-slice-e2e-sbqu` |
| **Native iPhone App Shell Patterns**<br>`ios/project.yml`<br>`ios/Sources/PatentPDFReader.swift`<br>`ios/Sources/PrivacyInfo.xcprivacy`<br>`scripts/dsr-apple-quality.sh`<br>`ios/UITests/` | **Adapt patterns, not code** | SwiftUI native shell rendering static edition in WKWebView; on-demand facsimile PDF downloads with SHA-256 pins; offline reading | MIT + Rider | `am-app-xcodegen-scaffold-z228`<br>`am-app-facsimile-downloads-72nz`<br>`am-app-e2e-journeys-vm0t` |
| **Patent-Specific Features**<br>Claims, disputes, patent classifications, broadside printing, audio player, wizard reports, generic visual dispatch | **Do not port** | Replaced by historical argument steps, physical alternatives, experimental evidence, and connections | N/A | None (Excluded) |

---

## 6. Do-Not-Port List & FrankenPatents App Seams

### 6.1 Patent-Specific Features (Do Not Port)

The following architectural components and features of `classic-patents.com` are tightly bound to the patent museum domain and must **never** be ported to `annus-mirabilis.com`:

1. **Patent Claims and Claim Trees:**
   - Files: `src/components/patents/ClaimsList.tsx`, `src/components/patents/ClaimTree.tsx`, patent-specific claims logic in `src/components/patents/visuals/ClaimConstraintToggle.tsx`.
   - Reason: Annus Mirabilis models historical scientific arguments, experimental premises, heuristic hypotheses, and formal derivations, not patent legal claims.
2. **Infringement Disputes and Patent Wars:**
   - Files: `src/components/patents/HistoricalContextPanel.tsx` (rival claims, legal disputes, patent wars sections).
   - Reason: Historical context in Annus Mirabilis focuses on contemporary physics (the 1904 curriculum, experimental anomalies, Planck radiation debates), not priority litigation.
3. **Patent Classification Systems & Citation Lineages:**
   - Files: IPC/CPC classification code taxonomies, patent lineage trees, backward/forward citation graphs.
   - Reason: Replaced by bibliographic citations to *Annalen der Physik* and historical paper dependencies.
4. **Era Filter Bar:**
   - File: `src/components/layout/EraFilterBar.tsx`.
   - Reason: Annus Mirabilis focuses strictly on the 1905 Annus Mirabilis papers plus the 1905 doctoral dissertation.
5. **Broadside Printing Mode:**
   - File: `src/components/patents/PrintBroadsideModal.tsx`.
   - Reason: The reading experience is optimized for continuous bilingual parallel reading, split views, and standard paper printing, not decorative broadsides.
6. **Audio Narration Player:**
   - File: `src/components/layout/AudioCleanupProvider.tsx`, pre-rendered audio narration assets.
   - Reason: Audio players add substantial runtime weight and third-party dependencies. Annus Mirabilis prioritizes semantic KaTeX MathML, accessible screen-reader tables, and tactile text alternatives.
7. **Patent Search Wizards & Discovery Reports:**
   - Files: `src/components/patents/PatentWizard.tsx`, automated wizard summary generators.
   - Reason: Discovery is an editorial pedagogical journey through 1904 scientific dilemmas, not a product wizard.
8. **Generic or Wright-Default Visual Dispatch:**
   - Files: `src/components/patents/visuals/index.ts`, `src/components/patents/PatentVisualDispatcher.tsx`.
   - Reason: In Classic Patents, unmapped patents fall back to a default visualizer (often the Wright Flyer). In Annus Mirabilis, unknown or unmapped experiment IDs must **fail closed** with an explicit typed refusal (`outside-domain` or `not-applicable`), never rendering an inaccurate physical model.

### 6.2 FrankenPatents iPhone App Seams (App Plan §2.4)

The FrankenPatents native iOS application in `classic-patents.com:ios/` establishes key architectural patterns for the Annus Mirabilis native app (`am-ep-app-m247`). Each seam has been verified against commit `da11ff475902728fd8dd1d9db9f3af37c16ec8a5` and evaluated:

| Donor App Seam / Verified Path | Decision | Adaptation in Annus Mirabilis (`ios/`) | Extracting Bead |
|---|---|---|---|
| **XcodeGen Project Spec**<br>`ios/project.yml` | **Copy pattern** | XcodeGen specification for declarative Xcode project generation; includes `regenerate-and-diff` CI check to prevent project drift | `am-app-xcodegen-scaffold-z228` |
| **Static Edition Exporters**<br>`ios/export-patents.ts`<br>`ios/export-native-models.ts` | **Adapt pattern** | Build-time script exporting compiled static edition HTML, MathML, and JSON assets into the Xcode app bundle for offline reading | `am-app-edition-export-kwpu` |
| **Native Parity Checker**<br>`ios/check-native-parity.ts` | **Do not port** | The FrankenPatents app asserted text substring equality across native and web parsers. Annus Mirabilis embeds the compiled web edition directly in WKWebView, guaranteeing 100% mathematical and typographic parity by design | None (Excluded) |
| **Facsimile PDF Downloader**<br>`ios/Sources/PatentPDFReader.swift` | **Adapt pattern** | On-demand background PDF download manager implementing: host allowlist, ephemeral `URLSessionConfiguration`, 50MB size limit, PDF magic-byte header validation, SHA-256 integrity pin check, atomic disk publish, and exclusion from iCloud backups (`isExcludedFromBackupKey`) | `am-app-facsimile-downloads-72nz` |
| **Apple Privacy Manifest**<br>`ios/Sources/PrivacyInfo.xcprivacy` | **Copy pattern** | Native Apple privacy manifest declaring `NSPrivacyTracking = false`, empty collected data categories, and no third-party tracking domains | `am-app-xcodegen-scaffold-z228` |
| **App Store Screenshot Tests**<br>`ios/UITests/FrankenPatentsUITests.swift` | **Adapt pattern** | XCUITest suite using DEBUG launch arguments (`--reset-state`, `--skip-animations`) to deterministically drive UI flows and capture localized App Store screenshots | `am-app-e2e-journeys-vm0t` |
| **Apple Quality Gate Script**<br>`scripts/dsr-apple-quality.sh` | **Adapt pattern** | Shell gate running XcodeGen diff validation, SwiftFormat, SwiftLint, Xcode build verification, and test execution | `am-app-xcodegen-scaffold-z228` |
| **Native Math Parser**<br>`ios/Sources/NativeMathView.swift` | **Do not port** | FrankenPatents attempted native regex-based LaTeX parsing in SwiftUI. Annus Mirabilis renders KaTeX HTML + MathML inside WKWebView with full fidelity | None (Excluded) |
| **Native SceneKit Tab**<br>`ios/Sources/NativePatentSceneView.swift` | **Do not port** | Native SceneKit simulation view. Annus Mirabilis renders WebGL/Three.js/Canvas instruments directly inside WKWebView | None (Excluded) |
| **Hand-Typed Native Theme**<br>`ios/Sources/Theme.swift` | **Do not port** | Hardcoded Swift color/font constants. Annus Mirabilis exports CSS design tokens to Swift generated structs at build time | None (Excluded) |

---

## 7. Discrepancies

The following discrepancies between master plan prose and the pinned codebase were identified during audit inspection. Each discrepancy has been recorded as an explicit comment on its affected bead in the task tracker.

### Discrepancy 7.1: React Three Fiber vs Direct Three.js
- **Plan Statement:** Early architectural descriptions mentioned React Three Fiber (`@react-three/fiber`) as a possible visualizer dependency.
- **Code Fact:** `classic-patents.com:package.json` declares direct `three` (`^0.185.1`) and `@types/three` (`^0.185.4`). Neither `@react-three/fiber` nor `@react-three/drei` is declared or installed.
- **Evidence:** `src/components/patents/visuals/three/ThreeStudioScene.ts` implements imperative Three.js scene graphs, render loops, and WebGL canvas mounting directly.
- **Affected Beads:** `am-scaf-extract-ui-components-c31`, `am-gov-decision-stack-versions-6ax`.
- **Resolution:** Annus Mirabilis locks direct Three.js and Canvas/SVG, avoiding React Three Fiber overhead.

### Discrepancy 7.2: UI Component Directory Paths
- **Plan Statement:** Plan §2.3 listed `ColorizedEquation.tsx`, `LatexRenderer.tsx`, `colorPalette.ts`, and `equationValueFormatting.ts` without a subfolder, implying `src/components/`.
- **Code Fact:** These files reside in `src/components/ui/`, not `src/components/`.
- **Evidence:** Verified by path lookup at `da11ff475902728fd8dd1d9db9f3af37c16ec8a5`:
  - `src/components/ui/ColorizedEquation.tsx`
  - `src/components/ui/LatexRenderer.tsx`
  - `src/components/ui/colorPalette.ts`
  - `src/components/ui/equationValueFormatting.ts`
- **Affected Bead:** `am-scaf-extract-ui-components-c31`.
- **Resolution:** Updated in Section 5 reuse table; extraction bead will extract directly from `src/components/ui/`.

### Discrepancy 7.3: FrankenSim `fs-lattice` Domain Semantics
- **Plan Statement:** In the context of Brownian motion and atomic modeling, the name `fs-lattice` might suggest crystalline lattice models or solid-state physics.
- **Code Fact:** In `frankensim:crates/fs-lattice`, the crate implements 3D additive manufacturing infill optimization (TPMS gyroids, strut lattices, porosity gradients for CNC/3D printing). It does not model physics lattices or atomic crystal scattering.
- **Evidence:** `crates/fs-lattice/Cargo.toml` description: `"Lattice infill optimization and strut topology generation"`.
- **Affected Bead:** `am-fs-capability-audit-byc`.
- **Resolution:** Annus Mirabilis must not rely on `fs-lattice` for physical atom/molecular simulations; Brownian motion will use direct stochastic particles (`fs-rand`) and 1D diffusion kernels (`fs-sparse`).

### Discrepancy 7.4: FrankenSim `fs-flux` Domain Semantics
- **Plan Statement:** In the context of the light-quanta paper, `fs-flux` might suggest radiative energy flux calculations.
- **Code Fact:** `crates/fs-flux` is a fluid mechanics crate modeling Navier-Stokes flow, boundary-layer flux balance, and finite volume solvers.
- **Evidence:** `crates/fs-flux/Cargo.toml` description: `"Navier-Stokes and Euler finite-volume fluid dynamics"`.
- **Affected Bead:** `am-fs-capability-audit-byc`.
- **Resolution:** Radiation entropy and spectral distributions will be implemented via dedicated reference models or new upstream FrankenSim exports, not `fs-flux`.

### Discrepancy 7.5: Vercel CLI `vercel curl` Subcommand Existence
- **Plan Statement:** Planning review questioned whether `vercel curl` was a supported command in standard release automation.
- **Code Fact:** `scripts/verified-production-deploy.ts:294` actively relies on `vercel curl --deployment <d> <path>` to probe protected prebuilt deployments before alias promotion.
- **Evidence:** `scripts/verified-production-deploy.ts` lines 290–305 implement `assertProtectedPreviewResponse` using `vercel curl`.
- **Affected Bead:** `am-rel-verified-deploy-qndt`.
- **Resolution:** Recorded for `am-gov-decision-stack-versions-6ax` to ensure the locked Vercel CLI version includes the `vercel curl` subcommand.

### Discrepancy 7.6: Bun Test Per-File Isolation Mechanism
- **Plan Statement:** Plan noted the requirement for per-file test isolation, querying whether the donor used an external wrapper script or runner flag.
- **Code Fact:** The donor uses Bun native `--isolate` flag directly in `package.json:15`: `"test": "bun test --isolate --timeout 60000"`.
- **Evidence:** `package.json:15` confirmed.
- **Affected Bead:** `am-gov-decision-stack-versions-6ax`.
- **Resolution:** Annus Mirabilis adopts `"bun test --isolate"` as standard test command.

### Discrepancy 7.7: Donor Facsimile Directory Path

- **Plan Claim:** Plan §2.3, carried into the section 5 reuse table, names `public/patents/facsimiles/` as the donor facsimile directory.
- **Code Fact:** That path does not exist at the pinned revision. `git ls-tree --name-only da11ff475902728fd8dd1d9db9f3af37c16ec8a5 public/patents/` returns `facsimile-pages`, `fig-8-source-crop-v3.png`, `fig-9-source-crop-v3.png`, `figures`, `pdfs`, `source-text`, and `transcripts`. There is no `facsimiles` entry, and `git cat-file -t da11ff475902728fd8dd1d9db9f3af37c16ec8a5:public/patents/facsimiles` independently reports the path absent.
- **Evidence:** The real directory is `public/patents/facsimile-pages/`, which holds 103 files at the pinned revision. An earlier revision of this entry said 109; that count came from a `grep -ic facsimile` sweep that counted directory entries alongside files, and is retracted here rather than quietly overwritten. Four independent counters agree on 103: `git ls-tree -r --name-only`, a `blob`-type filter, a `.webp` suffix filter, and `ls-files`. The `-r -t` listing returns 209, which is 103 blobs plus 103 per-patent directories plus the `facsimile-pages` tree itself.
- **Affected Beads:** `am-read-facsimile-face-er0`, `am-bm-slice-e2e-sbqu`.
- **Resolution:** Section 5 now states the corrected path, which the bead permits in place of existence. Any extraction reading donor facsimile page images must use `public/patents/facsimile-pages/`. This was the one path of the 62 cited in the reuse table that did not resolve.

### Discrepancy 7.8: Recorded Extent of the OpenAI/Anthropic Rider

- **Document Claim:** Section 9.1 of this audit placed the rider at lines 12 to 54 of `classic-patents.com:LICENSE`.
- **Code Fact:** Line 54 falls mid-sentence (`extent permitted by applicable law, the prevailing party in any action to`). Rider content continues through the `"Affiliate"` definition, which is explicitly scoped "For purposes of this rider" and closes at line 62. The MIT boilerplate resumes at line 64 with `The above copyright notice and this permission notice shall be included in all`, and the file is 73 lines.
- **Evidence:** `git -C /Users/jemanuel/projects/classic-patents.com show da11ff475902728fd8dd1d9db9f3af37c16ec8a5:LICENSE | sed -n '48,73p'`.
- **Affected Bead:** `am-gov-license-inventory-w6yz`.
- **Resolution:** Section 9.1 corrected to lines 12 to 62. The range matters because copying only lines 12 to 54 would carry 43 of the rider's 51 lines and silently drop the `"Affiliate"` definition on which the rider's scope depends. The license inventory gate must preserve the full rider.

---

## 8. Re-Audit Policy

As both donor repositories (`classic-patents.com` and `frankensim`) are actively developed, adopting a newer revision is a deliberate, governed process that must never occur silently or partially.

### 8.1 Re-Audit Procedure

When proposing to advance either pinned revision:

1. **File Reservation:** The adopting agent must acquire an exclusive file reservation for `docs/DONOR_AUDIT.md` via Agent Mail (`am file_reservations reserve <project> <agent> docs/DONOR_AUDIT.md --exclusive`).
2. **Commit Resolution & Date Stamping:** Verify the candidate commit object using `git cat-file -e <hash>^{commit}` and record its exact UTC/local commit date, author, and commit message.
3. **Ancestry Determination:** Determine the exact topological relationship to the prior pinned commit:
   ```bash
   git -C <repo> merge-base --is-ancestor <old-pin> <new-pin>
   ```
   Confirm that `<old-pin>` is a strict ancestor of `<new-pin>`. If the branches have diverged, document the divergence and common merge-base explicitly.
4. **Targeted Crate/Directory Diff Analysis:**
   - For `frankensim`: Run `git diff --stat <old-pin> <new-pin> -- crates/fs-wasm crates/fs-rand crates/fs-qty crates/fs-sparse crates/fs-demo-physics-wasm` (and any new crates considered for export).
   - For `classic-patents.com`: Run `git diff --stat <old-pin> <new-pin> -- src/components/ui src/physics scripts/ ios/`.
   Save the diff stat and commit list to `artifacts/donor-audit/<tool-run-id>/diff-<new-pin>.txt`.
5. **Automated Re-Audit Run:** Execute the donor verification tool:
   ```bash
   bun scripts/donor-audit.ts
   ```
   This script re-verifies path existence, scans for forbidden identity strings, and checks that fact line numbers remain valid.
6. **Fact Table Mutation:** Any fact whose line numbers or implementation changed must be updated to `changed` status with both the old and new readings cited. Never silently overwrite a previous finding.
7. **Regression Test Gate:** Execute the audit test suite:
   ```bash
   bun test scripts/donor-audit/
   bun test src/testing/extractionInventory.test.ts
   ```
8. **Downstream Bead Notification:** Post an update comment (`br comments add <bead> "..."`) to all blocked or dependent beads (`am-fs-capability-audit-byc`, `am-scaf-extract-*`) detailing the revision bump and highlighting any `changed` verdicts.

---

## 9. Attribution Header Template

All source files extracted from `classic-patents.com` must preserve full copyright attribution and include the exact OpenAI/Anthropic Rider condition.

### 9.1 Donor License Receipt

- **Donor License Path:** `classic-patents.com:LICENSE`
- **Donor License SHA-256:** `32a82e0a5754e72e51fae44b65a936c831c07376f21c90f5fb9e76897fcc3509`
- **Rider Location:** Lines 12–62 of `classic-patents.com:LICENSE` (`ADDITIONAL RIDER / RESTRICTION (OpenAI / Anthropic)`). Line 12 opens the rider heading; line 62 closes the `"Affiliate"` definition that is explicitly scoped "For purposes of this rider". The MIT boilerplate resumes at line 64, and the file is 73 lines.
- **Rider Terms:** Prohibits use, copying, benchmarking, evaluation, testing, or ingestion into training datasets or automated pipelines by OpenAI, L.L.C., Anthropic, PBC, or their affiliates without express prior written permission. Preserved unmodified in `annus-mirabilis.com:LICENSE`.

### 9.2 Mandatory Source File Header Template

Every extracted TypeScript, TSX, JavaScript, or CSS file must begin with this exact comment block before any imports or executable code:

```typescript
/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: <donor-path>
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - <brief bulleted list of changes made during extraction>
 */
```

### 9.3 Special File Format Rules

1. **Non-Commentable Formats (JSON, YAML, Markdown, Binary Assets):**
   - Files that do not support comment blocks must not have syntax altered to force a comment.
   - Their attribution, donor source path, pinned commit, and modifications must be recorded in Section 11 of this document and in `NOTICE.md`.
2. **Vendored Third-Party Dependencies (`public/pdfjs/`):**
   - Third-party files vendored by the donor (e.g. Mozilla pdf.js worker `pdf.worker.min.mjs`, Apache-2.0; `jbig2.wasm`; `openjpeg.wasm`) keep their upstream license notices and licenses intact under `public/pdfjs/wasm/`.
   - Do **not** apply the donor MIT header to upstream third-party code.
3. **Enforcement Gate:**
   - `am-gov-license-inventory-w6yz` enforces that every extracted file matches this template and verifies the presence of required license notices across `src/` and `public/`.

## 10. Donor Identities That Must Never Be Copied

This document provides the authoritative Section 10 inventory of donor identity strings, infrastructure parameters, route patterns, and third-party origins from `classic-patents.com` at pinned revision `da11ff475902728fd8dd1d9db9f3af37c16ec8a5`.

Every entry is verified against the pinned donor tree via read-only `git grep` inspection. Each string is accompanied by the exact command executed and its actual terminal output, establishing whether the string is **FOUND** (with file path and line number) or **NOT PRESENT** in the codebase.

The list holds two kinds of entry, and the difference matters to whoever implements the hygiene scan:

- **Found in the donor tree.** Seventeen of the twenty strings below appear at the pinned revision with a cited path and line. A scan for one of these tests something that demonstrably exists in the donor.
- **Forbidden although absent from the donor tree.** Three do not appear at the pinned revision: `45267`, because the donor spells the port `45_267` with a numeric separator (see 10.4), and `fonts.googleapis.com` and `fonts.gstatic.com`, because the donor never writes those literals; it imports `next/font/google`, which contacts those origins at build time (see 10.6). They remain on the list because they are forbidden in this repository, not because they were found in the donor. Each was verified absent with `git grep -F -e <string> da11ff475902728fd8dd1d9db9f3af37c16ec8a5`, which returned zero matches.

These strings form the input for automated hygiene and gate scans in `am-scaf-extract-scripts-7jm`, `am-scaf-extract-ui-components-c31`, and `am-rel-verified-deploy-qndt`.

---

### 10.1 Master Fenced List of Exact Forbidden Strings

The following exact strings must **never** be copied into, imported by, or referenced within `annus-mirabilis.com`:

```text
classic-patents.com
www.classic-patents.com
classic-patents.vercel.app
prj_eeVw8BqcY9iO2e0VEQyS5i6rZkE0
classic-patents
team_F5Q3EH8Qxu3nDEOyEZLcQPe6
45_267
45267
/patents/us-821393-wright-flyer
/patents/us-4063220-metcalfe-ethernet
/patents/
https://github.com/Dicklesworthstone/classic-patents.com
https://github.com/Dicklesworthstone
https://schema.org
fonts.googleapis.com
fonts.gstatic.com
patents.google.com
https://patents.google.com
https://openapi.vercel.sh
https://solidmechanics.org
```

---

### 10.2 Donor Domain & Hostname Identities

#### 1. `classic-patents.com`
- **Verdict:** `FOUND`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "classic-patents.com" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- scripts/verified-production-deploy.ts scripts/deployment-target.ts scripts/deployment-verification.ts src/app/layout.tsx src/app/robots.ts src/app/sitemap.ts src/components/layout/Header.tsx src/components/layout/Footer.tsx
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-target.ts:15:  customDomains: ["classic-patents.com", "www.classic-patents.com"] as const,
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:19:  "classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:20:  "www.classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:75: * canonical production project that owns classic-patents.com.
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:106:        `Duplicate projects (such as 'classic-patents.com') do not own the production domain alias and will cause silent deployment divergence.`,
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/verified-production-deploy.ts:25:const PUBLIC_HOSTNAMES = ["classic-patents.com", "www.classic-patents.com"] as const;
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/layout.tsx:38:  metadataBase: new URL("https://classic-patents.com"),
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/layout.tsx:74:    url: "https://classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/layout.tsx:125:              url: "https://classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/layout.tsx:131:                url: "https://classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/robots.ts:11:    sitemap: "https://classic-patents.com/sitemap.xml",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/sitemap.ts:7:  const baseUrl = "https://classic-patents.com";
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/components/layout/Footer.tsx:102:                  href="https://github.com/Dicklesworthstone/classic-patents.com"
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/components/layout/Header.tsx:169:              href="https://github.com/Dicklesworthstone/classic-patents.com"
  ```
- **Replacement in Annus Mirabilis:** Must be replaced with `annus-mirabilis.com`.

---

#### 2. `www.classic-patents.com`
- **Verdict:** `FOUND`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "www.classic-patents.com" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- scripts/
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-target.test.ts:62:    ╶ https://www.classic-patents.com
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-target.test.ts:104:    expect(parsed.aliases).toContain("www.classic-patents.com");
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-target.test.ts:110:      "www.classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-target.test.ts:119:        "www.classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-target.ts:15:  customDomains: ["classic-patents.com", "www.classic-patents.com"] as const,
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.test.ts:87:        "https://www.classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:20:  "www.classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/verified-production-deploy.ts:25:const PUBLIC_HOSTNAMES = ["classic-patents.com", "www.classic-patents.com"] as const;
  ```
- **Replacement in Annus Mirabilis:** Must be replaced with `www.annus-mirabilis.com`.

---

#### 3. `classic-patents.vercel.app`
- **Verdict:** `FOUND`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "classic-patents.vercel.app" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- scripts/
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-target.test.ts:63:    ╶ https://classic-patents.vercel.app
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-target.ts:16:  platformDomain: "classic-patents.vercel.app" as const,
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.test.ts:103:      const missingWww = ["classic-patents.com", "classic-patents.vercel.app"];
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:22:export const CANONICAL_PLATFORM_HOSTNAME = "classic-patents.vercel.app";
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/verified-production-deploy.ts:26:const PLATFORM_HOSTNAME = "classic-patents.vercel.app";
  ```
- **Replacement in Annus Mirabilis:** Must be replaced with `annus-mirabilis-seven.vercel.app` (or current canonical platform hostname).

---

### 10.3 Donor Vercel Project & Team Identifiers

#### 4. Vercel `projectId`: `prj_eeVw8BqcY9iO2e0VEQyS5i6rZkE0`
- **Verdict:** `FOUND`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "prj_eeVw8BqcY9iO2e0VEQyS5i6rZkE0" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- scripts/
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-target.ts:12:  projectId: "prj_eeVw8BqcY9iO2e0VEQyS5i6rZkE0",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:14:export const CANONICAL_VERCEL_PROJECT_ID = "prj_eeVw8BqcY9iO2e0VEQyS5i6rZkE0";
  ```
- **Replacement in Annus Mirabilis:** Must be replaced with Annus Mirabilis Vercel project ID (`am-rel-vercel-setup-ituk`).

---

#### 5. Vercel `projectName`: `classic-patents`
- **Verdict:** `FOUND`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "CANONICAL_VERCEL_PROJECT_NAME" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- scripts/
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.test.ts:9:  CANONICAL_VERCEL_PROJECT_NAME,
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.test.ts:21:        projectName: CANONICAL_VERCEL_PROJECT_NAME,
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.test.ts:26:      expect(parsed.projectName).toBe(CANONICAL_VERCEL_PROJECT_NAME);
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.test.ts:44:        projectName: CANONICAL_VERCEL_PROJECT_NAME,
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.test.ts:55:        projectName: CANONICAL_VERCEL_PROJECT_NAME,
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.test.ts:71:      expect(config.projectName).toBe(CANONICAL_VERCEL_PROJECT_NAME);
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:16:export const CANONICAL_VERCEL_PROJECT_NAME = "classic-patents";
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:103:  if (raw.projectName !== CANONICAL_VERCEL_PROJECT_NAME) {
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:105:      `Incorrect Vercel projectName: expected '${CANONICAL_VERCEL_PROJECT_NAME}', found '${raw.projectName}'. ` +
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:137:      `Missing .vercel/project.json at ${filePath}. Link the repository to the canonical '${CANONICAL_VERCEL_PROJECT_NAME}' project before deploying.`,
  ```
- **Replacement in Annus Mirabilis:** Must be replaced with `"annus-mirabilis"`.

---

#### 6. Vercel `orgId`: `team_F5Q3EH8Qxu3nDEOyEZLcQPe6`
- **Verdict:** `FOUND`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "team_F5Q3EH8Qxu3nDEOyEZLcQPe6" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- scripts/
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-target.ts:14:  orgId: "team_F5Q3EH8Qxu3nDEOyEZLcQPe6",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-verification.ts:15:export const CANONICAL_VERCEL_ORG_ID = "team_F5Q3EH8Qxu3nDEOyEZLcQPe6";
  ```
- **Replacement in Annus Mirabilis:** Must be replaced with the team/org ID owning `annus-mirabilis`.

---

### 10.4 Donor Deployment Lock Port

#### 7. Deployment Lock Port: `45_267` and `45267`
- **Code Form (`45_267`):** `FOUND`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "DEPLOYMENT_LOCK_PORT" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- scripts/
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/verified-production-deploy.ts:24:const DEPLOYMENT_LOCK_PORT = 45_267;
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/verified-production-deploy.ts:346:    server.listen({ host: "127.0.0.1", port: DEPLOYMENT_LOCK_PORT, exclusive: true }, resolve);
  ```
- **Planning Prose Form (`45267`):** `NOT PRESENT` in scripts/src
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "45267" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- scripts/ src/
  ```
- **Actual Output:** (Exit code 1, zero matches in `scripts/` or `src/`).
- **Replacement in Annus Mirabilis:** Annus Mirabilis uses a distinct local mutex socket port (such as `45_268` or project-specific port) to prevent cross-repository deployment lock collision when both projects deploy concurrently. Both `45_267` and `45267` are forbidden.

---

### 10.5 Patent Route Patterns Used by Donor Checks

#### 8. Wright Detail Page Route: `/patents/us-821393-wright-flyer`
- **Verdict:** `FOUND`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "WRIGHT_ROUTE" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- scripts/
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/verified-production-deploy.ts:28:const WRIGHT_ROUTE = "/patents/us-821393-wright-flyer";
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/verified-production-deploy.ts:319:  await assertResponse(url, WRIGHT_ROUTE, WRIGHT_ARCHIVAL_TEXT_LABEL);
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/verified-production-deploy.ts:324:  assertProtectedPreviewResponse(deployment, WRIGHT_ROUTE, WRIGHT_ARCHIVAL_TEXT_LABEL);
  ```
- **Replacement in Annus Mirabilis:** Replaced by Brownian motion vertical slice route `/brownian-motion` (or section permalinks).

---

#### 9. Complete Source-Text Endpoint: `/patents/us-4063220-metcalfe-ethernet`
- **Verdict:** `FOUND`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "COMPLETE_SOURCE_DELIVERY_ROUTE" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- scripts/
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/verified-production-deploy.ts:30:const COMPLETE_SOURCE_DELIVERY_ROUTE = "/patents/us-4063220-metcalfe-ethernet";
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/verified-production-deploy.ts:320:  await assertResponse(url, COMPLETE_SOURCE_DELIVERY_ROUTE, COMPLETE_SOURCE_DELIVERY_MARKER);
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/verified-production-deploy.ts:327:    COMPLETE_SOURCE_DELIVERY_ROUTE,
  ```
- **Replacement in Annus Mirabilis:** Replaced by complete paper source delivery routes (e.g. `/brownian-motion`, `/light-quanta`).

---

#### 10. General Patent Route Pattern: `/patents/` (`/patents/${patent.id}`)
- **Verdict:** `FOUND`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "route: \`/patents/" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- scripts/
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/deployment-target.ts:201:      route: `/patents/${patent.id}`,
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/e2e-threejs-visual-audit.ts:716:      route: `/patents/${patentId}`,
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/e2e-threejs-visual-audit.ts:5003:          route: `/patents/${distribution.patentId}`,
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:scripts/patent-e2e-contract.ts:192:      route: `/patents/${patent.id}`,
  ```
- **Additional Specific Patent Routes Checked in Donor Visual Sweeps:**
  - `/patents/us-381968-tesla-motor` (`scripts/e2e-visual-audit.ts:45`)
  - `/patents/us-223898-edison-lightbulb` (`scripts/e2e-visual-audit.ts:46`)
  - `/patents/us-2708656-fermi-reactor` (`scripts/e2e-visual-audit.ts:47`)
  - `/patents/us-4136359-wozniak-apple` (`scripts/e2e-visual-audit.ts:48`)
  - `/patents/us-3541541-engelbart-mouse` (`scripts/e2e-visual-audit.ts:49`)
  - `/patents/us-1781541-einstein-refrigerator` (`scripts/e2e-visual-audit.ts:50`)
- **Asset Routes:**
  - `/patents/pdfs/` (`scripts/patent-e2e-contract.ts:169`)
  - `/patents/figures/` (`scripts/patent-e2e-contract.test.ts:51`)
- **Replacement in Annus Mirabilis:** Annus Mirabilis uses paper slugs: `/light-quanta`, `/brownian-motion`, `/special-relativity`, `/mass-energy`, `/molecular-dimensions`, and `/facsimiles/`.

---

### 10.6 Third-Party Origins & Ingestion Vectors

#### 11. Layout & Chrome HTTPS Literals
- **Verdict:** `FOUND` (external origin literals in metadata and footer)
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "https://" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- src/app/layout.tsx src/components/layout/
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/layout.tsx:38:  metadataBase: new URL("https://classic-patents.com"),
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/layout.tsx:69:  authors: [{ name: "Jeffrey Emanuel", url: "https://github.com/Dicklesworthstone" }],
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/layout.tsx:74:    url: "https://classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/layout.tsx:122:              "@context": "https://schema.org",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/layout.tsx:125:              url: "https://classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/layout.tsx:131:                url: "https://classic-patents.com",
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/components/layout/Footer.tsx:102:                  href="https://github.com/Dicklesworthstone/classic-patents.com"
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/components/layout/Header.tsx:169:              href="https://github.com/Dicklesworthstone/classic-patents.com"
  ```
- **Forbidden Third-Party Origins Identified:**
  - `https://github.com/Dicklesworthstone/classic-patents.com` (`github.com`)
  - `https://github.com/Dicklesworthstone` (`github.com`)
  - `https://schema.org` (`schema.org`)
- **Hygiene Action:** `Header.tsx` and `Footer.tsx` repository links must point to `https://github.com/Dicklesworthstone/annus-mirabilis.com`.

---

#### 12. Remote Google Fonts Origin (`next/font/google`)
- **Verdict:** `FOUND`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "next/font/google" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- src/app/layout.tsx
  ```
- **Actual Output:**
  ```text
  da11ff475902728fd8dd1d9db9f3af37c16ec8a5:src/app/layout.tsx:2:import { JetBrains_Mono, Newsreader, Plus_Jakarta_Sans } from "next/font/google";
  ```
- **Third-Party Origins Contacted:** these are origins the build reaches through `next/font/google`, not literals present in the donor tree. Both were checked separately and neither appears at the pinned revision:
  - `fonts.googleapis.com`: `NOT PRESENT` as a literal. `git grep -F -e fonts.googleapis.com da11ff475902728fd8dd1d9db9f3af37c16ec8a5` returned zero matches.
  - `fonts.gstatic.com`: `NOT PRESENT` as a literal. `git grep -F -e fonts.gstatic.com da11ff475902728fd8dd1d9db9f3af37c16ec8a5` returned zero matches.
- **Hygiene Action:** AGENTS.md policy strictly forbids remote fonts. Fonts must be self-hosted WOFF2 files in `public/fonts/` loaded via local CSS `@font-face` rules. Both Google font origins are forbidden.

---

#### 13. `next/script`
- **Verdict:** `NOT PRESENT`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "next/script" da11ff475902728fd8dd1d9db9f3af37c16ec8a5
  ```
- **Actual Output:** (Exit code 1, zero matches across repository).
- **Hygiene Action:** Zero `<Script>` tags exist in the donor. No script tags may be added.

---

#### 14. Analytics Package Imports
- **Verdict:** `NOT PRESENT`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n -E "from ['\"](@vercel/analytics|@vercel/speed-insights|plausible|posthog-js|mixpanel-browser)" da11ff475902728fd8dd1d9db9f3af37c16ec8a5
  ```
- **Actual Output:** (Exit code 1, zero matches across repository).
- **Hygiene Action:** No tracking or telemetry SDKs exist in the donor. Third-party analytics are strictly prohibited by AGENTS.md.

---

#### 15. `fetch(` in Open Graph and Image Routes
- **Verdict:** `NOT PRESENT`
- **Command:**
  ```bash
  git -C /Users/jemanuel/projects/classic-patents.com grep -n "fetch(" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- src/app/opengraph-image.tsx src/app/twitter-image.tsx "src/app/patents/[id]/opengraph-image.tsx" "src/app/patents/[id]/twitter-image.tsx"
  ```
- **Actual Output:** (Exit code 1, zero matches across all 4 image route files).
- **Hygiene Action:** Image routes generate static SVG/CSS graphics with `export const dynamic = "force-static"`. No external runtime fetches exist or may be introduced.

---

#### 16. Additional External HTTPS Origins in Records & Schemas
- **`https://patents.google.com`**
  - **Verdict:** `FOUND`
  - **Command:** `git -C /Users/jemanuel/projects/classic-patents.com grep -n "https://patents.google.com" da11ff475902728fd8dd1d9db9f3af37c16ec8a5 -- src/data/patents/`
  - **Matches:** Present across 38 patent records (e.g. `src/data/patents/wright-flyer.ts:37`).
  - **Hygiene Rule:** Out of scope for Annus Mirabilis; scientific citations link to *Annalen der Physik* references.
- **`https://openapi.vercel.sh`**
  - **Verdict:** `FOUND`
  - **Command:** `git -C /Users/jemanuel/projects/classic-patents.com grep -n "https://openapi.vercel.sh" da11ff475902728fd8dd1d9db9f3af37c16ec8a5`
  - **Match:** `vercel.json:2:  "$schema": "https://openapi.vercel.sh/vercel.json",`
- **`https://solidmechanics.org`**
  - **Verdict:** `FOUND`
  - **Command:** `git -C /Users/jemanuel/projects/classic-patents.com grep -n "https://solidmechanics.org" da11ff475902728fd8dd1d9db9f3af37c16ec8a5`
  - **Match:** `src/physics/catalogKernels.ts:3144:  // https://solidmechanics.org/Text/Chapter3_5/Chapter3_5.php`

---

## 11. Extracted Files

This is the extraction inventory. **It is empty by design.** At the time of writing, zero donor
files have been extracted into this repository. Rows are appended by each extracting bead as a file
actually lands, never in advance. A row written before its file exists is a claim, not a record, and
this section exists to keep the difference visible.

Each extracting bead owns its own subsection below, so parallel beads append to their own table
instead of editing one shared table at once.

### 11.1 Row format

Every row carries five fields plus a batch, a commit, a notice form, and notes:

| Field | Meaning |
|---|---|
| `sourcePath` | The donor path at the pinned revision, exactly as `git show <hash>:<path>` names it |
| `newOwner` | The destination path in this repository **and** the bead id that owns it from then on |
| `retainedBehavior` | One line naming the behavior this project is deliberately keeping, the reason the file was worth extracting at all |
| `removedAssumptions` | The patent-specific assumptions stripped during extraction, named individually. An empty list is a claim that the file had none, and is checked in review, never defaulted |
| `firstReaderJourney` | The bead id and spec path of the first browser acceptance journey that exercises this file with real reader actions, plus the assertion inside it that would fail if the file were broken |
| `batch` | `1` or `2`, per section 11.2 |
| `commit` | The commit that introduced the extracted file here |
| `noticeForm` | `header` for files that carry the section 9 comment block, or `NOTICE.md` for formats that cannot carry comments |
| `notes` | Anything a later reader needs, including `legacy` marking |

Rules that govern this table:

1. `firstReaderJourney` is the field that does the work. A file with no journey is a file nobody can
prove is used, and that is the state in which donor code quietly rots in a fork.
2. A row whose `firstReaderJourney` names a bead or spec path that does not exist is recorded as
`pending: <bead id>`, naming the bead that will create it. **An extracting bead may not be closed
while any of its rows is `pending`.**
3. `removedAssumptions` is present on every row. An empty list is written explicitly and confirmed in
review; it is never left blank.
4. A file present in this repository carrying a section 9 attribution header that names a donor path,
with no row in this inventory, **fails the hygiene scan with the path named**.
5. A batch 2 file extracted early is marked `legacy` in notes and may not be imported from
`src/app`, `src/reader`, or a content route.

#### 11.1.1 Worked `firstReaderJourney` values (guidance, not inventory rows)

These are the intended journeys for the seams section 5 already names. They are recorded here so the
owning bead does not have to invent one, and they become rows only when the file lands:

- `src/components/ui/LatexRenderer.tsx` to `am-bm-slice-e2e-sbqu`, the Brownian sections 4 to 5
journey, at the step that renders a displayed equation on the reading face.
- `src/components/patents/PinnedPdfFacsimile.tsx` and `public/pdfjs` to `am-read-facsimile-face-er0`,
at the step that opens a page and lands on a section from the page map.
- `src/physics/controlTape.ts`, `tickScheduler.ts`, `transport.ts` to `am-bm-slice-e2e-sbqu`, at the
step that replays the teaching tape `einstein-0-8-micron` from a permalink.
- `src/physics/coverageManifest.ts` to `am-cm-coverage-ledger-0ip`, at the assertion that the donor's
three provenance states remain distinct.
- `src/physics/specClauses.ts` to `am-read-result-weave-jex`, at the `bm01-s5-distribution-agreement`
assertion.
- `scripts/verified-production-deploy.ts` and its helpers to `am-rel-candidate-checks-kc7y`, at the
candidate check against deployed, unpromoted assets.
- The chrome, theme toggle, command palette, Open Graph route, and error boundaries to
`am-scaf-extract-ui-components-c31`, in its own browser spec on the empty site.

### 11.2 The two ordered extraction batches

The ordering is a real constraint, not a preference:

- **Batch 1** may land before the new semantic identities exist: typography tokens, the restricted
mathematics-rendering approach (the KaTeX trust callback), selected ordinary controls, the
source-facsimile interaction patterns, and the candidate-release discipline.
- **Batch 2** lands only after the new identities are defined: equation term selection and
source-to-explanation alignment. Their owners are `am-eq-expression-tree-8kl` (term and operation
ids, canonical quantity bindings), `am-not-quantity-registry-2f7` (canonical quantity ids), and
`am-cm-id-scheme-8bn` (content ids and anchors).

### 11.3 Redesign inputs, listed with no destination path

These four are **never copy-and-rename**. They informed a redesign and are not extracted. A row that
gives any of them a destination path fails the hygiene scan.

| Redesign input | Donor location | Why it is not extracted | Who builds the replacement |
|---|---|---|---|
| Physics state bus | `src/physics/usePatentPhysics.ts` | Keeps module-global maps keyed by patent id and increments a control-change tick that is a UI event count, not a solver step | `am-rt-snapshot-store-aft` builds instance-scoped experiments with one immutable snapshot per revision |
| Dual projection viewer, as a component | `src/components/patents/DualProjectionViewer.tsx` | A monolith; only its interaction ideas survive | `am-read-bilingual-faces-pao` builds a shell with independently loaded panels |
| Aggregate catalogue registries | `colorizedEquations.ts` (the roughly 976 KB all-patents record) and the all-patents catalogue | An aggregate record that must never enter the client bundle wholesale; the donor itself already passes server-resolved per-patent data instead | Per-record server resolution, never an aggregate import |
| Generic or Wright-default visual dispatch | The donor's unmapped-patent fallback visualizer | An unmapped id must fail closed with a typed refusal (`outside-domain` or `not-applicable`), never render a plausible wrong model. See section 6.1 item 8 | Typed refusal path, no default visualizer |

### 11.4 Files deliberately left behind

Recorded with reasons in section 6 rather than duplicated here:

- Section 6.1, items 1 through 8: patent claims and claim trees, infringement disputes, patent
classification systems and citation lineages, the era filter bar, broadside printing mode, the audio
narration player, patent search wizards and discovery reports, and the generic or Wright-default
visual dispatch.
- Section 6.2, the four seams marked **Do not port**: the native parity checker
(`ios/check-native-parity.ts`), the native math parser (`ios/Sources/NativeMathView.swift`), the
native SceneKit tab (`ios/Sources/NativePatentSceneView.swift`), and the hand-typed native theme
(`ios/Sources/Theme.swift`).
- `src/physics/lie.ts`: Implements SO(3) Euler equations with moments of inertia for aircraft rigid-body flight dynamics (Wright flyer fallback in donor). It does not implement Lorentz boosts or relativistic velocity composition; relativistic transformations belong in FrankenSim and paper-specific reference evaluators.
- `src/physics/telemetryData.ts`: Module-global UI tick counter and patent-scoped telemetry maps replaced by instance-scoped snapshot stores (`am-rt-snapshot-store-aft`).
- `src/physics/usePatentPhysics.ts`: Module-global maps keyed by patent ID and control-change ticks that count UI events rather than physical steps; replaced by instance-scoped snapshot stores (`am-rt-snapshot-store-aft`).

### 11.5 A blanket rename is not an extraction

Renaming `patentId` to `paperId` would leave the real differences intact. There are three, and they
are the reason the runtime was replaced rather than aliased:

1. One paper has many independent experiments, and the same experiment can appear twice on a page,
which is why identity is instance-scoped (`am-rt-snapshot-store-aft`).
2. A frame speed is not automatically a particle speed, which is why aliasing runs through canonical
quantity ids (`am-not-quantity-registry-2f7`) rather than through parameter names.
3. An imported signal can carry different units or a different historical meaning, which is why a
constant set is part of every request (`am-ref-constants-xik`).

`am-scaf-extract-runtime-utilities-99y` already renames `patentId` to `experimentId` while not
inventing the identity model; this is the reason, recorded where the extraction beads read it.

### 11.6 Per-bead extraction tables

Each table below is empty until its bead extracts a file. The column order is the row format of
section 11.1.

#### `am-scaf-extract-ui-components-c31`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-scaf-extract-runtime-utilities-99y`

| `src/physics/controlTape.ts` | `src/experiments/tape/controlTape.ts` (`am-scaf-extract-runtime-utilities-99y`) | Deterministic recording, scrubbing, checkpointing, and quantization of parameter streams (3600-tick bounded window) | Replaced patentId with instance-scoped experimentId; removed patent-specific control schemes | `am-exp-bm01-diffusion-chamber-7d8` | 1 | 31d51d0 | header | Pinned 32-bit seed coercion trap in characterization test |
| `src/physics/tickScheduler.ts` | `src/experiments/scheduler/tickScheduler.ts` (`am-scaf-extract-runtime-utilities-99y`) | Host-pumped time accumulation, studio clock state machine, fixed-timestep scheduler with bounded catch-up | Decoupled from global requestAnimationFrame assumptions and patent-specific frame limits | `am-exp-bm01-diffusion-chamber-7d8` | 1 | 31d51d0 | header | Pinned tick drop past maxCatchup trap in characterization test |
| `src/physics/transport.ts` | `src/workers/transport.ts` (`am-scaf-extract-runtime-utilities-99y`) | Bounded buffer pool with lease tracking and postMessage transport bus for worker offloading | SharedArrayBuffer / shared-memory mode disabled with typed error; removed patent-specific message envelopes | `am-exp-bm01-diffusion-chamber-7d8` | 1 | 31d51d0 | header | Pinned oldest-lease eviction trap and typed SharedMemoryDisabledError |
| `src/physics/paramAliases.ts` | `src/experiments/paramAliases.ts` (`am-scaf-extract-runtime-utilities-99y`) | Canonical parameter aliasing, expansion, and scaling transformations | Stripped all donor patent strings; keyed strictly by canonical quantity IDs | `am-exp-bm01-diffusion-chamber-7d8` | 1 | 31d51d0 | header | Pinned rejection of glyph/unit lookups in characterization test. Consumer: `am-linked-experiment-groups-5t5s` owns cross-instrument parameter identity and consumes this module as the alias-resolution seam; this extraction supplies the resolution shape only, no donor alias entries and no linkability policy, because two controls are not linkable because both are named $v$, both carry speed units, or both appear in the relativity paper. Particle velocity, mirror velocity, detector motion, and observer-frame velocity are physically different controls binding different canonical quantity IDs of `am-not-quantity-registry-2f7` (`particleVelocity`, `mirrorSpeed`, `frameSpeed` among them): a moving mirror is a setup of the world, a frame speed is an observer description of it, and linking the two would teach a reader that changing how you look at something moves a mirror. |
| `src/physics/genericWasm.ts` | `src/workers/genericWasm.ts` (`am-scaf-extract-runtime-utilities-99y`) | WASM module loader, fallback numerical kernels (heat, wave, fluid, laplacian, cyclic), source state tracking | Decoupled module loading state from per-snapshot execution provenance | `am-exp-bm01-diffusion-chamber-7d8` | 1 | 31d51d0 | header | Pinned module-global source trap in characterization test |
| `src/physics/useGenericWasmSource.ts` | `src/workers/useGenericWasmSource.ts` (`am-scaf-extract-runtime-utilities-99y`) | React hook subscribing to WASM engine loading status via useSyncExternalStore | Removed patent-specific visual dispatcher ties | `am-exp-bm01-diffusion-chamber-7d8` | 1 | 31d51d0 | header | Client hook for WASM source status |
| `src/physics/wasmArtifacts.test.ts` | `src/testing/wasm/artifactHelpers.ts` (`am-scaf-extract-runtime-utilities-99y`) | WASM binary validation (0x00 0x61 0x73 0x6d magic header) and SHA-256 hex digest computation | Stripped hardcoded donor artifact paths and patent-specific hashes | `am-scaf-quality-gates-ci-4xx` | 1 | 31d51d0 | header | Used for test-suite verification of WASM artifacts |
| `src/physics/qty.ts` | `src/units/qty.ts` (`am-scaf-extract-runtime-utilities-99y`) | 6D SI dimension vectors [L, M, T, Θ, I, N], dimension arithmetic, unit parser, and port contracts | Extended SI unit coverage (including tesla/T); removed patent-specific unit assumptions | `am-exp-bm01-diffusion-chamber-7d8` | 1 | 31d51d0 | header | Enforces physical unit safety across all experiment ports |
| `src/physics/intervals.ts` | `src/physics/intervals.ts` (`am-scaf-extract-runtime-utilities-99y`) | Bounded interval arithmetic, intersection, hull, scaling, regime classification, and refusal assertions | Removed patent-specific regime enumerations | `am-exp-bm01-diffusion-chamber-7d8` | 1 | 31d51d0 | header | Characterized difference between interval enclosure and probability density |
| `src/physics/energyLedger.ts` | `src/physics/energyLedger.ts` (`am-scaf-extract-runtime-utilities-99y`) | Hamiltonian balance, discrete passivity verification (non-negative dissipation), and timestep convergence order | Generalized beyond mechanical patent devices to universal conservation checks | `am-exp-bm01-diffusion-chamber-7d8` | 1 | 31d51d0 | header | Audited energy bookkeeping for numerical simulation integrity |
| `src/physics/coverageManifest.ts` | `src/content/coverage/coverageManifest.ts` (`am-scaf-extract-runtime-utilities-99y`) | Multidimensional coverage descriptors maintaining separate source, translation, argument, and WASM dimensions | Replaced patent claim categories with paper section/clause structures; distinct provenance states (WASM, TS_FALLBACK, HONEST_PLACEHOLDER) | `am-cm-coverage-ledger-0ip` | 1 | 31d51d0 | header | Prevents deceptive aggregation of coverage metrics |
| `src/physics/specClauses.ts` | `src/reader/weave/predicates.ts` (`am-scaf-extract-runtime-utilities-99y`) | Result predicate evaluation and clause registration for highlighting verified physical claims | Stripped patent claim weave; generalized to paper proposition / result predicate mapping | `am-read-result-weave-jex` | 1 | 31d51d0 | header | Pointers to verified claims, never decorative truth glow |

#### `am-scaf-extract-scripts-7jm`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|
| `scripts/deployment-target.ts` | `scripts/deployment-target.ts` (`am-scaf-extract-scripts-7jm`) | Canonical Vercel project identity check; `vercel inspect` output parsing; ready-and-aliased assertion | Removed the patent source-route manifest, the forbidden audit-hold string list, and `runSourceReaderBrowserSweep` (a headless-browser sweep over every patent detail route's delivery mode) | `am-rel-verified-deploy-qndt` | 1 | da0e2ee | header | Project identity constants are unfillable placeholders until that bead records the real annus-mirabilis Vercel project |
| `scripts/deployment-target.test.ts` | `scripts/deployment-target.test.ts` (`am-scaf-extract-scripts-7jm`) | Fixed-fixture tests for the above | Removed the "patent source route manifest" describe block | `am-rel-verified-deploy-qndt` | 1 | da0e2ee | header | Creates and deletes no temporary files (AGENTS.md Rule 1) |
| `scripts/fixtures/deployment-target/corrupt-project.txt` | `scripts/fixtures/deployment-target/corrupt-project.txt` (`am-scaf-extract-scripts-7jm`) | Invalid-JSON fixture for `assertCanonicalProjectIdentity` | None | `am-rel-verified-deploy-qndt` | 1 | da0e2ee | NOTICE.md | Byte-identical to the donor fixture |
| `scripts/fixtures/deployment-target/wrong-project.json` | `scripts/fixtures/deployment-target/wrong-project.json` (`am-scaf-extract-scripts-7jm`) | Mismatched-project-identity fixture | `projectName` changed from the donor's `classic-patents.com` to a neutral `wrong-project`; `projectId`/`orgId` changed to distinct placeholders | `am-rel-verified-deploy-qndt` | 1 | da0e2ee | NOTICE.md | A donor identity string may not appear outside an attribution comment |
| `scripts/deployment-verification.ts` | `scripts/deployment-verification.ts` (`am-scaf-extract-scripts-7jm`) | Vercel project config validation; deployment alias coverage assertion; a named candidate-check registry | Removed `FORBIDDEN_AUDIT_HOLD_STRINGS`, `getNonRedirectPatentIds`, and `runLiveSourceReaderSweep` (a live headless-browser sweep over patent routes checking for editorial audit-hold banners) | `am-rel-candidate-checks-kc7y` | 1 | da0e2ee | header | `CANDIDATE_CHECK_REGISTRY`'s six checks all report `not-available` until that bead implements them |
| `scripts/deployment-verification.test.ts` | `scripts/deployment-verification.test.ts` (`am-scaf-extract-scripts-7jm`) | Fixed-fixture tests for the above, plus tests asserting every registry entry reports `not-available`, never `passed` | Removed the "getNonRedirectPatentIds" and "prohibited audit hold phrases" describe blocks | `am-rel-candidate-checks-kc7y` | 1 | da0e2ee | header | Creates and deletes no temporary files |
| `scripts/smoke-test-deployment.ts` | `scripts/smoke-test-deployment.ts` (`am-scaf-extract-scripts-7jm`) | HTTP-200-and-minimum-content-length route checker with structured JSONL logging | Removed the ten hard-coded patent sample routes; checks only the home page until paper content ships | `am-rel-smoke-rollback-cache-phre` | 1 | da0e2ee | header | Logs under a `toolRunId`-named artifact directory (a smoke test is a tool run, never `runId`) |
| `scripts/verified-production-deploy.ts` | `scripts/verified-production-deploy.ts` (`am-scaf-extract-scripts-7jm`) | Candidate-then-promote release pipeline primitives: exclusive local deployment lock, dirty-worktree and conflicting-build refusal, Build Output API v3 validation, `--skip-domain` deploy, alias promotion, protected-preview verification | Removed `assertWrightManualEditionInWorkspace`, `WRIGHT_ROUTE`/`COMPLETE_SOURCE_DELIVERY_ROUTE` and their assertions, and the donor's hard-coded `PUBLICATION_CONTRACT_TESTS` file list | `am-rel-candidate-checks-kc7y`, at the candidate check against deployed, unpromoted assets (named directly in this bead's own worked `firstReaderJourney` example, section 11.1.1) | 1 | da0e2ee | header | Main entry throws "not yet adapted; see am-rel-verified-deploy-qndt" before any network, git, or Vercel call; every helper function remains independently testable and is exercised by `scripts/extractedScriptsHygiene.test.ts` |
| `scripts/e2e/paper-e2e-contract.ts` | `scripts/e2e/paper-e2e-contract.ts` (`am-scaf-extract-scripts-7jm`) | Viewport table (desktop/tablet/phone, phone exactly 320 px); event/summary JSONL schema; CLI parsing; diagnostic classification; secret redaction; the vertical-slice journey shape contract (`validatePaperE2EJourney`) | Removed `PatentE2EScenario`, `buildPatentE2EScenarios`, `ScenarioFacts`, `selectPatentE2EScenarios`, `resolveChangedPatentIds`, `assertPatentSourceIdentity`, `assertSourceHeldVisual` (the donor's live archival-edition scenario model) | `am-test-e2e-harness-bqmh` | 1 | da0e2ee | header | `runId` renamed to `logRunId` throughout (AGENTS.md "Structured logs" reserves `runId` for an experiment realization) |
| `scripts/e2e/paper-e2e-contract.test.ts` | `scripts/e2e/paper-e2e-contract.test.ts` (`am-scaf-extract-scripts-7jm`) | Fixed-fixture tests for the above, plus the journey-contract tests this bead's Test Plan requires | Removed the "patent E2E scenario contract" describe block and the changed-ids test | `am-test-e2e-harness-bqmh` | 1 | da0e2ee | header | Includes the well-formed-journey acceptance test and the missing-readiness/missing-evidence rejection tests |
| `scripts/e2e-paper-vertical-slices.ts` | `scripts/e2e-paper-vertical-slices.ts` (`am-scaf-extract-scripts-7jm`) | Browser launch, per-slice Chromium isolation, preflight target-identity check, failure-evidence capture and integrity inspection, `--self-test-failure`, JSONL event log and summary | Removed every patent-domain verification function (facsimile painting, claim navigation, visual/telemetry dispatch, physics explanation surfaces, theme/responsive checks) and the donor's DOM readiness selectors (`dual-projection-viewer`, `patent-visual-surface`); removed `changedPathsFromGit`/`readSmallTextFile`/`checked`/`meta`, which had no scenario source left to serve | `am-test-e2e-harness-bqmh` | 1 | da0e2ee | header | `--self-test-failure` is fully live today; every other mode records an honest configuration-failure event naming the blocking bead instead of a fabricated scenario |
| `docs/PATENT_E2E_HARNESS.md` | `docs/PAPER_E2E_HARNESS.md` (`am-scaf-extract-scripts-7jm`) | Commands, evidence-retention contract, self-test acceptance criteria, Vercel CLI command table | Replaced the patent-catalogue "what a scenario proves" section with the current infrastructure-only status and the vertical-slice journey contract | `am-test-e2e-harness-bqmh` | 1 | da0e2ee | NOTICE.md | Markdown cannot carry the section 9.2 header; attribution recorded in the document's own body instead |

_Reference only, not extracted as a file:_ `scripts/verify-data.ts`'s pattern informs the content compiler (`am-cm-compiler-core-oa7`, `am-cm-audit-scripts-d34`); its patent-specific checks are not copied. `scripts/app-router-architecture.ts` is extracted by `am-scaf-architecture-gate-l1p`, not here.

#### `am-scaf-architecture-gate-l1p`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|
| `scripts/app-router-architecture.ts` | `scripts/app-router-architecture.ts` (`am-scaf-architecture-gate-l1p`) | Fail-closed App Router purity gate and root allowlist validation | Patent-specific routes stripped; generalized to five architectural rules | pending: am-scaf-quality-gates-ci-4xx | 1 | pending | header | Prebuild and test suite architecture gate |
| `scripts/app-router-architecture.test.ts` | `scripts/app-router-architecture.test.ts` (`am-scaf-architecture-gate-l1p`) | Unit and integration test fixtures for architecture gate rules | Patent-specific test cases replaced with five generic architectural fixtures | pending: am-scaf-quality-gates-ci-4xx | 1 | pending | header | Architecture gate test suite |

#### `am-eq-expression-tree-8kl`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-cm-id-scheme-8bn`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-cm-coverage-ledger-0ip`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-read-facsimile-face-er0`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-read-result-weave-jex`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-bm-slice-e2e-sbqu`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-rel-verified-deploy-qndt`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-app-xcodegen-scaffold-z228`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-app-edition-export-kwpu`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-app-facsimile-downloads-72nz`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-app-e2e-journeys-vm0t`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._
