/**
 * Test suite for third-party license inventory and verification.
 * Bead: am-gov-license-inventory-w6yz
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { validateDonorAttributionHeader } from "./license-inventory/collectDonor.ts";
import { collectFonts } from "./license-inventory/collectFonts.ts";
import { collectWasm } from "./license-inventory/collectWasm.ts";
import { evaluatePolicy } from "./license-inventory/evaluatePolicy.ts";
import {
  buildLicenseInventory,
  type FilesystemAdapters,
  runLicenseInventoryCheck,
} from "./license-inventory/index.ts";
import { renderNotices } from "./license-inventory/renderNotices.ts";
import { checkSpdxExpression, parseSpdx } from "./license-inventory/spdx.ts";
import type { LicenseItem, LicensePolicy } from "./license-inventory/types.ts";

const BASE_POLICY: LicensePolicy = {
  allowlist: [
    "MIT",
    "ISC",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "Apache-2.0",
    "0BSD",
    "BlueOak-1.0.0",
    "CC0-1.0",
    "OFL-1.1",
    "MIT with OpenAI/Anthropic Rider",
  ],
  exceptions: [],
};

describe("SPDX parser and evaluator", () => {
  test("evaluates simple identifiers against allowlist", () => {
    expect(checkSpdxExpression("MIT", BASE_POLICY.allowlist).allowed).toBe(true);
    expect(checkSpdxExpression("Apache-2.0", BASE_POLICY.allowlist).allowed).toBe(true);
    expect(checkSpdxExpression("GPL-3.0-only", BASE_POLICY.allowlist).allowed).toBe(false);
  });

  test("evaluates OR expressions correctly (passes if any branch allowed)", () => {
    const res = checkSpdxExpression("(MIT OR Apache-2.0)", BASE_POLICY.allowlist);
    expect(res.allowed).toBe(true);

    const res2 = checkSpdxExpression("(GPL-3.0-only OR MIT)", BASE_POLICY.allowlist);
    expect(res2.allowed).toBe(true);

    const res3 = checkSpdxExpression("(GPL-3.0-only OR AGPL-3.0-only)", BASE_POLICY.allowlist);
    expect(res3.allowed).toBe(false);
  });

  test("evaluates AND expressions correctly (requires every term)", () => {
    const pass = checkSpdxExpression("MIT AND Apache-2.0", BASE_POLICY.allowlist);
    expect(pass.allowed).toBe(true);

    const fail = checkSpdxExpression("MIT AND CC-BY-NC-4.0", BASE_POLICY.allowlist);
    expect(fail.allowed).toBe(false);
    expect(fail.failingLicenses).toContain("CC-BY-NC-4.0");
  });

  test("handles nested parentheses and complex combinations", () => {
    const expr = "((MIT OR GPL-2.0) AND (BSD-3-Clause OR AGPL-3.0))";
    const res = checkSpdxExpression(expr, BASE_POLICY.allowlist);
    expect(res.allowed).toBe(true);
  });

  test("handles WITH exceptions and parses correctly", () => {
    const ast = parseSpdx("Apache-2.0 WITH LLVM-exception");
    expect(ast.type).toBe("with");
    expect(ast.exception).toBe("LLVM-exception");

    const res = checkSpdxExpression("Apache-2.0 WITH LLVM-exception", BASE_POLICY.allowlist);
    expect(res.allowed).toBe(true);
  });

  test("rejects malformed SPDX expressions with readable syntax error", () => {
    expect(() => parseSpdx("(MIT OR Apache-2.0")).toThrow("Unbalanced parentheses");
    expect(() => parseSpdx("MIT OR")).toThrow();
    expect(() => parseSpdx("")).toThrow("Empty SPDX license expression");

    const checkRes = checkSpdxExpression("(MIT OR Apache-2.0", BASE_POLICY.allowlist);
    expect(checkRes.allowed).toBe(false);
    expect(checkRes.failingLicenses[0]).toContain("Malformed SPDX");
  });
});

describe("evaluatePolicy and exception handling", () => {
  test("production dependency with no license metadata fails naming package, version, and dependency chain", () => {
    const item: LicenseItem = {
      kind: "npm",
      name: "evil-unlicensed-lib",
      version: "1.2.3",
      license: "UNKNOWN",
      source: "node_modules/evil-unlicensed-lib",
      dependencyChain: ["top-dep", "mid-dep", "evil-unlicensed-lib"],
    };

    const result = evaluatePolicy([item], BASE_POLICY);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    const err = result.errors[0];
    expect(err.message).toContain("evil-unlicensed-lib");
    expect(err.message).toContain("1.2.3");
    expect(err.message).toContain("top-dep -> mid-dep -> evil-unlicensed-lib");
    expect(err.rule).toBe("missing-license-metadata");
  });

  test("GPL-3.0-only fails without exception and passes with complete reviewed exception", () => {
    const gplItem: LicenseItem = {
      kind: "npm",
      name: "gpl-package",
      version: "2.0.0",
      license: "GPL-3.0-only",
      source: "node_modules/gpl-package",
    };

    // 1. Without exception -> fails
    const failRes = evaluatePolicy([gplItem], BASE_POLICY);
    expect(failRes.valid).toBe(false);
    expect(failRes.errors[0].rule).toBe("disallowed-license");

    // 2. With valid complete exception -> passes
    const policyWithException: LicensePolicy = {
      ...BASE_POLICY,
      exceptions: [
        {
          package: "gpl-package",
          versionRange: "^2.0.0",
          reason: "Reviewed runtime exception for sandboxed helper",
          reviewer: "ReviewerName",
          date: "2026-09-17",
        },
      ],
    };
    const passRes = evaluatePolicy([gplItem], policyWithException);
    expect(passRes.valid).toBe(true);
    expect(passRes.errors.length).toBe(0);
  });

  test("an exception missing its reviewer or reason fails the check", () => {
    const policyMissingReviewer: LicensePolicy = {
      ...BASE_POLICY,
      exceptions: [
        {
          package: "some-pkg",
          versionRange: "*",
          reason: "Valid reason here",
          reviewer: "", // MISSING
          date: "2026-09-17",
        },
      ],
    };

    const res = evaluatePolicy([], policyMissingReviewer);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.rule === "exception-missing-reviewer")).toBe(true);

    const policyMissingReason: LicensePolicy = {
      ...BASE_POLICY,
      exceptions: [
        {
          package: "some-pkg",
          versionRange: "*",
          reason: "", // MISSING
          reviewer: "Alice",
          date: "2026-09-17",
        },
      ],
    };

    const res2 = evaluatePolicy([], policyMissingReason);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.rule === "exception-missing-reason")).toBe(true);
  });

  test("a devDependency with no license is listed under tools and does not fail the check", () => {
    const devTool: LicenseItem = {
      kind: "tool",
      name: "internal-dev-tool",
      version: "0.0.1",
      license: "UNKNOWN",
      source: "node_modules/internal-dev-tool",
    };

    const res = evaluatePolicy([devTool], BASE_POLICY);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.evaluatedItems[0].outcome).toBe("exempt");
  });
});

describe("Font and WASM collection", () => {
  test("a font file without a license file fails check", () => {
    const files = ["public/fonts/good-font/GoodFont.ttf", "public/fonts/bad-font/BadFont.ttf"];

    const mockFs = {
      "public/fonts/good-font/OFL.txt": "SIL OPEN FONT LICENSE Version 1.1",
      // bad-font has no license file!
    };

    const fontItems = collectFonts({
      rootDir: "/mock",
      fontFiles: files,
      readText: (p) => {
        for (const [k, v] of Object.entries(mockFs)) {
          if (p.endsWith(k)) return v;
        }
        return null;
      },
      exists: (p) => {
        for (const k of Object.keys(mockFs)) {
          if (p.endsWith(k)) return true;
        }
        return false;
      },
    });

    const badFont = fontItems.find((f) => f.name.includes("BadFont"));
    expect(badFont).toBeDefined();
    expect(badFont?.license).toBe("UNLICENSED");

    const evalRes = evaluatePolicy(fontItems, BASE_POLICY);
    expect(evalRes.valid).toBe(false);
    expect(evalRes.errors.some((e) => e.item.name.includes("BadFont"))).toBe(true);
  });

  test("a public/wasm/ file absent from public/wasm/manifest.json fails", () => {
    const manifest = {
      schemaVersion: 1,
      bundleId: "fs-annus-diffusion",
      bundleDir: "public/wasm/fs-annus-diffusion/105d7ffc15414de5",
      revisions: { frankensim: "5bbbfae6f7de614422f6f97f5798a3e00f8ad813" },
      files: {
        "fs_annus_diffusion_bg.wasm": { sha256: "abc", bytes: 154 },
      },
    };

    const wasmOnDisk = [
      "public/wasm/fs-annus-diffusion/105d7ffc15414de5/fs_annus_diffusion_bg.wasm",
      "public/wasm/unregistered_rogue_artifact.wasm", // ROGUE FILE
    ];

    const wasmItems = collectWasm({
      rootDir: "/mock",
      manifestJson: manifest,
      wasmFilesOnDisk: wasmOnDisk,
      readText: () => null,
    });

    const rogue = wasmItems.find((w) => w.source.includes("unregistered_rogue_artifact"));
    expect(rogue).toBeDefined();
    expect(rogue?.license).toBe("UNREGISTERED-WASM-ARTIFACT");

    const evalRes = evaluatePolicy(wasmItems, BASE_POLICY);
    expect(evalRes.valid).toBe(false);
    expect(evalRes.errors.some((e) => e.item.source.includes("unregistered_rogue_artifact"))).toBe(
      true,
    );
  });

  test("a manifest artifact without a license/revision entry fails", () => {
    const corruptManifest = {
      schemaVersion: 1,
      bundleId: "fs-broken",
      // revisions missing!
      files: {},
    };

    const wasmItems = collectWasm({
      rootDir: "/mock",
      manifestJson: corruptManifest,
      wasmFilesOnDisk: [],
      readText: () => null,
    });

    const evalRes = evaluatePolicy(wasmItems, BASE_POLICY);
    expect(evalRes.valid).toBe(false);
  });
});

describe("Donor extraction attribution header validation", () => {
  test("donor attribution header validation passes on complete valid header", () => {
    const validHeader = `/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/physics/controlTape.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 */
