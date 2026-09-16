# Brownian camera-observation laboratory

`/lab/bm-08/` now connects retained physical motion to camera observations and
noise-aware inference. The homepage and BM-07 ideal-inference page link into it.
It is a modern synthetic, host-calculated teaching instrument, not Einstein's
1905 derivation, an empirical measurement or audited FrankenSim/WASM execution.

## One path, different cameras

Two latent Brownian coordinates and exact subinterval exposure averages are
recorded on 4,112 quarter-second intervals. Changing frame spacing, exposure,
localization noise, stage drift, observed coordinates or stationary-click settings
re-observes that recording. Physical diffusivity, fluid drift and physical seed
changes start a new run. Stage drift and fluid drift are deliberately separate.

Uniform forward exposures cover [t_i, t_i + T_e]. Each subinterval average uses
its Brownian bridge integral; it is not an interpolation between endpoints.
Localization errors are indexed by physical timestamp and independent of latent
motion. Stationary-feature clicks have another stream. Returning to a previous
camera setting reproduces its observations. Both latent axes always exist.

The default is 100 displacements in two coordinates, spacing 1 s, exposure 0.5 s,
localization standard deviation 0.2 micrometres, and 30 stationary clicks. The
latent recording retains 131,600 bytes and 32,896 logical endpoint/bridge draws.
These are preview defaults, not the final bead's specified editorial defaults.

Frame spacing is 1, 2, 3 or 4 s. Exposure is a multiple of 0.25 s no longer than
spacing. The explicit admitted sample range is 3–1000 displacements, within the
recorded horizon. Off-grid exposure has an executable repair. Refused requests
never silently shorten the recording or replace accepted results.

## Inference and its assumptions

Four point estimates are compared: naive uncentered increments, drift-centered
increments, covariance estimation, and noise/exposure-corrected disjoint pairs.
The covariance estimate subtracts the explicitly known synthetic drift. It does
not secretly fit the drift or claim a general covariance-estimator interval.
Signed negative finite-sample point estimates remain visible as diagnostics.

The ideal zero-drift chi-square interval is not admitted with camera noise,
exposure or unmodeled drift. The centered ideal interval permits constant drift
but still excludes camera noise and exposure. A point estimate remaining visible
does not make its associated ideal interval valid.

Disjoint frame pairs share neither frames nor localization errors. With uniform
exposure no longer than spacing their Brownian supports are also disjoint. The
procedure fits one drift per coordinate, using q = d(K-1) residual degrees of
freedom. The exact-noise mode treats the declared synthetic localization variance
as known. Estimated-noise mode uses independent stationary clicks and a Bonferroni
split, yielding a conservative interval under its stated Gaussian model.

The stationary feature and moving particle are assumed to have the same
localization variance. The stationary clicks cannot establish that assumption.
Calibration, timing, exposure profile, diffusivity and drift are assumed exact
or constant as declared. No irregular, censored or correlated-error importer is
admitted. An empty nonnegative confidence set is retained as an explicit empty
set and a coverage miss, not retried or replaced with a positive interval.

## Compare procedures without replacing the observations

An explicit action runs 100 other hypothetical experiments with separate stream
identities. Every interval, miss and empty-set flag is retained in the graph and
full numerical table. The primary path and its camera data do not change. The
naive coverage comparison is explicitly labeled intentionally invalid when its
assumptions fail; realized coverage is not promised to equal nominal coverage.

The apparent-speed comparison is a separate analytical zero-exposure model at
six hypothetical spacings, including spacings below the retained replay grid.
It does not fabricate extra observed frames. These are spread/interval ratios,
not instantaneous particle velocities. At zero localization noise the curves
coincide and the noise crossover is not applicable.

## Browser and scientific data contracts

The page, frame graph, estimates, intervals and tables consume one immutable
accepted snapshot. Unapplied drafts and refused requests cannot relabel accepted
science. Estimator-only changes reuse cached camera observations with zero new
measurement-stream evaluations. Noise/exposure changes may reevaluate the same
measurement stream while consuming no new latent draws; counters distinguish it.

The browser worker is lazy and instance-scoped. A second placement has separate
settings, snapshots and worker ownership. The protocol verifies source digest,
request identity, revisions, owners, units, buffer shapes, frame times, pair
counts and interval admission before publication. This is the scoped host
protocol, not general cross-engine conformance or route-lifetime persistence.

The initial worked example is generated through the same owners at build time.
Its formulas, MathML, observations and tables remain readable without JavaScript.
Accepted-settings links preserve exact u64 strings, exclude hypothetical trials
and load only as a draft. CSV exports contain every accepted SI coordinate with
physical/noise/click seeds, camera parameters and source identity. Exports are
explicitly synthetic; nothing is uploaded to a service.

## Run and verification

```sh
bun install --frozen-lockfile --ignore-scripts
bun run dev
# Open /lab/bm-08/
bun run test:reference
bun run typecheck
bun run build
bunx playwright install --with-deps chromium
bun run test:browser
```

The reference tests include independent camera-moment fixtures, exact
re-observation, chunk/prefix invariance, signed covariance predictions and a
prespecified 160-experiment coverage check. Real-worker tests cover admission,
reuse, malformed responses, refusal/repair and bounded repeated experiments.
The browser tests run against the actual production export, including real
workers, CSV, sharing, no-JavaScript reading, independent instances, print and
320-pixel reflow. Individual workflow results apply only to their exact commit.
The preview workflow currently verifies Bun 1.4.0 and Node 22.16.0, rather than
claiming the separately specified Node 22.13.4 was executed.

The complete caption-reading inventory, overlapping-window instrument controls,
hand-clicked video/kitchen mode, general likelihoods, reviewed source alignment,
FrankenSim conformance and publication gates remain open. Manual screen-reader,
disabled-reader, Firefox/WebKit and real-device reviews are not claimed. No
production deployment or broad BM-08 bead closure is implied.

## Model references

Berglund, A. J. (2010), *Statistics of camera-based single-particle tracking*,
Physical Review E 82, 011917. DOI: 10.1103/PhysRevE.82.011917.
Vestergaard, C. L., Blainey, P. C., and Flyvbjerg, H. (2014), *Optimal estimation
of diffusion coefficients from single-particle trajectories*, Physical Review E
89, 022726. DOI: 10.1103/PhysRevE.89.022726.
