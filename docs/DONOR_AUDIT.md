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
   - Method: Enumerated all 39 reuse and harness paths from §2.3 and verified against `git ls-tree -r --name-only da11ff475902728fd8dd1d9db9f3af37c16ec8a5`.
   - Result: 100% of tested paths confirmed present at the pinned revision.

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
  - `classic-patents.com:src/physics/coverageManifest.ts`: lines 18–25 define `WasmSurfaceKind` (`generic-wasm`, `interpretive-wasm`, `patent-specific-wasm`); lines 78–95 define `PatentCoverageSummary` with 16 distinct metrics: `total`, `pinnedFacsimiles`, `reviewedLedgers`, `publishedEditions`, `candidateEditions`, `heldEditions`, `rejectedEditions`, `facsimileOnlyRecords`, `sourceBoundedRecords`, `patentSpecificWasm`, `interpretiveWasm`, `genericWasm`, `typedHostOnly`, `sharedBusUpdaters`, `sharedBusSnapshots`, and `missingSharedBus`.

### Finding 4.3: Equation Schema, Term Interaction & Redesign Seams

- **Statement:** The equation schema links symbols, roles, units, sentence fragments, colors, and telemetry, supporting term selection, keyboard navigation, color-blind mode, and live values. KaTeX renders HTML plus MathML using a restricted trust callback. Seams requiring redesign include telemetry lookup by human label and permissive token matching (`variableId.startsWith("var_" + id)`).
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `classic-patents.com:src/components/ui/ColorizedEquation.tsx`:
    - Line 117 contains the permissive token match: `variableId.startsWith(\`var_\${variable.id}\`) || ...`, which relies on substring matching instead of exact canonical quantity IDs.
    - Lines 162–213 implement `colorBlindMode` toggling and accessibility aria labels (`aria-pressed={colorBlindMode}`).
    - Lines 360–445 implement keyboard navigation and hover highlighting over math symbols.
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
    - Lines 39–42 implement `bumpTick`:
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
    - Line 22: `export type RuntimeProvenance = "WASM" | "TS_FALLBACK" | "HONEST_PLACEHOLDER";`
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
  - `frankensim:crates/fs-wasm/Cargo.toml`: line 24 (`fs-sparse`), line 26 (`fs-rand`).
  - `frankensim:crates/fs-rand/src/philox.rs`: line 31 (`pub fn philox4x32_10(mut ctr: [u32; 4], mut key: [u32; 2]) -> [u32; 4]`); line 58 (`pub fn philox4x32_10_batch<const L: usize>(ctr: &[[u32; 4]; L], key: [u32; 2]) -> [[u32; 4]; L]`).
  - `frankensim:crates/fs-rand/src/lib.rs`: lines 192–305 implement canonical binary serialization, schema checks, and version validation for `StreamCheckpoint`; line 579 exposes `pub fn next_normal(&mut self) -> f64`.
  - `frankensim:crates/fs-wasm/src/lib.rs`: lines 249–285 implement `pub fn heat_frames(n_in: usize, frames_in: usize, steps_per_frame_in: usize) -> Vec<f64>`. Initial condition hardcodes two Gaussians `g(0.3, 0.3, 0.07) - g(0.7, 0.68, 0.08)`, fixed `dt = 0.20`, taking no thermal diffusivity, grid pitch, or custom initial profile.
  - `frankensim:crates/fs-qty/src/lib.rs`: lines 9–13, 35, and 42 define `pub const DIMENSION_COUNT: usize = 6;` and `pub struct Dims(pub [i8; DIMENSION_COUNT]);` over `[m, kg, s, K, A, mol]`.
  - `frankensim:crates/fs-demo-physics-wasm/src/lib.rs`: lines 16–25 document typed-refusal JSON envelope contract (`{"ok": ...}` or `{"refusal": {"code","message","ranked_repairs"}}`) and explicit no-claims; lines 30–65 implement `Refusal::json()`.
  - API Search Results: Search command `git -C ~/projects/frankensim grep -i -E '(brownian|langevin|planck_radiation|lorentz_boost|einstein_relativity)' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/` returned 0 matches across all crates. (Absence in search is recorded as an empirical search result, not proof of non-existence).
  - Corroboration between revisions: Both `5bbbfae6f7de614422f6f97f5798a3e00f8ad813` (2026-09-13) and `88a4819abe7a361d278759aabec962604f87a00c` (2026-09-14) were examined. A diff stat between them for `crates/fs-wasm`, `crates/fs-rand`, `crates/fs-qty`, `crates/fs-sparse`, and `crates/fs-demo-physics-wasm` produced 0 diffs. The facts are identical across both revisions.

### Finding 4.8: Headless Browser Acceptance Contract

- **Statement:** The browser acceptance harness checks source identities, exact routes, source assets, URL-restored views, actual controls, telemetry and refusal behavior, 320 px screens, keyboard and touch interactions, reduced motion compliance, and retains failure evidence upon failure.
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `classic-patents.com:scripts/patent-e2e-contract.ts`: lines 13–15 define viewports including `phone: { width: 320, height: 800 }`; lines 35–65 define `PatentE2EScenario` capturing source identity, route, controls, and figure assets.
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