export const x = 1;
`;
    const res = validateDonorAttributionHeader(validHeader);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  test("donor attribution header validation fails when missing pinned commit hash", () => {
    const badHeader = `/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/physics/controlTape.ts
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 */
`;
    const res = validateDonorAttributionHeader(badHeader);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("Pinned commit"))).toBe(true);
  });

  test("donor attribution header validation fails when missing license statement", () => {
    const badHeader = `/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 */
`;
    const res = validateDonorAttributionHeader(badHeader);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("License:"))).toBe(true);
  });
});

describe("Deterministic notices rendering and stale comparison", () => {
  test("rendering the same item set twice yields byte-identical text", () => {
    const items: LicenseItem[] = [
      { kind: "npm", name: "b-lib", version: "1.0", license: "MIT", source: "node_modules/b-lib" },
      {
        kind: "npm",
        name: "a-lib",
        version: "2.0",
        license: "Apache-2.0",
        source: "node_modules/a-lib",
      },
      {
        kind: "font",
        name: "MyFont",
        version: "1.0",
        license: "OFL-1.1",
        source: "public/fonts/MyFont.ttf",
      },
    ];

    const out1 = renderNotices(items);
    const out2 = renderNotices(items);
    expect(out1).toBe(out2);

    // Assert that a-lib precedes b-lib (alphabetical within kind)
    const posA = out1.indexOf("a-lib");
    const posB = out1.indexOf("b-lib");
    expect(posA).toBeLessThan(posB);
  });

  test("a changed item makes committed-inventory comparison fail", () => {
    // In-memory fixture representing a minimal valid repository state per AGENTS.md Rule 1
    const policyYaml = "allowlist:\n  - MIT\n  - Apache-2.0\nexceptions: []\n";

    let itemVersion = "1.0.0";
    const itemLicense = "MIT";

    // Baseline: Generate the committed notices for demo-library@1.0.0 (MIT)
    const baselineItems: LicenseItem[] = [
      {
        kind: "npm",
        name: "demo-library",
        version: "1.0.0",
        license: "MIT",
        source: "node_modules/demo-library",
      },
    ];
    const committedNotices = renderNotices(baselineItems);

    const fixtureFs: FilesystemAdapters = {
      readText: (p: string) => {
        if (p.endsWith("package.json") && !p.includes("node_modules")) {
          return JSON.stringify({
            dependencies: {
              "demo-library": `^${itemVersion}`,
            },
          });
        }
        if (p.endsWith("node_modules/demo-library/package.json")) {
          return JSON.stringify({
            name: "demo-library",
            version: itemVersion,
            license: itemLicense,
          });
        }
        if (p.endsWith("docs/license-policy.yaml")) {
          return policyYaml;
        }
        if (p.endsWith("THIRD_PARTY_NOTICES.md")) {
          return committedNotices;
        }
        return null;
      },
      exists: (p: string) => {
        if (p.endsWith("package.json")) return true;
        if (p.endsWith("node_modules/demo-library")) return true;
        if (p.endsWith("docs/license-policy.yaml")) return true;
        if (p.endsWith("THIRD_PARTY_NOTICES.md")) return true;
        return false;
      },
      findFiles: () => [],
      listDir: () => [],
    };

    // 1. With identical items, committed inventory matches and check succeeds
    const baselineInventory = buildLicenseInventory("/fixture-root", fixtureFs);
    expect(baselineInventory.committedNoticesMatch).toBe(true);
    expect(baselineInventory.committedNoticesDiff).toBeUndefined();

    const baselineCheck = runLicenseInventoryCheck({
      rootDir: "/fixture-root",
      fs: fixtureFs,
      silent: true,
      logsDir: join(process.cwd(), "artifacts/test-logs/license-inventory"),
    });
    expect(baselineCheck.success).toBe(true);
    expect(baselineCheck.exitCode).toBe(0);

    // 2. Change one item: bump version from 1.0.0 to 1.0.1
    itemVersion = "1.0.1";

    const changedInventory = buildLicenseInventory("/fixture-root", fixtureFs);
    expect(changedInventory.committedNoticesMatch).toBe(false);
    expect(changedInventory.committedNoticesDiff).toBeDefined();
    expect(changedInventory.committedNoticesDiff).toContain("differs from newly generated notices");

    const changedCheck = runLicenseInventoryCheck({
      rootDir: "/fixture-root",
      fs: fixtureFs,
      silent: true,
      logsDir: join(process.cwd(), "artifacts/test-logs/license-inventory"),
    });
    expect(changedCheck.success).toBe(false);
    expect(changedCheck.exitCode).toBe(1);

    // 3. Revert item back to 1.0.0: check passes again
    itemVersion = "1.0.0";

    const revertedInventory = buildLicenseInventory("/fixture-root", fixtureFs);
    expect(revertedInventory.committedNoticesMatch).toBe(true);
    expect(revertedInventory.committedNoticesDiff).toBeUndefined();

    const revertedCheck = runLicenseInventoryCheck({
      rootDir: "/fixture-root",
      fs: fixtureFs,
      silent: true,
      logsDir: join(process.cwd(), "artifacts/test-logs/license-inventory"),
    });
    expect(revertedCheck.success).toBe(true);
    expect(revertedCheck.exitCode).toBe(0);
  });
});

describe("Anti-Reward-Hack: Planted Negative Verification", () => {
  test("PLANTED NEGATIVE: inventory check FAILS on planted unlicensed production item", () => {
    const evilItem: LicenseItem = {
      kind: "npm",
      name: "planted-malicious-package",
      version: "6.6.6",
      license: "UNLICENSED",
      source: "node_modules/planted-malicious-package",
      dependencyChain: ["next", "planted-malicious-package"],
    };

    const evalRes = evaluatePolicy([evilItem], BASE_POLICY);
    expect(evalRes.valid).toBe(false);
    expect(evalRes.errors.length).toBeGreaterThanOrEqual(1);
    expect(evalRes.errors[0].message).toContain("planted-malicious-package");
  });

  test("PLANTED NEGATIVE: inventory check FAILS on planted GPL-3.0 production dependency without exception", () => {
    const gplItem: LicenseItem = {
      kind: "npm",
      name: "copyleft-dependency",
      version: "1.0.0",
      license: "GPL-3.0-only",
      source: "node_modules/copyleft-dependency",
    };

    const evalRes = evaluatePolicy([gplItem], BASE_POLICY);
    expect(evalRes.valid).toBe(false);
    expect(evalRes.errors[0].rule).toBe("disallowed-license");
  });
});
