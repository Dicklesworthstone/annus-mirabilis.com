"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ExecutionLabel } from "../../experiments/labels/ExecutionLabel.tsx";
import { executionStateKindFromHostLabel } from "../../experiments/labels/executionLabelFor.ts";
import { executionLabelAttributes } from "../../experiments/labels/resultAttributes.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import { createSr03BrowserChannel } from "../../experiments/sr03/browser.ts";
import { fromSr03Draft, type Sr03Draft, toSr03Draft } from "../../experiments/sr03/controls.ts";
import {
  SR03_CAPTION,
  SR03_OUTPUTS,
  SR03_PRESETS,
  SR03_PROMPTS,
  type Sr03Parameters,
} from "../../experiments/sr03/definition.ts";
import { decodeSr03Settings, encodeSr03Settings } from "../../experiments/sr03/permalink.ts";
import { sr03ReadingsView } from "../../experiments/sr03/readings.ts";
import { createSr03Session, type PreparedSr03Example } from "../../experiments/sr03/session.ts";
import { AcceptedStatus } from "./AcceptedStatus.tsx";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import { fixed } from "./presentation.ts";
import { withScripts } from "./subscripts.tsx";
import "./rodSimultaneityLab.css";
import { identity } from "./presentation.ts";
import {
  MinkowskiDiagramPlot,
  RodStripPlot,
  SphereEllipsoidPlot,
} from "./RodSimultaneityPlots.tsx";
import { Sci } from "./Sci.tsx";
import { ShowTheCode } from "./ShowTheCode.tsx";

export type RodSimultaneityLabProps = Readonly<{
  example: PreparedSr03Example;
  title?: string;
}>;

/** The values table's row names, in the reader's words. */
const SR03_VALUE_LABELS: Readonly<Record<string, string>> = {
  spatialSeparationK: "Distance between the events in K, Δx",
  temporalSeparationK: "Time between the events in K, Δt",
  spatialSeparationKPrime: "Distance between the events in k, Δx′",
  temporalSeparationKPrime: "Time between the events in k, Δt′",
  simultaneityK: "Their time order in K",
  simultaneityKPrime: "Their time order in k",
  // Not "Measured length": for the default platform marks it is 10 ls while the rod is 8 ls in K.
  // What the readings are is the view model's to say (sr03ReadingsView), and its label wins.
  measuredLength: "Distance between the readings at one time of the measuring frame",
  rodLengthK: "The rod's length in K, its ends read at one time of K",
  rodLengthKPrime: "The rod's length in k, its ends read at one time of k",
  readingsOnRodEnds: "Are the two readings the rod's ends?",
  spacetimeIntervalSquared: "Interval, s² = Δx² − c²Δt²",
  causalOrder: "Kind of separation",
  gammaFactor: "Lorentz factor, γ",
  ellipsoidAxisLongitudinal: "Sphere measured along the motion",
  ellipsoidAxisTransverseY: "Sphere measured across the motion (y)",
  ellipsoidAxisTransverseZ: "Sphere measured across the motion (z)",
};

/** The classification outputs, as src/workers/operations/sr03.ts encodes them. */
const SR03_CLASS_WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  simultaneityK: { "0": "simultaneous", "1": "second event later", "-1": "second event earlier" },
  simultaneityKPrime: {
    "0": "simultaneous",
    "1": "second event later",
    "-1": "second event earlier",
  },
  causalOrder: { "1": "spacelike", "0": "lightlike", "-1": "timelike" },
  readingsOnRodEnds: {
    "1": "yes, one at each end of the rod",
    "0": "no, they are not the rod's ends",
  },
};

/** The answer to "Could one of these events have caused the other?", keyed as causalOrder. */
const SR03_CAUSAL_ANSWERS: Readonly<Record<string, string>> = {
  "1": "No. Not even light can get from one event to the other in the time between them, so nothing done at one can affect the other, and observers moving differently can disagree about which came first.",
  "0": "Only by light: a flash leaving the first event arrives just as the second happens, and every observer, however they move, agrees on which came first.",
  "-1": "It could have. A signal slower than light can get from one event to the other, and every observer, however they move, agrees on which came first.",
};

function capitalized(word: string | undefined): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
}

