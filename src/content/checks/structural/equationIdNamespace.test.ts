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
import { checkDuplicateId } from "./structural.ts";

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
