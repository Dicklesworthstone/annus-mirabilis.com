/**
 * Quality Gates Registry for annus-mirabilis.com
 *
 * Defines the single, typed, canonical quality gate chain used by:
 * - Local CLI runner (`bun run gates` / `bun scripts/quality-gates.ts`)
 * - GitHub Actions CI workflows (`.github/workflows/quality-gates.yml`, `.github/workflows/nightly-gates.yml`)
 * - Publication release script (`am-rel-verified-deploy-qndt`)
 *
 * Requirements:
 * - Never weaken a gate.
 * - Missing/unbuilt scripts report `not-available` and are never counted as passing.
 * - Profile runs (`--profile <scaffold|preview|launch>`) fail with exit code 2 if any required step is unavailable.
 */

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
}

export interface GateStep {
  readonly id: string;
  readonly title: string;
  readonly command: readonly string[];
  readonly family: GateFamily;
  readonly cadence: GateCadence;
  readonly requiredInCi: boolean;
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
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "scripts/check-stashes.ts",
      tool: "git",
    },
    owner: "am-70ig",
  },
  // 6. Ultimate Bug Scanner (diff mode)
  {
    id: "ubs-diff",
    title: "Ultimate Bug Scanner (diff)",
    command: ["ubs", "--diff"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: false,
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
    //   - requiredInCi stays true and stays meaningful: quality-gates.ts:455 exempts a step
    //     skipped for cadence (`r.reason !== "cadence"`), so this does not silently downgrade a
    //     required step, it declines to run it on the routine cadence.
    //
    // This is reversible in one word. When am-cm-coverage-ledger-0ip wires a loader and something
    // emits scenario evidence, put cadence back to every-run and pass the path in `command`.
    id: "coverage-report",
    title: "Multi-dimensional coverage ledger report",
    command: ["bun", "scripts/coverage-report.ts"],
    family: "fast",
    cadence: "nightly",
    requiredInCi: true,
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
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/verify-facsimile-pins.ts",
      tool: "pdftoppm",
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
    family: "perf",
    cadence: "nightly",
    requiredInCi: false,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/run-perf-budgets.ts",
    },
    owner: "am-plat-perf-budgets-s3ww",
  },
  {
    id: "resource-stress",
    title: "Resource stress and leak tests",
    command: ["bun", "scripts/resource-stress.ts"],
    family: "perf",
    cadence: "nightly",
    requiredInCi: false,
    requiredInProfiles: ["preview", "launch"],
    availability: {
      scriptPath: "scripts/resource-stress.ts",
    },
    owner: "am-plat-resource-stress-9zgu",
  },
  {
    // NOT RUN BY CI, AND THAT IS THE DECISION RATHER THAN AN OVERSIGHT (am-7bkr, 2026-09-22).
    //
    // Measured that day with the CI's own flags: `--fail-fast --family fast --only apple-quality`
    // and the same with `--family browser` both report Selected Steps: 0. So nothing dsr runs
    // reaches this step, exactly as browser-acceptance was unreached - and unlike that one, it is
    // correct here, for three reasons that are each checkable:
    //
    //   1. AGENTS.md, iPhone app chapter, verbatim: "Apple validation runs locally as the `apple`
    //      gate family, not in the website's CI."
    //   2. `requiredInCi: false` below. browser-acceptance's defect was a gate declaring TRUE
    //      while nothing ran it; this one has never claimed CI would run it, which is why
    //      src/testing/ciGateWiring.test.ts does not quantify over it.
    //   3. scripts/dsr-apple-quality.sh does not exist on disk and neither does ios/. Wiring it
    //      today would add a permanent not-available row to every run, and wiring it after the
    //      script lands would start an Xcode build on every dsr check, against rule 1.
    //
    // `cadence: every-run` is scoped WITHIN a run of the apple family, which is a local
    // `--family apple` invocation. It does not claim that CI runs this every time.
    id: "apple-quality",
    title: "Apple local quality gate (Xcode / SwiftUI)",
    command: ["bash", "scripts/dsr-apple-quality.sh"],
    family: "apple",
    cadence: "every-run",
    requiredInCi: false,
    requiredInProfiles: [],
    availability: {
      scriptPath: "scripts/dsr-apple-quality.sh",
      tool: "xcodebuild",
    },
    owner: "am-app-apple-quality-gate-q6gs",
  },
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
