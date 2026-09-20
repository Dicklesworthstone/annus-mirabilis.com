import { afterAll, describe, expect, test } from "bun:test";
import { QUALITY_GATE_STEPS } from "../../../scripts/quality-gates/registry.ts";
import { getLogger } from "../../testing/log/logger.ts";
import { listRegisteredChecks } from "../compiler/checks/registry.ts";
import { compareCheckInventory, registerVerifyContentChecks } from "./inventory.ts";
import { errorCheckCodes } from "./types.ts";
import { loadCommittedInventory, RULE_0_HELP, runVerifyContent } from "./verifyContent.ts";

const logger = getLogger("verify-content-tests");
const BEAD = "am-cm-audit-scripts-d34";

describe("verify-content orchestrator", () => {
  test("help text states that Rule 0 cannot be machine-checked", () => {
    expect(RULE_0_HELP).toContain("not machine-checkable");
  });

  test("revision check is skipped with a logged line when no base ref exists", async () => {
    registerVerifyContentChecks();
    const result = await runVerifyContent({
      root: process.cwd(),
      architecture: () => 0,
      loadFiles: async () => [],
      inventory: loadCommittedInventory(process.cwd()),
    });
    expect(result.skipped).toContain("revision-check-skipped");
    logger.log({
      testId: "verify-content-revision-skipped",
      beadId: BEAD,
      extra: { family: "audit", skipped: result.skipped },
      outcome: "passed",
      message: "revision check skipped without a base ref",
    });
  });

  test("PLANTED: a registered but uninventoried check fails by code", () => {
    registerVerifyContentChecks();
    const inventoried = loadCommittedInventory(process.cwd());
    const findings = compareCheckInventory(inventoried, [
      ...listRegisteredChecks(),
      { id: "planted-uninventoried", family: "audit" },
    ]);
    expect(findings.some((f) => f.check === "check-not-inventoried")).toBe(true);
    expect(findings.some((f) => f.recordId === "planted-uninventoried")).toBe(true);
  });

  test("PLANTED: an inventoried but unregistered check fails by code", () => {
    const findings = compareCheckInventory(
      [{ id: "planted-missing", family: "structural" }],
      [{ id: "structural-duplicate-id", family: "structural" }],
    );
    expect(findings.some((f) => f.check === "check-missing")).toBe(true);
    expect(findings.some((f) => f.recordId === "planted-missing")).toBe(true);
  });

  test("PLANTED: a missing published asset fails verify-content by check code", async () => {
    registerVerifyContentChecks();
    const result = await runVerifyContent({
      root: process.cwd(),
      architecture: () => 0,
      loadFiles: async () => [],
      inventory: loadCommittedInventory(process.cwd()),
      pinnedAssets: [
        {
          id: "ap-17-549-pdf",
          path: "public/papers/pdfs/does-not-exist.pdf",
          publicationDecision: "publish",
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(
      errorCheckCodes({
        audit: "verify-content",
        ok: false,
        errorCount: 1,
        flagCount: 0,
        findings: result.findings,
      }),
    ).toContain("pinned-asset-present");
  });

  test("architecture failure is an error and does not stop later families", async () => {
    registerVerifyContentChecks();
    const result = await runVerifyContent({
      root: process.cwd(),
      architecture: () => 1,
      loadFiles: async () => [],
      inventory: loadCommittedInventory(process.cwd()),
      extraReports: [
        {
          audit: "audit-review-honesty",
          ok: false,
          errorCount: 1,
          flagCount: 0,
          findings: [
            {
              check: "review-claim-without-reviewer",
              family: "audit",
              severity: "error",
              recordId: "arg-claimed-without-reviewer",
              message: "planted",
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((line) => line.includes("architecture-gate"))).toBe(true);
    expect(result.findings.some((f) => f.check === "review-claim-without-reviewer")).toBe(true);
  });

  test("profiles that require verify-content no longer require a separate voice-lint step", () => {
    const verify = QUALITY_GATE_STEPS.find((step) => step.id === "verify-content");
    const voice = QUALITY_GATE_STEPS.find((step) => step.id === "voice-lint");
    expect(verify).toBeDefined();
    expect(voice).toBeDefined();
    for (const profile of verify?.requiredInProfiles ?? []) {
      expect(voice?.requiredInProfiles ?? []).not.toContain(profile);
    }
    expect(voice?.requiredInCi).toBe(false);
  });

  test("PLANTED: failing dimension audit surfaces in verify-content errors", async () => {
    registerVerifyContentChecks();
    const result = await runVerifyContent({
      root: process.cwd(),
      architecture: () => 0,
      loadFiles: async () => [],
      inventory: loadCommittedInventory(process.cwd()),
      dimensionAudit: async () => ({
        audit: "audit-dimensions",
        ok: false,
        errorCount: 1,
        flagCount: 0,
        findings: [
          {
            check: "dimension-consistency",
            family: "audit",
            severity: "error",
            recordId: "eq-energy-equals-force",
            message: "inconsistent dimensions",
          },
        ],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.findings.some((f) => f.check === "dimension-consistency")).toBe(true);
    expect(result.errors.some((e) => e.includes("dimension-consistency"))).toBe(true);
  });

  test("PLANTED: failing content audit surfaces in verify-content errors and runs in order", async () => {
    registerVerifyContentChecks();
    const order: string[] = [];
    const result = await runVerifyContent({
      root: process.cwd(),
      architecture: () => {
        order.push("architecture");
        return 0;
      },
      loadFiles: async () => {
        order.push("compiler");
        return [];
      },
      inventory: loadCommittedInventory(process.cwd()),
      dimensionAudit: async () => {
        order.push("dimensions");
        return {
          audit: "audit-dimensions",
          ok: true,
          errorCount: 0,
          flagCount: 0,
          findings: [],
        };
      },
      audits: {
        readings: async () => {
          order.push("readings");
          return {
            audit: "audit-readings",
            ok: false,
            errorCount: 1,
            flagCount: 0,
            findings: [
              {
                check: "owner-conflict",
                family: "readings",
                severity: "error",
                recordId: "target-1",
                message: "planted conflict",
              },
            ],
          };
        },
        shelf: async () => {
          order.push("shelf");
          return { audit: "audit-shelf", ok: true, errorCount: 0, flagCount: 0, findings: [] };
        },
        misconceptions: async () => {
          order.push("misconceptions");
          return {
            audit: "audit-misconceptions",
            ok: true,
            errorCount: 0,
            flagCount: 0,
            findings: [],
          };
        },
        instruments: async () => {
          order.push("instruments");
          return {
            audit: "audit-instruments",
            ok: true,
            errorCount: 0,
            flagCount: 0,
            findings: [],
          };
        },
      },
      revisionCheck: async () => {
        order.push("revision");
        return true;
      },
      baseRef: "origin/main",
      pinnedAssets: [
        {
          id: "test-asset",
          path: "public/test.pdf",
          publicationDecision: "reference-only",
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.check === "owner-conflict")).toBe(true);
    expect(order).toEqual([
      "architecture",
      "compiler",
      "dimensions",
      "readings",
      "shelf",
      "misconceptions",
      "instruments",
      "revision",
    ]);
  });
});

afterAll(async () => {
  await logger.flush();
});
