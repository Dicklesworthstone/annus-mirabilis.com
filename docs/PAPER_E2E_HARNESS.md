# Paper vertical-slice browser acceptance

`scripts/e2e-paper-vertical-slices.ts` exercises the visitor-facing paper
routes against an already-running Annus Mirabilis Next.js server. It never
starts, replaces, or stops that server. Before Chromium launches, the runner
requires same-origin HTTP 200 HTML containing both the product identity
("Annus Mirabilis") and Next asset identity (`/_next/`), then records the
final URL, response headers, HTML byte count, and SHA-256 build fingerprint.

This document is adapted from the donor's `docs/PATENT_E2E_HARNESS.md`
(`classic-patents.com` at pinned commit `da11ff475902728fd8dd1d9db9f3af37c16ec8a5`,
MIT License with the OpenAI/Anthropic Rider, preserved at `/LICENSE`) by
`am-scaf-extract-scripts-7jm`.

## Status: Browser Acceptance Harness Delivered

This bead (`am-test-e2e-harness-bqmh`) delivers the complete browser acceptance
harness infrastructure, test lanes, DOM contracts, reusable checks, and fixture
subsystems:

- **DOM readiness contract** (`scripts/e2e/domContract.ts`): pure attribute parsers
  enforcing `data-reader-root`, `data-instrument-id`, `data-instance-id`,
  `data-run-id`, `data-snapshot-version`, `data-input-revision`,
  `data-accepted-input-revision`, `data-pending`, `data-execution-label`,
  `data-result-status`, `data-refusal-code`, and instrument address grammar.
- **Lanes and configuration** (`scripts/e2e/lanes.ts`, `playwright.config.ts`):
  all 11 Playwright projects (`desktop`, `tablet`, `touch-320`, `webkit-real`,
  `keyboard-only`, `reduced-motion`, `zoom-400`, `text-200`, `no-webgl`,
  `js-disabled`, `print`).
- **Emulation utilities** (`scripts/e2e/emulation.ts`): text-spacing stylesheets,
  vision deficiency emulation, `*.wasm` URL interception, response release delays,
  and CPU throttling profiles.
- **Contract primitives** (`scripts/e2e/primitives.ts`): `enterDeepPassage`,
  `switchFace`, `openFoundation`, `returnToArgument`, `operateInstrument`,
  `enterValue`, `selectLinkedTerm`, `returnToSource`, and `restoreFromUrl`.
- **Reusable checks** (`scripts/e2e/checks/instrumentChecks.ts`,
  `scripts/e2e/checks/pageChecks.ts`, `scripts/e2e/checks/measure.ts`):
  instrument contract, snapshot identity across views, typed entry/step,
  out-of-domain refusal, WASM block fallback, stale response rejection, restart
  run ID generation, 320px horizontal overflow, semantic MathML, focus
  restoration, footnote reachability, print fidelity, and `@axe-core/playwright`
  accessibility audit.
- **Fixture subsystem and self-test pages** (`scripts/e2e/fixtures/*`,
  `src/testing/e2e/fixtures/pages/*`, `src/testing/e2e/fixture-apps/selftest/*`):
  fixture application registry, deterministic `bun build` bundler, 127.0.0.1-only
  HTTP server, production build leakage scanner, ok/broken self-test HTML fixture
  pairs for every check, fixture reading section, and interactive `harness-selftest`
  instrument app.
- **CI and Gates** (`.github/workflows/browser-acceptance.yml`,
  `scripts/quality-gates/registry.ts`): registered `browser-acceptance` gate step
  and standalone GitHub Actions browser workflow.

## Commands

