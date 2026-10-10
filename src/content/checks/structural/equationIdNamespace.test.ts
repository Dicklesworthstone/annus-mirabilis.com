/**
 * AN EQUATION ID IS GLOBAL FOR A RECORD AND PER-PAPER FOR A PRINTED BLOCK (am-as1w follow-on).
 *
 * `checkDuplicateId` keyed every record whose `kind` is "equation" into one global set. Two
 * different families carry that kind:
 *
 *   an equation RECORD under content/equations/, addressed by bare id from any paper, so its id
 *   must be unique across all of them — measured 2026-09-28, 154 records and 0 duplicates;
 *
 *   a SOURCE BLOCK, a printed display under content/source-blocks/<paper>/, whose id is per-paper
 *   by design — 200 blocks, 47 ids present in more than one paper, 117 (paper, id) pairs involved,
 *   so the global reading reported 117 - 47 = 70 duplicate-id errors about a correct corpus.
 *
 * AGENTS.md is the authority and it qualifies a repeat only "when a printed number repeats within a
 * paper"; sentence ids such as `s3-p2-s1` carry no paper prefix, which only works in a per-paper
 * namespace; and an editorial note crosses that namespace with an explicit `paper#id`.
 *
 * The three tests below are the two arms the repair has to satisfy at once. Loosening a duplicate
 * check is exactly the shape a weakened gate hides in, so the arm that must still REFUSE is tested
 * beside the arm that must now ACCEPT, and a run where both do not hold is a failure.
 */
import { describe, expect, test } from "bun:test";
import type { CheckContext, CheckReportItem } from "../../compiler/checks/registry.ts";
import { compileContent } from "../../compiler/compile.ts";
import { recordKeyFor } from "../../compiler/recordKey.ts";
import { checkDuplicateId, checkEquationNotIdentical } from "./structural.ts";

/**
 * KEYS A FIXTURE THE WAY THE COMPILER KEYS THE REAL CORPUS (am-rc1001-bridge-plan-pcjk.10).
 *
 * A source block is identified by its KEY, `source-block:<paper>:<id>` (recordKey.ts), never by a
 * `kind` field: a block's own kind is `paragraph`, `equation`, `heading` and so on, and none of
 * the 453 committed blocks carries the string "source-block". These fixtures wrote that string as
 * `kind` and keyed by bare id, so every assertion here was made against a key shape production
 * never produces -- which is how seven branches in structural.ts could test for a record that
 * cannot exist while their tests stayed green.
 */
function keyFor(id: string, record: unknown): string {
  // A key the fixture already wrote in production form is left alone. Rewriting it would collapse
  // two DISTINCT keys that declare the same id -- which is the one within-paper duplicate that is
  // actually reachable, since `path-identity` makes two files with one id unconstructible.
  if (id.includes(":")) return id;
  if (!record || typeof record !== "object") return id;
  const rec = record as Record<string, unknown>;
  // ONLY `source-block`, deliberately. Keying translation units here too is more faithful still,
  // and it reddens two further sites that read a unit by BARE id -- `checkDuplicateId`'s unit arm
  // and `checkSpanDigestMismatch`'s target lookup at structural.ts:1684. Both are the same defect
  // one layer along and both are recorded on am-rc1001-bridge-plan-pcjk.10; widening this helper
  // to reach them belongs in the commit that repairs them, not in this one.
  if (rec.kind !== "source-block") return id;
  const paper = typeof rec.paper === "string" ? rec.paper : (rec.paperSlug as string) || "";
  const recordId = typeof rec.id === "string" ? rec.id : id;
  return `source-block:${paper}:${recordId}`;
}

/** The fixture map, with source blocks under their production keys. */
function fixtureRecords(records: Record<string, unknown>): Map<string, unknown> {
  return new Map<string, unknown>(
    Object.entries(records).map(([id, record]) => [keyFor(id, record), record]),
  );
}

