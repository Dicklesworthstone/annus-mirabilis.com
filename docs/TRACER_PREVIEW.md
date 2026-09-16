# Brownian tracer laboratory

`/lab/bm-01/` now offers a seeded, synthetic tracer ensemble beside the existing
`/lab/bm-06/` analytic spreading laboratory. The homepage and no-algebra Brownian
encounter link to both. This is an executable host-reference preview, not closure
of the full BM-01 bead or publication of the historical critical edition.

## What a reader can investigate

The laboratory records three independent coordinates per tracer. Readers can
select a signed axis, one/two/three coordinates for total distance, an observation
time, and a statistic: signed mean, total mean square, RMS distance or apparent
coordinate speed. The graph, tables, histogram and sampling bands share the same
accepted snapshot. Returning to a previous observation recovers the same data.

Changing the observation, axis, dimension or statistic reuses the worker's
recording without random draws. View magnification changes only the drawing.
Every particle remains in the statistics, including endpoints outside the view
and histogram range. The trace view shows displacements from a common origin,
not a literal microscope field or molecular collision animation.

Physical inputs and trial seed create a new identified setup. An explicit
same-seed viscosity comparison uses common random numbers; it is labeled as
such, not as independent trials. A separate new-trial action obtains a new u64
seed. Opening another laboratory creates separate state and worker ownership;
both initial worked examples intentionally have the same seed until changed.

Invalid settings and off-grid observations preserve the accepted result and its
original labels. Grid refusals offer executable repairs. At time zero, all
positions coincide and apparent speed is not defined. One tracer is labeled as
insufficient for the ensemble sampling-band comparison. Stopping or unmounting
releases the worker while preserving the accepted display.

Shared links contain validated accepted SI parameters and the exact decimal seed,
not draft or refused settings. Loading a link populates a draft and never starts
a calculation. These are versioned settings links, not the full planned,
artifact-pinned control-tape format.

## Run and verify

```sh
npm install --ignore-scripts --no-audit --no-fund
npm run dev
# Open /lab/bm-01/

npm run test:reference
npm run typecheck
npm run build
npx playwright install --with-deps chromium
npm run test:browser
```

The build generates the seeded static example and evaluator source digest from
the actual local dependency closure. The pre-rendered graph, numbers, model notes
and KaTeX/MathML remain readable without JavaScript. Hydration starts no worker.

At implementation commit `92b71b05238972f03096ac73d74cadd602e7a100`, GitHub Actions
run `35046208163`, job `104636455492`, passed the 139 reference/integration tests,
full strict application typecheck, optimized static Next.js build and 19 Chromium
browser checks (eight existing BM-06 checks and eleven BM-01 checks). Neither
unit tests nor browser checks were skipped. Both automated accessibility scans
reported zero violations in the tested scope. The checks include 320-pixel
reflow, no-JavaScript reading, exact remeasurement, unchanged random draw counts,
refusal/repair recovery, neighboring seeds above 2^53, shared links and separate
instances. Screenshots and structured checks are in `brownian-browser-evidence`.
The 82 committed source/script/package files were also compared byte-for-byte
with the locally tested source; there were no mismatches.

This run used Node 22.16.0 and the package's pinned TypeScript/Next/React versions.
It does not certify the separately ratified Node 22.13.4/Bun toolchain, Firefox,
WebKit, real phones, manual screen-reader use or disabled-reader review.

## Numerical ownership and remaining boundaries

- `philox.ts` implements the pinned fs-rand v1 integer mapping, canonical u64
  seeds and random access. Three published known-answer vectors and 2,048
  independent BigInt checks validate the integer rounds. Box-Muller uses host
  transcendental functions: Gaussian bitwise parity across engines or with
  fs-math is not claimed. The facade refuses counter exhaustion atomically.
- `diffusion/tracers.ts` owns bounded three-axis recordings, all-member moments,
  histograms and replay-grid checks. Stream allocation is the binding document's
  `bm-01.latent.v1`, kernel `0x19050001`, tile `3 * tracer + axis`.
- `diffusion/statistics.ts` owns normal and chi-square quantiles and model sampling
  bands. Eighty-one independent SciPy fixtures check chi-square inversion from
  0.5 to 10,000 degrees of freedom, including extreme tails. This preview uses
  bounded gamma inversion and complementary-erf inversion, not the full planned
  AS-241 implementation and arbitrary-precision fixture pipeline.
- `workers/operations/bm01.ts` assembles every displayed physical value. Sampling
  bands use model variance, not sample estimates, and declare 99.9% coverage per
  comparison, not simultaneous coverage across repeated observations.
- The default records 400 tracers over 10 seconds on a 0.02-second grid. The
  preview retains full paths under an explicit 8 MiB per-recording ceiling;
  oversized requests fail rather than silently shrinking the experiment. The
  full planned 60-second/large-ensemble streaming reduction remains unfinished.

All physics here uses the labeled modern SI 2019 constant set. No WASM artifact,
reviewed historical transcription, observational dataset, localization noise,
motion blur, inertia, walls or sedimentation is implied. Route-persistent
placement ownership, general manifests/control tapes, full source review,
upstream conformance and the broader publication gates remain separate work.
The new modules advance the open reference, random-stream, runtime and BM-01
beads; they do not mark those broader acceptance criteria complete. No production
deployment or domain change is part of this preview.
