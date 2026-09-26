/**
 * Renders one ResultCard (am-read-results-face-uzh, am-me-results-cards-c6mf). Reads the projected
 * `ResultCard` contract only: it never recomputes physics, never re-derives support, limitation or
 * reception, and never calls a scenario runner itself.
 *
 * The as-printed layer is Einstein's text from the German face, rendered by the face's own markup
 * and KaTeX policy (sourceMarkup.tsx), in German, with a link to where it stands on the face. The
 * modern layer is the compiled equation records, coloured by quantity (ColouredFormula). A record
 * that is not compiled keeps a labelled placeholder rather than a formula typed here.
 *
 * A probe links the laboratory and names the preset a reader chooses there. It does not put the
 * preset in the URL: no laboratory opens a preset from its URL, and a link that says it does would
 * leave the reader in the laboratory's default setting believing otherwise.
 */
import type { CompiledEquation } from "../../../equations/viewTypes.ts";
import { ColouredFormula } from "../../ColouredFormula.tsx";
import { InlineMathText } from "../../InlineMathText.tsx";
import { renderSourceMarkup, sourceDisplayEquation } from "../sourceMarkup.tsx";
import type { Qualification, ResultCard as ResultCardData } from "./types.ts";

const QUALIFICATION_LABEL: Readonly<Record<Qualification["kind"], string>> = {
  premise: "Premise",
  comparison: "A comparison, not a premise",
  approximation: "Approximation",
  inference: "An inference beyond the argument",
  conditional: "Conditional",
};

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

/** "ME-01" for me-01: the name a laboratory page carries. */
const labName = (id: string) => id.toUpperCase();