function run(records: Record<string, unknown>): CheckReportItem[] {
  const reports: CheckReportItem[] = [];
  const ctx: CheckContext = {
    records: fixtureRecords(records),
    files: [],
    indexes: {},
    report: (item: CheckReportItem) => reports.push(item),
  };
  checkDuplicateId.run(ctx);
  return reports;
}

const block = (id: string) => ({ kind: "equation", id });

describe("the equation id namespace", () => {
  test("two equation RECORDS sharing an id are still refused by name", () => {
    // The arm that must not be lost. Equation records are keyed by bare id, so this is the
    // population the global rule was written for and it is unchanged.
    const reports = run({
      "eq-model-sr-one": { kind: "equation", id: "eq-model-sr-one" },
      "eq-model-sr-one-copy": { kind: "equation", id: "eq-model-sr-one" },
    });
    expect(reports).toHaveLength(1);
    expect(reports[0]?.rule).toBe("duplicate-id");
    expect(reports[0]?.message).toContain("eq-model-sr-one");
    expect(reports[0]?.message).toContain("globally");
  });

  test("the same printed id in two different papers is accepted", () => {
    // The arm the corpus needs. eq-s1-d1 is a real id in four papers.
    const reports = run({
      [recordKeyFor("source-block", "special-relativity", "eq-s1-d1")]: block("eq-s1-d1"),
      [recordKeyFor("source-block", "light-quanta", "eq-s1-d1")]: block("eq-s1-d1"),
      [recordKeyFor("source-block", "brownian-motion", "eq-s1-d1")]: block("eq-s1-d1"),
      [recordKeyFor("source-block", "mass-energy", "eq-s1-d1")]: block("eq-s1-d1"),
    });
    expect(reports).toEqual([]);
  });

  test("checkDuplicateId: (structural.ts:368) the same printed id twice in ONE paper is refused, naming the paper", () => {
    // The scoped arm, reached the way its comment describes: a caller that keys blocks by something
    // other than the id still gets a verdict. Two keys, one paper, one declared id.
    const reports = run({
      [recordKeyFor("source-block", "special-relativity", "eq-alpha")]: block("eq-s1-d1"),
      [recordKeyFor("source-block", "special-relativity", "eq-beta")]: block("eq-s1-d1"),
    });
    expect(reports).toHaveLength(1);
    expect(reports[0]?.rule).toBe("duplicate-id");
    expect(reports[0]?.message).toContain("eq-s1-d1");
    expect(reports[0]?.message).toContain("special-relativity");
    // And it says which namespace it judged, so the refusal cannot be read as the global one.
    expect(reports[0]?.message).toContain("within paper");
  });

  test("the compiler refuses two source blocks in one paper that declare the same id", () => {
    // The real within-paper path, and the mechanism is not a duplicate key. `path-identity` binds a
    // block's id to its filename stem, so two files in one paper cannot declare the same id at all:
    // the collision is unconstructible rather than caught after the fact. Asserting the refusal
    // that actually fires, rather than the one I first assumed, is the point of keeping this arm.
    const yaml = (id: string) =>
      `id: "${id}"\nkind: "equation"\npaper: "special-relativity"\nsection: "s1"\norder: 1\n`;
    return compileContent([
      { path: "source-blocks/special-relativity/eq-dup-one.yaml", text: yaml("eq-dup-x") },
      { path: "source-blocks/special-relativity/eq-dup-two.yaml", text: yaml("eq-dup-x") },
    ]).then((result) => {
      const ds = (result as unknown as { diagnostics: Array<Record<string, unknown>> }).diagnostics;
      const refused = ds.filter((d) => String(d.code) === "path-identity");
      expect(refused.length).toBe(2);
      expect(JSON.stringify(refused)).toContain("eq-dup-x");
      expect(JSON.stringify(refused)).toContain("eq-dup-one");
      expect(JSON.stringify(refused)).toContain("eq-dup-two");
    });
  });
});

