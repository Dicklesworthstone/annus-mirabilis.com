# FrankenSim Numerical Owner Binding and Capability Audit

**Document:** `docs/FRANKENSIM_BINDING.md`  
**Audit Date:** 2026-09-15  
**Auditor:** LilacCanyon (`antigravity`, model `gemini-3.8-flash-high`)  
**Status:** In Progress (Sections 1–3 drafted incrementally per coordinator directive)  
**Owning Bead:** `am-fs-capability-audit-byc`  
**Pinned FrankenSim Revision:** `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`  

---

## 1. Pinned Revisions, Toolchain, and Sibling Dependencies

### 1.1 FrankenSim Kickoff Pin
- **Repository URL:** `https://github.com/Dicklesworthstone/frankensim`
- **Local Checkout Path:** `/Users/jemanuel/projects/frankensim`
- **Pinned Commit Hash:** `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`
- **Commit Date:** `2026-09-13 22:22:09 -0400` (`2026-09-13T22:22:09-04:00`)
- **Commit Author:** Jeff Emanuel `<35050222+Dicklesworthstone@users.noreply.github.com>`
- **Commit Subject:** `feat(conduction): differentiate cooling through temperature-dependent conductivity`
- **Verification Command:**
  ```bash
  git -C /Users/jemanuel/projects/frankensim log -1 --format="commit %H%ndate: %ci (%cI)%nauthor: %an <%ae>%nsubject: %s" 5bbbfae6f7de614422f6f97f5798a3e00f8ad813
  ```
- **Equivalence with Donor Audit:** Matches the exact 40-character commit hash pinned in `docs/DONOR_AUDIT.md` §1.2.

### 1.2 Toolchain Pin (`rust-toolchain.toml`)
Source citation: `frankensim:rust-toolchain.toml` at commit `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`.
- **Channel:** `nightly-2026-07-06` (lines 14–17)
- **Target Compiler:** `rustc 1.99.0-nightly (3659db0d3 2026-07-05)` (lines 10–11)
- **Components:** `["rustfmt", "clippy"]` (line 16)
- **Rationale:** Pinned per bead `go7a` to eliminate lint set drift (e.g. `chunks_exact` vs `as_chunks`) across local environments and CI workers while supporting nightly features required by `fs-qty` (const-generic dimension arithmetic) and `fs-simd`.

### 1.3 Sibling Revisions & Path Dependencies
The browser WASM build of `crates/fs-wasm` reaches sibling repositories and external toolchain components:
- **`asupersync` (Browser Async Runtime):**
  - **Local Checkout Path:** `/Users/jemanuel/projects/asupersync`
  - **Dependency Citation:** `crates/fs-wasm/Cargo.toml:104`:
    ```toml
    asupersync = { path = "../../../asupersync", default-features = false, features = ["wasm-browser-prod"] }
    ```
  - **Local Pinned Revision:** `5adf01082b14de1d7bd2c9d9da9779d5502cb4bc` (`2026-09-15 13:05:50 -0400`, author Jeff Emanuel).
- **Target Dependencies (`cfg(target_arch = "wasm32")`):**
  - `wasm-bindgen = "0.2"` (`crates/fs-wasm/Cargo.toml:102`)
  - `getrandom = { version = "0.4", features = ["wasm_js"] }` (`crates/fs-wasm/Cargo.toml:105`)
- **`fs-sparse` Constellation Interop Dependencies:**
  - `crates/fs-sparse/Cargo.toml:18–21` defines optional dependencies:
    - `fnx-classes = { path = "../../../franken_networkx/crates/fnx-classes", optional = true }` (line 18)
    - `fnx-runtime = { path = "../../../franken_networkx/crates/fnx-runtime", optional = true }` (line 19)
    - `fnp-ufunc = { path = "../../../franken_numpy/crates/fnp-ufunc", optional = true }` (line 20)
    - `fnp-dtype = { path = "../../../franken_numpy/crates/fnp-dtype", optional = true }` (line 21)
  - Controlled by default-off cargo features `fnx-interop` (line 25) and `fnp-interop` (line 27).
  - Test-only dev-dependencies (`crates/fs-sparse/Cargo.toml:32`): `fsci-sparse = { path = "../../../frankenscipy/crates/fsci-sparse", version = "=0.1.0" }`.

---

## 2. Verified Findings with File and Line Evidence

Every finding has been independently re-verified against the local checkout of `frankensim` at pinned commit `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`.

### Finding 2.1: `fs-wasm` Architecture, Dependencies, and Workspace Boundary
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `crates/fs-wasm/Cargo.toml:11`: defines `[workspace]`, establishing that `fs-wasm` is its own nested virtual workspace decoupled from the root FrankenSim workspace.
  - `crates/fs-wasm/Cargo.toml:15`: `crate-type = ["cdylib", "rlib"]`.
  - `crates/fs-wasm/Cargo.toml:108`: `unsafe_code = "forbid"` in `[lints.rust]`.
  - `crates/fs-wasm/Cargo.toml:20–98`: unconditionally pulls in leaf numerical crates (`fs-sparse`, `fs-cheb`, `fs-rand`, `fs-math`, `fs-ivl`, `fs-ad`, `fs-fft`, `fs-la`, `fs-ga`), upper-stack kernels (`fs-geom`, `fs-feec`, `fs-flux`, `fs-cutfem`, `fs-solver`, `fs-bo`, `fs-xform`, `fs-dfo`, `fs-symmetry`, `fs-solid`, `fs-rep-mesh`), campaign crates (`fs-evidence`, `fs-sos`, `fs-robust`, `fs-tropical`, `fs-voi`, `fs-spectral`, `fs-couple`, `fs-duct`, `fs-rep-neural`, `fs-viz`, `fs-shapeprog`, `fs-archive`, `fs-fab`, `fs-assimilate`, `fs-toleralloc`, `fs-lattice`, `fs-truss`, `fs-eproc`, `fs-lbm`), flagship pipelines (`fs-ornith`, `fs-vessel`, `fs-frame`, `fs-bem`, `fs-vpm`, `fs-race`, `fs-render`, `fs-scenario`, `fs-uq`, `fs-material`, `fs-alloc`, `fs-exec`, `fs-qty`), 10 E2E campaign crates (`fs-robustopt-e2e` through `fs-flowcert-e2e`), and `fs-substrate` under dev-dependencies.
  - **No `[features]` table:** Verified by inspection; `crates/fs-wasm/Cargo.toml` contains zero `[features]` definitions.
  - **No `tests/` directory:** Command `git -C /Users/jemanuel/projects/frankensim ls-tree -d 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 crates/fs-wasm/` reveals only `.cargo` and `src`. No `crates/fs-wasm/tests/` directory exists.

### Finding 2.2: Leaf Numerical Dependencies of `fs-rand`, `fs-math`, and `fs-sparse`
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `crates/fs-rand/Cargo.toml:14`: declares `fs-math = { path = "../fs-math" }` as its sole runtime dependency (`[dependencies]`).
  - `crates/fs-math/Cargo.toml:13`: `[dependencies]` is completely empty (lines 13–14). `fs-math` has zero runtime crate dependencies.
  - `crates/fs-sparse/Cargo.toml:18–21`: constellation dependencies (`fnx-classes`, `fnx-runtime`, `fnp-ufunc`, `fnp-dtype`) are `optional = true`, guarded behind default-off features `fnx-interop` (line 25) and `fnp-interop` (line 27). In baseline configuration, `fs-sparse` has zero external runtime dependencies.

### Finding 2.3: `heat_frames` Implementation and Clamping Limits
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `crates/fs-wasm/src/lib.rs:252`: `pub fn heat_frames(n_in: usize, frames_in: usize, steps_per_frame_in: usize) -> Vec<f64>` (core Rust implementation).
  - `crates/fs-wasm/src/lib.rs:253–255`: inputs are clamped rather than refused:
    ```rust
    let n = n_in.clamp(3, 96);
    let frames = frames_in.clamp(1, 240);
    let spf = steps_per_frame_in.clamp(1, 40);
    ```
  - `crates/fs-wasm/src/lib.rs:169–190`: `laplacian_5pt(n)` builds a 5-point Laplacian stencil with `4.0` on the diagonal and `-1.0` on valid neighbors on an `n×n` grid using `Coo::new` and `coo.assemble()`.
  - `crates/fs-wasm/src/lib.rs:268`: hard-codes two Gaussian blobs `u[i * n + j] = g(0.3, 0.3, 0.07) - g(0.7, 0.68, 0.08);`.
  - `crates/fs-wasm/src/lib.rs:271`: hard-codes fixed dimensionless time step `let dt = 0.20; // A has ~4 on the diagonal → 8 spectral bound → dt < 0.25.`.
  - `crates/fs-wasm/src/lib.rs:277–279`: steps field via `a.spmv(&u, &mut au);` followed by `u[i] -= dt * au[i];`.
  - `crates/fs-wasm/src/lib.rs:1000`: `pub fn heat_frames(...)` exported via `#[wasm_bindgen]`.
  - **Verdict:** `heat_frames` accepts no thermal diffusivity, no physical grid spacing, and no custom initial profile. It is a visual demonstration, not an honest physical owner for Brownian motion or diffusion instruments.

### Finding 2.4: `fs-rand` Counter-Based RNG Semantics, Philox Rounds, and Checkpoints
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `crates/fs-rand/src/lib.rs:134–141`: defines `pub struct StreamKey { pub seed: u64, pub kernel: u32, pub tile: u32 }`.
  - `crates/fs-rand/src/lib.rs:491–498`: `encode_stream_position` maps `(key, index)` to counter words `[index as u32, (index >> 32) as u32, tile, kernel]` and key words `[seed as u32, (seed >> 32) as u32]`.
  - `crates/fs-rand/src/philox.rs:8–13`: defines multipliers `M0 = 0xD251_1F53`, `M1 = 0xCD9E_8D57` and Weyl increments `W0 = 0x9E37_79B9`, `W1 = 0xBB67_AE85`.
  - `crates/fs-rand/src/philox.rs:22–26`: `round(ctr, key)` computes `(hi0, lo0) = mulhilo(M0, ctr[0]); (hi1, lo1) = mulhilo(M1, ctr[2]);` returning `[hi1 ^ ctr[1] ^ key[0], lo1, hi0 ^ ctr[3] ^ key[1], lo0]`.
  - `crates/fs-rand/src/philox.rs:31–41`: `philox4x32_10` executes 10 rounds, incrementing `key[0]` by `W0` and `key[1]` by `W1` before every round after the first.
  - `crates/fs-rand/src/philox.rs:58`: `philox4x32_10_batch<const L: usize>` executes structure-of-arrays batched generation over `L` lanes under one shared key.
  - `crates/fs-rand/src/philox.rs:114–146`: `random123_known_answers` tests 3 Random123 KAT vectors (all-zeros, all-ones, and π-digits `[0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344]` with key `[0xa4093822, 0x299f31d0]` yielding `[0xd16cfe09, 0x94fdcceb, 0x5001e420, 0x24126ea1]`).
  - `crates/fs-rand/src/lib.rs:40`: `pub const STREAM_SEMANTICS_VERSION: u32 = 1;`.
  - `crates/fs-rand/src/lib.rs:79`: `pub const STREAM_CHECKPOINT_VERSION: u32 = 1;`.
  - `crates/fs-rand/src/lib.rs:88`: `pub const STREAM_CHECKPOINT_MAGIC: [u8; 8] = *b"FSRCKPT\\0";`.
  - `crates/fs-rand/src/lib.rs:94`: `STREAM_CHECKPOINT_CANONICAL_LEN` evaluates to exactly 83 bytes (`8 + 43 + 16 + 16`).
  - `crates/fs-rand/src/lib.rs:165–174`: `pub struct StreamCheckpoint { pub checkpoint_version: u32, pub stream_semantics_version: u32, pub key: StreamKey, pub index: u64 }`.
  - `crates/fs-rand/src/lib.rs:527–533`: `Stream::resume` validates both version fields before using key or index.
  - `crates/fs-rand/src/lib.rs:546–551`: `next_u64(&mut self)` computes `(u64::from(block[1]) << 32) | u64::from(block[0])` and advances index with `self.index.wrapping_add(1)`.
  - `crates/fs-rand/src/lib.rs:554–557`: `next_f64(&mut self)` computes `(self.next_u64() >> 11) as f64 * (1.0 / 9_007_199_254_740_992.0)` ($2^{-53}$).
  - `crates/fs-rand/src/lib.rs:563–575`: `next_below(&mut self, n: u64)` uses Lemire's widening-multiply method (`u128::from(x) * u128::from(n)`) with deterministic rejection consumption.
  - `crates/fs-rand/src/lib.rs:579–585`: `next_normal(&mut self)` computes Box–Muller using `fs_math::det::{sqrt, ln, cos}`:
    ```rust
    let u = 1.0 - self.next_f64();
    let v = self.next_f64();
    det::sqrt(-2.0 * det::ln(u)) * det::cos(2.0 * std::f64::consts::PI * v)
    ```
    Consumes exactly 2 uniform draws.
  - `crates/fs-rand/src/lib.rs:591`: `next_normal_ziggurat` is the fast-mode path; comments explicitly state it is not admitted to strict mode until cross-ISA bitwise proof lands.
  - `crates/fs-rand/src/lib.rs:617–631`: `fill_f64(&mut self, out: &mut [f64])` bulk-fills slices via 8-lane batched generation; bitwise identical to sequential `next_f64`.

### Finding 2.5: `fs-sparse` COO Staging, Deterministic Assembly, and CSR SpMV
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `crates/fs-sparse/src/lib.rs:61–70`: `pub struct Coo { pub(crate) nrows: usize, pub(crate) ncols: usize, pub(crate) rows: Vec<usize>, pub(crate) cols: Vec<usize>, pub(crate) vals: Vec<f64> }`.
  - `crates/fs-sparse/src/lib.rs:72–81`: `pub fn new(nrows: usize, ncols: usize) -> Coo`.
  - `crates/fs-sparse/src/lib.rs:84–94`: `pub fn push(&mut self, row: usize, col: usize, val: f64)`.
  - `crates/fs-sparse/src/lib.rs:111–137`: `pub fn assemble(&self) -> Csr` stably sorts triplet indices by `(row, col)` with `order.sort_by_key(|&i| (self.rows[i], self.cols[i]))`, accumulating duplicate entries in insertion-sequence order.
  - `crates/fs-sparse/src/lib.rs:313–326`: `Csr::spmv(&self, x: &[f64], y: &mut [f64])` accumulates each row in ascending column order with fused multiply-add (`fma::spmv_dispatch`).

### Finding 2.6: `fs-math` Deterministic Elementary Functions
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `crates/fs-math/src/det.rs:95–130`: `pub fn ln(x: f64) -> f64` is a strict, table-free deterministic natural logarithm implementation with subnormal normalization and ULP bounds.
  - `crates/fs-math/src/det.rs:170–184`: `pub fn cos(x: f64) -> f64` is a strict deterministic cosine using Payne–Hanek range reduction (`reduce_pio2_large`) and polynomial core approximations.
  - `crates/fs-math/src/det.rs:238–240`: `pub fn sqrt(x: f64) -> f64 { x.sqrt() }`. Correct rounding is guaranteed by IEEE-754 hardware instruction (0 ULP).

### Finding 2.7: `fs-qty` Dimensional Analysis Exponent Vectors
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `crates/fs-qty/src/lib.rs:42`: `pub const DIMENSION_COUNT: usize = 6;`.
  - `crates/fs-qty/src/lib.rs:50–51`: `pub struct Dims(pub [i8; DIMENSION_COUNT]);` representing SI base units `[m, kg, s, K, A, mol]`. Exponent overflow is checked (`checked_plus`), refusing saturation.

### Finding 2.8: `fs-demo-physics-wasm` Typed Refusal Envelopes and Contract
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `crates/fs-demo-physics-wasm/src/lib.rs:27`: `pub const KERNEL_VERSION: &str = "fs-demo-physics-wasm 0.1.0";`.
  - `crates/fs-demo-physics-wasm/src/lib.rs:35–39`: `pub struct Refusal { pub code: &'static str, pub message: String, pub ranked_repairs: Vec<&'static str> }`.
  - `crates/fs-demo-physics-wasm/src/lib.rs:58–69`: `fn json(&self) -> String` serializing to JSON format `{"refusal":{"code":"...","message":"...","ranked_repairs":[...]}}`.
  - `crates/fs-demo-physics-wasm/CONTRACT.md:1–45`: documents error model (typed refusals over silent clamping), determinism class (`Deterministic`), and explicit no-claim boundaries.

### Finding 2.9: `fs-evidence` and `fs-blake3` Certificates and Hashing Primitives
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `crates/fs-evidence/src/lib.rs:928`: `pub struct Evidence<T>` declares the container carrying `value`, `qoi`, and four uncertainty slices (`numerical: NumericalCertificate`, `statistical: StatisticalCertificate`, `model: ModelEvidence`, and `sensitivity: SensitivitySummary`) plus `provenance: ProvenanceHash`; module documentation at lines 12–18 introduces the four uncertainty slices.
  - `crates/fs-blake3/src/lib.rs:377–380`: `pub fn hash_bytes(bytes: &[u8]) -> ContentHash`.
  - `crates/fs-blake3/src/lib.rs:390–435`: `pub struct DomainHasher` implements domain-separated streaming BLAKE3 hashing.

### Finding 2.10: Domain Semantics of `fs-lattice` and `fs-flux`
- **Status:** `confirmed`
- **File & Line Evidence:**
  - `crates/fs-lattice/Cargo.toml:8`: description states `"Lattice/infill optimization (plan 9.5): periodic unit-cell homogenization..."` (additive manufacturing, TPMS infills, CNC toolpaths). It does not model physical crystalline lattices or molecular structures.
  - `crates/fs-flux/Cargo.toml:8`: description states `"Incompressible Navier-Stokes, FEEC-native: H(div)-conforming RT0 velocities..."` (fluid mechanics and boundary-layer flux). It does not model radiative energy flux or photoelectric phenomena.

---

## 3. Capability Map (§12.3 Families)

Master Plan §12.3 defines nine capability families required across the five 1905 papers. Each family is evaluated against candidate crates in FrankenSim at pinned commit `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`, determining its determinism class (`docs/DETERMINISM_CLASSES.md`), existing test evidence, `wasm32` compilation status, identifiable gaps, and proposed owner decisions.

### 3.1 Family 1: Radiation Spectra
- **Physical Domain:** Blackbody spectral distribution, Planck radiation formula, Wien displacement law, Wien approximation ($h\nu \gg kT$), Rayleigh–Jeans classical divergence limit ($h\nu \ll kT$), and spectral entropy.
- **Candidate Crates & Functions:**
  - `crates/fs-render/src/volumes.rs:626`: `pub fn planck(lambda_nm: f64, t_kelvin: f64) -> f64` computes unnormalized spectral radiance shape $1 / (\lambda^5 (e^{c_2/\lambda T} - 1))$ with $c_2 = hc/k = 1.438776877\times 10^7\text{ nm}\cdot\text{K}$.
  - `crates/fs-conduction/src/radiation.rs:35`: `pub const STEFAN_BOLTZMANN_W_M2_K4: f64 = 5.670_374_419e-8;` (Stefan–Boltzmann constant $\sigma$).
- **Determinism Class:** `Deterministic` (pure function of scalars; uses `fs_math::det::powi` and `det` transcendentals).
- **Existing Tests:** `crates/fs-render/tests/volumes_battery.rs:209, 236–240` (`vol-004-planck-ordering` asserts hotter-is-brighter and hotter-is-bluer).
- **`wasm32` Compilation Status:** Compiles to `wasm32` as part of `crates/fs-wasm` (line 68), but `fs-render` carries significant offscreen graphics dependencies.
- **Identified Gaps:** `fs-render::volumes::planck` is an unnormalized computer graphics weight; no certified SI spectral energy density $u(\nu, T) = \frac{8\pi h\nu^3}{c^3}\frac{1}{e^{h\nu/kT}-1}$ [$\text{J}\cdot\text{s}\cdot\text{m}^{-3}$] or $u_\lambda(\lambda, T)$; no Wien displacement peak solver; no Wien exponential tail; no Rayleigh–Jeans $8\pi k_B T \nu^2/c^3$ ultraviolet catastrophe comparison.
- **Proposed Owner Decision:** Upstream owner bead `am-fs-owner-radiation-6uv` will implement certified radiation models in FrankenSim. For initial release routes, audited TypeScript reference evaluators under `src/physics/reference/radiation.ts` serve as host calculations.

### 3.2 Family 2: Idealized Quantum Energy Transfer
- **Physical Domain:** Photoelectric effect energy conservation $E_{\text{kin}} = h\nu - \Phi$, stopping potential $eV_0$, threshold frequency $\nu_0 = \Phi/h$, and monochromatic photon energy quanta $E = h\nu$.
- **Candidate Crates & Functions:** None present in FrankenSim at the pinned revision.
- **Determinism Class:** `Deterministic` (exact linear arithmetic with physical constants $h$, $e$).
- **Existing Tests:** None.
- **`wasm32` Compilation Status:** Not applicable.
- **Identified Gaps:** Zero photoelectric or quantum energy transfer modules exist in upstream FrankenSim.
- **Proposed Owner Decision:** Upstream owner bead `am-fs-owner-radiation-6uv`. Downstream host calculation provided by audited TypeScript reference evaluator (`src/physics/reference/photoelectric.ts`).

### 3.3 Family 3: Diffusion and Stochastic Transport
- **Physical Domain:** Brownian particle motion, Langevin stochastic trajectories, Stokes–Einstein diffusion coefficient $D = \frac{k_B T}{6\pi \eta r}$, 1D/2D concentration diffusion, and particle ensemble root-mean-square displacement $\sqrt{\langle x^2 \rangle} = \sqrt{2Dt}$.
- **Candidate Crates & Functions:**
  - `crates/fs-rand/src/lib.rs:579`: `pub fn next_normal(&mut self) -> f64` (Box–Muller Gaussian sampling via `fs_math::det`).
  - `crates/fs-rand/src/philox.rs:31`: `pub fn philox4x32_10` (counter-based PRNG).
  - `crates/fs-sparse/src/lib.rs:313`: `Csr::spmv` (matrix-vector products for spatial diffusion stencils).
  - `crates/fs-wasm/src/lib.rs:252`: `heat_frames` (clamped 2D demonstration; not suitable for physical diffusion).
- **Determinism Class:** `Deterministic` (Philox4x32-10 core and `fs_math::det` Box–Muller normal deviates are bit-identical cross-ISA).
- **Existing Tests:** `crates/fs-rand/src/philox.rs:114` (Random123 KAT); `crates/fs-rand/tests/bulk.rs`; `crates/fs-sparse/tests/`.
- **`wasm32` Compilation Status:** `fs-rand` and `fs-sparse` compile cleanly to `wasm32-unknown-unknown`.
- **Identified Gaps:** Upstream `fs-wasm` lacks a physical Langevin step kernel, lacks a physical Stokes–Einstein calculator, and lacks an FTCS 1D diffusion solver with typed stability boundary checks ($r = D\Delta t/\Delta x^2 \le 1/2$).
- **Proposed Owner Decision:** Implement new WASM export functions: `brownian_frames` (`am-fs-export-brownian-frames-nhm`), `philox_normals` (`am-fs-export-philox-normals-xnv`), and `diffusion1d_frames` (`am-fs-export-diffusion1d-cew`) targeting the slim WASM artifact; upstream general owner is `am-fs-diffusion-owner-sey`.

