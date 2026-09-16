# Scenario coverage

Owning checklist for plan §13.3 and §13.5. Historical *measurements* are datasets, not scenarios.

Transcription status is taken from the scenario file or recorded here when the owner has not landed. "pending" means the pinned facsimile has not been reviewed in this repository; those rows must not pass on remembered numbers. This table is a desk assignment of owners, not a field observation.

Identity rows name two routes and why they are independent.

## §13.3 Historical fixtures, golden scenarios, and identities

| Row | Scenario id | Kind | Owner bead | Constant set | Transcription | Editorial inputs | Routes |
|---|---|---|---|---|---|---|---|
| Avogadro from Planck | radiation-planck-avogadro | historical-fixture | am-ref-radiation-15c | einstein-1905-light-quanta-printed | pending (facsimile not pinned) | R, L (paper 1 §2 appears not to print them) | n/a |
| Stopping potential | photoelectric-stopping-4.3v | historical-fixture | am-ref-photoelectric-q6r | einstein-1905-light-quanta-printed | pending | none declared until the facsimile is read | n/a |
| Mean displacement 1 s / 60 s | diffusion-einstein-1905-printed | historical-fixture | am-ref-diffusion-lr3 | scenario-einstein-1905-brownian-printed (reserved id einstein-1905-brownian-printed waits on am-ref-constants-xik) | pending | R = 8.31 J mol^-1 K^-1 | n/a |
| Mean displacement, modern k_B + printed viscosity | diffusion-einstein-1905-modern-kb | modern-golden | am-ref-diffusion-lr3 | modern-si-2019 with constantSetMixing naming printed viscosity | n/a | printed viscosity | n/a |
| Molecular dimensions 1905 thesis | suspension-einstein-1905-thesis | historical-fixture | am-ref-viscosity-suspension-c9lp | einstein-1905-thesis-printed | pending / may be deferred with the companion | per that bead | n/a |
| Molecular dimensions 1906 supplement | suspension-einstein-1906-supplement | historical-fixture | am-ref-viscosity-suspension-c9lp | einstein-1906-dissertation-printed | pending / may be deferred | per that bead | n/a |
| Molecular dimensions 1911 correction | suspension-einstein-1911-correction | historical-fixture | am-ref-viscosity-suspension-c9lp | einstein-1911-correction-printed | pending / may be deferred | per that bead | n/a |
| Photoelectric neutral | photoelectric-neutral-2eV | modern-golden | am-ref-photoelectric-q6r | modern-si-2019 | n/a | none | n/a |
| Brownian baseline | scenario-golden-brownian | modern-golden | am-ref-diffusion-lr3 | modern-si-2019 | n/a | none | n/a |
| Boost, composition, dilation | kinematics-boost-0.6c | modern-golden | am-ref-kinematics-tjq | modern-si-2019 | n/a | none | n/a |
| Doppler and mirror | waves-doppler-mirror | modern-golden | am-ref-waves-r53 | modern-si-2019 | n/a | none | n/a |
| Transverse coefficients | electron-transverse-mass | modern-golden | am-ref-electron-kfy | modern-si-2019 | n/a | none | n/a |
| Energy ratio versus Doppler ratio | waves-energy-doppler-identity | identity | am-ref-waves-r53 | modern-si-2019 | n/a | none | route 1 energyFactor from the transformed light-energy expression; route 2 dopplerFactor raised to its power from the phase; each from frame parameters without calling the other |
| Mass-energy | mass-energy-0.6c | modern-golden | am-ref-mass-energy-ht0 | modern-si-2019 | n/a | none | n/a |
| Apparent speed doubles when the interval is quartered | diffusion-identity-apparent-speed | identity | am-ref-diffusion-lr3 | modern-si-2019 | n/a | none | route 1 ratio of two evaluated apparent speeds; route 2 closed-form tau^{-1/2} exponent, not a second call to apparentSpeed |

## §13.5 Adversarial fixtures

Each row must fail for the intended reason, not merely fail.

| Row | Scenario id | Owner bead | Intended failure | Status |
|---|---|---|---|---|
| Half diffusivity | diffusion-adversarial-half-diffusivity | am-ref-diffusion-lr3 | RMS scales as sqrt(D), factor 1/sqrt(2), not 1/2 | self-test owner in this bead |
| Radial law | diffusion-adversarial-radial-gaussian | am-ref-diffusion-lr3 | A 2d radius is not a signed Gaussian | not-available; owner not yet writing this file |
| 1 um radius is not 0.8 um | diffusion-adversarial-1um-radius | am-ref-diffusion-lr3 | 0.562 um lies outside [0.75, 0.85) um | runnable against diffusion.stokesEinsteinRms |
| Camera noise neighbour covariance | inference-adversarial-camera-noise | am-ref-inference-2w9 | Neighbouring increments stay independent | not-available |
| Inversion bias | inference-adversarial-inversion-bias | am-ref-inference-2w9 | Unbiased after inversion, factor q/(q-2) | not-available |
| C(nu) non-cancellation | radiation-adversarial-entropy-constant | am-ref-radiation-15c | An arbitrary entropy-density constant cancels | not-available |
| Spectral relabeling without Jacobian | radiation-adversarial-jacobian | am-ref-radiation-15c | Density is preserved only with the Jacobian | not-available |
| Locked positions | radiation-adversarial-locked-positions | am-ref-radiation-15c | Probability is f^n, not f | not-available |
| Light complex, longitudinal rays | waves-adversarial-light-complex-longitudinal | am-ref-waves-r53 | Contracts like material volume | not-available; owner not landed |
| Light complex, ray transverse in the moving frame | waves-adversarial-light-complex-moving-transverse | am-ref-waves-r53 | A ray transverse in the unprimed frame gives the material factor and cannot discriminate; the moving-frame transverse ray is the discriminating fixture | not-available; owner not landed. This row is listed so it cannot be replaced by the unprimed-frame test. |
| Moving mirror | waves-adversarial-moving-mirror | am-ref-waves-r53 | The moving mirror receives the fixed-surface incident power | not-available |
| Force components | electron-adversarial-force-components | am-ref-electron-kfy | Equal numerical components in different frames is the wrong test | not-available |
| Observer change | runtime-adversarial-observer-change | am-rt-command-classes-dzp | An observer change does not start a new experiment | not-available |
| Low-speed proxy | mass-energy-adversarial-low-speed-proxy | am-ref-mass-energy-ht0 | The low-speed proxy is the exact mass coefficient at every speed | not-available |
| Large seed as a JSON number | u64-adversarial-json-number-seed | am-rt-u64-identities-7ce | A seed above 2^53-1 must remain a decimal string | not-available |
| Neutral conductor accepted | fields-adversarial-neutral-conductor | am-ref-fields-6l9 | rho = 0 with J != 0 is accepted | not-available |

## Discrimination (requirement 11)

| id | Status |
|---|---|
| sr-02-emf-first-order-agreement | runnable self-test owners (closed-form EMF). Instrument lane am-sr-02-magnet-conductor-x1gc still owns the reader sentence. |
| sr-02-emf-discriminates-at-0.6c | runnable self-test owners |
| shelf-fizeau-fresnel-versus-relativistic | runnable self-test owners. A 1904-mode acceptance case must not cite the later-development hypothesis. |

## Notes

- `einstein-1905-brownian-printed` is reserved by `src/physics/reference/constants.ts` for am-ref-constants-xik. This registry uses a declared scenario set with the same R and N rather than impersonating the reserved id.
- No row in this table is a real-device or facsimile observation. Pending transcription is the honest state until a receipt names a pinned scan.
