"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createSr03BrowserChannel } from "../../experiments/sr03/browser.ts";
import { fromSr03Draft, type Sr03Draft, toSr03Draft } from "../../experiments/sr03/controls.ts";
import {
  SR03_MODEL,
  SR03_PRESETS,
  SR03_PROMPTS,
  type Sr03Parameters,
  type Sr03PromptKey,
} from "../../experiments/sr03/definition.ts";
import { decodeSr03Settings, encodeSr03Settings } from "../../experiments/sr03/permalink.ts";
import { createSr03Session, type PreparedSr03Example } from "../../experiments/sr03/session.ts";
import { identity } from "./presentation.ts";
import {
  MinkowskiDiagramPlot,
  RodStripPlot,
  SphereEllipsoidPlot,
} from "./RodSimultaneityPlots.tsx";
import { ShowTheCode } from "./ShowTheCode.tsx";

export type RodSimultaneityLabProps = Readonly<{
  example: PreparedSr03Example;
  title?: string;
}>;

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
  const [activePromptKey, setActivePromptKey] = useState<Sr03PromptKey>("endpoint-pair");
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
  const measuredL =
    measOut?.status === "value" && typeof measOut.value === "number" ? measOut.value : null;
  const s2 = s2Out?.status === "value" && typeof s2Out.value === "number" ? s2Out.value : 0;
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

  const currentPrompt = SR03_PROMPTS[activePromptKey] ?? SR03_PROMPTS["endpoint-pair"];

  return (
    <section
      className="laboratory flex flex-col gap-6 max-w-5xl mx-auto p-4"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-03"
      data-testid="rod-simultaneity-lab"
      data-view-id="sr-03-lab"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input ?? 1}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
      data-result-status={measOut?.status ?? "value"}
      {...(view.refusal ? { "data-refusal-code": view.refusal.code } : {})}
    >
      <header className="lab-heading border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow text-xs font-mono uppercase tracking-wider text-sky-700 dark:text-sky-300">
              SR-03 · An executable laboratory
            </p>
            <h2 id={`${id}-title`} className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
          </div>
          <span className="badge text-xs px-2.5 py-1 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-medium">
            {SR03_MODEL.label}
          </span>
        </div>
      </header>

      <noscript>
        <p className="notice p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs rounded border border-amber-200 dark:border-amber-900">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Its plots, event tables, model assumptions and explanations remain available; changing the
          settings requires JavaScript.
        </p>
      </noscript>

      <p className="text-sm text-slate-700 dark:text-slate-300">
        In §2 of <em>Zur Elektrodynamik bewegter Körper</em> (1905), Einstein demonstrates that two
        events simultaneous from the perspective of one reference frame are not simultaneous when
        viewed from another in relative motion. In §4, he derives the physical meaning of moving
        rigid bodies, proving that measuring the length of a moving rod requires taking coordinate
        positions of its endpoints at <strong>one single instant of the measuring frame</strong>,
        contracting its measured length to <span className="font-mono">L = L₀/γ</span>, while a
        sphere of radius <span className="font-mono">R</span> is measured as an ellipsoid with axes{" "}
        <span className="font-mono">(R/γ, R, R)</span>.
      </p>

      {/* Discovery Predict Mode */}
      <section
        className="predict-mode-box bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4"
        aria-label="Predict before calculating"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Discovery Mode: Predict Before Calculating
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActivePromptKey("endpoint-pair")}
              className={`text-xs px-2.5 py-1 rounded transition ${
                activePromptKey === "endpoint-pair"
                  ? "bg-amber-600 text-white font-medium"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-amber-300 dark:border-amber-800"
              }`}
            >
              Relativity of Simultaneity
            </button>
            <button
              type="button"
              onClick={() => setActivePromptKey("causal-order")}
              className={`text-xs px-2.5 py-1 rounded transition ${
                activePromptKey === "causal-order"
                  ? "bg-amber-600 text-white font-medium"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-amber-300 dark:border-amber-800"
              }`}
            >
              Invariant Causal Order
            </button>
          </div>
        </div>

        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-3">
          {currentPrompt.question}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          {currentPrompt.candidates.map((c) => (
            <label
              key={c.id}
              className={`flex flex-col gap-1 p-2.5 rounded border text-xs cursor-pointer transition ${
                selectedCandidates[currentPrompt.id] === c.id
                  ? "bg-amber-100/70 dark:bg-amber-900/40 border-amber-500 text-amber-950 dark:text-amber-100"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${id}-predict-${currentPrompt.id}`}
                  value={c.id}
                  checked={selectedCandidates[currentPrompt.id] === c.id}
                  onChange={() =>
                    setSelectedCandidates((prev) => ({ ...prev, [currentPrompt.id]: c.id }))
                  }
                  className="rounded-full text-amber-600"
                />
                <span className="font-semibold">{c.label}</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {c.description}
              </span>
              <span className="text-[10px] font-mono text-slate-400">{c.separatingAssumption}</span>
            </label>
          ))}
        </div>

        {selectedCandidates[currentPrompt.id] && (
          <div className="text-xs p-3 rounded bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-amber-800 dark:text-amber-300">Model reveal: </span>
            {currentPrompt.modelReveal}
          </div>
        )}
      </section>

      {/* Presets Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Presets:</span>
        {Object.entries(SR03_PRESETS).map(([key, item]) => (
          <button
            key={key}
            type="button"
            className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition"
            onClick={() => preset(item.parameters)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Non-simultaneous refusal banner & repair */}
      {isNonSimultaneousRefusal && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              Refusal: Non-simultaneous Endpoint Measurement
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {measOut?.reason ??
                "These endpoint events are not simultaneous in the measuring frame; choose endpoints at one time of that frame."}
            </p>
          </div>
          <button
            type="button"
            onClick={repairToSimultaneous}
            className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium transition shrink-0"
          >
            Repair to frame-simultaneous endpoints
          </button>
        </div>
      )}

      {/* Controls Form */}
      <form
        onSubmit={submit}
        aria-label="Rod measurement and simultaneity settings"
        aria-describedby={error ? `${id}-error` : undefined}
        className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-lg border border-slate-200 dark:border-slate-800"
      >
        <fieldset disabled={!ready} className="flex flex-col gap-4">
          <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Interactive Kinematic Controls
          </legend>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Rod Rest Frame */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${id}-rest-frame`}
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Rod Rest Frame
              </label>
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
                className="text-xs p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              >
                <option value="k">Frame k (Moving at velocity v)</option>
                <option value="K">Frame K (Platform at rest)</option>
              </select>
            </div>

            {/* Measuring Frame */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${id}-meas-frame`}
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Measuring Observer Frame
              </label>
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
                className="text-xs p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              >
                <option value="K">Frame K (Platform observer)</option>
                <option value="k">Frame k (Moving observer)</option>
              </select>
            </div>

            {/* Frame Velocity v */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <label htmlFor={`${id}-v`}>Relative Speed v (fraction of c)</label>
                <span className="font-mono text-slate-500">{p.v.toFixed(2)} c</span>
              </div>
              <input
                id={`${id}-v-range`}
                type="range"
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
                className="text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono w-24"
              />
            </div>

            {/* Proper Length L0 */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <label htmlFor={`${id}-l0`}>Proper Length L₀ (light-seconds)</label>
                <span className="font-mono text-slate-500">{p.L0.toFixed(1)} ls</span>
              </div>
              <input
                id={`${id}-l0-range`}
                type="range"
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
                className="text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono w-24"
              />
            </div>

            {/* Sphere Radius R */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <label htmlFor={`${id}-r`}>Sphere Radius R (ls)</label>
                <span className="font-mono text-slate-500">{p.R.toFixed(1)} ls</span>
              </div>
              <input
                id={`${id}-r-range`}
                type="range"
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
                className="text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono w-24"
              />
            </div>

            {/* Endpoint Pair Selection */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${id}-endpoint-pair`}
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Endpoint Event Selection
              </label>
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
                className="text-xs p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              >
                <option value="platform-simultaneous">Platform-Simultaneous (dt = 0 in K)</option>
                <option value="frame-simultaneous">
                  Frame-Simultaneous (dt = 0 in Measuring Frame)
                </option>
                <option value="causal-timelike">Causal Timelike (dt = 10s, dx = 5ls)</option>
                <option value="causal-lightlike">Causal Lightlike (dt = 10s, dx = 10ls)</option>
                <option value="causal-threshold">Causal Threshold (dt = 2s, dx = 10ls)</option>
                <option value="custom">Custom Coordinates</option>
              </select>
            </div>
          </div>

          {/* Custom coordinate inputs if custom */}
          {draft.endpointPairId === "custom" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-t1`} className="text-[11px] font-mono">
                  E₁ t (s)
                </label>
                <input
                  id={`${id}-t1`}
                  type="number"
                  value={draft.customT1 ?? "0"}
                  onChange={(e) => setDraft({ ...draft, customT1: e.target.value })}
                  className="text-xs p-1 rounded border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-x1`} className="text-[11px] font-mono">
                  E₁ x (ls)
                </label>
                <input
                  id={`${id}-x1`}
                  type="number"
                  value={draft.customX1 ?? "0"}
                  onChange={(e) => setDraft({ ...draft, customX1: e.target.value })}
                  className="text-xs p-1 rounded border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-t2`} className="text-[11px] font-mono">
                  E₂ t (s)
                </label>
                <input
                  id={`${id}-t2`}
                  type="number"
                  value={draft.customT2 ?? "0"}
                  onChange={(e) => setDraft({ ...draft, customT2: e.target.value })}
                  className="text-xs p-1 rounded border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-x2`} className="text-[11px] font-mono">
                  E₂ x (ls)
                </label>
                <input
                  id={`${id}-x2`}
                  type="number"
                  value={draft.customX2 ?? "10"}
                  onChange={(e) => setDraft({ ...draft, customX2: e.target.value })}
                  className="text-xs p-1 rounded border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
            </div>
          )}

          {error && (
            <p id={`${id}-error`} className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-medium transition"
            >
              Apply settings
            </button>
            <button
              type="button"
              onClick={share}
              className="text-xs px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition"
            >
              Copy settings link
            </button>
          </div>
          {linkNote && <p className="text-xs text-sky-700 dark:text-sky-300">{linkNote}</p>}
        </fieldset>
      </form>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RodStripPlot
          rodRestFrame={p.rodRestFrame}
          measuringFrame={p.measuringFrame}
          v={p.v}
          L0={p.L0}
          measuredLength={measuredL}
          isSimultaneous={!isNonSimultaneousRefusal}
          dxK={dxK}
          dtK={dtK}
          dxk={dxk}
          dtk={dtk}
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

      {/* Spacetime Event Interval Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 text-slate-800 dark:text-slate-100">
          Spacetime Event Coordinates &amp; Invariant Interval
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-1.5 px-2">Frame</th>
                <th className="py-1.5 px-2">Δt (s)</th>
                <th className="py-1.5 px-2">Δx (ls)</th>
                <th className="py-1.5 px-2">Simultaneity</th>
                <th className="py-1.5 px-2">s² = Δx² - c²Δt² (ls²)</th>
                <th className="py-1.5 px-2">Causal Order</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 dark:border-slate-800/50">
                <td className="py-1.5 px-2 font-medium">K (Platform)</td>
                <td className="py-1.5 px-2">{dtK.toFixed(3)}</td>
                <td className="py-1.5 px-2">{dxK.toFixed(3)}</td>
                <td className="py-1.5 px-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      dtK === 0
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                        : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    {dtK === 0 ? "Simultaneous" : dtK > 0 ? "Ordered (+)" : "Ordered (-)"}
                  </span>
                </td>
                <td className="py-1.5 px-2 font-bold">{s2.toFixed(3)}</td>
                <td className="py-1.5 px-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      s2 > 0
                        ? "bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300"
                        : s2 === 0
                          ? "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300"
                          : "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                    }`}
                  >
                    {s2 > 0 ? "Spacelike" : s2 === 0 ? "Lightlike" : "Timelike"}
                  </span>
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800/50">
                <td className="py-1.5 px-2 font-medium">k (Moving)</td>
                <td className="py-1.5 px-2">{dtk.toFixed(3)}</td>
                <td className="py-1.5 px-2">{dxk.toFixed(3)}</td>
                <td className="py-1.5 px-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      Math.abs(dtk) < 1e-10
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                        : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    {Math.abs(dtk) < 1e-10
                      ? "Simultaneous"
                      : dtk > 0
                        ? "Ordered (+)"
                        : "Ordered (-)"}
                  </span>
                </td>
                <td className="py-1.5 px-2 font-bold">{s2.toFixed(3)}</td>
                <td className="py-1.5 px-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      s2 > 0
                        ? "bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300"
                        : s2 === 0
                          ? "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300"
                          : "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                    }`}
                  >
                    {s2 > 0 ? "Spacelike" : s2 === 0 ? "Lightlike" : "Timelike"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Accepted Results Telemetry Table */}
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4"
        data-view-id="sr-03-data-table"
      >
        <h3 className="text-sm font-semibold mb-3 text-slate-800 dark:text-slate-100">
          Accepted Laboratory Telemetry Snapshot
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-1.5 px-2">Quantity ID</th>
                <th className="py-1.5 px-2">Status</th>
                <th className="py-1.5 px-2">Value / Result</th>
                <th className="py-1.5 px-2">Unit</th>
                <th className="py-1.5 px-2">Owner ID</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.outputs.map((out) => (
                <tr
                  key={out.quantityId}
                  className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  data-quantity-id={out.quantityId}
                >
                  <td className="py-1.5 px-2 font-medium">{out.quantityId}</td>
                  <td className="py-1.5 px-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        out.status === "value"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                          : out.status === "not-applicable"
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                            : "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                      }`}
                    >
                      {out.status}
                    </span>
                  </td>
                  <td className="py-1.5 px-2">
                    {out.status === "value"
                      ? typeof out.value === "number"
                        ? Math.abs(out.value) > 1e4 ||
                          (Math.abs(out.value) < 1e-3 && out.value !== 0)
                          ? out.value.toExponential(4)
                          : out.value.toFixed(4)
                        : String(out.value)
                      : "reason" in out
                        ? String(out.reason)
                        : "Out of domain"}
                  </td>
                  <td className="py-1.5 px-2 text-slate-500">{out.unit}</td>
                  <td className="py-1.5 px-2 text-slate-400 text-[10px]">{out.ownerId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Epistemic Limits (Not Modeled) */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2 text-slate-800 dark:text-slate-100">
          Limits of this Kinematic Reference Model (Not Modeled)
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
          This reference owner implements exact special-relativistic coordinate transformations,
          coordinate length measurements, and invariant spacetime intervals between inertial
          reference frames. The following physical regimes require general relativity, dynamical
          stress mechanics, or optical ray tracing and are explicitly <strong>not modeled</strong>:
        </p>
        <ul className="text-xs text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
          <li>
            Optical camera image appearance (Terrell-Penrose rotation and light-travel-time
            distortion), which differs from coordinate measurement at a single instant.
          </li>
          <li>Accelerating reference frames, Rindler horizons, or Thomas precession.</li>
          <li>
            Internal stress, elasticity, Born rigidity breakdown, or relativistic wave propagation
            during rod acceleration.
          </li>
          <li>Gravitational time dilation or spacetime curvature (General Relativity).</li>
          <li>Quantum uncertainty or field fluctuations at Planck-scale event intervals.</li>
          <li>Superluminal observers (|v| &ge; c) or tachyonic coordinate frames.</li>
        </ul>
      </div>

      <ShowTheCode listings={[]} />
    </section>
  );
}
