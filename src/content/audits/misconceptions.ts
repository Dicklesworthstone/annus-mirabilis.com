/**
 * Misconceptions audit (am-cm-audit-scripts-d34): at least five entries once
 * a ledger is declared or the paper is complete; every anchor, instrument
 * id, result id, and source must resolve.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type AuditFinding, type AuditReport, summarize } from "./types.ts";

export type MisconceptionEntry = Readonly<{
  id: string;
  anchors: readonly string[];
  instrumentIds: readonly string[];
  resultIds: readonly string[];
  sources: readonly string[];
}>;

export type PaperMisconceptionLedger = Readonly<{
  paper: string;
  complete: boolean;
  ledgerDeclared: boolean;
  entries: readonly MisconceptionEntry[];
}>;

export type MisconceptionAuditInput = Readonly<{
  papers: readonly PaperMisconceptionLedger[];
  knownAnchors: ReadonlySet<string>;
  knownInstruments: ReadonlySet<string>;
  knownResults: ReadonlySet<string>;
  knownSources: ReadonlySet<string>;
}>;

export function auditMisconceptions(input: MisconceptionAuditInput): AuditReport {
  const findings: AuditFinding[] = [];

  for (const paper of input.papers) {
    const required = paper.complete || paper.ledgerDeclared;
    if (required && paper.entries.length < 5) {
      findings.push({
        check: "misconception-count",
        family: "audit",
        severity: "error",
        paper: paper.paper,
        recordId: paper.paper,
        expected: "at least 5",
        actual: String(paper.entries.length),
        message: `Paper ${paper.paper} is complete or has a declared ledger but has ${paper.entries.length} misconception entries.`,
      });
    }
    for (const entry of paper.entries) {
      for (const anchor of entry.anchors) {
        if (!input.knownAnchors.has(anchor)) {
          findings.push({
            check: "dangling-anchor",
            family: "audit",
            severity: "error",
            paper: paper.paper,
            recordId: entry.id,
            message: `Misconception ${entry.id} cites unknown anchor ${anchor}.`,
          });
        }
      }
      for (const instrumentId of entry.instrumentIds) {
        if (!input.knownInstruments.has(instrumentId)) {
          findings.push({
            check: "dangling-instrument",
            family: "audit",
            severity: "error",
            paper: paper.paper,
            recordId: entry.id,
            message: `Misconception ${entry.id} cites unknown instrument ${instrumentId}.`,
          });
        }
      }
      for (const resultId of entry.resultIds) {
        if (!input.knownResults.has(resultId)) {
          findings.push({
            check: "dangling-result",
            family: "audit",
            severity: "error",
            paper: paper.paper,
            recordId: entry.id,
            message: `Misconception ${entry.id} cites unknown result ${resultId}.`,
          });
        }
      }
      for (const source of entry.sources) {
        if (!input.knownSources.has(source)) {
          findings.push({
            check: "dangling-source",
            family: "audit",
            severity: "error",
            paper: paper.paper,
            recordId: entry.id,
            message: `Misconception ${entry.id} cites unknown source ${source}.`,
          });
        }
      }
    }
  }

  // THE POPULATION IS DECLARED, so an empty input cannot read as a pass (am-1hst, am-8gbg).
  // Until 2026-09-27 this returned summarize(name, findings) with no population, and
  // scripts/verify-content.ts handed it `papers: []` while 26 ledgers sat on disk: no records,
  // therefore no findings, therefore no errors, therefore green. summarize() has refused a declared
  // population of zero since am-1hst, and the refusal never fired here because nothing declared one.
  const total = input.papers.reduce((n, paper) => n + paper.entries.length, 0);
  return summarize("audit-misconceptions", findings, {
    total,
    judged: total,
    notYetAuditable: 0,
  });
}

/**
 * THE LEDGERS AS THEY ARE ON DISK, so the audit judges records rather than an empty list (am-8gbg).
 *
 * scripts/verify-content.ts passed `papers: []` and four empty sets until 2026-09-27, while
 * content/misconceptions held 26 ledger records. Every check below therefore ran over nothing and
 * reported green, which is the defect this loader exists to remove.
 *
 * WHAT IS AUDITED, AND WHAT IS NOT, stated here rather than discovered later:
 * - anchors resolve against the source-block ids of every paper (42 cited, all 42 resolve today);
 * - result ids resolve against content/results (20 cited, all 20 resolve today);
 * - instrument ids resolve against content/experiments. The records carry none today: the shape
 *   they use for an instrument is `intervention`, not `instrumentIds`, so this check has nothing to
 *   judge and says so through the count rather than through silence.
 * - SOURCES ARE NOT AUDITED, and the reason is a mismatch between the check and the records. The
 *   audit resolves a source as an id; all 44 citations in the records are prose, of the form
 *   "A. Einstein, Ann. Phys. (4) 17, 549-560 (1905), plates pp. 549, 559 and 560". Passing them to
 *   an id check would report 44 dangling sources about records that are in fact well sourced, and
 *   building the known set out of the records' own strings would make the check vacuous. So the
 *   loader passes no sources and the caller prints how many went unjudged. Reconciling the two
 *   shapes is its own bead; what must not happen is either a red gate on arrival or a false green.
 */
