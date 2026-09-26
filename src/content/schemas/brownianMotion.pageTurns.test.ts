/**
 * Brownian motion's page turns (dispatch 248), read from the plates: pdftoppm renders of the pinned
 * ap-17-549.pdf (sha256 0192ff57…, checked against its receipt) at 150 dpi, the foot of each page
 * stacked over the top of the next. Of the paper's eleven page boundaries, seven fall inside a
 * paragraph (s1-p1, s1-p3, s2-p4, s3-p5, s3-p8, s4-p6, s4-p11). At the other four a paragraph ends
 * on the page: pp. 551, 553, 556 and 559.
 *
 * The first test is the completeness property, as in specialRelativity.pageTurns.test.ts; the
 * second pins what the plate shows at sentence level, and fails on a turn moved to other words.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { spanPages } from "./pageTurns.ts";
import { type SourceBlock, validateSourceBlock } from "./source.ts";

const DIR = join(process.cwd(), "content", "source-blocks", "brownian-motion");
const load = (id: string): SourceBlock =>
  validateSourceBlock(parseYaml(readFileSync(join(DIR, `${id}.yaml`), "utf8")), id);

/** The pages of each sentence of a block, as "first" or "first-last". */
function sentencePages(id: string): Record<string, string> {
  const block = load(id);
  return Object.fromEntries(
    block.sentenceSpans.map((s) => {
      const pages = spanPages(block.locators, block.pageTurns ?? [], s.span);
      const label =
        pages && pages.last !== pages.first ? `${pages.first}-${pages.last}` : `${pages?.first}`;
      return [s.id, label];
    }),
  );
}

describe("Brownian motion's page turns", () => {
  test("every block with text printed on more than one page records where the text turns", () => {
    const multi = readdirSync(DIR)
      .filter(
        (f) => f.endsWith(".yaml") && !f.startsWith("manifest") && f !== "ledger-allowlist.yaml",
      )
      .map((f) => load(f.slice(0, -5)))
      .filter((b) => b.locators.length > 1 && b.kind !== "equation");
    // Non-vacuity: with no multi-page block the check below would pass having examined nothing.
    expect(multi.length).toBeGreaterThan(0);
    expect(multi.filter((b) => (b.pageTurns ?? []).length === 0).map((b) => b.id)).toEqual([]);
  });

  test("s4-p11: the random-errors sentence runs across the turn, and 'Von Bedeutung aber ist' is on p. 559", () => {
    // p. 558 ends "die der zu-", p. 559 opens "fälligen Fehler, was zu vermuten war."
    expect(sentencePages("s4-p11")).toEqual({
      "s4-p11-s1": "558-559",
      "s4-p11-s2": "559",
      "s4-p11-s3": "559",
    });
  });
});
