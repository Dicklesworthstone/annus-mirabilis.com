import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DerivationRendererLogger } from "./logger.ts";

describe("am-eq-derivation-renderer-9gd7: DerivationRendererLogger structured logging", () => {
  test("writes structured JSONL log record with bead-specific and standard fields", () => {
    const runId = `test-run-${Date.now()}`;
    const logger = new DerivationRendererLogger(runId);

    logger.log({
      testId: "derivation-render-smoke",
      chainId: "chain-bm-variance",
      proofRouteId: "route-bm-variance",
      routeKind: "pedagogical-reconstruction",
      stepId: "bm-ped-step-1",
      isMove: false,
      detail: "1",
      perspective: "historical",
      highlightIds: ["x"],
      toolPresent: true,
      toolLinkOpened: false,
      returnFocusRestored: true,
      announcementCount: 1,
      outcome: "pass",
      message: "Rendered step 1 successfully",
    });

    expect(existsSync(logger.logFilePath)).toBe(true);
    const content = readFileSync(logger.logFilePath, "utf8");
    const record = JSON.parse(content.trim());

    expect(record.suite).toBe("equations-derivation-renderer");
    expect(record.beadId).toBe("am-eq-derivation-renderer-9gd7");
    expect(record.chainId).toBe("chain-bm-variance");
    expect(record.isMove).toBe(false);
    expect(record.outcome).toBe("pass");
  });
});
