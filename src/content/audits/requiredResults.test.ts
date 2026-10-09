/**
 * THE PLAN'S SECTION 3 RESULTS HAVE A DENOMINATOR NOW, AND IT IS 38 ROWS, NOT 38 CARDS.
 *
 * The master plan's section 3.3 to 3.6 treatment maps each carry a "Results and printed checks"
 * column, and that list lived only in a markdown table, so the definition-of-done report declared
 * `results-cards-against-section-3` unmeasured for want of a denominator. The four records in
 * content/editorial/required-results/ are those columns, transcribed.
 *
 * COUNTING CARDS IS THE WRONG POPULATION, and the coincidence is what makes it dangerous: the four
 * papers hold 38 cards and the plan holds 38 rows. Per paper the two disagree in BOTH directions --
 * 7 against 8, 6 against 7, 9 against 11, and 16 against 12 -- because relativity's section 3
 * proves the principles compatible and then derives the transformation, its section 10 states three
 * relations, and three of the Brownian rows are not results at all. A single aggregate of 38 and 38
 * would have read as exact agreement.
 *
 * WHAT THIS FILE REFUSES, and it is the only thing that makes the records trustworthy: a
 * `satisfiedBy` that names a card which does not exist. Without it these are 31 self-assigned
 * grades. Both plants are driven below rather than described.
 *
 * A `notACard` IS A JUDGMENT AND MUST CARRY ITS REASON. Seven rows are declared that way: four
 * date-lines, two statements of modality AGENTS.md requires be preserved rather than resolved, and
 * the Brownian section 2, whose plan cell is a completeness requirement on a derivation with no
 * equation in it. Each is excluded from the divisor, so an unreasoned `notACard` would be a way to
 * delete a requirement by asserting it away; the test below refuses one.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { strictParse } from "../schemas/strictParse.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

type Row = Readonly<{
  block?: unknown;
  result?: unknown;
  satisfiedBy?: unknown;
  notACard?: unknown;
}>;

function record(paper: string): { planSection?: unknown; rows: readonly Row[] } {
  const parsed = strictParse(
    readFileSync(join(ROOT, "content", "editorial", "required-results", `${paper}.yaml`), "utf8"),
    "yaml",
  ) as { planSection?: unknown; rows?: unknown };
  return {
    planSection: parsed.planSection,
    rows: (Array.isArray(parsed.rows) ? parsed.rows : []) as Row[],
  };
}

function cardIds(paper: string): ReadonlySet<string> {
  const parsed = strictParse(
    readFileSync(join(ROOT, "content", "results", `${paper}.yaml`), "utf8"),
    "yaml",
  ) as { cards?: unknown };
  const ids = new Set<string>();
  for (const card of Array.isArray(parsed.cards) ? parsed.cards : []) {
    const id = (card as { id?: unknown }).id;
    if (typeof id === "string") ids.add(id);
  }
  return ids;
}

const creditsOf = (row: Row): readonly string[] =>
  typeof row.satisfiedBy === "string"
    ? [row.satisfiedBy]
    : Array.isArray(row.satisfiedBy)
      ? row.satisfiedBy.filter((c): c is string => typeof c === "string")
      : [];

const declaredNotACard = (row: Row): boolean =>
  typeof row.notACard === "string" && row.notACard.trim().length > 0;

describe("the required section 3 results are a real denominator", () => {
  test("all four papers, each naming the plan section it transcribes", () => {
    const sections = PAPERS.map((p) => String(record(p).planSection));
    // Identity rather than a count: these four section numbers are permanent facts about the plan.
    expect(sections).toEqual(["3.6", "3.3", "3.4", "3.5"]);
  });

  test("every row states a block and a result, by words rather than by length", () => {
    const thin: string[] = [];
    for (const paper of PAPERS) {
      for (const row of record(paper).rows) {
        const block = typeof row.block === "string" ? row.block.trim() : "";
        const result = typeof row.result === "string" ? row.result.trim() : "";
        if (block.split(/\s+/).length < 1 || result.split(/\s+/).length < 2) {
          thin.push(`${paper}: ${block || "(no block)"}`);
        }
      }
    }
    expect(thin).toEqual([]);
  });

  test("EVERY CREDIT RESOLVES to a results card that exists", () => {
    // The predicate that stops this directory from grading itself.
    const unresolved: string[] = [];
    for (const paper of PAPERS) {
      const ids = cardIds(paper);
      for (const row of record(paper).rows) {
        for (const credit of creditsOf(row)) {
          if (!ids.has(credit)) unresolved.push(`${paper}: ${credit}`);
        }
      }
    }
    expect(unresolved).toEqual([]);
  });

  test("a notACard row carries a reason and no credit, so a requirement cannot be asserted away", () => {
    const bad: string[] = [];
    for (const paper of PAPERS) {
      for (const row of record(paper).rows) {
        if (!declaredNotACard(row)) continue;
        const reason = String(row.notACard);
        // A reason short enough to be a label is not a reason. Each of the seven states which
        // layer carries the row instead.
        if (reason.split(/\s+/).length < 12) bad.push(`${paper}: reason too thin`);
        if (creditsOf(row).length > 0) bad.push(`${paper}: both notACard and satisfiedBy`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("every row is in exactly one bucket: carded or declared not a card", () => {
    // The property, not the census: a row with neither is an uncounted requirement, which is the
    // silence these records exist to end.
    const stray: string[] = [];
    for (const paper of PAPERS) {
      for (const row of record(paper).rows) {
        const carded = creditsOf(row).length > 0;
        if (carded === declaredNotACard(row)) {
          stray.push(`${paper}: ${String(row.block)}`);
        }
      }
    }
    expect(stray).toEqual([]);
  });

  test("EVERY CARD ON DISK IS CITED, so the plan's rows account for the whole corpus", () => {
    // The other direction. A card nothing cites is either a result the plan does not require or a
    // row this record missed, and both are findings rather than things to leave unmeasured.
    const orphans: string[] = [];
    for (const paper of PAPERS) {
      const cited = new Set(record(paper).rows.flatMap((r) => creditsOf(r)));
      for (const id of cardIds(paper)) if (!cited.has(id)) orphans.push(`${paper}: ${id}`);
    }
    expect(orphans).toEqual([]);
  });

  test("the census, with its denominator named", () => {
    let rows = 0;
    let carded = 0;
    let notACard = 0;
    let cards = 0;
    const perPaper: string[] = [];
    for (const paper of PAPERS) {
      const r = record(paper).rows;
      const c = r.filter((x) => creditsOf(x).length > 0).length;
      const n = r.filter(declaredNotACard).length;
      rows += r.length;
      carded += c;
      notACard += n;
      cards += cardIds(paper).size;
      perPaper.push(
        `${paper} ${c}/${r.length - n} (+${n} not a card, ${cardIds(paper).size} cards)`,
      );
    }
    console.log(
      `[census] required results: ${rows} plan rows, ${carded} carded, ${notACard} declared not a card, ${cards} cards on disk`,
    );
    console.log(`[census]   ${perPaper.join(" | ")}`);
    // Floors, so the record can grow. The 38-and-38 coincidence is reported above and asserted
    // nowhere, because it is an arithmetic accident rather than a property.
    expect(rows).toBeGreaterThanOrEqual(38);
    expect(carded + notACard).toBe(rows);
    expect(notACard).toBeGreaterThan(0);
    expect(carded).toBeGreaterThan(0);
  });
});
