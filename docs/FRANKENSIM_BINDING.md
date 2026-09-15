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
