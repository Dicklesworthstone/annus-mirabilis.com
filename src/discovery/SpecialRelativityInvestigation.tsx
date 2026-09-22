"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { RelativityEventTable } from "./RelativityEventTable.tsx";
import { RelativitySessionFileControls } from "./RelativitySessionFileControls.tsx";
import {
  assessRelativity,
  isRelativityMeasurementId,
  LIGHT_ONLY_ORDER,
  LONGITUDINAL_ORDER,
  RELATIVITY_CARDS,
  RELATIVITY_MEASUREMENTS,
  RELATIVITY_OUTCOMES,
  type RelativityCardId,
  relativityCard,
  relativityMeasurement,
  WORKED_RELATIVITY_ORDER,
} from "./specialRelativityInvestigation.ts";
import {
  decodeRelativityLink,
  emptyRelativitySession,
  encodeRelativityLink,
  RELATIVITY_NOTE_LIMIT,
  type RelativitySession,
} from "./specialRelativitySession.ts";

/** The server supplies typeset equations; the browser checks authored dependencies
 * and selects fixed event records. It does not implement a second physics engine.
 */
export function SpecialRelativityInvestigation({
  equations,
}: {
  equations: Readonly<Record<RelativityCardId, ReactNode>>;
}) {
  const instance = useId();
  const [session, setSession] = useState<RelativitySession>(emptyRelativitySession);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [checked, setChecked] = useState(false);
  const focusTarget = useRef<Readonly<{ id: RelativityCardId; palette: boolean }> | null>(null);
  const paletteButtons = useRef(new Map<RelativityCardId, HTMLButtonElement>());
  const stepHeadings = useRef(new Map<RelativityCardId, HTMLHeadingElement>());
  const assessment = assessRelativity(session.order);
  const example = relativityMeasurement(session.measurement);
  const prediction = session.predictions[session.measurement];

  useEffect(() => {
    const restored = decodeRelativityLink(window.location.search);
    if (restored.kind === "session") {
      setSession(restored.session);
      setNotice(
        "Restored the shared card order and example. Dependencies were recalculated; private notes and predictions are not in the link.",
      );
    } else if (restored.kind === "invalid") {
      setNotice(`${restored.message} No shared state was applied.`);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    const isPresent = session.order.includes(target.id);
    if (target.palette && !isPresent) paletteButtons.current.get(target.id)?.focus();
    if (!target.palette && isPresent) stepHeadings.current.get(target.id)?.focus();
    focusTarget.current = null;
  }, [session.order]);

  function edit(update: (current: RelativitySession) => RelativitySession) {
    setSession(update);
    setNotice("");
    setShareLink("");
  }

  function load(order: readonly RelativityCardId[], message: string) {
    edit((current) => ({ ...current, order: [...order] }));
    setNotice(message);
  }

  function move(id: RelativityCardId, direction: -1 | 1) {
    focusTarget.current = { id, palette: false };
    edit((current) => {
      const index = current.order.indexOf(id);
      const other = current.order[index + direction];
      if (index < 0 || other === undefined) return current;
      const order = [...current.order];
      order[index] = other;
      order[index + direction] = id;
      return { ...current, order };
    });
  }

  function share() {
    const url = new URL(window.location.href);
    url.search = encodeRelativityLink(session);
    url.hash = "sr-investigation";
    setShareLink(url.href);
    setNotice(
      "This link contains only the card order and selected example. It omits your note and predictions.",
    );
  }

  return (
    <div className="sr-investigation" data-sr-workbench data-ready={String(ready)}>
      <noscript>
        <p className="notice">
          Card editing and predictions require JavaScript. Every worked step, equation and event
          example remains readable below without it.
        </p>
      </noscript>
      <section id="sr-investigation" aria-labelledby={`${instance}-argument`}>
        <h2 id={`${instance}-argument`}>Construct a map, then remove a premise</h2>
        <p>
          Add cards in the order you would use them. A step needs earlier supported cards, not
          merely their presence somewhere in the list. Several orders work. This checks these
          authored dependencies, not arbitrary mathematics or whether a premise is true.
        </p>
        {/*
          A GROUP OF BUTTONS, NAMED, AND THE NAME NOW REACHES SOMEONE. This was a plain div
          carrying aria-label, which assistive technology ignores on an element with no role, so
          the label was announced by nothing. role="group" fixed that and biome then asked for the
          semantic element instead, correctly: <fieldset> IS the grouping element and it takes an
          accessible name without borrowing a role. .actions carries a border/padding reset so the
          user agent does not draw a box around the three buttons.
        */}
        <fieldset className="actions" aria-label="Worked argument routes">
          <button
            type="button"
            disabled={!ready}
            onClick={() =>
              load(
                LIGHT_ONLY_ORDER,
                "Loaded the two-light-direction route. Its scale is still undetermined.",
              )
            }
          >
            Light constraints only
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() =>
              load(
                LONGITUDINAL_ORDER,
                "Loaded the longitudinal route. The transverse step is still separate.",
              )
            }
          >
            Longitudinal route
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() =>
              load(
                WORKED_RELATIVITY_ORDER,
                "Loaded the full worked reconstruction. Try removing isotropy or moving the inverse condition later.",
              )
            }
          >
            Full worked route
          </button>
          <button
            type="button"
            disabled={!ready || session.order.length === 0}
            onClick={() => load([], "Cleared the cards; your note and predictions are unchanged.")}
          >
            Clear cards
          </button>
        </fieldset>
        <p role="status" aria-atomic="true" data-sr-outcome={assessment.outcome}>
          {RELATIVITY_OUTCOMES[assessment.outcome]}
          {assessment.hasBlockedSteps &&
            " Some cards are blocked; their missing support is named below."}
        </p>
        <div className="sr-argument-columns">
          <section aria-labelledby={`${instance}-palette`}>
            <h3 id={`${instance}-palette`}>Available cards and worked explanations</h3>
            <p>
              Open any explanation without adding its card. The worked route has no answer gate.
            </p>
            {RELATIVITY_CARDS.map((card) => (
              <div className="sr-card" key={card.id} data-sr-palette-card={card.id}>
                <details>
                  <summary>{card.title}</summary>
                  {equations[card.id]}
                  <p>{card.explanation}</p>
                  <p>
                    Earlier support:{" "}
                    {card.needs.length === 0
                      ? "an explicitly chosen starting procedure"
                      : card.needs.map((id) => relativityCard(id).title).join("; ")}
                    .
                  </p>
                </details>
                <button
                  type="button"
                  ref={(node) => {
                    if (node) paletteButtons.current.set(card.id, node);
                    else paletteButtons.current.delete(card.id);
                  }}
                  disabled={!ready || session.order.includes(card.id)}
                  aria-label={`Add: ${card.title}`}
                  onClick={() =>
                    edit((current) =>
                      current.order.includes(card.id)
                        ? current
                        : { ...current, order: [...current.order, card.id] },
                    )
                  }
                >
                  {session.order.includes(card.id) ? "In your argument" : "Add to argument"}
                </button>
              </div>
            ))}
          </section>
          <section aria-labelledby={`${instance}-chain`}>
            <h3 id={`${instance}-chain`}>Your argument</h3>
            {session.order.length === 0 && (
              <p>No cards selected. Begin with a premise or open a worked route.</p>
            )}
            <ol className="sr-chain">
              {assessment.trace.map((step, index) => {
                const card = relativityCard(step.id);
                return (
                  <li key={step.id} data-sr-step={step.id} data-support={step.status}>
                    <h4
                      tabIndex={-1}
                      ref={(node) => {
                        if (node) stepHeadings.current.set(step.id, node);
                        else stepHeadings.current.delete(step.id);
                      }}
                    >
                      {card.title}
                    </h4>
                    <p>
                      {step.status === "supported"
                        ? "Supported by the earlier cards or an explicitly admitted premise."
                        : `Needs earlier supported cards: ${step.missing.map((id) => relativityCard(id).title).join("; ")}.`}
                    </p>
                    <div className="actions">
                      <button
                        type="button"
                        disabled={!ready || index === 0}
                        aria-label={`Move earlier: ${card.title}`}
                        onClick={() => move(step.id, -1)}
                      >
                        Earlier
                      </button>
                      <button
                        type="button"
                        disabled={!ready || index === session.order.length - 1}
                        aria-label={`Move later: ${card.title}`}
                        onClick={() => move(step.id, 1)}
                      >
                        Later
                      </button>
                      <button
                        type="button"
                        disabled={!ready}
                        aria-label={`Remove: ${card.title}`}
                        onClick={() => {
                          focusTarget.current = { id: step.id, palette: true };
                          edit((current) => ({
                            ...current,
                            order: current.order.filter((id) => id !== step.id),
                          }));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </section>
      <section id="sr-measurement" aria-labelledby={`${instance}-measurement`}>
        <h2 id={`${instance}-measurement`}>Does this pair of events measure a length?</h2>
        <p>
          The moving frame travels at +0.6c relative to the platform; γ = 1.25. These are fixed
          authored arithmetic examples in modern notation, not live kernel results or observations.
          Distances are in light-seconds, times in seconds. The same platform rod has endpoints x =
          0 and x = 10 in both rod examples.
        </p>
        <label htmlFor={`${instance}-example`}>Choose the event pair</label>
        <select
          id={`${instance}-example`}
          disabled={!ready}
          value={session.measurement}
          onChange={(event) => {
            const measurement = event.currentTarget.value;
            if (!isRelativityMeasurementId(measurement)) return;
            edit((current) => ({ ...current, measurement }));
            setChecked(false);
          }}
        >
          {RELATIVITY_MEASUREMENTS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <RelativityEventTable example={example} />
        <fieldset disabled={!ready}>
          <legend>Does the moving-frame spatial separation measure this rod’s length?</legend>
          {(["yes", "no"] as const).map((answer) => (
            <label className="sr-choice" key={answer}>
              <input
                type="radio"
                name={`${instance}-prediction`}
                value={answer}
                checked={prediction === answer}
                onChange={() => {
                  edit((current) => ({
                    ...current,
                    predictions: { ...current.predictions, [current.measurement]: answer },
                  }));
                  setChecked(false);
                }}
              />
              {answer === "yes"
                ? "Yes: it is a length measurement"
                : "No: these events do not measure the rod’s length"}
            </label>
          ))}
          <button type="button" onClick={() => setChecked(true)}>
            Compare my interpretation
          </button>
        </fieldset>
        <p role="status" aria-atomic="true" data-sr-prediction-feedback>
          {checked &&
            (prediction === undefined
              ? "A prediction is optional. Open the explanation to inspect the measurement procedure."
              : `${(prediction === "yes") === example.movingLength ? "Your interpretation agrees with this event selection." : "Reconsider which events must be simultaneous and whether they are rod endpoints."} ${example.reason}`)}
        </p>
        <details key={example.id}>
          <summary>Inspect the explanation without making a prediction</summary>
          <p>{example.reason}</p>
          <p>{example.unchanged}</p>
        </details>
        <p>
          Change the selected events, then explain what changed and what stayed fixed. A passive
          frame change is not a new physical experiment.
        </p>
      </section>
      <section aria-labelledby={`${instance}-record`}>
        <h2 id={`${instance}-record`}>Keep your reasoning separate from the public link</h2>
        <label htmlFor={`${instance}-note`}>
          Private note: which premise or measurement choice mattered?
        </label>
        <textarea
          id={`${instance}-note`}
          rows={5}
          maxLength={RELATIVITY_NOTE_LIMIT}
          disabled={!ready}
          value={session.note}
          onChange={(event) => {
            const note = event.currentTarget.value;
            edit((current) => ({ ...current, note }));
          }}
        />
        <p>
          Notes and predictions stay in this tab; they are not sent to a server or put in a share
          link. Save a private session below to keep your work before leaving.
        </p>
        <RelativitySessionFileControls
          session={session}
          disabled={!ready}
          onRestore={(restored) => {
            focusTarget.current = null;
            edit(() => restored);
            setChecked(false);
            setNotice("Restored the private session and recalculated its argument dependencies.");
          }}
        />
        <button type="button" disabled={!ready} onClick={share}>
          Create public investigation link
        </button>
        {shareLink && (
          <p className="sr-share">
            <a href={shareLink}>{shareLink}</a>
          </p>
        )}
        <p role="status" aria-atomic="true" data-sr-notice>
          {notice}
        </p>
      </section>
    </div>
  );
}
