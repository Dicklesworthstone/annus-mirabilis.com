/**
 * WHAT THE CIRCULARITY CHECKS ACTUALLY ITERATE, AND WHY TWO OF THEM SEE NOTHING (pcjk.11).
 *
 * AGENTS.md's "No circular explanations" asks for acyclic proof graphs and for historical
 * derivation edges to be distinguishable from modern verification oracles by EDGE TYPE rather than
 * by prose. Two of the three checks written for that run over an empty population, and a third
 * runs over a real one. This file pins which is which, because a check over nothing is
 * indistinguishable from a clean one and that is the whole hazard.
 *
 * MEASURED, and these are the numbers the bead's plan has to survive:
 *
 *   `kind: "proof"` records in content/              0   -> epistemic.proof-cycle sees nothing
 *   records matching isArgumentNodeRecord            0   -> oracle-in-historical-route sees nothing
 *   argument records                                48
 *   premises on them                               105, ALL PROSE
 *   prerequisite edges                              42 across 37 records: 39 premise, 3 cross-reference
 *
 * isArgumentNodeRecord fails twice over, independently: no record is `kind: "argument-node"` (all
 * 48 are `kind: "argument"`), and no first premise is an object carrying `edgeType` and `ref`.
 *
 * THE PLAN AS WRITTEN CANNOT BE APPLIED TO `premises`, and that is the finding rather than a
 * quibble. It proposes `{ ref, edgeType }` on each premise, but a premise here is a free-standing
 * assumption sentence -- "Light has the same speed in every direction, not only along x" -- with
 * nothing for `ref` to point at. Typing them would mean minting an id for each of 105 assumptions,
 * which is a content-model change and not a migration.
 *
 * MEANWHILE THE EDGES ALREADY EXIST, on a different field with a different vocabulary.
 * `prerequisites` carries `{ id, edge }`, and compile.ts:416 walks `edge === "premise"` for the
 * cycle check that works. So the repository has `edge`/`id` and the predicate wants
 * `edgeType`/`ref`: the review comment on this bead reads that mismatch as "use edgeType, not
 * edge", and the direction is the other way round -- `edge` is what the data and the working
 * check already use, and the predicate is looking at the wrong FIELD, not the wrong spelling.
 * Pointing it at `prerequisites` would make it match 37 records today, with no migration at all.
 *
 * WHAT IS GENUINELY MISSING is AGENTS.md's distinction itself: the live vocabulary is `premise`
 * and `cross-reference`, and neither says whether an edge is a historical derivation or a modern
 * oracle. That is an editorial judgement over 42 edges and is not made here.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isArgumentNodeRecord, isProofRecord } from "./records.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function jsonFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) jsonFiles(path, out);
    else if (entry.endsWith(".json")) out.push(path);
  }
  return out;
}

const records = jsonFiles(join(ROOT, "content/arguments")).map(
  (f) => JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>,
);

describe("the populations the circularity checks see", () => {
  test("no record in content/ is a proof, so proof-cycle iterates nothing", () => {
    const proofs = jsonFiles(join(ROOT, "content"))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>;
        } catch {
          return {};
        }
      })
      .filter(isProofRecord);
    console.log(`[census] proof records in content/: ${proofs.length}`);
    // A ceiling at zero is the honest shape: the day a proof record lands, this says so by
    // failing, and the check stops being vacuous.
    expect(proofs.length).toBe(0);
  });

  test("isArgumentNodeRecord matches none of the argument records, in two ways", () => {
    expect(records.length).toBeGreaterThanOrEqual(48);
    const matched = records.filter(isArgumentNodeRecord);
    console.log(
      `[census] isArgumentNodeRecord matched ${matched.length} of ${records.length} argument records`,
    );
    expect(matched.length).toBe(0);
    // The two independent reasons, asserted so a partial repair cannot look like a whole one.
    expect(records.filter((r) => r.kind === "argument-node").length).toBe(0);
    const objectFirstPremise = records.filter((r) => {
      const premises = r.premises;
      return Array.isArray(premises) && premises.length > 0 && typeof premises[0] === "object";
    });
    expect(objectFirstPremise.length).toBe(0);
  });

  test("every premise is prose, so there is nothing for a `ref` to point at", () => {
    const premises = records.flatMap((r) => (Array.isArray(r.premises) ? r.premises : []));
    const prose = premises.filter((p) => typeof p === "string");
    console.log(`[census] argument premises: ${premises.length}, of which ${prose.length} prose`);
    expect(premises.length).toBeGreaterThanOrEqual(105);
    expect(prose.length).toBe(premises.length);
    // And they are sentences, not ids wearing a string: an id-shaped premise would make the
    // bead's `{ref, edgeType}` plan applicable, so this is the assertion that would change it.
    const idShaped = prose.filter((p) => /^(arg-|prem-|cit-|s\d+-p)/.test(String(p)));
    expect(idShaped).toEqual([]);
  });

  test("the typed edges that DO exist are on `prerequisites`, with their own vocabulary", () => {
    const edges = records.flatMap((r) =>
      Array.isArray(r.prerequisites) ? (r.prerequisites as Record<string, unknown>[]) : [],
    );
    const byType: Record<string, number> = {};
    for (const e of edges) {
      const type = typeof e === "object" && e !== null ? String(e.edge ?? "(none)") : "(string)";
      byType[type] = (byType[type] ?? 0) + 1;
    }
    console.log(
      `[census] prerequisite edges: ${edges.length} across ` +
        `${records.filter((r) => Array.isArray(r.prerequisites) && r.prerequisites.length > 0).length} ` +
        `records, by type ${JSON.stringify(byType)}`,
    );
    expect(edges.length).toBeGreaterThanOrEqual(42);
    // The field is `edge` and the referent is `id`. Naming both here is the point: the predicate
    // wants `edgeType` and `ref`, and this is what the data and compile.ts:416 actually use.
    expect(edges.every((e) => "edge" in e && "id" in e)).toBe(true);
    expect(byType.premise).toBeGreaterThanOrEqual(39);
    // AGENTS.md's distinction is absent from this vocabulary, which is the real gap.
    expect(byType["historical-derivation"]).toBeUndefined();
    expect(byType["modern-verification-oracle"]).toBeUndefined();
  });
});