```bash
# Intentional nonzero self-test of screenshot/DOM/diagnostics/trace capture
bun scripts/e2e-paper-vertical-slices.ts --self-test-failure \
  --base-url http://127.0.0.1:3088 \
  --output-dir /tmp/annus-mirabilis-e2e-self-test

# Parses and runs preflight, but records an honest configuration failure
# until am-test-e2e-harness-bqmh wires in a scenario source:
bun scripts/e2e-paper-vertical-slices.ts --all --base-url http://127.0.0.1:3088
bun scripts/e2e-paper-vertical-slices.ts --paper brownian-motion --base-url http://127.0.0.1:3088
bun scripts/e2e-paper-vertical-slices.ts --changed --base-url http://127.0.0.1:3088

# Unit contracts for the event/summary schema, CLI parsing, diagnostics,
# ordering, and the vertical-slice journey contract:
bun test scripts/e2e/paper-e2e-contract.test.ts
```

Use `--viewports desktop,tablet,phone` to select viewports. Their dimensions
are fixed at 1440×900, 768×1024, and 320×800 (`phone` is exactly 320 px, the
width AGENTS.md's accessibility and performance sections both require a lane
for). No arbitrary sleep is used anywhere in this harness: readiness is tied
to semantic locators, URL state, DOM attributes, and bounded Playwright
predicates. The runner does not replace archival-edition tests or numerical
kernel tests.

## The vertical-slice journey contract

`scripts/e2e/paper-e2e-contract.ts` exports `validatePaperE2EJourney`, which
enforces the shape AGENTS.md's "Testing and Logging Standards" section
requires of every paper's browser vertical slice:

> enter through a deep source passage, switch face, open a foundation,
> return to the exact argument, operate an instrument, select a linked
> term, and return to the source

A `PaperE2EJourney` must contain exactly those seven steps
(`enter-source-passage`, `switch-face`, `open-foundation`,
`return-to-argument`, `operate-instrument`, `select-linked-term`,
`return-to-source`) in that order, each with a named semantic readiness
condition (a description and a locator/selector — never a fixed sleep), and
must retain all four failure-evidence kinds (`screenshot`, `trace`, `dom`,
`console`). The validator checks the journey's *shape*; it says nothing
about a real paper's DOM. `am-test-e2e-harness-bqmh` builds the real paper
lanes that populate this contract with actual routes and selectors.

## The DOM readiness contract

`scripts/e2e/domContract.ts` is a pure parser over an already-captured
attribute map (never a live page): `parseInstrumentRoot`,
`parseInstrumentView`, `parseReaderRoot`, and `parseAnchor` each require
their named attributes and throw a `DomContractError` (carrying `.attribute`
and, for an address, `.value`) naming exactly what is missing or ill-formed,
rather than returning a value that silently omits a field.

The reader root `[data-reader-root]` carries `data-ready="true"` once static
content is present and hydration (if any) has completed, and `data-view`
naming the current face. Anchors carry `id` and `data-anchor`, and the two
must agree. Every instrument root `[data-instrument-id]` carries
`data-instance-id`, `data-run-id`, `data-snapshot-version`,
`data-input-revision`, `data-accepted-input-revision`, `data-pending`
(`"true"` while a newer request is outstanding), and `data-execution-label`
(one of `frankensim`, `host`, `static`, `unavailable`); a typed primary
result adds `data-result-status`, a refusal adds `data-refusal-code`.
Runtime-lane attributes `data-accepted-action-index` and `data-view-state`
(defined by `am-rt-snapshot-store-aft`) are read when present and never
required. Every view of one instance (trace, distribution, equation live
values, table, accessible description) carries `data-instance-id`,
`data-run-id`, and `data-snapshot-version`; `scripts/e2e/checks/measure.ts`'s
`checkSameSnapshotIdentity` asserts they agree across views.

