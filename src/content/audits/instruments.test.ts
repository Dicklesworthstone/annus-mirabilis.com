import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "../../testing/log/logger.ts";
import { auditInstruments, type InstrumentAuditRow } from "./instruments.ts";
import { errorCheckCodes } from "./types.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "instruments");
const logger = getLogger("verify-content-tests");
const BEAD = "am-cm-audit-scripts-d34";

function loadRows(name: string): InstrumentAuditRow[] {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as InstrumentAuditRow[];
}

describe("auditInstruments: paired ok/broken fixtures", () => {
  test("GOOD RECORD: a complete core row and avogadro-lab pass every column", () => {
    const report = auditInstruments(loadRows("complete.ok.json"));
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
    logger.log({
      testId: "instruments-complete-ok",
      beadId: BEAD,
      extra: { family: "audit", check: "instrument-columns" },
      outcome: "passed",
      message: "complete instrument rows are admitted",
    });
  });

  test("PLANTED: missing dispatcher case is rejected by code", () => {
    const report = auditInstruments([
      ...loadRows("complete.ok.json"),
      ...loadRows("missing-dispatcher.broken.json"),
    ]);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("instrument-dispatcher");
    expect(report.findings.some((f) => f.recordId === "bm-01" && f.severity === "error")).toBe(
      false,
    );
    expect(report.findings.some((f) => f.recordId === "fixture-ghost")).toBe(true);
  });

  test("PLANTED: empty notModeled is rejected by code", () => {
    const report = auditInstruments(loadRows("empty-notModeled.broken.json"));
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("instrument-notModeled");
  });

  test("PLANTED: bm-09 fails catalogue membership by code", () => {
    const report = auditInstruments(loadRows("bm-09-catalogue.broken.json"));
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("instrument-catalogue-membership");
    expect(report.findings[0]?.recordId).toBe("bm-09");
  });

  test("PLANTED: shelf-fizaeu fails non-core membership by code", () => {
    const report = auditInstruments(loadRows("shelf-fizaeu.broken.json"));
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("instrument-catalogue-membership");
    expect(report.findings[0]?.recordId).toBe("shelf-fizaeu");
  });

  test("PLANTED: neither predict mode nor exemption is rejected by code", () => {
    const report = auditInstruments(loadRows("predict-neither.broken.json"));
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("instrument-predict-mode");
  });
});

afterAll(async () => {
  await logger.flush();
});
