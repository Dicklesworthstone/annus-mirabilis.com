import { describe, expect, test } from "bun:test";
import type { Inline, SourceBlock, TranslationUnit } from "../../content/schemas/source.ts";
import type { BilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import {
  OfflineSourceError,
  offlineMarkupIds,
  prepareOfflineSourceMarkup,
  selectOfflineSources,
} from "./sourceProjection.ts";

function refuses(run: () => unknown, code: string) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(OfflineSourceError);
    expect((error as OfflineSourceError).code).toBe(code);
    return;
  }
  throw new Error("The malformed offline source must refuse.");
}

const block = (id: string, section: string, kind: SourceBlock["kind"], inlines: readonly Inline[] = []): SourceBlock => ({
  id, section, kind, paper: "mass-energy", order: 1,
  locators: [{ pdfPageIndex: 1, printedPage: 639 }],
  diplomaticText: "Source text", inlines, sentenceSpans: [], revision: 1,
  status: { transcription: "draft", mathTranscription: "not-applicable", translation: "draft", review: "draft" },
});
const unit = (id: string, source: string, inlines: readonly Inline[] = []): TranslationUnit => ({
  id, sourceRefs: [{ paper: "mass-energy", id: source }], inlines, revision: 1,
  translator: { id: "agent:test", kind: "model", modelId: "test-model" },
  unresolvedAlternatives: [], reviewState: "machine-draft", lang: "en",
}) as TranslationUnit;

function edition(): BilingualEdition {
  return {
    paper: { slug: "mass-energy" } as BilingualEdition["paper"],
    blocks: [
      block("s1-p1", "s1", "paragraph", [{ kind: "footnote-mark", mark: "1", footnoteId: "s2-fn1" }]),
      block("eq-s1-d1", "s1", "equation", [{ kind: "math", latex: "x=1", equationId: "eq-s1-d1" }]),
      block("s2-p1", "s2", "paragraph"),
      block("s2-fn1", "s2", "footnote", [{ kind: "text", text: "An essential note." }]),
    ],
    units: [
      unit("s1-p1-s1", "s1-p1"),
      unit("eq-s1-d1", "eq-s1-d1"),
      unit("s2-p1-s1", "s2-p1"),
      unit("s2-fn1", "s2-fn1"),
    ],
  };
}

describe("the source section and its actual dependencies", () => {
  test("keeps source-only equations, closes over referenced footnotes and leaves other sections out", () => {
    const original = edition();
    const selected = selectOfflineSources(original, "s1", "scaffold");
    expect(selected?.blocks.map((record) => record.id)).toEqual(["s1-p1", "eq-s1-d1", "s2-fn1"]);
    expect(selected?.units.map((record) => record.id)).toEqual(["s1-p1-s1", "eq-s1-d1", "s2-fn1"]);
    expect(original.blocks.length).toBe(4);
  });

  test("preserves the current publication boundary and honest absence (sourceProjection.ts:59) (sourceProjection.ts:66)", () => {
    expect(selectOfflineSources(edition(), "s1", "preview")).toBeNull();
    expect(selectOfflineSources(edition(), "s1", "launch")).toBeNull();
    expect(selectOfflineSources(null, "s1", "scaffold")).toBeNull();
    expect(selectOfflineSources(edition(), "s9", "scaffold")).toBeNull();
    refuses(() => selectOfflineSources(edition(), "s1", "invented" as never), "offline-source-profile");
    refuses(() => selectOfflineSources(edition(), "../source", "scaffold"), "offline-source-identity");
  });

  test("an absent footnote or an imported source cannot become a broken offline link (sourceProjection.ts:106) (sourceProjection.ts:137)", () => {
    const missing = edition();
    refuses(() => selectOfflineSources({
      ...missing, blocks: missing.blocks.filter((record) => record.id !== "s2-fn1"),
    }, "s1", "scaffold"), "offline-source-reference");
    const first = missing.units[0]!;
    refuses(() => selectOfflineSources({
      ...missing,
      units: [{ ...first, sourceRefs: [...first.sourceRefs, { paper: "light-quanta", id: "s1-p1" }] }],
    }, "s1", "scaffold"), "offline-source-reference");
    refuses(() => selectOfflineSources({
      ...missing,
      units: [{ ...first, sourceRefs: [...first.sourceRefs, { paper: "mass-energy", id: "absent" }] }],
    }, "s1", "scaffold"), "offline-source-reference");
  });

  test("duplicate identities refuse instead of overwriting the selected record (sourceProjection.ts:74) (sourceProjection.ts:95)", () => {
    const original = edition();
    refuses(() => selectOfflineSources({
      ...original, blocks: [...original.blocks, original.blocks[0]!],
    }, "s1", "scaffold"), "offline-source-identity");
    refuses(() => selectOfflineSources({
      ...original, units: [...original.units, original.units[0]!],
    }, "s1", "scaffold"), "offline-source-identity");
  });
  test("a contained display must carry its actual paragraph (sourceProjection.ts:114)", () => {
    const original = edition();
    const blocks = original.blocks.map((record) => record.kind === "equation"
      ? { ...record, containedIn: "s1-absent" }
      : record);
    refuses(() => selectOfflineSources({ ...original, blocks }, "s1", "scaffold"),
      "offline-source-reference");
  });

  test("unsectioned masthead and closing records follow the live section faces", () => {
    const original = edition();
    const masthead = { ...block("masthead-title", "s1", "masthead"), section: undefined };
    const blocks = [masthead, ...original.blocks];
    const units = [unit("masthead-title", "masthead-title"), ...original.units];
    const selected = selectOfflineSources({ ...original, blocks, units }, "s1", "scaffold");
    expect(selected?.blocks[0]?.id).toBe("masthead-title");
    expect(selected?.units[0]?.id).toBe("masthead-title");
    expect(selectOfflineSources({ ...original, blocks, units }, "s9", "scaffold")).toBeNull();
  });

});