### 3.4 Family 4: Diffusion Inference
- **Physical Domain:** Statistical estimation of diffusion coefficient $D$, Avogadro's number $N_A$, and particle radius $a$ from tracked particle displacement time-series; mean-squared displacement (MSD) linear regression; displacement histogram variance estimation.
- **Candidate Crates & Functions:**
  - `crates/fs-rand/src/qmc.rs:65`: `pub struct Sobol` (generator implementation; lines 1–9 define the module contract for Sobol' sequences with Owen nested-uniform scrambling).
- **Determinism Class:** `Deterministic` (least-squares linear regression on deterministic elementary operations).
- **Existing Tests:** None for particle trajectory inference.
- **`wasm32` Compilation Status:** Not applicable.
- **Identified Gaps:** Upstream FrankenSim defines no Avogadro constant ($N_A$) at the pinned revision (the only occurrence of "avogadro" in doc comments is `crates/fs-thermochem/src/lib.rs:47` documenting the universal gas constant; the float value `6.02214076e23` occurs solely as a serialization test fixture in `crates/fs-qty/src/json.rs:525`). Upstream FrankenSim contains no MSD curve fitters, no maximum-likelihood diffusion estimators, and no parameter estimation algorithms for Brownian video microscopy.
- **Proposed Owner Decision:** Upstream owner bead `am-fs-owner-inference-45g` (must supply both statistical estimators and the $N_A$ constant). Downstream host calculation provided by audited TypeScript reference evaluator (`src/physics/reference/diffusionInference.ts`).

### 3.5 Family 5: Flat-Spacetime Kinematics
- **Physical Domain:** Special relativity kinematics, Lorentz factor $\gamma = (1 - v^2/c^2)^{-1/2}$, Lorentz boost coordinate transformations for $(ct, x, y, z)$, relativistic velocity addition theorem $u = (v + w)/(1 + vw/c^2)$, spacetime interval invariance $\Delta s^2 = c^2\Delta t^2 - \Delta x^2$, time dilation, and length contraction.
- **Candidate Crates & Functions:** None present in FrankenSim at the pinned revision. (Kinematic swept-volume charts in `fs-motion` and Minkowski set sums in `fs-query` are unrelated non-relativistic geometry algorithms).
- **Determinism Class:** `Deterministic` (algebraic Minkowski metric transformations and boosts).
- **Existing Tests:** None.
- **`wasm32` Compilation Status:** Not applicable.
- **Identified Gaps:** Zero relativistic kinematics or Lorentz transformation kernels exist in upstream FrankenSim.
- **Proposed Owner Decision:** Upstream owner bead `am-fs-owner-relativity-feh`. Downstream host calculation provided by audited TypeScript reference evaluator (`src/physics/reference/lorentz.ts`).

### 3.6 Family 6: Relativistic Electrodynamics
- **Physical Domain:** Transformation of electric and magnetic field vectors between inertial frames, moving magnet and conductor induction symmetry, $\mathbf{E}'_\parallel = \mathbf{E}_\parallel$, $\mathbf{E}'_\perp = \gamma(\mathbf{E} + \mathbf{v}\times\mathbf{B})_\perp$, $\mathbf{B}'_\parallel = \mathbf{B}_\parallel$, $\mathbf{B}'_\perp = \gamma(\mathbf{B} - \frac{\mathbf{v}}{c^2}\times\mathbf{E})_\perp$, and electromagnetic field invariants $\mathbf{E}^2 - c^2\mathbf{B}^2$ and $\mathbf{E}\cdot\mathbf{B}$.
- **Candidate Crates & Functions:** None present in FrankenSim at the pinned revision.
- **Determinism Class:** `Deterministic`.
- **Existing Tests:** None.
- **`wasm32` Compilation Status:** Not applicable.
- **Identified Gaps:** Zero relativistic Maxwell electrodynamics or field tensor transformations exist in upstream FrankenSim.
- **Proposed Owner Decision:** Upstream owner bead `am-fs-owner-relativity-feh`. Downstream host calculation provided by audited TypeScript reference evaluator (`src/physics/reference/relativisticFields.ts`).

### 3.7 Family 7: Prescribed-Field Particle Dynamics
- **Physical Domain:** Relativistic Lorentz force law $\frac{d\mathbf{p}}{dt} = q(\mathbf{E} + \mathbf{v}\times\mathbf{B})$ with relativistic momentum $\mathbf{p} = \gamma m \mathbf{v}$; trajectory integration for electrons in uniform and crossed electric and magnetic fields; cyclotron radius and longitudinal/transverse acceleration.
- **Candidate Crates & Functions:** None present in FrankenSim at the pinned revision.
- **Determinism Class:** `Deterministic` (symplectic Boris or Runge–Kutta integration with `fs_math::det`).
- **Existing Tests:** None.
- **`wasm32` Compilation Status:** Not applicable.
- **Identified Gaps:** Upstream FrankenSim contains no relativistic charged-particle dynamics integrators.
- **Proposed Owner Decision:** Upstream owner bead `am-fs-owner-relativity-feh`. Downstream host calculation provided by audited TypeScript reference evaluator (`src/physics/reference/lorentzForce.ts`).

### 3.8 Family 8: Relativistic Energy Accounting
- **Physical Domain:** Mass-energy equivalence $\Delta E = \Delta m \cdot c^2$, relativistic kinetic energy $K = (\gamma - 1)mc^2$, directional energy emission in moving frames $E' = E\gamma(1 - \beta\cos\phi)$, and radiation pressure energy transfers.
- **Candidate Crates & Functions:** None present in FrankenSim at the pinned revision.
- **Determinism Class:** `Deterministic`.
- **Existing Tests:** None.
- **`wasm32` Compilation Status:** Not applicable.
- **Identified Gaps:** Upstream FrankenSim contains no relativistic energy accounting or Doppler radiation balance modules.
- **Proposed Owner Decision:** Upstream owner bead `am-fs-owner-relativity-feh`. Downstream host calculation provided by audited TypeScript reference evaluator (`src/physics/reference/massEnergy.ts`).

### 3.9 Family 9: Evidence and Uncertainty
- **Physical Domain:** Verification certificates, measurement uncertainty bounds, model-form discrepancy tracking, sensitivity analysis, and cryptographic provenance chaining.
- **Candidate Crates & Functions:**
  - `crates/fs-evidence/src/lib.rs:928`: `pub struct Evidence<T>` (carries `value`, `qoi`, `numerical: NumericalCertificate`, `statistical: StatisticalCertificate`, `model: ModelEvidence`, `sensitivity: SensitivitySummary`, and `provenance: ProvenanceHash`).
  - `crates/fs-blake3/src/lib.rs:377`: `pub fn hash_bytes` and line 390 `pub struct DomainHasher`.
  - `crates/fs-ivl`: Validated interval arithmetic (`Interval`).
- **Determinism Class:** `Deterministic` (`crates/fs-evidence/CONTRACT.md:120`, `crates/fs-blake3/CONTRACT.md:95`).
- **Existing Tests:** `crates/fs-evidence/tests/`; `crates/fs-blake3/tests/`.
- **`wasm32` Compilation Status:** Compiles to `wasm32`.
- **Identified Gaps:** Upstream `fs-evidence` is heavily specialized for complex multi-physics finite element engineering pipelines; needs adapter layer for scientific paper claims and historical experimental evidence.
- **Proposed Owner Decision:** Upstream owner bead `am-fs-owner-evidence-rk7`. Downstream consumption via `src/physics/evidenceLedger.ts`.

---

## 4. Native and wasm32 Build Probe

**Lane:** A (PinkKnoll, grok-4.6 / grok-cli)  
**Bead:** `am-fs-capability-audit-byc` requirement 4  
**This file is a merge source only.** It does not modify `docs/FRANKENSIM_BINDING.md`.  
**Discipline:** every command below is one that was actually run in this execution. Line numbers were produced by `rg -n` / `grep -n` against the git-archive tree at the moment of citation. Failed builds are results.

---

### 4.0 Probe identity (do not reuse)

| Field | Value |
|---|---|
| `logRunId` / `toolRunId` | `20260915T204024Z-fa82f3e8` |
| FrankenSim pin | `5bbbfae6f7de614422f6f97f5798a3e00f8ad813` |
| Build root | `artifacts/wasm-build/probe-5bbbfae6f7de614422f6f97f5798a3e00f8ad813/20260915T204024Z-fa82f3e8/` |
| Probe JSONL (user path) | `artifacts/frankensim-probe/20260915T204024Z-fa82f3e8/probe.jsonl` (22851 bytes, 17 records) |
| Probe JSONL (bead path) | `artifacts/test-logs/frankensim-probe/20260915T204024Z-fa82f3e8.jsonl` |
| Created UTC | `2026-09-15T20:40:24Z` |
| Suite | `frankensim-probe` |
| `CARGO_TARGET_DIR` | three dirs inside the build root: `cargo-target-native`, `cargo-target-fswasm`, `cargo-target-probe` |

The first setup script aborted at `rch check` exit 2 because of `set -e`. The same `toolRunId` directory was then completed (archives, commands). It was not cleared. A new directory was not created.

---

### 4.1 What was actually run: git archive (never wrote live siblings)

`git -C <live-repo> archive --format=tar <rev> | tar -C <build-root>/<name> -xf -`

Live FrankenSim HEAD at porcelain-before: `135b00088677e5bb854d4da07c67517b2ff96b7e` (not the pin). The archive used the pin, not HEAD.

| Tree | Revision archived | Exit | Duration s | Files | Bytes |
|---|---|---|---|---|---|
| `frankensim/` | `5bbbfae6f7de614422f6f97f5798a3e00f8ad813` | 0 | 1.589 | 3519 then 3522 after probe crate | 201129088 then 201133770 |
| `asupersync/` | `5adf01082b14de1d7bd2c9d9da9779d5502cb4bc` (binding §1.3) | 0 | 4.062 | 18934 | 240971023 |
| `franken_networkx/` | `25827f857ee9a2f76852118f62e55a872e72d8e7` (live HEAD; this bead does not pin it) | 0 | 10.278 | 71753 | 350378472 |
| `franken_numpy/` | `90eb5822cd110efddf9649525897ad22c3d9c2a2` (live HEAD) | 0 | 1.178 | 4904 | 104346255 |
| `frankenscipy/` | `7fbb6aaad342d6dcf9c0e350c503ce17426a4892` (live HEAD) | 0 | 2.924 | 8309 | 473517250 |

Relative layout check actually run: from `frankensim/crates/fs-wasm`, `../../../asupersync` resolved to the archived sibling and `isdir` was true. The same `../../../franken_networkx/crates/fnx-classes` layout is what `fs-truss` and `fs-sparse` declare.

Archive isolation check actually run: live `/Users/jemanuel/projects/frankensim` != archive path under `artifacts/`.

`frankensqlite` was **not** archived. Native workspace load later failed on that missing sibling (see 4.5). `frankentorch` was **not** archived.

Scratch-copy-only addition (not in the pin): `frankensim/crates/am-probe-capability/{Cargo.toml,src/lib.rs}` plus a generated `Cargo.lock` (16 packages). That crate is not in the live FrankenSim tree.

---

### 4.2 rch posture (reported, not hidden)

Commands actually run:

- `rch check` at 20:40:24Z and again at 20:41:34Z: **exit 2**. First abort text: `Worker wsurf is unreachable`. Snapshot file: `Worker hz4 is unreachable`.
- `rch status` at 20:41:34Z (saved as `artifacts/frankensim-probe/20260915T204024Z-fa82f3e8/rch-before.txt`, 6108 bytes):
  - Daemon PID 26931, version 1.0.64, uptime 141h 21m
  - **Posture: degraded**
  - **Workers: 8/13 healthy**, 53/81 slots
  - Earlier in the same session, a previous `rch status` printed 9/13 healthy. Both numbers were observed. The snapshot on disk is 8/13.
- `which cargo` / `type cargo`: `/Users/jemanuel/.rch/shims/cargo`
- `wasm-pack --version`: `wasm-pack 0.13.1` at `/Users/jemanuel/.cargo/bin/wasm-pack`
- `wasm-bindgen` CLI: **not on PATH** (`command not found`)
- `rustc +nightly-2026-07-06 --version`: `rustc 1.99.0-nightly (3659db0d3 2026-07-05)`
- Host disk during probe: 30 GiB then 27 GiB free (93% then 94% on `/System/Volumes/Data`)

Shim behavior actually observed:

- `CARGO_TARGET_DIR` forwarding was detected and rewritten for remote execution.
- First native `cargo test` and first probe `cargo build`: **exit 103**, `[RCH] remote required; refusing local fallback (no admissible workers: critical_pressure=2,insufficient_slots=1,hard_preflight=6)`.
- First fs-wasm `cargo check --locked --target wasm32-unknown-unknown`: rch selected **hz3**, synced **12 files / 108497 bytes** (the nested `crates/fs-wasm` crate only), then remote cargo exit 101 because `/data/projects/.../frankensim/crates/fs-ad/Cargo.toml` was missing on the worker. That is incomplete path-dependency sync of a nested workspace, not a compile error in `fs-ad`.
- Probe crate remote path: rch planner **RCH-E415** because `fs-math` `dev-dependencies` name `../../../frankenscipy/crates/fsci-special` (even though the probe crate does not use that dev-dep). After frankenscipy was archived, local bypass was used.

`RCH_CARGO_WRAPPER_BYPASS=1` was then used as **separately logged testIds** (not silent retries). `which cargo` remained the shim; `cargo --version` under bypass printed `cargo 1.100.0-nightly (e8cb624d5 2026-08-22)`. Builds from the archive still selected `nightly-2026-07-06` via `frankensim/rust-toolchain.toml` (archive lines 14–16: `channel = "nightly-2026-07-06"`).

---

### 4.3 Command log (JSONL `logRunId=20260915T204024Z-fa82f3e8`)

Every failing command kept a transcript and an `.env.txt` under `artifacts/frankensim-probe/20260915T204024Z-fa82f3e8/`. Working directories were inside the build root. No command used `~/projects/frankensim` as cwd.

| testId | cwd | command | exit | durationMs | outcome |
|---|---|---|---|---|---|
| `native-test-fs-rand` | archive `frankensim/` | `cargo test --locked -p fs-rand` | 103 | 18809 | fail (rch, no rustc) |
| `native-test-fs-math-fs-sparse` | archive `frankensim/` | `cargo test --locked -p fs-math -p fs-sparse` | 103 | 33 | fail (rch, no rustc) |
| `fswasm-cargo-tree` | archive `crates/fs-wasm` | `cargo tree --locked` | 101 | 414 | fail |
| `fswasm-cargo-check-wasm32` | archive `crates/fs-wasm` | `cargo check --locked --target wasm32-unknown-unknown` | 101 | 21115 | fail |
| `fswasm-wasm-pack-dev-web` | archive `crates/fs-wasm` | `wasm-pack build --dev --target web --out-dir <build-root>/fs-wasm-pkg -- --locked` | 1 | 106 | fail |
| `probe-cargo-tree` | scratch `am-probe-capability` | `cargo tree` | 0 | 450 | **pass** |
| `probe-generate-lockfile` | scratch `am-probe-capability` | `cargo generate-lockfile` | 0 | 131 | **pass** |
| `probe-cargo-build-wasm32` | scratch `am-probe-capability` | `cargo build --target wasm32-unknown-unknown` | 103 | 18317 | fail (rch) |
| `probe-wasm-pack-dev-web` | scratch `am-probe-capability` | `wasm-pack build --dev --target web --out-dir <build-root>/probe-pkg` | 1 | 421 | fail (cargo 103) |
| `native-test-fs-rand-local-bypass` | archive `frankensim/` | `RCH_CARGO_WRAPPER_BYPASS=1 cargo test --locked -p fs-rand` | 101 | 96 | fail |
| `native-test-fs-math-fs-sparse-local-bypass` | archive `frankensim/` | `RCH_CARGO_WRAPPER_BYPASS=1 cargo test --locked -p fs-math -p fs-sparse` | 101 | 126 | fail |
| `fswasm-cargo-tree-siblings-local` | archive `crates/fs-wasm` | bypass `cargo tree --locked` | 101 | 518 | fail |
| `fswasm-cargo-check-wasm32-siblings-local` | archive `crates/fs-wasm` | bypass `cargo check --locked --target wasm32-unknown-unknown` | 101 | 406 | fail |
| `fswasm-wasm-pack-dev-web-siblings-local` | archive `crates/fs-wasm` | bypass `wasm-pack build --dev --target web --out-dir ... -- --locked` | 1 | 83764 | fail |
| `probe-cargo-build-wasm32-local-bypass` | scratch probe crate | bypass `cargo build --target wasm32-unknown-unknown` | 101 | 19753 | fail (rust-lld) |
| `probe-wasm-pack-dev-web-local-bypass` | scratch probe crate | bypass `wasm-pack build --dev --target web --out-dir ...` | 1 | 761 | fail (rust-lld) |
| `probe-cargo-build-wasm32-dyld-llvm` | scratch probe crate | bypass + `DYLD_LIBRARY_PATH=<pin>/lib cargo build --target wasm32-unknown-unknown` | 101 | 649 | fail (rust-lld still) |

CI command source, grep -n on the archive: `docs/CI_GATES.md` line 353 is `A `wasm-pack build --dev --target web -- --locked` browser build whose`.

---

### 4.4 Native `cargo test` of the audited slice

Audited-slice intent: `fs-rand`, `fs-math`, `fs-sparse` (the three crates the first exports need). `fs-wasm` has no `tests/` directory at the pin (confirmed by `git ls-tree` on the pin before archive).

**Result: no native test body executed.**

1. Shim path (testIds `native-test-fs-rand`, `native-test-fs-math-fs-sparse`): exit 103, no rustc. Transcript 476 bytes, rch refusal only.
2. Local bypass (testIds `*-local-bypass`): exit 101 in 96 ms / 126 ms. Exact cargo error:

```
error: failed to load manifest for workspace member
  .../frankensim/crates/fs-flywheel-e2e
Caused by: failed to load manifest for dependency `fs-ledger`
Caused by: failed to load manifest for dependency `fsqlite`
Caused by: failed to read
  .../frankensqlite/crates/fsqlite/Cargo.toml
```

So `cargo test -p fs-rand --locked` from the FrankenSim **root workspace** cannot even load the workspace without sibling `frankensqlite`, because `fs-flywheel-e2e` is a workspace member. That is independent of whether `fs-rand` itself needs `fsqlite`.

`fs-math` / `fs-sparse` integration tests additionally declare `fsci-special` / `fsci-sparse` at `version = "=0.1.0"`. The archived frankenscipy workspace.package.version is **0.2.0** (`Cargo.toml` lines 26–28 of live frankenscipy, confirmed `rg -n`). Those tests were not reached.

`fs-rand` itself has no frankenscipy path dep. Its `[dependencies]` is only `fs-math` (archive `crates/fs-rand/Cargo.toml` line 14). Its tests were not reached because of the workspace-member load failure above.

---

### 4.5 `cargo tree --locked` and `cargo check --locked --target wasm32-unknown-unknown` for `fs-wasm`

Nested workspace: archive `crates/fs-wasm/Cargo.toml` line 11 `[workspace]`, line 15 `crate-type = ["cdylib", "rlib"]`. No `[features]` table: `rg -n "\[features\]"` on that file exited 1.

#### First attempt (frankensim + asupersync only)

`fswasm-cargo-tree` exit 101. Actual error:

```
failed to get `fnx-classes` as a dependency of package `fs-truss v0.0.1`
unable to update .../franken_networkx/crates/fnx-classes
```

Citation, grep -n on the archive at that moment:

- `crates/fs-wasm/Cargo.toml:63`: `fs-truss = { path = "../fs-truss" }`
- `crates/fs-truss/Cargo.toml:14`: `fnx-classes = { path = "../../../franken_networkx/crates/fnx-classes" }` (not optional)
- `crates/fs-sparse/Cargo.toml:18`: `fnx-classes = { path = "../../../franken_networkx/crates/fnx-classes", optional = true }`

`fs-sparse` constellation deps being optional does **not** make `fs-wasm` resolvable: `fs-truss` is an unconditional `fs-wasm` dependency and its `fnx-classes` path is required.

`fswasm-cargo-check-wasm32` exit 101 after rch synced only the nested crate (see 4.2). Remote rustc never saw `../fs-ad`.

`fswasm-wasm-pack-dev-web` exit 1 in 106 ms: same missing `fnx-classes` via `cargo metadata`.

#### After archiving franken_networkx + franken_numpy + frankenscipy

`fswasm-cargo-tree-siblings-local` and `fswasm-cargo-check-wasm32-siblings-local` exit 101 with:

```
error: cannot update the lock file .../crates/fs-wasm/Cargo.lock because --locked was passed
```

`fswasm-wasm-pack-dev-web-siblings-local` ran 83764 ms and **did compile** a large slice of the kitchen-sink graph (including `fnx-classes v0.3.0`, `asupersync v0.5.0`, `fs-math`, `fs-blake3`, `fs-sos`, `web-sys`, …) then failed:

```
error: feature `native-runtime` is forbidden on wasm32 browser builds.
   --> .../asupersync/src/lib.rs:129:1
```

grep -n on the archived asupersync at citation time:

- `asupersync/src/lib.rs:128`: `#[cfg(all(target_arch = "wasm32", feature = "native-runtime"))]`
- `asupersync/src/lib.rs:129`: `compile_error!("feature `native-runtime` is forbidden on wasm32 browser builds.");`
- `asupersync/Cargo.toml:137`: `default = ["proc-macros", "nightly-outcome-try", "runtime-core", "native-runtime"]`

`fs-wasm` itself requests the browser profile at `crates/fs-wasm/Cargo.toml:104`:

```
asupersync = { path = "../../../asupersync", default-features = false, features = ["wasm-browser-prod"] }
```

Unconditional `fs-wasm` path deps that pull asupersync **with default features** (grep -n on those manifests):

| Crate | Line | Manifest line |
|---|---|---|
| `fs-cheb` | 21 | `asupersync = { path = "../../../asupersync" }` |
| `fs-fft` | 22 | `asupersync = { path = "../../../asupersync" }` |
| `fs-geom` | 23 | `asupersync = { path = "../../../asupersync" }` |
| `fs-rep-mesh` | 23 | `asupersync = { path = "../../../asupersync" }` |
| `fs-render` | 28 | `asupersync = { path = "../../../asupersync" }` |
| `fs-exec` | 14 | `asupersync = { path = "../../../asupersync" }` |

`fs-wasm/Cargo.toml` line 22 is `fs-cheb`, line 27 `fs-fft`, line 31 `fs-geom`. Those crates are in the shipped `fs-wasm` graph. A `wasm32-unknown-unknown` build of the full package at these pins therefore activates `native-runtime` on wasm32 via a default-features path dep, which asupersync `5adf010` rejects.

**No `fs-wasm` `.wasm` was produced.** `fs-wasm-pkg/` stayed empty.

---

### 4.6 Probe capability crate (scratch copy only)

Path: `artifacts/wasm-build/probe-.../frankensim/crates/am-probe-capability/`  
Own `[workspace]`. Depends only on `fs-rand`, `fs-sparse`, `fs-math` (path `../...`). wasm32-only `wasm-bindgen = "=0.2.126"`. Touches `StreamKey`, `det::sqrt`, `Coo::new` / `push` / `assemble`.

Public API citations, grep -n on the archive:

- `crates/fs-rand/src/lib.rs:134` `pub struct StreamKey {` with `pub seed`, `pub kernel`, `pub tile` at 136–140
- `crates/fs-math/src/lib.rs:29` `pub mod det;`
- `crates/fs-math/src/det.rs:238` `pub fn sqrt(x: f64) -> f64 {`
- `crates/fs-sparse/src/lib.rs:61` `pub struct Coo {`
- `crates/fs-sparse/src/lib.rs:84` `pub fn push`
- `crates/fs-sparse/src/lib.rs:111` `pub fn assemble`

#### Graph (`probe-cargo-tree` exit 0, 450 ms)

```
am-probe-capability v0.0.1 (...)
├── fs-math v0.0.1 (...)
├── fs-rand v0.0.1 (...)
│   └── fs-math v0.0.1 (...)
└── fs-sparse v0.0.1 (...)
```

Zero `asupersync`. Zero `getrandom`. Zero upper-stack crates. Lockfile (`cargo generate-lockfile` exit 0) has 16 `name =` entries: the three leaf crates plus the wasm-bindgen 0.2.126 stack (`bumpalo`, `cfg-if`, `once_cell`, `proc-macro2`, `quote`, `rustversion`, `syn`, `unicode-ident`, `wasm-bindgen`, `wasm-bindgen-macro`, `wasm-bindgen-macro-support`, `wasm-bindgen-shared`).

`fs-sparse` optional constellation features stayed off. The resolved graph does not include `fnx-classes`.

#### wasm32 compile

`cargo build --target wasm32-unknown-unknown` under local bypass **compiled** `fs-math`, `fs-rand`, `fs-sparse`, and `am-probe-capability` then **failed at link**. rust-lld SIGABRT:

```
dyld: Library not loaded: @rpath/libLLVM.dylib
Referenced from: .../nightly-2026-07-06-aarch64-apple-darwin/lib/rustlib/aarch64-apple-darwin/bin/rust-lld
tried: .../bin/../lib/libLLVM.dylib (no such file)
```

Host fact actually checked with `ls`:

- Present: `/Users/jemanuel/.rustup/toolchains/nightly-2026-07-06-aarch64-apple-darwin/lib/libLLVM.dylib` (133 MB)
- Missing: `.../lib/rustlib/aarch64-apple-darwin/lib/libLLVM.dylib` (the rpath rust-lld uses)
- `nightly-2026-08-31` **does** have `lib/rustlib/aarch64-apple-darwin/lib/libLLVM.dylib`

`DYLD_LIBRARY_PATH=<pin>/lib` (testId `probe-cargo-build-wasm32-dyld-llvm`, 649 ms) did not change the rpath search list. Still no `.wasm`.

#### Sizes actually measured

No probe `.wasm` exists. Debug rlibs left in `cargo-target-probe/wasm32-unknown-unknown/debug/deps/` after the failed link (python `os.path.getsize`):

| File | Bytes |
|---|---|
| `libfs_math-c85232864c457585.rlib` | 1014520 |
| `libfs_rand-8d2cc63f75eb30e3.rlib` | 2556014 |
| `libfs_sparse-4d8feafaf64d6925.rlib` | 5093470 |
| `libwasm_bindgen-43c22fb3d761d28b.rlib` | 3290420 |
| `libwasm_bindgen_shared-4fb73f5f62ce9ec4.rlib` | 1050048 |
| `libonce_cell-6c0355193aeaa03d.rlib` | 60318 |
| `libunicode_ident-df29d3d0b8a30672.rlib` | 56550 |
| `libcfg_if-73dd93f4b98afe75.rlib` | 6322 |

Leaf-crate debug rlibs sum to 8664004 bytes. **That is not a `.wasm` size** and must not be compared as one. It only proves the three crates compiled for `wasm32-unknown-unknown` on the pin toolchain before the host rust-lld rpath defect.

`probe-pkg/` stayed empty. No wasm-pack `.wasm` for the probe crate.

---

### 4.7 Exports actually present in `fs-wasm` at the pin

Source: `rg -n` then a line walk of archive `crates/fs-wasm/src/lib.rs` for `#[wasm_bindgen]` immediately followed by `pub fn`. Count: **37**. All sit under the `cfg(target_arch = "wasm32")` block at the bottom of that file. None of `brownian_frames`, `philox_normals`, or `diffusion1d_frames` exist.

| Line of `#[wasm_bindgen]` | Signature |
|---|---|
| 994 | `pub fn poisson2d(n: usize) -> Vec<f64>` |
| 999 | `pub fn heat_frames(n: usize, frames: usize, steps_per_frame: usize) -> Vec<f64>` |
| 1004 | `pub fn orr_sommerfeld_max_growth(re: f64, alpha: f64, n: usize) -> f64` |
| 1009 | `pub fn orr_sommerfeld_curve(alpha: f64, n: usize, re_min: f64, re_max: f64, steps: usize) -> Vec<f64>` |
| 1020 | `pub fn chebyshev_fit(kind: u32, samples: usize) -> Vec<f64>` |
| 1025 | `pub fn chebyshev_spectrum(kind: u32) -> Vec<f64>` |
| 1030 | `pub fn taylor_bound(center: f64, radius: f64, order: usize) -> Vec<f64>` |
| 1035 | `pub fn autodiff_derivatives(xmin: f64, xmax: f64, samples: usize) -> Vec<f64>` |
| 1040 | `pub fn finite_difference_error(x0: f64, steps: usize) -> Vec<f64>` |
| 1045 | `pub fn randomized_svd(n: usize, rank: usize, seed: u32) -> Vec<f64>` |
| 1050 | `pub fn fft_power_spectrum(n: usize, seed: u32) -> Vec<f64>` |
| 1055 | `pub fn laplacian_modes(n: usize, k: usize) -> Vec<f64>` |
| 1060 | `pub fn qmc_vs_mc(max_log2: usize, seed: u32) -> Vec<f64>` |
| 1065 | `pub fn robust_hull(radius: usize) -> Vec<f64>` |
| 1070 | `pub fn compensated_sum(count: usize, log10_big: i32) -> Vec<f64>` |
| 1079 | `pub fn topopt_frames(nx: usize, ny: usize, iters: usize, volfrac: f64) -> Vec<f64>` |
| 1084 | `pub fn marching_cubes(res: usize, kind: u32, iso: f64) -> Vec<f64>` |
| 1089 | `pub fn sdf_volume(res: usize, kind: u32, t: f64) -> Vec<f64>` |
| 1094 | `pub fn ga_motor_orbit(n_points: usize, steps: usize) -> Vec<f64>` |
| 1099 | `pub fn symplectic_vs_euler(steps: usize, dt: f64) -> Vec<f64>` |
| 1104 | `pub fn lorenz_points(steps: usize, dt: f64, rho: f64) -> Vec<f64>` |
| 1109 | `pub fn wave2d_frames(n: usize, frames: usize, steps_per_frame: usize) -> Vec<f64>` |
| 1114 | `pub fn gray_scott_frames(n: usize, frames: usize, feed: f64, kill: f64) -> Vec<f64>` |
| 1119 | `pub fn mandelbrot_certified(w: usize, h: usize, cx: f64, cy: f64, scale: f64, maxiter: usize) -> Vec<f64>` |
| 1131 | `pub fn fluid_frames(n: usize, frames: usize) -> Vec<f64>` |
| 1140 | `pub fn proofrobust(alpha: f64, sigma: f64, n: usize) -> Vec<f64>` |
| 1145 | `pub fn metamatcert(n: usize, points: usize, rmax: f64) -> Vec<f64>` |
| 1150 | `pub fn fluttercert(lo: f64, hi: f64, steps: usize) -> Vec<f64>` |
| 1155 | `pub fn schedule_campaign(windtunnel_latency: f64, design_b_mean: f64, stop_threshold: f64) -> Vec<f64>` |
| 1164 | `pub fn trusspath(nx: usize, ny: usize, gap_tol: f64) -> Vec<f64>` |
| 1169 | `pub fn sensorforge(threshold: f64, max_sensors: usize, b_prior_mean: f64) -> Vec<f64>` |
| 1174 | `pub fn neuroshape(lift: f64, ring_r: f64, inner: f64) -> Vec<f64>` |
| 1179 | `pub fn grammarforge(match_tol: f64, simplify_radius_threshold: f64) -> Vec<f64>` |
| 1184 | `pub fn anytimebo(max_iters: usize, delta: f64, alpha: f64) -> Vec<f64>` |
| 1189 | `pub fn flowcert(steps: usize, tol: f64) -> Vec<f64>` |
| 1194 | `pub fn run_instrument_reed(blowing_pressure_pa: f64) -> Vec<f64>` |
| 1200 | `pub fn engine() -> String` |

`heat_frames` is present (lines 999–1000). It is the clamped demonstration already recorded in sections 1–3, not an honest diffusion owner.

Because no `fs-wasm` `.wasm` was produced, these 37 names are **source exports**, not instantiated wasm exports.

`crates/fs-wasm/Cargo.lock` at the pin: `wasm-bindgen` version `0.2.126` (lock lines 2399–2402 from `git show` of the pin).

---

### 4.8 Donor museum 4.9 MB comparison

Commands actually run against the donor tree (classic-patents.com, not modified):

```
stat /Users/jemanuel/projects/classic-patents.com/public/wasm/fs-generic/fs_wasm_bg.wasm
```

| Field | Value |
|---|---|
| Path | `classic-patents.com/public/wasm/fs-generic/fs_wasm_bg.wasm` |
| Bytes | **5134779** |
| MiB | 4.896907 |
| SHA-256 | `ba050469d5a3ae56ce3e3be26fa959a06a6194f0287512f7c86f222994e5799f` |
| mtime | 2026-08-25 22:18:49 local (`stat` mtime 1787710729) |
| Neighbors | `fs_wasm.js` 23334 bytes; `fs_wasm.d.ts` 9219 bytes |

Donor citation, grep -n on `classic-patents.com/src/physics/deepWasm.ts`:

- line 5: `` `/wasm/fs-generic/` is probed by `ensureGenericWasm`. Until a slim museum ``
- line 6: `* artifact exists, every HUD stays `ts-fallback`. Do not copy the 4.9 MB`
- line 7: `* kitchen-sink `fs-wasm` pkg. Do not claim WASM unless a module stepped.`

**This probe did not reproduce a 4.9 MB `fs-wasm` artifact.** The kitchen-sink wasm-pack died on asupersync `native-runtime` (4.5). The slim probe crate compiled its rlibs and died on rust-lld (4.6). There is therefore no new `.wasm` byte count to set beside 5134779. The comparison that the bead asked for is:

| Artifact | Bytes | Kind | Status |
|---|---|---|---|
| Donor `fs_wasm_bg.wasm` | 5134779 | prebuilt kitchen-sink wasm, 2026-08-25 | present on disk |
| This probe `fs-wasm` wasm-pack output | (none) | would have been the pin's kitchen sink | **not produced** |
| This probe capability `.wasm` | (none) | fs-rand + fs-sparse + fs-math + wasm-bindgen | **not produced** (rlibs compiled) |

Evidence for slimness is the **cargo tree** (four FrankenSim packages, no asupersync), not a wasm byte count.

---

### 4.9 Live-tree no-write check

`git -C ~/projects/frankensim status --porcelain` and the same for `asupersync`, `franken_networkx`, `franken_numpy`, `frankenscipy`:

- Before (`2026-09-15T20:40:24Z`): empty for all five
- After (`2026-09-15T20:52:52Z`): empty for all five

Files: `artifacts/frankensim-probe/20260915T204024Z-fa82f3e8/porcelain-before.txt` and `porcelain-after.txt`.

Every logged command's `workingDirectory` and `CARGO_TARGET_DIR` resolved under `artifacts/wasm-build/probe-5bbbfae6f7de614422f6f97f5798a3e00f8ad813/20260915T204024Z-fa82f3e8/`. None resolved inside `~/projects/frankensim` or a sibling. FrankenSim HEAD remained `135b00088677e5bb854d4da07c67517b2ff96b7e`.

---

### 4.10 Findings the rest of the binding should consume

These are probe results, not decisions (decisions are other lanes).

1. **A git archive of FrankenSim + asupersync is not enough to resolve `fs-wasm`.** `fs-truss` requires `franken_networkx` (`fnx-classes`, `fnx-runtime`) with no `optional = true`. `fs-sparse`'s optional constellation deps are a different fact.
2. **`cargo test -p fs-rand` from the root workspace requires `frankensqlite`**, because unrelated workspace member `fs-flywheel-e2e` -> `fs-ledger` -> `fsqlite`. The audited slice cannot be tested from the unmodified root workspace without that sibling (or a scratch-only member filter, which this lane did not apply).
3. **`fs-math` / `fs-sparse` test oracles pin frankenscipy `=0.1.0`; current frankenscipy is `0.2.0`.** Native tests of those two crates would fail version checks even after a frankenscipy archive of HEAD.
4. **Kitchen-sink `wasm32` of `fs-wasm` at these pins dies on asupersync default features.** `fs-wasm` asks for `wasm-browser-prod`; `fs-cheb` / `fs-fft` / `fs-geom` / `fs-rep-mesh` / `fs-render` / `fs-exec` ask for default asupersync, whose default includes `native-runtime`, which `asupersync/src/lib.rs:129` forbids on wasm32.
5. **The capability crate graph is small and has no asupersync/getrandom/upper-stack.** That is measured (`cargo tree` exit 0). A `.wasm` byte count for it was not obtained on this host because pin-toolchain `rust-lld` cannot load `libLLVM.dylib` from the rpath it encodes.
6. **rch cannot be treated as a transparent cargo for this nested-archive layout.** Exit 103 (no admissible workers) and a 12-file nested-crate sync that omitted `../fs-ad` were observed. Local bypass was required to reach rustc.
7. **37 wasm_bindgen exports exist in source; none are the three first scientific exports.**

---

### 4.11 Artifact index

```
artifacts/wasm-build/probe-5bbbfae6f7de614422f6f97f5798a3e00f8ad813/20260915T204024Z-fa82f3e8/
  IDENTITY.txt
  frankensim/  asupersync/  franken_networkx/  franken_numpy/  frankenscipy/
  cargo-target-native/  cargo-target-fswasm/  cargo-target-probe/
  fs-wasm-pkg/          (empty)
  probe-pkg/            (empty)
  logs/  env/
  frankensim/crates/am-probe-capability/   (scratch only)
  run_logged.py

artifacts/frankensim-probe/20260915T204024Z-fa82f3e8/
  probe.jsonl
  porcelain-before.txt  porcelain-after.txt  rch-before.txt  IDENTITY.txt
  <testId>.transcript.txt
  <testId>.env.txt          (every failing command)
```

---

## 5. Export Signatures, Buffer Layouts, and Decisions (a) and (b)

**Lane:** B (SandyCedar swarm, 2026-09-15)
**Owning bead:** `am-fs-capability-audit-byc` (this lane writes the export-signature and decision (a)/(b) section only)
**Pinned FrankenSim revision:** `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`
**Grep root (git archive, not the live checkout):**
`artifacts/wasm-build/probe-5bbbfae6f7de614422f6f97f5798a3e00f8ad813/20260915T204024Z-fa82f3e8/frankensim`
**FRANKENSIM_REVISION file:** 41 bytes, contents `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`
**Hard rule observed:** no create or modify under `/Users/jemanuel/projects/frankensim` or siblings. Line numbers below were produced by `grep -n` on the archive files at the moment of citation (commands at the end).

This lane does not write `docs/FRANKENSIM_BINDING.md` or `docs/DECISIONS.md`. Stream kernel ids are decision (c) (another lane). Slim-bundle mechanism is decision (f) (user). Determinism class evidence is decision (e) (another lane). This lane records the **signatures the export beads implement**, the **kernel-2 resolution**, and the **one refusal channel**.

---

### 5.0 Status of the three first exports at the pin

Command run against the archive `crates/fs-wasm/src/lib.rs` (45364 bytes, mtime `2026-09-13T22:22:09-0400`):

```text
grep -n "brownian_frames\|philox_normals\|diffusion1d_frames\|step_kernel" crates/fs-wasm/src/lib.rs
```

Result: no matches. The same three names were grepped in `crates/fs-rand/src/lib.rs` and `crates/fs-demo-physics-wasm/src/lib.rs`; no matches. The wasm_bindgen list at `crates/fs-wasm/src/lib.rs` lines 994–1201 (read after the empty grep) exports `poisson2d`, `heat_frames`, `orr_sommerfeld_max_growth`, and the rest of the demo surface; it does not export the three scientific functions. They are **planned**. Signatures below are the audit's recorded contract for `am-fs-export-brownian-frames-nhm`, `am-fs-export-philox-normals-xnv`, and `am-fs-export-diffusion1d-cew`.

The plan sketch in AGENTS.md still shows a bare `Vec<f64>` return and a parameter named `kernel`. Both are superseded here: the parameter is `step_kernel` (decision (i) of the audit bead, applied in these signatures so the plan's overloaded `kernel` never appears), and the return is the typed envelope of decision (b).

---

### 5.1 Existing exports at the pin (not admitted for scientific use)

These are present. They are cited so implementers do not copy them.

#### 5.1.1 `heat_frames` (anti-pattern)

- **File:** `crates/fs-wasm/src/lib.rs` size 45364 mtime `2026-09-13T22:22:09-0400`
- **Core:** line 252 `pub fn heat_frames(n_in: usize, frames_in: usize, steps_per_frame_in: usize) -> Vec<f64>`
- **Clamps (never copy):** lines 253–255 `n_in.clamp(3, 96)`, `frames_in.clamp(1, 240)`, `steps_per_frame_in.clamp(1, 40)`
- **Layout:** comment at lines 249–250: returns `frames` snapshots concatenated (`frames * n * n`). Index of cell `(i, j)` in frame `f` is `f * n * n + i * n + j` (row-major in the spatial plane, frames concatenated). Confirmed by the loop at lines 273–282: `out.extend_from_slice(&u)` once per frame, `u` length `n * n` (line 256).
- **Physics:** hard-coded two blobs at line 268 `u[i * n + j] = g(0.3, 0.3, 0.07) - g(0.7, 0.68, 0.08)`; dimensionless `dt = 0.20` at line 271; update `u[i] -= dt * au[i]` at lines 277–279 after `a.spmv(&u, &mut au)` with `laplacian_5pt`.
- **Operator:** `laplacian_5pt` at line 169 is the SPD operator `-Δ` (comment line 167: "SPD, `-Δ` up to the `1/h²` scale"), 4.0 on the diagonal (line 176) and -1.0 on neighbors (lines 178–188). This is the **opposite sign** of the planned `diffusion1d_frames` operator.
- **wasm_bindgen:** line 1000 `pub fn heat_frames(n: usize, frames: usize, steps_per_frame: usize) -> Vec<f64>` inside `#[cfg(target_arch = "wasm32")] mod wasm` (line 990). Returns a bare `Float64Array`. No refusal code.
- **House style to refuse:** file header lines 18–20: "Every input is clamped to a safe range and every fallible kernel result is folded to `NaN` / an empty vector". `run_instrument_reed` at lines 119–129: non-finite input "returns an empty block"; finite input is clamped. An unexplained empty buffer is **not** a scientific refusal.

**Verdict:** `heat_frames` is a visual demonstration. It is not an owner for BM-01, BM-05, or BM-06.

#### 5.1.2 `fs-demo-physics-wasm` envelope (the pattern to follow, not the physics)

- **File:** `crates/fs-demo-physics-wasm/src/lib.rs` size 27679 mtime `2026-09-13T22:22:09-0400`
- **CONTRACT.md:** 4582 bytes, same mtime. Envelope frozen at lines 72–80: success `{"ok":{...}}`, refusal `{"refusal":{"code","message","ranked_repairs"}}`. Error model at CONTRACT.md lines 22–25: non-finite or out-of-domain inputs return the envelope; inputs are never silently clamped.
- **Types:** `KERNEL_VERSION` line 27 `"fs-demo-physics-wasm 0.1.0"`; `Refusal` lines 35–39 with `code: &'static str`, `message: String`, `ranked_repairs: Vec<&'static str>`; `Refusal::json` lines 58–70.
- **Split:** `wing_eval_core` line 130 returns `Result<WingOut, Refusal>`; `wing_eval_json` line 266 maps `Ok` to an `{"ok":...}` string with `KERNEL_VERSION` baked in (line 290) and `Err` to `r.json()`. wasm wrapper `wing_eval` lines 561–583 returns `String`.
- **Upstream codes in this crate (not imported by Annus Mirabilis exports):** `input-non-finite` (line 78), `aspect-ratio-non-positive` (line 155), `family-id-out-of-range` (line 164), `non-finite-result` (lines 257 and 494), `span-non-positive` (line 369), `material-id-out-of-range` (line 376), `topology-id-out-of-range` (line 384). These names are **not** the registered codes in `src/experiments/results/refusalCodes.ts`. Decision (b) maps our exports onto the registered set, and does not reuse these strings.

#### 5.1.3 `fs-rand` primitives the new exports call

Archive `crates/fs-rand/src/lib.rs` size 47563 mtime `2026-09-13T22:22:09-0400`; `crates/fs-rand/src/philox.rs` size 6404, same mtime.

| Symbol | Line (grep -n) | Fact used by the exports |
|---|---|---|
| `STREAM_SEMANTICS_VERSION` | 40 | `u32 = 1` |
| `STREAM_CHECKPOINT_VERSION` | 79 | `u32 = 1` |
| `STREAM_CHECKPOINT_MAGIC` | 88 | `*b"FSRCKPT\0"` (8 bytes) |
| `STREAM_CHECKPOINT_CANONICAL_LEN` | 94–97 | `MAGIC.len() + DOMAIN.len() + size_of::<u32>()*4 + size_of::<u64>()*2` = 8+43+16+16 = 83 |
| `StreamKey` | 134–141 | `{ seed: u64, kernel: u32, tile: u32 }` |
| `StreamCheckpoint` | 165–174 | `{ checkpoint_version, stream_semantics_version, key, index }` |
| `StreamCheckpoint::current` | 196 | builds a checkpoint at `(key, index)` |
| `encode_stream_position` | 491–497 | counter `[index as u32, (index >> 32) as u32, tile, kernel]`, key `[seed as u32, (seed >> 32) as u32]` |
| `Stream::at` | 504 | random-access Philox block at `index` |
| `Stream::resume` | 527 | validates versions, then positions the stream |
| `Stream::next_u64` | 546–549 | `(u64::from(block[1]) << 32) \| u64::from(block[0])`; `index = index.wrapping_add(1)` |
| `Stream::next_f64` | 554–555 | `(self.next_u64() >> 11) as f64 * (1.0 / 9_007_199_254_740_992.0)` (comment `2⁻⁵³`). Search both `9_007_199_254_740_992` and `9007199254740992`. |
| `Stream::next_normal` | 579–584 | Box–Muller; **consumes exactly two draws** (doc comment line 577 and 579) |
| `Stream::next_normal_ziggurat` | 591 | fast path, **not admitted** |
| `StreamReplayError` | 323–349 | five variants listed in the mapping table |
| `philox4x32_10` | `philox.rs:31` | 10 rounds; `M0 = 0xD251_1F53` line 8, `M1 = 0xCD9E_8D57` line 9, `W0 = 0x9E37_79B9` line 11, `W1 = 0xBB67_AE85` line 12. Search both underscored and plain hex. |
| `det::sqrt` | `crates/fs-math/src/det.rs:238` | `x.sqrt()` (hardware, 0 ULP) |
| `det::ln` | `det.rs:95` | strict ln |
| `det::cos` | `det.rs:170` | strict cos |

`next_normal` arithmetic, quoted from lines 580–584:

```text
let u = 1.0 - self.next_f64();
let v = self.next_f64();
det::sqrt(-2.0 * det::ln(u)) * det::cos(2.0 * std::f64::consts::PI * v)
```

`2.0 * PI * v` is the documented evaluation of `2πv` (`am-fs-export-philox-normals-xnv` requirement 2). Draw consumption: two `next_f64`, each one `next_u64`, so the stream index advances by 2.

`next_u64` uses `wrapping_add` (line 548). A request whose last draw would wrap the counter must be refused **before** drawing (`stream-index-overflow`).

#### 5.1.4 `fs-sparse` primitives `diffusion1d_frames` calls

Archive `crates/fs-sparse/src/lib.rs` size 25232 mtime `2026-09-13T22:22:09-0400`.

| Symbol | Line | Fact |
|---|---|---|
| `Coo` | 61 | `nrows, ncols, rows, cols, vals` |
| `Coo::new` | 72 | empty staging buffer |
| `Coo::push` | 84 | one triplet; panics on out of range |
| `Coo::assemble` | 111 | stable sort by `(row, col)`, duplicates accumulated in insertion order |
| `Csr::spmv` | 313 | `y = A·x`; each row in ascending column order with fused multiply-add (`fma::spmv_dispatch`, line 326) |

The planned 1D operator uses coefficients `±1` and `-2` only, so each product is exact and fused vs unfused accumulation coincide. The time update itself is **unfused** (decision recorded with the `diffusion1d_frames` signature).

---

### 5.2 Planned export signatures

Crate placement is decision (f) (user). Until that answer is recorded, the signatures are crate-agnostic. Both a feature-gated `fs-wasm` module and a small capability crate implement the same functions, the same layouts, and the same refusal channel. `u64` crosses `wasm_bindgen` as JavaScript `BigInt`.

Declared output budgets (memory, not physics). Crossing them is the execution outcome `budget-exhausted`, never a model refusal:

| Constant | Value | Applies to |
|---|---|---|
| `BROWNIAN_MAX_OUTPUT_LEN` | `2_097_152` (`2^21`) | `n_particles * (steps + 1)` per call of `brownian_frames` or `brownian_frames_window` |
| `PHILOX_NORMALS_MAX_COUNT` | `1_048_576` (`2^20`) | `count` of `philox_normals` |
| `DIFFUSION1D_MAX_OUTPUT_LEN` | `2_097_152` (`2^21`) | `frames * n` |
| `DIFFUSION1D_MAX_TOTAL_STEPS` | `1_048_576` (`2^20`) | `frames * steps_per_frame` |

`n_particles` is also capped by `u32::MAX` because `StreamKey.tile` is `u32` (`lib.rs:140`). The instrument ensemble (10 000) sits well inside both caps. Long trajectories use the window form so one synchronous WASM call stays inside `BROWNIAN_MAX_OUTPUT_LEN`.

#### 5.2.1 `brownian_frames` (one-shot)

```rust
pub fn admit_brownian_frames(
    n_particles: usize,
    steps: usize,
    step_kernel: u32,
    seed: u64,
    diffusion: f64,
    dt: f64,
) -> Result<BrownianFramesSpec, Refusal>;

pub fn brownian_frames_admitted(spec: &BrownianFramesSpec) -> Vec<f64>;

pub fn brownian_frames(
    n_particles: usize,
    steps: usize,
    step_kernel: u32,
    seed: u64,
    diffusion: f64,
    dt: f64,
) -> Result<Vec<f64>, Refusal>;
```

`brownian_frames` is `admit_brownian_frames` then `brownian_frames_admitted`. `brownian_frames_admitted` re-runs admission on any spec that is not the private admitted type, so a forged spec still refuses. The WASM boundary never returns a bare `Vec<f64>` (decision (b)).

**Layout.** Row-major by particle then step. Length `n_particles * (steps + 1)`. Position of particle `p` after `s` steps (including the initial column `s = 0`) is at index

```text
p * (steps + 1) + s
```

Every particle starts at `0.0`. Buffer is `f64` IEEE-754. Native endianness at the Rust boundary; the worker protocol copies into a versioned typed-buffer layout (owned by `am-rt-worker-protocol-gaq`).

**Streams.** Particle `p` uses `StreamKey { seed, kernel: <registered Brownian latent stream kernel id from decision (c)>, tile: p as u32 }`. Draw index starts at 0 and counts draws. Prefix-stable: particle `p` is bitwise identical for ensembles of size `p+1` and of size 10 000. Changing `step_kernel` with the same seed reuses the same streams (common random numbers, never independent trials).

**Purity.** No `std::time`, no ambient entropy, no process-global RNG on `wasm32`. `diffusion = 0` is valid for kernels 0, 1, and 3 and returns a buffer of zeros.

#### 5.2.2 `brownian_frames_window`

```rust
pub fn admit_brownian_frames_window(
    n_particles: usize,
    start_step: usize,
    steps: usize,
    step_kernel: u32,
    seed: u64,
    diffusion: f64,
    dt: f64,
    start_positions: &[f64],
) -> Result<BrownianFramesWindowSpec, Refusal>;

pub fn brownian_frames_window_admitted(spec: &BrownianFramesWindowSpec) -> Vec<f64>;

pub fn brownian_frames_window(
    n_particles: usize,
    start_step: usize,
    steps: usize,
    step_kernel: u32,
    seed: u64,
    diffusion: f64,
    dt: f64,
    start_positions: &[f64],
) -> Result<Vec<f64>, Refusal>;
```

**Layout.** Same as the one-shot form: length `n_particles * (steps + 1)`, index `p * (steps + 1) + s`, first column equal to `start_positions`.

**Draw index (derived, never carried).** Particle `p` resumes at

```text
StreamKey { seed, kernel: <same registered Brownian latent id>, tile: p as u32 }
index = draws_per_step(step_kernel) * start_step
```

`draws_per_step` is 1 for step kernels 0 and 1, and 2 for step kernels 2 and 3.

**Concatenation.** For any split of `S` steps into consecutive windows, concatenating the windows and dropping each later window's first column is **bitwise equal** to `brownian_frames(n_particles, S, ...)`. The one-shot form is implemented as one window from zeros at `start_step = 0`, so the two forms cannot drift.

**Window validation (in addition to the one-shot rules).**

- `steps >= 1`
- `start_positions.len() == n_particles` and every entry finite; else `invalid-parameter`
- `start_step == 0` requires every start position `0.0`; else `invalid-parameter`
- `start_step + steps` does not overflow and the per-call output length is inside `BROWNIAN_MAX_OUTPUT_LEN`
- `draws_per_step * (start_step + steps)` does not exceed `2^64 - 1`; else `stream-index-overflow` with details `{ startIndex, draws, maxIndex }`
- A checkpoint whose `kernel`, `tile`, stream-semantics version, or derived index disagrees with `start_step` refuses as `invalid-parameter` with details `{ reason: "checkpoint-disagreement", field, declared, expected }` (see mapping table)

#### 5.2.3 `philox_normals`

Plan sketch `philox_normals(seed, index, count)` leaves `index` ambiguous. Recorded form:

```rust
pub fn admit_philox_normals(
    seed: u64,
    stream_kernel: u32,
    tile: u32,
    start_index: u64,
    count: usize,
) -> Result<PhiloxNormalsSpec, Refusal>;

pub fn philox_normals_admitted(spec: &PhiloxNormalsSpec) -> Vec<f64>;

pub fn philox_normals(
    seed: u64,
    stream_kernel: u32,
    tile: u32,
    start_index: u64,
    count: usize,
) -> Result<Vec<f64>, Refusal>;
```

`stream_kernel` is a **registry stream kernel id** from decision (c), not a Brownian step kernel. `start_index` counts **draws**, not normals.

**Semantics.** `Stream::resume(StreamCheckpoint::current(StreamKey { seed, kernel: stream_kernel, tile }, start_index))`. Each output is strict `next_normal` (lines 579–584). Ziggurat is not used.

**Layout.** Length `count`. Entry `i` is the normal produced from draws `start_index + 2*i` and `start_index + 2*i + 1`. The sequence starting at draw `2k` equals the suffix of the sequence starting at draw 0 from the `k`-th normal onward.

**Boundary.** `start_index + 2 * count` is checked with checked arithmetic before any draw. Accepted: `start_index = 18446744073709551613`, `count = 1` (draws at `2^64-3` and `2^64-2`). Refused: `start_index = 18446744073709551614`, `count = 1` (would consume `2^64-2` and wrap to 0). Code `stream-index-overflow`, details `{ startIndex, draws: 2, maxIndex: 18446744073709551615 }`.

**Quantity.** Each value is a dimensionless standard-normal sample. It does not bind `positionCoordinate1d` or `latentPosition1d`. No paper quantity is attached at the export; consumers bind the samples into their own quantities (LQ-05 configuration counts, BM-07 synthetic noise) after the draw.

#### 5.2.4 `diffusion1d_frames`

```rust
pub fn admit_diffusion1d_frames(
    n: usize,
    frames: usize,
    steps_per_frame: usize,
    diffusion: f64,
    dx: f64,
    dt: f64,
    profile: u32,
) -> Result<Diffusion1dSpec, Refusal>;

pub fn diffusion1d_frames_admitted(spec: &Diffusion1dSpec) -> Vec<f64>;

pub fn diffusion1d_frames(
    n: usize,
    frames: usize,
    steps_per_frame: usize,
    diffusion: f64,
    dx: f64,
    dt: f64,
    profile: u32,
) -> Result<Vec<f64>, Refusal>;
```

**Layout.** Length `frames * n`. Cell `i` of frame `f` is at index `f * n + i`. Frame 0 is the initial profile. Each later frame follows `steps_per_frame` FTCS steps. Cell centers `x_i = (i as f64 + 0.5) * dx`.

**Operator `L` (sign opposite `laplacian_5pt`).** Assemble with `Coo::new(n, n)`, `push` in ascending column order, `assemble` to `Csr`:

- row 0: `(0,0) = -1`, `(0,1) = +1`
- interior row `i`: `(i, i-1) = +1`, `(i, i) = -2`, `(i, i+1) = +1`
- row `n-1`: `(n-1, n-2) = +1`, `(n-1, n-1) = -1`

This is the mirrored-ghost zero-flux discretisation of `+Δ` without the `1/dx^2` factor. Every column sums to zero.

**Update.** `y = L u` via `Csr::spmv`. Then `u_i <- u_i + r * y_i` with **unfused** multiply and add (never `mul_add`), every cell from the previous field.

**Stability ratio.** `r = (diffusion * dt) / (dx * dx)` in exactly that order. Refuse when `r > 0.5` with **no epsilon**. `r = 0.5` is admissible. Code `ftcs-unstable`, details `{ ratio, limit: 0.5, dtMax }` where `dtMax = (dx * dx) / (2.0 * diffusion)`, ranked repairs: use `dt = dtMax`; increase `dx` to at least `sqrt(2 D dt)`; reduce `diffusion` to at most `dx^2 / (2 dt)`. Never return a partially integrated field.

The documented order matters. The export bead's planted case `diffusion = 0.1`, `dx = 0.1`, `dt = 0.05` gives exactly 0.5 under `(diffusion * dt) / (dx * dx)` and a value that would refuse under `diffusion * dt / dx / dx`.

**Profiles.**

| `profile` | Name | Definition | Mass `sum_i u_i dx` | Quantity id |
|---|---|---|---|---|
| 0 | spike | unit mass in center cell `i_c = n/2` (floor), value `1.0 / dx`, else 0 | 1 | `probabilityDensity` |
| 1 | step | `u_i = 1` for `i < n/2` (floor), else 0 | `floor(n/2) * dx` (not unit mass) | `probabilityDensity` with an explicit CONTRACT note that the field is unnormalised; consumers must not treat it as a unit-mass density |
| 2 | two spikes | value `0.5 / dx` at `floor(n/4)` and `floor(3n/4)` | 1 | `probabilityDensity` |

Unknown `profile` is `unsupported-kernel`. `diffusion = 0` is valid and returns constant frames equal to the initial profile.

`probabilityDensity` is the registry id (L⁻¹, one-dimensional) from `am-not-quantity-registry-2f7`. Grid spacing binds `gridSpacing`; the time step binds `timeStep`. The field coordinate of cell `i` binds `positionCoordinate1d`. The **buffer values** bind `probabilityDensity`, never `positionCoordinate1d`.

---

### 5.3 Decision (a): step-kernel scaling for `brownian_frames`

#### Resolution chosen

**`distinct-meaning`.** Not an alias.

Under the recommended physical scaling, the plan's kernel 2 ("Gaussian") and kernel 3 ("Gaussian with the exact D so ⟨x²⟩ = 2Dt") coincide in distribution. Two ids with silently identical meaning are forbidden. The two admissible resolutions were: (1) give kernel 2 a distinct documented meaning, or (2) make id 2 a documented alias of id 3 with an explicit stream-semantics decision.

This audit takes **(1)**. Kernel 2 is a dimensionless unit-variance Gaussian teaching walk. The export refuses to label it physical. Kernel 3 is the physically scaled Gaussian with per-step variance `2 D dt`. Ids 2 and 3 are not aliases: they do not produce bitwise-identical trajectories for generic `D` and `dt`, they bind different quantity ids, and removing id 2 later is a stream-semantics version bump because tapes may have recorded `step_kernel = 2`.

Why not alias. An alias that is "not part of the golden surface" can be removed without a version bump and break every tape that used it (audit pitfall). An alias that is part of the surface still leaves two ids with the same meaning, which the test harness must then special-case forever. The plan already distinguished "Gaussian" from "Gaussian with the exact D". Keeping that distinction, with kernel 2 refused for physical labels, is the honest reading.

Common-random-number note (not alias identity). Kernels 2 and 3 consume the same two draws per step from the same stream. When `s = (2.0 * diffusion * dt).sqrt()` equals `1.0` exactly, kernel 3's `next_normal() * 1.0` is bitwise equal to kernel 2's `next_normal()` for finite values (IEEE-754 `x * 1.0 = x`). That is a reconstruction test, not a licence to treat the ids as one. For any other `s`, `x += z * s` is not a bitwise scaled copy of the kernel-2 path, because the scale is applied per increment in `f64`.

#### Exact arithmetic (all kernels)

Scale factors are computed **once per call**, not per particle and not per step, in the stated operator order. Positions accumulate `x = x + step` in `f64` from the start value (0.0 for the one-shot form). `det::sqrt` is the hardware square root (`det.rs:238`). The ziggurat path (`next_normal_ziggurat`, line 591) is never used.

A computed `s * s` is not always exactly `2 D dt` in floating point. Coin mean-square tests use a rounding-level tolerance, not equality.

#### Per-kernel table

##### Kernel 0: coin (physical)

- **Distribution.** Two-point: step `+s` or `-s` with equal probability. `s = (2.0 * diffusion * dt).sqrt()`. Draw `u = next_u64()` (one draw). Step is `+s` if `u >> 63 == 1`, otherwise `-s`.
- **Support.** `{+s, -s}`.
- **Per-step variance (reals).** `s² = 2 D dt`. Fourth moment `μ₄ = σ⁴ = (2 D dt)²`.
- **Draws per step.** 1 (`next_u64`). After `S` steps the particle's stream index is `S`.
- **Position unit.** metre (SI inputs).
- **Quantity id.** `latentPosition1d` (length). Never a dimensionless id.
- **Physical label.** Admitted. Execution label "Ideal model, computed with FrankenSim" is earnable after an accepted call.

##### Kernel 1: uniform (physical)

- **Distribution.** `u = next_f64()` in `[0, 1)` via the 53-bit ladder (`lib.rs:554–555`). `h = (6.0 * diffusion * dt).sqrt()`. Step `(2.0 * u - 1.0) * h`.
- **Support.** `[-h, h)`. `+h` is excluded; `-h` is included. The one-ulp endpoint asymmetry is documented. The mean is O(`h / 2^53`), not a second physical parameter.
- **Per-step variance (reals).** For Unif`[-h, h)` the variance is `(2h)²/12 = h²/3`. `h² = 6 D dt`, so `h²/3 = 2 D dt`. Fourth moment `μ₄ = 9 σ⁴ / 5`.
- **Draws per step.** 1 (`next_f64` = one `next_u64`). After `S` steps the index is `S`.
- **Position unit.** metre.
- **Quantity id.** `latentPosition1d`.
- **Physical label.** Admitted.

##### Kernel 2: unit Gaussian teaching walk (dimensionless)

- **Distribution.** Standard normal. `z = next_normal()` (Box–Muller, lines 579–584). Step `z` with **no** multiplication by `s`.
- **Support.** ℝ, in `f64`.
- **Per-step variance.** 1 (step units). Fourth moment `μ₄ = 3`.
- **Draws per step.** 2. After `S` steps the index is `2S`.
- **`diffusion` and `dt`.** Validated with the same finiteness and sign rules as the physical kernels so the call shape is uniform, and **they do not scale the step**. Changing `D` or `dt` with a fixed seed therefore yields the same path. A test that expects physical scaling from kernel 2 is a failing test of the host, not of the export.
- **Position unit.** step unit (dimensionless). **Not metre.**
- **Quantity id.** `walkStepCoordinate1d`, **requested** from `am-not-quantity-registry-2f7` (no existing dimensionless walk-coordinate id; `stepRms` is length, `stepInterval` is time, `positionCoordinate1d` / `latentPosition1d` / `displacement1d` are length). `dimensionlessKind` to be recorded by that bead as a coordinate in step units, permitted unit `1` (step). **A dimensionless output binds this id, never `positionCoordinate1d`.** The protocol decoder's unit check must reject any attempt to attach metres or `positionCoordinate1d` to a kernel-2 buffer.
- **Physical label.** **Refused.** CONTRACT.md and the ok-envelope `quantityId` / `unit` fields carry the dimensionless id. A host that prints "metres" or claims Stokes–Einstein D for a kernel-2 buffer is wrong even if the WASM call succeeded. BM-01's physical tracer ensemble uses kernel 3 (or 0 or 1). BM-05 may use kernel 2 as the unit-step teaching walk beside the physically scaled kernels.

##### Kernel 3: Gaussian with exact D (physical)

- **Distribution.** `z = next_normal()`; `s = (2.0 * diffusion * dt).sqrt()` once per call; step `z * s`.
- **Support.** ℝ, in `f64`.
- **Per-step variance (reals).** `s² = 2 D dt`. At step boundary `s` (time `t = s dt`), `⟨x²⟩ = 2 D t`. Fourth moment `μ₄ = 3 σ⁴`.
- **Draws per step.** 2. After `S` steps the index is `2S`.
- **Position unit.** metre.
- **Quantity id.** `latentPosition1d`.
- **Physical label.** Admitted. This is the kernel BM-01 uses for the physical ensemble and the kernel whose mean-square growth BM-05 compares with the coin and the uniform.

Because every physical kernel starts at 0, the stored values are numerically also displacements from the origin (`displacement1d`). The buffer still binds `latentPosition1d` (the latent path). Field coordinates of a PDE grid bind `positionCoordinate1d` and are not this export.

#### Machine-readable kernel-resolution block

Parsed by `scripts/verify-frankensim-binding.test.ts` (planned). A block that declared ids 2 and 3 with identical meaning and no alias decision would fail; this block does not.

```kernel-resolution
resolution: distinct-meaning
aliasOf3: false
streamSemantics: kernel-2-is-not-an-alias
notes: >
  Plan kernels 2 and 3 coincide under physical scaling.
  Kernel 2 is a dimensionless unit-variance Gaussian teaching walk.
  Kernel 3 is the physically scaled Gaussian with per-step variance 2 D dt.
  Removing id 2 later is a STREAM_SEMANTICS_VERSION bump.
kernels:
  - id: 0
    name: coin
    family: physical
    drawsPerStep: 1
    rng: next_u64
    arithmetic: "s = (2.0 * diffusion * dt).sqrt(); u = next_u64(); step = if u >> 63 == 1 { s } else { -s }; x = x + step"
    support: "{+s, -s}"
    variance: "2 * diffusion * dt"
    fourthMomentOverSigma4: 1
    positionUnit: metre
    quantityId: latentPosition1d
    physicalLabel: admitted
  - id: 1
    name: uniform
    family: physical
    drawsPerStep: 1
    rng: next_f64
    arithmetic: "h = (6.0 * diffusion * dt).sqrt(); u = next_f64(); step = (2.0 * u - 1.0) * h; x = x + step"
    support: "[-h, h)"
    variance: "h^2 / 3 = 2 * diffusion * dt"
    fourthMomentOverSigma4: 1.8
    positionUnit: metre
    quantityId: latentPosition1d
    physicalLabel: admitted
  - id: 2
    name: unit-gaussian-teaching
    family: dimensionless-teaching
    drawsPerStep: 2
    rng: next_normal
    arithmetic: "z = next_normal(); step = z; x = x + step"
    support: "R"
    variance: "1"
    fourthMomentOverSigma4: 3
    positionUnit: step
    quantityId: walkStepCoordinate1d
    quantityIdStatus: requested-from-am-not-quantity-registry-2f7
    physicalLabel: refused
    bindsPositionCoordinate1d: false
  - id: 3
    name: gaussian-exact-D
    family: physical
    drawsPerStep: 2
    rng: next_normal
    arithmetic: "s = (2.0 * diffusion * dt).sqrt(); z = next_normal(); step = z * s; x = x + step"
    support: "R"
    variance: "2 * diffusion * dt"
    fourthMomentOverSigma4: 3
    positionUnit: metre
    quantityId: latentPosition1d
    physicalLabel: admitted
unsupportedStepKernel: unsupported-kernel
```

`walkStepCoordinate1d` is a request to `am-not-quantity-registry-2f7`. Until that bead records it, export tests and the protocol decoder treat the spelling as the canonical dimensionless id for kernel 2 and reject `positionCoordinate1d` on that buffer.

---

### 5.4 Decision (b): refusal channel

#### Pattern chosen (one pattern for all fallible exports)

**Admission function returning the typed envelope, paired with a data function that refuses inadmissible input.** Not `wasm_bindgen` `Result` mapped to a thrown JavaScript exception.

Reasons, from commands actually run:

1. `crates/fs-demo-physics-wasm/CONTRACT.md` lines 22–25 and 72–80 already freeze `{"ok":...}` / `{"refusal":{"code","message","ranked_repairs"}}`. AGENTS.md tells the first exports to follow that pattern.
2. `crates/fs-wasm/src/lib.rs` lines 18–20 and 119–129 fold failures to `NaN` or an empty `Vec<f64>`. The brownian bead forbids that: "The refusal is never `NaN` or an unexplained empty buffer."
3. A thrown JS exception loses `ranked_repairs` and `details` unless they are serialised anyway, at which point it is the envelope pattern with extra control-flow cost.
4. Large arrays must not be JSON-encoded number lists. The worker protocol wants versioned typed-buffer layouts. The admission function returns the envelope **without** the samples; the data function returns the `f64` buffer only after admission.

#### Native API

```rust
pub struct Refusal {
    pub code: &'static str,              // registered target, never a demo-physics string
    pub message: String,
    pub ranked_repairs: Vec<&'static str>,
    pub details: serde_json::Value,      // object; empty object if none
}

pub fn admit_<export>(...) -> Result<AdmittedSpec, Refusal>;
pub fn <export>_admitted(spec: &AdmittedSpec) -> Vec<f64>;
pub fn <export>(...) -> Result<Vec<f64>, Refusal>; // admit then data
```

`KERNEL_VERSION` (a string constant identifying the exporting crate and its version, analogous to `fs-demo-physics-wasm` line 27) is baked into every `ok` envelope.

#### WASM / JS boundary

`#[cfg(target_arch = "wasm32")]`, same `mod wasm` split as `crates/fs-wasm/src/lib.rs:990` and `crates/fs-demo-physics-wasm/src/lib.rs:552`.

Success (JsValue, not a JSON string of every sample):

```text
{
  "ok": {
    "kernel": "<KERNEL_VERSION>",
    "export": "brownian_frames" | "brownian_frames_window" | "philox_normals" | "diffusion1d_frames",
    "layout": { ... },
    "quantityId": "latentPosition1d" | "walkStepCoordinate1d" | "probabilityDensity",
    "unit": "metre" | "step" | "1/metre",
    "stepKernel": <u32, brownian only>,
    "values": Float64Array
  }
}
```

Refusal (never an empty Float64Array, never a thrown string):

```text
{
  "refusal": {
    "code": "<registered target>",
    "message": "<readable>",
    "ranked_repairs": ["...", "..."],
    "details": { ... }
  }
}
```

`admit_*` WASM exports return the same object without `values`. Calling the data export with arguments that fail admission returns the refusal object, not a panic and not `[]`.

Budget overruns are **not** this refusal object. They are the execution outcome `budget-exhausted` (typed-results bead requirement 5), with requested and allowed work units. The WASM layer still uses an envelope so the JS side does not see an empty buffer; the `code` field for a budget miss is not a `refusalCodes.ts` id. Mapping table column `targetKind` distinguishes the two.

#### Mapping table (every upstream code this lane's exports produce)

Targets that are refusal codes must exist in `src/experiments/results/refusalCodes.ts` as registered by `am-rt-typed-results-mqb` (initial set: `ftcs-unstable`, `off-replay-grid`, `superluminal-observer`, `outside-wien-domain`, `stokes-gas-medium`, `invalid-seed`, `nonfinite-input`, `unsupported-kernel`, `invalid-parameter`, `stream-index-overflow`). This lane introduces no new refusal code. Budget rows target the execution outcome `budget-exhausted` and no other execution outcome.

`fs-demo-physics-wasm` codes (`input-non-finite`, `aspect-ratio-non-positive`, `family-id-out-of-range`, `non-finite-result`, `span-non-positive`, `material-id-out-of-range`, `topology-id-out-of-range`) are listed as **out of scope**: they are another crate's strings and are not produced by the three first exports.

`StreamReplayError` variants (`crates/fs-rand/src/lib.rs:323–349`) can appear when a window is resumed from retained checkpoint bytes. They map to `invalid-parameter` with the variant name in `details.reason`.

```refusal-mapping
# targetKind is refusal-code or execution-outcome.
# The only legal execution-outcome target is budget-exhausted.
rows:
  - export: brownian_frames
    upstreamCode: unsupported-step-kernel
    when: "step_kernel not in {0,1,2,3}"
    target: unsupported-kernel
    targetKind: refusal-code
    domainKind: input
    details: { stepKernel: "<requested>" }
    rankedRepairs: ["use step_kernel 0 (coin), 1 (uniform), 2 (unit Gaussian teaching), or 3 (Gaussian with exact D)"]
  - export: brownian_frames
    upstreamCode: nonfinite-diffusion-or-dt
    when: "diffusion or dt is NaN or Inf"
    target: nonfinite-input
    targetKind: refusal-code
    domainKind: input
    details: { name: "diffusion|dt", value: "<debug>" }
    rankedRepairs: ["pass a finite diffusion (>= 0) and a finite dt (> 0)"]
  - export: brownian_frames
    upstreamCode: invalid-diffusion-or-dt
    when: "diffusion < 0, or dt <= 0, both finite"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { name: "diffusion|dt", value: "<debug>" }
    rankedRepairs: ["use diffusion >= 0; use dt > 0"; "diffusion = 0 is valid and returns zeros"]
  - export: brownian_frames
    upstreamCode: zero-particles-or-steps
    when: "n_particles == 0 or steps == 0"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { name: "n_particles|steps", value: 0 }
    rankedRepairs: ["use n_particles >= 1 and steps >= 1"]
  - export: brownian_frames
    upstreamCode: tile-width-exceeded
    when: "n_particles > u32::MAX"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { name: "n_particles", limit: 4294967295 }
    rankedRepairs: ["n_particles must fit StreamKey.tile (u32)"]
  - export: brownian_frames
    upstreamCode: output-len-overflow-or-budget
    when: "n_particles * (steps + 1) overflows or exceeds BROWNIAN_MAX_OUTPUT_LEN"
    target: budget-exhausted
    targetKind: execution-outcome
    details: { requested: "<len>", allowed: 2097152, unit: "f64-values" }
    rankedRepairs: ["use brownian_frames_window with a smaller steps", "reduce n_particles"]
  - export: brownian_frames_window
    upstreamCode: bad-start-positions
    when: "len != n_particles, a nonfinite entry, or a nonzero entry with start_step == 0"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { name: "start_positions", index: "<first bad>" }
    rankedRepairs: ["pass n_particles finite positions", "start_step 0 requires all zeros"]
  - export: brownian_frames_window
    upstreamCode: window-steps-zero
    when: "steps == 0"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { name: "steps", value: 0 }
    rankedRepairs: ["window steps must be >= 1"]
  - export: brownian_frames_window
    upstreamCode: stream-index-overflow
    when: "draws_per_step * (start_step + steps) exceeds 2^64-1"
    target: stream-index-overflow
    targetKind: refusal-code
    domainKind: input
    details: { startIndex: "<derived>", draws: "<needed>", maxIndex: "18446744073709551615" }
    rankedRepairs: ["reduce start_step + steps", "use a coin or uniform kernel (1 draw/step) if the Gaussian 2-draw counter is the limiter"]
  - export: brownian_frames_window
    upstreamCode: InvalidCheckpointLength
    when: "StreamReplayError::InvalidCheckpointLength"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { reason: "checkpoint-disagreement", field: "length", declared: "<actual>", expected: 83 }
    rankedRepairs: ["supply an 83-byte canonical StreamCheckpoint frame"]
  - export: brownian_frames_window
    upstreamCode: InvalidCheckpointMagic
    when: "StreamReplayError::InvalidCheckpointMagic"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { reason: "checkpoint-disagreement", field: "magic" }
    rankedRepairs: ["frame must begin with FSRCKPT\\0"]
  - export: brownian_frames_window
    upstreamCode: InvalidCheckpointDomain
    when: "StreamReplayError::InvalidCheckpointDomain"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { reason: "checkpoint-disagreement", field: "domain" }
    rankedRepairs: ["use the fs-rand stream-checkpoint identity domain"]
  - export: brownian_frames_window
    upstreamCode: UnknownCheckpointVersion
    when: "StreamReplayError::UnknownCheckpointVersion"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { reason: "checkpoint-disagreement", field: "checkpoint_version", declared: "<v>", expected: 1 }
    rankedRepairs: ["rebuild the checkpoint under STREAM_CHECKPOINT_VERSION = 1"]
  - export: brownian_frames_window
    upstreamCode: UnknownStreamSemanticsVersion
    when: "StreamReplayError::UnknownStreamSemanticsVersion"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { reason: "checkpoint-disagreement", field: "stream_semantics_version", declared: "<v>", expected: 1 }
    rankedRepairs: ["rebuild the checkpoint under STREAM_SEMANTICS_VERSION = 1"]
  - export: brownian_frames_window
    upstreamCode: checkpoint-key-or-index-mismatch
    when: "resumed kernel, tile, or derived index disagrees with start_step"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { reason: "checkpoint-disagreement", field: "kernel|tile|index", declared: "<v>", expected: "<from start_step>" }
    rankedRepairs: ["do not pass a checkpoint; the window derives the draw index from start_step", "or pass a checkpoint whose key and index match the derivation"]
  - export: philox_normals
    upstreamCode: count-zero
    when: "count == 0"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { name: "count", value: 0 }
    rankedRepairs: ["request count >= 1"]
  - export: philox_normals
    upstreamCode: count-budget
    when: "count > PHILOX_NORMALS_MAX_COUNT"
    target: budget-exhausted
    targetKind: execution-outcome
    details: { requested: "<count>", allowed: 1048576, unit: "normals" }
    rankedRepairs: ["request fewer normals", "issue several calls with advancing start_index"]
  - export: philox_normals
    upstreamCode: stream-index-overflow
    when: "start_index + 2*count exceeds 2^64-1 (wrapping would occur)"
    target: stream-index-overflow
    targetKind: refusal-code
    domainKind: input
    details: { startIndex: "<start_index>", draws: "<2*count>", maxIndex: "18446744073709551615" }
    rankedRepairs: ["reduce count", "lower start_index"; "start_index=18446744073709551613 count=1 is the last accepted pair"]
  - export: diffusion1d_frames
    upstreamCode: ftcs-unstable
    when: "r = (diffusion * dt) / (dx * dx) > 0.5, no epsilon"
    target: ftcs-unstable
    targetKind: refusal-code
    domainKind: numerical
    details: { ratio: "<r>", limit: 0.5, dtMax: "(dx * dx) / (2.0 * diffusion)" }
    rankedRepairs: ["use dt = dtMax", "increase dx to at least sqrt(2 D dt)", "reduce diffusion to at most dx^2 / (2 dt)"]
  - export: diffusion1d_frames
    upstreamCode: n-too-small
    when: "n < 3"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { name: "n", value: "<n>", limit: 3 }
    rankedRepairs: ["n must be >= 3 (two boundaries and at least one interior cell)"]
  - export: diffusion1d_frames
    upstreamCode: zero-frames-or-spf
    when: "frames == 0 or steps_per_frame == 0"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { name: "frames|steps_per_frame", value: 0 }
    rankedRepairs: ["use frames >= 1 and steps_per_frame >= 1"]
  - export: diffusion1d_frames
    upstreamCode: nonfinite-scalars
    when: "diffusion, dx, or dt is NaN or Inf"
    target: nonfinite-input
    targetKind: refusal-code
    domainKind: input
    details: { name: "diffusion|dx|dt" }
    rankedRepairs: ["pass finite diffusion, dx, and dt"]
  - export: diffusion1d_frames
    upstreamCode: invalid-scalars
    when: "diffusion < 0, or dx <= 0, or dt <= 0, all finite"
    target: invalid-parameter
    targetKind: refusal-code
    domainKind: input
    details: { name: "diffusion|dx|dt" }
    rankedRepairs: ["diffusion >= 0; dx > 0; dt > 0"; "diffusion = 0 is valid"]
  - export: diffusion1d_frames
    upstreamCode: unsupported-profile
    when: "profile not in {0,1,2}"
    target: unsupported-kernel
    targetKind: refusal-code
    domainKind: input
    details: { profile: "<requested>" }
    rankedRepairs: ["use profile 0 (spike), 1 (step), or 2 (two spikes)"]
  - export: diffusion1d_frames
    upstreamCode: output-len-budget
    when: "frames * n overflows or exceeds DIFFUSION1D_MAX_OUTPUT_LEN"
    target: budget-exhausted
    targetKind: execution-outcome
    details: { requested: "<len>", allowed: 2097152, unit: "f64-values" }
    rankedRepairs: ["reduce frames or n"]
  - export: diffusion1d_frames
    upstreamCode: total-steps-budget
    when: "frames * steps_per_frame overflows or exceeds DIFFUSION1D_MAX_TOTAL_STEPS"
    target: budget-exhausted
    targetKind: execution-outcome
    details: { requested: "<steps>", allowed: 1048576, unit: "ftcs-steps" }
    rankedRepairs: ["reduce frames or steps_per_frame"]
outOfScopeUpstreamCodes:
  - crate: fs-demo-physics-wasm
    codes: [input-non-finite, aspect-ratio-non-positive, family-id-out-of-range, non-finite-result, span-non-positive, material-id-out-of-range, topology-id-out-of-range]
    note: "Different crate. Do not emit these strings from the three first exports."
  - crate: fs-wasm
    codes: [empty-vec, NaN]
    note: "House style at fs-wasm/src/lib.rs:18-20. Forbidden for scientific exports."
```

No mapping row has an empty target. The only `targetKind: execution-outcome` target is `budget-exhausted`.

---

### 5.5 Buffer-layout summary (all three first exports plus the window)

| Export | Length | Index | dtype | Start / frame 0 |
|---|---|---|---|---|
| `brownian_frames` | `n_particles * (steps + 1)` | `p * (steps + 1) + s` | `f64` | all `0.0` |
| `brownian_frames_window` | `n_particles * (steps + 1)` | `p * (steps + 1) + s` | `f64` | `start_positions` |
| `philox_normals` | `count` | `i` | `f64` | first normal from draws `start_index`, `start_index+1` |
| `diffusion1d_frames` | `frames * n` | `f * n + i` | `f64` | documented profile |
| `heat_frames` (present, not used) | `frames * n * n` after clamp | `f * n * n + i * n + j` | `f64` | two hard-coded blobs |

---

### 5.6 What this lane does not decide

- Stream kernel id numeric table, production vs test-fixture blocks, exercise stream: decision (c).
- Strict vs ziggurat beyond the exclusion already stated: decision (d) (this lane already forbids ziggurat in the three exports).
- Determinism class G5 evidence: decision (e). Coin and uniform are bitwise-plausible (`next_u64` / 53-bit ladder / `sqrt` / add). Gaussian routes through `det::ln` and `det::cos`.
- Slim-bundle crate vs features: decision (f), user.
- Targets (native + single-threaded browser): decision (g).
- Reproducible `wasm-pack` flags: decision (h).
- Naming beyond using `step_kernel` and `stream_kernel` in the signatures above: decision (i).

---

### 5.7 Commands actually run (not "established")

Grep root:

```text
FS=/Users/jemanuel/projects/annus-mirabilis.com/artifacts/wasm-build/probe-5bbbfae6f7de614422f6f97f5798a3e00f8ad813/20260915T204024Z-fa82f3e8/frankensim
```

`IDENTITY.txt` in that probe records `frankensimRevision=5bbbfae6f7de614422f6f97f5798a3e00f8ad813` and `toolRunId=20260915T204024Z-fa82f3e8`. `FRANKENSIM_REVISION` is 41 bytes.

```text
stat -f 'path=%N size=%z mtime=%Sm' -t '%Y-%m-%dT%H:%M:%S%z' \
  $FS/crates/fs-rand/src/lib.rs \
  $FS/crates/fs-rand/src/philox.rs \
  $FS/crates/fs-wasm/src/lib.rs \
  $FS/crates/fs-demo-physics-wasm/src/lib.rs \
  $FS/crates/fs-demo-physics-wasm/CONTRACT.md \
  $FS/crates/fs-sparse/src/lib.rs \
  $FS/crates/fs-math/src/det.rs
```

Sizes and mtimes reported in §5.1.

```text
grep -n "fn next_normal\|fn next_f64\|fn next_u64\|fn next_below\|fn next_normal_ziggurat\|struct StreamKey\|fn resume\|STREAM_SEMANTICS_VERSION\|STREAM_CHECKPOINT_VERSION\|STREAM_CHECKPOINT_MAGIC\|STREAM_CHECKPOINT_CANONICAL_LEN\|fn encode_stream_position\|struct StreamCheckpoint\|fn current(" $FS/crates/fs-rand/src/lib.rs

grep -n "M0\|M1\|W0\|W1\|fn round\|fn philox4x32_10\|fn mulhilo\|random123_known_answers\|0xD251\|0xCD9E\|0x9E37\|0xBB67" $FS/crates/fs-rand/src/philox.rs

grep -n "0xD251_1F53\|0xD2511F53\|0xCD9E_8D57\|0xCD9E8D57\|0x9E37_79B9\|0x9E3779B9\|0xBB67_AE85\|0xBB67AE85" $FS/crates/fs-rand/src/philox.rs
# underscored forms hit; plain hex does not appear in this file

grep -n "fn heat_frames\|fn laplacian_5pt\|wasm_bindgen\|clamp\|pub fn " $FS/crates/fs-wasm/src/lib.rs

grep -n "struct Refusal\|fn json\|KERNEL_VERSION\|\"ok\"\|\"refusal\"\|ranked_repairs\|pub fn " $FS/crates/fs-demo-physics-wasm/src/lib.rs

grep -n "code:" $FS/crates/fs-demo-physics-wasm/src/lib.rs

grep -n "enum StreamReplayError\|StreamReplayError::" $FS/crates/fs-rand/src/lib.rs

grep -n "9_007_199_254_740_992\|9007199254740992\|2⁻⁵³\|wrapping_add(1)\|exactly 2 draws" $FS/crates/fs-rand/src/lib.rs

grep -n "pub struct Coo\|pub fn new(\|pub fn push(\|pub fn assemble(\|pub fn spmv(" $FS/crates/fs-sparse/src/lib.rs

grep -n "pub fn ln(\|pub fn cos(\|pub fn sqrt(" $FS/crates/fs-math/src/det.rs

grep -n "refusal\|clamp\|Deterministic\|envelope\|ok" $FS/crates/fs-demo-physics-wasm/CONTRACT.md

grep -n "crate-type\|unsafe_code\|\[features\]" $FS/crates/fs-wasm/Cargo.toml

grep -n "fn fill_f64" $FS/crates/fs-rand/src/lib.rs

grep -n "brownian_frames\|philox_normals\|diffusion1d_frames\|step_kernel" $FS/crates/fs-wasm/src/lib.rs
# no matches; wasm_bindgen list then read at lines 988-1005

grep -n "fn brownian_frames\|fn philox_normals\|fn diffusion1d_frames" \
  $FS/crates/fs-wasm/src/lib.rs $FS/crates/fs-rand/src/lib.rs $FS/crates/fs-demo-physics-wasm/src/lib.rs
# no matches

grep -n "empty" $FS/crates/fs-wasm/src/lib.rs
```

Beads read (via `br show --json`, then Python): `am-fs-export-brownian-frames-nhm`, `am-fs-capability-audit-byc`, `am-fs-export-philox-normals-xnv`, `am-fs-export-diffusion1d-cew`, `am-rt-typed-results-mqb`, `am-not-quantity-registry-2f7`.

Read-only `git -C /Users/jemanuel/projects/frankensim show 5bbbfae6f7de614422f6f97f5798a3e00f8ad813:rust-toolchain.toml` (head) confirmed `channel = "nightly-2026-07-06"`. No write in that repository; `git -C ... status --porcelain | wc -l` was 0 at session start of this lane's inspection of HEAD vs the pin (HEAD itself is `135b00088677e5bb854d4da07c67517b2ff96b7e`, later than the pin; all citations are against the archive of the pin, not HEAD).

---

## 6. Decision (c): Stream Keys and the Kernel Id Table

**Lane:** C (Grok 4.6 / grok-cli)
**Bead:** `am-fs-capability-audit-byc` decision (c)
**This file is a merge source only.** It does not modify `docs/FRANKENSIM_BINDING.md` or `docs/DECISIONS.md`.
**Mirror:** `am-rt-u64-identities-7ce` copies the fenced `kernel-id-table` block byte-for-byte into `docs/STREAM_ALLOCATION.md` and `src/experiments/streams/allocation.ts`. A test parses both documents and fails on any difference.
**Pin:** FrankenSim `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`
**Archive used for every citation:** `artifacts/frankensim-archive/5bbbfae6f7de614422f6f97f5798a3e00f8ad813/` (git archive of `crates/` at the pin; live HEAD at archive time was `135b00088677e5bb854d4da07c67517b2ff96b7e`, which is not the pin).
**Archive identity actually observed:** `FRANKENSIM_REVISION` 41 bytes, mtime `Sep 15 16:58:37 2026`; `crates/fs-rand/src/lib.rs` 47563 bytes, mtime `Sep 13 22:22:09 2026` (the pin's commit date); archive tree `98045952` bytes (`du -sk`).

---

### C.1 Mapping: `(seed, particle index)` onto `StreamKey`

At the pin, `fs-rand` defines (grep `-n` against the archive, this execution):

```
134:pub struct StreamKey {
136:    pub seed: u64,
138:    pub kernel: u32,
140:    pub tile: u32,
```

Counter and key words (same file, same grep):

```
40:pub const STREAM_SEMANTICS_VERSION: u32 = 1;
495:        [index as u32, (index >> 32) as u32, tile, kernel],
```

so the Philox counter is `[index_low, index_high, tile, kernel]` and the key is `[seed_low, seed_high]`.

**Decision.** Every Annus Mirabilis scientific draw positions a stream as:

```
StreamKey {
  seed:   <u64 logical seed>,
  kernel: <registered stream kernel id from this table>,
  tile:   <allocation-defined u32>,
}
index: <u64 draw count, never a step count, never a particle index>
```

The plan phrase "(seed, particle index)" is not a two-field key. Particle identity belongs in `tile` as the allocation declares it. The draw index counts **draws**. A strict Box-Muller Gaussian (`next_normal`) consumes two draws; a coin or uniform step consumes one. `philox_normals` `start_index` counts draws, not normals (`am-fs-export-philox-normals-xnv`).

`StreamKey.kernel` keeps the upstream field name only inside the `fs-rand` struct and the checkpoint codec (decision (i)). Everywhere else the value is a **stream kernel id** named `streamKernelId`. It is never a `brownian_frames` `step_kernel`.

**Recommended `philox_normals` form** (resolves the plan's `(seed, index, count)` ambiguity):

```
philox_normals(seed: u64, stream_kernel: u32, tile: u32, start_index: u64, count: usize)
```

Position with `Stream::resume(StreamCheckpoint::current(StreamKey { seed, kernel: stream_kernel, tile }, start_index))`. `start_index` counts draws.

---

### C.2 Two blocks, and the boundary is part of the decision

The table has exactly two blocks. The boundary is a structural gap, not a comment.

| Block | Inclusive range (hex, no separators) | Inclusive range (decimal) | Who may use it |
|---|---|---|---|
| `production` | `0x19050000` .. `0x19050fff` | 419430400 .. 419434495 | Shipped-site allocations only. `src/testing/` allocations are rejected if they name an id in this block. |
| *(unallocated gap)* | `0x19051000` .. `0x1905efff` | 419434496 .. 419495935 | Nobody. Not production, not test-fixture. A row whose id falls here fails the parse. |
| `test-fixture` | `0x1905f000` .. `0x1905ffff` | 419495936 .. 419500031 | Runtime fixture experiments, the statistical test policy's seeded suites (`am-ver-statistical-policy-grj`), and the exercise checker's `property.test.ts` generator. Production allocations never use this block. A production allocation that names a reserved id is rejected. |

The gap makes overlap of the two blocks impossible without a parser bug. Hex ids in the fenced block are lowercase, `0x`-prefixed, with no Rust numeric separators. Decimal ids are the same values, so a parser that strips `0x` and a parser that reads decimal can cross-check.

The `0x1905` prefix is 1905 in hex. It sits above every 16-bit FrankenSim stream kernel observed at the pin (max `0x0000f510`) and below the FourCC-style kernels (`0x41544d4f` `ATMO` and up).

**Kernel ids are stable, versioned, and never reused for a different meaning.** A retired id stays in the table marked `retired` and is never reassigned. New production ids are taken from the unused slots in the production block, in order, by a later decision that edits this table. New test-fixture ids are taken from the unused slots in the reserved block the same way. Expected-later allocations (`bm-01:underdamped` / `am-later-deep-underdamped-ide4` is the first) reserve **no** id and pin **no** number until their owner registers.

---

### C.3 Occupancy check at the pin (commands actually run)

Live FrankenSim was not grepped. HEAD was `135b00088677e5bb854d4da07c67517b2ff96b7e`. Every kernel value below was taken from the git-archive tree.

Archive command actually run:

```
REV=5bbbfae6f7de614422f6f97f5798a3e00f8ad813
git -C /Users/jemanuel/projects/frankensim archive --format=tar "${REV}" crates \
  | tar -x -C /Users/jemanuel/projects/annus-mirabilis.com/artifacts/frankensim-archive/${REV}
```

Collision greps actually run (all three exited 1, meaning no matches):

```
grep -R -n -E '0x1905|0x1905_0001|0x1905_F000|0x414D' \
  artifacts/frankensim-archive/5bbbfae6f7de614422f6f97f5798a3e00f8ad813/crates \
  --include='*.rs'
# grep_1905_exit=1

grep -R -n -E '0x414D_424C|0x414D424C' \
  artifacts/frankensim-archive/5bbbfae6f7de614422f6f97f5798a3e00f8ad813/crates \
  --include='*.rs'
# grep_414D_exit=1

grep -R -n -E '\b419430401\b|\b419430402\b|\b419430406\b|\b419495936\b' \
  artifacts/frankensim-archive/5bbbfae6f7de614422f6f97f5798a3e00f8ad813/crates \
  --include='*.rs'
# grep_decimal_exit=1
```

Separator-form search actually run (the Rust trap: `0xF5_01` as well as `0xF501`). It found only existing FrankenSim kernels, none in the `0x1905` range:

```
grep -R -n '0x1905_0001\|0x1905_F000\|0xF5_01\|0xF5_02\|0xF5_03\|0xF5_10' \
  artifacts/frankensim-archive/5bbbfae6f7de614422f6f97f5798a3e00f8ad813/crates \
  --include='*.rs'
```

Hits (grep `-n` this execution):

```
crates/fs-wasm/src/lib.rs:508:        kernel: 0xF5_01,
crates/fs-wasm/src/lib.rs:582:        kernel: 0xF5_02,
crates/fs-wasm/src/lib.rs:659:        kernel: 0xF5_03,
crates/fs-wasm/src/pde.rs:492:        kernel: 0xF5_10,
```

Occupancy extractor actually run against the archive (Python walk of every `StreamKey { ... }` body for `kernel:` plus every `const …KERNEL…: u32 = …`). Result this execution: **72 occupied numeric kernel ids**, min `0x1`, max `0x666c7565`. Candidate ids `0x19050001`..`0x19050008` and `0x1905f000`..`0x1905f002` all `occupied=False`. Intersection of occupied set with the production block: empty. Intersection with the reserved block: empty.

Occupied values observed (hex, this execution; not an assignment, an exclusion list):

`0x1, 0x3, 0x7, 0x8, 0x9, 0xb, 0xac, 0xc4, 0xf1, 0x301, 0x302, 0x460, 0x517, 0x561, 0x5a2, 0x5a3, 0x770, 0x871, 0xa27, 0xa69, 0xd0e, 0xd20, 0xd21, 0xd22, 0xd51, 0xe11, 0xf1a, 0xf1b, 0x11e7, 0x30f1, 0x30f2, 0x4d48, 0x501e, 0x50a0, 0x51ce, 0x5750, 0x5a25, 0x60f1, 0x71e5, 0x754b, 0x7b00, 0x9a2d, 0xa5c3, 0xad10, 0xb0b0, 0xb647, 0xba7c, 0xc7a2, 0xd1f0, 0xd1f1, 0xe094, 0xe719, 0xf501, 0xf502, 0xf503, 0xf510, 0x03707344, 0x13579bdf, 0x41544d4f, 0x42535452, 0x46435031, 0x4643504c, 0x48494e46, 0x48505250, 0x4e4c4149, 0x4f555f5f, 0x53414646, 0x666c7565`

plus named constants resolved from `const …KERNEL…: u32` (`MUTATION_KERNEL=0xb647`, `STREAM_KERNEL=0xe094`, `ATMO_KERNEL=0x41544d4f`, `CMA_STREAM_KERNEL=0xd1f0`, and the rest of that set). None equal any assigned Annus Mirabilis id.

`fs-exec` `StreamKey { seed, kernel_id, tile, iteration }` is a different type. Its `kernel_id` field was not treated as an `fs-rand` stream kernel id.

---

### C.4 The exercise stream (production, not reserved)

`am-disc-exercise-checker-i4h2` draws, beside its frozen Halton grid, **8 Philox sample points per exercise part**.

| Field | Value |
|---|---|
| Stream kernel id | `0x19050006` (`exercise-sample-points`), **production** |
| Seed | First 64 bits of SHA-256 of the UTF-8 bytes of `<exerciseId>/<partIndex>`, then encoded as a canonical decimal `U64String` through `am-rt-u64-identities-7ce`. The seed identifies the exercise and the part. |
| Tile formula | `tile = v`, the zero-based index of the variable in the part's declared variable order. The tile distinguishes the variable and nothing else. |
| Index | Counts draws. Candidate `j` takes index `j` under the checker's 64-candidate ceiling, so each stream is bounded at 64 draws. |
| Declared maxima (mirrored by `am-rt-u64-identities-7ce`) | 64 draws per stream; 256 variables per part (largest tile 255). A part exceeding either bound is refused at registration, never wrapped. |

It is a production id even though its purpose is checking a reader's answer, because the checker **runs in the shipped site**. The checker's own `property.test.ts` generator is a different consumer and uses reserved id `0x1905f002` (`exercise-property-test`). Those two must not be confused. A fixture that registers `exercise.sample-points.v1` against a reserved id is rejected; a `src/testing/` allocation that names `0x19050006` is rejected.

#### Why it cannot borrow another allocation

Its draw pattern matches no existing allocation.

- The Brownian latent stream is keyed by **particle and axis** (`tile = 3·i + axis` on BM-01, `tile = j` on BM-05).
- The localization-noise stream is keyed by **particle** (`tile = particle`).
- The inference generator streams are keyed by **particle and substep** (`tile = (p << 16) | s`).
- The exercise stream is keyed by the **variables of an algebraic expression** (`tile = v`) and is drawn at build-independent points that have nothing to do with a physical path.

Borrowing any of those ids would interleave two meanings on one stream while every digest still compared equal. That is the failure `am-rt-u64-identities-7ce` requirement 6 exists to prevent. The exercise stream also holds its own stream kernel id rather than sharing one, so the tile-formula rule is satisfied twice over.

---

### C.5 Machine-readable table

The fenced block below is the object `am-rt-u64-identities-7ce` mirrors. Parse rules the later test enforces:

1. Language tag is `kernel-id-table`.
2. `BEGIN block=` / `END block=` delimit the two blocks. Unknown block names fail. Missing either block fails.
3. Each `RANGE` is inclusive, hex, lowercase, no separators. The two ranges must not overlap. A `ROW id=` outside its block's range fails. A `ROW id=` in the unallocated gap fails.
4. `id` is unique across the whole table. A production id that appears in the test-fixture block, or the reverse, fails.
5. `name` is unique. `status` is `active` or `retired`. A retired id is never reassigned.
6. `allocationIds` is a comma-separated list. Two rows may not share both a stream kernel `id` and a `tileFormula` string. Two allocations on one row (same id, different formulas) are allowed only when the formulas differ, which is how BM-01 and BM-05 share `brownian-latent`.
7. `indexRule` is `draws` for every active row.

```kernel-id-table
schema=am.kernel-id-table.v1
pin=5bbbfae6f7de614422f6f97f5798a3e00f8ad813
streamSemanticsVersion=1
unallocatedGap=0x19051000..0x1905efff

BEGIN block=production
RANGE 0x19050000 0x19050fff

ROW id=0x19050001 idDec=419430401 name=brownian-latent status=active indexRule=draws consumers=bm-01,bm-05,bm-08 allocationIds=bm-01.latent.v1,bm-05.walk.v1,bm-08.latent.v1 tileFormula=bm-01.latent.v1:tile=3*i+axis;bm-05.walk.v1:tile=j;bm-08.latent.v1:tile=(i<<2)|channel notes=channel0=increment,channel1=bridge;BM-01 axis 0=x,1=y,2=z;shared kernel because all three call brownian_frames or the same latent Gaussian path;allocations distinct by tile formula

ROW id=0x19050002 idDec=419430402 name=brownian-localization-noise status=active indexRule=draws consumers=bm-08 allocationIds=bm-08.localization.v1 tileFormula=tile=particle notes=independent epsilon_i per measured position;tile is particle index;not the latent path

ROW id=0x19050003 idDec=419430403 name=synthetic-inference-latent status=active indexRule=draws consumers=bm-07 allocationIds=bm-07.synthetic-latent.v1 tileFormula=tile=(p<<16)|s notes=p=particle,s=substep,s<65536;synthetic inverse exercise latent path;never mixed with measurement-error draws

ROW id=0x19050004 idDec=419430404 name=synthetic-inference-noise status=active indexRule=draws consumers=bm-07 allocationIds=bm-07.synthetic-noise.v1 tileFormula=tile=(p<<16)|s notes=p=particle,s=substep,s<65536;same tile formula as latent is legal because the kernel id differs

ROW id=0x19050005 idDec=419430405 name=lq-05-configuration status=active indexRule=draws consumers=lq-05 allocationIds=lq-05.configuration.v1,lq-05.locked.v1 tileFormula=lq-05.configuration.v1:tile=trial;lq-05.locked.v1:tile=trial|0x80000000 notes=independent point placement vs locked-positions counterexample;changing view or rendering subset consumes zero draws;locked uses the high bit so the tile formula is not tile=trial

ROW id=0x19050006 idDec=419430406 name=exercise-sample-points status=active indexRule=draws consumers=am-disc-exercise-checker-i4h2 allocationIds=exercise.sample-points.v1 tileFormula=tile=v notes=v=zero-based variable index in the part declared variable order;seed=first64(SHA-256(exerciseId/partIndex));candidate j takes index j;ceiling 64 draws;PRODUCTION because the checker ships in the site

ROW id=0x19050007 idDec=419430407 name=synthetic-inference-generator-parameter status=active indexRule=draws consumers=bm-07 allocationIds=bm-07.generator-parameter.v1 tileFormula=tile=0 notes=hidden molecular number drawn log-uniform once per seed;not a particle stream;allocated so BM-07 does not borrow latent or noise

ROW id=0x19050008 idDec=419430408 name=brownian-stationary-feature status=active indexRule=draws consumers=bm-08 allocationIds=bm-08.stationary-feature.v1 tileFormula=tile=clickIndex notes=repeated clicks on a stationary feature for sigma-hat;BM-08 names this as the third stream beside latent and localization

END block=production

BEGIN block=test-fixture
RANGE 0x1905f000 0x1905ffff

ROW id=0x1905f000 idDec=419495936 name=statistical-policy-seeded status=active indexRule=draws consumers=am-ver-statistical-policy-grj allocationIds=statistical-policy.seeded.v1 tileFormula=tile=suiteSalt notes=seeded statistical assertions;suiteSalt is allocation-defined by the policy helper;production allocations never use this id

ROW id=0x1905f001 idDec=419495937 name=runtime-fixture status=active indexRule=draws consumers=src/testing allocationIds=runtime-fixture.v1 tileFormula=tile=allocation-defined notes=runtime fixture experiments under src/testing/;owners take further ids from unused slots in this block, never from production

ROW id=0x1905f002 idDec=419495938 name=exercise-property-test status=active indexRule=draws consumers=am-disc-exercise-checker-i4h2/property.test.ts allocationIds=exercise.property-test.v1 tileFormula=tile=v notes=property-test generator only;not the shipped checker;must not be confused with 0x19050006

END block=test-fixture
```

Unused slots `0x19050009`..`0x19050fff` stay in the production block for later owners that register rather than borrow. Unused slots `0x1905f003`..`0x1905ffff` stay in the reserved block for the same reason. Neither unused region is a third block.

---

### C.6 Allocation notes the runtime registry must mirror

These formulas travel with the table because `am-rt-u64-identities-7ce` registers them. They are not a second kernel id list.

| allocationId | stream kernel id | tile formula | draws per scientific step | declared maxima |
|---|---|---|---|---|
| `bm-01.latent.v1` | `0x19050001` | `tile = 3·i + axis` (axis 0,1,2 = x,y,z) | 2 per Gaussian step (step kernel 3) | M ≤ 10000 tracers (largest tile 29999); at most 2H/h draws per stream |
| `bm-05.walk.v1` | `0x19050001` | `tile = j` for walker j | 1 per coin or uniform step; 2 per Gaussian step | W ≤ 10000; N_run ≤ 10000; at most 2e4 draws per stream |
| `bm-08.latent.v1` | `0x19050001` | `tile = (i << 2) \| channel` (0 = increment, 1 = Brownian-bridge ξ) | 2 per Gaussian increment plus 2 per bridge variate | same tracer cap as BM-01; formula differs from `3·i+axis` and from `j` |
| `bm-08.localization.v1` | `0x19050002` | `tile = particle` | 2 per localization normal | particle index within BM-08's work budget |
| `bm-08.stationary-feature.v1` | `0x19050008` | `tile = clickIndex` | 2 per click normal | n_s within BM-08's declared click cap |
| `bm-07.synthetic-latent.v1` | `0x19050003` | `tile = (p << 16) \| s` | 2 per Gaussian substep | p < 65536, s < 65536 |
| `bm-07.synthetic-noise.v1` | `0x19050004` | `tile = (p << 16) \| s` | 2 per noise normal | p < 65536, s < 65536 |
| `bm-07.generator-parameter.v1` | `0x19050007` | `tile = 0` | draws for one log-uniform hidden N per seed | 1 stream per run |
| `lq-05.configuration.v1` | `0x19050005` | `tile = trial` | draws per independent point (2 uniforms for a 2-D placement) | trials ≤ 1e6 (LQ-05 numeric domain) |
| `lq-05.locked.v1` | `0x19050005` | `tile = trial \| 0x80000000` | 1 shared uniform for all n points | same trial cap; high bit keeps the formula distinct from `tile = trial` |
| `exercise.sample-points.v1` | `0x19050006` | `tile = v` | 1 draw per candidate | 64 draws; 256 variables |
| `statistical-policy.seeded.v1` | `0x1905f000` | `tile = suiteSalt` | as the policy helper declares | reserved block only |
| `runtime-fixture.v1` | `0x1905f001` | allocation-defined | as the fixture declares | reserved block only |
| `exercise.property-test.v1` | `0x1905f002` | `tile = v` | as the property test declares | reserved block only |

BM-01 and BM-05 share `0x19050001` because they call the same export. They are distinct allocations because their tile formulas differ, and instances never share a seed implicitly.

Display subsampling, new plots, cadence changes, and switching 2D/3D consume **zero** draws from every row.

---

### C.7 What this table deliberately does not allocate

- **`bm-01:underdamped`** (`am-later-deep-underdamped-ide4`). Expected-later. Different draw pattern (Ornstein-Uhlenbeck position-and-velocity pair). It must register its own `allocationId` with its own tile formula and must not reuse `tile = 3·i + axis`. No id is pinned here.
- Step kernels 0, 1, 2, 3 of `brownian_frames`. Those are `step_kernel` values, not stream kernel ids. Decision (a) owns them.
- Any FrankenSim crate's existing `StreamKey.kernel` literal. Those remain upstream identities. Annus Mirabilis never reuses them.

---

### C.8 Commands actually run (this lane)

| What | Command | Result this execution |
|---|---|---|
| Pin log | `git -C /Users/jemanuel/projects/frankensim log -1 --format='commit %H%ndate: %ci%nsubject: %s' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813` | `commit 5bbbfae6f7de614422f6f97f5798a3e00f8ad813` / `2026-09-13 22:22:09 -0400` / `feat(conduction): differentiate cooling through temperature-dependent conductivity` |
| Live HEAD | `git -C /Users/jemanuel/projects/frankensim rev-parse HEAD` | `135b00088677e5bb854d4da07c67517b2ff96b7e` (not the pin) |
| Archive | `git -C …/frankensim archive --format=tar ${REV} crates \| tar -x -C artifacts/frankensim-archive/${REV}` | exit 0; archive 98045952 bytes |
| StreamKey struct | `grep -n 'pub struct StreamKey' …/fs-rand/src/lib.rs` | line 134 |
| Fields | `grep -n 'pub seed:\|pub kernel:\|pub tile:' …/fs-rand/src/lib.rs` | 136, 138, 140 |
| Counter words | `grep -n 'index as u32, (index >> 32) as u32, tile, kernel' …/fs-rand/src/lib.rs` | line 495 |
| Semantics version | `grep -n 'pub const STREAM_SEMANTICS_VERSION' …/fs-rand/src/lib.rs` | line 40 = 1 |
| fs-wasm kernels | `grep -n 'kernel: 0x' …/fs-wasm/src/{lib.rs,pde.rs,flagships.rs}` | `0xF5_01`@508, `0xF5_02`@582, `0xF5_03`@659, `0xF5_10`@492, `0x0F1A`@212, `0x0F1B`@300 |
| Collision `0x1905` / `0x414D` / decimals | three `grep -R -n -E` over the archive `crates/` | all exit 1 (no matches) |
| Occupancy extractor | Python walk of archive `StreamKey` bodies + `const …KERNEL…: u32` | 72 occupied ids; all assigned candidates free |

No file under `/Users/jemanuel/projects/frankensim` or its siblings was created or modified by this lane.

---

## 7. Capability Matrix

**Lane:** D  
**Owning bead:** `am-fs-capability-audit-byc`  
**Pinned FrankenSim revision inspected:** `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`  
**Working-tree HEAD (not used for citations):** `135b00088677e5bb854d4da07c67517b2ff96b7e`  
**Written:** 2026-09-15T21:02:52Z  
**This file is the section-7 draft.** Do not treat it as `docs/FRANKENSIM_BINDING.md`. Merge is orchestrator-only.

Inspection was read-only: `git -C /Users/jemanuel/projects/frankensim grep` / `show` / `ls-tree` at the pin. Nothing was created or modified under `/Users/jemanuel/projects/frankensim` or its siblings. No `git archive` was required for this lane because no compile or edit of upstream was performed.

### 1. Parser contract (requirement 7)

The fenced `capability-matrix` block below is YAML: a sequence of maps. Every row has these eleven keys, matching the bead column set exactly:

`capabilityId`, `family`, `instrumentId`, `upstreamStatus`, `owner`, `nativeTestTarget`, `browserExport`, `admittedDomain`, `sourceReference`, `releaseArtifact`, `acceptanceState`

Optional keys, only where the parser rules require them:

- `reason`: required when `instrumentId` is `none`
- `evidence`: required when `acceptanceState` is `verified` or `adopted` (no such row is written)

Parser rules as applied:

1. `upstreamStatus: present` names an exact function, never a crate alone.
2. `instrumentId` is a core catalogue id (`lq-01`…`lq-09`, `bm-01`…`bm-08`, `sr-01`…`sr-13`, `me-01`…`me-03`) or `none`. No bead ids. `bm-07` has two beads and `me-03` has three; those extra beads do not get extra rows.
3. Every instrument the owner map says needs a computed output appears in at least one row.
4. No `verified` or `adopted` row is written, so no `evidence` field is claimed.
5. No `acceptanceState: not-started` row is written. `am-fs-slim-artifact-0yh` therefore cannot ship a not-started capability from this matrix. Rows that belong in the first slim bundle name `releaseArtifact: fs-annus-diffusion`; every other row names `releaseArtifact: none`.

`family` values are the nine §12.3 names from the master plan table at `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md` lines 3022–3030.

### 2. Owner map (instruments that need a computed output)

Source of the 33 catalogue rows: master plan §10.2 table, lines 2647–2679. Computational owners come from the instrument beads (the registry each instrument will file with `am-inst-registry-dispatcher-66l0`) plus §12.12 (`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md` lines 3272–3282). Family-to-upstream mapping is committed `docs/FRANKENSIM_BINDING.md` §3, lines 173–262, re-checked by grep at the pin.

All 33 core instruments require a computed output. None is a static illustration only. SR-02's apparatus mode is a static worked example; the instrument still computes EMF and field transforms in its modeled mode.

Section 3 host-evaluator filenames that disagree with §12.12 and the instrument beads are **not** used as `owner` values. The instrument beads and §12.12 win:

| §3 line | §3 filename (not used) | Owner actually named |
|---|---|---|
| 214 | `src/physics/reference/diffusionInference.ts` | `src/physics/reference/inference.ts` (§12.12 line 3275; `am-bm-07-infer-molecular-number-frf9`, `am-bm-08-measurement-bias-h1ye`) |
| 223 | `src/physics/reference/lorentz.ts` | `src/physics/reference/kinematics.ts` and `events.ts` (§12.12 lines 3277–3278; SR-01…SR-06 beads) |
| 232 | `src/physics/reference/relativisticFields.ts` | `src/physics/reference/fields.ts` (§12.12 line 3279; SR-02, SR-07, SR-08, SR-12 beads) |
| 241 | `src/physics/reference/lorentzForce.ts` | `src/physics/reference/electron.ts` (§12.12 line 3281; `am-sr-13-electron-dynamics-b6v7`) |

Radiation (`radiation.ts`, `photoelectric.ts`) and mass-energy (`massEnergy.ts`) filenames agree between §3 and §12.12.

### 3. First exports (must be `owner-decided`)

At pin `5bbbfae6f7de614422f6f97f5798a3e00f8ad813` these greps returned no matches for the planned exports:

```text
git -C /Users/jemanuel/projects/frankensim grep -n -e 'brownian_frames' -e 'philox_normals' -e 'diffusion1d_frames' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates
# (empty)

git -C /Users/jemanuel/projects/frankensim grep -n -e 'fn brownian' -e 'fn philox_normal' -e 'fn diffusion1d' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates
# NO MATCH
```

They are therefore `upstreamStatus: new-upstream`, not `present`. `acceptanceState` is `owner-decided` (family 3 decision at `docs/FRANKENSIM_BINDING.md` line 204). `browserExport` is the planned `wasm_bindgen` symbol. `releaseArtifact` is `fs-annus-diffusion`, the bundle id in `am-fs-slim-artifact-0yh` (`public/wasm/fs-annus-diffusion/…`). Decision (f) (which crate hosts the symbol) is a user decision and is not answered here; the function names are the ones AGENTS.md sketches on `crates/fs-wasm/src/lib.rs`.

Consumers, from the export beads (not from bead-id matching):

| capabilityId | export bead | consuming instruments |
|---|---|---|
| `diffusion.brownian-frames` | `am-fs-export-brownian-frames-nhm` | `bm-01`, `bm-05` |
| `diffusion.philox-normals` | `am-fs-export-philox-normals-xnv` | `lq-05`, `bm-07` |
| `diffusion.ftcs-1d` | `am-fs-export-diffusion1d-cew` | `bm-06` |

Five rows, three capability ids. Each export bead advances every row that shares its `capabilityId` and nothing else. Two consumers for one export is two rows, not a duplicate: the pair is `(capability, instrument)`.

### 4. Summary counts

These counts are of the fenced block below. Recompute from the block, not from this paragraph.

| Count | Value |
|---|---|
| rows | 41 |
| unique `instrumentId` other than `none` | 33 |
| core catalogue size | 33 |
| `unownedConsumerCount` | 0 |
| `instrumentId: none` (`orphanCapabilityCount`) | 4 |
| first-export rows (`owner-decided` + `releaseArtifact: fs-annus-diffusion`) | 5 |
| `acceptanceState: not-started` | 0 |
| `acceptanceState: verified` or `adopted` | 0 |
| `upstreamStatus: present` | 4 (the four orphan rows) |
| `upstreamStatus: new-upstream` | 5 (the five first-export rows) |
| `upstreamStatus: host-only` | 32 |

The four orphans are present upstream functions that §3 recorded and that this audit refuses as instrument owners. They are kept so a crate-name search cannot smuggle them into a shipped bundle (`releaseArtifact: none`).

### 5. Capability matrix

```capability-matrix
- capabilityId: radiation.prescribed-wave
  family: "Radiation spectra"
  instrumentId: lq-01
  upstreamStatus: host-only
  owner: "src/physics/reference/radiation.ts::planeWave"
  nativeTestTarget: "none; host evaluator not in tree; tests planned as src/physics/reference/radiation.lq01.test.ts"
  browserExport: not-exported
  admittedDomain: "prescribed scalar field on an observation region; no material constitutive law; amplitude and phase finite"
  sourceReference: "paper light-quanta Journey I Stage A; catalogue LQ-01; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2647; am-lq-01-wave-description-kv2r"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: radiation.classical-mode-energy
  family: "Radiation spectra"
  instrumentId: lq-02
  upstreamStatus: host-only
  owner: "src/physics/reference/radiation.ts::classicalEnergyUpToCutoff"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside radiation.ts"
  browserExport: not-exported
  admittedDomain: "T in [500, 10000] K; frequency cutoff in [1e11, 1e16] Hz; unbounded total is a typed refusal, never a clamp"
  sourceReference: "paper light-quanta §1–2; catalogue LQ-02; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2648; am-lq-02-mode-allocation-vy60"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: radiation.spectral-density
  family: "Radiation spectra"
  instrumentId: lq-03
  upstreamStatus: host-only
  owner: "src/physics/reference/radiation.ts::planckNu"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside radiation.ts"
  browserExport: not-exported
  admittedDomain: "T in [500, 10000] K; nu in [1e11, 1e16] Hz; SI spectral energy density u(nu,T) and u(lambda,T) with Jacobian; Wien and Rayleigh-Jeans as labelled limits"
  sourceReference: "paper light-quanta §1–4; catalogue LQ-03; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2649; am-lq-03-spectrum-08vz; family 3.1 docs/FRANKENSIM_BINDING.md:173-182"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: radiation.spectral-entropy
  family: "Radiation spectra"
  instrumentId: lq-04
  upstreamStatus: host-only
  owner: "src/physics/reference/radiation.ts::wienSpectralEntropyDensity"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside radiation.ts"
  browserExport: not-exported
  admittedDomain: "fixed energy, frequency band, accessible volume ratio > 0; Wien domain only; C(nu) inspectable; outside-domain is a refusal"
  sourceReference: "paper light-quanta §3–4; catalogue LQ-04; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2650; am-lq-04-entropy-workbench-senj"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: radiation.independent-configurations
  family: "Radiation spectra"
  instrumentId: lq-05
  upstreamStatus: host-only
  owner: "src/physics/reference/radiation.ts::independentPointsProbability"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside radiation.ts"
  browserExport: not-exported
  admittedDomain: "particle count n in 1..60; subvolume fraction f in (0,1]; exact f^n for rational f"
  sourceReference: "paper light-quanta §5; catalogue LQ-05; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2651; am-lq-05-independent-configurations-jtvo"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: diffusion.philox-normals
  family: "Diffusion and stochastic transport"
  instrumentId: lq-05
  upstreamStatus: new-upstream
  owner: "fs_wasm::philox_normals"
  nativeTestTarget: "none; crates/fs-wasm/tests/ absent at pin (git ls-tree 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 crates/fs-wasm/ shows .cargo and src only); am-fs-export-philox-normals-xnv adds tests/philox_normals.rs"
  browserExport: philox_normals
  admittedDomain: "seed u64; stream_kernel u32; tile u32; start_index u64 counting draws; count >= 1; start_index + 2*count does not exceed 2^64-1 (stream-index-overflow otherwise); strict Stream::next_normal only"
  sourceReference: "paper light-quanta §5 configuration stream; am-fs-export-philox-normals-xnv; family 3.3 docs/FRANKENSIM_BINDING.md:204; fs_rand::Stream::next_normal at crates/fs-rand/src/lib.rs:579"
  releaseArtifact: fs-annus-diffusion
  acceptanceState: owner-decided
- capabilityId: radiation.entropy-coefficients
  family: "Radiation spectra"
  instrumentId: lq-06
  upstreamStatus: host-only
  owner: "src/physics/reference/radiation.ts::matchEntropyCoefficients"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside radiation.ts"
  browserExport: not-exported
  admittedDomain: "Wien radiation compared with an ideal-gas entropy term; constant set modern-si-2019 or einstein-1905-light-quanta-printed"
  sourceReference: "paper light-quanta §5 the move; catalogue LQ-06; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2652; am-lq-06-coefficient-match-n8pe"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: quantum.fluorescence-budget
  family: "Idealized quantum energy transfer"
  instrumentId: lq-07
  upstreamStatus: host-only
  owner: "src/physics/reference/photoelectric.ts::fluorescenceBudget"
  nativeTestTarget: "none; host evaluator not in tree; tests planned as photoelectric.fluorescence.test.ts"
  browserExport: not-exported
  admittedDomain: "incident and emitted frequencies finite and positive; extra-energy assumption explicit; Wien-domain check via radiation.ts::regimeRelativeErrors; outside-wien-domain is a refusal"
  sourceReference: "paper light-quanta §7; catalogue LQ-07; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2653; am-lq-07-fluorescence-zjai; family 3.2 docs/FRANKENSIM_BINDING.md:184-191"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: quantum.photoelectric
  family: "Idealized quantum energy transfer"
  instrumentId: lq-08
  upstreamStatus: host-only
  owner: "src/physics/reference/photoelectric.ts::kMax"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside photoelectric.ts"
  browserExport: not-exported
  admittedDomain: "frequency in [100, 2000] THz; hypothetical work function in [1, 6] eV unless a cited metal card is selected; below-threshold emission is not-applicable, never negative kinetic energy"
  sourceReference: "paper light-quanta §8; catalogue LQ-08; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2654; am-lq-08-photoelectric-va5a; family 3.2 docs/FRANKENSIM_BINDING.md:184-191"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: quantum.ionization
  family: "Idealized quantum energy transfer"
  instrumentId: lq-09
  upstreamStatus: host-only
  owner: "src/physics/reference/photoelectric.ts::ionizationBounds"
  nativeTestTarget: "none; host evaluator not in tree; tests planned as photoelectric.ionization.test.ts"
  browserExport: not-exported
  admittedDomain: "incident energy finite positive; idealized threshold; absorbed fraction in [0, 1]; no material rates"
  sourceReference: "paper light-quanta §9; catalogue LQ-09; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2655; am-lq-09-ionization-mbul"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: diffusion.brownian-frames
  family: "Diffusion and stochastic transport"
  instrumentId: bm-01
  upstreamStatus: new-upstream
  owner: "fs_wasm::brownian_frames"
  nativeTestTarget: "none; crates/fs-wasm/tests/ absent at pin; am-fs-export-brownian-frames-nhm adds tests/brownian_frames.rs"
  browserExport: brownian_frames
  admittedDomain: "n_particles in 1..10000; steps >= 1; step_kernel in {0,1,2,3}; seed u64; diffusion >= 0 finite m^2/s; dt > 0 finite s; output length n_particles*(steps+1) within the declared budget; refuse, never clamp"
  sourceReference: "paper brownian-motion §4; catalogue BM-01; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2656; am-bm-01-tracer-ensemble-hdly; am-fs-export-brownian-frames-nhm; family 3.3 docs/FRANKENSIM_BINDING.md:204"
  releaseArtifact: fs-annus-diffusion
  acceptanceState: owner-decided
- capabilityId: diffusion.stokes-einstein
  family: "Diffusion and stochastic transport"
  instrumentId: bm-01
  upstreamStatus: host-only
  owner: "src/physics/reference/diffusion.ts::stokesEinstein"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside diffusion.ts"
  browserExport: not-exported
  admittedDomain: "dilute sphere; radius in [0.1e-6, 5e-6] m; viscosity in [0.5e-3, 20e-3] Pa s; T in [273, 330] K; gas cards refuse (Stokes drag without Cunningham slip)"
  sourceReference: "paper brownian-motion §3–5; Einstein 0.8 um preset; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2698-2700; am-bm-01-tracer-ensemble-hdly"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: diffusion.osmotic-pressure
  family: "Diffusion and stochastic transport"
  instrumentId: bm-02
  upstreamStatus: host-only
  owner: "src/physics/reference/diffusion.ts::osmoticPressure"
  nativeTestTarget: "none; host evaluator not in tree; tests planned as diffusion.partition.test.ts"
  browserExport: not-exported
  admittedDomain: "dilute suspension; T in [273, 330] K; number density and volume positive finite; no collision dynamics"
  sourceReference: "paper brownian-motion §1; catalogue BM-02; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2657; am-bm-02-osmotic-partition-n13x"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: diffusion.configuration-integral
  family: "Diffusion and stochastic transport"
  instrumentId: bm-03
  upstreamStatus: host-only
  owner: "src/physics/reference/diffusion.ts::configurationVolumeTerm"
  nativeTestTarget: "none; host evaluator not in tree; tests planned as diffusion.configuration.test.ts"
  browserExport: not-exported
  admittedDomain: "independent coordinates; accessible volume > 0; logarithmic evaluation; no molecular dynamics"
  sourceReference: "paper brownian-motion §2; catalogue BM-03; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2658; am-bm-03-configuration-integral-e84v"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: diffusion.drift-diffusion
  family: "Diffusion and stochastic transport"
  instrumentId: bm-04
  upstreamStatus: host-only
  owner: "src/physics/reference/diffusion.ts::driftDiffusionFrames1d"
  nativeTestTarget: "none; host evaluator not in tree; tests planned as diffusion.driftDiffusion.test.ts"
  browserExport: not-exported
  admittedDomain: "1D cell averages; zero-flux walls; kick factor m >= 0; explicit Scharfetter-Gummel; stability sigma <= 1 else drift-diffusion-unstable; D=0 uses upwind with |u| dt/dx <= 1 else drift-cfl-exceeded"
  sourceReference: "paper brownian-motion §3; catalogue BM-04 including bm-04:kicks-off; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2659; am-bm-04-drift-diffusion-balance-fpow"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: diffusion.brownian-frames
  family: "Diffusion and stochastic transport"
  instrumentId: bm-05
  upstreamStatus: new-upstream
  owner: "fs_wasm::brownian_frames"
  nativeTestTarget: "none; crates/fs-wasm/tests/ absent at pin; am-fs-export-brownian-frames-nhm adds tests/brownian_frames.rs"
  browserExport: brownian_frames
  admittedDomain: "n_particles in 1..10000; steps >= 1; step_kernel in {0,1,2,3}; seed u64; diffusion >= 0 finite m^2/s; dt > 0 finite s; per-step variance 2 D dt under the audit kernel resolution; refuse, never clamp"
  sourceReference: "paper brownian-motion §4; catalogue BM-05; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2660; am-bm-05-random-steps-ntzl; am-fs-export-brownian-frames-nhm"
  releaseArtifact: fs-annus-diffusion
  acceptanceState: owner-decided
- capabilityId: diffusion.ftcs-1d
  family: "Diffusion and stochastic transport"
  instrumentId: bm-06
  upstreamStatus: new-upstream
  owner: "fs_wasm::diffusion1d_frames"
  nativeTestTarget: "none; crates/fs-wasm/tests/ absent at pin; am-fs-export-diffusion1d-cew adds tests/diffusion1d_frames.rs"
  browserExport: diffusion1d_frames
  admittedDomain: "n >= 3 cells; frames >= 1; steps_per_frame >= 1; diffusion >= 0 finite m^2/s; dx > 0 m; dt > 0 s; profile in {0,1,2}; r = (diffusion * dt) / (dx * dx) <= 0.5 with r = 0.5 admitted; r > 0.5 is ftcs-unstable; heat_frames is not this owner"
  sourceReference: "paper brownian-motion §4; catalogue BM-06; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2661; am-bm-06-gaussian-spread-982y; am-fs-export-diffusion1d-cew; family 3.3 docs/FRANKENSIM_BINDING.md:199-204; heat_frames at crates/fs-wasm/src/lib.rs:252 is refused as owner"
  releaseArtifact: fs-annus-diffusion
  acceptanceState: owner-decided
- capabilityId: diffusion.free-gaussian
  family: "Diffusion and stochastic transport"
  instrumentId: bm-06
  upstreamStatus: host-only
  owner: "src/physics/reference/diffusion.ts::gaussianPropagator"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside diffusion.ts"
  browserExport: not-exported
  admittedDomain: "D >= 0 finite m^2/s; t >= 0 s; t = 0 is analytic-limit (point mass); 1D/2D/3D radial forms; interval probability over a finite bin"
  sourceReference: "paper brownian-motion §4; catalogue BM-06; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2661; am-bm-06-gaussian-spread-982y"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: diffusion.inference
  family: "Diffusion inference"
  instrumentId: bm-07
  upstreamStatus: host-only
  owner: "src/physics/reference/inference.ts::independentIncrementEstimator"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside inference.ts"
  browserExport: not-exported
  admittedDomain: "independent increments on a declared replay grid; chi-square interval; inverse-parameter bias labelled; synthetic generator parameters kept off the inference inputs; historical constants never mixed with modern-si-2019 in one estimate"
  sourceReference: "paper brownian-motion §5; catalogue BM-07; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2662; am-bm-07-infer-molecular-number-frf9; family 3.4 docs/FRANKENSIM_BINDING.md:206-214"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: diffusion.philox-normals
  family: "Diffusion and stochastic transport"
  instrumentId: bm-07
  upstreamStatus: new-upstream
  owner: "fs_wasm::philox_normals"
  nativeTestTarget: "none; crates/fs-wasm/tests/ absent at pin; am-fs-export-philox-normals-xnv adds tests/philox_normals.rs"
  browserExport: philox_normals
  admittedDomain: "synthetic-inference latent and noise streams; seed u64; stream_kernel from the audit table; tile allocation-defined; start_index counts draws; count >= 1; start_index + 2*count does not exceed 2^64-1"
  sourceReference: "BM-07 synthetic inverse generator; am-fs-export-philox-normals-xnv (LQ-05 and BM-07 named as the two instruments that need standard-normal samples)"
  releaseArtifact: fs-annus-diffusion
  acceptanceState: owner-decided
- capabilityId: diffusion.measurement-bias
  family: "Diffusion inference"
  instrumentId: bm-08
  upstreamStatus: host-only
  owner: "src/physics/reference/inference.ts::covarianceEstimator"
  nativeTestTarget: "none; host evaluator not in tree; tests planned as inference.observation.test.ts"
  browserExport: not-exported
  admittedDomain: "admitted observation-error and optional exposure models; independent-increment interval disabled when its assumptions fail; no faked complex models"
  sourceReference: "catalogue BM-08; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2663; am-bm-08-measurement-bias-h1ye; family 3.4 docs/FRANKENSIM_BINDING.md:206-214"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: kinematics.clock-sync
  family: "Flat-spacetime kinematics"
  instrumentId: sr-01
  upstreamStatus: host-only
  owner: "src/physics/reference/events.ts::synchronizationRound"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside events.ts"
  browserExport: not-exported
  admittedDomain: "|v|/c in [0, 0.95]; no inertial observer at |v| >= c; clock separation finite; reception time distinct from remote-event time"
  sourceReference: "paper special-relativity §1; catalogue SR-01; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2664; am-sr-01-clock-sync-jbfn; family 3.5 docs/FRANKENSIM_BINDING.md:216-223"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: electrodynamics.magnet-conductor
  family: "Relativistic electrodynamics"
  instrumentId: sr-02
  upstreamStatus: host-only
  owner: "src/physics/reference/fields.ts::emfBothDescriptions"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside fields.ts"
  browserExport: not-exported
  admittedDomain: "prescribed dipole case; |v|/c in [0, 0.95]; apparatus mode computes nothing (static worked example); modeled mode is host calculation"
  sourceReference: "paper special-relativity introduction and §6; catalogue SR-02; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2665; am-sr-02-magnet-conductor-x1gc; family 3.6 docs/FRANKENSIM_BINDING.md:225-232"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: kinematics.rod-simultaneity
  family: "Flat-spacetime kinematics"
  instrumentId: sr-03
  upstreamStatus: host-only
  owner: "src/physics/reference/events.ts::measureRodLength"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside events.ts"
  browserExport: not-exported
  admittedDomain: "|v|/c in [0, 0.95]; only frame-simultaneous endpoint pairs are length measurements"
  sourceReference: "paper special-relativity §§2,4; catalogue SR-03; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2666; am-sr-03-rod-simultaneity-0l5i"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: kinematics.lorentz-map
  family: "Flat-spacetime kinematics"
  instrumentId: sr-04
  upstreamStatus: host-only
  owner: "src/physics/reference/kinematics.ts::boostMatrixXT"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside kinematics.ts"
  browserExport: not-exported
  admittedDomain: "|v|/c in [0, 0.95]; candidate maps tested against light trajectories and invertibility; 1904 mode may not read modern-si-2019 speed of light"
  sourceReference: "paper special-relativity §3; catalogue SR-04; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2667; am-sr-04-lorentz-map-px1k"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: kinematics.moving-clocks
  family: "Flat-spacetime kinematics"
  instrumentId: sr-05
  upstreamStatus: host-only
  owner: "src/physics/reference/events.ts::properTime"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside events.ts"
  browserExport: not-exported
  admittedDomain: "|v|/c in [0, 0.95]; worldline retained across view switches; equator-clock note is a labelled limit, not a core claim"
  sourceReference: "paper special-relativity §4; catalogue SR-05; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2668; am-sr-05-moving-clocks-2zka"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: kinematics.velocity-composition
  family: "Flat-spacetime kinematics"
  instrumentId: sr-06
  upstreamStatus: host-only
  owner: "src/physics/reference/kinematics.ts::transformVelocity"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside kinematics.ts"
  browserExport: not-exported
  admittedDomain: "|v|/c in [0, 0.95]; composed speed U < c; null velocity stays null"
  sourceReference: "paper special-relativity §5; catalogue SR-06; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2669; am-sr-06-velocity-composition-7ni4"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: electrodynamics.field-equations
  family: "Relativistic electrodynamics"
  instrumentId: sr-07
  upstreamStatus: host-only
  owner: "src/physics/reference/fields.ts::transformDerivatives"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside fields.ts"
  browserExport: not-exported
  admittedDomain: "algebraic chain-rule steps plus numeric Maxwell residuals for a plane wave; |v|/c in [0, 0.95]; Gaussian-historical and SI unit conventions distinct"
  sourceReference: "paper special-relativity §6; catalogue SR-07; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2670; am-sr-07-field-equations-xxes"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: electrodynamics.field-frame-change
  family: "Relativistic electrodynamics"
  instrumentId: sr-08
  upstreamStatus: host-only
  owner: "src/physics/reference/fields.ts::transformSI"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside fields.ts"
  browserExport: not-exported
  admittedDomain: "|v|/c in [0, 0.95]; observer-change does not restart the experiment; E, B finite; invariants E^2 - c^2 B^2 and E·B"
  sourceReference: "paper special-relativity §6; catalogue SR-08; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2671; am-sr-08-field-frame-change-5ibt; family 3.6 docs/FRANKENSIM_BINDING.md:225-232"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: electrodynamics.doppler-aberration
  family: "Relativistic electrodynamics"
  instrumentId: sr-09
  upstreamStatus: host-only
  owner: "src/physics/reference/waves.ts::dopplerFactor"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside waves.ts"
  browserExport: not-exported
  admittedDomain: "|v|/c in [0, 0.95]; propagation angle in [0, pi]; frequency > 0"
  sourceReference: "paper special-relativity §7; catalogue SR-09; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2672; am-sr-09-doppler-aberration-rabd"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: electrodynamics.light-complex
  family: "Relativistic electrodynamics"
  instrumentId: sr-10
  upstreamStatus: host-only
  owner: "src/physics/reference/waves.ts::lightComplexFactors"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside waves.ts"
  browserExport: not-exported
  admittedDomain: "|v|/c in [0, 0.95]; finite bounding surface; longitudinal-ray and moving-frame-transverse-ray fixtures both required"
  sourceReference: "paper special-relativity §8; catalogue SR-10; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2673; am-sr-10-light-complex-kek0"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: electrodynamics.moving-mirror
  family: "Relativistic electrodynamics"
  instrumentId: sr-11
  upstreamStatus: host-only
  owner: "src/physics/reference/waves.ts::dopplerFactor"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside waves.ts"
  browserExport: not-exported
  admittedDomain: "infinite-mass perfect reflector moving along its normal; |v|/c in [0, 0.95]; finite-mass mirrors are outside-domain; interception geometry respected"
  sourceReference: "paper special-relativity §8; catalogue SR-11; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2674; am-sr-11-moving-mirror-wnz1"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: electrodynamics.charge-current
  family: "Relativistic electrodynamics"
  instrumentId: sr-12
  upstreamStatus: host-only
  owner: "src/physics/reference/fields.ts::transformChargeCurrent"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside fields.ts"
  browserExport: not-exported
  admittedDomain: "|v|/c in [0, 0.95]; continuity residual in both frames; |J/rho| < c except the labelled neutral-current case"
  sourceReference: "paper special-relativity §9; catalogue SR-12; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2675; am-sr-12-charge-current-bgq0"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: particle-dynamics.electron-work
  family: "Prescribed-field particle dynamics"
  instrumentId: sr-13
  upstreamStatus: host-only
  owner: "src/physics/reference/electron.ts::kineticEnergy"
  nativeTestTarget: "none; host evaluator not in tree; tests planned beside electron.ts"
  browserExport: not-exported
  admittedDomain: "prescribed E and B; |v|/c in [0, 0.95]; two force conventions; radiation reaction and self-fields excluded"
  sourceReference: "paper special-relativity §10; catalogue SR-13; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2676; am-sr-13-electron-dynamics-b6v7; family 3.7 docs/FRANKENSIM_BINDING.md:234-241"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: energy.two-ledgers
  family: "Relativistic energy accounting"
  instrumentId: me-01
  upstreamStatus: host-only
  owner: "src/physics/reference/massEnergy.ts::pulseEnergies"
  nativeTestTarget: "none; host evaluator not in tree; tests planned as massEnergy.me01.test.ts"
  browserExport: not-exported
  admittedDomain: "emitted energy > 0; |v|/c in [0, 0.95]; internal energies remain symbolic; two-frame ledger with symbolic offsets"
  sourceReference: "paper mass-energy whole argument; catalogue ME-01; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2677; am-me-01-two-ledgers-g1re; family 3.8 docs/FRANKENSIM_BINDING.md:243-250"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: energy.mass-coefficient
  family: "Relativistic energy accounting"
  instrumentId: me-02
  upstreamStatus: host-only
  owner: "src/physics/reference/massEnergy.ts::stableGammaMinusOne"
  nativeTestTarget: "none; host evaluator not in tree; tests planned as massEnergy.me02.test.ts"
  browserExport: not-exported
  admittedDomain: "|v|/c in [0, 0.95]; exact / low-speed / proxy views; limiting evaluation stable near v = 0"
  sourceReference: "paper mass-energy the move; catalogue ME-02; COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2678; am-me-02-coefficient-dtmi"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: energy.system-boundary
  family: "Relativistic energy accounting"
  instrumentId: me-03
  upstreamStatus: host-only
  owner: "src/physics/reference/massEnergy.ts::boundaryLedger"
  nativeTestTarget: "none; host evaluator not in tree; tests planned as massEnergy.me03.test.ts"
  browserExport: not-exported
  admittedDomain: "include/exclude body and radiation; cited energy-source cards only; a card without a citation refuses; 1906 box is a labelled extension of the same ledger"
  sourceReference: "paper mass-energy; catalogue ME-03 (one instrument, three beads); COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md:2679; am-me-03-system-boundary-0arb"
  releaseArtifact: none
  acceptanceState: owner-decided
- capabilityId: diffusion.heat-frames
  family: "Diffusion and stochastic transport"
  instrumentId: none
  upstreamStatus: present
  owner: "fs_wasm::heat_frames"
  nativeTestTarget: "none; git grep -n -e heat_frames 5bbbfae -- crates/fs-wasm hits only lib.rs:252 and the wasm_bindgen wrapper at lib.rs:1000; crates/fs-wasm/tests/ does not exist at the pin; in-crate tests at lib.rs:841+ cover taylor_bound and reed, not heat_frames"
  browserExport: heat_frames
  admittedDomain: "not admitted for any Annus Mirabilis instrument; n clamped to 3-96, frames to 1-240, steps_per_frame to 1-40; dimensionless dt = 0.20; hard-coded two Gaussian blobs; no diffusion coefficient, spacing, or profile"
  sourceReference: "crates/fs-wasm/src/lib.rs:252 (pub fn heat_frames); clamp at lib.rs:253; blobs at lib.rs:268; dt at lib.rs:271; wasm_bindgen wrapper lib.rs:1000; family 3.3 docs/FRANKENSIM_BINDING.md:199"
  releaseArtifact: none
  acceptanceState: owner-decided
  reason: "heat_frames is present in fs-wasm at the pin and is exported to the browser, but it is not an honest owner for BM-06 or any other diffusion instrument. The first-export owner is diffusion1d_frames."
- capabilityId: radiation.planck-graphics-weight
  family: "Radiation spectra"
  instrumentId: none
  upstreamStatus: present
  owner: "fs_render::volumes::planck"
  nativeTestTarget: "crates/fs-render/tests/volumes_battery.rs::vol_004_spectral_emission (test fn at line 201; planck call at line 209; hotter-brighter at line 236; verdict id vol-004-planck-ordering at line 240)"
  browserExport: not-exported
  admittedDomain: "not admitted; unnormalized computer-graphics weight 1/(lambda^5 (exp(c2/(lambda T))-1)) with c2 = 1.438_776_877e7 nm K; not SI u(nu,T)"
  sourceReference: "crates/fs-render/src/volumes.rs:626 (pub fn planck); C2 at volumes.rs:627 as 1.438_776_877e7; family 3.1 docs/FRANKENSIM_BINDING.md:177; fs-render pulled by fs-wasm Cargo.toml:75"
  releaseArtifact: none
  acceptanceState: owner-decided
  reason: "fs_render::volumes::planck is present at the pin but is an unnormalized graphics weight. LQ-03's owner is the host evaluator radiation.ts::planckNu until am-fs-owner-radiation-6uv ships a certified SI spectrum."
- capabilityId: evidence.certificate
  family: "Evidence and uncertainty"
  instrumentId: none
  upstreamStatus: present
  owner: "fs_evidence::Evidence::certified"
  nativeTestTarget: "crates/fs-evidence/src/lib.rs::certified_discipline_refuses_estimates_and_out_of_domain_models (line 1557); crates/fs-evidence/tests/ has action.rs, balance.rs, conformance.rs and cinematic suites"
  browserExport: not-exported
  admittedDomain: "not admitted as a 1905-paper claim certificate; Evidence<T> is the traveling FEA/UQ noun (value, qoi, numerical, statistical, model, sensitivity, provenance)"
  sourceReference: "crates/fs-evidence/src/lib.rs:928 (pub struct Evidence<T>); certified at lib.rs:1183; CONTRACT.md travelling-noun at lines 111-117; family 3.9 docs/FRANKENSIM_BINDING.md:252-262"
  releaseArtifact: none
  acceptanceState: owner-decided
  reason: "No core-catalogue instrument consumes fs-evidence as a physical law. am-fs-owner-evidence-rk7 is the adapter bead; until it lands, snapshot provenance is not this crate."
- capabilityId: evidence.hash-bytes
  family: "Evidence and uncertainty"
  instrumentId: none
  upstreamStatus: present
  owner: "fs_blake3::hash_bytes"
  nativeTestTarget: "crates/fs-blake3/tests/identity.rs::official_and_independent_blake3_vectors_remain_foundational (line 740; hash_bytes empty vector at line 742; abc at line 746)"
  browserExport: not-exported
  admittedDomain: "byte strings of any length; 32-byte ContentHash; domain-separated form is hash_domain (lib.rs:431), not this function"
  sourceReference: "crates/fs-blake3/src/lib.rs:377 (pub fn hash_bytes); DomainHasher at lib.rs:390; hash_domain at lib.rs:431; CONTRACT.md public types at lines 19-29 (the word Deterministic does not appear in crates/fs-blake3; bit-identity to the BLAKE3 spec is stated at CONTRACT.md:111)"
  releaseArtifact: none
  acceptanceState: owner-decided
  reason: "No core-catalogue instrument hashes a physical quantity with BLAKE3. The runtime may later bind snapshot digests through am-fs-owner-evidence-rk7; that is not a launch instrument row."
```

### 6. Orphan reasons (counted above)

1. `diffusion.heat-frames`: present `fs_wasm::heat_frames` (`crates/fs-wasm/src/lib.rs:252`, wrapper `:1000`). Clamps, dimensionless, two blobs. Not BM-06.
2. `radiation.planck-graphics-weight`: present `fs_render::volumes::planck` (`crates/fs-render/src/volumes.rs:626`). Graphics weight, not SI spectral density. Not LQ-03.
3. `evidence.certificate`: present `fs_evidence::Evidence::certified` (`crates/fs-evidence/src/lib.rs:1183`). FEA/UQ certificate, no core instrument.
4. `evidence.hash-bytes`: present `fs_blake3::hash_bytes` (`crates/fs-blake3/src/lib.rs:377`). Provenance primitive, no core instrument.

`crates/fs-rand/src/qmc.rs:65` `pub struct Sobol` was listed in §3.4 as a candidate and is not an inference owner. It is not given a matrix row: it is not a capability this site will ship, and naming it would imply a consumer. The family-4 owner is `inference.ts`, host-only, consumed by `bm-07` and `bm-08`.

`fs-lattice` (Cargo.toml:8, infill optimization) and `fs-flux` (Cargo.toml:8, incompressible Navier–Stokes) are name traps recorded in §2.10 of the binding document. They are not capabilities and have no rows.

### 7. Commands actually run (citation log)

FrankenSim pin `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`. Live HEAD at inspection time was `135b00088677e5bb854d4da07c67517b2ff96b7e`. Every line number below was produced by one of these commands, not from memory.

```text
git -C /Users/jemanuel/projects/frankensim rev-parse HEAD
git -C /Users/jemanuel/projects/frankensim rev-parse 5bbbfae6f7de614422f6f97f5798a3e00f8ad813
git -C /Users/jemanuel/projects/frankensim status --porcelain
git -C /Users/jemanuel/projects/frankensim grep -n -e 'pub fn planck' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-render/src/volumes.rs
# 626:pub fn planck(lambda_nm: f64, t_kelvin: f64) -> f64 {
git -C /Users/jemanuel/projects/frankensim grep -n -e 'STEFAN_BOLTZMANN' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-conduction/src/radiation.rs
# 35:pub const STEFAN_BOLTZMANN_W_M2_K4: f64 = 5.670_374_419e-8;
git -C /Users/jemanuel/projects/frankensim grep -n -e 'pub fn next_normal' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-rand/src/lib.rs
# 579:    pub fn next_normal(&mut self) -> f64 {
# 591:    pub fn next_normal_ziggurat(&mut self) -> f64 {
git -C /Users/jemanuel/projects/frankensim grep -n -e 'fn philox4x32_10' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-rand/src/philox.rs
# 31:pub fn philox4x32_10(...)
git -C /Users/jemanuel/projects/frankensim grep -n -e 'pub fn spmv' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-sparse/src/lib.rs
# 313:    pub fn spmv(&self, x: &[f64], y: &mut [f64]) {
git -C /Users/jemanuel/projects/frankensim grep -n -e 'pub fn heat_frames' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-wasm/src/lib.rs
# 252:pub fn heat_frames(...)
# 1000:    pub fn heat_frames(...)   # wasm_bindgen wrapper
git -C /Users/jemanuel/projects/frankensim grep -n -e 'pub struct Evidence' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-evidence/src/lib.rs
# 928:pub struct Evidence<T> {
git -C /Users/jemanuel/projects/frankensim grep -n -e 'pub fn hash_bytes' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-blake3/src/lib.rs
# 377:pub fn hash_bytes(bytes: &[u8]) -> ContentHash {
git -C /Users/jemanuel/projects/frankensim grep -n -e 'pub struct DomainHasher' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-blake3/src/lib.rs
# 390:pub struct DomainHasher {
git -C /Users/jemanuel/projects/frankensim grep -n -e 'pub struct Sobol' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-rand/src/qmc.rs
# 65:pub struct Sobol {
git -C /Users/jemanuel/projects/frankensim grep -n -i -e 'avogadro' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates
# fs-thermochem/src/lib.rs:47 doc comment; CONTRACT.md:162
git -C /Users/jemanuel/projects/frankensim grep -n -e '6.02214076e23' -e '6.022_140_76e23' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates
# crates/fs-qty/src/json.rs:525  6.02214076e23
# crates/fs-qty/src/json.rs:611  6.022_140_76e23
git -C /Users/jemanuel/projects/frankensim grep -n -e 'vol-004-planck' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-render
# tests/volumes_battery.rs:240
git -C /Users/jemanuel/projects/frankensim grep -n -e 'fs-render' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-wasm/Cargo.toml
# 75:fs-render = { path = "../fs-render" }
git -C /Users/jemanuel/projects/frankensim grep -n -e 'description' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-lattice/Cargo.toml
# 8:description = "Lattice/infill optimization ..."
git -C /Users/jemanuel/projects/frankensim grep -n -e 'description' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-flux/Cargo.toml
# 8:description = "Incompressible Navier-Stokes, FEEC-native: ..."
git -C /Users/jemanuel/projects/frankensim grep -n -e 'pub struct Interval' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-ivl
# src/interval.rs:20
git -C /Users/jemanuel/projects/frankensim grep -n -e 'brownian_frames' -e 'philox_normals' -e 'diffusion1d_frames' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates
# (empty)
git -C /Users/jemanuel/projects/frankensim grep -n -e 'fn brownian' -e 'fn philox_normal' -e 'fn diffusion1d' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates
# NO MATCH
git -C /Users/jemanuel/projects/frankensim grep -n -e 'Deterministic' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-blake3
# (empty) — then the file was read: git show 5bbbfae:crates/fs-blake3/CONTRACT.md
# Bit-identity claim is CONTRACT.md:111, not a Deterministic class token.
git -C /Users/jemanuel/projects/frankensim grep -n -e 'next_normal' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-rand/tests/dist_battery.rs
# NO MATCH — file was read; dist_battery.rs tests gamma/alias, not next_normal.
# next_normal native test is crates/fs-rand/src/lib.rs:829 fn normal_and_exponential_moments, call at :834.
git -C /Users/jemanuel/projects/frankensim ls-tree -d 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 crates/fs-wasm/
# .cargo and src only; no tests/
git -C /Users/jemanuel/projects/frankensim grep -n -e '1.438' -e '1_438' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-render/src/volumes.rs
# 627:    const C2_NM_K: f64 = 1.438_776_877e7;
git -C /Users/jemanuel/projects/frankensim grep -n -e 'pub fn certified' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-evidence/src/lib.rs
# 1183:    pub fn certified(self) -> Result<Certified<T>, CertifyError>
git -C /Users/jemanuel/projects/frankensim grep -n -e 'hash_domain' 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 -- crates/fs-blake3/src/lib.rs
# 431:pub fn hash_domain(...)
```

Local (this repository, not FrankenSim):

```text
rg -n "^### 3\." docs/FRANKENSIM_BINDING.md
rg -n "Proposed Owner Decision" docs/FRANKENSIM_BINDING.md
rg -n "^\| LQ-0|^\| BM-0|^\| SR-0|^\| SR-1|^\| ME-0" COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md
rg -n "Radiation spectra|Idealized quantum|Diffusion and stochastic|Diffusion inference|Flat-spacetime|Relativistic electrodynamics|Prescribed-field|Relativistic energy|Evidence and uncertainty" COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md
rg -n "radiation.ts|photoelectric.ts|diffusion.ts|inference.ts|kinematics.ts|events.ts|fields.ts|waves.ts|electron.ts|massEnergy.ts" COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md
rg -n "fs-annus-diffusion" <bead am-fs-slim-artifact-0yh>
rg -n "radiation temperature|photoelectric work|Brownian radius|frame speed signed" AGENTS.md
```

### 8. What this lane did not do

- Did not write `docs/FRANKENSIM_BINDING.md` or `docs/DECISIONS.md`.
- Did not close any bead.
- Did not implement exports.
- Did not answer decision (f).
- Did not claim `verified` or `adopted`.
- Did not emit one row per bead (`bm-07` kitchen mode and `me-03` box-extension / 3d-view remain the same `instrumentId`).
- Did not register composite laboratory ids such as `avogadro-lab`; the experiment registry does not exist yet, so only the closed 33 plus `none` appear.

---

## 8. Decisions (d), (e), (g), (h), and (i)

**Lane:** E (CrimsonCedar, grok-4.6)  
**Bead:** `am-fs-capability-audit-byc` requirement 5, items (d) (e) (g) (h) (i)  
**This file is a merge source only.** It does not modify `docs/FRANKENSIM_BINDING.md` or `docs/DECISIONS.md`.  
**Decision (f) is not decided here.** Evidence for (f) is in a labelled appendix. No winner. No decider name.

**Pinned FrankenSim revision cited throughout:** `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`  
**Live checkout HEAD while this lane ran (not used for citations):** `135b00088677e5bb854d4da07c67517b2ff96b7e`  
**Citation method:** `git -C /Users/jemanuel/projects/frankensim show ${REV}:<path> | grep -n` or `python3` line walk of that `git show` stdout, at the moment of citation. Live-tree line numbers were not used.

This lane did not create or modify anything under `/Users/jemanuel/projects/frankensim` or its siblings. `git -C /Users/jemanuel/projects/frankensim status --porcelain` after the greps: empty. HEAD still `135b00088677e5bb854d4da07c67517b2ff96b7e`.

---

### (d) Distribution path

**Decision.** Scientific exports (`brownian_frames` Gaussian step, `philox_normals`, and any later export that draws a standard normal for a scientific result) call `Stream::next_normal` only. `Stream::next_normal_ziggurat` is excluded from those exports, from their tests' scientific path, and from TypeScript ports of that path, until FrankenSim admits the ziggurat to strict mode with the evidence its own CONTRACT names.

**What the pin actually says (grep -n on `${REV}:crates/fs-rand/src/lib.rs`):**

| Line | Text |
|---|---|
| 11 | `//! Box–Muller normals via \`det::{ln, cos}\` and exponentials via \`det::ln\`.` |
| 12 | `//! A ziggurat normal is available as an explicit fast-mode path; strict` |
| 13 | `//! callers stay on Box–Muller until the cross-ISA admission proof lands.` |
| 576 | `/// Standard normal via Box–Muller on fs-math strict functions —` |
| 577 | `/// cross-ISA deterministic sampled values. Consumes exactly 2 draws.` |
| 579 | `pub fn next_normal(&mut self) -> f64 {` |
| 581 | `let u = 1.0 - self.next_f64();` |
| 582 | `let v = self.next_f64();` |
| 583 | `det::sqrt(-2.0 * det::ln(u)) * det::cos(2.0 * std::f64::consts::PI * v)` |
| 586 | `/// Standard normal via the ZIGGURAT (bead 1za9) — the FAST-MODE-ONLY perf` |
| 587 | `/// path. Deterministic table + deterministic rejection consumption, but not` |
| 588 | `/// admitted to strict mode until a cross-ISA bitwise proof lands; strict` |
| 589 | `/// callers use [\`Stream::next_normal\`] (Box–Muller). See [\`ziggurat\`].` |
| 591 | `pub fn next_normal_ziggurat(&mut self) -> f64 {` |
| 592 | `ziggurat::normal(self)` |

`crates/fs-rand/src/ziggurat.rs` at the pin, lines 1–20 (same `git show | python` walk): FAST-MODE-ONLY; admitting it to strict mode "needs a proven cross-ISA bitwise-equal run on both reference machines (the `trj` pipeline)"; "Until that lands it is gated FAST-MODE-ONLY".

`crates/fs-rand/CONTRACT.md` at the pin:

- lines 22–27: `next_normal` is Box–Muller on fs-math strict functions; `next_normal_ziggurat` is "FAST-MODE-ONLY until a cross-ISA bitwise proof admits it to strict mode".
- lines 290–294: ziggurat "ships FAST-MODE-ONLY" and "not admitted to strict mode until a cross-ISA bitwise-equal run on both reference machines lands (the `trj` pipeline); Box–Muller stays the strict default".
- lines 345–349: the ziggurat golden `995960fe709f00bc` over 100k draws "reproduces across independent aarch64 environments; the x86-64 run completes the trj proof the moment an x86 reference machine is available (the rch fleet is currently ARM-only, verified by census)".

`golden-couplings.json` line 151 at the pin (`fs-rand:ziggurat-stream`): the same hash `0x9959_60fe_709f_00bc` is registered, and the justification states "current-tree debug/release and cross-ISA reproduction remain pending and are not newly claimed by this annotation."

`docs/G5_CROSS_ISA_REPORT.md` at the pin lists `rand/philox-256-draws` as identical across aarch64-m4 and x86-64-ts1 (line 15). It does not list a ziggurat or Box–Muller sample artifact.

**Consequences.**

- `am-fs-export-brownian-frames-nhm` Gaussian `step_kernel` values call `next_normal`, never `next_normal_ziggurat`.
- `am-fs-export-philox-normals-xnv` is a loop of `next_normal`.
- A TypeScript port of the scientific normal is a port of Box–Muller on the same two-draw contract (`u = 1 - next_f64()`, `v = next_f64()`, then the `det` formula), not of the ziggurat table.
- A later FrankenSim revision that admits ziggurat to strict mode is a new pin plus a G5 record. This decision does not pre-admit it.

---

### (e) Determinism class for each new export

FrankenSim's taxonomy is `docs/DETERMINISM_CLASSES.md` at the pin (45 lines). Classes and the evidence they require:

| Class | Guarantee (line 14–16) | Verified by |
|---|---|---|
| `Deterministic` | Bit-identical across runs, worker counts, build modes, **and ISAs** (aarch64/x86-64 × debug/release) | G5: replay + golden hashes reproduced on both ISAs; goldens in `golden-couplings.json` per `docs/GOLDEN_POLICY.md` |
| `DeterministicPerIsa` | Bit-identical on one ISA; last-ULP drift across ISAs/libm admitted and scoped | G5 on a single host class; "cross-ISA comparison is explicitly NOT evidence for or against" |
| `Fast` | Statistical/tolerance envelopes only | G0/G3 on envelopes; G5 only of the mode tag |

Line 36–38: "a determinism claim without its G5 lane is documented as **targeted, not achieved**."

This lane does **not** claim cross-ISA bitwise identity for any new export. None of `brownian_frames`, `philox_normals`, or `diffusion1d_frames` exists at the pin (peer probe, `binding-s4-buildprobe.md` §4.7: 37 `#[wasm_bindgen]` functions, none of those three names). There is therefore no export golden and no G5 lane for them.

#### Shared upstream evidence (not an export claim)

| Surface | Pin evidence | What it does and does not prove |
|---|---|---|
| Philox integer core | `docs/G5_CROSS_ISA_REPORT.md:15` `rand/philox-256-draws` identical aarch64-m4 vs x86-64-ts1. `crates/fs-rand/CONTRACT.md:183–185` "The Philox integer core and fs-math-strict distributions are deterministic CROSS-ISA." `next_u64` at `crates/fs-rand/src/lib.rs:546–549`. | Integer Philox blocks have a G5 cross-ISA record at this pin. That is not a record for Box–Muller samples, FTCS fields, or a new export's output buffer. |
| `next_f64` | `crates/fs-rand/src/lib.rs:554–555`: `(self.next_u64() >> 11) as f64 * (1.0 / 9_007_199_254_740_992.0) // 2⁻⁵³` (search also `9007199254740992`). | Exact binary64 scale of an integer draw. No G5 artifact named `next_f64` in the G5 report. |
| `next_normal` (Box–Muller) | Body at lib.rs 579–583 uses `det::sqrt`, `det::ln`, `det::cos`. Those functions: `crates/fs-math/src/det.rs:95` `ln`, `:170` `cos`, `:238` `sqrt`. `crates/fs-math/CONTRACT.md:14–17` claims the strict core is bit-identical cross-ISA by construction and empirically proven (golden `0xeb79cab7a01643e5` on aarch64-apple M4 Pro and x86-64 TR 5995WX). Class at `crates/fs-math/CONTRACT.md:135–136`: "Deterministic CROSS-ISA (the strongest class in the workspace): proven." | Composition of proven `det` functions with Philox uniforms is the crate's **claim** for samples. `golden-couplings.json:150` (`fs-rand:distribution-stream`) says "current-tree debug/release and cross-ISA reproduction remain pending". G5 report has no Box–Muller row. Per DETERMINISM_CLASSES.md:36–38, the **sample** claim is targeted until a G5 lane for those samples exists. |
| Ziggurat | Excluded by (d). Coupling line 151 pending. CONTRACT.md:345–349: aarch64 only; x86-64 trj proof not landed. | Must not be used to discharge a `Deterministic` claim. |
| `fs-sparse` SpMV | `crates/fs-sparse/CONTRACT.md:137–148`: "Bit-deterministic cross-ISA by construction"; goldens `0xbcf5_52b6_c5bf_aed6` and `0x752f_215a_26e3_2fea` recorded on aarch64-apple and verified identical on x86-64. FMA capsule `src/fma/mod.rs` is `#[cfg(target_arch = "x86_64")]` (mod.rs:20, :35, :50, :59, :102; SAFETY.md:4 "compiled only on `target_arch = \"x86_64\"`"). | Native aarch64/x86-64 SpMV has dual-ISA goldens for the crate batteries. wasm32 is not those two hosts and uses the portable body. That is not a G5 record for `diffusion1d_frames`. |
| `fs-wasm` demos | `crates/fs-wasm/CONTRACT.md:172–176`: "Deterministic for fixed inputs on one target/ISA, subject to the determinism contracts of the underlying crates. Cross-browser and cross-ISA bit identity is not claimed for floating-point visual demos." | Existing kitchen-sink demos do not carry a cross-ISA bitwise claim. Scientific AM exports must not inherit that no-claim as if it were a class. |

G5 lanes FrankenSim actually lists for determinism (`docs/CROSS_ISA_VERIFICATION.md:59–61`): `cargo test -p fs-fft -p fs-sparse -p fs-la -p fs-topo -p fs-evidence --release`. That list does not include `fs-rand` distribution samples or any AM export.

#### Class recorded for each new export

Every row is **targeted**, not achieved. Export beads register goldens under `docs/GOLDEN_POLICY.md` and run G5 before anyone writes `Deterministic` without the word targeted.

| Export | Arithmetic in the planned body | Recorded class | G5 evidence this pin supplies | G5 evidence still required |
|---|---|---|---|---|
| `brownian_frames` coin (`step_kernel` 0) | One `next_u64`; sign from the top bit; step length `s` from `(2.0 * diffusion * dt).sqrt()` on `det::sqrt` (decision (a) owns the formula; this row owns the class) | **targeted `Deterministic`** | Integer Philox: G5 `rand/philox-256-draws` identical. `det::sqrt` claimed 0 ULP hardware. | A golden over the export's position buffer, four-quadrant native, plus a native-vs-`wasm32-unknown-unknown` comparison recorded as bitwise or as `DeterministicPerIsa` with a named ULP bound. |
| `brownian_frames` uniform (`step_kernel` 1) | One `next_f64`; scale by `h` | **targeted `Deterministic`** | `next_f64` is an exact 2^-53 scale of Philox. No G5 row for uniform samples. `fs-rand:distribution-stream` cross-ISA pending (`golden-couplings.json:150`). | Same export-buffer G5 as above. |
| `brownian_frames` Gaussian (`step_kernel` 2 and/or 3 per decision (a)) | Two draws via `next_normal`; scale by `s` | **targeted `Deterministic`** | `next_normal` uses `det::{ln,cos,sqrt}`. fs-math strict-core dual-ISA golden is for the `det` battery, not for this export. No G5 Box–Muller row. | G5 of the export buffer on both ISAs × debug/release; do not treat the `det` core hash as a substitute. |
| `philox_normals` | `count` calls to `next_normal` from `(seed, stream_kernel, tile, start_index)` | **targeted `Deterministic`** | Same as Gaussian `next_normal`. | G5 of the sample vector; bitwise native-vs-wasm32 either holds (then class may be promoted) or is scoped as `DeterministicPerIsa`. |
| `diffusion1d_frames` | FTCS with `fs-sparse` three-point Laplacian / `Csr::spmv` (`mul_add`) | **targeted `Deterministic`**, with an explicit wasm32 question | fs-sparse crate goldens dual-ISA on native. FMA capsule is x86_64-only. wasm32 uses the portable body. `fs-wasm` itself does not claim cross-ISA for float demos. | G5 of refused and accepted frames; native four-quadrant; native-vs-wasm32. If last-ULP drift appears on wasm32, the CONTRACT for this export says `DeterministicPerIsa` and does not use an unqualified "bitwise across browsers" sentence. |

**Promotion rule (DETERMINISM_CLASSES.md:28–30).** A later promotion `DeterministicPerIsa` → `Deterministic` re-freezes every golden in the same change. Export beads do not print "bitwise across ISA" on a README, HUD, or execution label until that promotion exists.

**Host TypeScript comparison.** AGENTS.md (this repository, lines 668 region and the FrankenSim Binding chapter) requires a Philox cross-check. Integer Philox can be bitwise against `fs-rand` given the G5 integer record. The Box–Muller samples may be bitwise native-vs-TS if the TS port uses the same two-draw contract and a bit-faithful `det` port; that still does not discharge FrankenSim G5 for the Rust export. Record each comparison as `bitwise` or `tolerance` per the logging standard. Never call a tolerance match "bitwise".

---

### (g) Targets

**Decision.** The Brownian slice has exactly two admitted targets until a later bead records measurements that earn more:

1. **One native test target.** `cargo test --locked` of the audited numerical slice (`fs-rand`, `fs-math`, `fs-sparse`) plus the tests that ship with the export crate. FrankenSim's DSR already names this obligation for `fs-wasm`: `docs/CI_GATES.md:349–351` "Native tests against its tracked lock"; `scripts/ci/quality_lanes.sh:452–454` `cargo test --locked --manifest-path "$WASM_MANIFEST"`.
2. **One single-threaded browser target.** `wasm32-unknown-unknown`, `wasm-pack build --target web` (dev in the quality lane, release for the shipped digest). `docs/CI_GATES.md:352–354`: locked `wasm32-unknown-unknown` Cargo check, then `wasm-pack build --dev --target web -- --locked` whose invocation must not modify the nested lock. `scripts/ci/quality_lanes.sh:496–498` is that command with `--out-dir` isolated.

**Deferred, not admitted for this slice:** threads, shared memory (`SharedArrayBuffer` / wasm atomics), SIMD specialization, GPU compute. AGENTS.md line 668 states the same sentence this bead copies.

**What the pin does not enable.**

- `crates/fs-wasm/Cargo.toml` has no atomics, no `wasm-bindgen-rayon`, no `target-feature=+simd128` (file walked at the pin; wasm32 deps are lines 101–105: `wasm-bindgen = "0.2"`, `asupersync` `wasm-browser-prod`, `getrandom` `wasm_js`).
- `rust-toolchain.toml:1–3` mentions `experimental-portable-simd` in `fs-simd`. That is not a Brownian-slice target.
- Root `.cargo/config.toml:42–43` `rustflags = ["-Z", "threads=4"]` is rustc **compile** parallelism, not wasm threads. The slim/probe build must not treat it as a wasm threading decision.
- `crates/fs-flyer-wasm/CONTRACT.md:163` (grep hit) discusses JS shared-memory transport for the Flyer app. That is a different crate and is not imported into the Brownian slice.

**Consequences.**

- `am-fs-export-brownian-frames-nhm`, `am-fs-export-philox-normals-xnv`, `am-fs-export-diffusion1d-cew`, and `am-fs-slim-artifact-0yh` add no `--target` other than host native and `wasm32-unknown-unknown`.
- Browser tests instantiate the `--target web` module on one worker. They do not require COOP/COEP or `SharedArrayBuffer`.
- A later SIMD or threaded artifact is a new `releaseArtifact` row, not a silent flag on this slice.

---

### (h) Reproducible build method

**Decision.** The shipped bundle is built so that bytes are identical across machines and directories when the inputs below are identical. `am-fs-slim-artifact-0yh` implements this method. The capability-audit probe records, as a first-class observation, **whether two builds in different directories match**.

Peer probe `logRunId=20260915T204024Z-fa82f3e8` (`binding-s4-buildprobe.md`) produced **no `.wasm`**, so it could not record a two-directory match. That absence is not a match and not a mismatch. The method still requires the observation.

#### Inputs

1. **Sources from `git archive` of pinned revisions**, never from a live dirty checkout. FrankenSim pin `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`. Sibling revisions the chosen graph reaches are archived the same way (probe already archived asupersync `5adf01082b14de1d7bd2c9d9da9779d5502cb4bc`). Layout preserves relative `../../../asupersync` paths. Outputs stay inside `artifacts/wasm-build/probe-<revision>/<tool-run-id>/` (or the slim-artifact equivalent). Nothing is written into `~/projects/frankensim` or siblings.

2. **`--locked` with the crate lockfile.** For an `fs-wasm` build: `crates/fs-wasm/Cargo.lock` at the pin. For a capability crate: that crate's nested lock. `docs/CI_GATES.md:353–354` already fails the quality lane if wasm-pack rewrites the nested lock. `quality_lanes.sh:490–509` hashes the lock before and after.

3. **`RUSTFLAGS` with `--remap-path-prefix` for both the build root and the Cargo registry path**, so absolute paths do not enter panic strings or metadata. `git grep remap-path-prefix` at the pin excluding `.beads` returned **no matches**. This remap is an Annus Mirabilis build requirement, not something FrankenSim already sets.

   Recorded form (probe-local `.cargo/config.toml` or encoded `RUSTFLAGS`; do not let an env `RUSTFLAGS` silently drop other flags):

   ```text
   --remap-path-prefix=<BUILD_ROOT>=/annus-mirabilis/build
   --remap-path-prefix=<CARGO_HOME>/registry=/annus-mirabilis/registry
   ```

   If the graph uses `CARGO_HOME/git`, remap that prefix too. `<BUILD_ROOT>` is the archive root used for that run, so two different directory names produce the same remapped strings.

   Trap: env `RUSTFLAGS` replaces `.cargo/config.toml` rustflags. The live FrankenSim root config (`.cargo/config.toml:42–43`) sets `-Z threads=4`; `crates/fs-wasm/.cargo/config.toml:7–8` sets `[target.wasm32-unknown-unknown] rustflags = ["--cap-lints=warn"]`. The slim/probe script must compose remaps **and** the wasm32 `cap-lints=warn` when building `fs-wasm`, and must not inherit `-Z threads=4` as if it were part of the artifact identity.

4. **Pinned `wasm-pack` version, with a `wasm-bindgen` CLI matching the lockfile.**

   - Observed on this host this session: `wasm-pack --version` → `wasm-pack 0.13.1` at `/Users/jemanuel/.cargo/bin/wasm-pack`. Peer probe recorded the same string.
   - `crates/fs-wasm/Cargo.lock` at the pin: `name = "wasm-bindgen"` at line 2399, `version = "0.2.126"` at line 2400, checksum `4b067c0c11094aef6b7a801c1e34a26affafdf3d051dba08456b868789aaf9a4` at line 2402.
   - `git grep 'name = "wasm-bindgen-cli"'` on `crates/fs-wasm/Cargo.lock` and `crates/fs-demo-physics-wasm/Cargo.lock` at the pin: **no match**. The CLI is a host tool. Pin it to **0.2.126** so `wasm-bindgen-cli --version` matches the lockfile crate. The slim script fails if either tool version differs.
   - Recorded pins: **wasm-pack 0.13.1**, **wasm-bindgen-cli 0.2.126**. A later bump is a recorded change, not a silent host upgrade.

5. **`wasm-opt` disabled** for the reproducible artifact (the allowed alternative is a pinned binaryen version; none is recorded at this pin).

   - `git grep wasm-opt` at the pin excluding `.beads` and the Flyer plan: **no matches** in the quality lane or `fs-wasm` crate.
   - `quality_lanes.sh:496–498` uses `wasm-pack build --dev`, which does not run wasm-opt.
   - Shipped digests will use `--release`. Default wasm-pack release behaviour runs wasm-opt when binaryen is installed and skips it when it is not, which would make bytes host-dependent.
   - Decision: invoke wasm-pack with wasm-opt off (`--no-opt`, or equivalent documented flag of the pinned 0.13.1). Do not rely on "binaryen not installed". If a later bead wants wasm-opt, it pins a binaryen version and re-runs the two-directory match.

6. **getrandom backend flags, only if getrandom is in the shipped graph.**

   - `crates/fs-wasm/Cargo.toml:105` at the pin: `getrandom = { version = "0.4", features = ["wasm_js"] }`. Lockfile: `getrandom` 0.4.3 at line 1549–1552 (also a 0.2.17 entry at 1538–1541).
   - `crates/fs-wasm/.cargo/config.toml` at the pin has **no** `getrandom_backend` cfg (only `--cap-lints=warn`).
   - `git grep getrandom_backend` at the pin excluding `.beads`: **no matches**.
   - getrandom 0.4.3 (cargo registry README:79–80; `src/backends.rs:170–174`; CHANGELOG 0.3.4 lines 63–71, inherited): when feature `wasm_js` is enabled, the wasm_js backend is used by default; `--cfg getrandom_backend="wasm_js"` is **not required** to compile. A different `--cfg getrandom_backend=...` still overrides and would change or break the build (`CHANGELOG.md:73–76`).
   - **If the shipped graph is `fs-wasm`:** keep feature `wasm_js`; do not set a conflicting `getrandom_backend`. No extra getrandom `RUSTFLAGS` are required at 0.4.3.
   - **If the shipped graph is a capability crate depending only on `fs-rand` / `fs-sparse` / `fs-math`:** getrandom is not in that graph (peer probe `probe-cargo-tree` exit 0: three leaf crates only; zero getrandom). Then no getrandom flags apply.
   - Scientific draws must not call getrandom. Seeds come from the caller. getrandom in `fs-wasm` is a wasm32 host-entropy dependency of the kitchen-sink graph, not an owner of Brownian streams.

#### Two-directory match (required probe observation)

The probe (and later `am-fs-slim-artifact-0yh`) must:

1. Build the artifact in directory A from `git archive` + the flags above.
2. Build it again in directory B, a different absolute path, same pins and tool versions.
3. Record SHA-256 of both `.wasm` files, both lockfiles, `wasm-pack --version`, `wasm-bindgen-cli --version`, the remapped `RUSTFLAGS`, and whether the two `.wasm` hashes are equal.
4. A match is evidence that remap-path-prefix did its job. A mismatch is a failed reproducibility gate, not a reason to drop the remap.

Until both `.wasm` files exist, the document states **unobserved**, not true and not false.

#### Commands the slim script is expected to run (not claimed as already green)

```bash
# native slice (g)
cargo test --locked -p fs-rand -p fs-math -p fs-sparse
# plus the export crate's tests once they exist

# browser (g)+(h)
cargo check --locked --target wasm32-unknown-unknown
wasm-pack build --release --target web --no-opt --out-dir <isolated> -- --locked
```

Exact wasm-pack flag spelling is checked against wasm-pack 0.13.1 help at implementation time; if `--no-opt` is named differently in that version, the script uses that version's disable switch and records the string.

---

### (i) Naming

**Decision.** The overloaded word `kernel` never appears ambiguously in Annus Mirabilis Rust, TypeScript, or documentation.

| Thing | Name | Why |
|---|---|---|
| Step-distribution selector of `brownian_frames` | `step_kernel` (`u32`) | AGENTS.md:651 sketches `kernel: u32` on `brownian_frames`. That is a **step** selector (coin / uniform / Gaussian), not a Philox stream identity. |
| `StreamKey` field in FrankenSim | remains `kernel` in upstream Rust | `crates/fs-rand/src/lib.rs:134–140`: `pub struct StreamKey { pub seed: u64, pub kernel: u32, pub tile: u32 }` with comment on line 137 "Kernel identity (registry-assigned; stable across runs)." AM code that constructs a `StreamKey` may fill the field; AM docs and TS names say **stream kernel id**. |
| Registry / tape / protocol ids | **stream kernel id** | Decision (c) owns the table. Consumers copy those names. |
| `philox_normals` argument | `stream_kernel` | AGENTS.md:666 sketches `(seed, kernel, tile, start_index, count)`. The `kernel` in that sketch is `StreamKey.kernel`, not `step_kernel`. The export signature uses `stream_kernel` so the two cannot be swapped. |

**Forbidden in AM-authored signatures, comments, HUD copy, and binding prose:** a bare parameter or column named `kernel`.

**Allowed:** `step_kernel`, `stream_kernel`, `stream kernel id`, and the upstream field `StreamKey.kernel` when quoting FrankenSim.

**Why the collision is real.** `StreamKey.kernel` already carries production-like values in FrankenSim tests and QMC (`crates/fs-rand/src/qmc.rs:202` `kernel: 0x0E11`; tests use 3, 7, 8, 9, 11, `0x1357_9bdf`, `0x0370_7344`, `0x9A2D`). Decision (c) must not collide with those. Independently, `brownian_frames` step ids 0–3 would look like stream kernel ids 0–3 if both were called `kernel`. A tape that stored `kernel=3` would be unreadable.

**Consequences for export beads.**

```rust
pub fn brownian_frames(
    n_particles: usize,
    steps: usize,
    step_kernel: u32,
    seed: u64,
    diffusion: f64,
    dt: f64,
) -> /* envelope, not bare Vec<f64> */;

pub fn philox_normals(
    seed: u64,
    stream_kernel: u32,
    tile: u32,
    start_index: u64,
    count: usize,
) -> /* envelope */;
```

TypeScript mirrors those names. The kernel-id table fenced block (decision (c), other lane) labels its numeric column `stream_kernel_id`.

---

### Appendix. Decision (f), Slim-bundle mechanism: ANSWERED BY THE USER, 2026-09-15

**Decision (f) is answered, and the answer is neither option this appendix sketched.** Both sketched
options were workarounds for a build defect. The user is the sole maintainer of `frankensim`,
`asupersync` and the sibling repositories, and directs that the **full `fs-wasm` artifact be kept as
originally intended and the upstream build failure be fixed**.

The defect, established by the section 4 probe: `crates/fs-wasm/Cargo.toml:104` correctly requests
`asupersync` with `default-features = false, features = ["wasm-browser-prod"]`, but 23 sibling crates
pull `asupersync` with bare default features. Those defaults include `native-runtime`
(`asupersync/Cargo.toml:137`), which `asupersync` itself forbids on `wasm32` via `compile_error!` at
`asupersync/src/lib.rs:129`. Cargo unifies features across the dependency graph, so the siblings
defeat `fs-wasm`'s own correct request and the `wasm32` build dies.

The fix follows a convention already established in this repository: every browser-targeted crate
(`fs-cmaes-viz-wasm`, `fs-crump-wasm`, `fs-edison-wasm`, `fs-flyer-wasm`, `fs-goddard-wasm`, and
`fs-wasm` itself) already opts out of asupersync's defaults. The remaining crates reachable from
`fs-wasm` must do the same.

Making the full build work and choosing what payload reaches a reader are separate questions. This
decision settles the first. `am-fs-slim-artifact-0yh` retains its own rationale, which is payload
size rather than feature conflict: the donor's `src/physics/deepWasm.ts` warns against copying the
4.9 MB kitchen-sink package to browsers.

The evidence below is retained as the record of what was measured before the decision.

#### Evidence as gathered (the two options originally sketched)

**This appendix is not a decision.** Bead `am-fs-capability-audit-byc` requirement 5(f): the user decides; the bead stays open until `br comments add am-fs-capability-audit-byc` quotes the user and the date; no agent records that answer on the user's behalf. No option is marked chosen. No decider is named.

The bead's two options, quoted from the bead text:

- add default-off cargo features to `fs-wasm` that gate module groups and make heavy dependencies optional, or
- create a small capability crate (for example a diffusion WASM crate depending only on `fs-rand`, `fs-sparse`, and `fs-math`) following FrankenSim's per-application browser crates.

AGENTS.md:642–668 sketches the exports as feature-gated additions to `crates/fs-wasm/src/lib.rs` with tests in `crates/fs-wasm/tests/`, and also names "a composition and transport boundary such as `fs-annus-wasm`". If evidence favors a capability crate, the bead says to record the departure and raise it with the user **before** the export beads start.

#### Evidence actually observed (not a recommendation)

**Kitchen-sink `fs-wasm` at the pin**

- `crates/fs-wasm/Cargo.toml:11` `[workspace]`; `:15` `crate-type = ["cdylib", "rlib"]`; `:20–93` unconditional path deps including upper-stack and campaign crates (`fs-flux`, `fs-lattice`, `fs-ornith`, ten `*-e2e` crates, …).
- `grep -n '\[features\]'` on that file at the pin: **no match**. Feature-flag strings that do appear are only `wasm-browser-prod` (line 104) and `wasm_js` (line 105), both on target-gated deps, not a `[features]` table.
- wasm32 deps at lines 101–105: `wasm-bindgen`, `asupersync` with `wasm-browser-prod`, `getrandom` with `wasm_js`.
- `git ls-tree -d ${REV} crates/fs-wasm/`: `.cargo` and `src` only. **No `crates/fs-wasm/tests/` directory** at the pin. AGENTS.md:668's `tests in crates/fs-wasm/tests/` is a planned addition, not a present directory.
- `crates/fs-wasm/CONTRACT.md:193–196`: "Feature flags: None. WASM-only dependencies are target-gated under `cfg(target_arch = \"wasm32\")`."

**Peer probe of that graph** (`binding-s4-buildprobe.md`, `logRunId=20260915T204024Z-fa82f3e8`; this lane did not rerun those builds):

- `wasm-pack build --dev --target web -- --locked` on archived `fs-wasm` did not produce a `.wasm`.
- After siblings were archived, compile progressed then failed: asupersync `compile_error!("feature \`native-runtime\` is forbidden on wasm32 browser builds.")` because unconditional `fs-wasm` path deps (`fs-cheb` Cargo.toml:21, `fs-fft`:22, `fs-geom`:23, and others listed in the probe file) pull `asupersync` **with default features**, and asupersync `5adf010` default includes `native-runtime`.
- `fs-truss` (unconditional `fs-wasm` dep at Cargo.toml:63) requires non-optional `fnx-classes` from franken_networkx, so the kitchen-sink graph is not "fs-rand + fs-sparse + fs-math".
- No kitchen-sink `.wasm` size at this pin. Donor museum prebuilt `classic-patents.com/public/wasm/fs-generic/fs_wasm_bg.wasm` is **5134779** bytes (probe `stat`). That is a different revision's artifact, not this pin.

**Per-application browser crates already in FrankenSim at the pin** (`git ls-tree crates/ | grep wasm`): `fs-demo-physics-wasm`, `fs-heatmap-wasm`, `fs-flyer-wasm`, `fs-cmaes-viz-wasm`, and others, plus `fs-wasm`.

- `crates/fs-demo-physics-wasm/Cargo.toml:10` own `[workspace]`; `:20–21` wasm32-only `wasm-bindgen = "0.2"`; **no** `getrandom`, **no** `asupersync`, **no** `fs-rand`/`fs-sparse`/`fs-math`. CONTRACT.md:115–116 uses `cargo check --locked --target wasm32-unknown-unknown` then `wasm-pack build --target web --release`.
- `crates/fs-heatmap-wasm/Cargo.toml` same pattern (lines 10, 20–21).
- `crates/fs-flyer-wasm/Cargo.toml:20–35` is the heavier per-app pattern: domain crates plus wasm32 `asupersync` `wasm-browser-prod` and `getrandom` `wasm_js`.

**Probe capability crate (scratch copy only, not in FrankenSim)**

- Depends only on `fs-rand`, `fs-sparse`, `fs-math`.
- `cargo tree` exit 0: those three crates. Zero asupersync, zero getrandom, zero upper-stack. Generated lockfile: 16 `name =` entries (leaves + wasm-bindgen 0.2.126 stack).
- wasm32 rustc **compiled** the three rlibs, then **failed at rust-lld** (`libLLVM.dylib` rpath on nightly-2026-07-06). Debug rlib sizes were measured (not `.wasm` sizes): `libfs_math` 1014520, `libfs_rand` 2556014, `libfs_sparse` 5093470 bytes. Sum 8664004 is not a `.wasm` and must not be compared to 5134779.

**What this appendix does not do.** It does not pick features-on-`fs-wasm` versus a new capability crate versus `fs-annus-wasm`. It does not treat AGENTS.md's sketch as already overridden. The user records the answer.

---

### Commands this lane actually ran

Every citation above comes from one of these (plus `br show` of the bead and reads of `AGENTS.md`, `docs/FRANKENSIM_BINDING.md` sections 1–3, and the peer probe file). Full transcripts live in this session's terminal logs.

```text
git -C /Users/jemanuel/projects/frankensim cat-file -t 5bbbfae6f7de614422f6f97f5798a3e00f8ad813
git -C /Users/jemanuel/projects/frankensim log -1 --format="%H %ci %s" 5bbbfae6f7de614422f6f97f5798a3e00f8ad813
git -C /Users/jemanuel/projects/frankensim rev-parse HEAD
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-rand/src/lib.rs | grep -n -E 'next_normal|ziggurat|strict mode|admitted'
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-rand/src/lib.rs | grep -n -E 'struct StreamKey|pub kernel|pub tile|pub seed'
git -C /Users/jemanuel/projects/frankensim ls-tree --name-only ${REV} docs/
git -C /Users/jemanuel/projects/frankensim show ${REV}:docs/DETERMINISM_CLASSES.md | grep -n .
git -C /Users/jemanuel/projects/frankensim show ${REV}:docs/G5_CROSS_ISA_REPORT.md | grep -n .
git -C /Users/jemanuel/projects/frankensim show ${REV}:docs/CROSS_ISA_VERIFICATION.md | grep -n -E '^#|^##|G5|lane'
git -C /Users/jemanuel/projects/frankensim show ${REV}:docs/CI_GATES.md | grep -n -E 'wasm-pack|wasm-opt|locked|wasm32'
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-rand/CONTRACT.md | grep -n -E 'Deterministic|ziggurat|next_normal|G5'
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-math/CONTRACT.md | grep -n -E 'Deterministic|G5|det::'
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-sparse/CONTRACT.md | grep -n -E 'Deterministic|G5|FMA|fma|PerIsa'
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-wasm/Cargo.toml | grep -n .
git -C /Users/jemanuel/projects/frankensim grep -n -e 'remap-path-prefix' -e 'wasm-opt' -e 'getrandom_backend' ${REV} -- ':!.beads'
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-wasm/.cargo/config.toml
git -C /Users/jemanuel/projects/frankensim show ${REV}:.cargo/config.toml
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-wasm/Cargo.lock  (wasm-bindgen 0.2.126, getrandom 0.4.3)
git -C /Users/jemanuel/projects/frankensim show ${REV}:scripts/ci/quality_lanes.sh  (lines 1-30, 450-520)
git -C /Users/jemanuel/projects/frankensim ls-tree --name-only ${REV} crates/ | grep -i wasm
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-demo-physics-wasm/Cargo.toml
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-heatmap-wasm/Cargo.toml
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-flyer-wasm/Cargo.toml
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-wasm/CONTRACT.md
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-rand/src/ziggurat.rs  (lines 1-40)
git -C /Users/jemanuel/projects/frankensim show ${REV}:crates/fs-math/src/det.rs | grep -n -E 'pub fn ln|pub fn cos|pub fn sqrt'
git -C /Users/jemanuel/projects/frankensim show ${REV}:golden-couplings.json  (lines 150-151)
git -C /Users/jemanuel/projects/frankensim ls-tree -d ${REV} crates/fs-wasm/
git -C /Users/jemanuel/projects/frankensim grep -n -e 'kernel:' ${REV} -- crates/fs-rand
wasm-pack --version
python3 line-walks of getrandom-0.4.3 README.md, CHANGELOG.md, src/backends.rs
python3 line-walk of /Users/jemanuel/projects/annus-mirabilis.com/AGENTS.md 638-670
RUST_LOG=error br show am-fs-capability-audit-byc --json
RUST_LOG=error br show am-fs-slim-artifact-0yh --json
git -C /Users/jemanuel/projects/frankensim status --porcelain
```

zsh: all `git show` paths used `${REV}:crates/...` (braced), never an unbraced `$REV:crates`.

Rust numeric separators searched as they appear: `9_007_199_254_740_992`, `0x9959_60fe_709f_00bc`, `0xbcf5_52b6_c5bf_aed6`, `0x0E11`.
