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
  readonly reason?: string;
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

/**
 * Verify asupersync profiles from a file path (defaults to standard sibling path).
 */
export function verifyAsupersyncManifest(
  manifestPath = "/Users/jemanuel/projects/asupersync/Cargo.toml",
): AsupersyncProfilesDiagnosis | null {
  const resolved = resolve(manifestPath);
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