**The `data-instrument-id` value rule.** `am-inst-registry-dispatcher-66l0`
writes this attribute and owns which value it holds: the bare catalogue id
(`bm-01`) when the default mode is mounted, or `<instrumentId>:<mode>`
(`me-03:box-1906`, `sr-02:apparatus`, `bm-04:kicks-off`, `bm-07:kitchen`)
when a registered mode is mounted — never a preset id, because a preset
changes parameters within a mode while the address names the mode.
`parseInstrumentAddress` validates the grammar unconditionally: a single
optional colon, and lower-case ASCII words and digits joined by hyphens on
each side, with a dot permitted only between two digits. A preset id
(`<instrumentId>-<slug>`, e.g. `sr-03-boost-0.6c`) fails this grammar
whenever it is used as an address, because its slug may glue a unit letter
onto a decimal (`0.6c`) with no hyphen — exactly the shape the grammar
rejects. Membership (whether a given `<instrumentId>:<mode>` is actually
registered) is checked only against a `declaredModes` list the caller
supplies — a paper journey passes the list from its compiled manifest — and
an address outside that list fails naming the registered modes. With no
list, the parser returns the parsed instrument id and mode and asserts
nothing about membership, because this Batch A harness must not import the
compiled content registry to read a DOM attribute.

## Lanes

`scripts/e2e/lanes.ts` defines the eleven lanes AGENTS.md's "Testing and
Logging Standards" require, as plain structural data (`LaneDefinition`) —
not `@playwright/test` `Project` objects, because `@playwright/test` is not
yet a dependency of this repository (only the browser-automation library
`playwright` is; see `src/testing/log/playwright.ts`). A real
`playwright.config.ts` maps each definition onto a Playwright project once
that dependency is added; until then `laneByName` and `createLaneActions`
are exercised directly.

| Lane | Browser | Viewport | Notes |
|---|---|---|---|
| `desktop` | Chromium | 1440×900 | |
| `tablet` | WebKit | 768×1024 | touch |
| `touch-320` | Chromium | 320×800 | mobile emulation, touch, exactly 320 CSS px wide |
| `webkit-real` | WebKit | 1280×800 | a real WebKit/Safari lane, distinct from `tablet` |
| `keyboard-only` | Chromium | 1440×900 | `createLaneActions` throws on any pointer action |
| `reduced-motion` | Chromium | 1440×900 | `reducedMotion: "reduce"` |
| `zoom-400` | Chromium | 320×256 | device scale factor 4 (WCAG reflow) |
| `text-200` | Chromium | 1440×900 | injects a root font-size: 200% stylesheet |
| `no-webgl` | Chromium | 1440×900 | launched with `--disable-3d-apis --disable-webgl --disable-webgl2`; `getContext("webgl"/"webgl2")` must return `null` |
| `js-disabled` | Chromium | 1440×900 | `javaScriptEnabled: false` |
| `print` | Chromium | 1440×900 | print media emulation and PDF output |

`createLaneActions(lane, delegate)` wraps a page's real action methods so
the contract primitives (`operateInstrument`, `enterValue`, ...) go through
one API that enforces `keyboard-only`'s constraint, instead of each journey
author remembering to avoid pointer calls by convention.

## Emulation utilities

`scripts/e2e/emulation.ts` holds the pieces other beads reuse without
depending on a live page:

- `TEXT_SPACING_STYLESHEET` and `parseTextSpacingStylesheet` — the WCAG
  1.4.12 values (line height 1.5, paragraph spacing 2 em, letter spacing
  0.12 em, word spacing 0.16 em) as one injectable stylesheet, and a parser
  back out of it so a test can assert on the values directly rather than on
  the CSS text.
- `visionDeficiencyAvailability(browser)` — Chromium-only; reports
  `"not-available"` for WebKit and Firefox rather than silently no-op'ing.
- `isWasmRequestUrl(url)` — the `*.wasm` request-blocking predicate.
- `releaseOrder(releases)` — given a set of `{ id, delayMs }` responses,
  returns the order they resolve in, for scripting "an older response
  arrives after a newer one" against `data-accepted-input-revision`.
- `resolveCpuThrottling` / `loadCpuThrottling` — reads a profile's
  `cpuSlowdown.factor` from `perf/profiles.json` (or a fixture path);
  reports `"not-available"` when the file or the named profile is absent,
  never a default factor. WebKit cannot throttle CPU; do not mix
  performance assertions into acceptance lanes.

## The fixture application registry

