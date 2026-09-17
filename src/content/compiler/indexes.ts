/**
 * Content Indexes and Reference Resolution.
 * Builds fast in-memory indexes by id, kind, and paper, and verifies referential integrity.
 *
 * Spec: AGENTS.md and am-cm-compiler-core-oa7
 */

import type { EquationRecord } from "../../equations/record.ts";
import type { Argument, Block, Citation, Foundation, Paper } from "../schemas/reading.ts";
import { READING_IDS } from "../schemas/reading.ts";

export interface ContentIndexes {
  readonly byId: ReadonlyMap<string, unknown>;
  readonly byKind: ReadonlyMap<string, readonly unknown[]>;
  readonly byPaper: ReadonlyMap<string, readonly unknown[]>;
  readonly papers: ReadonlyMap<string, Paper>;
  readonly arguments: ReadonlyMap<string, Argument>;
  readonly foundations: ReadonlyMap<string, Foundation>;
  readonly citations: ReadonlyMap<string, Citation>;
  readonly equations: ReadonlyMap<string, EquationRecord>;
  readonly rawRecords: ReadonlyMap<string, unknown>;
}

export interface BuildIndexesResult {
  readonly indexes: ContentIndexes;
  readonly errors: readonly { code: string; path: string; message: string }[];
}

/**
 * Builds indexes from parsed content records and verifies fundamental references.
 */
