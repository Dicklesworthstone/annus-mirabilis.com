import type { Metadata } from "next";
import generated from "../../../generated/countermodels.json";
import { parseCountermodelCase } from "../../../reasoning/countermodel/caseSchema.ts";
import type { PreparedCountermodelCase } from "../../../reasoning/countermodel/session.ts";
import { CountermodelWorkbench } from "../../../reasoning/countermodel/Workbench.tsx";
import "../../../components/lab/showTheCode.css";

export const metadata: Metadata = { title: "Compare models: which observations can decide?" };
export default function CountermodelPage() {
  const cases: readonly (Omit<PreparedCountermodelCase, "case"> & { case: unknown })[] =
    generated.cases;
  const examples = cases.map((example) => ({
    ...example,
    case: parseCountermodelCase(example.case),
  }));
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Reasoning laboratory · Special relativity</p>
        <h1>What would actually distinguish these models?</h1>
        <p className="lead">
          A candidate can fail a stated constraint, remain useful in a limited regime, or agree with
          another candidate on every measurement you have chosen.
        </p>
      </header>
      {examples.map((example) => (
        <CountermodelWorkbench key={example.case.id} example={example} />
      ))}
      {generated.cases.length === 0 && (
        <p className="notice">
          The reviewed countermodel cases are in preparation. This publication profile does not
          include the explanatory drafts.
        </p>
      )}
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/lab/sr-04/">Construct the Lorentz map</a>
          </li>
          <li>
            <a href="/lab/sr-03/">Measure rods and simultaneity</a>
          </li>
          <li>
            <a href="/papers/special-relativity/">Return to the paper</a>
          </li>
        </ul>
      </nav>
      {/* After the workbenches: this points to a different laboratory, and above them it put a second
          title between the page's question and its first result. */}
      {generated.profile === "scaffold" && (
        <aside className="reading" aria-label="Statistical countermodel comparison">
          <h2>A different kind of ambiguity: the same average count</h2>
          <p>
            Independent points and one perfectly locked group can share the same average while
            predicting different fluctuations. Choose a useful measurement, then compare a count
            record with both models.
          </p>
          <a className="button" href="/lab/countermodels/independence/">
            Test independence versus locked positions
          </a>
        </aside>
      )}
      <section className="reading">
        <h2>Inspect the calculation, not just its conclusion</h2>
        <p>
          These are bounded, host-calculated comparisons of model consequences. No experiment of
          nature is being performed, and no historical data have been manufactured. The explanations
          remain drafts.
        </p>
        <p>
          The ether route constructs a relative coordinate and local time independently of the
          Lorentz event-transform function. Clock rates, moving-rod lengths and composed speeds are
          then obtained from each candidate’s events. A comparison table never supplies a prewritten
          verdict.
        </p>
        <p>
          Light-speed invariance is a stated constraint in the first case. Agreement under the
          second case’s observations does not prove that an ether exists or that it does not exist.
        </p>
        <details>
          <summary>Show the calculation source used by this build</summary>
          <p className="digest">
            <code>{generated.sourceDigest}</code>
          </p>
          {generated.sourceCode.map((source) => (
            <section key={source.path}>
              <h3>{source.path}</h3>
              <p className="digest">
                <code>{source.hash}</code>
              </p>
              {/* A source line does not wrap, so the listing scrolls inside a named region a
                  keyboard can reach, not a bare scrolling <pre> (CLASS 2). */}
              <section
                className="show-the-code-scroll"
                aria-label={`${source.path} source`}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
                tabIndex={0}
              >
                <pre>
                  <code>{source.text}</code>
                </pre>
              </section>
            </section>
          ))}
          <details>
            <summary>All files included in the evaluator digest</summary>
            <ul>
              {generated.sourceFiles.map((file) => (
                <li key={file.path}>
                  <code>{file.path}</code>
                </li>
              ))}
            </ul>
          </details>
        </details>
      </section>
    </>
  );
}
