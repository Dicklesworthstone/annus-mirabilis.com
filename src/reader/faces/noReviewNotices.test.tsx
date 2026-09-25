/**
 * NO REVIEW NOTICE ON ANY READING PAGE (dispatch 222; D-2026-09-25-no-review-status-banners and
 * D-2026-09-25-one-best-translation).
 *
 * The owner, of the English face's "Translated and checked by AI agents … No person has reviewed
 * it." banner: "we don't need messages like this on the site, they just detract from the site and
 * the experience and aren't meaningful". And of the alternatives: "we should just always use the
 * BEST translation overall". So no reading page carries a review banner, a per-unit review chip, a
 * translator credit line, the German draft label, the paper's review-status disclosure, a /papers/
 * review badge or an "Alternative translations" disclosure.
 *
 * Two populations, because either alone can pass while proving nothing:
 * - the live pages, every face of all four papers, the paper pages and /papers/, rendered on the
 *   server as the build renders them;
 * - fixtures holding exactly what used to earn each element: machine-draft units beside reviewed
 *   ones and a person's review records (the chip and "partly reviewed" banner), a unit with a
 *   recorded alternative, a draft gloss, and unreviewed German blocks. The live data changes as
 *   units are resolved (dispatch 223 empties the alternatives), and a rule tested only on data that
 *   no longer triggers it would pass while testing nothing.
 *
 * What stays is navigation, and it is not asserted away here: "Not yet translated", "Not yet
 * glossed", a German text that does not reach every section. The honesty rule stays too, and is
 * asserted: no page claims a person reviewed anything.
 */
import { describe, expect, test } from "bun:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Papers from "../../app/papers/page";
import { getModalityClasses } from "../../content/schemas/glossConventions.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
  FIXTURE_REVIEW_RECORDS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import {
  FIXTURE_MASS_ENERGY_ALIGNMENT,
  FIXTURE_MASS_ENERGY_GLOSS_UNITS,
  FIXTURE_MASS_ENERGY_PAPER,
  FIXTURE_MASS_ENERGY_SOURCE_BLOCKS,
  FIXTURE_MASS_ENERGY_TRANSLATION_UNITS,
} from "../../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { PaperPage } from "../PaperPage.tsx";
import { PaperReader } from "../PaperReader.tsx";
import { EnglishFace } from "./EnglishFace.tsx";
import { GlossFace } from "./GlossFace.tsx";
import { ParallelFace } from "./ParallelFace.tsx";

/** Each removed element, by the markup or words it rendered. */
const REMOVED: Readonly<Record<string, RegExp>> = {
  "review banner": /data-(?:unreviewed|agent-checked)-banner|unreviewed-translation-banner/,
  "agent notice": /Translated and checked by AI agents|[Nn]o (?:person|one) has reviewed/,
  "review chip": /data-review-badge|class="[^"]*\breview-badge\b/,
  "translator credit": /translator-credit|Translated by /,
  "gloss banner": /Gloss review status|Machine-drafted gloss/,
  "German draft label": /data-source-draft-(?:notice|persistent)|Machine draft, not reviewed/,
  "review-status disclosure": /<details[^>]*data-source-status|Draft explanation, not yet reviewed/,
  "alternatives disclosure": /class="unresolved-alternatives"|Alternative translations/,
  "/papers/ review badge": /German text in unreviewed draft|English translation checked by AI/,
};
/** The honesty rule that stays: nothing says a person reviewed it. */
const CLAIMS_A_PERSON = /reviewed by (?:a person|[A-Z][a-z]+ [A-Z])|reviewed against the German by/;

/**
 * Review-status copy in the words a reader meets, anywhere on a page (dispatch 226): the home and
 * about pages' tallies, a paper page's hidden per-passage line ("The reviewed German, aligned
 * English, … are not yet available"), "not a reviewed transcription" under the equations, and the
 * pending-review lines the rest of the site carried. Read from the text, not the markup, so a
 * data attribute naming a review state (the audit trail) is not copy; hidden text counts, because
 * ?view= shows it.
 */
const REVIEW_COPY =
  /not yet reviewed|reviews? (?:is |are )?pending|remains? pending|pending review|no (?:person|one)(?: else)? has (?:yet )?reviewed|awaiting review|unreviewed|checked (?:against the German )?by AI agents|none by a person|second reader|draft explanation|machine[- ]draft|reviewed (?:German|transcription|translation|edition|historical|dataset|account|journey|real)|not a reviewed|(?:source|editorial|physics) review|(?:marked|labelled|shown) as a draft/i;

