"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { fromLq05Draft, toLq05Draft } from "../../../experiments/lq05/controls.ts";
import {
  LQ05_CAPTION,
  LQ05_DEFAULTS,
  LQ05_MODEL,
  LQ05_OUTPUTS,
  LQ05_PRESETS,
  type Lq05Parameters,
  type Lq05View,
} from "../../../experiments/lq05/definition.ts";
import { decodeLq05Settings } from "../../../experiments/lq05/permalink.ts";
import {
  buildLq05Snapshot,
  createLq05Session,
  evaluateLq05,
  type PreparedLq05Example,
} from "../../../experiments/lq05/session.ts";
import { LQ05_TAPE } from "../../../experiments/lq05/tape.ts";
import { LabTapeLink, useLabTapeLink } from "../../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { refusalSentence } from "../../../experiments/results/refusalSentence.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import { PREDICT_PROMPTS } from "../../../generated/predict-prompts.ts";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { KEPT_RESULT } from "../keptResult.ts";
import { PredictGatePanels, usePredictGate, withPredictions } from "../PredictGate.tsx";
import { fixed, identity, readablePowers, sentenceNumber } from "../presentation.ts";
import { PowerOfTen, Sci } from "../Sci.tsx";
import { withScripts } from "../subscripts.tsx";
import { IndependentConfigurationsPlot } from "./IndependentConfigurationsPlot.tsx";
import "./independentConfigurationsLab.css";

const LQ05_PROMPTS = PREDICT_PROMPTS["lq-05"] ?? [];

