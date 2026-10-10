/**
 * Quality Gates Registry for annus-mirabilis.com
 *
 * Defines the single, typed, canonical quality gate chain. WHAT ACTUALLY RUNS IT (am-7bkr):
 * - `bun run gates`, which dsr invokes. Families `fast` and `browser`, cadence every-run.
 * - `bun run gates:apple`, local only. AGENTS.md: Apple validation "runs locally as the `apple`
 *   gate family, not in the website's CI".
 * - `bun scripts/verified-production-deploy.ts --profile <scaffold|preview|launch>`, which sweeps
 *   every family at every cadence for the steps that profile requires.
 *
 * NOT GitHub Actions. This header listed `.github/workflows/quality-gates.yml` and
 * `nightly-gates.yml` as consumers until 2026-10-06, and they are not: docs/DECISIONS.md
 * D-2026-09-22-dsr-is-the-ci-never-github-actions records the owner's standing rule verbatim, "we
 * don't use gh actions for CI *EVER*, we ONLY use /dsr", and dsr's own repos.yaml entry for this
 * repository says so in a comment. Five workflow files are tracked and none of them executes. A
 * header naming a non-runner as a consumer is how a step comes to look enforced while no path
 * reaches it, which is this bead's whole subject, so it is corrected here rather than left.
 *
 * THAT STEP CLASS IS NOW REACHED, and the history is kept because the measurement is the useful
 * part. Until 2026-10-08 the two `perf` steps (perf-budgets, resource-stress, cadence nightly) were
 * required only by the `preview` and `launch` profiles, every release so far had run under
 * `scaffold`, and `bun run gates` did not reach them either, because it is every-run and they were
 * nightly with no nightly runner under dsr. So nothing ran the perf family at all.
 *
 * Runtime was the obvious objection to moving them and was measured first, on 2026-10-08:
 * `run-perf-budgets.ts` takes 3 SECONDS and passes; `resource-stress.ts` takes UNDER A SECOND and
 * passes 6 of 6 scenarios, each with a real duration. So `nightly` was never justified by cost. The
 * real obstacle was that perf-budgets measures the production build and `gates` builds nothing,
 * which `AvailabilityProbe.requiresArtifact` now answers: without `.next`, the step reports
 * `not-available` rather than passing over nothing.
 *
 * Owner's decision, 2026-10-08 (am-7bkr): refuse without a build, then every-run. Both are now
 * `family: "fast"`, `cadence: "every-run"`, `requiredInCi: true`, so `bun run gates` executes them.
 * The `perf` family is consequently EMPTY, which is deliberate: it exists in `GateFamily` and holds
 * nothing, rather than holding steps no path reaches.
 *
 * Requirements:
 * - Never weaken a gate.
 * - Missing/unbuilt scripts report `not-available` and are never counted as passing.
 * - Profile runs (`--profile <scaffold|preview|launch>`) fail with exit code 2 if any required step is unavailable.
 */

import { APPLE_STEPS } from "../app/apple-steps.ts";

export type GateFamily = "fast" | "browser" | "perf" | "apple";
export type GateCadence = "every-run" | "nightly";
export type GateProfile = "scaffold" | "preview" | "launch";

export type GateOutcome = "passed" | "failed" | "not-available" | "skipped" | "refused";

export type GateSkipReason = "tool-unavailable" | "not-required-in-ci" | "cadence";

export interface AvailabilityProbe {
  readonly scriptPath?: string;
  readonly tool?: string;
  /**
   * What to tell a reader when `tool` is missing (am-dbuk).
   *
   * A gate whose failure does not name its blocker trains people to discount it.
   * Without this, a launch profile on a machine lacking the binary refuses with
   * "Required tool 'ubs' was not found in PATH or node_modules/.bin", which reads
   * as a broken release rather than an uninstalled dependency. State what the tool
   * is, that its absence is not a scan finding, and where its provenance is
   * recorded. Do not invent an install command that is not documented somewhere.
   */
  readonly toolHint?: string;
  /**
   * A BUILD ARTEFACT THE STEP MEASURES, so a run without one reports `not-available` instead of
   * passing over nothing (am-7bkr, owner's choice 2026-10-08).
   *
   * `perf-budgets` reads the production build: its own note says "measured from .next across 10
   * routes", and without one it reports 6 of 8 rows `not-available` and still exits 0. A step that
   * passes having measured nothing is the hazard AGENTS.md names first, and it is worse once the
   * step is required every run, because the green becomes routine. The requirement is declared here
   * rather than checked inside the script so the RUNNER classifies it, which is what keeps a
   * profile run refusing (exit 2) while a local `bun run gates` reports it and carries on.
   */
  readonly requiresArtifact?: {
    readonly path: string;
    /** What to tell a reader: what is missing and the one command that makes it. */
    readonly hint: string;
  };
}