const textOf = (html: string) =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/g, " ")
    .replace(/<style\b[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
/** Each piece of review copy on the page, in a little context. */
function reviewCopy(html: string): string[] {
  const text = textOf(html);
  const re = new RegExp(REVIEW_COPY.source, "gi");
  return [...text.matchAll(re)].map((m) =>
    text.slice(Math.max(0, (m.index ?? 0) - 50), (m.index ?? 0) + 40),
  );
}

function violations(html: string): string[] {
  const found = Object.entries(REMOVED)
    .filter(([, re]) => re.test(html))
    .map(([name, re]) => `${name}: "${html.match(re)?.[0]}"`);
  if (CLAIMS_A_PERSON.test(html))
    found.push(`claims a person: "${html.match(CLAIMS_A_PERSON)?.[0]}"`);
  return found;
}

const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;
/** Each face, and the mark that says it rendered the face and not a fallback or an error. */
const FACES: Readonly<Record<string, string>> = {
  english: 'data-face="english"',
  parallel: 'data-face="parallel"',
  german: 'data-view="german"',
  gloss: 'data-face="gloss"',
  results: 'data-view="results"',
  facsimile: 'data-view="facsimile"',
};

describe("no reading page carries a review notice", () => {
  test("every face of all four papers", async () => {
    const wrong: string[] = [];
    let rendered = 0;
    for (const paper of PAPERS)
      for (const [face, mark] of Object.entries(FACES)) {
        const html = await exportMarkup(await PaperPage({ paperId: paper, face } as never));
        // Non-vacuity: the face itself, not a fallback, with a page's worth of content.
        expect({ paper, face, rendered: html.includes(mark) && html.length > 5000 }).toEqual({
          paper,
          face,
          rendered: true,
        });
        rendered++;
        for (const v of violations(html)) wrong.push(`${paper} ${face}: ${v}`);
        for (const c of reviewCopy(html)) wrong.push(`${paper} ${face}: review copy "${c}"`);
      }
    expect(rendered).toBe(PAPERS.length * Object.keys(FACES).length);
    expect(wrong).toEqual([]);
  });

  test("each paper's own page, and /papers/", async () => {
    const wrong: string[] = [];
    for (const paper of PAPERS) {
      // Brownian's paper page is PaperReader (src/app/papers/[paper]/page.tsx); the others PaperPage.
      const element =
        paper === "brownian-motion"
          ? createElement(PaperReader)
          : await PaperPage({ paperId: paper });
      const html = await exportMarkup(element);
      expect({ paper, reading: html.includes('data-view="reading"') }).toEqual({
        paper,
        reading: true,
      });
      for (const v of violations(html)) wrong.push(`${paper} paper page: ${v}`);
      // Including each passage's hidden source block, which ?view=german shows in its place.
      expect(html).toContain("data-face-source");
      for (const c of reviewCopy(html)) wrong.push(`${paper} paper page: review copy "${c}"`);
    }
    const index = renderToStaticMarkup(createElement(Papers));
    expect(index).toContain('class="paper-index"');
    for (const v of violations(index)) wrong.push(`/papers/: ${v}`);
    for (const c of reviewCopy(index)) wrong.push(`/papers/: review copy "${c}"`);
    expect(wrong).toEqual([]);
  });

  // Dispatch 226: the home and about pages, and every other page that carried review copy.
  test("the home and about pages, and every other page that carried review copy", async () => {
    const root = "../../app";
    type Loader = () => Promise<unknown>;
    const page =
      (path: string, props?: Record<string, unknown>): Loader =>
      async () => {
        const Default = (await import(`${root}/${path}`)).default as (p: unknown) => unknown;
        return Default(props ?? {});
      };
    const tours = (await import(`${root}/tours/[tour]/page.tsx`)).generateStaticParams() as {
      tour: string;
    }[];
    const concepts = (
      (await (await import(`${root}/foundations/[concept]/page.tsx`)).generateStaticParams()) as {
        concept: string;
      }[]
    ).slice(0, 3);
    const pages: [string, Loader][] = [
      ["/", page("page.tsx")],
      ["/about/", page("about/page.tsx")],
      ["/sources/", page("sources/page.tsx")],
      ["/instruments/", page("instruments/page.tsx")],
      ["/tours/", page("tours/page.tsx")],
      ["/offline/", page("offline/page.tsx")],
      ["/foundations/", page("foundations/page.tsx")],
      ["/notation/", page("notation/page.tsx")],
      ["/embed/", page("embed/page.tsx")],
      ["/kitchen/", page("kitchen/page.tsx")],
      ["/discover/light-quanta/", page("discover/light-quanta/page.tsx")],
      ["/discover/brownian-motion/", page("discover/brownian-motion/page.tsx")],
      ["/discover/mass-energy/", page("discover/mass-energy/page.tsx")],
      ["/discover/light-quanta/investigate/", page("discover/light-quanta/investigate/page.tsx")],
      ["/discover/mass-energy/investigate/", page("discover/mass-energy/investigate/page.tsx")],
      [
        "/discover/special-relativity/investigate/",
        page("discover/special-relativity/investigate/page.tsx"),
      ],
      ["/lab/bm-01/", page("lab/bm-01/page.tsx")],
      ["/lab/bm-05/", page("lab/bm-05/page.tsx")],
      ["/lab/bm-07/", page("lab/bm-07/page.tsx")],
      ["/lab/bm-08/", page("lab/bm-08/page.tsx")],
      ["/lab/countermodels/independence/", page("lab/countermodels/independence/page.tsx")],
      ...tours.map(({ tour }): [string, Loader] => [
        `/tours/${tour}/`,
        page("tours/[tour]/page.tsx", { params: Promise.resolve({ tour }) }),
      ]),
      ...concepts.map(({ concept }): [string, Loader] => [
        `/foundations/${concept}/`,
        page("foundations/[concept]/page.tsx", { params: Promise.resolve({ concept }) }),
      ]),
    ];
    // Non-vacuity: timed tours are among them (TimedTour said "A draft path: no one has reviewed it
    // yet"), and every page renders a page's worth of text.
    expect(tours.length).toBeGreaterThan(1);
    expect(concepts.length).toBeGreaterThan(0);
    const wrong: string[] = [];
    for (const [path, load] of pages) {
      const html = await exportMarkup((await load()) as ReactElement);
      expect({ path, rendered: textOf(html).length > 400 }).toEqual({ path, rendered: true });
      for (const v of violations(html)) wrong.push(`${path}: ${v}`);
      for (const c of reviewCopy(html)) wrong.push(`${path}: review copy "${c}"`);
    }
    expect(wrong).toEqual([]);
  });
});

describe("what used to earn each notice still earns none", () => {
  // The Brownian fixture mixes reviewed units with drafts, carries a person's review
  // records, and has a unit with a recorded alternative: the chip, the "partly reviewed" banner,
  // the credit line and the disclosure each had their trigger here.
  const units = FIXTURE_BROWNIAN_TRANSLATION_UNITS;
  test("the fixture holds every trigger", () => {
    expect(units.some((u) => u.reviewState !== "reviewed")).toBe(true);
    expect(units.some((u) => u.reviewState === "reviewed")).toBe(true);
    expect(units.some((u) => u.unresolvedAlternatives.length > 0)).toBe(true);
    expect(FIXTURE_REVIEW_RECORDS.length).toBeGreaterThan(0);
    expect(FIXTURE_MASS_ENERGY_GLOSS_UNITS.some((g) => g.reviewState !== "reviewed")).toBe(true);
    expect(FIXTURE_BROWNIAN_SOURCE_BLOCKS.length).toBeGreaterThan(0);
  });

  test("the English and parallel faces", () => {
    const english = renderToStaticMarkup(
      <EnglishFace
        paper={FIXTURE_BROWNIAN_PAPER}
        units={units}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );
    const parallel = renderToStaticMarkup(
      <ParallelFace
        paper={FIXTURE_BROWNIAN_PAPER}
        blocks={FIXTURE_BROWNIAN_SOURCE_BLOCKS}
        units={units}
        alignment={FIXTURE_BROWNIAN_ALIGNMENT}
        reviewRecords={FIXTURE_REVIEW_RECORDS}
      />,
    );
    for (const u of units) expect(english).toContain(`data-translation-unit-id="${u.id}"`);
    expect(violations(english)).toEqual([]);
    expect(violations(parallel)).toEqual([]);
  });

  test("the gloss face, over a draft gloss", () => {
    const html = renderToStaticMarkup(
      <GlossFace
        paper={FIXTURE_MASS_ENERGY_PAPER}
        blocks={FIXTURE_MASS_ENERGY_SOURCE_BLOCKS}
        glossUnits={FIXTURE_MASS_ENERGY_GLOSS_UNITS}
        translations={FIXTURE_MASS_ENERGY_TRANSLATION_UNITS}
        alignment={FIXTURE_MASS_ENERGY_ALIGNMENT}
        modalityClasses={getModalityClasses()}
      />,
    );
    expect(html).toContain('data-face="gloss"');
    expect(violations(html)).toEqual([]);
  });
  // The German draft label is guarded on the live German faces above, where PaperPage chose it:
  // GermanFace rendered one only when passed it, so a direct render could never fail.
});
