import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { plainText } from "../../content/schemas/inlines.ts";
import { loadPaper } from "../../content/server.ts";
import { FaceFallback } from "../FaceFallback.tsx";
import { loadBilingualEdition } from "../faces/bilingualLoader.ts";
import { buildAlignmentIndex } from "../faces/alignment.ts";
import { SplitReadingView } from "./SplitReadingView.tsx";
import { splitSourceSection } from "./sourceSection.ts";
import { SPLIT_GLOSS_PREFIX } from "./selection.ts";

const textOf = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "");
const probe = (text: string) =>
  text
    .split(/[&<>"'‘’“”$\\]/)
    .map((s) => s.replace(/\s+/g, ""))
    .find((s) => s.length >= 35)
    ?.slice(0, 35);
function uniqueIds(html: string) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const seen = new Set<string | undefined>();
  const duplicates: (string | undefined)[] = [];
  for (const id of ids) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  expect(duplicates).toEqual([]);
  return seen;
}

describe("published split reading markup", () => {
  for (const paperId of ["brownian-motion", "light-quanta", "special-relativity", "mass-energy"]) {
    test(`${paperId} starts with actual bilingual prose and the first section's authored explanation`, async () => {
      const payload = await loadPaper(paperId);
      const edition = await loadBilingualEdition(paperId);
      if (!edition) throw new Error(`missing edition ${paperId}`);
      const first = payload.paper.sections[0];
      if (!first) throw new Error("missing first section");
      const html = renderToStaticMarkup(await FaceFallback({ paperId, face: "split" }));
      const text = textOf(html);
      const sourceProbe = edition.blocks
        .filter((b) => b.section === first.id && b.kind === "paragraph")
        .map((b) => probe(plainText(b.inlines)))
        .find(Boolean);
      const translationProbe = edition.units
        .filter((u) => u.sourceRefs.some((ref) => ref.id.startsWith(`${first.id}-p`)))
        .map((u) => probe(plainText(u.inlines)))
        .find(Boolean);
      const args = payload.arguments.filter((a) => a.section === first.id);
      const explanationProbe = args
        .flatMap((a) => a.readings.full)
        .filter((b) => b.kind === "paragraph")
        .map((b) => (b.kind === "paragraph" ? probe(b.text) : undefined))
        .find(Boolean);
      expect(sourceProbe).toBeDefined();
      expect(translationProbe).toBeDefined();
      expect(explanationProbe).toBeDefined();
      expect(text).toContain(sourceProbe ?? "missing German");
      expect(text).toContain(translationProbe ?? "missing English");
      expect(text).toContain(explanationProbe ?? "missing explanation");
      const ids = uniqueIds(html);
      const firstSentence = edition.blocks
        .filter((block) => block.section === first.id && block.kind === "paragraph")
        .flatMap((block) => block.sentenceSpans)[0];
      expect(firstSentence).toBeDefined();
      expect(ids.has(`${SPLIT_GLOSS_PREFIX}${firstSentence?.id}`)).toBe(true);
      expect(html).toContain('data-split-language="gloss"');
      expect(html).toContain('data-split-gloss-tools="true" hidden=""');
      for (const a of args) {
        expect(ids.has(`pane-b--${a.id}`)).toBe(true);
        expect(ids.has(a.id)).toBe(true);
      }
      for (const a of payload.arguments.filter((a) => a.section !== first.id))
        expect(ids.has(`pane-b--${a.id}`)).toBe(false);
      for (const section of payload.paper.sections)
        expect(html).toContain(`/papers/${paperId}/${section.id}/view/split/`);
      expect(html).toContain('data-split-source-content="true"');
      expect(html).toContain("data-split-explanation");
      expect(html).not.toContain("data-face-reading");
      expect(html).not.toContain("<iframe");
      expect(html).toContain('data-split-controls="true" hidden="" disabled=""');
      expect(html).not.toMatch(/id="split-(?:source|companion)-pane"[^>]*hidden=/);
    }, 30000);
  }

  test("relativity section 3 contains neither introduction nor section 10 text or translation", async () => {
    const edition = await loadBilingualEdition("special-relativity");
    if (!edition) throw new Error("missing relativity edition");
    const source = splitSourceSection(edition, "s3");
    const alignment = buildAlignmentIndex(source.alignment, source.blocks, source.units);
    expect(alignment.sourceToTarget.has("s3-p1-s1")).toBe(true);
    expect(alignment.sourceToTarget.has("s0-p1-s1")).toBe(false);
    expect(alignment.sourceToTarget.has("s10-p1-s1")).toBe(false);
    const html = renderToStaticMarkup(
      await FaceFallback({ paperId: "special-relativity", section: "s3", face: "split" }),
    );
    const ids = uniqueIds(html);
    expect(ids.has("s3-p1")).toBe(true);
    expect(ids.has(`${SPLIT_GLOSS_PREFIX}s3-p1-s1`)).toBe(true);
    expect(html).toContain('data-translation-unit-id="s3-p1-s1"');
    for (const block of source.blocks.filter((item) => item.kind !== "equation")) {
      for (const node of block.inlines) {
        if (node.kind === "math" && node.display && node.equationId) {
          expect(ids.has(node.equationId)).toBe(true);
          expect(ids.has(`${SPLIT_GLOSS_PREFIX}${node.equationId}`)).toBe(true);
        }
      }
    }
    for (const section of ["s0", "s10"]) {
      expect(html).not.toContain(`data-split-source-row="${section}-`);
      expect(html).not.toContain(`data-translation-unit-id="${section}-`);
    }
    expect(ids.has("masthead-title")).toBe(false);
    expect(html).toContain('href="#pane-b--');
    expect(html).toContain('href="#split-row-s3-');
  }, 30000);

  test("light-quanta section 1 footnotes and their displayed equations have unique targets", async () => {
    const html = renderToStaticMarkup(
      await FaceFallback({ paperId: "light-quanta", section: "s1", face: "split" }),
    );
    const ids = uniqueIds(html);
    expect(ids.has("s1-fn3")).toBe(true);
    expect(ids.has("footnote-s1-fn3")).toBe(true);
    expect(html).toContain('data-split-results="true" hidden=""');
    expect(html).toContain("data-result-id");
  }, 30000);

  test("unknown sections fail explicitly instead of serving the first section under a false title", async () => {
    const payload = await loadPaper("mass-energy");
    await expect(
      SplitReadingView({ payload, edition: null, section: "s999", availability: {} }),
    ).rejects.toMatchObject({ code: "split-section-missing" });
  });
});