function ProbeLink({ probe }: { probe: ResultCardData["probes"][number] }) {
  if (probe.kind === "instrument") {
    const preset = probe.presetLabel ?? probe.presetOrModeId;
    return (
      <p className="probe-link" data-probe-kind="instrument" data-preset-id={probe.presetOrModeId}>
        <a href={`/lab/${probe.instrumentId}/`}>
          {labName(probe.instrumentId)}: <InlineMathText text={probe.question} />
        </a>
        {preset ? <span className="fine">{` Choose the preset “${preset}” there.`}</span> : null}
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

export function ResultCard({
  card,
  equations,
}: {
  card: ResultCardData;
  /** The paper's compiled equations by id, for the modern layer. */
  equations?: ReadonlyMap<string, CompiledEquation> | undefined;
}) {
  const modern = card.printedEquationIds.flatMap((id) => {
    const e = equations?.get(id);
    return e ? [e] : [];
  });
  const modernResolved = modern.length > 0 && modern.length === card.printedEquationIds.length;
  // Every page an excerpt stands on, a quotation that runs across a page turn included.
  const pages = [
    ...new Set(
      (card.printed ?? []).flatMap((p) => [
        ...(p.page ? [p.page] : []),
        ...(p.lastPage ? [p.lastPage] : []),
      ]),
    ),
  ].sort((a, b) => a - b);
  return (
    <article
      className="result-card"
      id={`result-${card.resultId}`}
      data-result-id={card.resultId}
      aria-labelledby={`result-${card.resultId}-heading`}
    >
      <header>
        <p className="eyebrow">
          {pages.length > 0
            ? `${pages.length === 1 ? "Page" : "Pages"} ${pages.join(", ")}`
            : `${card.paper} · ${card.sectionAnchors.join(", ")}`}
        </p>
        <h3 id={`result-${card.resultId}-heading`}>
          <InlineMathText text={card.title ?? card.oneSentence} />
        </h3>
        {card.title ? (
          <p data-result-layer="one-sentence">
            <InlineMathText text={card.oneSentence} />
          </p>
        ) : null}
      </header>

      {card.printed && card.printed.length > 0 ? (
        <section className="result-printed" aria-label="As printed" data-result-layer="printed">
          <h4>As printed</h4>
          <blockquote lang="de">
            {card.printed.map((p) =>
              p.kind === "display" ? (
                <div key={p.anchor} data-printed-anchor={p.anchor}>
                  {sourceDisplayEquation(
                    p.text,
                    undefined,
                    undefined,
                    `${card.resultId}-${p.anchor}`,
                  )}
                </div>
              ) : (
                <p key={p.anchor} data-printed-anchor={p.anchor}>
                  {renderSourceMarkup(p.text, `${card.resultId}-${p.anchor}`)}
                </p>
              ),
            )}
          </blockquote>
          <p className="fine">
            {card.printed.map((p, i) => (
              <span key={p.anchor}>
                {i > 0 ? " · " : ""}
                <a href={p.germanHref}>
                  {p.kind === "display" ? "Display" : "Text"}{" "}
                  {p.lastPage ? `on pages ${p.page}–${p.lastPage}` : `on page ${p.page ?? "?"}`} of
                  the German source
                </a>
              </span>
            ))}
          </p>
        </section>
      ) : null}

      {modernResolved ? (
        <section
          className="result-modern"
          aria-label="In modern notation"
          data-result-layer="modern"
        >
          <h4>In modern notation</h4>
          <ColouredFormula equations={modern} />
        </section>
      ) : (
        card.printedEquationIds.map((id, i) => (
          <EquationPlaceholder key={id} equationId={id} primary={i === 0} />
        ))
      )}

      {card.qualifications && card.qualifications.length > 0 ? (
        <section className="result-qualifications" aria-label="What kind of statement">
          <ul>
            {card.qualifications.map((q) => (
              <li key={q.text} data-qualification={q.kind}>
                <strong>{QUALIFICATION_LABEL[q.kind]}: </strong>
                <InlineMathText text={q.text} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="result-decoder" aria-label="Decoder">
        <h4>Decoder</h4>
        <dl>
          {card.decoder.map((entry) => (
            <div key={entry.symbol}>
              <dt>
                <InlineMathText text={entry.symbol} />
              </dt>
              <dd>
                <InlineMathText text={entry.meaning} />
              </dd>
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
                <tr
                  key={`${check.scenarioId}-${check.constantSetId}`}
                  data-scenario-id={check.scenarioId}
                  data-constant-set-id={check.constantSetId}
                >
                  <td data-printed-value="true">{check.printedValue}</td>
                  {/* A pending transcription stays on the cell as data, without "(source
                      transcription pending review)" (D-2026-09-25-no-review-status-banners). */}
                  <td
                    data-reproduced-value="true"
                    data-transcription-pending={check.transcriptionPending ? "true" : undefined}
                  >
                    {check.reproducedText ?? check.reproducedValue}
                  </td>
                  <td data-check-label={check.label}>
                    {check.label} <span className="fine">(constant set {check.constantSetId})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {card.printedCheckComparison ? (
            <p data-printed-check-comparison="true">Compared: {card.printedCheckComparison}.</p>
          ) : null}
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

      {card.support ? (
        <section className="result-support" aria-label="Support">
          <h4>Why should I believe this step?</h4>
          <ul>
            <li>
              Selected route: <strong>{card.support.routeKind}</strong> ({card.support.proofRouteId}
              )
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
                {card.support.alternativeRoutes
                  .map((r) => `${r.title} (${r.routeKind})`)
                  .join(", ")}
              </li>
            )}
          </ul>
        </section>
      ) : null}

      {card.limitations.map((limitation) => (
        <p
          key={limitation.argumentId}
          className="result-limitation"
          data-argument-id={limitation.argumentId}
        >
          <strong>Where this stops: </strong>
          {limitation.text}{" "}
          <a href={`/papers/${card.paper}/#${limitation.argumentId}`}>Read the argument</a>
        </p>
      ))}

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
                {u.href ? (
                  <a href={u.href}>{u.text}</a>
                ) : u.relatedResultId ? (
                  <a href={`#result-${u.relatedResultId}`}>{u.text}</a>
                ) : (
                  u.text
                )}
                {u.date ? ` (${u.date})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {card.misconceptions && card.misconceptions.length > 0 ? (
        <section
          className="result-misconceptions"
          aria-label="Common wrong turns"
          data-result-layer="wrong-turns"
        >
          <h4>Common wrong turns</h4>
          <ul>
            {card.misconceptions.map((m) => (
              <li key={m.id} data-misconception-id={m.id}>
                <a href={m.href}>
                  <InlineMathText text={m.claim} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        card.misconceptionIds.length > 0 && (
          <p className="result-misconceptions">
            Misconceptions: {card.misconceptionIds.join(", ")}
          </p>
        )
      )}

      <dl className="result-meanings" aria-label="Four kinds of meaning">
        <div>
          <dt>Argument</dt>
          <dd>{card.meanings.argumentStatus}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{card.meanings.modelStatus}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{card.meanings.evidentialRole}</dd>
        </div>
        <div>
          <dt>History</dt>
          <dd>{card.meanings.historicalStatus}</dd>
        </div>
      </dl>
    </article>
  );
}