export interface GateStep {
  readonly id: string;
  readonly title: string;
  readonly command: readonly string[];
  readonly family: GateFamily;
  readonly cadence: GateCadence;
  readonly requiredInCi: boolean;
  /**
   * WHY this step is not required in CI, as DATA rather than as a code comment (am-xoxn).
   *
   * The bead's words: "`requiredInCi: false` stops being a flag whose reason lives only in a code
   * comment". Every exemption here had a reason and most were written down, but in prose beside
   * the entry, where nothing could read them and nothing noticed when one had none. Four had none
   * at all.
   *
   * Required whenever `requiredInCi` is false and forbidden when it is true, both enforced by
   * ciExemptionReasons.node.test.ts - the second half matters as much as the first, because an
   * optional field that may be present anywhere becomes decoration.
   */
  readonly notRequiredInCiReason?: string;
  readonly requiredInProfiles: readonly GateProfile[];
  readonly availability: AvailabilityProbe;
  readonly owner: string; // bead id
}

export const KNOWN_FAMILIES: readonly GateFamily[] = ["fast", "browser", "perf", "apple"];
export const KNOWN_CADENCES: readonly GateCadence[] = ["every-run", "nightly"];
export const KNOWN_PROFILES: readonly GateProfile[] = ["scaffold", "preview", "launch"];

/**
 * The canonical quality gate steps in execution order.
 */