export function IndependentConfigurationsLab({
  example,
  title = "Independent configurations and Boltzmann entropy",
}: {
  example?: PreparedLq05Example | undefined;
  title?: string | undefined;
}) {
  const id = useId();
  const [session] = useState(() =>
    createLq05Session(`lq05-${id}`, example?.parameters ?? LQ05_DEFAULTS),
  );

  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(
    LQ05_TAPE,
    session,
    session.acceptedParameters(),
    true,
    (restored) => setDraft(toLq05Draft(restored)),
  );

  const fallback =
    session.getServerSnapshot().accepted ??
    buildLq05Snapshot(`lq05-${id}`, "lq05-init", null, LQ05_DEFAULTS, 0, 0);
  const snapshot = view.accepted ?? fallback;
  const p = snapshot.parameters as Lq05Parameters;
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation; no example, no earned label.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      LQ05_OUTPUTS,
      example?.sourceDigest ?? "",
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  const [draft, setDraft] = useState(() => toLq05Draft(p));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [linkNote, setLinkNote] = useState("");
  // The drawing and the controls come first; W, the chart and the outputs wait for a prediction.
  const gate = usePredictGate("lq-05", LQ05_PROMPTS);

  const evaluation = evaluateLq05(p);
  // One sentence for the status line: the chance that every point sits in the chosen fraction.
  const chance = p.locked
    ? sentenceNumber(evaluation.locked.value)
    : evaluation.independentProbability.linearRepresentable
      ? sentenceNumber(evaluation.independentProbability.value)
      : `about ${readablePowers(`1e${Math.round(evaluation.independentProbability.log10W)}`)}`;
  const statusSummary = p.locked
    ? `${p.n} locked points move as one, so all of them sit in a fraction ${fixed(p.f, 4)} of the volume with probability ${chance}, the fraction itself.`
    : `${p.n} independent points all sit in a fraction ${fixed(p.f, 4)} of the volume with probability ${fixed(p.f, 4)} to the power ${p.n}, ${chance}.`;

  useEffect(() => {
    const shared = decodeLq05Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toLq05Draft(shared.parameters));
      setDirty(true);
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
  }, []);

  function apply(next: Lq05Parameters) {
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
    const parsed = fromLq05Draft(draft);
    // The session's validator owns the domain and says what to enter.
    apply(parsed);
  }

  function setPreset(presetKey: keyof typeof LQ05_PRESETS) {
    const preset = LQ05_PRESETS[presetKey];
    if (!preset) return;
    const target = preset.parameters;
    setDraft(toLq05Draft(target));
    apply(target);
  }

  function setFraction(fVal: number) {
    const next = { ...p, f: fVal };
    setDraft(toLq05Draft(next));
    apply(next);
  }

  function setViewMode(v: Lq05View) {
    const next = { ...p, view: v };
    setDraft(toLq05Draft(next));
    apply(next);
  }

  function toggleLocked() {
    const next = { ...p, locked: !p.locked };
    setDraft(toLq05Draft(next));
    apply(next);
  }

  return (
    <article
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-05"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "configurationProbability")}
    >
      <header
        className="lab-heading"
        style={{
          borderBottom: "1px solid var(--line)",
          paddingBottom: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ width: "100%" }}>
          <p className="eyebrow">Light quanta · §5 statistical microstate counting</p>
          <h2 id={`${id}-title`} style={{ margin: "0.25rem 0" }}>
            {title}
          </h2>
          <p className="fine" style={{ margin: "0.5rem 0 0" }}>
            How counting independent configurations gives an entropy that depends on the volume, and
            what changes when the positions are locked together.
          </p>
        </div>
        {/* The execution line sits in the heading's right column, as labShell.css places it
            (dispatch 268). As a row of its own under the heading it put the plot at 625-629px at
            1440. */}
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, {
            notModeled: `${LQ05_MODEL.notModeled.join("; ")}.`,
          })}
        />
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built,
          and its values and explanations remain available. The controls need JavaScript to respond.
        </p>
      </noscript>

      {/* Main Plot & Visualization */}
      <IndependentConfigurationsPlot
        parameters={p}
        evaluation={evaluation}
        response={gate.response}
      />

      <PredictGatePanels gate={gate} />

      <fieldset className="lab-choice lq05-try">
        <legend>Try</legend>
        <div className="actions">
          {(Object.keys(LQ05_PRESETS) as (keyof typeof LQ05_PRESETS)[]).map((key) => (
            <button key={key} type="button" className="secondary" onClick={() => setPreset(key)}>
              {LQ05_PRESETS[key]?.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Controls Section */}
      <section
        style={{
          marginTop: "2rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.5rem",
        }}
      >
        <form
          noValidate
          onSubmit={submit}
          className="input-grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
            gap: "1.5rem",
          }}
        >
          {/* 1. Point count n */}
          <div className="input-field">
            <label htmlFor={`${id}-n`}>Number of particles n (1 to 60):</label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginTop: "0.25rem",
              }}
            >
              <input
                id={`${id}-n`}
                type="number"
                min="1"
                max="60"
                step="1"
                style={{ width: "5rem" }}
                value={draft.n}
                onChange={(e) => {
                  setDraft({ ...draft, n: e.target.value });
                  setDirty(true);
                }}
              />
              <input
                type="range"
                min="1"
                max="60"
                step="1"
                style={{ flex: 1 }}
                value={draft.n}
                aria-label="Particle count slider"
                onChange={(e) => {
                  setDraft({ ...draft, n: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
          </div>

          {/* 2. Subvolume fraction f */}
          <div className="input-field">
            <label htmlFor={`${id}-f`}>Subvolume fraction f = V/V₀ (0.01 – 1.0):</label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginTop: "0.25rem",
              }}
            >
              <input
                id={`${id}-f`}
                type="number"
                min="0.01"
                max="1.0"
                step="0.01"
                style={{ width: "5rem" }}
                value={draft.f}
                onChange={(e) => {
                  setDraft({ ...draft, f: e.target.value });
                  setDirty(true);
                }}
              />
              <div style={{ display: "flex", gap: "0.375rem" }}>
                <button
                  type="button"
                  className="button secondary"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "var(--type-fine)" }}
                  onClick={() => setFraction(0.5)}
                >
                  Half (1/2)
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "var(--type-fine)" }}
                  onClick={() => setFraction(0.25)}
                >
                  Quarter (1/4)
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "var(--type-fine)" }}
                  onClick={() => setFraction(1.0)}
                >
                  Full (1)
                </button>
              </div>
            </div>
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
          <div style={{ gridColumn: "1 / -1" }}>
            <ExperimentSettings contents="the display view, the locked-positions counterexample">
              {/* 3. View selector & Locked toggle */}
              <div className="input-field">
                <span
                  id={`${id}-view-label`}
                  className="fine"
                  style={{ fontWeight: 600, display: "block", marginBottom: "0.25rem" }}
                >
                  Display view:
                </span>
                <fieldset
                  aria-labelledby={`${id}-view-label`}
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
                >
                  <button
                    type="button"
                    className={`button ${p.view === "enumeration" ? "" : "secondary"}`}
                    aria-pressed={p.view === "enumeration"}
                    style={{ padding: "0.25rem 0.625rem", fontSize: "var(--type-fine)" }}
                    onClick={() => setViewMode("enumeration")}
                  >
                    Enumeration
                  </button>
                  <button
                    type="button"
                    className={`button ${p.view === "sampling" ? "" : "secondary"}`}
                    aria-pressed={p.view === "sampling"}
                    style={{ padding: "0.25rem 0.625rem", fontSize: "var(--type-fine)" }}
                    onClick={() => setViewMode("sampling")}
                  >
                    Sampling
                  </button>
                  <button
                    type="button"
                    className={`button ${p.view === "logarithmic" ? "" : "secondary"}`}
                    aria-pressed={p.view === "logarithmic"}
                    style={{ padding: "0.25rem 0.625rem", fontSize: "var(--type-fine)" }}
                    onClick={() => setViewMode("logarithmic")}
                  >
                    Logarithmic
                  </button>
                </fieldset>
              </div>

              {/* 4. Locked positions checkbox */}
              <div className="input-field check" style={{ margin: 0 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={p.locked} onChange={toggleLocked} />
                  <span className="fine" style={{ fontWeight: 600 }}>
                    Lock the points together, so they move as one
                  </span>
                </label>
              </div>
              <p className="fine">These two apply at once.</p>
            </ExperimentSettings>
          </div>
        </form>

        {error && (
          <div
            className="notice error"
            role="alert"
            style={{ marginTop: "1rem", padding: "0.75rem" }}
          >
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
          <div className="notice" style={{ marginTop: "0.75rem", padding: "0.75rem" }}>
            {linkNote}
          </div>
        )}
      </section>

      {/* Outputs Table */}
      <section
        {...gate.response}
        style={{ marginTop: "2rem", borderTop: "1px solid var(--line)", paddingTop: "1.5rem" }}
      >
        <h3 style={{ fontSize: "1rem", margin: "0 0 1rem" }}>
          Calculated microstate and entropy outputs
        </h3>

        <section
          className="table-scroll"
          aria-label="Calculated microstate and entropy outputs table"
        >
          <table
            style={{
              width: "100%",
              textAlign: "left",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--type-fine)",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>
                <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Quantity</th>
                <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Symbolic form</th>
                <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Value</th>
                <th style={{ padding: "0.5rem var(--table-cell-x)" }}>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                  Relative state probability
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  {p.locked ? (
                    <>
                      W<sub>locked</sub> = f
                    </>
                  ) : (
                    <>
                      W = (V/V₀)<sup>n</sup> = f<sup>n</sup>
                    </>
                  )}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: "bold" }}>
                  {p.locked ? (
                    fixed(evaluation.locked.value, 6)
                  ) : evaluation.independentProbability.linearRepresentable ? (
                    <Sci value={evaluation.independentProbability.value} digits={6} />
                  ) : (
                    <PowerOfTen exponent={evaluation.independentProbability.log10W} digits={4} />
                  )}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                  {p.locked
                    ? "Rigid cluster moving as one unit"
                    : "Probability that all n independent points are found in V"}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                  Natural logarithm ln W
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  {p.locked ? "ln f" : "n ln f"}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 600 }}>
                  {p.locked
                    ? fixed(Math.log(evaluation.locked.value), 6)
                    : fixed(evaluation.independentProbability.lnW, 6)}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                  Proportional to the entropy difference ΔS / k<sub>B</sub>
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                  Dimensionless entropy change ΔS/k<sub>B</sub>
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  {p.locked ? "ln f" : "n ln(V/V₀)"}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 600 }}>
                  {p.locked
                    ? fixed(Math.log(evaluation.locked.value), 6)
                    : fixed(evaluation.independentProbability.deltaSOverKb, 6)}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                  Matches Wien-regime radiation entropy S − S₀ = (E / hν) k<sub>B</sub> ln(V/V₀)
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "0.5rem var(--table-cell-x)", fontWeight: 500 }}>
                  Base-10 logarithm log₁₀ W
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  {p.locked ? "log₁₀ f" : "n log₁₀ f"}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)" }}>
                  {p.locked
                    ? fixed(Math.log10(evaluation.locked.value), 6)
                    : fixed(evaluation.independentProbability.log10W, 6)}
                </td>
                <td style={{ padding: "0.5rem var(--table-cell-x)", color: "var(--muted)" }}>
                  Order of magnitude (for example 10⁻¹⁸ at n = 60)
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
            Paper assumptions (§5 as printed)
          </h4>
          <ul
            className="fine"
            style={{
              paddingLeft: "1.25rem",
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            {LQ05_MODEL.assumptions.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="eyebrow" style={{ marginBottom: "0.5rem" }}>
            What this model leaves out (not modeled)
          </h4>
          <ul
            className="fine"
            style={{
              paddingLeft: "1.25rem",
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            {LQ05_MODEL.notModeled.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </footer>

      {/* Static Fallback for no-JS */}
      <noscript>
        <div className="notice" style={{ marginTop: "1.5rem" }}>
          <strong>Static worked example (JavaScript disabled):</strong> With n = 4 independent
          points in half a volume (f = 0.5), W = (1/2)⁴ = 1/16 = 0.0625. ln W = 4 ln(0.5) ≈ -2.7726.
        </div>
      </noscript>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(LQ05_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(LQ05_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(LQ05_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(LQ05_CAPTION.r3)}
      </p>
    </article>
  );
}
