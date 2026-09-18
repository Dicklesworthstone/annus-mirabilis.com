/**
 * asupersync WASM Browser Profile Verifier and Failure Classifier.
 * Bead: am-fs-asupersync-wasm-profile-jaax.
 *
 * Verifies that asupersync's canonical wasm-browser-* profiles:
 * 1. Include `runtime-core` (so serde and core types resolve when default-features = false).
 * 2. Exclude `native-runtime` (which triggers compile_error! on wasm32).
 * 3. Preserve `runtime-core` and `native-runtime` in desktop-runtime-profile.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const CANONICAL_WASM_PROFILES = [
  "wasm-browser-minimal",
  "wasm-browser-dev",
  "wasm-browser-prod",
  "wasm-browser-deterministic",
] as const;

export type CanonicalWasmProfile = (typeof CANONICAL_WASM_PROFILES)[number];

export interface ProfileVerificationResult {
  readonly profile: string;
  readonly ok: boolean;
  readonly enables: readonly string[];
  readonly hasRuntimeCore: boolean;
  readonly hasNativeRuntime: boolean;
  readonly reason?: string | undefined;
}

export interface AsupersyncProfilesDiagnosis {
  readonly ok: boolean;
  readonly profiles: Record<string, ProfileVerificationResult>;
  readonly desktopProfileOk: boolean;
  readonly summary: string;
}

export type AsupersyncWasmFailureClass =
  | "forbidden-native-runtime"
  | "missing-runtime-core"
  | "linked"
  | "other";

/**
 * Parse the [features] table of a Cargo.toml into a map of feature -> enabled features.
 */
