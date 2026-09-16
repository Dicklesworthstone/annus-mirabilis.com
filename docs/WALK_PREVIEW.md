# Random-step diffusion laboratory

`/lab/bm-05/` now connects the tracer ensemble (`/lab/bm-01/`) to the spreading
laboratory (`/lab/bm-06/`). The homepage and no-algebra Brownian encounter link
all three. This is a working host-reference preview, not closure of the complete
BM-05 bead, first-reference-slice acceptance gate, or historical critical edition.

## What the reader can investigate

Coin, uniform and Gaussian steps share a declared RMS size and step interval.
The default trial uses 2,000 walkers, 400 recorded steps, a 0.5 micrometre step
RMS, a 0.1 second interval, and seed 1905; the first display observes four steps.
The resulting coefficient is 1.25 square micrometres per second. The coin's four
steps have exact path counts 1, 4, 6, 4, 1 out of 16, shown alongside the sample.

The graph compares sampled bin proportions, finite-step bin probabilities and
Gaussian probabilities over the same boundaries. All walkers remain in moments
and histogram accounting, including those outside the plotted bins. The
cumulative-probability comparison separates the finite-step shape gap from the
DKW sampling allowance. Coin and uniform sums approach a Gaussian; Gaussian
steps already have Gaussian sums. Agreement is not decided by visual similarity,
and a sample outside the allowance is retained rather than redrawn. The stated
99.9% sampling coverage applies to one prespecified comparison, not simultaneous
coverage over every observation or trial.

Observation buttons return to the same trial. A cached observation uses its
checkpoint; another observation replays the identical counter-indexed stream
segment. Executed replay draws are explicitly reported separately from the
realization's fixed logical draw count. Re-observation never creates a new trial.
Physical step settings and the seed create a new identified run. The separately
labeled analytical bias example reuses the recording and never draws a biased
trajectory. Cauchy and continuum-limit examples are also analytical only.

The optional second laboratory has separate state and worker ownership. Links
contain accepted SI settings and the exact decimal u64 seed, not draft or refused
inputs; opening one only loads a draft. No worker starts during hydration. The
initial example, traces, exact fractions, tables and KaTeX/MathML derivation remain
readable without JavaScript. Refused requests and budget outcomes preserve the
accepted result and its labels, with an explicit restore action.

## Run it

```sh
npm install --ignore-scripts --no-audit --no-fund
npm run dev
# Open /lab/bm-05/

npm run test:reference
npm run typecheck
npm run build
npx playwright install --with-deps chromium
npm run test:browser
```

`prepare:lab` generates all three worked examples and hashes each evaluator's
actual dependency closure. The static export is written to `out/`. This workflow
builds and tests a preview; it does not deploy or promote a production release.

## Numerical ownership and bounds

- `diffusion/walkLaws.ts` owns moments, diffusivity, binomial distributions,
  uniform-sum CDF/PDF, shape distances, DKW bounds and the analytical deviations.
  Small coin coefficients use BigInt; larger distributions use a normalized
  center-out recurrence. The uniform sum uses a positive cardinal-spline
  recurrence and bracketed density crossings, not an alternating sum of huge
  powers. Its computed shape distance is numerical, not a rigorous enclosure or
  the complete planned exact-rational/arbitrary-precision pipeline.
- `diffusion/walks.ts` owns bounded recording and deterministic replay. It retains
  at most twenty full traces and eight all-walker checkpoints, never a full
  walker-by-step path matrix. The default recording initially retains 144,160
  bytes instead of the 6,416,000 bytes a full matrix would require. The ceiling
  is five million walker-steps and eight MiB of private recording allocation.
  This reduction has not yet been migrated into the older BM-01 owner.
- `workers/operations/bm05.ts` assembles every displayed scientific value; views
  only format or plot an accepted snapshot. The strict worker decoder checks
  identities, revisions, provenance, owners, units, statuses and array lengths.
  The finite-step uniform comparison admits at most 400 observed steps; larger
  requests produce a software budget outcome rather than fabricated results.
- Random streams use the binding document's `bm-05.walk.v1` allocation, kernel
  `0x19050001`, tile equal to walker index. Sampled step kernels are coin 0,
  uniform 1 and exact-diffusivity Gaussian 3. The host Gaussian transformation
  is not claimed bitwise-equivalent to FrankenSim's deterministic math or across
  browser engines. No WASM capability is represented as admitted here.

## Evidence and remaining limits

At implementation commit `aa5c0e754d1cf4e40b87329593817aa2cfa814eb`, Actions run
`35050015669`, job `104648141628`, passed all 166 reference/integration tests,
full application typechecking, the optimized static Next.js build, and all 31
Chromium browser checks. The twelve new BM-05 browser checks cover no-JavaScript
reading, three kernels, exact re-observation, replay accounting, analytical
limits, budget recovery, full-width seeds, accepted-settings links, independent
workers and 320-pixel reflow. All three automated accessibility scans reported
zero violations in the tested scope. The 109 source/script/config files were
compared byte-for-byte with the local tested source, with zero mismatches.
Later commits must use their own verification run rather than inherit this one.

Independent fixtures use SciPy 1.17.0 CDF/PDF values; regeneration is documented
in `scripts/reference/generate-walk-fixtures.py`. Fixed-seed statistical tests
use prespecified thresholds, not rerun-until-pass sampling. Verification ran
under Node 22.16.0, not the separately ratified Node 22.13.4/Bun combination.
Firefox, WebKit, real-device and manual screen-reader reviews remain unperformed.

These mathematical walks are not measured tracer paths or literal molecular
collisions. Coarse-graining, symmetry, finite variance and independence are model
premises. The reviewed German/English reader, general content compiler and
manifests, complete control tapes, route-persistent placement ownership, rigorous
uniform-distance certification and audited upstream conformance remain separate
work. No production deployment, source-review signoff or bead closure is implied.
