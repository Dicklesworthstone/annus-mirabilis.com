import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import {
  auditMisconceptions,
  loadLiveMisconceptionInput,
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
    const first = entries[0];
    if (!first) throw new Error("Expected first entry");
    entries[0] = { ...first, anchors: ["s99-ghost-anchor"] };
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
    const first = entries[0];
    if (!first) throw new Error("Expected first entry");
    entries[0] = { ...first, instrumentIds: ["ghost-instrument-99"] };
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
    const first = entries[0];
    if (!first) throw new Error("Expected first entry");
    entries[0] = { ...first, resultIds: ["ghost-result-id"] };
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
    const first = entries[0];
    if (!first) throw new Error("Expected first entry");
    entries[0] = { ...first, sources: ["ghost-source-1999"] };
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

  test("PLANTED: the empty input that used to pass is refused, and the live ledgers are judged", () => {
    // THE DEFECT THIS AUDIT SHIPPED WITH (am-8gbg). scripts/verify-content.ts handed this audit
    // `papers: []` and four empty sets while 26 ledger records sat in content/misconceptions, and
    // it returned ok: no records, therefore no findings, therefore no errors. summarize() has
    // refused a declared population of zero since am-1hst; the refusal never fired because this
    // audit declared no population. Planting the old input is the only way to know the refusal
    // reaches this audit rather than merely existing.
    const empty = auditMisconceptions({
      papers: [],
      knownAnchors: new Set<string>(),
      knownInstruments: new Set<string>(),
      knownResults: new Set<string>(),
      knownSources: new Set<string>(),
    });
    expect(empty.ok).toBe(false);
    expect(empty.population).toEqual({ total: 0, judged: 0, notYetAuditable: 0 });

    // And the live corpus, so the refusal above is not bought by making every input fail. The
    // count is asserted as non-empty rather than as a number: a 27th ledger is correct work.
    const live = loadLiveMisconceptionInput(new URL("../../../", import.meta.url).pathname);
    expect(live.entries).toBeGreaterThan(0);
    expect(live.input.papers.length).toBeGreaterThan(0);
    const report = auditMisconceptions(live.input);
    expect(report.population?.total).toBe(live.entries);
    expect(report.ok).toBe(true);
  });
});
