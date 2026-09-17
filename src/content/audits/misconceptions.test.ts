import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import {
  auditMisconceptions,
  type MisconceptionAuditInput,
  type MisconceptionEntry,
} from "./misconceptions.ts";
import { errorCheckCodes } from "./types.ts";

const logger = getLogger("verify-content-tests");
const BEAD = "am-cm-audit-scripts-d34";

describe("auditMisconceptions (am-cm-audit-scripts-d34)", () => {
  const knownAnchors = new Set(["s1-p1", "s4-p1", "s5-p1", "s5-eq1", "closing-bm"]);
  const knownInstruments = new Set(["bm-01", "bm-05", "bm-06", "bm-07", "bm-08"]);
  const knownResults = new Set(["rms-lambda-x", "diffusion-d", "avogadro-n", "apparent-speed"]);
  const knownSources = new Set(["einstein-1905", "perrin-1908", "exner-1900"]);

  function makeEntries(count: number): MisconceptionEntry[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `misc-bm-0${i + 1}`,
      anchors: ["s4-p1"],
      instrumentIds: ["bm-01"],
      resultIds: ["rms-lambda-x"],
      sources: ["einstein-1905"],
    }));
  }

  test("GOOD RECORD: paper with 5 valid misconception entries and resolving links passes", () => {
    const input: MisconceptionAuditInput = {
      papers: [
        {
          paper: "brownian-motion",
          complete: true,
          ledgerDeclared: true,
          entries: makeEntries(5),
        },
      ],
      knownAnchors,
      knownInstruments,
      knownResults,
      knownSources,
    };
    const report = auditMisconceptions(input);
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
    logger.log({
      testId: "misconceptions-good-record",
      beadId: BEAD,
      extra: { family: "audit", check: "misconception-complete" },
      outcome: "passed",
      message: "complete misconception ledger passes audit",
    });
  });

  test("PLANTED: four entries on a complete paper fail with misconception-count", () => {
    const input: MisconceptionAuditInput = {
      papers: [
        {
          paper: "brownian-motion",
          complete: true,
          ledgerDeclared: true,
          entries: makeEntries(4), // only 4 entries
        },
      ],
      knownAnchors,
      knownInstruments,
      knownResults,
      knownSources,
    };
    const report = auditMisconceptions(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("misconception-count");
  });

  test("PLANTED: four entries on an incomplete paper with declared ledger fail with misconception-count", () => {
    const input: MisconceptionAuditInput = {
      papers: [
        {
          paper: "special-relativity",
          complete: false,
          ledgerDeclared: true,
          entries: makeEntries(4),
        },
      ],
      knownAnchors,
      knownInstruments,
      knownResults,
      knownSources,
    };
    const report = auditMisconceptions(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("misconception-count");
  });

  test("PLANTED: dangling anchor id fails with dangling-anchor", () => {
    const entries = makeEntries(5);
    entries[0] = { ...entries[0]!, anchors: ["s99-ghost-anchor"] };
    const input: MisconceptionAuditInput = {
      papers: [
        {
          paper: "brownian-motion",
          complete: true,
          ledgerDeclared: true,
          entries,
        },
      ],
      knownAnchors,
      knownInstruments,
      knownResults,
      knownSources,
    };
    const report = auditMisconceptions(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("dangling-anchor");
  });

  test("PLANTED: dangling instrument id fails with dangling-instrument", () => {
    const entries = makeEntries(5);
    entries[0] = { ...entries[0]!, instrumentIds: ["ghost-instrument-99"] };
    const input: MisconceptionAuditInput = {
      papers: [
        {
          paper: "brownian-motion",
          complete: true,
          ledgerDeclared: true,
          entries,
        },
      ],
      knownAnchors,
      knownInstruments,
      knownResults,
      knownSources,
    };
    const report = auditMisconceptions(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("dangling-instrument");
  });

  test("PLANTED: dangling result id fails with dangling-result", () => {
    const entries = makeEntries(5);
    entries[0] = { ...entries[0]!, resultIds: ["ghost-result-id"] };
    const input: MisconceptionAuditInput = {
      papers: [
        {
          paper: "brownian-motion",
          complete: true,
          ledgerDeclared: true,
          entries,
        },
      ],
      knownAnchors,
      knownInstruments,
      knownResults,
      knownSources,
    };
    const report = auditMisconceptions(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("dangling-result");
  });

  test("PLANTED: dangling source fails with dangling-source", () => {
    const entries = makeEntries(5);
    entries[0] = { ...entries[0]!, sources: ["ghost-source-1999"] };
    const input: MisconceptionAuditInput = {
      papers: [
        {
          paper: "brownian-motion",
          complete: true,
          ledgerDeclared: true,
          entries,
        },
      ],
      knownAnchors,
      knownInstruments,
      knownResults,
      knownSources,
    };
    const report = auditMisconceptions(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("dangling-source");
  });
});
