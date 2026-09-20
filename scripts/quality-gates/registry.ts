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
  // 2. Typecheck (TypeScript compiler)
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
    id: "coverage-report",
    title: "Multi-dimensional coverage ledger report",
    command: ["bun", "scripts/coverage-report.ts"],
    family: "fast",
    cadence: "every-run",
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
    title: "Browser acceptance E2E vertical slices",
    command: ["bun", "scripts/e2e-paper-vertical-slices.ts"],
    family: "browser",
    cadence: "every-run",
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
