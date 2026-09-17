/**
 * Renders one ResultCard (am-read-results-face-uzh). Reads the projected `ResultCard` contract
 * only -- it never recomputes physics, never re-derives support/limitation/reception, and never
 * calls a scenario runner itself.
 *
 * Printed/modern equation rendering and the live probe are placeholders, clearly labeled: the
 * real components they reuse (am-eq-colorized-component-1z8, am-eq-live-bindings-2se) do not
 * exist anywhere in this repository yet. A labeled plain-text stand-in is honest; a component
 * that quietly formats numbers itself would be exactly the "component recomputes physics" bug
 * this whole architecture exists to prevent.
 */
import type { ResultCard as ResultCardData } from "./types.ts";

function EquationPlaceholder({ equationId, primary }: { equationId: string; primary: boolean }) {
  return (
    <p
      className={primary ? "result-equation-headline" : "result-equation"}
      data-equation-id={equationId}
      data-equation-placeholder="true"
    >
      <code>{equationId}</code>
      <span className="fine">
        {" "}
        (printed/modern rendering pending am-eq-colorized-component-1z8)
      </span>
    </p>
  );
}

function ProbeLink({ probe }: { probe: ResultCardData["probes"][number] }) {
  if (probe.kind === "instrument") {
    return (
      <p className="probe-link" data-probe-kind="instrument">
        <a href={`/lab/${probe.instrumentId}?preset=${encodeURIComponent(probe.presetOrModeId)}`}>
          Run the probe: {probe.question}
        </a>
        <span className="fine">
          {" "}
          (live binding pending am-eq-live-bindings-2se; opens the laboratory route)
        </span>
      </p>
    );
  }
  return (
    <p className="probe-link" data-probe-kind="tape">
      <a href={`/lab?tape=${encodeURIComponent(probe.tapeId)}`}>
        Play the teaching tape: {probe.question}
      </a>
    </p>
  );
}

export function ResultCard({ card }: { card: ResultCardData }) {
  return (
    <article
      className="result-card"
      id={`result-${card.resultId}`}
      data-result-id={card.resultId}
      aria-labelledby={`result-${card.resultId}-heading`}
    >
      <header>
        <p className="eyebrow">
          {card.paper} · {card.sectionAnchors.join(", ")}
        </p>
        <h3 id={`result-${card.resultId}-heading`}>{card.oneSentence}</h3>
      </header>

      {card.printedEquationIds.map((id, i) => (
        <EquationPlaceholder key={id} equationId={id} primary={i === 0} />
      ))}

      <section className="result-decoder" aria-label="Decoder">
        <h4>Decoder</h4>
        <dl>
          {card.decoder.map((entry) => (
            <div key={entry.symbol}>
              <dt>{entry.symbol}</dt>
              <dd>{entry.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      {card.printedChecks.length > 0 && (
        <section className="result-printed-checks" aria-label="Printed checks">
          <h4>Printed checks</h4>
          <table>
            <caption className="sr-only">
              Printed value beside the reproduced value, separately labeled
            </caption>
            <thead>
              <tr>
                <th scope="col">As printed</th>
                <th scope="col">Reproduced</th>
                <th scope="col">Label</th>
              </tr>
            </thead>
            <tbody>
              {card.printedChecks.map((check) => (
                <tr key={check.scenarioId} data-scenario-id={check.scenarioId}>
                  <td data-printed-value="true">{check.printedValue}</td>
                  <td data-reproduced-value="true">
                    {check.reproducedValue}
                    {check.transcriptionPending && (
                      <span className="notice"> (source transcription pending review)</span>
                    )}
                  </td>
                  <td data-check-label={check.label}>{check.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {card.probes.length > 0 && (
        <section className="result-probes" aria-label="Probes">
          <h4>Try it</h4>
          {card.probes.map((probe) => (
            <ProbeLink
              key={
                probe.kind === "instrument"
                  ? `${probe.instrumentId}-${probe.presetOrModeId}`
                  : `tape-${probe.tapeId}`
              }
              probe={probe}
            />
          ))}
        </section>
      )}

      <section className="result-support" aria-label="Support">
        <h4>Why should I believe this step?</h4>
        <ul>
          <li>
            Selected route: <strong>{card.support.routeKind}</strong> ({card.support.proofRouteId})
            {card.support.verificationState.status === "authored-unverified" && (
              <span className="notice">: one step is not yet machine-checked.</span>
            )}
          </li>
          {card.support.entryAssumptions.map((a) => (
            <li key={a.premiseId}>
              {a.premiseId}: {a.edgeType}
            </li>
          ))}
          <li>
            {card.support.empiricalInputs.length === 0
              ? "No measurement enters this derivation."
              : card.support.empiricalInputs.map((e) => e.citation).join("; ")}
          </li>
          {card.support.alternativeRoutes.length > 0 && (
            <li>
              Alternative routes:{" "}
              {card.support.alternativeRoutes.map((r) => `${r.title} (${r.routeKind})`).join(", ")}
            </li>
          )}
        </ul>
      </section>

      <p className="result-limitation" data-argument-id={card.limitation.argumentId}>
        <strong>Where this stops: </strong>
        {card.limitation.text}
      </p>

      {card.reception.length > 0 && (
        <section className="result-reception" aria-label="Reception">
          <h4>Later evidence</h4>
          <ul>
            {card.reception.map((entry) => (
              <li key={entry.datasetId}>
                Later evidence ({entry.date}): {entry.statement}
              </li>
            ))}
          </ul>
        </section>
      )}

      {card.usedBy.length > 0 && (
        <section className="result-used-by" aria-label="Used later">
          <h4>Where this is used later</h4>
          <ul>
            {card.usedBy.map((u) => (
              <li key={u.relatedResultId ?? u.text}>
                {u.relatedResultId ? <a href={`#result-${u.relatedResultId}`}>{u.text}</a> : u.text}
                {u.date ? ` (${u.date})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {card.misconceptionIds.length > 0 && (
        <p className="result-misconceptions">Misconceptions: {card.misconceptionIds.join(", ")}</p>
      )}
    </article>
  );
}
