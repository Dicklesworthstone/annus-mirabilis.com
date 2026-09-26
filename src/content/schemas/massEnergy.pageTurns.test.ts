/**
 * Mass-energy's page turns (dispatch 248), read from the plates: pdftoppm renders of the pinned
 * ap-18-639.pdf (sha256 c4770702…, checked against its receipt) at 150 dpi, the foot of each page
 * stacked over the top of the next. Of the paper's two page boundaries, one falls inside a
 * paragraph: s0-p7, from p. 640 to p. 641. At the other the paragraph ends on p. 639.
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

const DIR = join(process.cwd(), "content", "source-blocks", "mass-energy");
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

describe("mass-energy's page turns", () => {
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

  test("s0-p7: the eighth sentence runs across the turn, and 'Wir können also setzen' is on p. 641", () => {
    // p. 640 ends "willkürlichen addi-", p. 641 opens "tiven Konstanten der Energien H und E".
    const pages = sentencePages("s0-p7");
    expect(pages["s0-p7-s7"]).toBe("640");
    expect(pages["s0-p7-s8"]).toBe("640-641");
    expect(pages["s0-p7-s9"]).toBe("641");
    expect(pages["s0-p7-s12"]).toBe("641");
  });
});
