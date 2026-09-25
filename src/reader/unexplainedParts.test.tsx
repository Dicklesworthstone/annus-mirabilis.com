/**
 * What a paper page does not yet explain, and which pages a German face lacks
 * (am-paper-pages-hide-missing-sections-vl4k): computed from the records, in the static HTML.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadParagraphBindings } from "../content/bindings/paragraphBindings.ts";
import { printedUnits } from "../content/editions/germanSourceFace.ts";
import { ledgerPageCoverage } from "../content/editions/ledgerPresence.ts";
import { loadPaper } from "../content/server.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { ledgerGaps, pageRanges } from "./ledgerGaps.ts";
import { PaperPage } from "./PaperPage.tsx";
import { PaperReader } from "./PaperReader.tsx";
import { UnexplainedPartsLine } from "./UnexplainedParts.tsx";
import {
  explainedElsewhere,
  outlineOrder,
  paperParts,
  partLabel,
  unexplainedParts,
} from "./unexplainedParts.ts";

const ROOT = process.cwd();

describe("the parts of a paper, and the ones not yet explained", () => {
  test("parts come in printed order, the introduction first, whatever order the manifest lists", () => {
    // Relativity's manifest lists footnote units of sections 8 and 10 before the introduction.
    const parts = paperParts(printedUnits(ROOT, "special-relativity"));
    expect(parts[0]).toBe("s0");
    expect(parts).toEqual(["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"]);
    expect(paperParts([{ section: "closing" }, { section: "s2" }, {}])).toEqual(["s2"]);
  });

  test("Brownian: every part has an explanation; §3 is explained from §5", async () => {
    const { arguments: passages } = await loadPaper("brownian-motion");
    const parts = paperParts(printedUnits(ROOT, "brownian-motion"));
    const filed = new Set(passages.map((a) => a.section));
    // No passage is filed under §3, yet every §3 paragraph is bound to the §5 passage that derives
    // the same diffusion coefficient (content/bindings/brownian-motion.yaml).
    expect(unexplainedParts(parts, filed)).toEqual(["s3"]);
    const elsewhere = explainedElsewhere(
      parts,
      filed,
      loadParagraphBindings(ROOT, "brownian-motion") ?? [],
    );
    expect([...elsewhere]).toEqual([["s3", ["arg-bm-diffusivity"]]]);
    expect(unexplainedParts(parts, new Set([...filed, ...elsewhere.keys()]))).toEqual([]);
  });

  test("a part is explained elsewhere only when every paragraph of it is bound", () => {
    const parts = ["s0", "s1", "s2", "s3"];
    const b = (unit: string, passages: string[], unexplained = false) => ({
      unit,
      passages,
      unexplained,
    });
    const bindings = [
      b("s1-p1", ["arg-a"]),
      b("s1-p2", ["arg-b", "arg-a"]),
      b("s2-p1", ["arg-a"]),
      b("s2-p2", [], true),
      b("s3-p1", ["arg-c"]),
    ];
    // §1 is all bound; §2 has a declared paragraph; §3 is filed, so it is a section already.
    expect([...explainedElsewhere(parts, new Set(["s3"]), bindings)]).toEqual([
      ["s1", ["arg-a", "arg-b"]],
    ]);
    // A part with no bindings at all is not explained anywhere.
    expect(explainedElsewhere(parts, new Set(), []).size).toBe(0);
  });

  test("a reading for a section takes it out of the line: nothing is hand-typed", () => {
    const parts = ["s0", "s1", "s2", "s3", "s4", "s5"];
    expect(unexplainedParts(parts, new Set(["s4", "s5"]))).toEqual(["s0", "s1", "s2", "s3"]);
    expect(unexplainedParts(parts, new Set(["s1", "s4", "s5"]))).toEqual(["s0", "s2", "s3"]);
    // The words a reader sees, without the links that wrap each part.
    const html = (explained: string[]) =>
      renderToStaticMarkup(
        <UnexplainedPartsLine
          parts={unexplainedParts(parts, new Set(explained))}
          hrefFor={(p) => `/g/#${p}`}
        />,
      ).replace(/<[^>]+>/g, "");
    expect(html(["s4", "s5"])).toContain("the introduction, §1, §2 and §3");
    expect(html(["s1", "s4", "s5"])).toContain("the introduction, §2 and §3");
    expect(html(["s0", "s1", "s2", "s3", "s4", "s5"])).toBe("");
  });

  test("the outline keeps printed order, explained sections and missing parts together", () => {
    const order = outlineOrder([{ id: "s4" }, { id: "s5" }], ["s0", "s1", "s2"], ["s3"]);
    expect(
      order.map((e) =>
        e.kind === "section" ? e.section.id : e.kind === "missing" ? `(${e.part})` : `[${e.part}]`,
      ),
    ).toEqual(["(s0)", "(s1)", "(s2)", "[s3]", "s4", "s5"]);
    expect(partLabel("s0")).toBe("the introduction");
    expect(partLabel("s3")).toBe("§3");
  });

  test("the Brownian page lists every part in its outline and says nothing is missing", async () => {
    const html = await exportMarkup(await PaperReader());
    // The introduction, §1 and §2 have their own passages, and §3 is explained from §5, so the
    // "Not yet explained" line is gone; the synthetic cases above keep the line's wording tested.
    expect(html).not.toContain("data-unexplained-parts=");
    expect(html).not.toContain("Not yet explained on this site:");
    for (const part of ["s0", "s1", "s2", "s3"])
      expect(html).not.toContain(`data-unexplained-part="${part}"`);
    // §3 is in the outline, pointing at the passage that explains it.
    // The whole paper carries the passage, so the link stays on the page.
    const at = html.indexOf('data-explained-elsewhere="s3"');
    expect(at).toBeGreaterThan(-1);
    expect(html.slice(at, html.indexOf("</div>", at))).toContain('href="#arg-bm-diffusivity"');
    // §3 opens its passage, never a section page that does not exist.
    expect(html).not.toMatch(/href="\/papers\/brownian-motion\/s3\/"/);
  });
});

describe("the pages a German face lacks", () => {
  // The relativity ledger is being transcribed a page at a time (dispatch 193), so these tests
  // state what holds at every page count rather than which pages are bare today. An exact list
  // turned red on the first page transcribed. The synthetic ledger below keeps a bare page's
  // detection proven after the real ledger has none left.
  const RELATIVITY_PAGES = Array.from({ length: 31 }, (_, i) => 891 + i);

  test("a page holding only its marker is untranscribed; a page with a line of text is drafted", () => {
    const ledger = [
      "--- MACHINE DRAFT TRANSCRIPTION PAGE 1 OF 3 ---",
      "[[ANNALEN-PAGE 912]]",
      "",
      "Es folgt aus den entwickelten Gleichungen.",
      "",
      "--- MACHINE DRAFT TRANSCRIPTION PAGE 2 OF 3 ---",
      "[[ANNALEN-PAGE 913]]",
      "",
      "--- MACHINE DRAFT TRANSCRIPTION PAGE 3 OF 3 ---",
      "[[ANNALEN-PAGE 914]]",
      "   ",
      "",
    ].join("\n");
    expect(ledgerPageCoverage(ledger)).toEqual([
      { printedPage: 912, covered: true },
      { printedPage: 913, covered: false },
      { printedPage: 914, covered: false },
    ]);
  });

  test("relativity's ledger divides pages 891-921 between drafted and untranscribed", () => {
    const gaps = ledgerGaps("special-relativity", ROOT);
    expect(gaps).not.toBeNull();
    const drafted = gaps?.drafted ?? [];
    const untranscribed = gaps?.untranscribed ?? [];
    // Every printed page is in exactly one list.
    expect([...drafted, ...untranscribed].sort((a, b) => a - b)).toEqual(RELATIVITY_PAGES);
    // Pages 891-912 were drafted by 2026-09-24, and a drafted page never becomes bare again.
    for (const page of RELATIVITY_PAGES.filter((p) => p <= 912)) expect(drafted).toContain(page);
  });

  test("page runs read as ranges", () => {
    expect(pageRanges([913, 914, 915])).toBe("913–915");
    expect(pageRanges([891, 894, 913, 914])).toBe("891, 894 and 913–914");
    expect(pageRanges([899])).toBe("899");
  });

  test("the relativity German face names the pages its ledger lacks, and no others", async () => {
    // The German face a reader is SERVED, whichever renderer that is. Until dispatch 192 this
    // rendered FaceFallback directly, which was the served face only while relativity had no
    // German. Its unreviewed edition now renders through GermanFace, which must name the same
    // pages in the same words; a partial edition that dropped them would read as the whole paper.
    const gaps = ledgerGaps("special-relativity", ROOT);
    const untranscribed = gaps?.untranscribed ?? [];
    const html = renderToStaticMarkup(
      await PaperPage({ paperId: "special-relativity", face: "german" } as never),
    );
    if (untranscribed.length === 0) {
      expect(html).not.toContain("data-untranscribed-pages=");
      return;
    }
    expect(html).toContain(`data-untranscribed-pages="${untranscribed.join(" ")}"`);
    const noun = untranscribed.length === 1 ? "Printed page" : "Printed pages";
    const verb = untranscribed.length === 1 ? "has" : "have";
    expect(html).toContain(`${noun} ${pageRanges(untranscribed)} ${verb} not been transcribed yet`);
    expect(html).toContain('href="/papers/pdfs/ap-17-891.pdf"');
  });
});
