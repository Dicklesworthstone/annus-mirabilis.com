/**
 * Test suite for third-party license inventory and verification.
 * Bead: am-gov-license-inventory-w6yz
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectDonor,
  KNOWN_DONOR_GAPS,
  parseDonorAuditExtractedFiles,
  parseDonorAuditReuseTable,
  validateDonorAttributionHeader,
} from "./license-inventory/collectDonor.ts";
import { collectFonts } from "./license-inventory/collectFonts.ts";
import { collectWasm } from "./license-inventory/collectWasm.ts";
import { evaluatePolicy, versionMatchesRange } from "./license-inventory/evaluatePolicy.ts";
import {
  buildLicenseInventory,
  defaultFsAdapters,
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

/**
 * The first policy error, asserted present. These are planted-negative tests, so
 * reading `errors[0]` through `T | undefined` must fail by naming an empty error
 * list rather than by dying at the property access (am-7mp8).
 */
function firstError<T>(errors: readonly T[]): T {
  const error = errors[0];
  if (error === undefined)
    throw new Error("Expected at least one policy error; the list is empty.");
  return error;
}

/** The first evaluated item, asserted present for the same reason. */
function firstItem<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined)
    throw new Error("Expected at least one evaluated item; the list is empty.");
  return item;
}

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
    const err = firstError(result.errors);
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
    expect(firstError(failRes.errors).rule).toBe("disallowed-license");

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
    expect(firstItem(res.evaluatedItems).outcome).toBe("exempt");
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

describe("Canonical seam table parsing and cross-referencing", () => {
  test("parseDonorAuditReuseTable correctly extracts Layout Chrome & Core UI seam and donor paths", () => {
    const auditPath = join(process.cwd(), "docs/DONOR_AUDIT.md");
    const auditText = readFileSync(auditPath, "utf8");
    const reuseRows = parseDonorAuditReuseTable(auditText);
    expect(reuseRows.length).toBeGreaterThan(0);

    const layoutRow = reuseRows.find((r) => r.seamName === "Layout Chrome & Core UI");
    expect(layoutRow).toBeDefined();
    expect(layoutRow?.decision).toBe("Reuse");
    expect(layoutRow?.noticeRequirement).toContain("MIT + Rider");
    expect(layoutRow?.donorPaths).toContain("src/components/layout/Header.tsx");
    expect(layoutRow?.donorPaths).toContain("src/components/layout/Footer.tsx");
    expect(layoutRow?.donorPaths).toContain("src/components/layout/ThemeToggle.tsx");
    expect(layoutRow?.donorPaths).toContain("src/app/robots.ts");
    expect(layoutRow?.donorPaths).toContain("src/app/sitemap.ts");
  });
});

