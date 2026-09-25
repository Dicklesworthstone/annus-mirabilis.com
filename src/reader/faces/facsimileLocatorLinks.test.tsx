/**
 * A source face's "[p. N]" locator lands on printed page N of the facsimile face (dispatch 206).
 *
 * The locators used to point at /papers/<paper>/?view=facsimile#page-N, the explanation page's
 * in-page view, which renders no page anchors: measured on live on 2026-09-25, JavaScript rewrote
 * the hash to the paper's entry, and without it the reader got the reading view's top. The
 * facsimile route renders every printed page under an id (FacsimilePanel), statically. This holds
 * each locator on the faces that print them to that route and to an id the route's own markup has.
 */
import { describe, expect, test } from "bun:test";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";

const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;
const FACES = ["german", "parallel", "gloss"] as const;

const render = async (paperId: string, face: string) =>
  exportMarkup(await PaperPage({ paperId, face } as never));

/** Every locator link on a page: its printed page and where it points. */
function locators(html: string): { page: string; href: string }[] {
  return [...html.matchAll(/<a\b[^>]*\bdata-facsimile-link="(\d+)"[^>]*>/g)].map((m) => ({
    page: m[1] ?? "",
    href: m[0].match(/\bhref="([^"]*)"/)?.[1] ?? "",
  }));
}

const found: { paper: string; face: string; page: string; href: string }[] = [];
const facsimileIds = new Map<string, Set<string>>();
for (const paper of PAPERS) {
  const facsimile = await render(paper, "facsimile");
  facsimileIds.set(
    paper,
    new Set([...facsimile.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1] ?? "")),
  );
  for (const face of FACES)
    for (const l of locators(await render(paper, face))) found.push({ paper, face, ...l });
}

describe("source-face locators land on the facsimile face", () => {
  test("there are locators to check, on more than one paper", () => {
    console.log(
      `[facsimile locators] ${found.length} across ${new Set(found.map((f) => f.paper)).size} papers`,
    );
    expect(found.length).toBeGreaterThan(0);
    expect(new Set(found.map((f) => f.paper)).size).toBeGreaterThan(1);
  });

  test("each locator points at its printed page on the paper's facsimile route, and the route renders that id", () => {
    const wrong: string[] = [];
    for (const { paper, face, page, href } of found) {
      const [path, id] = href.split("#");
      if (path !== `/papers/${paper}/view/facsimile/`)
        wrong.push(`${paper} ${face} p. ${page}: points at ${href}, not the facsimile route`);
      else if (id !== `facsimile-page-${page}`)
        wrong.push(`${paper} ${face} p. ${page}: points at #${id}, not page ${page}`);
      else if (!facsimileIds.get(paper)?.has(id))
        wrong.push(`${paper} ${face} p. ${page}: the facsimile face has no id ${id}`);
    }
    expect(wrong).toEqual([]);
  });
});
