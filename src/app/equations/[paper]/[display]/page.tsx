import { notFound } from "next/navigation";
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
  return { title: `${display}: the equation explained`, description: words.slice(0, 160) };
}

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
    </main>
  );
}
