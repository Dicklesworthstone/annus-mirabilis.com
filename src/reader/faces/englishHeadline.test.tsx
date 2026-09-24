/**
 * The English face's title is the translated masthead, with Einstein's title beneath it; the
 * explanation's title is no longer the h1 (translationMasthead.ts).
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { type TranslationUnit, validateTranslationUnit } from "../../content/schemas/source.ts";
import { FIXTURE_MASS_ENERGY_PAPER } from "../../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { EnglishFace } from "./EnglishFace.tsx";
import { ParallelFace } from "./ParallelFace.tsx";

const unit = (id: string, text: string): TranslationUnit =>
  validateTranslationUnit({
    id,
    sourceRefs: [{ paper: "mass-energy", id }],
    inlines: [{ kind: "text", text }],
    translator: { id: "agent:test", kind: "model", modelId: "test" },
    revision: 1,
    reviewState: "machine-draft",
    lang: "en",
  });
const TITLE = "Does the Inertia of a Body Depend on Its Energy Content?";
const UNITS = [
  unit("masthead-title", TITLE),
  unit("masthead-author", "by A. Einstein"),
  unit("s0-p1-s1", "The results of an electrodynamic investigation lead to a conclusion."),
];
const h1 = (html: string) => /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]?.replace(/<[^>]+>/g, "");

describe("the English face's headline", () => {
  test("is the translated masthead, under its unit id, with Einstein's title beneath", () => {
    const html = renderToStaticMarkup(
      <EnglishFace paper={FIXTURE_MASS_ENERGY_PAPER} units={UNITS} />,
    );
    expect(h1(html)).toBe(TITLE);
    expect(h1(html)).not.toBe(FIXTURE_MASS_ENERGY_PAPER.titleEnglishWorking);
    expect(html).toMatch(/<h1[^>]*\sid="masthead-title"/);
    expect(html).toContain(
      `<p class="parallel-german-title" lang="de"><em>${FIXTURE_MASS_ENERGY_PAPER.titleGerman}</em></p>`,
    );
    // Hoisted, not repeated: each masthead unit appears once, and the body opens with the text.
    expect(html.split('data-translation-unit-id="masthead-title"').length - 1).toBe(1);
    expect(html.split('data-translation-unit-id="masthead-author"').length - 1).toBe(1);
    expect(html).toContain("by A. Einstein");
    expect(html).not.toContain("By A. Einstein");
  });

  test("falls back to the paper's working title when no unit translates the masthead", () => {
    const html = renderToStaticMarkup(
      <EnglishFace paper={FIXTURE_MASS_ENERGY_PAPER} units={UNITS.slice(2)} />,
    );
    expect(h1(html)).toBe(FIXTURE_MASS_ENERGY_PAPER.titleEnglishWorking);
    expect(html).toContain("By A. Einstein");
  });

  test("the parallel face's h1 is the translated masthead too", () => {
    const html = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_MASS_ENERGY_PAPER}
        blocks={[]}
        units={UNITS}
        alignment={{ id: "a", paper: "mass-energy", edges: [] }}
      />,
    );
    expect(h1(html)).toBe(TITLE);
  });
});