/**
 * THE EQUATION-IDENTITY MAPS ARE SCOPED BY PAPER, AND 47 OF 130 IDS NEED IT
 * (am-rc1001-bridge-plan-pcjk.10).
 *
 * Measured 2026-10-10 over `content/source-blocks`: 200 equation block FILES carry only 130
 * distinct ids, because an equation id is per-paper and `eq-s1-d1`, `eq-s2-d1` and 45 others are
 * used by two or three papers. `germanEquations` and `englishEquations` were keyed by BARE id, so
 * each collision kept one survivor and 70 real blocks were never compared -- while the check
 * reported 200 pairs and no differences. A clean verdict over two thirds of the population it
 * named.
 *
 * The probe that found it: planting ", PLANTED" into brownian-motion's `eq-s1-d1` translation unit
 * produced ZERO reports, because special-relativity's unit of the same id had overwritten it in
 * the map; planting into all 914 inline latex nodes produced 200. After scoping, the single plant
 * produces exactly 1 and restoring it returns to 0.
 */
describe("the equation-identity maps are scoped by paper", () => {
  function identityReports(records: Record<string, unknown>): CheckReportItem[] {
    const reports: CheckReportItem[] = [];
    checkEquationNotIdentical.run({
      records: new Map<string, unknown>(Object.entries(records)),
      files: [],
      indexes: {},
      report: (item: CheckReportItem) => reports.push(item),
    } as CheckContext);
    return reports;
  }

  /** One paper's German block, English unit and the alignment edge joining them. */
  function paperTriple(paper: string, id: string, germanLatex: string, englishLatex: string) {
    return {
      [recordKeyFor("source-block", paper, id)]: {
        kind: "equation",
        id,
        paper,
        latex: germanLatex,
      },
      [recordKeyFor("translation-unit", paper, id)]: {
        kind: "translation-unit",
        id,
        paper,
        latex: englishLatex,
      },
      [recordKeyFor("alignment", paper, `al-${paper}`)]: {
        kind: "alignment",
        id: `al-${paper}`,
        paper,
        edges: [{ source: { blockId: id }, target: { translationUnitId: id } }],
      },
    };
  }

  test("two papers sharing an equation id are each compared against their OWN translation", () => {
    // The defect, in its smallest form. Both papers print `eq-s1-d1`; brownian's translation is
    // WRONG and relativity's is right. Keyed by bare id, relativity's pair overwrote brownian's
    // and the wrong one was never seen.
    const records = {
      ...paperTriple("brownian-motion", "eq-s1-d1", "p V^* = R T z.", "p V^* = R T z. WRONG"),
      ...paperTriple(
        "special-relativity",
        "eq-s1-d1",
        "t_B - t_A = t'_A - t_B .",
        "t_B - t_A = t'_A - t_B .",
      ),
    };
    const reports = identityReports(records);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.rule).toBe("equation-not-identical");
    expect(reports[0]?.recordId).toBe("eq-s1-d1");
    // And it is BROWNIAN's edge that is named, not relativity's, which is the discrimination a
    // bare-id map cannot make.
    expect(String(reports[0]?.path)).toContain("al-brownian-motion");
  });

  test("the same id in two papers, both correct, is silent: the scoping does not invent findings", () => {
    const records = {
      ...paperTriple("brownian-motion", "eq-s1-d1", "p V^* = R T z.", "p V^* = R T z."),
      ...paperTriple(
        "special-relativity",
        "eq-s1-d1",
        "t_B - t_A = t'_A - t_B .",
        "t_B - t_A = t'_A - t_B .",
      ),
    };
    expect(identityReports(records)).toEqual([]);
  });

  test("an edge whose paper matches neither end compares nothing, rather than guessing", () => {
    // The boundary. Scoping means a lookup can MISS, and a miss must stay silent: an edge is not
    // this check's business unless both of its ends are equations in the edge's own paper.
    const records = {
      ...paperTriple("brownian-motion", "eq-s1-d1", "p V^* = R T z.", "p V^* = R T z. WRONG"),
    };
    (
      records[recordKeyFor("alignment", "brownian-motion", "al-brownian-motion")] as {
        paper: string;
      }
    ).paper = "light-quanta";
    expect(identityReports(records)).toEqual([]);
  });
});
