import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { loadParagraphBindings } from "../content/bindings/paragraphBindings.ts";
import {
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_EDITORIAL_NOTES,
} from "../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { loadBilingualEdition } from "./faces/bilingualLoader.ts";
import { GermanFace } from "./faces/GermanFace.tsx";
import { SourceBlock } from "./faces/SourceBlock.tsx";
import { extractSourceCompanion } from "./sourceCompanion.ts";

const compact = (text: string | null) => (text ?? "").replace(/\s+/gu, " ").trim();

/** Read the source's own text nodes, excluding controls that need the complete edition. */
function sourceText(node: Element): string[] {
  const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const words: string[] = [];
  while (walker.nextNode()) {
    const parent = walker.currentNode.parentElement;
    if (parent?.closest("button, script, style")) continue;
    const text = compact(walker.currentNode.textContent);
    if (text.length > 3) words.push(text);
  }
  return words;
}

function math(node: Element): string[] {
  return [...node.querySelectorAll('annotation[encoding="application/x-tex"]')].map(
    (annotation) => annotation.textContent ?? "",
  );
}

describe("the Original companion against the actual Brownian edition", () => {
  let html: string;
  let original: Document;
  const bindings = loadParagraphBindings(process.cwd(), "brownian-motion");
  assert.ok(bindings?.length);
  const bound = bindings.filter((binding) => binding.passages.length > 0);
  assert.ok(bound.length);

  beforeAll(async () => {
    await installDom();
    const edition = await loadBilingualEdition("brownian-motion");
    assert.ok(edition?.blocks.length);
    html = renderToStaticMarkup(
      <GermanFace
        paper={edition.paper}
        blocks={edition.blocks}
        alignment={edition.alignment}
        editorialNotes={edition.editorialNotes}
      />,
    );
    original = new DOMParser().parseFromString(html, "text/html");
  });
  afterAll(async () => uninstallDom());

  test("every bound paragraph or footnote keeps its actual prose, printed formulas and page links", () => {
    let formulas = 0;
    for (const binding of bound) {
      const source =
        original.querySelector(`[data-block-wrapper="${binding.unit}"]`) ??
        original.querySelector(`[data-footnote-id="${binding.unit}"]`);
      assert.ok(source, `Canonical source for ${binding.unit}`);
      const fragment = extractSourceCompanion(
        original,
        binding.unit,
        document,
        `read-${binding.unit}`,
      );
      assert.ok(fragment, `Companion source for ${binding.unit}`);
      const text = compact(fragment.textContent);
      for (const words of sourceText(source)) expect(text).toContain(words);
      const originalMath = math(source);
      const copiedMath = math(fragment);
      for (const formula of originalMath) expect(copiedMath).toContain(formula);
      formulas += originalMath.length;
      for (const locator of source.querySelectorAll<HTMLAnchorElement>("[data-facsimile-link]")) {
        const href = locator.getAttribute("href");
        assert.ok(href);
        expect(
          [...fragment.querySelectorAll("a")].some((a) => a.getAttribute("href") === href),
        ).toBe(true);
      }
      expect(fragment.querySelector("script, iframe, form")).toBeNull();
    }
    // The corpus itself supplies the denominator; an accidentally empty source population fails.
    expect(formulas).toBeGreaterThan(0);
    console.log(
      JSON.stringify({
        event: "brownian-original-bindings",
        checked: bound.map((b) => b.unit),
        formulas,
      }),
    );
  });

  test("referenced footnotes travel with their paragraph and the two responsive copies never share IDs", () => {
    const testedFootnotes = new Set<string>();
    for (const binding of bound) {
      const source =
        original.querySelector(`[data-block-wrapper="${binding.unit}"]`) ??
        original.querySelector(`[data-footnote-id="${binding.unit}"]`);
      if (!source) continue;
      const references = [
        ...source.querySelectorAll<HTMLAnchorElement>('a[href^="#footnote-"]'),
      ].map((reference) => reference.getAttribute("href")?.slice("#footnote-".length));
      if (source.hasAttribute("data-footnote-id")) references.push(binding.unit);
      if (references.length === 0) continue;
      const column = extractSourceCompanion(
        original,
        binding.unit,
        document,
        `column-${binding.unit}`,
      );
      const sheet = extractSourceCompanion(
        original,
        binding.unit,
        document,
        `sheet-${binding.unit}`,
      );
      assert.ok(column && sheet);
      for (const id of references) {
        assert.ok(id);
        const footnote = original.querySelector(`[data-footnote-id="${id}"]`);
        assert.ok(footnote);
        for (const fragment of [column, sheet]) {
          const copied = fragment.querySelector(`[data-footnote-id="${id}"]`);
          assert.ok(copied, `Footnote ${id} beside ${binding.unit}`);
          for (const words of sourceText(footnote))
            expect(compact(copied.textContent)).toContain(words);
          for (const link of fragment.querySelectorAll("[data-original-local-target]")) {
            const target = link.getAttribute("data-original-local-target");
            assert.ok(target);
            expect([...fragment.querySelectorAll("[id]")].some((node) => node.id === target)).toBe(
              true,
            );
          }
        }
        testedFootnotes.add(id);
      }
      const ids = [...column.querySelectorAll("[id]"), ...sheet.querySelectorAll("[id]")].map(
        (node) => node.id,
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.some((id) => original.getElementById(id) !== null)).toBe(false);
    }
    const publishedFootnotes = [...original.querySelectorAll("[data-footnote-id]")].map((node) =>
      node.getAttribute("data-footnote-id"),
    );
    expect([...testedFootnotes].sort()).toEqual(publishedFootnotes.sort());
  });

  test("source-block editorial qualifications remain beside the copied passage", () => {
    const block = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((item) => item.id === "bm-s4-p1");
    assert.ok(block);
    const rendered = renderToStaticMarkup(
      <div data-reader-root data-face="german">
        <SourceBlock
          block={block}
          paperSlug="brownian-motion"
          editorialNotes={FIXTURE_EDITORIAL_NOTES}
        />
      </div>,
    );
    const fragment = extractSourceCompanion(rendered, block.id, document, "editorial-column");
    assert.ok(fragment);
    const notes = FIXTURE_EDITORIAL_NOTES.filter((note) => note.affectedIds.includes(block.id));
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      const copied = fragment.querySelector(`[data-note-id="${note.id}"]`);
      assert.ok(copied);
      expect(copied.textContent).toContain(note.claim);
      expect(copied.getAttribute("role")).toBe("note");
      expect(copied.id).not.toBe(`note-${note.id}`);
    }
  });
});