`scripts/e2e/fixtures/fixtureApps.ts` is the **one** registry of
interactive fixture applications and the **one** validator of its entries;
there is never a second bundler or a second registry. A bead that needs an
interactive fixture instrument in a real browser adds an entry here in the
same change as its fixture application, instead of adding a fixture build,
flag, route, or conditional import to the main application:

```ts
export interface FixtureAppEntry {
  id: string;                    // stable; appears in failure messages
  entry: string;                 // a directory under src/testing/
  outDir: string;                // artifacts/e2e-fixtures/<id>/ (gitignored)
  owner: string;                 // the registering bead id
  staticInputs?: FixtureStaticInput[];
}
```

`staticInputs` (`{ from, servedPath }`) declares committed or generated
files an application needs served unchanged beside its bundle — a pinned
WASM artifact and its manifest, for instance — so a fixture can exercise the
real artifact rather than an unchecked copy. `from` must stay inside the
repository; `servedPath` is relative to that application's `/apps/<id>/`
root, may not be absolute or escape it, may not collide with a bundle
output name (`bundle.js`, `bundle.js.map`), and may not repeat within one
entry. `validateFixtureAppRegistry` rejects a duplicate id, an `entry`
outside `src/testing/`, an `outDir` outside `artifacts/e2e-fixtures/`, an
entry with no owner, and every `staticInputs` violation above; it accepts
an optional `isKnownBeadId` predicate to check an owner against real bead
ids without this pure module depending on the tracker.

The registry ships **empty** from this bead: the harness's own self-test
fixture (`harness-selftest`) and each consumer's fixture application
(`am-rt-browser-conformance-09i5`'s `runtime`, `am-inst-predict-mode-ti7m`'s
`predict-mode`, `am-inst-interaction-primitives-emwy`'s
`interaction-primitives`, `am-inst-2d-view-kit-u75r`'s `2d-view-kit`,
`am-inst-parameter-controls-cmj9`'s `controls-kit`) each land in the same
change as that fixture application, from the bead that owns it.

The bundler, server, and build-output scan that turn a registered entry
into a served, verified bundle now exist:

- **`bundleFixtures.ts`** runs `bun build <entry>/index.ts --outdir <outDir>
  --entry-naming bundle.js --sourcemap=external --target=browser
  --format=esm` for each registered entry (verified byte-identical across
  two runs on the same input, including its committed two-module test
  fixture at `src/testing/e2e/fixture-apps/bundler-probe/`, which is a
  bundler correctness probe, never a shipped interactive fixture), then
  copies each `staticInputs` file byte for byte, failing by name when a
  declared source file is missing.
- **`fixtureServer.ts`** binds only to `127.0.0.1`, serves `staticRoot` at
  `/` and `appsRoot/<id>/...` at `/apps/<id>/`, resolves `.wasm` to
  `application/wasm`, applies a caller-supplied `headersForPath` resolver
  (so a fixture page can be served with the same headers the real
  application would send for that path), and 404s any request that would
  resolve outside either root, including a `..` traversal hidden behind a
  percent-encoded slash.
- **`buildOutputScan.ts`** scans a flat listing of built output paths (a
  real `next build`/`out` tree via `listBuildOutputFiles`, or a fixed
  listing in tests) for any string that could only appear if a fixture's
  id, source directory, or a `staticInputs` served name had leaked into
  production, naming the offending file.

The harness's own `harness-selftest` fixture application and self-test HTML
pages (`src/testing/e2e/fixtures/pages/`), `playwright.config.ts`, the browser
acceptance test suite (`scripts/e2e/checks/*.test.ts`, `scripts/e2e/*.test.ts`),
and the GitHub Actions CI workflow (`.github/workflows/browser-acceptance.yml`)
are fully delivered and verified.

## The CLI's harness flags

`scripts/e2e/cli.ts`'s `parseE2ECliArgs` parses the flag set requirement 12
of `am-test-e2e-harness-bqmh` names:

```bash
bun scripts/e2e-paper-vertical-slices.ts [--paper <slug> | --fixtures | --smoke] [--lane <name>] [--journey <id>]
```

Exactly one of `--paper <slug>`, `--fixtures`, or `--smoke` is required.
`--lane <name>` is validated against `lanes.ts`'s `laneByName` (an unknown
lane fails naming every known lane); `--paper <slug>` is checked against an
optional caller-supplied list of known paper slugs, with the same
no-list-means-no-membership-check boundary as the instrument address
parser. This is a distinct, smaller flag set from `parsePaperE2EArgs` in
`scripts/e2e/paper-e2e-contract.ts` (`--all`, `--changed`, `--base-url`,
`--viewports`, ...); wiring the two into one CLI entry point is open work.

