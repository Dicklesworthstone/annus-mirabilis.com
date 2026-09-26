/**
 * Light quanta's page turns (dispatch 248), read from the plates: pdftoppm renders of the pinned
 * ap-17-132.pdf (sha256 494f074d…, checked against its receipt) at 150 dpi, the foot of each page
 * stacked over the top of the next, and the turn onto p. 145 again at 300 dpi. Of the paper's
 * sixteen page boundaries, twelve fall inside a paragraph. At the other four a paragraph ends on
 * the page: pp. 135, 141, 144 and 146. At 144→145, s7-p3 opens indented, so s7-p2 ends on p. 144.
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

const DIR = join(process.cwd(), "content", "source-blocks", "light-quanta");
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

describe("light quanta's page turns", () => {
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

  test("s9-p1: the first sentence runs across the turn, and 'Hieraus folgt zunächst' is on p. 148", () => {
    // p. 147 ends "je ein absorbiertes Licht-", p. 148 opens "energiequant zur Ionisierung je
    // eines Gasmoleküles"; the divided word belongs to p. 147.
    expect(sentencePages("s9-p1")).toEqual({
      "s9-p1-s1": "147-148",
      "s9-p1-s2": "148",
      "s9-p1-s3": "148",
      "s9-p1-s4": "148",
    });
  });

  test("s2-p2: the page turns between sentences, so 'Man erkennt' is wholly on p. 137", () => {
    // p. 136 ends with the display rho_nu = (alpha/beta) nu^2 T; p. 137 opens "Man erkennt, daß".
    const pages = sentencePages("s2-p2");
    expect(pages["s2-p2-s2"]).toBe("136");
    expect(pages["s2-p2-s3"]).toBe("137");
  });
});
