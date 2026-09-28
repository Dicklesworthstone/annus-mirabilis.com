/**
 * CAN A READER GET TO A CAPSTONE? (am-disc-capstones-infra-3352, dispatch 373.)
 *
 * Four capstones were authored and no page on the site linked to any of them. Measured across the
 * built output before this unit: 0 of 718 pages carried an `href="/capstones/`, so a reader reached
 * one by typing the URL or by reading sitemap.xml. That is the failure this file exists to keep
 * closed, and it is a property of the LINKING pages rather than of the capstones, which is why it
 * lives here rather than in any one page's test.
 *
 * WHY THE LINK TEXT IS ASSERTED AGAINST THE RECORD. Each link reads the capstone's own title, so a
 * reader knows they are being offered "Rebuild the September argument" rather than "Capstone". The
 * copy is authored in five page files and the titles live in four records, which is exactly the
 * shape that drifts, so every assertion below compares the rendered anchor with
 * `loadCapstone(paper).capstone.title` instead of with a string typed here.
 *
 * THE FIFTEEN-MINUTE TOUR IS ASSERTED NOT TO LINK ONE, on purpose. The bead names the one-evening
 * and full-course tours, neither of which has a record (content/tours holds one file, at the
 * fifteen-minute budget), and the fifteen-minute path is the equations-free shortest route. Leaving
 * it out is a decision, so it is written down as an assertion rather than left as an absence nobody
 * would notice being reversed.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadCapstone } from "../../discovery/capstone/loadCapstone.ts";
import { GUIDED_TOURS } from "../../discovery/tours/catalogue.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import BrownianJourney from "../discover/brownian-motion/page";
import LightQuantaJourney from "../discover/light-quanta/page";
import MassEnergyJourney from "../discover/mass-energy/page";
import SpecialRelativityJourney from "../discover/special-relativity/page";
import TourPage from "../tours/[tour]/page.tsx";

const PAPERS = ["brownian-motion", "light-quanta", "mass-energy", "special-relativity"] as const;

const JOURNEY = {
  "brownian-motion": <BrownianJourney />,
  "light-quanta": <LightQuantaJourney />,
  "mass-energy": <MassEnergyJourney />,
  "special-relativity": <SpecialRelativityJourney />,
} as const;

const journeyHtml = new Map(PAPERS.map((paper) => [paper, renderToStaticMarkup(JOURNEY[paper])]));
const tourHtml = new Map<string, string>();
for (const tour of GUIDED_TOURS)
  tourHtml.set(
    tour.id,
    await exportMarkup(await TourPage({ params: Promise.resolve({ tour: tour.id }) })),
  );

const title = (paper: string) => loadCapstone(paper).capstone.title;
/** The anchor for one href, with its text, so the copy is read off the render and not assumed. */
function anchorText(html: string, href: string): string | undefined {
  const match = new RegExp(`<a href="${href}"[^>]*>([\\s\\S]*?)</a>`).exec(html);
  return match?.[1]
    ?.replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("a reader can reach every capstone", () => {
  test("each paper's journey page links its own capstone, in the record's words", () => {
    // Non-vacuity first: four pages rendered, each with markup. A loop over an empty map would
    // satisfy every assertion below.
    expect(journeyHtml.size).toBe(4);
    for (const paper of PAPERS) {
      const html = journeyHtml.get(paper) ?? "";
      expect([paper, html.length > 5000]).toEqual([paper, true]);
      expect([paper, anchorText(html, `/capstones/${paper}/`)]).toEqual([paper, title(paper)]);
      // Its own capstone and no other paper's.
      const others = PAPERS.filter((other) => other !== paper);
      for (const other of others)
        expect([paper, other, html.includes(`href="/capstones/${other}/"`)]).toEqual([
          paper,
          other,
          false,
        ]);
    }
  });

  test("each guided tour links its paper's capstone, in the record's words", () => {
    expect(tourHtml.size).toBe(4);
    for (const tour of GUIDED_TOURS) {
      const html = tourHtml.get(tour.id) ?? "";
      expect([tour.id, anchorText(html, `/capstones/${tour.paper}/`)]).toEqual([
        tour.id,
        title(tour.paper),
      ]);
    }
  });

  test("the fifteen-minute tour links no capstone, which is the decision and not an oversight", async () => {
    const html = await exportMarkup(
      await TourPage({ params: Promise.resolve({ tour: "fifteen-minutes-mass-energy" }) }),
    );
    // Positive control: the page rendered, and it is the timed tour rather than an empty string.
    expect(html).toContain("fifteen minutes");
    expect(html).not.toContain("/capstones/");
  });

  test("the invitation is a plain link, never a button and never the primary action", () => {
    // AGENTS.md: capstones "ship only if they help explanation and transfer without becoming
    // required navigation", so the link must not wear the primary-action class the "read the paper"
    // button wears, and it must not be a <button> that needs JavaScript.
    for (const paper of PAPERS) {
      const html = journeyHtml.get(paper) ?? "";
      const anchor = new RegExp(`<a[^>]*href="/capstones/${paper}/"[^>]*>`).exec(html)?.[0] ?? "";
      expect([paper, anchor.includes('class="button"')]).toEqual([paper, false]);
      expect([paper, anchor.startsWith("<a ")]).toEqual([paper, true]);
      // And it says it is optional, in the paragraph that carries it.
      expect([paper, /optional/.test(html)]).toEqual([paper, true]);
    }
    for (const tour of GUIDED_TOURS) {
      const html = tourHtml.get(tour.id) ?? "";
      const anchor =
        new RegExp(`<a[^>]*href="/capstones/${tour.paper}/"[^>]*>`).exec(html)?.[0] ?? "";
      expect([tour.id, anchor.includes('class="button"')]).toEqual([tour.id, false]);
      expect([tour.id, /optional/.test(html)]).toEqual([tour.id, true]);
    }
  });

  test("nothing about these links needs JavaScript", () => {
    for (const [id, html] of [...journeyHtml, ...tourHtml]) {
      const around = html.slice(Math.max(0, html.indexOf("/capstones/") - 400));
      expect([id, around.includes("/capstones/")]).toEqual([id, true]);
      expect([id, /<button[^>]*>[^<]*[Rr]ebuild/.test(html)]).toEqual([id, false]);
      expect([id, /onclick/i.test(around.slice(0, 800))]).toEqual([id, false]);
    }
  });
});
