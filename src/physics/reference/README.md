# Brownian reference implementation

This is an executable **host-reference subset**, not the completed reader or an
admitted FrankenSim/WASM implementation. It implements the calculation and
accepted-state foundations for the first Brownian §§4–5 slice.

## Run it

No application install is needed for the standalone example. From the repository
root, using Node 22.16.0 (the environment used for this implementation):

```sh
node --experimental-strip-types scripts/reference/brownian-demo.mjs
node --experimental-strip-types scripts/reference/brownian-demo.mjs '{"t":0}'
node --experimental-strip-types scripts/reference/brownian-demo.mjs '{"steps":1}'
node --experimental-strip-types scripts/reference/brownian-demo.mjs '{"eta":0.002}'
```

The default example evaluates a 0.5 μm-radius tracer at 293.15 K in a declared
0.001 Pa s Newtonian liquid. It returns `D ≈ 4.29439564555e-13 m2/s` and
one-second one-coordinate RMS displacement `≈ 9.26757319426e-7 m`, then compares
the finite-box grid's cell masses with unbounded analytic cell probabilities.
It names wall contact rather than treating the two boundary models as identical.

The zero-time example returns a point distribution. The one-step example returns
an explicit-scheme stability refusal with ranked, executable repairs; it does not
quietly change the requested step or publish a blown-up field. Its analytical
results remain separately available. Parameters use SI: `T` K, `eta` Pa s, `a`
m, `t` s, `dx` m; `n` is the cell count and `steps` the number of model steps.
Inputs not listed here are rejected. The example is a developer JSON interface;
its internal status IDs are not reader-facing copy.

## Implemented owners and contracts

`diffusion.ts` is the reference entry point. Its distribution module supplies
Stokes–Einstein diffusivity, ideal osmotic pressure, Gaussian and radial densities,
closed-interval probabilities, marginal/vector moments, RMS displacement and the
observation-interval-dependent apparent-speed comparison. Physical functions take
an explicit constant set. Negative or nonfinite inputs, singular distributions,
and unrepresentable calculations are not replaced by zero or infinity.

`diffusion/ftcs.ts` supplies a bounded, conservative zero-flux FTCS solver,
nonmutating continuation, and the analytic cell-mass comparison. Frame zero is the
initial condition. Continuation preserves operation order across chunk sizes.
The stability test is strictly `r <= 0.5`, without an epsilon. Ranked repairs move
by a binary64 ULP when rounding the mathematical bound would leave an unstable
request. The host work/allocation ceiling is explicit and cannot be raised by a
caller. This ceiling and bitwise behavior are **not yet certified against the
upstream artifact**.

`../../experiments/results/` separates seven scientific output statuses from
request refusals and twelve software outcomes, validates their payloads and
uncertainty labels, and exports registry-derived IDs. `decodeResultBatch` enforces
one accepted revision tuple, manifest-admitted statuses, completeness and partial
result policy. Large production worker-buffer framing is still separate work.

`../../experiments/store/instanceStore.ts` keeps requested and accepted states
separate per placement. It rejects stale, unissued, superseded and mixed-revision
responses; checks output units, semantic kinds and owners; preserves accepted
snapshots on refusal or failure; and exposes private numeric buffers through
read-only accessors and explicit copies. Observer, measurement and estimator
changes retain the physical run. Subscribing does not start one. Callers must
retain the store across view mounts; the route placement registry and React hook
are not implemented here.

`constants.ts` provides exact SI 2019 defining constants and explicit declared
scenario sets. The scenario tests using the plan's 1905 arithmetic inputs do not
claim that those inputs have been verified against a facsimile. Printed historic
sets and reserved companion sets fail closed until their source work is done.
Computed illustrative outputs cannot be read back as experimental inputs.

## Verification

The standalone reference suite was run with Node 22.16.0. The source modules were
checked with TypeScript 5.8.3 using strict indexed-access and optional-property
checks. Bun, Next.js, browser lanes and real workers were **not run** in this
execution environment.

```sh
node --experimental-strip-types --test src/testing/*.test.mjs

tsc --noEmit --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes \
  --target es2022 --module esnext --moduleResolution bundler \
  --allowImportingTsExtensions \
  $(find src/experiments/results src/experiments/store src/physics/reference -name '*.ts')
```

Tests exercise result round trips and rejection cases, constant provenance,
independent distribution normalization, zero-time limits, extreme Gaussian tails,
FTCS conservation, positivity, refinement, chunk invariance and stability repairs,
and real FTCS refusal/recovery through the instance store. The erf/erfc golden
table is independently generated at 80 decimal digits by mpmath 1.3.0; its rows
have a checked digest. Regenerate it with:

```sh
python3 scripts/reference/generate-erf-fixtures.py
```

mpmath is needed only for regeneration, not by the application or existing tests.

## Deliberately not marked complete

This advances `am-ref-diffusion-lr3`, `am-ref-constants-xik`,
`am-rt-typed-results-mqb`, and the core of `am-rt-snapshot-store-aft`; it does not
close their broader acceptance criteria. Outstanding work includes audited
historical constants and the canonical quantity registry; the other Route A/B
laws, quantiles, sampling bands and Philox walk generator; manifests, authored
reader explanations and React bindings; the placement registry, dedicated-worker
scheduler/protocol, provenance hashes and upstream conformance; and browser,
accessibility, shared evidence logging and release gates. No deployment change is
included.
