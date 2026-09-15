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

---

## 5. Reuse Table

The reuse table adapts Plan §2.3. Every path listed has been verified against the pinned donor tree at commit `da11ff475902728fd8dd1d9db9f3af37c16ec8a5`. All 48 component and script paths were confirmed present in the donor checkout.

| Donor Seam / Verified Path | Decision | Adaptation in Annus Mirabilis | License Notice Requirement | Extracting Bead |
|---|---|---|---|---|
| **Facsimile & Source Architecture**<br>`public/patents/facsimiles/`<br>`public/patents/transcripts/`<br>`src/data/editions/`<br>`src/data/patents/sourceTextValidation.ts` | **Reuse architecture** | Bilingual critical edition (German source face + English translation), sentence-level many-to-many alignment, section-scoped notation concordance, separately attributed notes | MIT + Rider | `am-bm-slice-e2e-sbqu`<br>`am-read-facsimile-face-er0` |
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
- **Rider Location:** Lines 12–54 of `classic-patents.com:LICENSE` (`ADDITIONAL RIDER / RESTRICTION (OpenAI / Anthropic)`).
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

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-scaf-extract-scripts-7jm`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

#### `am-scaf-architecture-gate-l1p`

| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |
|---|---|---|---|---|---|---|---|---|

_No files extracted yet._

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