export const QUALITY_GATE_STEPS: readonly GateStep[] = [
  // 1. Architecture gate (App Router purity & root allowlist)
  // THE OCR PROHIBITION, REGISTERED (am-jb4c).
  //
  // AGENTS.md calls it permanent, with "no convenience, deadline, fallback, or 'small batch'
  // exception", and it was the one hard rule with no step here: the scanner's only caller was its own
  // test, so the check ran in the node lane and no release profile asked for it. Required in all three
  // profiles for that reason -- a rule with no exceptions does not have a profile it may skip.
  //
  // Registered while the family is CLEAN: the scan is 4017 files, 1 violation, and that one is the
  // pinned open question the guard subtracts and still reports. So this cannot fail a release today
  // except on a new forbidden call, which is what it is for.
  {
    id: "ocr-guard",
    title: "No forbidden OCR engine is invoked anywhere in the repository",
    command: ["bun", "scripts/ocr-guard.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "scripts/ocr-guard.ts",
    },
    owner: "am-jb4c",
  },
  {
    id: "architecture",
    title: "App Router architecture and root allowlist",
    command: ["bun", "scripts/app-router-architecture.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "scripts/app-router-architecture.ts",
    },
    owner: "am-scaf-architecture-gate-l1p",
  },
  {
    // am-unwired-audits-uwot. Added by d05ea5a8 and invoked by nothing: a check-shaped script with
    // a real failure path that no runner could fire. It exits 0 today - 1241 kebab codes thrown,
    // 54 old-form mentions, all classified as documentation, 0 surviving code references - so it is
    // wired rather than excused. Its own header says it "runs after each batch"; wiring it means a
    // batch that leaves one side of a rename behind reddens the chain, which is what it is for.
    id: "renamed-refusal-codes",
    title: "Renamed refusal codes: both sides of every equality moved",
    command: ["bun", "scripts/check-renamed-refusal-codes.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/check-renamed-refusal-codes.ts",
    },
    owner: "am-p465",
  },

  // 2. Typecheck (TypeScript compiler)
  {
    // am-14js criterion 5. The `typecheck` gate below runs 34 generators before tsc, so its exit
    // code cannot tell "the chain broke" from "the types broke" - in the light-thread outage it
    // exited 1 having printed no `error TS` line at all. This lane runs the two checks separately,
    // names which failed, and costs about two seconds, so an agent can run it before committing.
    id: "typecheck-lane",
    title: "Typecheck lane: types and the instrument registry, separately named",
    command: ["bun", "scripts/typecheck-lane.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/typecheck-lane.ts",
    },
    owner: "am-14js",
  },
  {
    id: "typecheck",
    title: "TypeScript typecheck (noEmit)",
    command: ["bun", "run", "typecheck"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "tsconfig.json",
      tool: "tsc",
    },
    owner: "am-scaf-quality-gates-ci-4xx",
  },
  // 3. Linter (Biome)
  {
    id: "lint",
    title: "Biome linter check",
    command: ["bun", "run", "lint"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "biome.json",
      tool: "biome",
    },
    owner: "am-scaf-quality-gates-ci-4xx",
  },
  // 4. Formatter check (Biome)
  {
    id: "format-check",
    title: "Biome format check",
    command: ["bun", "run", "format:check"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "biome.json",
      tool: "biome",
    },
    owner: "am-scaf-quality-gates-ci-4xx",
  },
  // 5. Unit & Integration Tests (Dynamic multi-runner + orphan test gate)
  {
    id: "unit-tests",
    title: "Unit and integration test suites",
    command: ["bun", "run", "test"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "package.json",
    },
    owner: "am-scaf-quality-gates-ci-4xx",
  },
  // 5b. Unreviewed git stashes (am-70ig)
  //
  // requiredInCi is false and that is the honest setting, not a convenience: refs/stash is never
  // pushed, `git ls-remote origin` returns no stash refs, and a fresh CI checkout therefore has
  // none. A CI run of this step could only ever pass. Recording it as skipped-not-required says
  // so; marking it required would manufacture a green.
  {
    id: "stashes",
    title: "Unreviewed git stashes",
    command: ["bun", "scripts/check-stashes.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: false,
    notRequiredInCiReason:
      "A fresh CI checkout has no stash refs: stashes are purely local and `git ls-remote origin` returns none, so this step could only ever pass there. Marking it required would manufacture a green rather than check anything.",
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "scripts/check-stashes.ts",
      tool: "git",
    },
    owner: "am-70ig",
  },
  // 5c. The equation explanations (dispatch 278, the owner's "multiple options for explaining in
  // more detail (including in words) what the equation means").
  //
  // The build already refuses a malformed record and, for an enforced paper, a display with none.
  // This step is the author's census across every paper: it prints how many of each paper's printed
  // displays carry a record and exits 1 on any problem, so a paper filling up is visible before it
  // is enforced. scriptReachability.test.ts refuses a check-shaped script no runner invokes, and
  // this entry is that runner.
  {
    id: "equation-explanations",
    title: "Equation explanations census",
    command: ["bun", "scripts/check-equation-explanations.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "scripts/check-equation-explanations.ts",
    },
    owner: "am-read-equation-explanations",
  },
  // 6. Ultimate Bug Scanner (diff mode)
  {
    id: "ubs-diff",
    title: "Ultimate Bug Scanner (diff)",
    command: ["ubs", "--diff"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: false,
    notRequiredInCiReason:
      "Scans files modified in the working tree, and a fresh CI checkout has none. Measured 2026-10-06 on a clean tree: `ubs --diff` exits 0 having printed no file census at all, so in CI it would examine nothing and pass. Same shape as `stashes`.",
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      tool: "ubs",
      toolHint:
        "ubs is the Ultimate Bug Scanner, a LOCAL developer binary, not an npm dependency of this repo: it is absent from package.json and recorded in docs/DECISIONS.md as a Development-scope tool. Its absence here means the scanner is not installed on this machine - it is NOT a finding about the code, and nothing in the diff has been scanned. No install command is documented in this repository, so obtain the binary and put it on PATH (the reference machine has it at ~/.local/bin/ubs), or raise am-dbuk to decide whether ubs belongs on the launch path at all.",
    },
    owner: "am-scaf-quality-gates-ci-4xx",
  },
  // 7. Ultimate Bug Scanner (staged mode)
  {
    id: "ubs-staged",
    title: "Ultimate Bug Scanner (staged)",
    command: ["ubs", "--staged"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: false,
    notRequiredInCiReason:
      "Scans files staged in the index, and a fresh CI checkout stages nothing. Like `ubs-diff`, it would examine an empty set in CI and pass without checking anything.",
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      tool: "ubs",
      toolHint:
        "ubs is the Ultimate Bug Scanner, a LOCAL developer binary, not an npm dependency of this repo: it is absent from package.json and recorded in docs/DECISIONS.md as a Development-scope tool. Its absence here means the scanner is not installed on this machine - it is NOT a finding about the code, and nothing in the diff has been scanned. No install command is documented in this repository, so obtain the binary and put it on PATH (the reference machine has it at ~/.local/bin/ubs), or raise am-dbuk to decide whether ubs belongs on the launch path at all.",
    },
    owner: "am-scaf-quality-gates-ci-4xx",
  },
  // 8. Build (Next.js production build - kept last among initial fast gates)
  {
    id: "build",
    title: "Next.js production build",
    command: ["bun", "run", "build"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "next.config.mjs",
    },
    owner: "am-scaf-nextjs-app-bu2",
  },

  // --- Later Registrations (Registered here with availability probes; not-available until built) ---
  {
    id: "publication-contract",
    title: "Publication contract verification",
    command: ["bun", "scripts/publication-contract.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/publication-contract.ts",
    },
    owner: "am-rel-verified-deploy-qndt",
  },
  {
    id: "verify-content",
    title: "Verify content and editorial records",
    command: ["bun", "scripts/verify-content.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/verify-content.ts",
    },
    owner: "am-cm-audit-scripts-d34",
  },
  {
    // am-unwired-audits-uwot. This script existed with a real failure path and was invoked by
    // nothing: not a registry step, not an npm script, not a workflow, not imported by a test.
    // It reads content/quantities/constant-sets/ and passes today, so wiring it in is not red on
    // arrival. Unlike the four plan-specified audits, whose logic verify-content already calls,
    // this one had no path into the chain at all.
    id: "verify-constant-sets",
    title: "Verify constant sets and cross-set consistency",
    command: ["bun", "scripts/verify-constant-sets.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/verify-constant-sets.ts",
    },
    owner: "am-unwired-audits-uwot",
  },
  {
    id: "verify-wasm-artifacts",
    title: "Verify WASM artifacts and hashes",
    command: ["bun", "scripts/verify-wasm-artifacts.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/verify-wasm-artifacts.ts",
    },
    owner: "am-fs-slim-artifact-0yh",
  },
  {
    id: "voice-lint",
    title: "Editorial voice lint (folded into verify-content as family voice)",
    command: ["bun", "scripts/lint-voice.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: false,
    notRequiredInCiReason:
      "THE RECORDED REASON WAS MISSING and this one is derived from measurement rather than from the original intent, which nobody wrote down: at HEAD on 2026-10-06 `bun scripts/lint-voice.ts` exits 1 (4 errors, 73 flags over 82,176 strings), so requiring it would fail every CI run. That is a reason to fix the errors or to declare the flags acceptable, not a permanent exemption; it is written here so the question is visible. See am-xoxn.",
    requiredInProfiles: [],
    availability: {
      scriptPath: "scripts/lint-voice.ts",
    },
    owner: "am-edit-voice-lint-trmf",
  },
  {
    id: "license-inventory",
    title: "Third-party license inventory check",
    command: ["bun", "scripts/verify-license-inventory.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/verify-license-inventory.ts",
    },
    owner: "am-gov-license-inventory-w6yz",
  },
  {
    // THIS STEP CANNOT PASS ON A ROUTINE RUN, AND THE SCRIPT IS RIGHT TO REFUSE.
    //
    // coverage-report.ts reads two inputs, `--scenario-evidence <path>` and
    // `--review-records <path>`, and the chain passes neither. It therefore opens no file, and
    // `coverageWasMeasured` refuses rather than printing counts over an empty set - which is the
    // defect am-9n4g was raised for and exactly the right instinct. The refusal is untouched here.
    //
    // MEASURED before deciding, because "wire the chain" was the obvious fix and it is not
    // available: NOTHING IN THE TREE PRODUCES EITHER INPUT. `--scenario-evidence` appears only in
    // coverage-report.test.ts and the ledger's own tests, which build fixtures in temp dirs;
    // run-scenarios.ts writes no artifact at all. For review records there is code
    // (backfill-review-records.ts, render-review-acceptance.ts) and test logs under
    // artifacts/test-logs/review-records/, but no committed records file in the input format. So
    // there is no path to pass, and the script's own text says why: "the remaining dimensions
    // have no loader wired (am-cm-coverage-ledger-0ip)".
    //
    // So the CHAIN was wrong, not the gate. Moved from every-run to nightly:
    //   - a routine `--family fast` run uses cadence "every-run" and now skips it, instead of
    //     carrying a permanent red at step 18 of 28. A required gate that can never pass trains
    //     people to discount the whole chain, which costs more than the step reports.
    //   - a `--profile preview` or `--profile launch` run uses cadence "all" (quality-gates.ts:168),
    //     so it STILL RUNS and still blocks there. Unmeasured coverage should stop a release, and
    //     requiredInProfiles is unchanged.
    //   - requiredInCi GOES FALSE, and that is a correction to this comment's first version.
    //     I wrote that it could stay true because quality-gates.ts:455 exempts a step skipped for
    //     cadence. That is true of the RUNNER and it is not the only claim the flag makes.
    //     ciGateWiring.test.ts asserts a second invariant: every requiredInCi gate must be
    //     EXECUTED by some dsr check. package.json's `gates` runs --family fast and --family
    //     browser with no --cadence, so only every-run is admitted and a nightly gate is reachable
    //     by no dsr check at all. Moving the cadence without clearing the flag left this gate
    //     declaring a requirement nothing could satisfy, and central verify went red on exactly
    //     that. The flag is dropped rather than the invariant silenced.
    //
    //     What the flag stood for is not lost. requiredInProfiles still carries preview and
    //     launch, and profile mode filters on THAT alone (quality-gates.ts:211), never on
    //     requiredInCi, so a --profile launch run still executes this gate and still refuses.
    //     check-stashes.ts:13 records the same pattern for the same reason, and 23 gates still
    //     declare requiredInCi, so ciGateWiring keeps a real population to quantify over.
    //
    // This is reversible in one word. When am-cm-coverage-ledger-0ip wires a loader and something
    // emits scenario evidence, put cadence back to every-run and pass the path in `command`.
    id: "coverage-report",
    title: "Multi-dimensional coverage ledger report",
    command: ["bun", "scripts/coverage-report.ts"],
    family: "fast",
    cadence: "nightly",
    requiredInCi: false,
    notRequiredInCiReason:
      "Nothing emits scenario coverage evidence yet, so the step has no input to report on. Reversible in one word: when am-cm-coverage-ledger-0ip wires a loader and something emits evidence, put the cadence back to every-run and pass the path in `command`.",
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/coverage-report.ts",
    },
    owner: "am-cm-coverage-ledger-0ip",
  },
  {
    id: "scenarios",
    title: "Scenario registry verification",
    command: ["bun", "scripts/run-scenarios.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/run-scenarios.ts",
    },
    owner: "am-ver-scenario-registry-om3",
  },
  {
    id: "audit-derivation-tools",
    title: "Derivation tool attachment and registry resolution audit",
    command: ["bun", "scripts/audit-derivation-tools.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/audit-derivation-tools.ts",
    },
    owner: "am-eq-derivation-chains-r4c",
  },
  {
    id: "audit-dimensions",
    title: "Rational-exponent dimensional consistency audit",
    command: ["bun", "scripts/audit-dimensions.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/audit-dimensions.ts",
    },
    owner: "am-cm-dimension-validator-aoz",
  },
  {
    id: "audit-reachability",
    title: "Argument reachability across five accomplishments audit",
    command: ["bun", "scripts/audit-reachability.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/audit-reachability.ts",
    },
    owner: "am-edit-comprehension-protocol-ouih",
  },
  {
    // WHY THIS IS NIGHTLY AND NOT every-run, written here because the choice is the whole value of
    // the entry (am-ver-adversarial-audit-1ef).
    //
    // The fifteen rows' assertions already run on every commit: `src/testing/adversarial/*.test.ts`
    // is ordinary bun-lane work and `bun run test` executes all sixteen files. So does the
    // registry-versus-disk drift check, in BOTH directions, in `adversarialImports.test.ts` -- an
    // earlier version of this comment claimed the drift refusal as something the lane cannot make,
    // and that was an overstatement; the lane makes it. What this gate adds that nothing else does
    // is the VACUITY refusal, a row that ran and asserted nothing, and the generated report with
    // assertions attributed per row, which is what a release consumes. Attribution is why it runs
    // each file in its own `bun test`: fifteen process spawns, buying a commit no information it
    // needs. So it is release evidence rather than per-commit information.
    //
    // requiredInProfiles still carries preview and launch, and profile mode filters on THAT alone
    // (quality-gates.ts:184-185 sets the cadence filter to "all" in profile mode), so a
    // `--profile launch` run executes this gate and refuses on drift, on a vacuous row, and on any
    // failing row. That is the sense in which the report is attached to launch readiness.
    id: "audit-adversarial",
    title: "Adversarial fixture audit: fifteen rows, each failing for its declared reason",
    command: ["bun", "scripts/audit-adversarial.ts"],
    family: "fast",
    cadence: "nightly",
    requiredInCi: false,
    notRequiredInCiReason:
      "Nothing in CI would learn anything from this step, because the rows' own assertions already run on every commit in the bun lane (src/testing/adversarial/, 16 files, 315 expect() calls) and this gate re-executes those same predicates. What it adds is attribution, one file per process, so docs/audits/ADVERSARIAL_AUDIT.md can say which assertions belong to which row -- that is release evidence rather than a commit check, which is why requiredInProfiles keeps preview and launch refusing without it.",
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/audit-adversarial.ts",
    },
    owner: "am-ver-adversarial-audit-1ef",
  },
  {
    // THE BROWSER HALVES OF ADVERSARIAL ROWS 9 AND 12 (am-ver-adversarial-audit-1ef).
    //
    // every-run and requiredInCi, because `bun run gates` invokes --family browser and the cadence
    // filter defaults to every-run, so this declaration is actually wired; ciGateWiring.test.ts
    // quantifies over exactly this flag and would fail if it were not.
    //
    // requiresArtifact names out/, so a checkout with no build reports `not-available` rather than
    // passing having loaded nothing, and a --profile run refuses. That is the distinction
    // AGENTS.md puts first: a run that examined nothing is not a clean run.
    id: "adversarial-runtime",
    title:
      "Adversarial runtime rows: an observer change keeps the run, a 64-bit seed survives transport",
    command: ["node", "--experimental-strip-types", "scripts/e2e/adversarialRuntime.mjs"],
    family: "browser",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/e2e/adversarialRuntime.mjs",
      requiresArtifact: {
        path: "out/index.html",
        hint: "These two rows are checked against the real built routes over HTTP, never a DOM fixture. Run `bun run build` first. An absent out/ is not a row failure: nothing was loaded.",
      },
    },
    owner: "am-ver-adversarial-audit-1ef",
  },
  {
    // EVERY REFERENCE IN AN EVIDENCE DOCUMENT RESOLVES (am-bm-slice-exit-demo-5922).
    //
    // The script existed with a failure path and nothing branched on it, and its default examined
    // ONE of the five evidence documents — the one that was green — while the corpus's only broken
    // reference sat in a document the default never opened. Both halves are now repaired: the
    // default is every markdown file under docs/evidence/ and docs/decisions/, and a run that finds
    // no documents exits 1 rather than reporting a clean sweep over nothing.
    //
    // Measured at registration: 5 documents, 328 references, 0 unresolved, about a second.
    id: "evidence-links",
    title: "Every file, bead and log reference in an evidence document resolves",
    command: ["bun", "scripts/check-evidence-links.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/check-evidence-links.ts",
    },
    owner: "am-bm-slice-exit-demo-5922",
  },
  {
    id: "receipts",
    title: "Provenance receipt check",
    command: ["bun", "scripts/check-receipts.ts", "--surveys"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/check-receipts.ts",
    },
    owner: "am-src-receipt-format-npo5",
  },
  {
    id: "facsimile-digests",
    title: "Pinned facsimile bytes match their recorded digests",
    command: ["bun", "scripts/download-facsimiles.ts", "--verify"],
    family: "fast",
    cadence: "every-run",
    // Runnable in CI because it needs only ONE side of the comparison. The pinned
    // extracts are tracked; only the parent scans are git-ignored, and a missing
    // parent is reported not-available rather than failing unless --require-local is
    // passed, which it is not. Before this, three facsimile gates were required in CI
    // and NONE of them read a pinned PDF: a green certified that the configs agreed
    // with each other (am-xoxn).
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/download-facsimiles.ts",
    },
    owner: "am-xoxn",
  },
  {
    id: "facsimile-config",
    title: "Facsimile scan configuration check",
    command: ["bun", "scripts/download-facsimiles.ts", "--check-config"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/download-facsimiles.ts",
    },
    owner: "am-src-download-script-15ar",
  },
  {
    id: "facsimile-page-anchors",
    title: "Facsimile page anchor and offset verification",
    command: ["bun", "scripts/verify-facsimile-anchors.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/verify-facsimile-anchors.ts",
    },
    owner: "am-cf6m",
  },
  {
    id: "facsimile-pins",
    title: "Pinned facsimile verification against parent scans",
    command: ["bun", "scripts/verify-facsimile-pins.ts"],
    family: "fast",
    cadence: "every-run",
    // The parent scans are not committed (/sources is git-ignored), so CI has nothing to
    // compare the pinned extracts against. The release profiles run on a machine that holds
    // the parents, and an unavailable required step fails a profile run rather than passing.
    requiredInCi: false,
    notRequiredInCiReason:
      "The parent scans are not committed (/sources is git-ignored), so CI has nothing to compare the pinned extracts against. The release profiles run on a machine that holds the parents, and an unavailable required step fails a profile run rather than passing. The pinned-only half of this chain is in CI as the digest check; this entry keeps the checks that genuinely need both sides.",
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/verify-facsimile-pins.ts",
      tool: "pdftoppm",
      // am-dbuk, same reasoning as the ubs gates: this binary is not an npm dependency, so its
      // absence has to read as "poppler is not installed" rather than as a bad facsimile pin.
      toolHint:
        "pdftoppm is part of poppler, a system toolchain this repository does not install. Its absence means poppler is not present on this machine - it is NOT a finding about a pinned facsimile, and no page was rendered or compared. AGENTS.md's OCR policy keeps pdftoppm available on purpose (it is not a denylisted engine), so obtain poppler through the system package manager and put pdftoppm on PATH.",
    },
    owner: "am-cf6m",
  },
  {
    id: "perf-budget-change",
    title: "Performance budget diff check",
    command: ["bun", "scripts/perf-budget-diff.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/perf-budget-diff.ts",
    },
    owner: "am-plat-perf-budgets-s3ww",
  },
  {
    id: "browser-acceptance",
    // THE COMMAND CARRIED NO SELECTION FLAG, so this gate could not run at all: the harness
    // requires exactly one of --paper / --changed / --all / --fixtures / --smoke and exits 2 on
    // a usage error without it. Measured through this runner before the change:
    // `bun scripts/quality-gates.ts --only browser-acceptance --family browser` reported
    // FAILED, 0 passed, 1 failed, in 141ms, having reached neither a preflight nor a browser.
    //
    // WHY THIS JOURNEY AND NOT THE PAPER SLICES THE TITLE NAMES. Both candidates were run.
    // `--all` exits 1 on preflight because the chain starts no Next server, and behind that the
    // harness itself records "Paper vertical-slice scenarios are not wired in yet; see
    // am-test-e2e-harness-bqmh", so it cannot pass until that bead builds the paper lanes.
    // `--fixtures --journey runtime-conformance` exits 0 today over nine live-class assertions
    // in real Chromium, three of them planted negatives that must fail.
    //
    // HALF OF THAT IS NOW STALE, and the half that stands is a different problem from the one it
    // names. Re-measured 2026-10-07: the quoted stub is GONE from the harness, which registers all
    // four papers through `scripts/e2e/journeys/index.ts`, and `--paper mass-energy` now reaches a
    // real preflight rather than a usage refusal. What it fails on is `preflight/target-identity`
    // with "Unable to connect. Is the computer able to access the url?" -- it wants a server, and
    // the gate chain starts none. So the blocker is the TARGET, not the wiring, and anyone reading
    // the paragraph above would go looking for paper lanes that already exist.
    //
    // The capability to serve one is also already here: `scripts/e2e/paperJourneyLane.e2e.test.ts`
    // runs a paper's seven-step journey in the node lane against `out/` on a server it starts
    // itself, with `assertOutFreshness` refusing a stale build and a route-surgical plant that must
    // redden it. So widening this command means giving the gate a target -- serving `out/`, or
    // pointing `E2E_BASE_URL` at the candidate deployment the release script already builds -- and
    // it means the browser family then depends on a fresh `out/`, which this chain does not build.
    // That dependency is the decision to take, and it belongs to am-browser-gate-identity-7nq2
    // rather than to a widened command slipped in here.
    //
    // THE TITLE IS NOW WHAT IT RUNS. It said "Browser acceptance E2E vertical slices" while
    // running the runtime-conformance journey, which am-xyxk item 2 put to the owner as part of
    // a larger question: three artifacts shared the name "browser acceptance" and did three
    // different things. Owner decision 2026-09-21, verbatim "Delete the workflow; register the
    // journey" - neither of the two readings offered, but the third the bead raised, on the
    // grounds that it resolves the duplication instead of relabelling it
    // (am-browser-gate-identity-7nq2).
    //
    // WIDEN THE COMMAND, DO NOT WIDEN THE TITLE BACK, when am-test-e2e-harness-bqmh builds the
    // paper lanes: the journey is what this gate covers until a --paper run can pass.
    title: "Runtime conformance in live Chromium",
    command: [
      "bun",
      "scripts/e2e-paper-vertical-slices.ts",
      "--fixtures",
      "--journey",
      "runtime-conformance",
    ],
    family: "browser",
    cadence: "every-run",
    // THIS FLAG WAS NEVER THE PROBLEM AND IS UNCHANGED. It has read true throughout; what was
    // false is that any job ran it, because no workflow passed --family browser. A flag is a
    // declaration and CI is the wiring, and the whole of am-browser-gate-identity-7nq2 is about
    // mistaking one for the other. quality-gates.yml now runs the browser family, and
    // src/testing/ciGateWiring.test.ts fails if ANY requiredInCi gate is run by no workflow job,
    // so the declaration cannot drift away from the wiring again in silence.
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/e2e-paper-vertical-slices.ts",
    },
    owner: "am-test-e2e-harness-bqmh",
  },
  {
    id: "perf-budgets",
    title: "Performance budget full measurements",
    command: ["bun", "scripts/run-perf-budgets.ts"],
    // MOVED OUT OF THE `perf` FAMILY so a dsr check reaches it (am-7bkr, owner 2026-10-08).
    // It was `perf`/`nightly`, required only by preview and launch, and the registry header
    // recorded that nothing ran it: dsr runs --family fast and --family browser, `bun run gates`
    // is every-run, and dsr has no nightly runner, so in practice it had never executed. Runtime
    // was the obvious objection and it is not the obstacle: measured 2026-10-08, this step takes
    // 3 SECONDS and PASSES. The real obstacle was that it measures the build and `gates` builds
    // nothing, which `requiresArtifact` below answers.
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/run-perf-budgets.ts",
      requiresArtifact: {
        path: ".next/app-build-manifest.json",
        hint: "The performance budgets are measured from the production build. Run `bun run build` first. This is not a budget failure: nothing was measured.",
      },
    },
    owner: "am-plat-perf-budgets-s3ww",
  },
  {
    id: "resource-stress",
    title: "Resource stress and leak tests",
    command: ["bun", "scripts/resource-stress.ts"],
    // MOVED FOR THE SAME REASON AS `perf-budgets` (am-7bkr, owner 2026-10-08), and it needs NO
    // build artefact: measured 2026-10-08 it runs in under a second from a cold tree and passes
    // 6 of 6 scenarios, each with a real duration -- 100-mount-unmount-lifecycle-leak-check
    // 89.61ms, wasm-memory-growth-generational-guard 4.41ms, and four more. So there is nothing
    // here that a missing build could make vacuous.
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/resource-stress.ts",
    },
    owner: "am-plat-resource-stress-9zgu",
  },
  // THE APPLE FAMILY IS NOT RUN BY CI, AND THAT IS THE DECISION RATHER THAN AN OVERSIGHT
  // (am-7bkr, 2026-09-22; am-app-apple-quality-gate-q6gs, 2026-09-23).
  //
  //   1. AGENTS.md, iPhone app chapter: "Apple validation runs locally as the `apple` gate
  //      family, not in the website's CI." dsr runs --family fast and --family browser, and
  //      neither selects these steps; scripts/quality-gates/workflowScan.test.ts refuses a
  //      workflow that invokes --family apple.
  //   2. Every step below has `requiredInCi: false` and no web release profile, so no web
  //      deploy waits on Xcode. src/testing/ciGateWiring.test.ts does not quantify over them.
  //   3. They start Xcode builds, which must never run on every dsr check.
  //
  // `cadence: every-run` is scoped within a local `bun run gates:apple`. The steps replace the
  // single entry that pointed at scripts/dsr-apple-quality.sh, a script that never existed, so
  // that entry could only ever report not-available.
  ...APPLE_STEPS.map(
    (step): GateStep => ({
      id: step.id,
      title: step.title,
      command: ["bun", "scripts/app/apple-quality.ts", "--step", step.id],
      family: "apple",
      cadence: "every-run",
      requiredInCi: false,
      notRequiredInCiReason:
        "AGENTS.md's iPhone app chapter: \"Apple validation runs locally as the `apple` gate family, not in the website's CI.\" dsr runs --family fast and --family browser and neither selects these steps, workflowScan.test.ts refuses a workflow that invokes --family apple, and they start Xcode builds that must never run on every dsr check. No web release profile lists them, so no website deploy waits on Xcode.",
      requiredInProfiles: [],
      availability: {
        scriptPath: "scripts/app/apple-quality.ts",
        tool: "xcodebuild",
        // am-dbuk, generalised from `ubs` to every separately obtained binary: without this, a
        // machine without Xcode refuses with "Required tool 'xcodebuild' was not found" and reads as
        // a broken app gate rather than an absent toolchain.
        toolHint:
          "xcodebuild ships with Xcode and is NOT installed by this repository. Its absence means Xcode is not present on this machine - it is NOT a finding about the iOS app, and no Apple check has run. AGENTS.md puts the apple family on a local lane that never gates a website release (requiredInCi is false and no web profile lists these steps), so a website deploy is unaffected. Install Xcode from the App Store, or run the website gates with --family fast.",
      },
      owner: "am-app-apple-quality-gate-q6gs",
    }),
  ),
];

