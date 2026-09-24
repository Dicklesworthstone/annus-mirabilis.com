/**
 * What a paper page does not yet explain, and which pages a German face lacks
 * (am-paper-pages-hide-missing-sections-vl4k): computed from the records, in the static HTML.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { printedUnits } from "../content/editions/germanSourceFace.ts";
import { loadPaper } from "../content/server.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { FaceFallback } from "./FaceFallback.tsx";
import { ledgerGaps, pageRanges } from "./ledgerGaps.ts";
import { PaperReader } from "./PaperReader.tsx";
import { UnexplainedPartsLine } from "./UnexplainedParts.tsx";
import { outlineOrder, paperParts, partLabel, unexplainedParts } from "./unexplainedParts.ts";

const ROOT = process.cwd();

describe("the parts of a paper, and the ones not yet explained", () => {
  test("parts come in printed order, the introduction first, whatever order the manifest lists", () => {
    // Relativity's manifest lists footnote units of sections 8 and 10 before the introduction.
    const parts = paperParts(printedUnits(ROOT, "special-relativity"));
    expect(parts[0]).toBe("s0");
    expect(parts).toEqual(["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"]);
    expect(paperParts([{ section: "closing" }, { section: "s2" }, {}])).toEqual(["s2"]);
  });

  test("Brownian: the introduction and sections 1 to 3 have no explanation", async () => {
    const { arguments: passages } = await loadPaper("brownian-motion");
    const parts = paperParts(printedUnits(ROOT, "brownian-motion"));
    expect(unexplainedParts(parts, new Set(passages.map((a) => a.section)))).toEqual([
      "s0",
      "s1",
      "s2",
      "s3",
    ]);
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
    const order = outlineOrder([{ id: "s4" }, { id: "s5" }], ["s0", "s1", "s2", "s3"]);
    expect(order.map((e) => (e.kind === "section" ? e.section.id : `(${e.part})`))).toEqual([
      "(s0)",
      "(s1)",
      "(s2)",
      "(s3)",
      "s4",
      "s5",
    ]);
    expect(partLabel("s0")).toBe("the introduction");
    expect(partLabel("s3")).toBe("§3");
  });

  test("the Brownian page says so in its static HTML, and lists the parts in its outline", async () => {
    const html = await exportMarkup(await PaperReader());
    expect(html).toContain('data-unexplained-parts="s0 s1 s2 s3"');
    expect(html).toContain("Not yet explained on this site:");
    for (const part of ["s0", "s1", "s2", "s3"])
      expect(html).toContain(`data-unexplained-part="${part}"`);
    // Each part opens Einstein's text for that part, never a section page that does not exist.
    expect(html).toMatch(/href="\/papers\/brownian-motion\/view\/german\/#s0-p1"/);
    expect(html).not.toMatch(/href="\/papers\/brownian-motion\/s[0-3]\/"/);
  });
});

describe("the pages a German face lacks", () => {
  test("relativity's ledger has text for pages 891-912 and none for 913-921", () => {
    const gaps = ledgerGaps("special-relativity", ROOT);
    expect(gaps?.untranscribed).toEqual([913, 914, 915, 916, 917, 918, 919, 920, 921]);
    expect(gaps?.drafted[0]).toBe(891);
    expect(gaps?.drafted.at(-1)).toBe(912);
  });

  test("page runs read as ranges", () => {
    expect(pageRanges([913, 914, 915])).toBe("913–915");
    expect(pageRanges([891, 894, 913, 914])).toBe("891, 894 and 913–914");
    expect(pageRanges([899])).toBe("899");
  });

  test("the relativity German face names them, and links the facsimile that has every page", async () => {
    const html = renderToStaticMarkup(
      await FaceFallback({ paperId: "special-relativity", face: "german" }),
    );
    expect(html).toContain('data-untranscribed-pages="913 914 915 916 917 918 919 920 921"');
    expect(html).toContain("Printed pages 913–921 have not been transcribed yet");
    expect(html).toContain('href="/papers/pdfs/ap-17-891.pdf"');
  });
});
