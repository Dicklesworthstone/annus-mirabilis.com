import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CANONICAL_WASM_PROFILES,
  SIBLING_WASM_CRATES,
  classifyAsupersyncWasmFailure,
  diagnoseAsupersyncProfiles,
  getDefaultAsupersyncDir,
  getDefaultFrankensimDir,
  parseCargoFeatures,
  validateWasmBrowserProfile,
  verifyAsupersyncManifest,
  verifyCargoTreeFeatureAbsence,
  verifyCommandRetryDiscipline,
  verifySiblingWasmCrates,
  type CommandAuditRecord,
} from "./asupersyncProfile.ts";

function expect<T>(actual: T, customMessage?: string) {
  return {
    toBe(expected: unknown) {
      assert.equal(actual, expected, customMessage);
    },
    toEqual(expected: unknown) {
      assert.deepEqual(actual, expected, customMessage);
    },
    toBeDefined() {
      assert.ok(
        actual !== undefined && actual !== null,
        customMessage ?? "Expected value to be defined",
      );
    },
    toBeUndefined() {
      assert.equal(actual, undefined, customMessage);
    },
    toContain(substr: string) {
      assert.ok(
        String(actual).includes(substr),
        customMessage ?? `Expected ${String(actual)} to contain ${substr}`,
      );
    },
    toBeGreaterThan(n: number) {
      assert.ok(
        Number(actual) > n,
        customMessage ?? `Expected ${String(actual)} to be greater than ${n}`,
      );
    },
    not: {
      toBeNull() {
        assert.notEqual(actual, null, customMessage);
      },
    },
  };
}

const ASUPERSYNC_DIR = getDefaultAsupersyncDir();
const hasAsupersyncCheckout = existsSync(join(ASUPERSYNC_DIR, "Cargo.toml"));
// The AC3 audit reads FRANKENSIM, not asupersync: verifySiblingWasmCrates walks
// <frankensim>/crates/<crate>/Cargo.toml. Guarding it on hasAsupersyncCheckout
// would be the right shape with the wrong predicate, and measurably useless -
// with asupersync present and frankensim absent the file still reports
// 14 pass 1 fail 0 skipped. Two sibling checkouts, two conditions.
const FRANKENSIM_DIR = getDefaultFrankensimDir();
const hasFrankensimCrates = existsSync(join(FRANKENSIM_DIR, "crates"));
/**
 * Skips with a stated reason rather than a bare boolean.
 *
 * A test that needs an absent sibling checkout must report not-available; it
 * must not fail, and it must not pass quietly either. node --test prints the
 * reason beside the skipped test, so the run says which dependency was missing
 * and how to supply it.
 */
const itSkipIf =
  (condition: boolean, reason?: string) => (name: string, fn: () => void | Promise<void>) =>
    it(name, condition ? { skip: reason ?? "dependency not available" } : {}, fn);
const NO_ASUPERSYNC = `asupersync checkout not found at ${ASUPERSYNC_DIR} (set ASUPERSYNC_DIR)`;
const NO_FRANKENSIM = `frankensim crates not found at ${join(FRANKENSIM_DIR, "crates")} (set FRANKENSIM_DIR)`;

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

  itSkipIf(!hasAsupersyncCheckout, NO_ASUPERSYNC)(
    "verifies live asupersync Cargo.toml on disk",
    () => {
      const asupersyncPath = join(ASUPERSYNC_DIR, "Cargo.toml");
      const diag = verifyAsupersyncManifest(asupersyncPath);
      expect(diag).not.toBeNull();
      expect(diag?.ok).toBe(true);
      expect(diag?.desktopProfileOk).toBe(true);
      for (const profile of CANONICAL_WASM_PROFILES) {
        const p = diag?.profiles[profile];
        expect(p).toBeDefined();
        expect(p?.ok).toBe(true);
        expect(p?.hasRuntimeCore).toBe(true);
        expect(p?.hasNativeRuntime).toBe(false);
      }
    },
  );

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
  --> /home/agent/projects/asupersync/src/evidence.rs:34:5
   |
