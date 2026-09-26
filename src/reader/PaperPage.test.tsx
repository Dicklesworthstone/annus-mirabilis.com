import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import type { SourceBlock } from "../content/schemas/source.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_EDITORIAL_NOTES,
  FIXTURE_REVIEW_RECORDS,
} from "../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import {
  FIXTURE_MASS_ENERGY_ALIGNMENT,
  FIXTURE_MASS_ENERGY_GLOSS_UNITS,
  FIXTURE_MASS_ENERGY_PAPER,
  FIXTURE_MASS_ENERGY_SOURCE_BLOCKS,
  FIXTURE_MASS_ENERGY_TRANSLATION_UNITS,
} from "../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { type BilingualEdition, loadBilingualEdition } from "./faces/bilingualLoader.ts";
import { PaperPage } from "./PaperPage.tsx";
import { listReadablePapers } from "./paperRoutes.ts";

async function compiledPaperId(): Promise<string> {
  const papers = await listReadablePapers();
  expect(papers.length).toBeGreaterThan(0);
  const paperId = papers[0];
  if (paperId === undefined) throw new Error("no compiled papers");
  return paperId;
}

/**
 * Derives the exact set of `data-*` attributes queried from the DOM by ReaderController.
 * Extracts:
 * 1. Attribute selectors inside querySelector, querySelectorAll, and closest calls.
 * 2. Attribute names passed to hasAttribute calls.
 */
