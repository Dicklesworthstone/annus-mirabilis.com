/**
 * The gloss, one section per page (dispatch 254): /papers/<p>/<section>/view/gloss/ prints only its
 * section with the sections either side linked, and /papers/<p>/view/gloss/ names every section as
 * a real link with its count, then prints the first in full. Every glossed sentence stays, once.
 */
import { describe, expect, test } from "bun:test";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";
import { loadBilingualEdition } from "./bilingualLoader.ts";
import { blocksBySection, paperGlossPath, sectionGlossPath } from "./glossSections.ts";

const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;
const sentenceIds = (html: string) =>
  [...html.matchAll(/class="gloss-sentence"[^>]*data-sentence-id="([^"]+)"/g)].map(
    (m) => m[1] ?? "",
  );

describe("the gloss's sections", () => {
  test("every block is on exactly one section's page; unsectioned lines join the next section, closing lines the last", async () => {
    for (const paper of PAPERS) {
      const edition = await loadBilingualEdition(paper);
      if (!edition) throw new Error(`no edition for ${paper}`);
      const by = blocksBySection(edition.blocks);
      const placed = [...by.values()].flat();
      expect(placed.length).toBe(edition.blocks.length);
      expect(new Set(placed.map((b) => b.id)).size).toBe(edition.blocks.length);
      const sections = [...by.keys()];
      const first = by.get(sections[0] ?? "") ?? [];
      const last = by.get(sections.at(-1) ?? "") ?? [];
      // The masthead opens the first section's page, the closing lines end the last's.
      expect(first[0]?.kind).toBe("masthead");
      expect(last.at(-1)?.kind).toBe("closing");
    }
    // Relativity's part headings head the sections they precede.
    const sr = blocksBySection((await loadBilingualEdition("special-relativity"))?.blocks ?? []);
    expect(sr.get("s1")?.[0]?.id).toBe("part-1");
    expect(sr.get("s6")?.[0]?.id).toBe("part-2");
  });

  test("a section's page prints that section alone, with the sections either side linked", async () => {
    const html = await exportMarkup(
      await PaperPage({ paperId: "special-relativity", face: "gloss", section: "s3" }),
    );
    const ids = sentenceIds(html);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => !id.startsWith("s3-") && id !== "s3")).toEqual([]);
    expect(html).toContain(`href="${sectionGlossPath("special-relativity", "s2")}" rel="prev"`);
    expect(html).toContain(`href="${sectionGlossPath("special-relativity", "s4")}" rel="next"`);
    expect(html).toContain(`href="${paperGlossPath("special-relativity")}"`);
  });

  test("the paper's gloss face names every section as a link with its count, then prints the first", async () => {
    for (const paper of PAPERS) {
      const edition = await loadBilingualEdition(paper);
      if (!edition) throw new Error(`no edition for ${paper}`);
      const html = await exportMarkup(await PaperPage({ paperId: paper, face: "gloss" }));
      const by = blocksBySection(edition.blocks);
      const sections = (edition.paper.sections ?? []).map((s) => s.id).filter((id) => by.has(id));
      const listed = [
        ...html.matchAll(
          /<li><a href="([^"]+)">[\s\S]*?\((?:<!-- -->)?(\d+)(?:<!-- -->)? glossed sentences\)/g,
        ),
      ];
      expect(listed.map((m) => m[1])).toEqual(sections.map((id) => sectionGlossPath(paper, id)));
      // The counts cover every glossed sentence the paper's blocks print.
      const spans = new Set(
        edition.blocks.flatMap((b) => (b.sentenceSpans ?? []).map((s) => s.id)),
      );
      const glossed = (edition.glossUnits ?? []).filter((g) => spans.has(g.sentenceId)).length;
      expect(listed.reduce((n, m) => n + Number(m[2]), 0)).toBe(glossed);
      // The face never opens empty: the first section, and only it, follows.
      const first = new Set(
        (by.get(sections[0] ?? "") ?? []).flatMap((b) => (b.sentenceSpans ?? []).map((s) => s.id)),
      );
      const printed = sentenceIds(html);
      expect(printed.length).toBeGreaterThan(0);
      expect(printed.filter((id) => !first.has(id))).toEqual([]);
    }
  });

  test("across its section pages, every glossed sentence of relativity is printed once", async () => {
    const edition = await loadBilingualEdition("special-relativity");
    if (!edition) throw new Error("no edition for special-relativity");
    const printed: string[] = [];
    for (const { id } of edition.paper.sections ?? [])
      printed.push(
        ...sentenceIds(
          await exportMarkup(
            await PaperPage({ paperId: "special-relativity", face: "gloss", section: id }),
          ),
        ),
      );
    const spans = new Set(edition.blocks.flatMap((b) => (b.sentenceSpans ?? []).map((s) => s.id)));
    const glossed = new Set(
      (edition.glossUnits ?? []).map((g) => g.sentenceId).filter((id) => spans.has(id)),
    );
    expect(glossed.size).toBeGreaterThan(0);
    expect(new Set(printed.filter((id) => glossed.has(id))).size).toBe(glossed.size);
    expect(printed.length).toBe(new Set(printed).size);
  });
});
