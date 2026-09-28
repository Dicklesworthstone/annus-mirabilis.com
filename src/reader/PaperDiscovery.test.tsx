/**
 * EVERY PAPER NAMES ITS DISCOVERY ROUTE, IN BOTH SHELLS.
 *
 * Measured on live 2026-09-28 before this landed: each of the four paper pages carried exactly one
 * /discover/ link and it was the index, from the global nav, while the routes linked back to the
 * papers. The arrow ran one way through what AGENTS.md calls the site's signature content.
 *
 * PaperReader serves brownian-motion alone and PaperPage serves the other three, which is the
 * population error that let an earlier feature ship reaching 2 of 15 sections. Both are rendered
 * here.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ROUTE_INDEX } from "../discovery/routeIndex.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperDiscovery } from "./PaperDiscovery.tsx";
import { PaperPage } from "./PaperPage.tsx";
import { PaperReader } from "./PaperReader.tsx";
import { listReadablePapers } from "./paperRoutes.ts";

/**
 * React separates two adjacent text expressions with an HTML comment, so `, in {n} steps` reaches
 * the markup as ", in <!-- -->8<!-- --> steps" and a plain includes("8 steps") fails on a page that
 * renders correctly. Strip comments before searching for reader-visible text.
 */
function readerText(html: string): string {
  return html.replaceAll(/<!--.*?-->/g, "");
}

const papers = await listReadablePapers();
const routed = new Set<string>(ROUTE_INDEX.map((entry) => entry.slug));

describe("a paper names the route a reader could take through it", () => {
  test("the population is real: every readable paper has a route to link", () => {
    console.log(
      `[paper discovery] ${ROUTE_INDEX.length} routes; ${papers.filter((p) => routed.has(p)).length} ` +
        `of ${papers.length} readable papers have one`,
    );
    expect(ROUTE_INDEX.length).toBeGreaterThan(3);
    expect(papers.length).toBeGreaterThan(3);
    for (const paper of papers) expect(routed.has(paper)).toBe(true);
  });

  test("PaperReader's paper links its own route, with the step count from the record", async () => {
    const html = await exportMarkup(await PaperReader({}));
    const route = ROUTE_INDEX.find((entry) => entry.slug === "brownian-motion");
    expect(route).toBeDefined();
    expect(html).toContain('href="/discover/brownian-motion/"');
    expect(readerText(html)).toContain(`${route?.steps.length} steps`);
  });

  // The union PaperPage accepts; a bare string[] does not typecheck against it.
  const shellPapers = ["special-relativity", "light-quanta", "mass-energy"] as const;
  for (const paperId of shellPapers) {
    test(`${paperId}, through the PaperPage shell, links its own route`, async () => {
      const html = await exportMarkup(await PaperPage({ paperId }));
      const route = ROUTE_INDEX.find((entry) => entry.slug === paperId);
      expect(route).toBeDefined();
      expect(html).toContain(`href="/discover/${paperId}/"`);
      expect(readerText(html)).toContain(`${route?.steps.length} steps`);
    });
  }

  test("a section's own page does not carry it, because a section is not the paper", async () => {
    const html = await exportMarkup(
      await PaperPage({ paperId: "special-relativity", section: "s2" } as never),
    );
    expect(html).not.toContain('href="/discover/special-relativity/"');
  });

  test("a paper with no route renders nothing", () => {
    // Asserted on the component rather than through a shell: all four readable papers have a route,
    // so there is no page that exercises this branch and a fixture forcing one would be testing a
    // corpus that does not exist. This is the property the shells rely on when a fifth paper lands
    // before its route does.
    expect(renderToStaticMarkup(PaperDiscovery({ paperId: "molecular-dimensions" }))).toBe("");
    expect(renderToStaticMarkup(PaperDiscovery({ paperId: "not-a-paper" }))).toBe("");
  });
});
