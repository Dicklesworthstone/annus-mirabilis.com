"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  ARGUMENT_STEPS,
  type ArgumentStepId,
  argumentExport,
  argumentStep,
  assessArgument,
  CONSISTENCY_ARGUMENT,
  decodeArgument,
  encodeArgument,
  WORKED_ARGUMENT,
} from "./massEnergyArgument.ts";

const statusLabels = {
  supported: "Supported by the earlier cards or an explicitly admitted premise",
  blocked: "Needs an earlier premise or step",
  "assumes-target": "Assumes the relation being investigated",
  "consistency-only": "Consistency check, not an independent derivation",
};

/** The server supplies rendered equations; the browser checks dependencies only.
 * There is no numerical physics, algebra evaluator, storage or network request here.
 */
export function MassEnergyArgumentWorkbench({
  equations,
}: {
  equations: Readonly<Record<string, ReactNode>>;
}) {
  const instance = useId();
  const [order, setOrder] = useState<readonly ArgumentStepId[]>([]);
  const [note, setNote] = useState("");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareLink, setShareLink] = useState("");
  const focusAfterRemoval = useRef<string | null>(null);
  const addButtons = useRef(new Map<string, HTMLButtonElement>());
  const assessment = assessArgument(order);

  useEffect(() => {
    const shared = decodeArgument(window.location.search);
    if (shared.kind === "argument") {
      setOrder(shared.order);
      setNotice(
        "Restored the shared card order and recalculated its dependencies. Private notes are not part of this link.",
      );
    } else if (shared.kind === "invalid") {
      setNotice(
        `${shared.message} No shared cards were applied; the workbench is available below.`,
      );
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const id = focusAfterRemoval.current;
    if (id) {
      addButtons.current.get(id)?.focus();
      focusAfterRemoval.current = null;
    }
  }, [order]);

  function edited() {
    setShareLink("");
    setNotice("");
  }
  function load(next: readonly ArgumentStepId[], message: string) {
    edited();
    setOrder(next);
    setNotice(message);
  }
  function add(id: ArgumentStepId) {
    edited();
    setOrder((current) => (current.includes(id) ? current : [...current, id]));
  }
  function move(id: ArgumentStepId, direction: -1 | 1) {
    edited();
    setOrder((current) => {
      const index = current.indexOf(id);
      const destination = index + direction;
      const other = current[destination];
      if (index < 0 || !other) return current;
      const next = [...current];
      next[index] = other;
      next[destination] = id;
      return next;
    });
  }
  function remove(id: ArgumentStepId) {
    edited();
    focusAfterRemoval.current = id;
    setOrder((current) => current.filter((item) => item !== id));
  }
  function share() {
    const url = new URL(window.location.href);
    url.search = encodeArgument(order);
    url.hash = "argument-workbench";
    setShareLink(url.href);
    setNotice(
      "Created a link containing only the chosen card IDs and their order, not your note. Copy or open the link below.",
    );
  }
  function download() {
    let url: string | null = null;
    try {
      url = URL.createObjectURL(
        new Blob([argumentExport(order, note)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "mass-energy-argument.json";
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      setNotice(
        "Downloaded the current card order, dependency explanations and your note. This is an argument record, not a numerical experiment or evidence about nature.",
      );
    } catch {
      setNotice(
        "The download could not be created. Your cards and note are unchanged; you can still read or copy them here.",
      );
    } finally {
      if (url) {
        const issued = url;
        setTimeout(() => URL.revokeObjectURL(issued), 1000);
      }
    }
  }

  return (
    <section
      id="argument-workbench"
      className="argument-workbench"
      aria-labelledby={`${instance}-title`}
      data-argument-outcome={assessment.outcome}
      data-ready={String(ready)}
    >
      <h2 id={`${instance}-title`}>Build an argument, then change a premise</h2>
      <p>
        Add cards in the order you would use them. Each step names what it needs; move an earlier
        premise into place or keep a weaker conclusion. Several orders are valid. This checks the
        dependencies of these authored steps, not arbitrary mathematics or the truth of a premise.
      </p>
      <p>
        No score, timer or answer gate is used. The worked derivation and every explanation remain
        available whether or not you assemble a chain.
      </p>
      <noscript>
        <p className="notice">
          Card assembly requires JavaScript. The card explanations and the worked route below are
          readable without it; no progress or private note has been stored.
        </p>
      </noscript>
      <div className="actions">
        <button
          type="button"
          disabled={!ready}
          onClick={() =>
            load(
              WORKED_ARGUMENT,
              "Loaded one sufficient two-ledger order. Try removing the unchanged-offset card.",
            )
          }
        >
          Load the two-ledger route
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!ready}
          onClick={() =>
            load(
              CONSISTENCY_ARGUMENT,
              "Loaded a modern consistency check. Inspect which conclusion it assumes.",
            )
          }
        >
          Explore the assumed-rest-energy route
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!ready || order.length === 0}
          onClick={() => load([], "Cleared the selected cards. Your private note has not changed.")}
        >
          Clear selected cards
        </button>
      </div>
      <p role="status" aria-live="polite">
        {notice}
      </p>
      <section aria-labelledby={`${instance}-conclusion`}>
        <h3 id={`${instance}-conclusion`}>What follows from the current order?</h3>
        <p className="notice" aria-live="polite" aria-atomic="true">
          {assessment.summary}
        </p>
      </section>
      <div className="argument-columns">
        <section aria-labelledby={`${instance}-selection`}>
          <h3 id={`${instance}-selection`}>Your selected chain</h3>
          {order.length === 0 && (
            <p>No cards selected. Start with a setup or a premise, or load either route above.</p>
          )}
          <ol className="argument-selection">
            {assessment.steps.map((result, index) => {
              const card = argumentStep(result.id);
              return (
                <li
                  key={result.id}
                  id={`${instance}-selected-${result.id}`}
                  data-card-id={result.id}
                  data-step-status={result.status}
                >
                  <h4>
                    {index + 1}. {card.title}
                  </h4>
                  <p className="fine">
                    <strong>{statusLabels[result.status]}</strong>
                  </p>
                  {equations[card.id]}
                  {result.missing.length > 0 && (
                    <p>
                      Needed earlier:{" "}
                      {result.missing.map((dependency, i) => (
                        <span key={dependency}>
                          {i > 0 ? "; " : ""}
                          <a href={`#${instance}-card-${dependency}`}>
                            {argumentStep(dependency).title}
                          </a>
                        </span>
                      ))}
                      . A selected but blocked card does not supply a premise.
                    </p>
                  )}
                  {result.assumedTarget.length > 0 && (
                    <p>
                      This branch uses an assumed rest-energy relation. Its algebra may be valid
                      without independently establishing that relation.
                    </p>
                  )}
                  <details>
                    <summary>Why this step is allowed, and where it stops</summary>
                    <p>{card.explanation}</p>
                  </details>
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={!ready || index === 0}
                      aria-label={`Move earlier: ${card.title}`}
                      onClick={() => move(result.id, -1)}
                    >
                      Move earlier
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={!ready || index === order.length - 1}
                      aria-label={`Move later: ${card.title}`}
                      onClick={() => move(result.id, 1)}
                    >
                      Move later
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={!ready}
                      aria-label={`Remove: ${card.title}`}
                      onClick={() => remove(result.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
        <section aria-labelledby={`${instance}-cards`}>
          <h3 id={`${instance}-cards`}>Available argument cards</h3>
          <p className="fine">
            You can add a card before its prerequisites to see precisely what is missing. Selecting
            a premise admits it; it does not prove it.
          </p>
          <ul className="argument-deck">
            {ARGUMENT_STEPS.map((card) => {
              const id = card.id as ArgumentStepId;
              const selected = order.includes(id);
              return (
                <li key={id} id={`${instance}-card-${id}`}>
                  <details>
                    <summary>{card.title}</summary>
                    <p className="fine">
                      Role:{" "}
                      {card.kind === "assumes-target"
                        ? "Assumption of the target relation"
                        : card.kind}
                      .
                    </p>
                    {equations[id]}
                    <p>{card.explanation}</p>
                    <p className="fine">
                      Requires:{" "}
                      {card.requires.length
                        ? card.requires
                            .map((dependency) => argumentStep(dependency).title)
                            .join("; ")
                        : "No earlier card; this is an explicitly admitted starting point."}
                    </p>
                  </details>
                  <button
                    ref={(element) => {
                      if (element) addButtons.current.set(id, element);
                      else addButtons.current.delete(id);
                    }}
                    type="button"
                    className="secondary"
                    disabled={!ready || selected}
                    aria-label={`Add: ${card.title}`}
                    onClick={() => add(id)}
                  >
                    {selected ? "In your chain" : "Add to chain"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <section aria-labelledby={`${instance}-reflection`}>
        <h3 id={`${instance}-reflection`}>Predict, change something, explain</h3>
        <label htmlFor={`${instance}-note`}>
          What survives when the offset premise is removed? Why is assuming E = M c² a different
          kind of argument?
        </label>
        <textarea
          id={`${instance}-note`}
          rows={5}
          maxLength={20_000}
          value={note}
          disabled={!ready}
          onChange={(event) => setNote(event.target.value)}
        />
        <p className="fine">
          Your note stays in this tab and disappears on reload unless you download it. It is not
          automatically graded, uploaded, stored locally or included in a share link.
        </p>
        <div className="actions">
          <button type="button" disabled={!ready} onClick={share}>
            Create a share link without the note
          </button>
          <button type="button" className="secondary" disabled={!ready} onClick={download}>
            Download argument and note (JSON)
          </button>
        </div>
        {shareLink && (
          <p className="argument-share">
            <a href={shareLink}>Open this exact card order</a>
            <br />
            <code>{shareLink}</code>
          </p>
        )}
      </section>
    </section>
  );
}
