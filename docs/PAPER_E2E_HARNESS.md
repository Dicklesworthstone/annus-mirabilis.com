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

## Current status: infrastructure only

This bead (`am-scaf-extract-scripts-7jm`) extracts and adapts the harness's
**infrastructure**: browser launch, viewports, readiness, evidence
retention, and JSONL logging. It does not carry a paper scenario source. The
donor's scenario manifest (`buildPatentE2EScenarios`) read the donor's live
archival-edition data model (`allPatents`, colorized equations, claim
constraints, physics telemetry); there is no equivalent here yet.

Building the paper lanes, the DOM readiness contract (what "hydrated" means
for a reader face, which stable `data-*` identifiers each face and
instrument exposes), and the fixture bundler on this extracted harness is
`am-test-e2e-harness-bqmh`'s scope, not this bead's. Until that lands:

- `--self-test-failure` runs end to end: it launches Chromium, navigates to
  the target, and deliberately records a failure with full evidence
  retention. This is the harness's own acceptance proof.
- Every other mode (`--paper <slug>`, `--changed`, `--all`) parses
  correctly, runs the real preflight check against the target server (so a
  dry run still produces a real JSONL log), and then records one honest
  `configuration`/`scenario-selection` failure event naming
  `am-test-e2e-harness-bqmh` as the bead that wires in real scenarios,
  instead of pretending paper lanes exist.

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