export function buildContentIndexes(records: ReadonlyMap<string, unknown>): BuildIndexesResult {
  const errors: { code: string; path: string; message: string }[] = [];
  const issue = (code: string, path: string, message: string) => {
    errors.push({ code, path, message });
  };

  const byId = new Map<string, unknown>();
  const byKind = new Map<string, unknown[]>();
  const byPaper = new Map<string, unknown[]>();

  const papers = new Map<string, Paper>();
  const args = new Map<string, Argument>();
  const foundations = new Map<string, Foundation>();
  const citations = new Map<string, Citation>();
  const equations = new Map<string, EquationRecord>();

  for (const [id, record] of records.entries()) {
    byId.set(id, record);

    if (record && typeof record === "object") {
      const rec = record as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "unknown";

      let list = byKind.get(kind);
      if (!list) {
        list = [];
        byKind.set(kind, list);
      }
      list.push(record);

      const paper =
        typeof rec.paper === "string"
          ? rec.paper
          : typeof rec.paperSlug === "string"
            ? rec.paperSlug
            : undefined;
      if (paper) {
        let pList = byPaper.get(paper);
        if (!pList) {
          pList = [];
          byPaper.set(paper, pList);
        }
        pList.push(record);
      }

      const rawId = typeof rec.id === "string" ? rec.id : id;
      if (rawId !== id) {
        byId.set(rawId, record);
      }

      if (kind === "paper") papers.set(rawId, record as Paper);
      else if (kind === "argument") args.set(rawId, record as Argument);
      else if (kind === "foundation") foundations.set(rawId, record as Foundation);
      else if (kind === "citation") citations.set(rawId, record as Citation);
      else if (kind === "equation") equations.set(rawId, record as EquationRecord);
    }
  }

  // Check referential integrity for reading/argument records
  const claimedArgs = new Set<string>();
  for (const paper of papers.values()) {
    if (paper.citation && !citations.has(paper.citation)) {
      issue("dangling-reference", paper.id, `Paper citation not found: ${paper.citation}`);
    }
    const anchors = new Set<string>();
    for (const sec of paper.sections) {
      if (anchors.has(sec.id) || !/^s\d+$/.test(sec.id)) {
        issue("section-id", paper.id, `Invalid or duplicate section: ${sec.id}`);
      }
      anchors.add(sec.id);

      for (const argId of sec.arguments) {
        if (claimedArgs.has(argId)) {
          issue(
            "duplicate-placement",
            paper.id,
            `Argument appears more than once in outline: ${argId}`,
          );
        }
        claimedArgs.add(argId);
        const arg = args.get(argId);
        if (!arg) {
          issue("dangling-reference", paper.id, `Expected argument: ${argId}`);
        } else if (arg.paper !== paper.id || arg.section !== sec.id) {
          issue(
            "section-mismatch",
            argId,
            `Argument belongs to paper ${arg.paper} section ${arg.section}`,
          );
        }
      }
    }
  }

  for (const arg of args.values()) {
    if (!claimedArgs.has(arg.id)) {
      issue("orphan-argument", arg.id, "Argument is absent from its paper outline.");
    }
    if (arg.paper && !papers.has(arg.paper)) {
      issue("dangling-reference", arg.id, `Argument references unknown paper: ${arg.paper}`);
    }
    for (const cit of arg.citations ?? []) {
      if (!citations.has(cit)) {
        issue("dangling-reference", arg.id, `Citation not found: ${cit}`);
      }
    }
    for (const prereq of arg.prerequisites ?? []) {
      if (prereq && typeof prereq === "object" && "id" in prereq) {
        if (!args.has(prereq.id) && !foundations.has(prereq.id)) {
          issue("dangling-reference", arg.id, `Prerequisite not found: ${prereq.id}`);
        }
      }
    }
    for (const fId of Object.values(arg.help ?? {})) {
      if (!foundations.has(fId)) {
        issue("dangling-reference", arg.id, `Help foundation not found: ${fId}`);
      }
    }
    if (arg.readings) {
      for (const rKey of READING_IDS) {
        const blocks = arg.readings[rKey] ?? [];
        for (const b of blocks) {
          if (b.kind === "foundation" && !foundations.has(b.id)) {
            issue(
              "dangling-reference",
              arg.id,
              `Foundation block references missing foundation: ${b.id}`,
            );
          }
        }
      }
    }
  }

  for (const eq of equations.values()) {
    if (eq.paper && !papers.has(eq.paper)) {
      issue("dangling-reference", eq.id, `Equation references unknown paper: ${eq.paper}`);
    }
    if (eq.argument) {
      const arg = args.get(eq.argument);
      if (!arg) {
        issue("dangling-reference", eq.id, `Equation references unknown argument: ${eq.argument}`);
      } else if (arg.paper !== eq.paper) {
        issue(
          "equation-placement",
          eq.id,
          `Equation paper ${eq.paper} differs from argument paper ${arg.paper}`,
        );
      }
    }
    for (const note of eq.notes ?? []) {
      if (note.foundation && !foundations.has(note.foundation)) {
        issue(
          "dangling-reference",
          eq.id,
          `Equation note references missing foundation: ${note.foundation}`,
        );
      }
    }
  }

  for (const f of foundations.values()) {
    for (const p of f.prerequisites ?? []) {
      const pId =
        typeof p === "string"
          ? p
          : (p as { foundationId: string }).foundationId.replace(/^foundation:/, "");
      if (!foundations.has(pId)) {
        issue("dangling-reference", f.id, `Foundation prerequisite not found: ${pId}`);
      }
    }
    for (const cId of f.citations ?? []) {
      if (!citations.has(cId)) {
        issue("dangling-reference", f.id, `Foundation citation not found: ${cId}`);
      }
    }
  }

  // Directed graph prerequisite cycle checking
  const done = new Set<string>();
  const active = new Set<string>();
  function visitCycle(id: string): void {
    if (active.has(id)) {
      issue(
        "prerequisite-cycle",
        id,
        `A prerequisite cannot depend on its own conclusion: cycle at ${id}`,
      );
      return;
    }
    if (done.has(id)) return;
    active.add(id);

    const f = foundations.get(id);
    if (f) {
      const edges = [
        ...f.prerequisites
          .filter((p) => (typeof p === "string" ? true : p.kind !== "cross-link"))
          .map((p) => (typeof p === "string" ? p : p.foundationId.replace(/^foundation:/, ""))),
        ...[...f.explanation, ...f.example]
          .filter((b): b is Extract<Block, { kind: "foundation" }> => b.kind === "foundation")
          .map((b) => b.id),
      ];
      for (const e of edges) visitCycle(e);
    }

    const a = args.get(id);
    if (a) {
      const edges = (a.prerequisites ?? []).filter((p) => p.edge === "premise").map((p) => p.id);
      for (const e of edges) visitCycle(e);
    }

    active.delete(id);
    done.add(id);
  }

  for (const id of byId.keys()) {
    visitCycle(id);
  }

  const indexes: ContentIndexes = {
    byId,
    byKind,
    byPaper,
    papers,
    arguments: args,
    foundations,
    citations,
    equations,
    rawRecords: records,
  };

  return { indexes, errors };
}
