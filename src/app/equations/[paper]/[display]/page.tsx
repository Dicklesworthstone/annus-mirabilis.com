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
      <p className="eq-explain-words equation-sentence">
        <span className="eq-level-name">In words</span>
        {explanation.inWords.map((phrase, n) =>
          phrase.quantityId ? (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: the phrases are a fixed sentence and never reorder.
              key={n}
              className="equation-quantity"
              data-quantity-id={phrase.quantityId}
            >
              {phrase.text}
            </span>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: as above.
            <span key={n}>{phrase.text}</span>
          ),
        )}
      </p>
      <div className="equation-explanation-levels">
        <ExplainerBody explanation={explanation} />
      </div>
    </main>
  );
}