export type LiveMisconceptionInput = Readonly<{
  input: MisconceptionAuditInput;
  /** Prose citations the source check could not judge, counted so the silence is visible. */
  unjudgedSources: number;
  /** Ledger records read from disk, so "0 errors" cannot be read as "all of them". */
  entries: number;
}>;

function idsFromYaml(text: string): string[] {
  return [...text.matchAll(/^\s*-?\s*id:\s*"?([A-Za-z0-9][A-Za-z0-9-]*)"?\s*$/gm)].map(
    (m) => m[1] as string,
  );
}

export function loadLiveMisconceptionInput(rootDir: string): LiveMisconceptionInput {
  const dir = resolve(rootDir, "content/misconceptions");
  const papers: PaperMisconceptionLedger[] = [];
  let unjudgedSources = 0;
  let entries = 0;
  if (existsSync(dir)) {
    for (const paper of readdirSync(dir).sort()) {
      const paperDir = resolve(dir, paper);
      if (!existsSync(paperDir)) continue;
      const files = readdirSync(paperDir).filter((f) => f.endsWith(".json"));
      if (files.length === 0) continue;
      const ledger: MisconceptionEntry[] = [];
      for (const file of files.sort()) {
        const record = JSON.parse(readFileSync(resolve(paperDir, file), "utf8")) as Record<
          string,
          unknown
        >;
        unjudgedSources += (record.sources as unknown[] | undefined)?.length ?? 0;
        ledger.push({
          id: String(record.id ?? file.replace(/\.json$/, "")),
          anchors: (record.anchors as string[] | undefined) ?? [],
          instrumentIds: (record.instrumentIds as string[] | undefined) ?? [],
          resultIds: (record.resultIds as string[] | undefined) ?? [],
          // Not [] by oversight: see SOURCES above.
          sources: [],
        });
      }
      entries += ledger.length;
      // A ledger that exists is a declared ledger: the five-entry floor applies to it.
      papers.push({ paper, complete: false, ledgerDeclared: true, entries: ledger });
    }
  }
  const knownAnchors = new Set<string>();
  const blocks = resolve(rootDir, "content/source-blocks");
  if (existsSync(blocks))
    for (const paper of readdirSync(blocks)) {
      const paperDir = resolve(blocks, paper);
      if (!existsSync(paperDir)) continue;
      for (const file of readdirSync(paperDir))
        if (file.endsWith(".yaml")) knownAnchors.add(file.replace(/\.yaml$/, ""));
    }
  const knownResults = new Set<string>();
  const results = resolve(rootDir, "content/results");
  if (existsSync(results))
    for (const file of readdirSync(results))
      if (file.endsWith(".yaml"))
        for (const id of idsFromYaml(readFileSync(resolve(results, file), "utf8")))
          knownResults.add(id);
  const knownInstruments = new Set<string>();
  const experiments = resolve(rootDir, "content/experiments");
  if (existsSync(experiments))
    for (const file of readdirSync(experiments))
      if (file.endsWith(".yaml")) knownInstruments.add(file.replace(/\.yaml$/, ""));
  return {
    input: {
      papers,
      knownAnchors,
      knownInstruments,
      knownResults,
      knownSources: new Set<string>(),
    },
    unjudgedSources,
    entries,
  };
}
