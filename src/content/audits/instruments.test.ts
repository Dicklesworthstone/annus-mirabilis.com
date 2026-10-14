import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "../../testing/log/logger.ts";
import {
  auditInstruments,
  formatInstrumentAuditTable,
  type InstrumentAuditRow,
  loadLiveInstrumentRows,
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

  /**
   * THE PROBES COLUMN READS THE PROBES A READER CAN OPERATE, and this is the plant that proves
   * it. The fixture row is complete in every other column and keeps a NON-EMPTY manifest
   * `probes:` list, so under the column's previous source it passed; its only defect is that no
   * result card probes it. Without this, pointing the column at a new field would be a change
   * nothing tested.
   */
  test("PLANTED: a lab no result card probes fails the probes column, even with a manifest list", () => {
    const rows = loadRows("no-reader-probe.broken.json");
    // Print what landed before reading the verdict: a plant that did not take produces a green
    // that means nothing.
    expect(rows[0]?.manifestProbes.length).toBeGreaterThan(0);
    expect(rows[0]?.readerProbes).toEqual([]);
    const report = auditInstruments(rows);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("instrument-probes");
    expect(report.findings.find((f) => f.check === "instrument-probes")?.message).toContain(
      "probed by no result card",
    );
  });

  test("CONTROL: the same row with one reader probe passes the probes column", () => {
    const rows = loadRows("no-reader-probe.broken.json").map((row) => ({
      ...row,
      readerProbes: ["What does this instrument answer?"],
    }));
    const report = auditInstruments(rows);
    expect(errorCheckCodes(report)).not.toContain("instrument-probes");
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
        manifestProbes: ["bm-01-radius-probe"],
        readerProbes: ["What does this instrument answer?"],
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
        manifestProbes: ["bm-01-probe"],
        readerProbes: ["What does this instrument answer?"],
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
        manifestProbes: ["bm-01-probe"],
        readerProbes: ["What does this instrument answer?"],
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
        manifestProbes: ["bm-01-probe"],
        readerProbes: ["What does this instrument answer?"],
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
        manifestProbes: ["lq-08-probes"],
        readerProbes: ["What does this instrument answer?"],
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
          f.message.includes(
            '"count-model" is not a declared mode of lq-08; declared modes: <none>',
          ),
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
