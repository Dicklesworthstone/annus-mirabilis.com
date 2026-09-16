# Physics and Mathematics Reviewer Brief

This brief governs the scientific, derivation, and numerical review of equations, instruments, constants, and reference physical models in Annus Mirabilis.

## Evidence Format

Every physics review record must specify:
- `reviewer`: stable reviewer ID from `docs/OWNERS.md`
- `role`: `physics-math-reviewer`
- `scope`: paper slug or capability ID (e.g. `brownian-motion:derivations`, `special-relativity:kinematics`)
- `revisions`: git commits of equations, reference implementations, and content records reviewed
- `date`: ISO 8601 completion date
- `result`: `accepted`, `accepted-with-changes`, `rejected`, `needs-rereview`
- `notes`: mathematical proof notes, parameter bounds, invariant verification notes
- `file`: output path under `content/reviews/<slug>/physics.yaml`

## Derivation-Level Review & Epistemic Rules

Physics review is conducted at the derivation level. Reviewers must verify that every mathematical derivation in the edition is sound, explicit, and free of circularity:
1. **No hidden atomic counts:** Molecular counts must not be inferred from diffusion while silently using that same count or a modern exact $k_B$ in synthetic data generators.
2. **No circular mass-energy equivalence:** The derivation of $\Delta m = E/c^2$ must not initialize with an assumed rest-energy formula $E_0 = Mc^2$.
3. **No axiomatic spacetime interval:** The historical Lorentz transformation derivation must not require the Minkowski interval as an unexplained pre-1905 axiom.
4. **No pre-programmed threshold tautologies:** Photoelectric simulations with programmed work functions illustrate consequences of the light quantum hypothesis, but must not be presented as experimental proof of quantization.

## Historical vs Modern Constant Sets

Calculations must explicitly declare their active constant set:
- **Historical sets** (e.g., `einstein-1905-brownian-printed`, `einstein-1905-light-quanta-printed`) use period values with stated precision and editorial provenance.
- **Modern sets** (e.g., `modern-si-2019`) use exact 2019 SI definitions where $N_A = 6.02214076\times10^{23}\,\mathrm{mol^{-1}}$ and $k_B = 1.380649\times10^{-23}\,\mathrm{J/K}$.
- Modern SI constants must never be passed off as 1904 experimental data.

## Constant and Quantity Bindings

- The gas constant symbol $R$ binds the canonical quantity `molarGasConstant` (the spelling `gasConstant` is rejected).
- Einstein's printed molecular count symbol $N$ binds `avogadroConstant`.
- Historical inference outputs with uncertainty bind `avogadroNumberEstimate`.

## Fixtures, Corrections, and Numerical Invariants

Reviewers must verify that all reference implementations, scenario fixtures, and explanation values match the audited standards:

1. **Mass-Energy Coal Card (ME-03):** 1 kg of coal releases approximately 24–35 MJ of chemical energy. By $\Delta m = E/c^2$, the mass loss is $0.27–0.39$ μg (approximately 0.3 μg).
2. **Light-Complex Fixture (SR-10):** Evaluated with longitudinal rays and with rays transverse in the moving frame to avoid false positives on material contraction.
3. **Brownian Numerical Distribution:** `brownian_frames` explicitly documents its step distribution and variance. Fallible simulation steps return typed refusals.
4. **FTCS Diffusion Refusal:** The numerical 1D diffusion solver enforces the Courant-Friedrichs-Lewy stability condition $r = D\,\Delta t / \Delta x^2 \le 0.5$. If $r > 0.5$, the solver returns refusal code `ftcs-unstable`. A parameter grid point at $r = 0.5$ is accepted.
5. **PRNG Streaming:** `philox_normals` takes explicit stream parameters `(seed, kernel, tile, start_index, count)`.
6. **Velocity Observable:** The clarification that Brownian displacement per unit time is not an instantaneous mean velocity is properly attributed to Einstein's 1906 continuation paper.
7. **Paper 1 §2 Constant Verification:** Planck's $\alpha = 6.10\times10^{-57}$ and $\beta = 4.866\times10^{-11}$ yield $N = \frac{\beta}{\alpha}\frac{8\pi R}{L^3} = 6.17\times10^{23}$ with declared editorial inputs $R = 8.31\times10^{7}$ and $L = 3\times10^{10}$. Sensitivity analysis shows $R = 8.314\times10^{7}$ with $L = 2.998\times10^{10}$ yields $6.1858\times10^{23}$.
8. **Paper 1 §8 Stopping Potential Check:** Evaluated as $\Pi E = R\beta\nu - P'$ with $P' = 0$ and $E = 9.6\cdot10^{3}$ emu, giving $\Pi = 4.3385\times10^{8}$ abvolt ($4.3385$ V). A modern restatement through an elementary charge of $4.7\times10^{-10}$ esu with $N = 6.17\times10^{23}$ gives $4.3057$ V.
9. **Brownian Displacement Fixture (Paper 2 §5):** For particle diameter 0.001 mm in water at 17 °C ($T = 290.15$ K, viscosity $k = 1.35\times10^{-2}$ CGS), $N = 6\times10^{23}$, and editorial $R = 8.31\times10^{7}$, the 1 s displacement is $0.7947833$ μm (printed "0,8 Mikron"), and the 60 s displacement under `einstein-1905-brownian-printed` is $6.156365$ μm (printed "ca. 6 Mikron"). A 60 s displacement value is always stated with its explicit constant set or as printed "about 6".
10. **Numerics & Electrodynamics:** Cancellation-free formulation is used for relativistic factors: $1 - \sqrt{1-\beta^2} = \beta^2/(1+\sqrt{1-\beta^2})$. Lorentz force transformations in comoving frame evaluate acceleration with $\gamma\,\mathbf{v}\times\mathbf{B}$ terms.
11. **Refusal Algebra:** Refusals return typed codes (`ftcs-unstable`, `outside-domain`, `not-applicable`, `budget-exhausted`). Invariant comparisons include exact square roots like $\sqrt{2.5}$.

## Sign-off

The reviewer completes the physics review checklist, verifies all numerical fixture tests pass, and signs the record in `content/reviews/<slug>/physics.yaml`.
