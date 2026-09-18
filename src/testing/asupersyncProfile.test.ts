import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import {
  CANONICAL_WASM_PROFILES,
  classifyAsupersyncWasmFailure,
  diagnoseAsupersyncProfiles,
  parseCargoFeatures,
  validateWasmBrowserProfile,
  verifyAsupersyncManifest,
} from "./asupersyncProfile.ts";

describe("asupersync WASM Browser Profile Verification (am-fs-asupersync-wasm-profile-jaax)", () => {
  const BUGGY_MANIFEST_SNIPPET = `
[features]
default = ["proc-macros", "nightly-outcome-try", "runtime-core", "native-runtime"]
runtime-core = ["dep:serde"]
desktop-runtime-profile = ["runtime-core", "native-runtime"]
wasm-browser-prod = ["wasm-runtime", "browser-io"]
wasm-browser-dev = ["wasm-runtime", "browser-io"]
wasm-browser-deterministic = ["wasm-runtime", "deterministic-mode", "browser-trace"]
wasm-browser-minimal = ["wasm-runtime"]
`;

  const FIXED_MANIFEST_SNIPPET = `
[features]
default = ["proc-macros", "nightly-outcome-try", "runtime-core", "native-runtime"]
runtime-core = ["dep:serde"]
native-runtime = ["dep:polling", "dep:socket2"]
desktop-runtime-profile = ["runtime-core", "native-runtime"]
wasm-browser-dev = ["wasm-runtime", "browser-io", "runtime-core"]
wasm-browser-prod = ["wasm-runtime", "browser-io", "runtime-core"]
wasm-browser-deterministic = ["wasm-runtime", "deterministic-mode", "browser-trace", "runtime-core"]
wasm-browser-minimal = ["wasm-runtime", "runtime-core"]
`;

  it("parseCargoFeatures parses [features] table and ignores comments/other sections", () => {
    const toml = `
[package]
name = "asupersync"
version = "0.5.0"

[features]
# Comment line
runtime-core = ["dep:serde"]
wasm-browser-prod = ["wasm-runtime", "browser-io", "runtime-core"]

[dependencies]
serde = { version = "1.0", optional = true }
`;
    const features = parseCargoFeatures(toml);
    expect(features.get("runtime-core")).toEqual(["dep:serde"]);
    expect(features.get("wasm-browser-prod")).toEqual([
      "wasm-runtime",
      "browser-io",
      "runtime-core",
    ]);
    expect(features.has("name")).toBe(false);
    expect(features.has("serde")).toBe(false);
  });

  it("identifies the defect where wasm-browser-prod omits runtime-core", () => {
    const features = parseCargoFeatures(BUGGY_MANIFEST_SNIPPET);
    const prodResult = validateWasmBrowserProfile(features, "wasm-browser-prod");

    expect(prodResult.ok).toBe(false);
    expect(prodResult.hasRuntimeCore).toBe(false);
    expect(prodResult.hasNativeRuntime).toBe(false);
    expect(prodResult.reason).toContain("omits 'runtime-core'");
    expect(prodResult.reason).toContain("cannot resolve serde");

    const diag = diagnoseAsupersyncProfiles(BUGGY_MANIFEST_SNIPPET);
    expect(diag.ok).toBe(false);
    expect(diag.profiles["wasm-browser-prod"]?.ok).toBe(false);
    expect(diag.profiles["wasm-browser-dev"]?.ok).toBe(false);
    expect(diag.profiles["wasm-browser-minimal"]?.ok).toBe(false);
  });

  it("identifies forbidden native-runtime feature if present on wasm profiles", () => {
    const features = new Map<string, string[]>([
      ["wasm-browser-prod", ["wasm-runtime", "browser-io", "runtime-core", "native-runtime"]],
    ]);
    const result = validateWasmBrowserProfile(features, "wasm-browser-prod");
    expect(result.ok).toBe(false);
    expect(result.hasRuntimeCore).toBe(true);
    expect(result.hasNativeRuntime).toBe(true);
    expect(result.reason).toContain("enables 'native-runtime'");
    expect(result.reason).toContain("forbidden on wasm32");
  });

  it("validates that the fixed profile specification satisfies all invariants", () => {
    const diag = diagnoseAsupersyncProfiles(FIXED_MANIFEST_SNIPPET);
    expect(diag.ok).toBe(true);
    expect(diag.desktopProfileOk).toBe(true);

    for (const profile of CANONICAL_WASM_PROFILES) {
      const p = diag.profiles[profile];
      expect(p).toBeDefined();
      expect(p?.ok).toBe(true);
      expect(p?.hasRuntimeCore).toBe(true);
      expect(p?.hasNativeRuntime).toBe(false);
    }
  });

  it("verifies live asupersync Cargo.toml on disk if checkout exists", () => {
    const asupersyncPath = "/Users/jemanuel/projects/asupersync/Cargo.toml";
    if (!existsSync(asupersyncPath)) {
      return; // Skip gracefully if not in this environment
    }

    const diag = verifyAsupersyncManifest(asupersyncPath);
    expect(diag).not.toBeNull();
    if (diag) {
      expect(diag.ok).toBe(true);
      expect(diag.desktopProfileOk).toBe(true);
      for (const profile of CANONICAL_WASM_PROFILES) {
        const p = diag.profiles[profile];
        expect(p).toBeDefined();
        expect(p?.ok).toBe(true);
        expect(p?.hasRuntimeCore).toBe(true);
        expect(p?.hasNativeRuntime).toBe(false);
      }
    }
  });

  describe("classifyAsupersyncWasmFailure", () => {
    it("classifies compile_error! native-runtime as forbidden-native-runtime", () => {
      const transcript = `
error: feature \`native-runtime\` is forbidden on wasm32 browser builds.
   --> .../asupersync/src/lib.rs:129:1
   |
129 | compile_error!("feature \`native-runtime\` is forbidden on wasm32 browser builds.");
      `;
      expect(classifyAsupersyncWasmFailure(transcript)).toBe("forbidden-native-runtime");
    });

    it("classifies unresolved import serde inside asupersync as missing-runtime-core", () => {
      const transcript = `
error[E0432]: unresolved import \`serde\`
  --> /Users/jemanuel/projects/asupersync/src/evidence.rs:34:5
   |
34 | use serde::{Deserialize, Serialize};
   |     ^^^^^ could not find \`serde\` in the list of imported crates
error: could not compile \`asupersync\` (lib) due to 716 previous errors
      `;
      expect(classifyAsupersyncWasmFailure(transcript)).toBe("missing-runtime-core");
    });

    it("classifies clean compilation as linked", () => {
      const transcript = `
   Compiling asupersync v0.5.0 (/Users/jemanuel/projects/asupersync)
    Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 1m 26s
      `;
      expect(classifyAsupersyncWasmFailure(transcript)).toBe("linked");
    });

    it("classifies unrelated errors as other", () => {
      const transcript = `
error: failed to load manifest for dependency \`fsqlite\`
Caused by: No such file or directory (os error 2)
      `;
      expect(classifyAsupersyncWasmFailure(transcript)).toBe("other");
    });
  });
});
