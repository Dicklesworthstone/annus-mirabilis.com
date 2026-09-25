/**
 * An edition that arrives a section at a time says what it does not cover (dispatch 192): that is
 * navigation. It carries no draft label (D-2026-09-25-no-review-status-banners), on the German face
 * or in the parallel face's German column, however its blocks stand.
 *
 * Special relativity's first units covered the masthead and the introduction. Without these, the
 * English and parallel faces showed them as if they were the paper.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type SourceBlock,
  type TranslationUnit,
  validateSourceBlock,
  validateTranslationUnit,
} from "../../content/schemas/source.ts";
import { spanTextDigest } from "../../content/schemas/spans.ts";
import { FIXTURE_MASS_ENERGY_PAPER } from "../../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { PaperPage } from "../PaperPage.tsx";
import { paperSectionIds } from "../paperSections.ts";
import { loadBilingualEdition } from "./bilingualLoader.ts";
import { EnglishFace } from "./EnglishFace.tsx";
import {
  editionGermanNotice,
  missingGermanSections,
  sectionsLabel,
  untranslatedSections,
} from "./editionCoverage.ts";
import { GermanFace } from "./GermanFace.tsx";
import { ParallelFace } from "./ParallelFace.tsx";

const status = (review: string) =>
  ({
    transcription: review === "reviewed" ? "reviewed" : "draft",
    mathTranscription: "not-applicable",
    translation: "draft",
    review,
  }) as const;
const block = (id: string, section: string, text: string, review = "draft"): SourceBlock =>
  validateSourceBlock({
    id,
    kind: "paragraph",
    paper: "mass-energy",
    section,
    order: 1,
    locators: [{ pdfPageIndex: 1, printedPage: 639 }],
    diplomaticText: text,
    inlines: [{ kind: "text", text }],
    sentenceSpans: [
      {
        id: `${id}-s1`,
        span: {
          start: 0,
          end: [...text].length,
          blockRevision: 1,
          textDigest: spanTextDigest(text),
        },
      },
    ],
    revision: 1,
    status: status(review),
    lang: "de",
  });
const unit = (id: string, source: string, text: string): TranslationUnit =>
  validateTranslationUnit({
    id,
    sourceRefs: [{ paper: "mass-energy", id: source }],
    inlines: [{ kind: "text", text }],
    translator: { id: "agent:test", kind: "model", modelId: "test" },
    revision: 1,
    reviewState: "machine-draft",
    lang: "en",
  });

const SECTIONS = ["s0", "s1", "s2", "s3", "s4"];
const BLOCKS = [
  block("s0-p1", "s0", "Daß die Elektrodynamik bekannt ist."),
  block("s1-p1", "s1", "Es liege ein Koordinatensystem vor."),
  block("s2-p1", "s2", "Die folgenden Überlegungen."),
];
// s0 through a sentence id, s1 through its block id; s2 has German and no English.
const UNITS = [
  unit("s0-p1-s1", "s0-p1-s1", "That electrodynamics is known."),
  unit("s1-p1", "s1-p1", "Let a coordinate system be given."),
];
const PAPER = {
  ...FIXTURE_MASS_ENERGY_PAPER,
  sections: SECTIONS.map((id) => ({ id, title: id, arguments: [] })),
};

describe("untranslatedSections", () => {
  test("names the sections no unit reaches, by sentence or by block, in the paper's order", () => {
    expect(untranslatedSections(SECTIONS, BLOCKS, UNITS)).toEqual(["s2", "s3", "s4"]);
  });
  test("a German block with no English does not count as translated", () => {
    expect(untranslatedSections(["s2"], BLOCKS, UNITS)).toEqual(["s2"]);
  });
  test("a fully translated paper names nothing", () => {
    expect(untranslatedSections(["s0", "s1"], BLOCKS, UNITS)).toEqual([]);
  });
  test("a unit whose source is outside any section (the masthead) reaches none", () => {
    expect(
      untranslatedSections(["s0"], BLOCKS, [unit("masthead-title", "masthead-title", "On")]),
    ).toEqual(["s0"]);
  });
  test("a masthead filed under s0 does not make a translated title a translated introduction", () => {
    // Brownian motion's frozen manifest files its title and author line under s0, as a masthead
    // block with section "s0". unglossedSections already excludes a masthead (749e4740); this
    // counted a masthead unit as reaching s0, so a partial translation with only its title in
    // English would not have named the introduction as untranslated (dispatch 221, 40225).
    const masthead = {
      ...block("masthead-title", "s0", "Über die Bewegung"),
      kind: "masthead",
    } as SourceBlock;
    const title = [unit("masthead-title", "masthead-title", "On the Motion")];
    expect(untranslatedSections(["s0", "s1"], [masthead, ...BLOCKS], title)).toEqual(["s0", "s1"]);
    // The introduction's own English still reaches s0, with the masthead present.
    expect(
      untranslatedSections(
        ["s0"],
        [masthead, ...BLOCKS],
        [...title, unit("s0-p1-s1", "s0-p1-s1", "That")],
      ),
    ).toEqual([]);
  });
});

describe("sectionsLabel", () => {
  test("the introduction, single sections, pairs, and runs of three or more", () => {
    expect(sectionsLabel(["s0", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"])).toBe(
      "the introduction and §§ 2–10",
    );
    expect(sectionsLabel(["s3"])).toBe("§ 3");
    expect(sectionsLabel(["s2", "s3"])).toBe("§§ 2 and 3");
    expect(sectionsLabel(["s2", "s4", "s6", "s7", "s8"])).toBe("§§ 2, 4 and 6–8");
    expect(sectionsLabel(["s0"])).toBe("the introduction");
    expect(sectionsLabel([])).toBe("");
  });
});

describe("editionGermanNotice", () => {
  test("labels an unreviewed edition, and says nothing of a reviewed or empty one", () => {
    const notice = editionGermanNotice(BLOCKS);
    expect(notice?.state).toBe("machine-draft");
    expect(notice?.label).toBe("Machine draft, not reviewed");
    // One unreviewed block is enough.
    const reviewed = block("r", "s0", "Geprüft.", "reviewed");
    expect(editionGermanNotice([reviewed, BLOCKS[0] as SourceBlock])?.state).toBe("machine-draft");
    expect(editionGermanNotice([reviewed])).toBeUndefined();
    expect(editionGermanNotice([])).toBeUndefined();
  });
});

describe("the English and parallel faces name what is not yet translated", () => {
  const untranslated = untranslatedSections(SECTIONS, BLOCKS, UNITS);
  const english = (sections: readonly string[]) =>
    renderToStaticMarkup(
      <EnglishFace paper={PAPER} units={UNITS} blocks={BLOCKS} untranslatedSections={sections} />,
    );
  const parallel = (sections: readonly string[]) =>
    renderToStaticMarkup(
      <ParallelFace
        paper={PAPER}
        blocks={BLOCKS}
        units={UNITS}
        alignment={{ id: "a", paper: "mass-energy", edges: [] }}
        untranslatedSections={sections}
      />,
    );

  test("a partial edition says which sections are missing, on both faces", () => {
    for (const html of [english(untranslated), parallel(untranslated)]) {
      expect(html).toContain('data-untranslated-sections="s2 s3 s4"');
      expect(html).toContain("Not yet translated: §§ 2–4.");
    }
  });

  test("a complete edition carries no such notice", () => {
    for (const html of [english([]), parallel([])]) {
      expect(html).not.toContain("data-untranslated-sections");
      expect(html).not.toContain("Not yet translated");
    }
  });

  test("the parallel face's German column carries no draft label, though its blocks are drafts", () => {
    // Non-vacuity: the blocks are unreviewed, which is what earned the label before.
    expect(editionGermanNotice(BLOCKS)?.state).toBe("machine-draft");
    const html = parallel(untranslated);
    expect(html).not.toContain("data-source-draft-notice");
    expect(html).not.toContain("Machine draft, not reviewed");
  });
});

describe("the German face of an unreviewed, partial edition (a paper with no ledger draft)", () => {
  const missing = missingGermanSections(SECTIONS, BLOCKS);
  const german = (full: boolean) =>
    renderToStaticMarkup(
      <GermanFace
        paper={PAPER}
        blocks={BLOCKS}
        missingSections={full ? [] : missing}
        untranscribedPages={full ? [] : [916, 917, 918]}
        pdfHref="/papers/pdfs/ap-18-639.pdf"
        explainedBy={{ "s0-p1": [{ id: "arg-one", title: "The first passage" }] }}
        notExplained={new Set(["s2-p1"])}
      />,
    );

  test("names the sections no German block reaches", () => {
    expect(missing).toEqual(["s3", "s4"]);
    expect(missingGermanSections(["s0", "s1"], BLOCKS)).toEqual([]);
  });

  test("carries no draft label, and names the sections and pages it lacks, with the paragraph links", () => {
    const html = german(false);
    expect(html).not.toContain("data-source-draft-notice");
    expect(html).not.toContain("Machine draft, not reviewed");
    expect(html).toContain('data-missing-sections="s3 s4"');
    expect(html).toContain("Not yet in it: §§ 3 and 4.");
    expect(html).toContain('data-untranscribed-pages="916 917 918"');
    expect(html).toContain("Printed pages 916–918 have not been transcribed yet.");
    expect(html).toContain('href="/papers/pdfs/ap-18-639.pdf"');
    expect(html).toContain('data-explained-by="s0-p1"');
    expect(html).toContain('href="/papers/mass-energy/#arg-one"');
    expect(html).toContain('data-not-explained="s2-p1"');
  });

  test("a footnote is published under its own id as well as footnote-<id>, once", () => {
    // A passage lists its printed paragraphs, footnotes included (content/bindings), and links
    // each at /view/german/#<id>; the German face gave a footnote only footnote-<id>, so the link
    // for special relativity's s2-fn1 landed nowhere (dispatch 192).
    const text = "Zeit bedeutet hier Zeit des ruhenden Systems.";
    const footnote = validateSourceBlock({
      id: "s2-fn1",
      kind: "footnote",
      paper: "mass-energy",
      section: "s2",
      order: 2,
      locators: [{ pdfPageIndex: 1, printedPage: 639 }],
      originalLabel: "1)",
      diplomaticText: text,
      inlines: [{ kind: "text", text }],
      sentenceSpans: [
        {
          id: "s2-fn1",
          span: {
            start: 0,
            end: [...text].length,
            blockRevision: 1,
            textDigest: spanTextDigest(text),
          },
        },
      ],
      revision: 1,
      status: status("draft"),
      lang: "de",
    });
    const html = renderToStaticMarkup(<GermanFace paper={PAPER} blocks={[...BLOCKS, footnote]} />);
    expect(html.split(' id="s2-fn1"').length - 1).toBe(1);
    expect(html).toContain(' id="footnote-s2-fn1"');
    // And it carries its line, as a paragraph does: here, declared unexplained.
    expect(html).not.toContain('data-not-explained="s2-fn1"');
    const declared = renderToStaticMarkup(
      <GermanFace
        paper={PAPER}
        blocks={[...BLOCKS, footnote]}
        notExplained={new Set(["s2-fn1"])}
      />,
    );
    expect(declared).toContain('data-not-explained="s2-fn1"');
  });

  test("a reviewed, complete edition carries none of those statements, and keeps its links", () => {
    const html = german(true);
    expect(html).not.toContain("data-source-draft-notice");
    expect(html).not.toContain("data-missing-sections");
    expect(html).not.toContain("data-untranscribed-pages");
    expect(html).toContain('data-explained-by="s0-p1"');
  });
});

describe("a paper's sections come from its manifest, not its explanation record", () => {
  test("every printed section, in order, closings aside; the explanation's list only as fallback", () => {
    // Brownian motion's explanation record has no § 3; its manifest has every printed section.
    expect(paperSectionIds("brownian-motion", ["s0", "s1", "s2", "s4", "s5"])).toEqual([
      "s0",
      "s1",
      "s2",
      "s3",
      "s4",
      "s5",
    ]);
    expect(paperSectionIds("special-relativity", [])).toEqual(
      Array.from({ length: 11 }, (_, i) => `s${i}`),
    );
    // Mass-energy's manifest carries no sections: the fallback stands.
    expect(paperSectionIds("mass-energy", ["s0"])).toEqual(["s0"]);
  });

  test("Brownian with only its introduction translated names §§ 1-5, § 3 included", () => {
    // SapphireCastle's case (mail 40054): the notice read "§§ 1, 2, 4 and 5".
    const sections = paperSectionIds("brownian-motion", ["s0", "s1", "s2", "s4", "s5"]);
    const intro = BLOCKS.filter((b) => b.section === "s0");
    const units = UNITS.filter((u) => u.id.startsWith("s0-"));
    expect(untranslatedSections(sections, intro, units)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
    expect(sectionsLabel(untranslatedSections(sections, intro, units))).toBe("§§ 1–5");
  });
});

describe("live: each paper translated a section at a time", () => {
  test("its English face names exactly the printed sections no unit reaches, or none once all are", async () => {
    // A property, so it holds as sections land: the notice follows the edition's own coverage
    // and the manifest's sections.
    let papers = 0;
    for (const paperId of ["light-quanta", "brownian-motion", "special-relativity"]) {
      const edition = await loadBilingualEdition(paperId);
      if (!edition || edition.units.length === 0) continue;
      papers += 1;
      const expected = untranslatedSections(
        paperSectionIds(
          paperId,
          edition.paper.sections.map((s) => s.id),
        ),
        edition.blocks,
        edition.units,
      );
      const html = renderToStaticMarkup(await PaperPage({ paperId, face: "english" } as never));
      if (expected.length > 0)
        expect(html).toContain(`data-untranslated-sections="${expected.join(" ")}"`);
      else expect(html).not.toContain("data-untranslated-sections");
    }
    expect(papers).toBeGreaterThan(0);
  });
});
