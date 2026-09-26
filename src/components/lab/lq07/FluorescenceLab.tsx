"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { fromLq07Draft, toLq07Draft } from "../../../experiments/lq07/controls.ts";
import {
  LQ07_CAPTION,
  LQ07_DEFAULTS,
  LQ07_MODEL,
  LQ07_OUTPUTS,
  LQ07_PRESETS,
  type Lq07Channels,
  type Lq07Parameters,
  type Lq07Regime,
} from "../../../experiments/lq07/definition.ts";
import { decodeLq07Settings } from "../../../experiments/lq07/permalink.ts";
import {
  buildLq07Snapshot,
  createLq07Session,
  evaluateLq07,
  type PreparedLq07Example,
} from "../../../experiments/lq07/session.ts";
import { LQ07_TAPE } from "../../../experiments/lq07/tape.ts";
import { LabTapeLink, useLabTapeLink } from "../../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { refusalSentence } from "../../../experiments/results/refusalSentence.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import { PREDICT_PROMPTS } from "../../../generated/predict-prompts.ts";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { KEPT_RESULT } from "../keptResult.ts";
import { PredictGatePanels, usePredictGate, withPredictions } from "../PredictGate.tsx";
import { fixed, identity, sentenceNumber } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";
import { FluorescencePlot } from "./FluorescencePlot.tsx";
import "./fluorescenceLab.css";

const LQ07_PROMPTS = PREDICT_PROMPTS["lq-07"] ?? [];