export function parseCargoFeatures(cargoTomlContent: string): Map<string, string[]> {
  const features = new Map<string, string[]>();
  let inFeatures = false;

  for (const line of cargoTomlContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      inFeatures = trimmed === "[features]";
      continue;
    }
    if (!inFeatures || trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const name = trimmed.slice(0, eqIdx).trim();
    const rest = trimmed.slice(eqIdx + 1).trim();

    const start = rest.indexOf("[");
    const end = rest.lastIndexOf("]");
    if (start === -1 || end === -1 || end < start) continue;

    const body = rest.slice(start + 1, end).trim();
    const enables = body.length === 0
      ? []
      : body
          .split(",")
          .map((item) => item.trim().replace(/^["']|["']$/g, ""))
          .filter((item) => item.length > 0);

    features.set(name, enables);
  }

  return features;
}

/**
 * Validate a single wasm browser profile against self-sufficiency invariants.
 */
export function validateWasmBrowserProfile(
  features: Map<string, string[]>,
  profile: string,
): ProfileVerificationResult {
  const enables = features.get(profile);
  if (enables === undefined) {
    return {
      profile,
      ok: false,
      enables: [],
      hasRuntimeCore: false,
      hasNativeRuntime: false,
      reason: `Profile '${profile}' is not defined in [features] table`,
    };
  }

  const hasRuntimeCore = enables.includes("runtime-core");
  const hasNativeRuntime = enables.includes("native-runtime");

  if (!hasRuntimeCore) {
    return {
      profile,
      ok: false,
      enables,
      hasRuntimeCore: false,
      hasNativeRuntime,
      reason: `Profile '${profile}' omits 'runtime-core'. Consumers asking for '${profile}' with default-features = false cannot resolve serde and fail with unresolved import errors.`,
    };
  }

  if (hasNativeRuntime) {
    return {
      profile,
      ok: false,
      enables,
      hasRuntimeCore,
      hasNativeRuntime: true,
      reason: `Profile '${profile}' enables 'native-runtime', which is forbidden on wasm32 and triggers compile_error! at asupersync/src/lib.rs:129.`,
    };
  }

  return {
    profile,
    ok: true,
    enables,
    hasRuntimeCore: true,
    hasNativeRuntime: false,
  };
}

/**
 * Diagnose all canonical wasm browser profiles plus desktop-runtime-profile.
 */
export function diagnoseAsupersyncProfiles(cargoTomlContent: string): AsupersyncProfilesDiagnosis {
  const features = parseCargoFeatures(cargoTomlContent);
  const profiles: Record<string, ProfileVerificationResult> = {};
  let allOk = true;

  for (const profile of CANONICAL_WASM_PROFILES) {
    const res = validateWasmBrowserProfile(features, profile);
    profiles[profile] = res;
    if (!res.ok) allOk = false;
  }

  // Verify desktop-runtime-profile retains both runtime-core and native-runtime
  const desktopEnables = features.get("desktop-runtime-profile") ?? [];
  const desktopHasRuntimeCore = desktopEnables.includes("runtime-core");
  const desktopHasNativeRuntime = desktopEnables.includes("native-runtime");
  const desktopProfileOk = desktopHasRuntimeCore && desktopHasNativeRuntime;
  if (!desktopProfileOk) allOk = false;

  const summary = allOk
    ? "All wasm-browser profiles are self-sufficient (include runtime-core, exclude native-runtime) and desktop profile is preserved."
    : `WASM profile defects detected: ${Object.values(profiles)
        .filter((p) => !p.ok)
        .map((p) => `${p.profile}: ${p.reason}`)
        .join("; ")}`;

  return {
    ok: allOk,
    profiles,
    desktopProfileOk,
    summary,
  };
}

export function getDefaultAsupersyncDir(): string {
  return process.env.ASUPERSYNC_DIR
    ? resolve(process.env.ASUPERSYNC_DIR)
    : resolve(process.cwd(), "../asupersync");
}

export function getDefaultFrankensimDir(): string {
  return process.env.FRANKENSIM_DIR
    ? resolve(process.env.FRANKENSIM_DIR)
    : resolve(process.cwd(), "../frankensim");
}

/**
 * Verify asupersync profiles from a file path (defaults to standard sibling path).
 */
export function verifyAsupersyncManifest(
  manifestPath?: string,
): AsupersyncProfilesDiagnosis | null {
  const target = manifestPath ?? resolve(getDefaultAsupersyncDir(), "Cargo.toml");
  const resolved = resolve(target);
  if (!existsSync(resolved)) {
    return null;
  }
  const text = readFileSync(resolved, "utf8");
  return diagnoseAsupersyncProfiles(text);
}

/**
 * Classify compile transcript failures related to asupersync wasm profiles.
 */
export function classifyAsupersyncWasmFailure(transcript: string): AsupersyncWasmFailureClass {
  if (
    /Finished\s+`dev`\s+profile/.test(transcript) &&
    !/error:/.test(transcript) &&
    !/compile_error!/.test(transcript)
  ) {
    return "linked";
  }
  if (
    /feature `native-runtime` is forbidden on wasm32 browser builds/.test(transcript) ||
    /compile_error!\("feature `native-runtime` is forbidden/.test(transcript)
  ) {
    return "forbidden-native-runtime";
  }
  if (
    (/cannot find module or crate `serde`/.test(transcript) ||
      /unresolved import `serde`/.test(transcript) ||
      /cannot find derive macro `Serialize`/.test(transcript) ||
      /cannot find derive macro `Deserialize`/.test(transcript)) &&
    /asupersync/.test(transcript)
  ) {
    return "missing-runtime-core";
  }
  return "other";
}

/**
 * Six sibling WASM crates declared in the bead prediction.
 */
export const SIBLING_WASM_CRATES = [
  "fs-goddard-wasm",
  "fs-flyer-wasm",
  "fs-cmaes-viz-wasm",
  "fs-crump-wasm",
  "fs-edison-wasm",
  "fs-wasm",
] as const;

export type SiblingWasmCrate = (typeof SIBLING_WASM_CRATES)[number];

export interface SiblingCrateManifestCheck {
  readonly crate: string;
  readonly exists: boolean;
  readonly declaresWasmBrowserProd: boolean;
  readonly defaultFeaturesFalse: boolean;
  readonly path?: string | undefined;
  readonly rawDependencyLine?: string | undefined;
}

export interface SiblingWasmAuditResult {
  readonly ok: boolean;
  readonly allCratesDeclared: boolean;
  readonly refutationRecorded: boolean;
  readonly crates: Record<string, SiblingCrateManifestCheck>;
  readonly refutationDetails?: string | undefined;
}

/**
 * Inspect a sibling crate's Cargo.toml for the bare wasm-browser-prod dependency.
 */
export function checkSiblingWasmManifest(
  crate: string,
  frankensimRoot?: string,
): SiblingCrateManifestCheck {
  const root = frankensimRoot ?? getDefaultFrankensimDir();
  const manifestPath = resolve(root, "crates", crate, "Cargo.toml");
  if (!existsSync(manifestPath)) {
    return {
      crate,
      exists: false,
      declaresWasmBrowserProd: false,
      defaultFeaturesFalse: false,
    };
  }

  const content = readFileSync(manifestPath, "utf8");
  const asupersyncLine = content
    .split("\n")
    .map((l) => l.trim())
    .find((l) => !l.startsWith("#") && l.includes("asupersync") && l.includes("wasm-browser-prod"));

  const declaresWasmBrowserProd =
    asupersyncLine !== undefined && asupersyncLine.includes("wasm-browser-prod");
  const defaultFeaturesFalse =
    asupersyncLine !== undefined &&
    /default-features\s*=\s*false/.test(asupersyncLine);

  return {
    crate,
    exists: true,
    declaresWasmBrowserProd,
    defaultFeaturesFalse,
    path: manifestPath,
    rawDependencyLine: asupersyncLine?.trim(),
  };
}

/**
 * Audit all six sibling wasm crates and verify the written refutation in FRANKENSIM_BINDING.md.
 */
export function verifySiblingWasmCrates(
  frankensimRoot?: string,
  bindingDocPath = "docs/FRANKENSIM_BINDING.md",
): SiblingWasmAuditResult {
  const root = frankensimRoot ?? getDefaultFrankensimDir();
  const crates: Record<string, SiblingCrateManifestCheck> = {};
  let allCratesDeclared = true;

  for (const crate of SIBLING_WASM_CRATES) {
    const res = checkSiblingWasmManifest(crate, root);
    crates[crate] = res;
    if (!res.exists || !res.declaresWasmBrowserProd || !res.defaultFeaturesFalse) {
      allCratesDeclared = false;
    }
  }

  // Verify refutation in writing
  const docResolved = resolve(bindingDocPath);
  let refutationRecorded = false;
  let refutationDetails: string | undefined;

  if (existsSync(docResolved)) {
    const docText = readFileSync(docResolved, "utf8");
    const hasSection = docText.includes("4.13") && docText.includes("am-fs-asupersync-wasm-profile-jaax");
    const hasRefutation =
      docText.includes("REFUTED") &&
      docText.includes("bare `wasm-browser-prod`") &&
      docText.includes("fs-goddard-wasm");
    refutationRecorded = hasSection && hasRefutation;
    if (refutationRecorded) {
      refutationDetails = "Formal prediction refutation documented in docs/FRANKENSIM_BINDING.md §4.13.";
    }
  }

  return {
    ok: allCratesDeclared && refutationRecorded,
    allCratesDeclared,
    refutationRecorded,
    crates,
    refutationDetails,
  };
}

export interface CargoTreeFeatureCheck {
  readonly ok: boolean;
  readonly target: string;
  readonly forbiddenFeature: string;
  readonly occurrences: number;
  readonly matchingLines: readonly string[];
}

/**
 * Verify that cargo tree output for wasm32 excludes forbidden features (such as native-runtime).
 */
export function verifyCargoTreeFeatureAbsence(
  treeOutput: string,
  forbiddenFeature = "native-runtime",
  target = "wasm32-unknown-unknown",
): CargoTreeFeatureCheck {
  const lines = treeOutput.split("\n");
  const matchingLines: string[] = [];

  for (const line of lines) {
    if (line.includes(forbiddenFeature)) {
      matchingLines.push(line.trim());
    }
  }

  return {
    ok: matchingLines.length === 0,
    target,
    forbiddenFeature,
    occurrences: matchingLines.length,
    matchingLines,
  };
}

export interface CommandAuditRecord {
  readonly commandId: string;
  readonly command: string;
  readonly exitCode: number;
  readonly isInfrastructureFailure?: boolean | undefined;
  readonly retryOf?: string | undefined;
  readonly rationale?: string | undefined;
}

export interface CommandRetryDisciplineResult {
  readonly ok: boolean;
  readonly violations: readonly string[];
  readonly totalCommands: number;
  readonly infrastructureRetries: number;
}

/**
 * Verify that command execution adheres to honest retry discipline:
 * - Failing compilation commands (exit 101 or rustc errors) are never retried to manufacture green.
 * - Infrastructure retries (exit 103, worker slots) document deliberate variation.
 */
export function verifyCommandRetryDiscipline(
  records: readonly CommandAuditRecord[],
): CommandRetryDisciplineResult {
  const violations: string[] = [];
  let infrastructureRetries = 0;
  const commandMap = new Map<string, CommandAuditRecord>();

  for (const record of records) {
    commandMap.set(record.commandId, record);

    if (record.retryOf) {
      const parent = commandMap.get(record.retryOf);
      if (parent) {
        if (!parent.isInfrastructureFailure && parent.exitCode !== 0) {
          violations.push(
            `Command '${record.commandId}' retried failing non-infrastructure command '${parent.commandId}' (exit ${parent.exitCode}) violating non-retry discipline.`,
          );
        } else if (parent.isInfrastructureFailure) {
          infrastructureRetries++;
          if (!record.rationale) {
            violations.push(
              `Infrastructure retry '${record.commandId}' of '${parent.commandId}' lacks documented rationale or parameter variation.`,
            );
          }
        }
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    totalCommands: records.length,
    infrastructureRetries,
  };
}