export interface RegistryValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validates a quality gate step registry.
 * Rejects duplicate IDs, unknown families, unknown profiles, unknown cadences,
 * empty commands, and steps missing an owner.
 */
export function validateRegistry(steps: readonly GateStep[]): RegistryValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  const validFamilies = new Set<string>(KNOWN_FAMILIES);
  const validCadences = new Set<string>(KNOWN_CADENCES);
  const validProfiles = new Set<string>(KNOWN_PROFILES);

  for (const [idx, step] of steps.entries()) {
    if (!step) continue;
    const prefix = `Step #${idx + 1} (${step.id || "unnamed"})`;

    if (!step.id || step.id.trim().length === 0) {
      errors.push(`${prefix}: step id cannot be empty.`);
    } else if (seenIds.has(step.id)) {
      errors.push(`Duplicate step id '${step.id}' found.`);
    } else {
      seenIds.add(step.id);
    }

    if (!step.title || step.title.trim().length === 0) {
      errors.push(`${prefix}: step title cannot be empty.`);
    }

    if (!step.command || step.command.length === 0) {
      errors.push(`${prefix}: step command must contain at least one argument.`);
    }

    if (!validFamilies.has(step.family)) {
      errors.push(
        `${prefix}: unknown family '${step.family}'. Expected one of: ${KNOWN_FAMILIES.join(", ")}.`,
      );
    }

    if (!validCadences.has(step.cadence)) {
      errors.push(
        `${prefix}: unknown cadence '${step.cadence}'. Expected one of: ${KNOWN_CADENCES.join(", ")}.`,
      );
    }

    if (!step.owner || step.owner.trim().length === 0) {
      errors.push(`${prefix}: step must have a non-empty owner bead id.`);
    }

    if (Array.isArray(step.requiredInProfiles)) {
      for (const profile of step.requiredInProfiles) {
        if (!validProfiles.has(profile)) {
          errors.push(
            `${prefix}: unknown profile '${profile}' in requiredInProfiles. Expected one of: ${KNOWN_PROFILES.join(", ")}.`,
          );
        }
      }
    } else {
      errors.push(`${prefix}: requiredInProfiles must be an array.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
