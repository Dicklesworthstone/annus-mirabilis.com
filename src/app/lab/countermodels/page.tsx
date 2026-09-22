import type { Metadata } from "next";
import generated from "../../../generated/countermodels.json";
import { parseCountermodelCase } from "../../../reasoning/countermodel/caseSchema.ts";
import type { PreparedCountermodelCase } from "../../../reasoning/countermodel/session.ts";
import { CountermodelWorkbench } from "../../../reasoning/countermodel/Workbench.tsx";

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
        <p>
          These are bounded, host-calculated comparisons of model consequences. No experiment of
          nature is being performed, and no historical data have been manufactured. The explanations
          remain drafts.
        </p>
        <div className="actions">
          <a href="/lab/sr-04/">Construct the Lorentz map</a>
          <a href="/lab/sr-03/">Measure rods and simultaneity</a>
          <a href="/papers/special-relativity/">Return to the paper</a>
        </div>
      </header>
      {generated.profile === "scaffold" && (
        <aside className="reading" aria-label="Statistical countermodel comparison">
          <h2>A different kind of ambiguity: the same average count</h2>
          <p>Independent points and one perfectly locked group can share the same average while predicting different fluctuations. Choose a useful measurement, then compare a count record with both models.</p>
          <a className="button" href="/lab/countermodels/independence/">Test independence versus locked positions</a>
        </aside>
      )}
      {examples.map((example) => (
        <CountermodelWorkbench key={example.case.id} example={example} />
      ))}
      {generated.cases.length === 0 && (
        <p className="notice">
          The reviewed countermodel cases are in preparation. This publication profile does not
          include the explanatory drafts.
        </p>
      )}
      <section className="reading">
        <h2>Inspect the calculation, not just its conclusion</h2>
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
              <pre style={{ overflowX: "auto", maxWidth: "100%" }}>
                <code>{source.text}</code>
              </pre>
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
