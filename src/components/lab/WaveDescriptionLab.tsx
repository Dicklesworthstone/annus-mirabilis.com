"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createLq01BrowserChannel } from "../../experiments/lq01/browser.ts";
import { fromLq01Draft, toLq01Draft } from "../../experiments/lq01/controls.ts";
import {
  LQ01_MODEL,
  LQ01_PRESETS,
  LQ01_PROMPTS,
  type Lq01Parameters,
} from "../../experiments/lq01/definition.ts";
import { decodeLq01Settings, encodeLq01Settings } from "../../experiments/lq01/permalink.ts";
import { createLq01Session, type PreparedLq01Example } from "../../experiments/lq01/session.ts";
import { array, identity, result, scalar } from "./presentation.ts";
import { ShowTheCode } from "./ShowTheCode.tsx";
import { InterferencePlot, SpreadingPlot, WavefrontPlot } from "./WaveDescriptionPlots.tsx";

export type WaveDescriptionLabProps = Readonly<{
  example: PreparedLq01Example;
  title?: string;
}>;

export function WaveDescriptionLab({
  example,
  title = "Wave description and energy spreading laboratory",
}: WaveDescriptionLabProps) {
  const id = useId();
  const [session] = useState(() =>
    createLq01Session(`lq01-${id}`, example, createLq01BrowserChannel),
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
  const p = snapshot.parameters as unknown as Lq01Parameters;

  const [draft, setDraft] = useState(() => toLq01Draft(example.parameters));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [linkNote, setLinkNote] = useState("");

  // Predict mode state
  const [activePromptKey, setActivePromptKey] = useState<"phase-shift" | "inverse-square">(
    "phase-shift",
  );
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});

  useEffect(() => {
    setReady(true);
    const shared = decodeLq01Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toLq01Draft(shared.parameters));
      setLinkNote(
        "Shared settings are loaded. Choose Apply settings to calculate them; the worked example is still displayed.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
    return () => session.disconnect();
  }, [session]);

  function apply(parameters: Lq01Parameters) {
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
      apply(fromLq01Draft(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the entered settings.");
    }
  }

  function preset(parameters: Lq01Parameters) {
    setDraft(toLq01Draft(parameters));
    setError("");
    apply(parameters);
  }

  async function share() {
    const url = new URL(window.location.pathname, window.location.origin);
    url.search = encodeLq01Settings(session.acceptedParameters());
    try {
      await navigator.clipboard.writeText(url.href);
      setLinkNote("Link to the accepted settings copied.");
    } catch {
      setLinkNote("Copy the accepted-settings link from the field below.");
    }
  }

  const primaryResult = result(snapshot, "centerIntensity");
  const centerIntensity = scalar(snapshot, "centerIntensity");
  const fringeVisibility = scalar(snapshot, "fringeVisibility");
  const fringeSpacing = scalar(snapshot, "fringeSpacing");
  const pointSourceIntensity = scalar(snapshot, "pointSourceIntensity");
  const shellPower = scalar(snapshot, "shellPower");
  const smallAperturePower = scalar(snapshot, "smallAperturePower");
  const exactDiskPower = scalar(snapshot, "exactDiskPower");
  const pathDifference = scalar(snapshot, "pathDifference");
  const selectedIntensity = scalar(snapshot, "selectedPositionIntensity");
  const screenProfile = array(snapshot, "screenIntensity").copy();

  const currentPrompt = LQ01_PROMPTS[activePromptKey];

  return (
    <section
      className="laboratory flex flex-col gap-6 max-w-5xl mx-auto p-4"
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-01"
      data-testid="wave-description-lab"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input ?? 1}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
      data-result-status={primaryResult.status}
      {...(view.refusal ? { "data-refusal-code": view.refusal.code } : {})}
    >
      <header className="lab-heading border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow text-xs font-mono uppercase tracking-wider text-sky-700 dark:text-sky-300">
              LQ-01 · An executable model
            </p>
            <h2 id={`${id}-title`} className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
          </div>
          <span className="badge text-xs px-2.5 py-1 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-medium">
            {LQ01_MODEL.label}
          </span>
        </div>
      </header>

      <noscript>
        <p className="notice p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs rounded border border-amber-200 dark:border-amber-900">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Its graph, values, model assumptions and explanations remain available; changing the
          settings requires JavaScript.
        </p>
      </noscript>

      <p className="text-sm text-slate-700 dark:text-slate-300">
        In the introduction of his 1905 light paper, Einstein affirms that the wave theory has
        proven excellent for purely optical phenomena and will presumably never be replaced. Explore
        two-source wave interference, time-averaged versus instantaneous readouts, and spherical
        inverse-square energy spreading.
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
              onClick={() => setActivePromptKey("phase-shift")}
              className={`text-xs px-2.5 py-1 rounded transition ${
                activePromptKey === "phase-shift"
                  ? "bg-amber-600 text-white font-medium"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-amber-300 dark:border-amber-800"
              }`}
            >
              Phase Shift Interference
            </button>
            <button
              type="button"
              onClick={() => setActivePromptKey("inverse-square")}
              className={`text-xs px-2.5 py-1 rounded transition ${
                activePromptKey === "inverse-square"
                  ? "bg-amber-600 text-white font-medium"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-amber-300 dark:border-amber-800"
              }`}
            >
              Inverse-Square Spreading
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
              <span className="text-[10px] font-mono text-slate-400">{c.relation}</span>
            </label>
          ))}
        </div>

        {selectedCandidates[currentPrompt.id] && (
          <div className="text-xs p-3 rounded bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-amber-800 dark:text-amber-300">Model reveal: </span>
            {activePromptKey === "phase-shift" ? (
              <span>
                Equal waves shifted by half a wave (δ = π) cancel completely by destructive
                interference, dropping center intensity to <strong>0</strong>. Equal waves in phase
                (δ = 0) interfere constructively to yield 4 times single-wave intensity.
              </span>
            ) : (
              <span>
                Because radiant power spreads evenly over spherical area 4πr², doubling distance
                multiplies area by 4, reducing intensity to <strong>one quarter (1/4)</strong>.
              </span>
            )}
          </div>
        )}
      </section>

      {/* Presets Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Presets:</span>
        {Object.entries(LQ01_PRESETS).map(([key, item]) => (
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

      {/* Mode Switcher */}
      <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Display Mode:
        </span>
        <label className="text-xs flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name={`${id}-mode`}
            value="interference"
            checked={p.mode === "interference"}
            onChange={() => apply({ ...p, mode: "interference" })}
          />
          Two-Source Interference
        </label>
        <label className="text-xs flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name={`${id}-mode`}
            value="spreading"
            checked={p.mode === "spreading"}
            onChange={() => apply({ ...p, mode: "spreading" })}
          />
          Spherical Energy Spreading (Inverse-Square)
        </label>
      </div>

      {/* Controls Form */}
      <form
        onSubmit={submit}
        aria-label="Wave description laboratory settings"
        aria-describedby={error ? `${id}-error` : undefined}
        className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-lg border border-slate-200 dark:border-slate-800"
      >
        <fieldset disabled={!ready} className="flex flex-col gap-4">
          <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Interactive Model Controls
          </legend>

          {p.mode === "interference" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Amplitude 1 */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <label htmlFor={`${id}-a1`}>Amplitude A₁</label>
                  <span className="font-mono text-slate-500">{p.A1.toFixed(2)}</span>
                </div>
                <input
                  id={`${id}-a1-range`}
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={draft.A1}
                  onChange={(e) => {
                    const next = { ...draft, A1: e.target.value };
                    setDraft(next);
                    try {
                      apply(fromLq01Draft(next));
                    } catch {}
                  }}
                />
              </div>

              {/* Amplitude 2 */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <label htmlFor={`${id}-a2`}>Amplitude A₂</label>
                  <span className="font-mono text-slate-500">{p.A2.toFixed(2)}</span>
                </div>
                <input
                  id={`${id}-a2-range`}
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={draft.A2}
                  onChange={(e) => {
                    const next = { ...draft, A2: e.target.value };
                    setDraft(next);
                    try {
                      apply(fromLq01Draft(next));
                    } catch {}
                  }}
                />
              </div>

              {/* Relative Phase Delta */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <label htmlFor={`${id}-delta`}>Relative Phase δ</label>
                  <span className="font-mono text-slate-500">
                    {(p.delta / Math.PI).toFixed(2)} π rad ({(p.delta * (180 / Math.PI)).toFixed(0)}
                    °)
                  </span>
                </div>
                <input
                  id={`${id}-delta-range`}
                  type="range"
                  min="0"
                  max={Math.PI * 2}
                  step="0.05"
                  value={draft.delta}
                  onChange={(e) => {
                    const next = { ...draft, delta: e.target.value };
                    setDraft(next);
                    try {
                      apply(fromLq01Draft(next));
                    } catch {}
                  }}
                />
              </div>

              {/* Source Separation d */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <label htmlFor={`${id}-sep`}>Separation d (in λ)</label>
                  <span className="font-mono text-slate-500">{p.separation.toFixed(1)} λ</span>
                </div>
                <input
                  id={`${id}-sep-range`}
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.2"
                  value={draft.separation}
                  onChange={(e) => {
                    const next = { ...draft, separation: e.target.value };
                    setDraft(next);
                    try {
                      apply(fromLq01Draft(next));
                    } catch {}
                  }}
                />
              </div>

              {/* Readout Mode */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Readout Mode
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => apply({ ...p, readout: "time-average" })}
                    className={`text-xs px-2.5 py-1 rounded transition ${
                      p.readout === "time-average"
                        ? "bg-sky-600 text-white font-medium"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    Time-Averaged
                  </button>
                  <button
                    type="button"
                    onClick={() => apply({ ...p, readout: "instantaneous" })}
                    className={`text-xs px-2.5 py-1 rounded transition ${
                      p.readout === "instantaneous"
                        ? "bg-sky-600 text-white font-medium"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    Instantaneous Snapshot
                  </button>
                </div>
              </div>

              {/* Screen Position Selector */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Screen Probe Position
                </span>
                <div className="flex gap-2">
                  {(["center", "first-min", "first-max"] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => apply({ ...p, screenPosition: pos })}
                      className={`text-xs px-2 py-1 rounded transition ${
                        p.screenPosition === pos
                          ? "bg-rose-600 text-white font-medium"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {pos === "center" ? "Center" : pos === "first-min" ? "1st Min" : "1st Max"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Source Power P */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <label htmlFor={`${id}-power`}>Source Radiant Power P (W)</label>
                  <span className="font-mono text-slate-500">{p.P.toFixed(2)} W</span>
                </div>
                <input
                  id={`${id}-power-range`}
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={draft.P}
                  onChange={(e) => {
                    const next = { ...draft, P: e.target.value };
                    setDraft(next);
                    try {
                      apply(fromLq01Draft(next));
                    } catch {}
                  }}
                />
              </div>

              {/* Radius r */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <label htmlFor={`${id}-radius`}>Observation Radius r (m)</label>
                  <span className="font-mono text-slate-500">{p.r.toFixed(2)} m</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={`${id}-radius-range`}
                    type="range"
                    min="0.2"
                    max="10"
                    step="0.1"
                    value={draft.r}
                    onChange={(e) => {
                      const next = { ...draft, r: e.target.value };
                      setDraft(next);
                      try {
                        apply(fromLq01Draft(next));
                      } catch {}
                    }}
                    className="w-full"
                  />
                  <div className="flex gap-1 shrink-0">
                    {[1, 2, 4].map((rad) => (
                      <button
                        key={rad}
                        type="button"
                        onClick={() => apply({ ...p, r: rad })}
                        className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      >
                        {rad}m
                      </button>
                    ))}
                  </div>
                </div>
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
      {p.mode === "interference" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InterferencePlot
            screenIntensity={screenProfile}
            centerIntensity={centerIntensity}
            fringeVisibility={fringeVisibility}
            fringeSpacing={fringeSpacing}
            pathDifference={pathDifference}
            selectedIntensity={selectedIntensity}
            screenPosition={p.screenPosition}
            readout={p.readout}
            delta={p.delta}
          />
          <WavefrontPlot
            separation={p.separation}
            wavelength={p.wavelength}
            delta={p.delta}
            centerIntensity={centerIntensity}
          />
        </div>
      ) : (
        <SpreadingPlot
          power={p.P}
          radius={p.r}
          intensity={pointSourceIntensity}
          shellPower={shellPower}
          smallAperturePower={smallAperturePower}
          exactDiskPower={exactDiskPower}
        />
      )}

      {/* Accepted Results Telemetry Table */}
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4"
        data-view-id="lq-01-data-table"
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
                          : "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                      }`}
                    >
                      {out.status}
                    </span>
                  </td>
                  <td className="py-1.5 px-2">
                    {out.status === "value"
                      ? out.value instanceof Float64Array
                        ? `[Float64Array ${out.value.length} pts]`
                        : typeof out.value === "number"
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
          Limits of this Classical Wave Model (Not Modeled)
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
          This reference owner implements continuous classical wave optics and geometric energy
          spreading. The following physical regimes require vector electrodynamics, microscopic
          matter coupling, or quantum optics and are explicitly <strong>not modeled</strong>:
        </p>
        <ul className="text-xs text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
          <li>Polarization and vector electromagnetic field components.</li>
          <li>Photon statistics, photon anti-bunching, or quantum optics.</li>
          <li>Absorption, emission, or quantum detection by matter.</li>
          <li>Non-monochromatic or finite-coherence-length light sources.</li>
          <li>Diffraction effects beyond the coherent two-source idealization.</li>
          <li>
            An absolute physical intensity scale unless a radiant power and detector geometry are
            declared.
          </li>
        </ul>
      </div>

      <ShowTheCode listings={[]} />
    </section>
  );
}
