import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { newRunIdentity, TestLogger } from "../log/logger.ts";
import { parseLogLine } from "../log/schema.ts";

describe("view kit structured logging (am-inst-2d-view-kit-u75r)", () => {
  test("writes validated structured JSONL log events with extra scale and census fields", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "view-kit-log-test-"));
    const logRunId = newRunIdentity();
    const logger = new TestLogger("view-kit", logRunId, tmpDir);

    logger.log({
      testId: "view-kit-smoke-001",
      beadId: "am-inst-2d-view-kit-u75r",
      instrumentId: "bm-01",
      instanceId: "BM01:1",
      runId: "run-001",
      snapshotVersion: "1",
      outcome: "passed",
      durationMs: 42,
      extra: {
        viewId: "bm01-microscope",
        spatialMagnificationFactor: 1e8,
        spatialMagnificationAppliesTo: "scene",
        simulatedElapsedTime: 1.5,
        playbackMultiplier: 1,
        glyphDrawnPx: 4,
        glyphRepresents: "none",
        quantityNormalizationKind: "per-bin-width",
        renderedScaleLabel: "Scene magnified ×10^8",
        accessibleScaleFactsPresent: true,
        printScaleFactsPresent: true,
      },
    });

    await logger.flush();

    expect(fs.existsSync(logger.filePath)).toBe(true);
    const content = fs.readFileSync(logger.filePath, "utf8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(1);

    const firstLine = lines[0];
    if (!firstLine) throw new Error("Expected at least one logged line");
    const parsed = parseLogLine(firstLine);
    expect(parsed.suite).toBe("view-kit");
    expect(parsed.testId).toBe("view-kit-smoke-001");
    expect(parsed.beadId).toBe("am-inst-2d-view-kit-u75r");
    expect(parsed.extra?.viewId).toBe("bm01-microscope");
    expect(parsed.extra?.spatialMagnificationFactor).toBe(1e8);
    expect(parsed.extra?.playbackMultiplier).toBe(1);
    expect(parsed.extra?.glyphRepresents).toBe("none");
  });
});
