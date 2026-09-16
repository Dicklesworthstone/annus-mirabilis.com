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
    command: ["bun", "x", "tsc", "--noEmit"],
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
    command: ["bun", "x", "@biomejs/biome", "check"],
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
    command: ["bun", "x", "@biomejs/biome", "format"],
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
    command: ["bun", "scripts/quality-gates/test-runner.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "scripts/quality-gates/test-runner.ts",
    },
    owner: "am-scaf-quality-gates-ci-4xx",
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
    },
    owner: "am-scaf-quality-gates-ci-4xx",
  },
  // 8. Build (Next.js production build - kept last among initial fast gates)
  {
    id: "build",
    title: "Next.js production build",
    command: ["bun", "x", "next", "build"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["scaffold", "preview", "launch"],
    availability: {
      scriptPath: "next.config.ts",
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
    title: "Editorial voice lint",
    command: ["bun", "scripts/lint-voice.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: true,
    requiredInProfiles: ["preview", "launch"],
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

  for (let idx = 0; idx < steps.length; idx++) {
    const step = steps[idx];
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