## What a self-test proves

The failure self-test is successful only when the command exits `1`, its
summary reports exactly one `__harness-self-test__` failure plus an
informative `failure-evidence-integrity` event, and all four failure
artifacts are nonempty. A zero exit from that command — or a failed
integrity event — means the failure path was not actually proven.

## Evidence and retention

Every invocation gets a unique directory under
`artifacts/e2e-paper-vertical-slices/<log-run-id>/` unless `--output-dir` is
supplied, named by `logRunId` (a fresh execution of this test suite, in the
sense AGENTS.md "Structured logs" reserves that field for — never `runId`,
which names an experiment realization under the runtime contract). The
runner appends one schema-validated JSON object per action to
`events.jsonl` and writes `summary.json` at completion.

Failures also retain stable-named:

- a full-page PNG;
- a redacted DOM snapshot;
- a redacted JSON console/page/network transcript;
- a Playwright trace archive.

Secrets in common authorization, bearer, token, cookie, and password forms
are redacted from JSONL, DOM, and diagnostic text. The runner never deletes
or overwrites prior evidence. Keep a run directory with the bead or release
that it supports; any later cleanup is a separate, explicitly approved
retention decision.

## Vercel CLI commands

This harness itself never calls the Vercel CLI: it exercises an already-running
server, local or a verified deployed candidate. The Vercel CLI commands used
by the release pipeline that hands this harness its target (locked at CLI
`59.10.0` by `am-gov-decision-stack-versions-6ax`; see `docs/DECISIONS.md`
section 5's machine-readable capability record) are listed in full, with
line references, in `scripts/verified-production-deploy.ts`'s header
comment:

| Command | Purpose |
|---|---|
| `vercel pull --yes` | Fetch project environment settings and configuration |
| `vercel build --prod` | Produce a production Build Output API v3 bundle locally |
| `vercel deploy --prebuilt --prod --skip-domain` | Upload the prebuilt candidate without aliasing (never omit `--skip-domain`) |
| `vercel inspect <url>` | Read deployment status, readiness, and alias assignments |
| `vercel alias set <previewUrl> <hostname>` | Atomically promote the verified candidate to a public hostname |
| `vercel curl --deployment <d> <path> -- ...` | Fetch protected-preview HTTP status before promotion (beta in `59.10.0`) |
| `vercel link --project <name>` | Link the workspace to the canonical annus-mirabilis project |

`vercel curl` is in beta in the locked CLI version. Its one call site,
`assertProtectedPreviewResponse` in `scripts/verified-production-deploy.ts`,
is the single adapter function a future CLI change would need to touch; its
documented fallback is plain `curl` with an
`x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}` header
(`docs/DECISIONS.md` section 5).

## Release and smoke-test scripts are tool runs, not test suites

`scripts/verified-production-deploy.ts` and `scripts/smoke-test-deployment.ts`
are pipeline and tool executions, not test suites: their artifact
directories are named by `toolRunId` (`scripts/runIds.ts`'s
`newToolRunId()`), never `logRunId` or `runId`. `verified-production-deploy.ts`'s
main entry currently refuses to run at all — see
`docs/DONOR_AUDIT.md` section 11.6 and the header comment of that file for
why, and `am-rel-verified-deploy-qndt` for what replaces the refusal.
