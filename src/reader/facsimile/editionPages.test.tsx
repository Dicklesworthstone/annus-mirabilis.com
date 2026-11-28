import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { sentencePages } from "../../content/results/sourceBlockFace.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { loadBilingualEdition } from "../faces/bilingualLoader.ts";
import { PaperPage } from "../PaperPage.tsx";
import { mountFacsimileReader } from "./controller.ts";
import { resolveFacsimileTarget } from "./document.ts";
import { FacsimilePanel } from "./FacsimilePanel.tsx";
import { loadFacsimileDocument } from "./server.ts";
import { decodeFacsimileAvailability, FACSIMILE_WIRE_VERSION } from "./wire.ts";

const papers = {
  "light-quanta": "ap-17-132",
  "brownian-motion": "ap-17-549",
  "special-relativity": "ap-17-891",
  "mass-energy": "ap-18-639",
};
describe("travel between the journal scan and the text", () => {
  for (const [paper, key] of Object.entries(papers)) {
    test(`${paper}: every page has real reading destinations and every translation reaches its scan`, async () => {
      const edition = await loadBilingualEdition(paper);
      const availability = await loadFacsimileDocument(paper, key);
      const wire = decodeFacsimileAvailability(
        { schemaVersion: FACSIMILE_WIRE_VERSION, ...availability },
        paper,
      );
      if (!edition || wire.kind !== "available")
        throw new Error("The paper requires its published edition and scan");
      const scan = wire.document;
      const { document } = new Window();
      const ids = async (face: "german" | "english") => {
        document.body.innerHTML = await exportMarkup(await PaperPage({ paperId: paper, face }));
        return new Set([...document.querySelectorAll("[id]")].map((el) => el.id));
      };
      const german = await ids("german");
      const english = await ids("english");
      for (const page of scan.pages) {
        expect(german.has(page.reading?.german ?? "")).toBe(true);
        expect(english.has(page.reading?.english ?? "")).toBe(true);
        // The passage can begin on the preceding page and run across a printed page turn.
        const source = scan.units.find((unit) => unit.id === page.reading?.german);
        expect(source?.pdfPages).toContain(page.pdfPage);
      }
      for (const unit of edition.units) {
        const sourceId = unit.sourceRefs[0]?.id ?? "";
        const original = resolveFacsimileTarget(scan, sourceId);
        expect(original).not.toBeNull();
        expect(resolveFacsimileTarget(scan, unit.id)).toBe(original);
      }
      for (const [id, range] of sentencePages(process.cwd(), paper)) {
        const unit = scan.units.find((entry) => entry.id === id);
        expect(scan.pages[(unit?.pdfPages[0] ?? 0) - 1]?.printedPage).toBe(range.first);
        expect(scan.pages[(unit?.pdfPages.at(-1) ?? 0) - 1]?.printedPage).toBe(range.last);
      }
    }, 60000);
  }
  test("printed-page controls and a restored split-English link select the matching reading links", async () => {
    const scan = await loadFacsimileDocument("mass-energy", "ap-18-639");
    if (scan.kind !== "available") throw new Error("Missing mass-energy scan");
    const path = "/papers/mass-energy/view/facsimile/";
    const browser = new Window({ url: `https://annus-mirabilis.com${path}#s0-p5-s2b` });
    const page = browser.document;
    page.body.innerHTML = await exportMarkup(
      <FacsimilePanel
        document={scan.document}
        title="Mass and energy"
        faceHref={path}
        explanationHref="/papers/mass-energy/"
      />,
    );
    const root = page.querySelector("[data-facsimile-reader]") as unknown as HTMLElement;
    const stop = mountFacsimileReader(root, scan.document, 1, path);
    try {
      const shown = () =>
        [...root.querySelectorAll("[data-reading-page]:not([hidden]) a")].map((a) =>
          a.getAttribute("href"),
        );
      expect(shown()).toContain("/papers/mass-energy/view/english/#masthead-title");
      root.querySelector<HTMLButtonElement>("[data-facsimile-next]")?.click();
      expect(shown()).toContain("/papers/mass-energy/view/english/#s0-p6-s1");
      browser.location.hash = "s0-p7-s9b";
      browser.dispatchEvent(new browser.Event("hashchange"));
      expect(shown()).toContain("/papers/mass-energy/view/german/#s0-p7-s8");
      expect(root.querySelectorAll("[data-facsimile-directory] [data-edition-links]")).toHaveLength(
        3,
      );
    } finally {
      stop();
      await browser.happyDOM.abort();
    }
  });
});
