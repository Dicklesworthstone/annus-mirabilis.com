import type { CompiledMissingStep, CompiledMissingStepLesson } from "./compiled.ts";
import "./missingStep.css";

/** Precompiled mathematics and enumerated arithmetic only. No calculation runs in this view. */
export function MissingStepPanel({
  lesson,
  step,
}: {
  lesson: CompiledMissingStepLesson;
  step: CompiledMissingStep;
}) {
  return (
    <section className="missing-step-panel" data-missing-step={step.id}>
      <p className="eyebrow">{lesson.routeLabel}</p>
      <h2 tabIndex={-1} data-clarification-heading>
        {step.title}
      </h2>
      <p className="fine">{lesson.sourceNotice}</p>
      {step.isMove && (
        <p className="notice">
          <strong>The move:</strong> cross terms average away, not individual displacements.
        </p>
      )}
      <p>
        <strong>Changed subexpression:</strong>{" "}
        {step.changed
          .map((id) =>
            id === "crossTerm" ? "the cross-term average" : "the total mean-square expression",
          )
          .join(", ")}
        . The outline marks it on both sides.
      </p>
      <div className="missing-step-equations">
        {[
          ["Before", step.fromHtml],
          ["After", step.toHtml],
        ].map(([label, html]) => (
          <section key={label}>
            <h3>{label}</h3>
            <section
              aria-label={`${label} mathematical expression`}
              tabIndex={0}
              className="missing-step-math"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: only strict build-time KaTeX output from validated expression trees, never reader input
              dangerouslySetInnerHTML={{ __html: html ?? "" }}
            />
          </section>
        ))}
      </div>
      <p>
        <strong>Rule:</strong> {step.rule}
      </p>
      <p>{step.readings.r1}</p>
      <details>
        <summary>In fewer words</summary>
        <p>{step.readings.r0}</p>
      </details>
      <details>
        <summary>Show every step in this transition</summary>
        <p>{step.readings.r2}</p>
      </details>
      <h3>What this step assumes</h3>
      {step.premiseTexts.length ? (
        <ul>
          {step.premiseTexts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        <p>
          No new independence or centring premise is used at this step. The averages are assumed to
          exist.
        </p>
      )}
      <p>{lesson.premiseNotice}</p>
      <h3>Two signed steps: see every possible outcome</h3>
      <p>
        Each step is +1 or −1 in arbitrary step units. Rows have equal probability within each
        selected model. These are exact finite teaching distributions, not observations or simulated
        Brownian paths.
      </p>
      {lesson.cases.map((item, index) => (
        <details key={item.result.dependence} open={index === 0} className="missing-step-case">
          <summary>{item.label}</summary>
          <p>{item.explanation}</p>
          <section
            aria-label={`${item.label}: outcome table`}
            tabIndex={0}
            className="missing-step-table"
          >
            <table>
              <caption>
                {item.result.denominator} equally likely outcomes. Squared columns use squared step
                units.
              </caption>
              <thead>
                <tr>
                  <th scope="col">A</th>
                  <th scope="col">B</th>
                  <th scope="col">A + B</th>
                  <th scope="col">(A + B)²</th>
                  <th scope="col">A² + B²</th>
                  <th scope="col">2AB</th>
                </tr>
              </thead>
              <tbody>
                {item.result.rows.map((row) => (
                  <tr key={row.steps.join(",")}>
                    <td>{row.steps[0]}</td>
                    <td>{row.steps[1]}</td>
                    <td>{row.displacement}</td>
                    <td>{row.square}</td>
                    <td>{row.sumSquares}</td>
                    <td>{row.crossTerm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p>
            <strong>Mean square:</strong> {item.result.meanSquare}.{" "}
            <strong>Mean cross contribution:</strong> {item.result.meanCrossTerm}.{" "}
            <strong>Signed mean:</strong> {item.result.mean}.{" "}
            <strong>Mean absolute displacement:</strong> {item.result.meanAbsolute}.
          </p>
        </details>
      ))}
      <h3>From two steps to many</h3>
      <p>{lesson.generalization}</p>
      <p>{lesson.absoluteNote}</p>
      <details className="missing-step-modern">
        <summary>Modern lens: where the independence model stops</summary>
        <p>{lesson.modernNote}</p>
      </details>
      <p>
        <a href={lesson.sourceLink}>{lesson.sourceLabel} →</a>
      </p>
    </section>
  );
}

export function MissingStepDisclosure({ lesson }: { lesson: CompiledMissingStepLesson }) {
  return (
    <section className="missing-step-lesson" aria-label={lesson.title}>
      <h4>{lesson.title}</h4>
      <p>
        Choose a transition to open its explanation. Without JavaScript, open the worked bridge
        below; it contains the same four explanations.
      </p>
      <ol>
        {lesson.steps.map((step) => (
          <li key={step.id}>
            <a
              id={`open-${step.id}`}
              href={`#static-${step.id}`}
              data-clarification-open={`derivation-step:${step.id}`}
              data-selection-id={step.changed[0]}
            >
              {step.title}
            </a>
          </li>
        ))}
      </ol>
      <details id="bm-variance-worked-bridge">
        <summary>Read all four transitions here (also works without JavaScript)</summary>
        {lesson.steps.map((step) => (
          <details key={step.id} id={`static-${step.id}`}>
            <summary>{step.title}</summary>
            <MissingStepPanel lesson={lesson} step={step} />
          </details>
        ))}
      </details>
    </section>
  );
}