export function RodSimultaneityLab({
  example,
  title = "Rod measurement, simultaneity, and causal order laboratory",
}: RodSimultaneityLabProps) {
  const id = useId();
  const [session] = useState(() =>
    createSr03Session(`sr03-${id}`, example, createSr03BrowserChannel),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const snapshot =
    view.accepted ??
    session.getServerSnapshot().accepted ??
    (session.getSnapshot().accepted as NonNullable<typeof view.accepted>);
  const p = (snapshot.parameters ?? example.parameters) as unknown as Sr03Parameters;

  const [draft, setDraft] = useState<Sr03Draft>(() => toSr03Draft(example.parameters));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [linkNote, setLinkNote] = useState("");

  // Predict mode state
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});

  useEffect(() => {
    setReady(true);
    const shared = decodeSr03Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toSr03Draft(shared.parameters));
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
    return () => session.disconnect();
  }, [session]);

  function apply(parameters: Sr03Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      setError(
        typeof outcome.refusal.details?.requirements === "string"
          ? outcome.refusal.details.requirements
          : outcome.refusal.message,
      );
      return;
    }
    setError("");
    setLinkNote("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      apply(fromSr03Draft(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the entered settings.");
    }
  }

  function preset(parameters: Sr03Parameters) {
    setDraft(toSr03Draft(parameters));
    setError("");
    apply(parameters);
  }

  function repairToSimultaneous() {
    const updated: Sr03Parameters = {
      ...p,
      endpointPairId: "frame-simultaneous",
    };
    setDraft(toSr03Draft(updated));
    setError("");
    apply(updated);
  }

  async function share() {
    const url = new URL(window.location.pathname, window.location.origin);
    url.search = encodeSr03Settings(session.acceptedParameters());
    try {
      await navigator.clipboard.writeText(url.href);
      setLinkNote("Link to the accepted settings copied.");
    } catch {
      setLinkNote("Copy the accepted-settings link from the field below.");
    }
  }

  // Extract snapshot outputs
  const dxKOut = snapshot.outputs.find((o) => o.quantityId === "spatialSeparationK");
  const dtKOut = snapshot.outputs.find((o) => o.quantityId === "temporalSeparationK");
  const dxkOut = snapshot.outputs.find((o) => o.quantityId === "spatialSeparationKPrime");
  const dtkOut = snapshot.outputs.find((o) => o.quantityId === "temporalSeparationKPrime");
  const measOut = snapshot.outputs.find((o) => o.quantityId === "measuredLength");
  const s2Out = snapshot.outputs.find((o) => o.quantityId === "spacetimeIntervalSquared");
  const gammaOut = snapshot.outputs.find((o) => o.quantityId === "gammaFactor");
  const longAxisOut = snapshot.outputs.find((o) => o.quantityId === "ellipsoidAxisLongitudinal");
  const transYOut = snapshot.outputs.find((o) => o.quantityId === "ellipsoidAxisTransverseY");
  const transZOut = snapshot.outputs.find((o) => o.quantityId === "ellipsoidAxisTransverseZ");

  const dxK = dxKOut?.status === "value" && typeof dxKOut.value === "number" ? dxKOut.value : 0;
  const dtK = dtKOut?.status === "value" && typeof dtKOut.value === "number" ? dtKOut.value : 0;
  const dxk = dxkOut?.status === "value" && typeof dxkOut.value === "number" ? dxkOut.value : 0;
  const dtk = dtkOut?.status === "value" && typeof dtkOut.value === "number" ? dtkOut.value : 0;
  const g = gammaOut?.status === "value" && typeof gammaOut.value === "number" ? gammaOut.value : 1;
  const s2 = s2Out?.status === "value" && typeof s2Out.value === "number" ? s2Out.value : 0;
  // The time orders and the causal order are the owner's classifications (events.ts), read as
  // they are published rather than recomputed here from Δt and s².
  const classOf = (quantityId: string) => {
    const out = snapshot.outputs.find((o) => o.quantityId === quantityId);
    return out?.status === "value" && typeof out.value === "number" ? String(out.value) : undefined;
  };
  const orderK = SR03_CLASS_WORDS.simultaneityK?.[classOf("simultaneityK") ?? ""];
  const orderk = SR03_CLASS_WORDS.simultaneityKPrime?.[classOf("simultaneityKPrime") ?? ""];
  const causalKey = classOf("causalOrder");
  const causalWord = SR03_CLASS_WORDS.causalOrder?.[causalKey ?? ""];
  const longAxis =
    longAxisOut?.status === "value" && typeof longAxisOut.value === "number"
      ? longAxisOut.value
      : p.R / g;
  const transY =
    transYOut?.status === "value" && typeof transYOut.value === "number" ? transYOut.value : p.R;
  const transZ =
    transZOut?.status === "value" && typeof transZOut.value === "number" ? transZOut.value : p.R;

  const isNonSimultaneousRefusal =
    measOut?.status === "not-applicable" && measOut.reason.includes("simultaneous");
  // What the two readings are, what the rod measures, and what each distance is called, from the
  // owner's outputs alone (experiments/sr03/readings.ts). The strip figure prints the same verdict,
  // so the status line and the figure cannot disagree about what was measured.
  const readings = sr03ReadingsView(p, snapshot.outputs);
  const statusSummary = `the two readings are ${readings.dx === null ? "not computed" : `${fixed(readings.dx, 2)} ls`} and cΔt = ${readings.cdt === null ? "not computed" : `${fixed(readings.cdt, 2)} ls`} apart in frame ${p.measuringFrame}. ${readings.verdict}`;

  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      SR03_OUTPUTS,
      example.sourceDigest,
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-03"
      data-testid="rod-simultaneity-lab"
      data-view-id="sr-03-lab"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input ?? 1}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      {...executionLabelAttributes(executionKind)}
      data-source-digest={example.sourceDigest}
      data-result-status={measOut?.status ?? "value"}
      {...(view.refusal ? { "data-refusal-code": view.refusal.code } : {})}
    >
      <header
        className="lab-heading"
        style={{
          borderBottom: "1px solid var(--line)",
          paddingBottom: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            width: "100%",
          }}
        >
          <div>
            <p className="eyebrow">An executable laboratory</p>
            <h2 id={`${id}-title`}>{title}</h2>
          </div>
          <ExecutionLabel state={executionKind} />
        </div>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Its plots, event tables, model assumptions and explanations remain available; changing the
          settings requires JavaScript.
        </p>
      </noscript>

      {/* Visualizations Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
          gap: "1.5rem",
          margin: "1.5rem 0",
        }}
      >
        <RodStripPlot
          readings={readings}
          rodRestFrame={p.rodRestFrame}
          measuringFrame={p.measuringFrame}
          v={p.v}
          L0={p.L0}
        />
        <MinkowskiDiagramPlot
          v={p.v}
          L0={p.L0}
          endpointPairId={p.endpointPairId}
          measuringFrame={p.measuringFrame}
          rodRestFrame={p.rodRestFrame}
          dxK={dxK}
          dtK={dtK}
          dxk={dxk}
          dtk={dtk}
        />
      </div>

      <SphereEllipsoidPlot
        radius={p.R}
        v={p.v}
        longitudinal={longAxis}
        transverseY={transY}
        transverseZ={transZ}
      />

      {/* Non-simultaneous refusal banner & repair */}
      {isNonSimultaneousRefusal && (
        <div
          className="notice error"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            margin: "1rem 0",
          }}
        >
          <div>
            <p style={{ fontWeight: "bold", margin: 0 }}>
              Not a length: the two ends were marked at different times
            </p>
            <p className="fine" style={{ margin: "0.25rem 0 0" }}>
              {measOut?.reason ??
                "These endpoint events are not simultaneous in the measuring frame; choose endpoints at one time of that frame."}
            </p>
          </div>
          <button type="button" onClick={repairToSimultaneous} className="button">
            Mark both ends at one time of this frame
          </button>
        </div>
      )}

      <div className="sr03-controls">
        <details className="lab-predict">
          <summary>Predict before calculating</summary>
          {(["endpoint-pair", "causal-order"] as const).map((key) => {
            const prompt = SR03_PROMPTS[key];
            if (!prompt) return null;
            const chosen = selectedCandidates[prompt.id];
            return (
              <fieldset key={prompt.id}>
                <legend>{prompt.question}</legend>
                {prompt.candidates.map((c) => (
                  <label key={c.id} className="lab-predict-candidate">
                    <input
                      type="radio"
                      name={`${id}-predict-${prompt.id}`}
                      value={c.id}
                      checked={chosen === c.id}
                      onChange={() =>
                        setSelectedCandidates((prev) => ({ ...prev, [prompt.id]: c.id }))
                      }
                    />
                    <span>
                      <strong>{c.label}.</strong> {c.description}
                    </span>
                  </label>
                ))}
                {chosen && (
                  <div className="lab-predict-reveal">
                    <p>{prompt.modelReveal}</p>
                    {/* The assumption behind each option is shown only for the one the reader
                        chose: listed under every option before a choice, it named the right one
                        ("= -6.0 s") and the wrong ones ("Wrong sign..."). */}
                    <p>
                      Your choice rests on:{" "}
                      {prompt.candidates.find((c) => c.id === chosen)?.separatingAssumption}
                    </p>
                  </div>
                )}
              </fieldset>
            );
          })}
        </details>

        <fieldset className="lab-choice">
          <legend>Try</legend>
          <div className="actions">
            {Object.entries(SR03_PRESETS).map(([key, item]) => (
              <button
                key={key}
                type="button"
                className="secondary"
                onClick={() => preset(item.parameters)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
        <ExperimentSettings contents="speed, frames, rod length, sphere radius, event pair">
          {/* Controls Form */}
          <form
            noValidate
            onSubmit={submit}
            aria-label="Rod measurement and simultaneity settings"
            aria-describedby={error ? `${id}-error` : undefined}
            style={{ margin: "1.5rem 0" }}
          >
            <fieldset disabled={!ready}>
              <legend>Frames, speed and sizes</legend>

              <div className="input-grid">
                {/* Rod Rest Frame */}
                <div className="input-field">
                  <label htmlFor={`${id}-rest-frame`}>Rod rest frame</label>
                  <select
                    id={`${id}-rest-frame`}
                    value={draft.rodRestFrame}
                    onChange={(e) => {
                      const next = { ...draft, rodRestFrame: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <option value="k">Frame k (Moving at velocity v)</option>
                    <option value="K">Frame K (Platform at rest)</option>
                  </select>
                </div>

                {/* Measuring Frame */}
                <div className="input-field">
                  <label htmlFor={`${id}-meas-frame`}>Measuring observer&apos;s frame</label>
                  <select
                    id={`${id}-meas-frame`}
                    value={draft.measuringFrame}
                    onChange={(e) => {
                      const next = { ...draft, measuringFrame: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <option value="K">Frame K (Platform observer)</option>
                    <option value="k">Frame k (Moving observer)</option>
                  </select>
                </div>

                {/* Frame Velocity v */}
                <div className="input-field">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label htmlFor={`${id}-v`}>Relative speed v (fraction of c)</label>
                    <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                      {p.v.toFixed(2)} c
                    </span>
                  </div>
                  <input
                    id={`${id}-v-range`}
                    type="range"
                    aria-label="Relative speed v (fraction of c), slider"
                    min="-0.95"
                    max="0.95"
                    step="0.05"
                    value={draft.v}
                    onChange={(e) => {
                      const next = { ...draft, v: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                  />
                  <input
                    id={`${id}-v`}
                    type="number"
                    min="-0.95"
                    max="0.95"
                    step="0.01"
                    value={draft.v}
                    onChange={(e) => {
                      const next = { ...draft, v: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)", width: "6rem", marginTop: "0.25rem" }}
                  />
                </div>

                {/* Proper Length L0 */}
                <div className="input-field">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label htmlFor={`${id}-l0`}>Proper length L₀ (light-seconds)</label>
                    <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                      {p.L0.toFixed(1)} ls
                    </span>
                  </div>
                  <input
                    id={`${id}-l0-range`}
                    type="range"
                    aria-label="Proper length L₀ (light-seconds), slider"
                    min="1"
                    max="50"
                    step="1"
                    value={draft.L0}
                    onChange={(e) => {
                      const next = { ...draft, L0: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                  />
                  <input
                    id={`${id}-l0`}
                    type="number"
                    min="0.1"
                    max="1000"
                    step="0.5"
                    value={draft.L0}
                    onChange={(e) => {
                      const next = { ...draft, L0: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)", width: "6rem", marginTop: "0.25rem" }}
                  />
                </div>

                {/* Sphere Radius R */}
                <div className="input-field">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label htmlFor={`${id}-r`}>Sphere radius R (ls)</label>
                    <span className="fine" style={{ fontFamily: "var(--font-mono)" }}>
                      {p.R.toFixed(1)} ls
                    </span>
                  </div>
                  <input
                    id={`${id}-r-range`}
                    type="range"
                    aria-label="Sphere radius R (ls), slider"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={draft.R}
                    onChange={(e) => {
                      const next = { ...draft, R: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                  />
                  <input
                    id={`${id}-r`}
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={draft.R}
                    onChange={(e) => {
                      const next = { ...draft, R: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)", width: "6rem", marginTop: "0.25rem" }}
                  />
                </div>

                {/* Endpoint Pair Selection */}
                <div className="input-field">
                  <label htmlFor={`${id}-endpoint-pair`}>Which endpoint events</label>
                  <select
                    id={`${id}-endpoint-pair`}
                    value={draft.endpointPairId}
                    onChange={(e) => {
                      const next = { ...draft, endpointPairId: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromSr03Draft(next));
                      } catch {}
                    }}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <option value="platform-simultaneous">
                      Platform-simultaneous (dt = 0 in K)
                    </option>
                    <option value="frame-simultaneous">
                      Frame-simultaneous (dt = 0 in the measuring frame)
                    </option>
                    <option value="causal-timelike">Timelike pair (dt = 10 s, dx = 5 ls)</option>
                    <option value="causal-lightlike">Lightlike pair (dt = 10 s, dx = 10 ls)</option>
                    <option value="causal-threshold">
                      Causal threshold (dt = 2 s, dx = 10 ls)
                    </option>
                    <option value="custom">Custom coordinates</option>
                  </select>
                </div>
              </div>

              {/* Custom coordinate inputs if custom */}
              {draft.endpointPairId === "custom" && (
                <div className="input-grid" style={{ marginTop: "1rem" }}>
                  <div className="input-field">
                    <label
                      htmlFor={`${id}-t1`}
                      className="fine"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      E₁ t (s)
                    </label>
                    <input
                      id={`${id}-t1`}
                      type="number"
                      value={draft.customT1 ?? "0"}
                      onChange={(e) => setDraft({ ...draft, customT1: e.target.value })}
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                  <div className="input-field">
                    <label
                      htmlFor={`${id}-x1`}
                      className="fine"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      E₁ x (ls)
                    </label>
                    <input
                      id={`${id}-x1`}
                      type="number"
                      value={draft.customX1 ?? "0"}
                      onChange={(e) => setDraft({ ...draft, customX1: e.target.value })}
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                  <div className="input-field">
                    <label
                      htmlFor={`${id}-t2`}
                      className="fine"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      E₂ t (s)
                    </label>
                    <input
                      id={`${id}-t2`}
                      type="number"
                      value={draft.customT2 ?? "0"}
                      onChange={(e) => setDraft({ ...draft, customT2: e.target.value })}
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                  <div className="input-field">
                    <label
                      htmlFor={`${id}-x2`}
                      className="fine"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      E₂ x (ls)
                    </label>
                    <input
                      id={`${id}-x2`}
                      type="number"
                      value={draft.customX2 ?? "10"}
                      onChange={(e) => setDraft({ ...draft, customX2: e.target.value })}
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <p id={`${id}-error`} className="notice error">
                  {withScripts(error)}
                </p>
              )}

              <div className="button-group" style={{ marginTop: "1rem" }}>
                <button type="submit" className="button">
                  Apply settings
                </button>
                <button type="button" onClick={share} className="button secondary">
                  Copy settings link
                </button>
              </div>
              {linkNote && (
                <p className="notice" style={{ marginTop: "0.5rem" }}>
                  {linkNote}
                </p>
              )}
            </fieldset>
          </form>
        </ExperimentSettings>
        <AcceptedStatus
          worked={snapshot === session.getServerSnapshot().accepted}
          summary={statusSummary}
        />
      </div>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p className="sr03-context" data-detail="0">
        {withScripts(SR03_CAPTION.r0)}
      </p>
      <p className="sr03-context" data-detail="1">
        {withScripts(SR03_CAPTION.r1)}
      </p>
      <p className="sr03-context" data-detail="2" hidden>
        {withScripts(SR03_CAPTION.r2)}
      </p>
      <p className="sr03-context" data-detail="3" hidden>
        {withScripts(SR03_CAPTION.r3)}
      </p>

      {/* Spacetime event interval ledger */}
      <div className="notice" style={{ margin: "1.5rem 0" }}>
        <h3 style={{ marginTop: 0 }}>Spacetime event coordinates and invariant interval</h3>
        <section
          className="table-scroll sr03-interval"
          tabIndex={0}
          aria-label="Spacetime event coordinates and invariant interval table"
        >
          <table style={{ width: "100%", textAlign: "left", fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr>
                <th scope="col">Frame</th>
                <th scope="col">Δt (s)</th>
                <th scope="col">Δx (ls)</th>
                <th scope="col">Simultaneity</th>
                <th scope="col">s² = Δx² − c²Δt² (ls²)</th>
                <th scope="col">Causal order</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">K (Platform)</th>
                <td>{fixed(dtK, 3)}</td>
                <td>{fixed(dxK, 3)}</td>
                <td>
                  <span className="badge">{capitalized(orderK)}</span>
                </td>
                <td style={{ fontWeight: "bold" }}>{fixed(s2, 3)}</td>
                <td>
                  <span className="badge">{capitalized(causalWord)}</span>
                </td>
              </tr>
              <tr>
                <th scope="row">k (Moving)</th>
                <td>{fixed(dtk, 3)}</td>
                <td>{fixed(dxk, 3)}</td>
                <td>
                  <span className="badge">{capitalized(orderk)}</span>
                </td>
                <td style={{ fontWeight: "bold" }}>{fixed(s2, 3)}</td>
                <td>
                  <span className="badge">{capitalized(causalWord)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        {causalKey && SR03_CAUSAL_ANSWERS[causalKey] && (
          <p data-output="causalOrder">
            <strong>Could one of these events have caused the other?</strong>{" "}
            {SR03_CAUSAL_ANSWERS[causalKey]}
          </p>
        )}
      </div>

      {/* The accepted values, in words. */}
      <div className="lab-values" data-view-id="sr-03-data-table">
        <h3>Values at these settings</h3>
        <section className="table-scroll" tabIndex={0} aria-label="Values at these settings">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.outputs.map((out) => (
                <tr key={out.quantityId} data-quantity-id={out.quantityId}>
                  <th scope="row">
                    {readings.valueLabels[out.quantityId] ??
                      SR03_VALUE_LABELS[out.quantityId] ??
                      out.quantityId}
                  </th>
                  <td data-output={out.quantityId}>
                    {out.status !== "value" ? (
                      "reason" in out ? (
                        String(out.reason)
                      ) : (
                        "Outside the model's domain"
                      )
                    ) : typeof out.value !== "number" ? (
                      String(out.value)
                    ) : out.quantityId in SR03_CLASS_WORDS ? (
                      (SR03_CLASS_WORDS[out.quantityId]?.[String(out.value)] ?? String(out.value))
                    ) : (
                      <>
                        {Math.abs(out.value) > 1e4 ||
                        (Math.abs(out.value) < 1e-3 && out.value !== 0) ? (
                          <Sci value={out.value} digits={4} />
                        ) : (
                          fixed(out.value, 4)
                        )}
                        {out.unit && out.unit !== "1" ? ` ${out.unit.replace("^2", "²")}` : ""}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* Epistemic limits (not modeled) */}
      <div className="notice" style={{ margin: "1.5rem 0" }}>
        <h3 style={{ marginTop: 0 }}>What this model leaves out</h3>
        <p className="fine">
          It applies exact special-relativistic coordinate transformations, coordinate length
          measurements and invariant intervals between inertial frames. It does not model:
        </p>
        <ul className="fine">
          <li>
            Optical camera image appearance (Terrell-Penrose rotation and light-travel-time
            distortion), which differs from coordinate measurement at a single instant.
          </li>
          <li>Accelerating reference frames, Rindler horizons, or Thomas precession.</li>
          <li>
            Internal stress, elasticity, Born rigidity breakdown, or relativistic wave propagation
            during rod acceleration.
          </li>
          <li>Gravitational time dilation or spacetime curvature (general relativity).</li>
          <li>Quantum uncertainty or field fluctuations at Planck-scale event intervals.</li>
          <li>Superluminal observers (|v| &ge; c) or tachyonic coordinate frames.</li>
        </ul>
      </div>

      <ShowTheCode listings={[]} />
    </section>
  );
}