describe("Known donor gaps integrity (contentGlyphCoverage pattern)", () => {
  test("KNOWN_DONOR_GAPS has exactly 6 entries with valid metadata and deletion conditions", () => {
    expect(KNOWN_DONOR_GAPS.length).toBe(6);
    const expectedPaths = [
      "src/app/robots.ts",
      "src/app/sitemap.ts",
      "src/app/error.tsx",
      "src/app/global-error.tsx",
      "src/app/not-found.tsx",
      "src/app/theme/ThemeToggle.tsx",
    ];
    for (const gap of KNOWN_DONOR_GAPS) {
      expect(expectedPaths).toContain(gap.destPath);
      expect(gap.recordedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(gap.status).toBe("pending-owner-ruling");
      expect(gap.reason.length).toBeGreaterThan(10);
      expect(gap.deletionCondition).toContain("Remove when owner rules");
    }
  });

  test("every entry in KNOWN_DONOR_GAPS still actually exists on disk (a deleted/moved file is stale)", () => {
    for (const gap of KNOWN_DONOR_GAPS) {
      const fullPath = join(process.cwd(), gap.destPath);
      expect(existsSync(fullPath)).toBe(true);
    }
  });

  test("every entry in KNOWN_DONOR_GAPS still lacks attribution header (if one received a header, gap entry must be removed)", () => {
    for (const gap of KNOWN_DONOR_GAPS) {
      const fullPath = join(process.cwd(), gap.destPath);
      const content = readFileSync(fullPath, "utf8");
      const check = validateDonorAttributionHeader(content);
      expect(check.valid).toBe(false);
    }
  });

  test("all 6 known gaps are evaluated as exempt with rule 'known-donor-gap' and do not fail the policy check", () => {
    const auditPath = join(process.cwd(), "docs/DONOR_AUDIT.md");
    const auditText = readFileSync(auditPath, "utf8");
    const items = collectDonor({
      rootDir: process.cwd(),
      auditMarkdown: auditText,
      readText: (p) => {
        try {
          return readFileSync(p, "utf8");
        } catch {
          return null;
        }
      },
      exists: (p) => existsSync(p),
    });

    const gapItems = items.filter((i) => i.license === "PENDING-OWNER-RULING");
    // Every registered gap is exempt, asserted by name rather than by counting, and
    // every OTHER pending item must be justified by DONOR_AUDIT.md's own noticeForm.
    // The count alone said "6" and would have been satisfied by any six items; it also
    // broke the moment the section 11 path learned to report an audit row recorded as
    // owner-blocked, which is a legitimate seventh pending item and not a new gap.
    const pendingPaths = new Set(gapItems.map((i) => i.name));
    for (const gap of KNOWN_DONOR_GAPS) {
      expect(pendingPaths.has(gap.destPath)).toBe(true);
    }
    const auditOwnerBlocked = new Set(
      parseDonorAuditExtractedFiles(auditText)
        .filter((e) => e.noticeForm === "owner-blocked" || e.noticeForm === "pending-owner-ruling")
        .map((e) => e.destPath),
    );
    const registered = new Set(KNOWN_DONOR_GAPS.map((g) => g.destPath));
    for (const item of gapItems) {
      expect(registered.has(item.name) || auditOwnerBlocked.has(item.name)).toBe(true);
    }
    expect(gapItems.length).toBe(registered.size + auditOwnerBlocked.size);

    const evalRes = evaluatePolicy(gapItems, BASE_POLICY);
    expect(evalRes.valid).toBe(true);
    expect(evalRes.errors.length).toBe(0);
    for (const evaluated of evalRes.evaluatedItems) {
      expect(evaluated.outcome).toBe("exempt");
      expect(evaluated.ruleApplied).toBe("known-donor-gap");
    }
  });
});

/**
 * The section 11 path reads the audit's recorded noticeForm.
 *
 * It used to require the section 9 attribution header from every .ts, .tsx, .js and
 * .jsx destination whatever its row said, so DONOR_AUDIT.md's one `owner-blocked` row -
 * src/reader/viewMode.ts, "Rider applicability on short rewrites is an unresolved owner
 * decision" - was reported as a disallowed license and failed the gate in CI and here.
 * Writing the header to silence it would have asserted in a legal notice that the Rider
 * applies to a short rewrite, which is the question nobody has answered.
 *
 * These three cases pin the fix and its limits: the recorded answer is honoured, a row
 * that claims a header still needs one, and a row that records nothing recognisable
 * still falls back to requiring a header for a code file.
 */
describe("donor section 11 honours the recorded noticeForm (am-gov-license-inventory-w6yz)", () => {
  const auditFor = (noticeForm: string, destPath = "src/reader/example.ts"): string =>
    [
      "## 11. Extracted Files",
      "",
      "| sourcePath | newOwner | retainedBehavior | removedAssumptions | firstReaderJourney | batch | commit | noticeForm | notes |",
      "|---|---|---|---|---|---|---|---|---|",
      `| \`src/donor/example.ts\` | \`${destPath}\` (\`am-some-bead\`) | behaviour | none | journey | 1 | none | ${noticeForm} | notes |`,
      "",
      "## 12. Something Else",
    ].join("\n");

  const collectWith = (noticeForm: string, fileContent: string) =>
    collectDonor({
      rootDir: "/fake",
      auditMarkdown: auditFor(noticeForm),
      readText: () => fileContent,
      exists: () => true,
    });

  const HEADERLESS = "/**\n * A short pure-function rewrite.\n */\nexport const x = 1;\n";
  const WITH_HEADER = [
    "/**",
    " * Extracted from classic-patents.com",
    " * Source repository: https://github.com/Dicklesworthstone/classic-patents.com",
    " * Source path: src/donor/example.ts",
    " * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5",
    " * License: MIT License (with OpenAI/Anthropic Rider)",
    " * Preserved license text: /LICENSE",
    " */",
    "export const x = 1;",
    "",
  ].join("\n");

  test("an owner-blocked row with no header is PENDING-OWNER-RULING, not a disallowed license", () => {
    const item = firstItem(collectWith("owner-blocked", HEADERLESS));
    expect(item.license).toBe("PENDING-OWNER-RULING");
    expect(item.license).not.toBe("ATTRIBUTION-HEADER-INVALID");
    // The inventory says why, in the audit's own terms, rather than going quiet.
    expect(item.authorOrNotice).toContain("owner-blocked");
    expect(evaluatePolicy([item], BASE_POLICY).valid).toBe(true);
  });

  test("a row that claims noticeForm 'header' and carries none still fails", () => {
    const item = firstItem(collectWith("header", HEADERLESS));
    expect(item.license).toBe("ATTRIBUTION-HEADER-INVALID");
    expect(evaluatePolicy([item], BASE_POLICY).valid).toBe(false);
  });

  test("a code file whose row records nothing recognisable still needs the header", () => {
    // The extension fallback is what made the gate strict in the first place; the fix
    // narrows it to rows that record a real answer, and must not remove it.
    const missing = firstItem(collectWith("tbd", HEADERLESS));
    expect(missing.license).toBe("ATTRIBUTION-HEADER-INVALID");
    const present = firstItem(collectWith("tbd", WITH_HEADER));
    expect(present.license).toBe("MIT with OpenAI/Anthropic Rider");
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
    expect(firstError(evalRes.errors).message).toContain("planted-malicious-package");
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
    expect(firstError(evalRes.errors).rule).toBe("disallowed-license");
  });

  test("PLANTED NEGATIVE: a 7th unregistered donor-seam file without attribution header fails with rule unattributed-donor-extraction", () => {
    const auditPath = join(process.cwd(), "docs/DONOR_AUDIT.md");
    const auditText = readFileSync(auditPath, "utf8");

    // Plant 7th unregistered donor-seam file from Layout Chrome & Core UI seam (src/components/layout/Header.tsx)
    const plantedPath = "src/components/layout/Header.tsx";
    const plantedContent = `
import React from "react";
export function Header() {
  return <header>Annus Mirabilis</header>;
}
`;

    const mockExists = (p: string) => {
      if (p.endsWith(plantedPath)) return true;
      return existsSync(p);
    };

    const mockReadText = (p: string) => {
      if (p.endsWith(plantedPath)) return plantedContent;
      try {
        return readFileSync(p, "utf8");
      } catch {
        return null;
      }
    };

    const items = collectDonor({
      rootDir: process.cwd(),
      auditMarkdown: auditText,
      readText: mockReadText,
      exists: mockExists,
    });

    const plantedItem = items.find((i) => i.source.endsWith(plantedPath));
    expect(plantedItem).toBeDefined();
    expect(plantedItem?.license).toBe("UNATTRIBUTED-DONOR-EXTRACTION");

    const evalRes = evaluatePolicy(items, BASE_POLICY);
    expect(evalRes.valid).toBe(false);

    const unattributedErrors = evalRes.errors.filter(
      (e) => e.rule === "unattributed-donor-extraction",
    );
    expect(unattributedErrors.length).toBeGreaterThanOrEqual(1);
    const err = firstError(unattributedErrors);
    expect(err.item.name).toBe(plantedPath);
    expect(err.message).toContain("Layout Chrome & Core UI");
    expect(err.message).toContain(plantedPath);
  });

  test("a 7th unregistered donor-seam file WITH valid attribution header passes policy gate", () => {
    const auditPath = join(process.cwd(), "docs/DONOR_AUDIT.md");
    const auditText = readFileSync(auditPath, "utf8");

    const plantedPath = "src/components/layout/Header.tsx";
    const plantedContentWithHeader = `/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/components/layout/Header.tsx
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 */
import React from "react";
export function Header() {
  return <header>Annus Mirabilis</header>;
}
`;

    const mockExists = (p: string) => {
      if (p.endsWith(plantedPath)) return true;
      return existsSync(p);
    };

    const mockReadText = (p: string) => {
      if (p.endsWith(plantedPath)) return plantedContentWithHeader;
      try {
        return readFileSync(p, "utf8");
      } catch {
        return null;
      }
    };

    const items = collectDonor({
      rootDir: process.cwd(),
      auditMarkdown: auditText,
      readText: mockReadText,
      exists: mockExists,
    });

    const plantedItem = items.find((i) => i.source.endsWith(plantedPath));
    expect(plantedItem).toBeDefined();
    expect(plantedItem?.license).toBe("MIT with OpenAI/Anthropic Rider");

    const evalRes = evaluatePolicy([plantedItem as LicenseItem], BASE_POLICY);
    expect(evalRes.valid).toBe(true);
    expect(evalRes.errors.length).toBe(0);
  });

  test("PLANTED NEGATIVE: runLicenseInventoryCheck fails with exitCode 1 when an unregistered donor seam file exists", () => {
    const plantedPath = "src/components/layout/Header.tsx";
    const plantedContent = "export function Header() { return null; }";

    const baseAdapters = { ...defaultFsAdapters };
    const mockFs: FilesystemAdapters = {
      ...baseAdapters,
      exists: (p: string) => {
        if (p.endsWith(plantedPath)) return true;
        return baseAdapters.exists(p);
      },
      readText: (p: string) => {
        if (p.endsWith(plantedPath)) return plantedContent;
        return baseAdapters.readText(p);
      },
    };

    const res = runLicenseInventoryCheck({
      rootDir: process.cwd(),
      fs: mockFs,
      silent: true,
      logsDir: join(process.cwd(), "artifacts/test-logs/license-inventory"),
    });

    expect(res.success).toBe(false);
    expect(res.exitCode).toBe(1);
    expect(
      res.inventory.evaluation.errors.some(
        (e) => e.rule === "unattributed-donor-extraction" && e.item.name === plantedPath,
      ),
    ).toBe(true);
  });
});

describe("version ranges match by dotted segment, not by characters (am-avyr)", () => {
  // The fallback was version.startsWith(range), so a bare range admitted any
  // version whose TEXT began with it. A policy exception records which versions
  // a licence finding was reviewed against, so admitting an unreviewed version
  // is the failure direction that matters.

  test("a bare 1.1 rejects 1.10.0 and accepts 1.1.4", () => {
    expect(versionMatchesRange("1.10.0", "1.1")).toBe(false);
    expect(versionMatchesRange("1.1.4", "1.1")).toBe(true);
    // The bead's second example, and the same shape one major up.
    expect(versionMatchesRange("2.15.3", "2.1")).toBe(false);
    expect(versionMatchesRange("2.1.9", "2.1")).toBe(true);
  });

  // THE CONTROL, and without it this is a tightening rather than a fix: every
  // range docs/license-policy.yaml actually carries must evaluate exactly as it
  // did. Both are handled by branches above the fallback and neither is
  // touched, but "not touched" is an argument and this is a measurement.
  test("the ranges the real policy carries evaluate exactly as before", () => {
    // caniuse-lite, versionRange "*": admits everything, including versions
    // that would fail a segment-prefix test.
    for (const version of ["1.0.30001", "1.10.0", "2.15.3", "unknown", "0.0.0-next"]) {
      expect(versionMatchesRange(version, "*")).toBe(true);
    }
    // argparse, versionRange "^2.0.0": caret means same major, so 2.x admits
    // and 1.x and 3.x do not - unchanged by this commit.
    for (const version of ["2.0.0", "2.0.1", "2.13.0", "2.15.3"]) {
      expect(versionMatchesRange(version, "^2.0.0")).toBe(true);
    }
    for (const version of ["1.9.9", "3.0.0"]) {
      expect(versionMatchesRange(version, "^2.0.0")).toBe(false);
    }
    // And the two escapes above the fallback that a segment test must not
    // shadow: an exact string match, and the "unknown" version the collector
    // emits when a manifest declares none.
    expect(versionMatchesRange("1.10.0", "1.10.0")).toBe(true);
    expect(versionMatchesRange("unknown", "1.1")).toBe(true);
  });

  test("a range with more segments than the version cannot match", () => {
    expect(versionMatchesRange("1.1", "1.1.4")).toBe(false);
  });
});
