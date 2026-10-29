import { notFound } from "next/navigation";
import { loadPaper } from "../../../../content/server.ts";
import {
  equationCatalogue,
  explainedEquationLabel,
  sectionLabeller,
  shortPaperName,
} from "../../../../equations/printed/catalogue.ts";
import {
  everyExplanationRoute,
  fullExplanation,
} from "../../../../equations/printed/fullExplanations.ts";
import { ExplainerBody } from "../../../../reader/faces/EquationExplainer.tsx";
import "../../../../reader/faces/equationExplainer.css";

/**
 * ONE EQUATION'S EXPLANATION, IN FULL (dispatch 292). The reading faces carry a panel that fetches
 * its levels when a reader opens it, so this is where the levels live for a reader without
 * JavaScript, and where a panel sends one whose fetch fails. Every word of every level is here.
 *
 * The markup is ExplainerBody's, the same component the build renders into the fetched fragment, so
 * the page and the panel can never say different things.
 *
 * IT IS A PAGE, AND IT DRAWS THE EQUATION (dispatch 303). Asked whether this should render the
 * equation above the explanation or stop being a page at all - a route serving a fragment, kept out
 * of the sitemap and out of indexing - it draws the equation. The reason is that it cannot stop being
 * a page: it is the whole of the no-script route from a printed display to its explanation, which
 * AGENTS.md requires be a real link, and it is where a failed fetch lands. A reader reaches it cold,
 * from a search result or a shared link, and an explanation of an equation that is not on the screen
 * is not an explanation. Until this dispatch that is exactly what all 243 of these pages were, and a
 * model equation's page had no mathematics on it at all.
 *
 * So the equation is drawn above its explanation, with the authored spoken form as its accessible
 * name, exactly as a reading face presents a printed display (PrintedDisplayTerms), and a link under
 * it leads back to where the equation is printed: the passage in the paper for a printed display, the
 * step for a model equation, the laboratory for a laboratory's formula. The drawn equation is carried
 * by the payload this page alone reads, so no face, card or fragment grew by a byte.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return everyExplanationRoute().map(({ paper, display }) => ({ paper, display }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ paper: string; display: string }>;
}) {
  const { paper, display } = await params;
  const explanation = fullExplanation(paper, display);
  if (!explanation) return {};
  const words = explanation.inWords.map((phrase) => phrase.text).join("");
  const record = await loadPaper(paper);
  const row = equationCatalogue(paper).find((r) => r.display === display);
  const label = row
    ? explainedEquationLabel(paper, display, row.kind, sectionLabeller(record.paper.sections))
    : undefined;
  return {
    title: `${shortPaperName(record.paper.title)} · ${label ?? display} explained`,
    description: words.slice(0, 160),
  };
}

/**
 * THE TITLE NAMED THE DISPLAY AND NOT THE PAPER, SO 117 OF THESE 279 PAGES WERE AMBIGUOUS -- AND
 * THE NAME IT SHOULD HAVE USED WAS ALREADY BUILT, FOR THE SEARCH DOCUMENT POINTING AT THIS PAGE.
 *
 * It was `` `${display}: the equation explained` ``. Display ids repeat across papers -- `eq-s1-d1`
 * exists in brownian-motion, light-quanta AND special-relativity -- so three different pages carried
 * byte-identical titles. Measured over the 764 built pages on 2026-10-28: 692 distinct titles, 49
 * shared by more than one route, and **47 of those 49 were these pages, covering 117 routes**. The
 * only two others are `/instruments/` against one more route, and the home title against one more.
 *
 * A reader with three tabs, three bookmarks or three search results could not tell which paper's
 * equation they had. Worse, `src/search/documents.ts` already describes the right name and
 * `scripts/build-search-index.ts` already computed it: "For a printed display it is the locator a
 * reader would cite, '§3, display 7' (equationLocator); for the other two it is the name the id
 * carries, 'Light postulate' or 'SR-03: Minkowski interval' (explainedEquationTitle)." So a reader
 * searching found a well-named result and landed on a page titled with the raw id.
 *
 * Both now call one function, `explainedEquationLabel`, with one labeller, `sectionLabeller`, whose
 * docblock holds the one-section rule that was previously written in the index builder alone. A
 * derivation step has neither shape, so those 35 fall back to the display id -- the equation's
 * address, which is what the catalogue shows beside every row for the same reason.
 *
 * WHAT THIS DOES NOT FIX, measured and recorded on am-bzsk so nobody re-derives it: there is no
 * short authored NAME for an equation anywhere in the data. `inWords` is a paragraph (median 187
 * characters, max 521), `source.label` has four distinct values across all 279, and `printed.spoken`
 * is the formula read aloud (median 84, max 1,672). I wrote a capped-sentence title, measured 261 of
 * 279 ending in an ellipsis, and withdrew it.
 *
 * `shortPaperName` lives in `catalogue.ts` with the other title derivations rather than here,
 * because a Next page module may export only the route's own exports -- `tsc` refuses any other
 * export with TS2344 against `{ [x: string]: never }`, which is how that constraint announces
 * itself.
 */

export default async function Page({
  params,
}: {
  params: Promise<{ paper: string; display: string }>;
}) {
  const { paper, display } = await params;
  const explanation = fullExplanation(paper, display);
  if (!explanation) notFound();
  return (
    <main className="equation-explanation-page" data-paper={paper} data-explains={display}>
      <p className="eyebrow">{paper.replace(/-/g, " ")}</p>
      <h1>The equation explained</h1>
      {explanation.printed ? (
        // biome-ignore lint/a11y/useSemanticElements: a fieldset groups form controls; this is a drawn formula, given the group role and the authored spoken form as its name exactly as a reading face gives a printed display (PrintedDisplayTerms).
        <div
          className="equation-explanation-formula"
          role="group"
          aria-label={explanation.printed.spoken}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output compiled by the build from the same checked record the reading face draws (printed-displays.json, equationExplanations.ts).
          dangerouslySetInnerHTML={{ __html: explanation.printed.html }}
        />
      ) : null}
      <div className="equation-explanation-levels">
        <ExplainerBody explanation={explanation} />
      </div>
      {explanation.source ? (
        <p className="equation-explanation-source">
          <a href={explanation.source.href}>{explanation.source.label}</a>
        </p>
      ) : null}
      {/* The way up, which did not exist until am-9p8v: /equations/<paper>/ was a 404 with between
          40 and 122 of these pages beneath it, so trimming this address reached nothing. */}
      <p className="equation-explanation-catalogue">
        <a href={`/equations/${paper}/`}>Every equation in this paper</a>
      </p>
    </main>
  );
}
