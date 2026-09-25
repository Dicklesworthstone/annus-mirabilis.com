/**
 * A block's printed pages read in page order, as one label (dispatch 210).
 *
 * Each page was its own `float: right` span, and floats stack from the right, so a block on
 * pp. 891-892 printed "[p. 892][p. 891]". Checked on the component and on every multi-page block
 * the four papers' German faces print.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";
import { PageLocators } from "./PageLocators.tsx";

const label = (html: string) => html.replace(/<[^>]+>/g, "");
/** Every block-locator span, whole: from its opening tag to the </span> that closes it. */
function locatorSpans(html: string): string[] {
  const out: string[] = [];
  const open = '<span class="block-locator">';
  for (let at = html.indexOf(open); at !== -1; at = html.indexOf(open, at + 1)) {
    let depth = 0;
    const tag = /<\/?span\b[^>]*>/g;
    tag.lastIndex = at;
    for (let m = tag.exec(html); m; m = tag.exec(html)) {
      depth += m[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        out.push(html.slice(at, m.index + m[0].length));
        break;
      }
    }
  }
  return out;
}
const linked = (html: string) =>
  [...html.matchAll(/data-facsimile-link="(\d+)"/g)].map((m) => Number(m[1]));

describe("PageLocators", () => {
  test("one page is one link, as before", () => {
    const html = renderToStaticMarkup(<PageLocators paper="brownian-motion" pages={[556]} />);
    expect(label(html)).toBe("[p. 556]");
    expect(linked(html)).toEqual([556]);
  });

  test("two pages given in any order read in page order, each number its own link", () => {
    const html = renderToStaticMarkup(
      <PageLocators paper="special-relativity" pages={[892, 891]} />,
    );
    expect(label(html)).toBe("[pp. 891–892]");
    expect(linked(html)).toEqual([891, 892]);
    expect(html).toContain('href="/papers/special-relativity/view/facsimile/#facsimile-page-891"');
    expect((html.match(/class="block-locator"/g) ?? []).length).toBe(1);
  });

  test("consecutive pages are a run and a gap is a comma", () => {
    const html = renderToStaticMarkup(<PageLocators paper="p" pages={[895, 891, 892, 893]} />);
    expect(label(html)).toBe("[pp. 891–893, 895]");
    expect(linked(html)).toEqual([891, 893, 895]);
  });

  test("no pages, no label", () => {
    expect(renderToStaticMarkup(<PageLocators paper="p" pages={[]} />)).toBe("");
  });
});

describe("the German faces print each multi-page block's label in page order", () => {
  test("every block label's links run in ascending page order, one label per block", async () => {
    let multi = 0;
    const wrong: string[] = [];
    for (const paper of ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"]) {
      const html = await exportMarkup(await PaperPage({ paperId: paper, face: "german" } as never));
      for (const span of locatorSpans(html)) {
        const pages = linked(span);
        if (pages.length < 2) continue;
        multi += 1;
        if (pages.some((p, i) => i > 0 && p <= (pages[i - 1] ?? 0)))
          wrong.push(`${paper}: ${label(span)}`);
      }
    }
    console.log(`[multi-page locators] ${multi}`);
    expect(multi).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });
});
