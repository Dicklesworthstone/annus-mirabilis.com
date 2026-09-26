/**
 * Relativity's page turns (dispatch 247), read from the plates: pdftoppm renders of the pinned
 * ap-17-891.pdf (sha256 60d21d56…, checked against its receipt), the top of each page a paragraph
 * turns onto. The machine-draft ledger's page starts agree at all 26.
 *
 * The first test is the completeness property: a paragraph whose locators list two pages records
 * where its text turns. The rest pin what the plates show at sentence level, and fail on a turn
 * moved to the wrong words.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { spanPages } from "./pageTurns.ts";
import { type SourceBlock, validateSourceBlock } from "./source.ts";

const DIR = join(process.cwd(), "content", "source-blocks", "special-relativity");
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

describe("relativity's page turns", () => {
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

  test("s5-p2: the eighth sentence is on p. 906, and the fourth runs across the turn", () => {
    // p. 906 opens "α ist dann als der Winkel zwischen den Geschwindigkeiten".
    const pages = sentencePages("s5-p2");
    expect(pages["s5-p2-s3"]).toBe("905");
    expect(pages["s5-p2-s4"]).toBe("905-906");
    expect(pages["s5-p2-s8"]).toBe("906");
  });

  test("s0-p2: the principle is announced across the turn, and the ether sentence is on p. 892", () => {
    // p. 892 opens "Voraussetzung einführen, daß sich das Licht im leeren Raume".
    expect(sentencePages("s0-p2")).toEqual({
      "s0-p2-s1": "891",
      "s0-p2-s2": "891-892",
      "s0-p2-s3": "892",
      "s0-p2-s4": "892",
    });
  });

  test("s4-p8: the equator sentence is on p. 905, after the divided word unbewegt", () => {
    // p. 904 ends "un-", p. 905 opens "bewegt gebliebenen um ½ t(v/V)² Sek. nach."
    const pages = sentencePages("s4-p8");
    expect(pages["s4-p8-s1"]).toBe("904-905");
    expect(pages["s4-p8-s2"]).toBe("905");
  });

  test("s8-p7: only its displays stand on p. 915, so every sentence is on p. 914", () => {
    expect(new Set(Object.values(sentencePages("s8-p7")))).toEqual(new Set(["914"]));
  });
});
