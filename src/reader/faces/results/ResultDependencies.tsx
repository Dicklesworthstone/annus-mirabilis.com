import type {
  DependencyRouteKind,
  ResultDependency,
} from "../../../content/results/resultDependencies.ts";
import { InlineMathText } from "../../InlineMathText.tsx";
import "./resultDependencies.css";

const ROUTE_LABEL: Readonly<Record<DependencyRouteKind, string>> = {
  "source-order": "Inputs in the source-order route",
  teaching: "Inputs in a teaching route",
};

/** Semantic links and native disclosures keep this navigation useful without JavaScript. */
export function ResultDependencies({ results }: { results: readonly ResultDependency[] }) {
  if (results.length === 0) return null;
  return (
    <section
      id="result-dependencies"
      className="result-dependencies"
      aria-labelledby="result-dependencies-title"
      data-result-dependencies=""
    >
      <h3 id="result-dependencies-title">How these results fit together</h3>
      <p>
        Follow a result back to the formulas and passages its calculation uses, or forward to
        another route that uses it. Teaching routes may start from results introduced later in the
        paper. Their order describes an explanation you can follow, not the order of the historical
        argument.
      </p>
      <p className="fine">
        These links cover the routes shown here. Each calculation keeps its physical assumptions and
        its scope. A statement without a supporting calculation still has its source and its place
        in the argument below.
      </p>
      <ol className="result-dependencies-list">
        {results.map((result) => (
          <li key={result.resultId} data-dependency-result={result.resultId}>
            <h4>
              <a href={result.href}>{result.title}</a>
            </h4>
            <p className="fine">
              <InlineMathText text={result.argumentStatus} />
            </p>
            {result.routes.map((route) => (
              <div key={route.kind} data-dependency-route={route.kind}>
                <p className="result-dependencies-label">{ROUTE_LABEL[route.kind]}</p>
                <ul>
                  {route.inputs.map((input) => (
                    <li key={input.ref} data-dependency-input={input.ref}>
                      <a href={input.href}>{input.label}</a>
                      {input.kind === "equation" ? " (equation in its explanation)" : null}
                      {input.kind === "passage" ? " (input passage)" : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {result.uses.length > 0 ? (
              <div>
                <p className="result-dependencies-label">Used by these routes</p>
                <ul>
                  {result.uses.map((use) => (
                    <li key={`${use.resultId}/${use.kind}`}>
                      <a href={use.href}>{use.title}</a>
                      {use.kind === "source-order" ? " (source order)" : " (teaching route)"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.crossPaper.map((use) => (
              <section
                key={use.connectionId}
                className="result-dependencies-import"
                data-dependency-cross-paper={use.connectionId}
              >
                <h5>Recorded use across papers: {use.label}</h5>
                <p className="fine">
                  {use.direction === "input" ? "Taken from another paper" : "Used in another paper"}
                </p>
                <p>{use.text}</p>
                <p>
                  <a href={use.href}>{use.title}</a>
                </p>
              </section>
            ))}
            {result.support ? (
              <details className="local-steps result-dependencies-assumptions">
                <summary>Follow the reasoning and its assumptions</summary>
                <p>
                  <a href={result.support.href}>{result.support.title}</a>
                </p>
                <p>{result.support.scope}</p>
                <p className="result-dependencies-label">What the calculation takes as given</p>
                <ul>
                  {result.support.assumptions.map((assumption) => (
                    <li key={assumption.id} data-dependency-assumption={assumption.id}>
                      <strong>{assumption.label}.</strong> {assumption.explanation}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <p className="result-dependencies-destinations">
              <a
                href={result.sourceHref}
                aria-label={`Read the printed source for ${result.title}`}
              >
                Read the printed source
              </a>
              {" · "}
              <a
                href={result.explanationHref}
                aria-label={`Read the explanation of ${result.title}`}
              >
                Read the explanation
              </a>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
