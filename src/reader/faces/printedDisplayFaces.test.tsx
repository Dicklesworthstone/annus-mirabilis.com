/**
 * Printed displays in colour on every reading face (dispatch 224), server-rendered, for each paper
 * whose record binds every display: mass-energy, the reference slice, and light quanta.
 * Before this, each face drew them as plain KaTeX: no term carried a quantity and no chip was drawn.
 * Each face now draws every display with its terms marked, the explanation's colours, and chips
 * that are real links to /notation/ until the page hydrates (dispatch 254; they were disabled
 * buttons before), and it puts no block element inside a <p>.
 */
import { describe, expect, test } from "bun:test";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";
import { loadBilingualEdition } from "./bilingualLoader.ts";

const FACES = ["german", "english", "parallel", "gloss"] as const;

const page = async (paper: string, face?: (typeof FACES)[number]) =>
  exportMarkup(await PaperPage(face ? { paperId: paper, face } : { paperId: paper }));

/** Every chip's quantity and its colour style, as the markup carries them: a link or a button. */
function chipStyles(html: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [chip] of html.matchAll(/<(?:button|a)[^>]*class="term-chip"[^>]*>/g)) {
    const quantity = /data-quantity-id="([^"]+)"/.exec(chip)?.[1];
    const style = /style="([^"]*)"/.exec(chip)?.[1] ?? "";
    if (quantity) out.set(quantity, new Set([...(out.get(quantity) ?? []), style]));
  }
  return out;
}

const BLOCK = new Set([
  "div",
  "ul",
  "ol",
  "li",
  "section",
  "p",
  "dl",
  "dt",
  "dd",
  "table",
  "aside",
  "nav",
  "figure",
  "blockquote",
]);
const VOID = new Set(["br", "img", "hr", "input", "meta", "link", "source", "wbr", "col"]);

type Open = Readonly<{ tag: string; display: boolean }>;

/**
 * Walks the markup's tags, calling visit for each opened one with the elements open around it.
 * MathML is skipped whole: its tag names are not HTML's.
 */
function walk(
  html: string,
  visit: (tag: string, attributes: string, open: readonly Open[]) => void,
) {
  const stack: Open[] = [];
  let inMath = 0;
  for (const [, close, name, attributes] of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/g)) {
    const tag = name as string;
    if (tag === "math") {
      inMath += close ? -1 : 1;
      continue;
    }
    if (inMath > 0 || VOID.has(tag)) continue;
    if (close) {
      const at = stack.map((o) => o.tag).lastIndexOf(tag);
      if (at >= 0) stack.splice(at);
      continue;
    }
    visit(tag, attributes ?? "", stack);
    stack.push({ tag, display: /\bdata-display-terms="/.test(attributes ?? "") });
  }
}

/** Block elements opened while a <p> is open: each would end the paragraph when parsed. */
function blocksInParagraphs(html: string): string[] {
  const found: string[] = [];
  walk(html, (tag, _, open) => {
    if (BLOCK.has(tag) && open.some((o) => o.tag === "p")) found.push(tag);
  });
  return found;
}

/** Live regions inside a printed display's block. */
function liveRegionsInDisplays(html: string): number {
  let found = 0;
  walk(html, (_, attributes, open) => {
    if (/\brole="status"/.test(attributes) && open.some((o) => o.display)) found++;
  });
  return found;
}

/** Displays drawn on the page, and how many of them sit outside a coloured block. */
function displaysOutsideBlocks(html: string): { drawn: number; outside: number } {
  let drawn = 0;
  let outside = 0;
  walk(html, (_, attributes, open) => {
    if (!/\bclass="katex-display"/.test(attributes)) return;
    drawn++;
    if (!open.some((o) => o.display)) outside++;
  });
  return { drawn, outside };
}

// Each paper's record binds every display it prints; a sample spoken form shows the block's name.
const PAPERS = [
  { paper: "mass-energy", spoken: "K zero minus K one equals" },
  { paper: "light-quanta", spoken: "nu two is at most nu one" },
] as const;

for (const { paper, spoken } of PAPERS)
  describe(`${paper}'s printed displays on the reading faces`, async () => {
    const edition = await loadBilingualEdition(paper);
    const displays = (edition?.blocks ?? []).filter((b) => b.kind === "equation").map((b) => b.id);
    const explanation = chipStyles(await page(paper));

    test("the paper prints displays, and the explanation colours its quantities", () => {
      expect(displays.length).toBeGreaterThan(0);
      expect(explanation.size).toBeGreaterThan(0);
    });

    for (const face of FACES)
      test(`${face}: every display is coloured, in the explanation's colours, with live-less chips`, async () => {
        const html = await page(paper, face);
        // The German and English faces print every display; the gloss face the glossed ones.
        if (face !== "gloss")
          for (const display of displays) expect(html).toContain(`data-display-terms="${display}"`);
        const { drawn, outside } = displaysOutsideBlocks(html);
        expect(drawn).toBeGreaterThan(0);
        expect(outside).toBe(0);
        // One colour per quantity: the face's chip for a quantity is the explanation's.
        const styles = chipStyles(html);
        expect(styles.size).toBeGreaterThan(0);
        for (const [quantity, style] of styles) {
          expect(style.size).toBe(1);
          const theirs = explanation.get(quantity);
          if (theirs) expect([...style]).toEqual([...theirs]);
        }
        // Without JavaScript every chip is a real link to /notation/ (dispatch 254), and none is a
        // button, which only hydration could make work.
        expect(html).not.toMatch(/<button[^>]*class="term-chip"/);
        const links = [...html.matchAll(/<a[^>]*class="term-chip"[^>]*>/g)].map(([a]) => a);
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) expect(link).toMatch(/ href="\/notation\/#[^"]+"/);
        // No live region per display: a face holds many (BlockTermChips announce).
        expect(liveRegionsInDisplays(html)).toBe(0);
        // Each block is named by its authored spoken form.
        expect(html).toContain(`aria-label="${spoken}`);
        expect(blocksInParagraphs(html)).toEqual([]);
      });
  });

describe("the markup checkers", () => {
  test("the two checkers find what they look for when it is there", () => {
    expect(blocksInParagraphs("<p>a <div>b</div></p>")).toEqual(["div"]);
    expect(blocksInParagraphs("<p>a <span>b</span></p><div></div>")).toEqual([]);
    const live = '<span data-display-terms="d"><span role="status"></span></span>';
    expect(liveRegionsInDisplays(live)).toBe(1);
    expect(liveRegionsInDisplays(`<span data-display-terms="d"></span><p role="status"></p>`)).toBe(
      0,
    );
    const inside = '<span data-display-terms="d"><span class="katex-display"></span></span>';
    expect(displaysOutsideBlocks(inside)).toEqual({ drawn: 1, outside: 0 });
    expect(displaysOutsideBlocks('<p><span class="katex-display"></span></p>')).toEqual({
      drawn: 1,
      outside: 1,
    });
  });
});