export function deriveReaderControllerQueriedAttributes(source: string): Set<string> {
  const attributes = new Set<string>();

  // Extract from querySelector, querySelectorAll, closest:
  // e.g. root.querySelector<HTMLDialogElement>("[data-clarification-dialog]")
  // e.g. event.target.closest("[data-foundation],[data-view-link],...")
  const selectorPattern =
    /(?:querySelector(?:All)?|closest)(?:\s*<[^>]+>)?\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
  for (const match of source.matchAll(selectorPattern)) {
    const selector = match[1];
    if (!selector) continue;
    for (const attrMatch of selector.matchAll(/data-[a-z0-9-]+/g)) {
      attributes.add(attrMatch[0]);
    }
  }

  // Extract from hasAttribute calls:
  // e.g. control.hasAttribute("data-foundation")
  const hasAttrPattern = /hasAttribute\s*\(\s*[`'"](data-[a-z0-9-]+)[`'"]/g;
  for (const match of source.matchAll(hasAttrPattern)) {
    const attr = match[1];
    if (attr) {
      attributes.add(attr);
    }
  }

  return attributes;
}

describe("PaperPage", () => {
  test("main reading shell is a ready reader root for the reading face", async () => {
    const paperId = await compiledPaperId();
    const html = await exportMarkup(await PaperPage({ paperId }));
    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="reading"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });

  test("section-scoped reading shell preserves all three readiness contract attributes", async () => {
    const paperId = await compiledPaperId();
    const payload = await (await import("../content/server.ts")).loadPaper(paperId);
    const section = payload.paper.sections[0]?.id;
    if (section === undefined) throw new Error("compiled paper has no sections");
    const html = await exportMarkup(await PaperPage({ paperId, section }));
    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="reading"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });

  test("rendered markup satisfies all data-* contract attributes queried by ReaderController", async () => {
    const controllerPath = resolve(dirname(fileURLToPath(import.meta.url)), "ReaderController.tsx");
    const controllerSource = await readFile(controllerPath, "utf8");
    const queriedAttributes = deriveReaderControllerQueriedAttributes(controllerSource);

    // Hard floor baseline: ReaderController's contract requires these 16 attributes.
    // If ReaderController introduces new queries, the derivation will automatically
    // add them to queriedAttributes, enforcing self-maintenance.
    const baselineContract = [
      "data-clarification-dialog",
      "data-clarification-open",
      "data-compass-idea",
      "data-compass-question",
      "data-copy-fallback",
      "data-copy-passage",
      "data-detail-control",
      "data-foundation",
      "data-foundation-panel",
      "data-lens-control",
      "data-reader-anchor",
      "data-reader-announcement",
      "data-reader-back",
      "data-reader-close",
      "data-reader-root",
      "data-view-link",
    ] as const;

    for (const attr of baselineContract) {
      expect(queriedAttributes.has(attr)).toBe(true);
    }

    const paperId = await compiledPaperId();
    const html = await exportMarkup(await PaperPage({ paperId }));

    // Every attribute queried by ReaderController must appear in PaperPage's rendered markup
    const missingFromMarkup: string[] = [];
    for (const attr of queriedAttributes) {
      if (!html.includes(attr)) {
        missingFromMarkup.push(attr);
      }
    }

    expect(missingFromMarkup).toEqual([]);
  });

  test("face route branch: the German face now serves the draft transcript, the other three still fall back", async () => {
    // THE GERMAN ASSERTION CHANGED ON 2026-09-21 AND THE CHANGE IS THE DELIVERABLE, not a
    // relaxation. This test was named "(the live condition today)" and pinned an absence:
    // brownian-motion's German face said "not yet available" because nothing emitted a
    // source payload. am-dl4n criterion 2 is that payload, under the owner's ruling "Show
    // it, labelled a draft", so the absence is gone because the content shipped.
    //
    // EVERY ASSERTION THAT IS STILL TRUE IS KEPT, and that is what makes this an update
    // rather than a weakening: the English, parallel and gloss faces still fall back,
    // because a ledger provides no translation units and claiming otherwise would be the
    // real regression. Those three are now the control on the German one.
    const paperId = "brownian-motion";
    const germanMarkup = renderToStaticMarkup(await PaperPage({ paperId, face: "german" }));

    // The German face serves the transcript. Its "Machine draft, not reviewed" label was
    // withdrawn by D-2026-09-25-no-review-status-banners, so it is served without one.
    expect(germanMarkup).not.toContain(
      "The German source text for this paper is not yet available",
    );
    expect(germanMarkup).toContain('data-view="german"');
    expect(germanMarkup).toContain('data-face-source="true"');
    expect(germanMarkup).not.toContain("Machine draft, not reviewed");
    expect(germanMarkup).toMatch(/[äöüßÄÖÜ]/);

    // Since dispatch 255 the blocks a reader sees are the source-block records, not the ledger
    // draft's (germanFaceRendersEdition; mail 40854), and the draft's segment ids are gone.
    expect(germanMarkup).toContain("source-blocks-list");
    expect(germanMarkup).not.toContain('id="bm-s4-p1"');

    // Same honest fallback holds on English, parallel, and gloss faces when the edition has no
    // units for them. Brownian's own English began arriving a section at a time on 2026-09-25, so
    // the live paper can no longer stand for "no English"; the control is the live edition with its
    // translation and gloss units taken away, which is the condition these three assertions name.
    const live = await loadBilingualEdition(paperId);
    expect(live?.blocks.length ?? 0).toBeGreaterThan(0);
    const noTranslation = { ...(live as BilingualEdition), units: [], glossUnits: [] };

    const englishMarkup = renderToStaticMarkup(
      await PaperPage({ paperId, face: "english" }, { edition: noTranslation }),
    );
    expect(englishMarkup).toContain("The English translation for this paper is not yet available");

    const parallelMarkup = renderToStaticMarkup(
      await PaperPage({ paperId, face: "parallel" }, { edition: noTranslation }),
    );
    expect(parallelMarkup).toContain(
      "The parallel German and English text for this paper is not yet available",
    );

    const glossMarkup = renderToStaticMarkup(
      await PaperPage({ paperId, face: "gloss" }, { edition: noTranslation }),
    );
    expect(glossMarkup).toContain("The interlinear gloss for this paper is not yet available");
  });

  test("face route wiring decision (not live edition): paper with source blocks renders GermanFace with anchors and printed equation labels, and not-yet-available notice is absent", async () => {
    const fixtureEdition: BilingualEdition = {
      paper: FIXTURE_BROWNIAN_PAPER,
      blocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      units: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
      alignment: FIXTURE_BROWNIAN_ALIGNMENT,
      editorialNotes: FIXTURE_EDITORIAL_NOTES,
      reviewRecords: FIXTURE_REVIEW_RECORDS,
    };

    const paperId = "brownian-motion";
    const germanMarkup = renderToStaticMarkup(
      await PaperPage({ paperId, face: "german" }, { edition: fixtureEdition }),
    );

    // GermanFace output is rendered
    expect(germanMarkup).toContain('data-face="german"');
    expect(germanMarkup).toContain('lang="de"');
    expect(germanMarkup).toContain("source-blocks-list");

    // Anchors are present
    expect(germanMarkup).toContain('id="bm-s4-p1"');
    expect(germanMarkup).toContain('id="bm-s4-eq1"');
    expect(germanMarkup).toContain('id="bm-s5-p1"');

    // Printed equation labels and printed notation are present
    expect(germanMarkup).toContain('data-equation-label="1"');
    expect(germanMarkup).toContain("(1)");
    expect(germanMarkup).toContain('data-printed-notation="true"');

    // Date-line and footnotes are present
    expect(germanMarkup).toContain("Bern, Mai 1905.");
    expect(germanMarkup).toContain('id="footnote-bm-s5-fn1"');

    // The not-yet-available notice is strictly ABSENT
    expect(germanMarkup).not.toContain("is not yet available");
    expect(germanMarkup).not.toContain(
      "The German source text for this paper is not yet available",
    );
  });

  test("face route wiring decision (not live edition): paper with source blocks renders EnglishFace and ParallelFace with real units and fallback notice absent", async () => {
    const fixtureEdition: BilingualEdition = {
      paper: FIXTURE_BROWNIAN_PAPER,
      blocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      units: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
      alignment: FIXTURE_BROWNIAN_ALIGNMENT,
      editorialNotes: FIXTURE_EDITORIAL_NOTES,
      reviewRecords: FIXTURE_REVIEW_RECORDS,
    };

    const paperId = "brownian-motion";

    // EnglishFace
    const englishMarkup = renderToStaticMarkup(
      await PaperPage({ paperId, face: "english" }, { edition: fixtureEdition }),
    );
    expect(englishMarkup).toContain('data-face="english"');
    expect(englishMarkup).toContain('id="tr-bm-s4-p1-u1"');
    expect(englishMarkup).toContain('id="tr-bm-s4-eq1"');
    expect(englishMarkup).not.toContain("is not yet available");

    // ParallelFace
    const parallelMarkup = renderToStaticMarkup(
      await PaperPage({ paperId, face: "parallel" }, { edition: fixtureEdition }),
    );
    expect(parallelMarkup).toContain('data-face="parallel"');
    expect(parallelMarkup).toContain('id="bm-s4-p1"');
    expect(parallelMarkup).toContain('id="tr-bm-s4-p1-u1"');
    expect(parallelMarkup).toContain('data-equation-label="1"');
    expect(parallelMarkup).not.toContain("is not yet available");
  });

  test("an edition of machine-draft blocks renders its German face from the blocks, with plates and chooser and no draft label; parallel uses the blocks", async () => {
    // Until dispatch 255 blocks derived from a machine-draft ledger kept the ledger draft's face,
    // for its plates and chooser, and the edition took the German face over only when every block
    // was reviewed. GermanFace now carries both, and the draft face had no sentence spans or page
    // turns, so the blocks render whenever there are any (germanFaceRendersEdition; mail 40854).
    // Neither face carries a draft label (D-2026-09-25-no-review-status-banners).
    const asDraft = (b: SourceBlock): SourceBlock => ({
      ...b,
      status: { ...b.status, transcription: "draft", translation: "draft", review: "draft" },
    });
    const edition: BilingualEdition = {
      paper: FIXTURE_MASS_ENERGY_PAPER,
      blocks: FIXTURE_MASS_ENERGY_SOURCE_BLOCKS.map(asDraft),
      units: FIXTURE_MASS_ENERGY_TRANSLATION_UNITS,
      alignment: FIXTURE_MASS_ENERGY_ALIGNMENT,
    };
    const paperId = "mass-energy";
    const german = renderToStaticMarkup(await PaperPage({ paperId, face: "german" }, { edition }));
    expect(german).not.toContain("data-german-draft");
    expect(german).not.toContain("data-source-draft-notice");
    expect(german).not.toContain("Machine draft, not reviewed");
    expect(german).toContain('class="source-plate"');
    expect(german).toContain('class="face-tabs"');
    expect(german).toContain("source-blocks-list");

    // Nor does one unreviewed block among reviewed ones bring the draft face back.
    const mixed: BilingualEdition = {
      ...edition,
      blocks: FIXTURE_MASS_ENERGY_SOURCE_BLOCKS.map((b, i) => (i === 0 ? asDraft(b) : b)),
    };
    const mixedGerman = renderToStaticMarkup(
      await PaperPage({ paperId, face: "german" }, { edition: mixed }),
    );
    expect(mixedGerman).not.toContain("data-german-draft");
    expect(mixedGerman).toContain("source-blocks-list");

    // The control: the same blocks, all reviewed, take the German face over.
    const reviewed = renderToStaticMarkup(
      await PaperPage(
        { paperId, face: "german" },
        { edition: { ...edition, blocks: FIXTURE_MASS_ENERGY_SOURCE_BLOCKS } },
      ),
    );
    expect(reviewed).toContain("source-blocks-list");
    expect(reviewed).toContain('id="me-p1"');
    expect(reviewed).not.toContain("data-german-draft");

    // The draft blocks still serve the parallel face.
    const parallel = renderToStaticMarkup(
      await PaperPage({ paperId, face: "parallel" }, { edition }),
    );
    expect(parallel).toContain('data-face="parallel"');
    expect(parallel).toContain('id="me-p1"');
  });

  test("face route wiring decision (not live edition): paper with source blocks and gloss units renders GlossFace and fallback notice is absent", async () => {
    const fixtureEdition: BilingualEdition = {
      paper: FIXTURE_MASS_ENERGY_PAPER,
      blocks: FIXTURE_MASS_ENERGY_SOURCE_BLOCKS,
      units: FIXTURE_MASS_ENERGY_TRANSLATION_UNITS,
      glossUnits: FIXTURE_MASS_ENERGY_GLOSS_UNITS,
      alignment: FIXTURE_MASS_ENERGY_ALIGNMENT,
    };

    const paperId = "mass-energy";
    const glossMarkup = renderToStaticMarkup(
      await PaperPage({ paperId, face: "gloss" }, { edition: fixtureEdition }),
    );

    // GlossFace output is rendered
    expect(glossMarkup).toContain('data-face="gloss"');
    expect(glossMarkup).toContain('data-reasoning-words="off"');
    expect(glossMarkup).toContain(
      "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?",
    );
    expect(glossMarkup).toContain('data-sentence-id="me-p1-s1"');
    expect(glossMarkup).toContain('data-source-sentence="true"');
    expect(glossMarkup).toContain('data-alignment-live-region="true"');

    // Not-yet-available notice is absent
    expect(glossMarkup).not.toContain("is not yet available");
  });
});
