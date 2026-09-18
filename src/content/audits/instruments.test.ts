import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "../../testing/log/logger.ts";
import {
  auditInstruments,
  formatInstrumentAuditTable,
  loadLiveInstrumentRows,
  type InstrumentAuditRow,
} from "./instruments.ts";
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

  test("GOOD RECORD: valid declared modes, presets, predict prompts, and teaching tapes pass", () => {
    const report = auditInstruments([
      {
        id: "bm-01",
        core: true,
        registered: true,
        dispatcherCase: true,
        inCoreCatalogue: true,
        inNonCoreList: false,
        probes: ["bm-01-radius-probe"],
        notModeled: ["Molecular collisions."],
        tapeModelId: "bm-01@1",
        ownerTest: true,
        actionContracts: 1,
        predictEnabled: true,
        embeddable: true,
        modes: ["sr-02:apparatus"],
        presets: ["bm-01-radius-probe", "bm-01-viscosity-comparison"],
        predictPrompts: ["bm-01-predict-observation-interval"],
        teachingTapes: ["einstein-0-8-micron"],
      },
    ]);
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
  });

  test("PLANTED: preset with colon or missing prefix fails preset grammar", () => {
    const report = auditInstruments([
      {
        id: "bm-01",
        core: true,
        registered: true,
        dispatcherCase: true,
        inCoreCatalogue: true,
        inNonCoreList: false,
        probes: ["bm-01-probe"],
        notModeled: ["None"],
        tapeModelId: "bm-01@1",
        ownerTest: true,
        actionContracts: 1,
        predictEnabled: true,
        embeddable: true,
        presets: ["bm-01:invalid-preset-with-colon"],
      },
    ]);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("instrument-presets");
    expect(report.findings[0]?.message).toContain("cannot contain a colon");
  });

  test("PLANTED: predict prompt without predict segment fails prompt grammar", () => {
    const report = auditInstruments([
      {
        id: "bm-01",
        core: true,
        registered: true,
        dispatcherCase: true,
        inCoreCatalogue: true,
        inNonCoreList: false,
        probes: ["bm-01-probe"],
        notModeled: ["None"],
        tapeModelId: "bm-01@1",
        ownerTest: true,
        actionContracts: 1,
        predictEnabled: true,
        embeddable: true,
        predictPrompts: ["bm-01-invalid-prompt"],
      },
    ]);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("instrument-predict-prompts");
  });

  test("PLANTED: teaching tape with colon fails tape grammar", () => {
    const report = auditInstruments([
      {
        id: "bm-01",
        core: true,
        registered: true,
        dispatcherCase: true,
        inCoreCatalogue: true,
        inNonCoreList: false,
        probes: ["bm-01-probe"],
        notModeled: ["None"],
        tapeModelId: "bm-01@1",
        ownerTest: true,
        actionContracts: 1,
        predictEnabled: true,
        embeddable: true,
        teachingTapes: ["bm-01:the-locked-tape"],
      },
    ]);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("instrument-teaching-tapes");
    expect(report.findings[0]?.message).toContain("cannot contain a colon");
  });

  test("PLANTED: undeclared mode such as lq-08:count-model fails with instrument declared modes in message", () => {
    const report = auditInstruments([
      {
        id: "lq-08",
        core: true,
        registered: true,
        dispatcherCase: true,
        inCoreCatalogue: true,
        inNonCoreList: false,
        probes: ["lq-08-probes"],
        notModeled: ["None"],
        tapeModelId: "lq-08@1",
        ownerTest: true,
        actionContracts: 1,
        predictEnabled: true,
        embeddable: true,
        testedAddresses: ["lq-08:count-model"],
      },
    ]);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("instrument-modes");
    expect(
      report.findings.some(
        (f) =>
          f.check === "instrument-modes" &&
          f.message.includes('"count-model" is not a declared mode of lq-08; declared modes: <none>'),
      ),
    ).toBe(true);
  });

  test("GOOD RECORD: formatInstrumentAuditTable output has per-requirement columns and no total, and reads real registry and dispatcher", () => {
    const liveRows = loadLiveInstrumentRows(process.cwd(), { ids: ["bm-01"] });
    expect(liveRows.length).toBe(1);
    const bm01 = liveRows[0]!;
    expect(bm01.registered).toBe(true);
    expect(bm01.dispatcherCase).toBe(true);

    const report = auditInstruments(liveRows);
    const table = formatInstrumentAuditTable(report, liveRows);
    expect(table).toContain("| Instrument | Registry | Dispatcher |");
    expect(table.toLowerCase()).not.toContain("total");
    expect(table.toLowerCase()).not.toContain("score");
  });
});

afterAll(async () => {
  await logger.flush();
});