export function FluorescenceLab({
  example,
  title = "Fluorescence energy budget and Stokes's rule",
}: {
  example?: PreparedLq07Example | undefined;
  title?: string | undefined;
}) {
  const id = useId();
  const [session] = useState(() =>
    createLq07Session(`lq07-${id}`, example?.parameters ?? LQ07_DEFAULTS),
  );

  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(
    LQ07_TAPE,
    session,
    session.acceptedParameters(),
    true,
    (restored) => setDraft(toLq07Draft(restored)),
  );

  const fallback =
    session.getServerSnapshot().accepted ??
    buildLq07Snapshot(`lq07-${id}`, "lq07-init", null, LQ07_DEFAULTS, 0, 0);
  const snapshot = view.accepted ?? fallback;
  const p = snapshot.parameters as Lq07Parameters;
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation; no example, no earned label.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      LQ07_OUTPUTS,
      example?.sourceDigest ?? "",
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  const [draft, setDraft] = useState(() => toLq07Draft(p));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [linkNote, setLinkNote] = useState("");
  // The drawing and the controls come first; the verdict, the rates and the ledger wait.
  const gate = usePredictGate("lq-07", LQ07_PROMPTS);

  const evaluation = evaluateLq07(p);
  // One sentence for the status line: the frequencies, the budget's own verdict, and the emission
  // rate when light of the second frequency is emitted.
  const emitted = evaluation.rates.status === "value" ? evaluation.rates.emittedRatePerSecond : 0;
  const statusSummary = `${fixed(p.nu1, 1)} THz in, ${fixed(p.nu2, 1)} THz out. ${evaluation.budget.verdictReason}${emitted > 0 ? ` ${sentenceNumber(emitted)} quanta leave each second.` : ""}`;

  useEffect(() => {
    const shared = decodeLq07Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toLq07Draft(shared.parameters));
      setDirty(true);
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
  }, []);

  function apply(next: Lq07Parameters) {
    const outcome = session.apply(next);
    if (outcome.kind === "refused") {
      setError(refusalSentence(outcome.refusal));
      return;
    }
    setError("");
    setDirty(false);
    setLinkNote("");
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // The validator names each field and its declared range; the form no longer has its own.
    apply(fromLq07Draft(draft));
  }

  function setPreset(presetKey: keyof typeof LQ07_PRESETS) {
    const preset = LQ07_PRESETS[presetKey];
    if (!preset) return;
    const target = preset.parameters;
    setDraft(toLq07Draft(target));
    apply(target);
  }

  function setRegime(reg: Lq07Regime) {
    const next = { ...p, regime: reg };
    setDraft(toLq07Draft(next));
    apply(next);
  }

  function setChannels(ch: Lq07Channels) {
    const next = { ...p, channels: ch };
    setDraft(toLq07Draft(next));
    apply(next);
  }

  return (
    <article
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-07"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "emittedRate")}
    >
      <header
        className="lab-heading"
        style={{
          borderBottom: "1px solid var(--line)",
          paddingBottom: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <p className="eyebrow">Light quanta · §7 fluorescence &amp; Stokes's rule</p>
          <h2 id={`${id}-title`}>{title}</h2>
          <p className="fine" style={{ marginTop: "0.5rem", fontSize: "0.95rem" }}>
            What single-quantum energy conservation, hν₁ = hν₂ + E<sub>other</sub>, allows a
            fluorescent body to emit, and where multi-quantum and thermal cases depart from it.
          </p>
        </div>
        {/* The execution line sits in the heading's right column, as labShell.css places it
            (dispatch 268). As a row of its own under the heading it put the plot at 625-629px at
            1440. */}
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, {
            notModeled: `${LQ07_MODEL.notModeled.join("; ")}.`,
          })}
        />
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built,
          and its values and explanations remain available. The controls need JavaScript to respond.
        </p>
      </noscript>

      {/* Main Plot & Visual Ledger */}
      <FluorescencePlot parameters={p} evaluation={evaluation} response={gate.response} />

      <PredictGatePanels gate={gate} />

      <fieldset className="lab-choice lq07-try">
        <legend>Try</legend>
        <div className="actions">
          {(Object.keys(LQ07_PRESETS) as (keyof typeof LQ07_PRESETS)[]).map((key) => (
            <button key={key} type="button" className="secondary" onClick={() => setPreset(key)}>
              {LQ07_PRESETS[key]?.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Interactive Controls Section */}
      <section
        style={{
          marginTop: "2rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.5rem",
        }}
      >
        <form noValidate onSubmit={submit} className="input-grid">
          {/* 1. Incident Frequency nu1 */}
          <div className="input-field">
            <label htmlFor={`${id}-nu1`}>Exciting frequency ν₁ (100 – 3000 THz):</label>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.3rem" }}
            >
              <input
                id={`${id}-nu1`}
                type="number"
                min="100"
                max="3000"
                step="10"
                value={draft.nu1}
                onChange={(e) => {
                  setDraft({ ...draft, nu1: e.target.value });
                  setDirty(true);
                }}
                style={{ width: "7rem", fontFamily: "var(--font-mono)" }}
              />
              <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                THz
              </span>
              <span className="fine">({fixed(evaluation.budget.e1Ev, 3)} eV)</span>
            </div>
          </div>

          {/* 2. Emitted Frequency nu2 */}
          <div className="input-field">
            <label htmlFor={`${id}-nu2`}>Emitted frequency ν₂ (100 – 3000 THz):</label>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.3rem" }}
            >
              <input
                id={`${id}-nu2`}
                type="number"
                min="100"
                max="3000"
                step="10"
                value={draft.nu2}
                onChange={(e) => {
                  setDraft({ ...draft, nu2: e.target.value });
                  setDirty(true);
                }}
                style={{ width: "7rem", fontFamily: "var(--font-mono)" }}
              />
              <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                THz
              </span>
              <span className="fine">({fixed(evaluation.budget.e2Ev, 3)} eV)</span>
            </div>
          </div>

          {/* 3. Accounting Regime Selector */}
          <div className="input-field" style={{ gridColumn: "1 / -1" }}>
            <span
              id={`${id}-regime-label`}
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.4rem",
              }}
            >
              Accounting regime:
            </span>
            <fieldset
              aria-labelledby={`${id}-regime-label`}
              style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
            >
              <button
                type="button"
                className={`button ${p.regime === "standard-stokes" ? "" : "secondary"}`}
                aria-pressed={p.regime === "standard-stokes"}
                onClick={() => setRegime("standard-stokes")}
              >
                Stokes's rule (§7)
              </button>
              <button
                type="button"
                className={`button ${p.regime === "deviation-multi-quantum" ? "" : "secondary"}`}
                aria-pressed={p.regime === "deviation-multi-quantum"}
                onClick={() => setRegime("deviation-multi-quantum")}
              >
                Deviation case 1 (k quanta)
              </button>
              <button
                type="button"
                className={`button ${p.regime === "deviation-non-wien" ? "" : "secondary"}`}
                aria-pressed={p.regime === "deviation-non-wien"}
                onClick={() => setRegime("deviation-non-wien")}
              >
                Deviation case 2 (Wien check)
              </button>
              <button
                type="button"
                className={`button ${p.regime === "modern-thermal" ? "" : "secondary"}`}
                aria-pressed={p.regime === "modern-thermal"}
                onClick={() => setRegime("modern-thermal")}
              >
                Modern thermal (anti-Stokes)
              </button>
            </fieldset>
          </div>

          {/* 4. Regime Specific Parameter */}
          <div className="input-field" style={{ gridColumn: "1 / -1" }}>
            {p.regime === "deviation-multi-quantum" && (
              <>
                <label htmlFor={`${id}-k`}>Number of absorbed quanta k (1 – 5):</label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginTop: "0.3rem",
                  }}
                >
                  <input
                    id={`${id}-k`}
                    type="number"
                    min="1"
                    max="5"
                    value={draft.multiQuantumK}
                    onChange={(e) => {
                      setDraft({ ...draft, multiQuantumK: e.target.value });
                      setDirty(true);
                    }}
                    style={{ width: "6rem", fontFamily: "var(--font-mono)" }}
                  />
                  <span className="fine">k = {p.multiQuantumK} absorbed quanta</span>
                </div>
              </>
            )}

            {p.regime === "deviation-non-wien" && (
              <>
                <label htmlFor={`${id}-tsrc`}>
                  Exciting-source temperature T<sub>src</sub> (K):
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginTop: "0.3rem",
                  }}
                >
                  <input
                    id={`${id}-tsrc`}
                    type="number"
                    min="1000"
                    max="50000"
                    step="500"
                    value={draft.sourceTemperatureK}
                    onChange={(e) => {
                      setDraft({ ...draft, sourceTemperatureK: e.target.value });
                      setDirty(true);
                    }}
                    style={{ width: "7rem", fontFamily: "var(--font-mono)" }}
                  />
                  <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                    K
                  </span>
                  {evaluation.budget.wienDeviationExpMinusX !== undefined && (
                    <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                      (e<sup>−x</sup> = {fixed(evaluation.budget.wienDeviationExpMinusX, 4)})
                    </span>
                  )}
                </div>
              </>
            )}

            {p.regime === "modern-thermal" && (
              <>
                <label htmlFor={`${id}-tbody`}>
                  Body temperature T<sub>body</sub> (K):
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginTop: "0.3rem",
                  }}
                >
                  <input
                    id={`${id}-tbody`}
                    type="number"
                    min="0"
                    max="1000"
                    step="10"
                    value={draft.bodyTemperatureK}
                    onChange={(e) => {
                      setDraft({ ...draft, bodyTemperatureK: e.target.value });
                      setDirty(true);
                    }}
                    style={{ width: "7rem", fontFamily: "var(--font-mono)" }}
                  />
                  <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                    K
                  </span>
                  {evaluation.budget.thermalExtraEv !== undefined && (
                    <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                      (+{fixed(evaluation.budget.thermalExtraEv, 3)} eV)
                    </span>
                  )}
                </div>
              </>
            )}

            {p.regime === "standard-stokes" && (
              <ExperimentSettings contents="which channels the absorbed energy may leave by">
                <div>
                  <span
                    id={`${id}-channels-label`}
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "0.4rem",
                    }}
                  >
                    Available channels:
                  </span>
                  <fieldset
                    aria-labelledby={`${id}-channels-label`}
                    style={{ display: "flex", gap: "0.5rem" }}
                  >
                    <button
                      type="button"
                      className={`button ${p.channels === "light-plus-heat" ? "" : "secondary"}`}
                      aria-pressed={p.channels === "light-plus-heat"}
                      onClick={() => setChannels("light-plus-heat")}
                    >
                      Light and heat (E<sub>other</sub> ≥ 0)
                    </button>
                    <button
                      type="button"
                      className={`button ${p.channels === "light-only" ? "" : "secondary"}`}
                      aria-pressed={p.channels === "light-only"}
                      onClick={() => setChannels("light-only")}
                    >
                      Light only (E<sub>other</sub> = 0)
                    </button>
                  </fieldset>
                </div>
                <p className="fine">These apply at once.</p>
              </ExperimentSettings>
            )}
          </div>

          {/* Form Actions */}
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              paddingTop: "0.5rem",
            }}
          >
            <button type="submit" className="button">
              Apply parameters
            </button>
            {dirty && (
              <span className="fine" style={{ color: "var(--accent)" }}>
                Unapplied parameter edits.
              </span>
            )}
          </div>
        </form>

        {error && (
          <div className="notice error" role="alert" style={{ marginTop: "1rem" }}>
            {error} {KEPT_RESULT}
          </div>
        )}
        <AcceptedStatus
          worked={snapshot === session.getServerSnapshot().accepted}
          summary={statusSummary}
          response={gate.response}
        />
        <LabTapeLink link={withPredictions(tapeLink, gate)} />
        {linkNote && (
          <div className="notice" style={{ marginTop: "0.75rem" }}>
            {linkNote}
          </div>
        )}
      </section>

      {/* Outputs Table */}
      <section
        {...gate.response}
        style={{
          marginTop: "2rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.5rem",
        }}
      >
        <h3 style={{ marginBottom: "1rem" }}>Calculated energy ledger and transition quantities</h3>

        <section
          className="table-scroll lq07-ledger"
          aria-label="Calculated energy ledger and transition quantities table"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Symbol</th>
                <th scope="col">Value</th>
                <th scope="col">Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Budget verdict</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>Verdict</td>
                <td style={{ fontFamily: "var(--font-mono)", fontWeight: "bold" }}>
                  {evaluation.budget.status === "outside-domain" ? (
                    <span className="badge" style={{ color: "var(--accent)" }}>
                      Outside domain
                    </span>
                  ) : evaluation.budget.allowed ? (
                    <span className="badge">Allowed</span>
                  ) : (
                    <span className="badge" style={{ color: "var(--accent)" }}>
                      Disallowed
                    </span>
                  )}
                </td>
                <td className="fine">{evaluation.budget.verdictReason}</td>
              </tr>
              <tr>
                <th scope="row">Maximum allowed frequency</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>ν₂,max</td>
                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {(evaluation.budget.nu2MaxHz / 1e12).toFixed(2)} THz
                </td>
                <td className="fine">Upper frequency bound for emitted light</td>
              </tr>
              <tr>
                <th scope="row">Absorbed quantum energy</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>hν₁</td>
                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {fixed(evaluation.budget.e1Ev, 4)} eV
                </td>
                <td className="fine">Energy of one exciting light quantum</td>
              </tr>
              <tr>
                <th scope="row">Emitted quantum energy</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>hν₂</td>
                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {fixed(evaluation.budget.e2Ev, 4)} eV
                </td>
                <td className="fine">Energy of candidate emitted light quantum</td>
              </tr>
              <tr>
                <th scope="row">Non-optical dissipation (heat)</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>
                  E<sub>other</sub>
                </td>
                <td style={{ fontFamily: "var(--font-mono)" }}>
                  {evaluation.budget.allowed
                    ? `${fixed(evaluation.budget.eOtherEv, 4)} eV`
                    : "Not applicable (disallowed)"}
                </td>
                <td className="fine">Energy transferred to thermal modes of medium</td>
              </tr>
              <tr>
                <th scope="row">Energy deficit</th>
                <td style={{ fontFamily: "var(--font-mono)" }}>ΔE</td>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "bold",
                    color: "var(--accent)",
                  }}
                >
                  {fixed(evaluation.budget.energyDeficitEv, 4)} eV
                </td>
                <td className="fine">
                  {evaluation.budget.energyDeficitEv > 0
                    ? "Energy required from non-existent source"
                    : "Zero (Conserved)"}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>

      {/* Assumptions & Not Modeled */}
      <footer
        style={{
          marginTop: "2rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.5rem",
        }}
      >
        <div style={{ marginBottom: "1rem" }}>
          <h4 className="eyebrow" style={{ marginBottom: "0.5rem" }}>
            Paper assumptions (§7 as printed)
          </h4>
          <ul className="fine" style={{ paddingLeft: "1.25rem", margin: 0 }}>
            {LQ07_MODEL.assumptions.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="eyebrow" style={{ marginBottom: "0.5rem" }}>
            What this model leaves out (not modeled)
          </h4>
          <ul className="fine" style={{ paddingLeft: "1.25rem", margin: 0 }}>
            {LQ07_MODEL.notModeled.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </footer>

      {/* Static Fallback for no-JS */}
      <noscript>
        <p className="notice" style={{ marginTop: "1.5rem" }}>
          <strong>Static worked example (JavaScript disabled):</strong> Exciting UV light at ν₁ =
          850 THz (hν₁ = 3.515 eV) limits emitted fluorescence to ν₂ ≤ 850 THz. A proposed emission
          at 900 THz (3.722 eV) has a 0.207 eV deficit and is disallowed.
        </p>
      </noscript>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(LQ07_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(LQ07_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(LQ07_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(LQ07_CAPTION.r3)}
      </p>
    </article>
  );
}