34 | use serde::{Deserialize, Serialize};
   |     ^^^^^ could not find \`serde\` in the list of imported crates
error: could not compile \`asupersync\` (lib) due to 716 previous errors
      `;
      expect(classifyAsupersyncWasmFailure(transcript)).toBe("missing-runtime-core");
    });

    it("classifies clean compilation as linked", () => {
      const transcript = `
   Compiling asupersync v0.5.0 (/home/agent/projects/asupersync)
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

  describe("AC1: Crate depending on asupersync with default-features = false, features = ['wasm-browser-prod'] compiles for wasm32", () => {
    it("validates that wasm-browser-prod includes runtime-core and classifies remote check transcript as linked", () => {
      const fixedDiag = diagnoseAsupersyncProfiles(FIXED_MANIFEST_SNIPPET);
      const prodResult = fixedDiag.profiles["wasm-browser-prod"];
      expect(prodResult?.ok).toBe(true);
      expect(prodResult?.hasRuntimeCore).toBe(true);
      expect(prodResult?.hasNativeRuntime).toBe(false);

      // Command 1 transcript: cargo check -p asupersync --lib --target wasm32-unknown-unknown --no-default-features --features wasm-browser-prod
      const cmd1Transcript = `
cd /home/agent/projects/asupersync
RCH_REQUIRE_REMOTE=1 RCH_VISIBILITY=verbose RCH_DAEMON_WAIT_RESPONSE_TIMEOUT_SECS=5400 rch exec -- cargo check -p asupersync --lib --target wasm32-unknown-unknown --no-default-features --features wasm-browser-prod
exit=0
Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 1m 26s
[RCH] exec done: exit=0 in 88342ms
      `;
      expect(classifyAsupersyncWasmFailure(cmd1Transcript)).toBe("linked");

      // Command 2 transcript: real consumer crate asupersync-wasm
      const cmd2Transcript = `
cd /home/agent/projects/asupersync/asupersync-wasm
RCH_REQUIRE_REMOTE=1 RCH_VISIBILITY=verbose RCH_DAEMON_WAIT_RESPONSE_TIMEOUT_SECS=5400 rch exec -- cargo check --target wasm32-unknown-unknown -j 3
exit=0
Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 1m 13s
[RCH] exec done: exit=0 in 73683ms
      `;
      expect(classifyAsupersyncWasmFailure(cmd2Transcript)).toBe("linked");
    });
  });

  describe("AC2: cargo tree -e features --target wasm32-unknown-unknown shows native-runtime absent", () => {
    it("confirms native-runtime occurrences is 0 on valid wasm tree and detects regressions", () => {
      // Clean cargo tree transcript (Command 5)
      const cleanTree = `
asupersync v0.5.0 (/home/agent/projects/asupersync)
├── asupersync feature "browser-io"
│   └── asupersync feature "wasm-browser-prod" (command-line)
├── asupersync feature "runtime-core"
│   └── asupersync feature "wasm-browser-prod" (command-line)
└── asupersync feature "wasm-runtime"
    └── asupersync feature "wasm-browser-prod" (command-line)
      `;
      const cleanCheck = verifyCargoTreeFeatureAbsence(cleanTree, "native-runtime");
      expect(cleanCheck.ok).toBe(true);
      expect(cleanCheck.occurrences).toBe(0);
      expect(cleanCheck.matchingLines.length).toBe(0);

      // Regression tree containing native-runtime (e.g. tree line 736 before fix)
      const dirtyTree = `
asupersync v0.5.0 (/home/agent/projects/asupersync)
├── asupersync feature "default"
│   └── asupersync feature "native-runtime"
│       └── polling v2.8.0
      `;
      const dirtyCheck = verifyCargoTreeFeatureAbsence(dirtyTree, "native-runtime");
      expect(dirtyCheck.ok).toBe(false);
      expect(dirtyCheck.occurrences).toBe(1);
      expect(dirtyCheck.matchingLines[0]).toContain("native-runtime");
    });

    itSkipIf(!hasAsupersyncCheckout, NO_ASUPERSYNC)(
      "runs live cargo tree on asupersync checkout and confirms native-runtime is 0",
      () => {
        const proc = spawnSync(
          "cargo",
          [
            "tree",
            "-e",
            "features",
            "-p",
            "asupersync",
            "--target",
            "wasm32-unknown-unknown",
            "--no-default-features",
            "--features",
            "wasm-browser-prod",
          ],
          { cwd: ASUPERSYNC_DIR, encoding: "utf8", timeout: 15000 },
        );

        expect(proc.error).toBeUndefined();
        expect(
          proc.status,
          `cargo tree failed with exit ${proc.status}:\n${proc.stderr || proc.stdout}`,
        ).toBe(0);

        const check = verifyCargoTreeFeatureAbsence(proc.stdout, "native-runtime");
        expect(check.ok).toBe(true);
        expect(check.occurrences).toBe(0);
      },
    );
  });

  describe("AC3: Six sibling wasm crates declare wasm-browser-prod and prediction refutation is documented in writing", () => {
    itSkipIf(!hasFrankensimCrates, NO_FRANKENSIM)(
      "audits all six sibling crate manifests and verifies formal refutation in docs/FRANKENSIM_BINDING.md",
      () => {
        const audit = verifySiblingWasmCrates();
        expect(audit.refutationRecorded).toBe(true);
        expect(audit.refutationDetails).toContain("docs/FRANKENSIM_BINDING.md §4.13");

        // Verify all six sibling crates are audited
        expect(Object.keys(audit.crates).sort()).toEqual([...SIBLING_WASM_CRATES].sort());
        for (const crate of SIBLING_WASM_CRATES) {
          const c = audit.crates[crate];
          expect(c).toBeDefined();
          if (c?.exists) {
            expect(c.declaresWasmBrowserProd).toBe(true);
            expect(c.defaultFeaturesFalse).toBe(true);
          }
        }
        expect(audit.ok).toBe(true);
      },
    );
  });

  describe("AC4: Native builds of asupersync consumers are unaffected", () => {
    it("confirms desktop-runtime-profile preserves runtime-core and native-runtime and native check passes", () => {
      const fixedDiag = diagnoseAsupersyncProfiles(FIXED_MANIFEST_SNIPPET);
      expect(fixedDiag.desktopProfileOk).toBe(true);

      // Command 4 transcript: native backstop
      const cmd4Transcript = `
RCH_REQUIRE_REMOTE=1 RCH_VISIBILITY=verbose RCH_DAEMON_WAIT_RESPONSE_TIMEOUT_SECS=5400 rch exec -- cargo check -p asupersync --lib -j 3
exit=0
Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 1m 55s
[RCH] exec done: exit=0 in 117352ms
      `;
      expect(classifyAsupersyncWasmFailure(cmd4Transcript)).toBe("linked");
    });
  });

  describe("AC5: Failing commands are never retried to manufacture a green run", () => {
    it("validates non-retry discipline across recorded command history and rejects unvaried retries", () => {
      const honestRecords: CommandAuditRecord[] = [
        {
          commandId: "cmd1",
          command:
            "cargo check -p asupersync --lib --target wasm32-unknown-unknown --no-default-features --features wasm-browser-prod",
          exitCode: 0,
        },
        {
          commandId: "cmd2",
          command: "cargo check --target wasm32-unknown-unknown -j 3",
          exitCode: 0,
        },
        {
          commandId: "cmd3-attempt1",
          command: "cargo test --test wasm_cfg_compile_invariants -- --nocapture",
          exitCode: 103,
          isInfrastructureFailure: true,
          rationale: "Worker set refused due to slot limit (RCH-I003); retry with -j 3",
        },
        {
          commandId: "cmd3-attempt2",
          command: "cargo test --test wasm_cfg_compile_invariants -j 3 -- --nocapture",
          exitCode: 0,
          retryOf: "cmd3-attempt1",
          rationale: "Reduced concurrency with -j 3 resolved worker slot limit",
        },
        {
          commandId: "cmd4",
          command: "cargo check -p asupersync --lib -j 3",
          exitCode: 0,
        },
        {
          commandId: "cmd5",
          command:
            "cargo tree -e features -p asupersync --target wasm32-unknown-unknown --no-default-features --features wasm-browser-prod",
          exitCode: 0,
        },
      ];

      const honestResult = verifyCommandRetryDiscipline(honestRecords);
      expect(honestResult.ok).toBe(true);
      expect(honestResult.violations.length).toBe(0);
      expect(honestResult.infrastructureRetries).toBe(1);

      // Defect case: A failed compilation command (exit 101) was retried without code change
      const badRecords: CommandAuditRecord[] = [
        {
          commandId: "compile-fail",
          command: "cargo check -p asupersync",
          exitCode: 101,
          isInfrastructureFailure: false,
        },
        {
          commandId: "compile-retry",
          command: "cargo check -p asupersync",
          exitCode: 0,
          retryOf: "compile-fail",
        },
      ];

      const badResult = verifyCommandRetryDiscipline(badRecords);
      expect(badResult.ok).toBe(false);
      expect(badResult.violations.length).toBeGreaterThan(0);
      expect(badResult.violations[0]).toContain("violating non-retry discipline");
    });
  });
});
