import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";
import { QUALITY_GATE_STEPS } from "./quality-gates/registry.ts";
import {
  type FacsimileSourceConfig,
  validateConfig,
  validateFacsimileAnchor,
} from "./sources/facsimileSourceSchema.ts";
import {
  getDefaultConfigDir,
  verifyFacsimileAnchors,
} from "./verify-facsimile-anchors.ts";

const CONFIG_DIR = getDefaultConfigDir();

describe("Facsimile Page Anchor Quality Gate (am-cf6m)", () => {
  describe("1. Real Defect Proving: disk configs under test", () => {
    // The production configs are asserted as a whole by the pinned-facsimile gate
    // (scripts/verify-facsimile-pins.test.ts), which runs this same anchor validator as its
    // first check and additionally compares the pinned bytes with the parent scans. This file
    // owns the mechanism. It previously asserted that ap-17-549 still declares
    // parentPageIndices[0] = 132 and that ap-19-289 and ap-34-591 still carry no anchor, which
    // made a green suite the reward for leaving the defect in place and would have turned red
    // on the owner-authorized repair. Those inverted assertions are gone; the defects are
    // still enforced, against the real tree, by the pins gate.

    test("REAL CORRECT: ap-17-132 config on disk passes page anchor verification", () => {
      const configPath = path.join(CONFIG_DIR, "ap-17-132.yaml");
      const raw = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(raw) as FacsimileSourceConfig;

      expect(config.articlePages.printedFirst).toBe(132);
      expect(config.articlePages.printedLast).toBe(148);
      expect(config.articlePages.parentPageIndices?.[0]).toBe(144);
      expect(config.verifiedAnchor?.parentPageIndex).toBe(144);
      expect(config.verifiedAnchor?.printedPage).toBe(132);

      const res = validateFacsimileAnchor(config);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);
      expect(res.offset).toBe(12);

      const fullRes = validateConfig(config);
      expect(fullRes.valid).toBe(true);
    });

    test("REAL CORRECT: ap-17-891 config on disk passes page anchor verification", () => {
      const configPath = path.join(CONFIG_DIR, "ap-17-891.yaml");
      const raw = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(raw) as FacsimileSourceConfig;

      expect(config.articlePages.printedFirst).toBe(891);
      expect(config.articlePages.printedLast).toBe(921);
      expect(config.articlePages.parentPageIndices?.[0]).toBe(115);
      expect(config.verifiedAnchor?.parentPageIndex).toBe(115);
      expect(config.verifiedAnchor?.printedPage).toBe(891);

      const res = validateFacsimileAnchor(config);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);
      expect(res.offset).toBe(-776);

      const fullRes = validateConfig(config);
      expect(fullRes.valid).toBe(true);
    });

    test("REAL CORRECT: ap-18-639 config on disk passes page anchor verification", () => {
      const configPath = path.join(CONFIG_DIR, "ap-18-639.yaml");
      const raw = fs.readFileSync(configPath, "utf8");
      const config = yaml.load(raw) as FacsimileSourceConfig;

      expect(config.articlePages.printedFirst).toBe(639);
      expect(config.articlePages.printedLast).toBe(641);
      expect(config.articlePages.parentPageIndices?.[0]).toBe(233);
      expect(config.verifiedAnchor?.parentPageIndex).toBe(233);
      expect(config.verifiedAnchor?.printedPage).toBe(639);

      const res = validateFacsimileAnchor(config);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);
      expect(res.offset).toBe(-406);

      const fullRes = validateConfig(config);
      expect(fullRes.valid).toBe(true);
    });

  });

  describe("2. Structural and Arithmetic Constraints", () => {
    const validBaseConfig: FacsimileSourceConfig = {
      configVersion: 1,
      key: "ap-17-132",
      candidates: [
        {
          url: "https://archive.org/download/test/test.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "test",
          hostFileName: "test.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://archive.org/about/terms.php"],
          expectedPageCountRange: { min: 10, max: 20 },
        },
      ],
      articlePages: {
        printedFirst: 10,
        printedLast: 12,
        parentPageIndices: [20, 21, 22],
      },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "Public domain open terms",
      },
      verifiedAnchor: {
        parentPageIndex: 20,
        printedPage: 10,
        verifiedBy: "human:reviewer",
      },
    };

    test("missing verifiedAnchor refuses with MISSING_VERIFIED_ANCHOR", () => {
      const cfg = {
        ...validBaseConfig,
        verifiedAnchor: undefined,
      };
      const res = validateFacsimileAnchor(cfg);
      expect(res.valid).toBe(false);
      expect(res.refusalCode).toBe("MISSING_VERIFIED_ANCHOR");
    });

    test("supports verifiedAnchor placed inside articlePages section", () => {
      const cfg = {
        ...validBaseConfig,
        verifiedAnchor: undefined,
        articlePages: {
          ...validBaseConfig.articlePages,
          verifiedAnchor: {
            parentPageIndex: 20,
            printedPage: 10,
            verifiedBy: "human:reviewer",
          },
        },
      };
      const res = validateFacsimileAnchor(cfg);
      expect(res.valid).toBe(true);
      expect(res.offset).toBe(10);
    });

    test("invalid verifiedAnchor types reject with INVALID_CONFIG", () => {
      // Non-integer parentPageIndex
      const res1 = validateFacsimileAnchor({
        ...validBaseConfig,
        verifiedAnchor: { ...validBaseConfig.verifiedAnchor, parentPageIndex: 1.5 },
      });
      expect(res1.valid).toBe(false);
      expect(res1.refusalCode).toBe("INVALID_CONFIG");

      // Non-positive printedPage
      const res2 = validateFacsimileAnchor({
        ...validBaseConfig,
        verifiedAnchor: { ...validBaseConfig.verifiedAnchor, printedPage: 0 },
      });
      expect(res2.valid).toBe(false);
      expect(res2.refusalCode).toBe("INVALID_CONFIG");

      // Empty verifiedBy
      const res3 = validateFacsimileAnchor({
        ...validBaseConfig,
        verifiedAnchor: { ...validBaseConfig.verifiedAnchor, verifiedBy: "   " },
      });
      expect(res3.valid).toBe(false);
      expect(res3.refusalCode).toBe("INVALID_CONFIG");
    });

    test("non-contiguous parentPageIndices refuses with NON_CONTIGUOUS_PARENT_PAGES", () => {
      const cfg: FacsimileSourceConfig = {
        ...validBaseConfig,
        articlePages: {
          printedFirst: 10,
          printedLast: 12,
          parentPageIndices: [20, 21, 23], // gap at 23 instead of 22
        },
      };
      const res = validateFacsimileAnchor(cfg);
      expect(res.valid).toBe(false);
      expect(res.refusalCode).toBe("NON_CONTIGUOUS_PARENT_PAGES");
      expect(res.errors[0]).toContain("not contiguous at index 2");
    });

    test("length mismatch between parentPageIndices and printed range refuses with FACSIMILE_PAGE_OFFSET_MISMATCH", () => {
      const cfg: FacsimileSourceConfig = {
        ...validBaseConfig,
        articlePages: {
          printedFirst: 10,
          printedLast: 12,
          parentPageIndices: [20, 21], // 2 pages instead of 3
        },
      };
      const res = validateFacsimileAnchor(cfg);
      expect(res.valid).toBe(false);
      expect(res.refusalCode).toBe("FACSIMILE_PAGE_OFFSET_MISMATCH");
      expect(res.errors[0]).toContain("length (2) does not match expected page count (3)");
    });

    test("parentPageIndices starting at wrong offset refuses with FACSIMILE_PAGE_OFFSET_MISMATCH", () => {
      const cfg: FacsimileSourceConfig = {
        ...validBaseConfig,
        articlePages: {
          printedFirst: 10,
          printedLast: 12,
          parentPageIndices: [25, 26, 27], // offset is 15 instead of 10
        },
        verifiedAnchor: {
          parentPageIndex: 20,
          printedPage: 10, // offset is 20 - 10 = 10 -> expected [20, 21, 22]
          verifiedBy: "human:reviewer",
        },
      };
      const res = validateFacsimileAnchor(cfg);
      expect(res.valid).toBe(false);
      expect(res.refusalCode).toBe("FACSIMILE_PAGE_OFFSET_MISMATCH");
      expect(res.errors[0]).toContain("parentPageIndices[0] (25) does not match expected parent page index (20)");
    });
  });

  describe("3. Quality Gate Runner & Registry Integration", () => {
    test("verifyFacsimileAnchors runner checks specified key", () => {
      const passReport = verifyFacsimileAnchors({ key: "ap-17-132" });
      expect(passReport.valid).toBe(true);
      expect(passReport.checkedCount).toBe(1);
      expect(passReport.passedCount).toBe(1);
      expect(passReport.failedCount).toBe(0);

      // The failure path runs against a fixture so that repairing the pins on disk never
      // turns this test red.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "am-anchor-fixture-"));
      fs.writeFileSync(
        path.join(dir, "fixture-offset.yaml"),
        yaml.dump({
          configVersion: 1,
          key: "fixture-offset",
          articlePages: { printedFirst: 10, printedLast: 12, parentPageIndices: [25, 26, 27] },
          verifiedAnchor: { parentPageIndex: 20, printedPage: 10, verifiedBy: "human:reviewer" },
        }),
      );
      const failReport = verifyFacsimileAnchors({ configDir: dir });
      expect(failReport.valid).toBe(false);
      expect(failReport.checkedCount).toBe(1);
      expect(failReport.passedCount).toBe(0);
      expect(failReport.failedCount).toBe(1);
      expect(failReport.results["fixture-offset.yaml"]?.refusalCode).toBe(
        "FACSIMILE_PAGE_OFFSET_MISMATCH",
      );
      expect(failReport.results["fixture-offset.yaml"]?.errors[0]).toContain(
        "parentPageIndices[0] (25) does not match expected parent page index (20)",
      );
      fs.rmSync(dir, { recursive: true, force: true });
    });

    test("QUALITY_GATE_STEPS registers facsimile-page-anchors with requiredInCi true", () => {
      const step = QUALITY_GATE_STEPS.find((s) => s.id === "facsimile-page-anchors");
      expect(step).toBeDefined();
      expect(step?.title).toBe("Facsimile page anchor and offset verification");
      expect(step?.command).toEqual(["bun", "scripts/verify-facsimile-anchors.ts"]);
      expect(step?.family).toBe("fast");
      expect(step?.cadence).toBe("every-run");
      expect(step?.requiredInCi).toBe(true);
      expect(step?.requiredInProfiles).toContain("preview");
      expect(step?.requiredInProfiles).toContain("launch");
      expect(step?.availability.scriptPath).toBe("scripts/verify-facsimile-anchors.ts");
      expect(step?.owner).toBe("am-cf6m");
    });
  });
});
