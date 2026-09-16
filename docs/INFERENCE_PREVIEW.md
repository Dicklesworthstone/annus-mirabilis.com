# Brownian molecular-number inference

`/lab/bm-07/` closes the working preview's loop from predicted displacements to
inference from a finite sample. It begins with a compatible radius–number family,
not a falsely identified molecular number. The reader's inference passage links
to the instrument and a returnable uncertainty-and-inference foundation.

This is a **synthetic inverse exercise with draft explanations**. It is not a
historical observation, a Perrin dataset, a reviewed edition or an independent
measurement of the modern Avogadro constant. No production deployment or broader
bead closure is implied.

## Observe, declare, estimate

The initial worked example has 50 non-overlapping displacements in two
coordinates, one second apart. Its generated positions, diffusivity estimate,
conditional diffusion interval and 41 compatible radius–number pairs are readable
without JavaScript. An independent radius is initially undeclared, so the
molecular-number outputs explicitly remain underdetermined.

Three estimators are available:

- **Known zero drift:** the squared increments give an unbiased diffusion
  estimate with `q = d M` degrees of freedom.
- **Fit drift, unbiased spread:** subtract the fitted mean increment in each
  coordinate and use `q = d (M - 1)` and the corresponding normalization.
- **Fit drift, maximum likelihood:** normalize by `d M`; report the resulting
  bias and rescale to the unbiased estimate before constructing the interval.

The two drift-fitted estimators therefore have different point estimates but the
same correctly rescaled confidence bounds. With only one displacement, fitting
drift leaves spread underdetermined. No numerical zero replaces missing
information.

Declaring a radius permits molecular-number recovery conditional on the other
inputs. Changing the assumed radius, temperature or viscosity does not move a
single observed position. The original path, accepted run identity and generator
remain unchanged. Generator controls are separate and explicitly start a new
physical run. The core owner refuses a radius obtained circularly from the same
displacements using an assumed molecular number.

## Uncertainty is part of the result

The conditional diffusion interval uses the shared chi-square quantile owner.
Inverting it reverses its endpoints. The displayed inverse-estimator bias and
variance factors use the actual estimator normalization; missing inverse moments
at low degrees of freedom are explained rather than shown as finite numbers.

A conditional molecular-number interval holds all physical inputs exact. The
combined option adds symmetric, declared temperature, viscosity and radius
intervals. It assigns the remaining error probability to the diffusion interval
and combines the four procedures with a conservative Bonferroni/union bound.
This does not require independence between their marginal input intervals. It
does require valid stated coverage for each procedure. Undeclared coverage or an
exhausted error budget produces an explicit unavailable combined interval, not a
fabricated guarantee. A valid point estimate and the conditional comparison
remain separately visible.

Both procedures still assume exact timing, spatial calibration and the chosen
instructional gas constant. The independent-increment interval does not admit
localization noise, finite exposure, irregular timing, overlapping displacement
windows or censoring. No camera-error fit or empirical data importer is supplied.
The analytical distributional claims are exact under their model; numerical
quantiles use the existing bounded binary64 calculation, not interval arithmetic.

## Repetition without replacing the evidence

The explicit repeated-trial action generates 100 other hypothetical paths with
the same generating parameter and retains every interval, including misses.
Coverage plots and equivalent tables normalize by the fixed generating value.
A finite observed fraction need not equal the target coverage. Changing a radius
assumption with the same hypothetical trial identities can spoil molecular-
number coverage without changing the diffusion intervals or primary observations.

This view tests conditional intervals only. It refuses to invent repeated input-
measurement procedures for a combined interval. A normal form submission clears
the repeated-trial request; running coverage is an explicit additional action.
The comparison buttons operate on accepted settings, not unfinished draft edits.

## Reproducibility and accepted state

The primary recording has 4096 quarter-second steps in two coordinates: 1024
seconds, 16,385 logical random draws including its parameter draw, and 65,552
retained position bytes. Up to 1000 displacements may be selected within that
recording. Off-grid or overlong requests are refused without silently changing
sample size or replacing the accepted result. The offered off-grid repair is
itself executable.

The seed is an exact unsigned 64-bit decimal string. The hidden number is drawn
on `bm-07.generator-parameter.v1` (`0x19050007`). Latent increments use
`bm-07.synthetic-latent.v1` (`0x19050003`), with a logical replicate/substep mapping independent
of scheduling. The hidden number is log-uniform from 3 × 10²³ to 1.2 × 10²⁴ mol⁻¹.
The generator uses the explicitly chosen `R = 8.314471 J/(mol K)`, not an ambient
modern Boltzmann constant. Host Gaussian arithmetic is not a promise of strict
cross-engine WASM replay.

Changing observation spacing, coordinate count, sample count or estimator
selects the same primary recording. Hypothetical coverage work has separate draw
accounting; it never replaces that primary recording. Hidden-value reveal is a
presentation action and draws nothing. The answer is a learning device, not a
secret hidden from browser inspection.

A dedicated lazy worker publishes complete typed batches through the existing
immutable accepted-state store. It checks source digest, request/run/revision
identity, owner, units, semantic meaning, array layouts, sample count, estimator
degrees of freedom and observation times. Superseded or malformed responses do
not become accepted science. Each separately opened laboratory owns its settings,
worker and results. Hydration and shared-settings links create no worker.

CSV export includes every selected position and increment in canonical SI, the
accepted observation/generator metadata and source digest. It omits the hidden
answer and inference assumptions. Sharing uses accepted settings, excludes
private draft edits and resets the hypothetical trial request to zero. Loading a
link does not relabel the static example before an explicit apply.

The core distinguishes synthetic recovery, independent observational estimation
with suitable noncircular constant provenance, and modern-SI consistency checks.
Only the synthetic mode is exposed by this instrument. An independent empirical
mode needs actual admitted observations and their independent physical inputs.

## Run and verify

```sh
npm install --ignore-scripts --no-audit --no-fund
npm run dev
# Open /lab/bm-07/ or the inference passage in /papers/brownian-motion/

npm run test:reference
npm run typecheck
npm run build
npx playwright install --with-deps chromium
npm run test:browser
```

The prepared example is generated from the same owners by
`scripts/generate-inference.mjs`; its source identity hashes the local evaluator
import closure. Unit fixtures independently evaluate chi-square limits and
inverted bounds with SciPy/mpmath. A fixed-seed 400-trial reference check uses a
prespecified coverage tolerance and detects a deliberately wrong degrees-of-
freedom procedure. Real-worker and production-browser tests exercise data reuse,
coverage, refusals, identities, export, sharing, independent placements and reader
returns. A workflow result applies to its exact commit only.

The preview workflow uses Node 22.16.0 and Chromium. Firefox, WebKit, real devices,
manual screen-reader and disabled-reader review remain outstanding. So do audited
FrankenSim/WASM inference ownership, historical evidence, the full observation-
error model and publication acceptance gates.