describe("the static source HTML adapter", () => {
  test("both face directions and footnotes stay inside the file when their addresses are present", () => {
    const html = prepareOfflineSourceMarkup(
      '<p id="s1-p1">Deutsch</p><span id="en-s1-p1-s1">English</span>' +
      '<li id="footnote-s1-fn1">Note</li>' +
      '<a href="/papers/mass-energy/view/german/#s1-p1">German</a>' +
      '<a href="/papers/mass-energy/s1/view/english/#s1-p1-s1">English</a>' +
      '<a href="#footnote-s1-fn1">1</a>' +
      '<a href="#explanation-s1">Explanation</a>',
      "mass-energy", new Set(["explanation-s1"]),
    );
    for (const target of ["s1-p1", "en-s1-p1-s1", "footnote-s1-fn1", "explanation-s1"])
      expect(html).toContain('href="#' + target + '"');
    expect(html).not.toContain("https:");
  });

  test("an absent section or facsimile remains an explicit online navigation", () => {
    const html = prepareOfflineSourceMarkup(
      '<a href="/papers/mass-energy/view/german/#s2-p1">Later</a>' +
      '<a href="/papers/mass-energy/view/facsimile/?page=639">Plate</a>' +
      '<a href="#en-s2-p1">English elsewhere</a>',
      "mass-energy",
    );
    expect(html).toContain("https://annus-mirabilis.com/papers/mass-energy/view/german/#s2-p1");
    expect(html).toContain("https://annus-mirabilis.com/papers/mass-energy/view/facsimile/?page=639");
    expect(html).toContain("https://annus-mirabilis.com/papers/mass-energy/view/english/#s2-p1");
    expect(html).not.toContain('href="#');
  });

  test("unavailable alignment controls disappear and formula legends retain their words (sourceProjection.ts:196)", () => {
    const html = prepareOfflineSourceMarkup(
      '<span id="s1-p1-s1">Original words.</span>' +
      '<button class="align-sentences-btn">Align sentences</button>' +
      '<button class="show-aligned-action">Show English translation</button>' +
      '<button disabled="" aria-expanded="false"><span>Energy</span></button>',
      "mass-energy",
    );
    expect(html).toContain("Original words.");
    expect(html).toContain('<span class="offline-source-legend"><span>Energy</span></span>');
    expect(html).not.toContain("button");
    expect(html).not.toContain("Align sentences");
    expect(html).not.toContain("aria-expanded");
    refuses(() => prepareOfflineSourceMarkup('<button>Run</button>', "mass-energy"), "offline-source-control");
  });

  test("an unterminated source control refuses (sourceProjection.ts:204)", () => {
    refuses(() => prepareOfflineSourceMarkup('<button class="align-sentences-btn">Align', "mass-energy"),
      "offline-source-control");
  });

  test("duplicate anchors, failed mathematics and active resources refuse (sourceProjection.ts:166) (sourceProjection.ts:189) (sourceProjection.ts:227)", () => {
    refuses(() => offlineMarkupIds('<p id="same"></p><p id="same"></p>'), "offline-source-anchor");
    for (const bad of [
      '<script>alert(1)</script>', '<img src="https://example.org/scan.png">',
      '<link rel="stylesheet" href="/theme.css">', '<span onclick="go()">Text</span>',
      '<span class="katex-error">Broken formula</span>',
      '<code class="math-fallback">Broken formula</code>',
      '<a href="javascript:go()">Link</a>', '<a href="//example.org/">Link</a>',
    ])
      refuses(() => prepareOfflineSourceMarkup(bad, "mass-energy"), "offline-source-markup");
  });
});
