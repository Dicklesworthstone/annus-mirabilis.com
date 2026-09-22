import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { KNOWN_TAG_NAMES } from "./ledgerTokenizer.ts";

/**
 * EVERY DOCUMENTED MARKER MUST BE ONE THE TOKENIZER KNOWS (am-2e4y).
 *
 * The bead reported that LEDGER_FORMAT.md documents [[ARTICLE-NUMBER]] and "the validator has
 * never heard of it". Measured, the premise is inverted and names the wrong token:
 *
 *     documented markers                       22
 *     documented but unknown to the tokenizer   1   MATH-REGION
 *     ARTICLE-NUMBER in the tokenizer          YES  (ledgerTokenizer.ts)
 *     ARTICLE-NUMBER named in validateLedger    no  (tokenized, never validated)
 *
 * So there are TWO different divergences and the bead conflated them. MATH-REGION is documented
 * syntax nothing implements. ARTICLE-NUMBER is implemented syntax the validator never mentions.
 *
 * NEITHER IS USED BY THE CORPUS: 0 of 257 markers across 4 transcripts, each. So no ledger breaks
 * either way, and the question of which side to change - implement the syntax, or withdraw it from
 * the doc - is editorial rather than technical. This gate does not decide it. It records the gap
 * with its denominator and stops a SECOND one appearing, which is the part that is unambiguous.
 */

const DOC = "docs/editorial/LEDGER_FORMAT.md";

/**
 * Documented but unimplemented, recorded rather than silently tolerated.
 * Withdraw MATH-REGION from the doc or teach the tokenizer, then delete this entry.
 */
const DOCUMENTED_BUT_UNIMPLEMENTED = ["MATH-REGION"];

export function documentedMarkers(): readonly string[] {
  const text = readFileSync(DOC, "utf8");
  return [...new Set([...text.matchAll(/\[\[([A-Z][A-Z0-9-]+)/g)].map((m) => m[1] ?? ""))].sort();
}

describe("documented ledger markers (am-2e4y)", () => {
  test("every marker the format document describes is known to the tokenizer", () => {
    const documented = documentedMarkers();
    const known: ReadonlySet<string> = KNOWN_TAG_NAMES;

    // Vacuity guard: a doc that stopped listing markers would pass trivially.
    expect(documented.length).toBeGreaterThan(15);

    const unimplemented = documented.filter((m) => !known.has(m));
    console.log(
      `[ledger markers] ${documented.length} documented, ${unimplemented.length} unimplemented (recorded: ${DOCUMENTED_BUT_UNIMPLEMENTED.length})`,
    );
    const unexpected = unimplemented.filter((m) => !DOCUMENTED_BUT_UNIMPLEMENTED.includes(m));
    expect(
      unexpected,
      `LEDGER_FORMAT.md documents markers the tokenizer cannot produce, so a transcriber ` +
        `following the document would write syntax nothing reads: ${unexpected.join(", ")}`,
    ).toEqual([]);

    // Pawl: if a recorded gap is closed, this list must shrink in the same commit.
    expect(
      unimplemented.length,
      `${unimplemented.length} unimplemented markers remain, fewer than the ` +
        `${DOCUMENTED_BUT_UNIMPLEMENTED.length} recorded. Remove the closed one from ` +
        `DOCUMENTED_BUT_UNIMPLEMENTED in this same commit.`,
    ).toBeGreaterThanOrEqual(DOCUMENTED_BUT_UNIMPLEMENTED.length);
  });
});
