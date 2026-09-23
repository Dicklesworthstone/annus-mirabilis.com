"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createLq01BrowserChannel } from "../../experiments/lq01/browser.ts";
import { fromLq01Draft, type Lq01Draft, toLq01Draft } from "../../experiments/lq01/controls.ts";
import {
  LQ01_MODEL,
  LQ01_PRESETS,
  LQ01_PROMPTS,
  type Lq01Parameters,
} from "../../experiments/lq01/definition.ts";
import { decodeLq01Settings, encodeLq01Settings } from "../../experiments/lq01/permalink.ts";
import { createLq01Session, type PreparedLq01Example } from "../../experiments/lq01/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import { array, identity, result, scalar } from "./presentation.ts";
import { Sci } from "./Sci.tsx";
import { ShowTheCode } from "./ShowTheCode.tsx";
import { SliderField } from "./SliderField.tsx";
import { InterferencePlot, SpreadingPlot, WavefrontPlot } from "./WaveDescriptionPlots.tsx";
import "./waveDescriptionLab.css";

export type WaveDescriptionLabProps = Readonly<{
  example: PreparedLq01Example;
  title?: string;
}>;

type Mode = Lq01Parameters["mode"];

/** What each preset does, in the reader's words. The ids and parameters stay in definition.ts. */
const PRESET_LABELS: Readonly<Record<keyof typeof LQ01_PRESETS, string>> = {
  "equal-amplitudes": "Both waves equal and in step",
  "phase-shifted": "Delay one wave by half a wave",
  "unequal-amplitudes": "Make one wave half as strong",
  "instantaneous-snapshot": "Freeze a single instant",
  "inverse-square-spreading": "One source, 1 W, seen from 1 m",
};

const PRESETS_BY_MODE: Readonly<Record<Mode, readonly (keyof typeof LQ01_PRESETS)[]>> = {
  interference: [
    "equal-amplitudes",
    "phase-shifted",
    "unequal-amplitudes",
    "instantaneous-snapshot",
  ],
  spreading: ["inverse-square-spreading"],
};

/**
 * The rows of the values table, per view, with the words a reader sees. Intensities are in
 * units of one wave of amplitude 1 on its own, which is how the model normalises them.
 */
const VALUE_ROWS: Readonly<Record<Mode, readonly { id: string; label: string; unit: string }[]>> = {
  interference: [
    { id: "centerIntensity", label: "Intensity at the centre, averaged", unit: "" },
    {
      id: "instantaneousCenterIntensity",
      label: "Intensity at the centre, this instant",
      unit: "",
    },
    { id: "selectedPositionIntensity", label: "Intensity at the probe", unit: "" },
    { id: "pathDifference", label: "Path difference at the probe", unit: "λ" },
    { id: "fringeVisibility", label: "Fringe visibility (1 is full contrast)", unit: "" },
    { id: "fringeSpacing", label: "Distance between bright fringes", unit: "λ" },
    { id: "screenIntensity", label: "Intensity across the screen", unit: "" },
  ],
  spreading: [
    { id: "pointSourceIntensity", label: "Intensity at distance r", unit: "W/m²" },
    { id: "shellPower", label: "Power through the whole sphere of radius r", unit: "W" },
    { id: "smallAperturePower", label: "Power through a 1 cm² window, I × area", unit: "W" },
    { id: "exactDiskPower", label: "Power through a 1 cm² disc, exact", unit: "W" },
    { id: "relativeDifference", label: "Relative difference of the two", unit: "" },
  ],
};

function formatValue(value: number) {
  if (value !== 0 && (Math.abs(value) >= 1e4 || Math.abs(value) < 1e-3)) {
    return <Sci value={value} digits={3} />;
  }
  return String(Number(value.toPrecision(4)));
}

function ValueCell({ snapshot, id }: { snapshot: AcceptedSnapshot; id: string }) {
  const out = snapshot.outputs.find((o) => o.quantityId === id);
  if (!out) return <>Not reported</>;
  if (out.status !== "value") {
    return <>{"reason" in out ? String(out.reason) : "Outside the model's domain"}</>;
  }
  if (typeof out.value === "number") return formatValue(out.value);
  return <>A curve of {out.value.length} points, drawn above</>;
}

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

  /** Apply the whole draft with one field changed; a typed value that does not parse is named. */
  function commit(key: keyof Lq01Draft, value: string) {
    const next = { ...draft, [key]: value } as Lq01Draft;
    setDraft(next);
    try {
      apply(fromLq01Draft(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the entered settings.");
    }
  }

  /** A one-tap change to the accepted settings, kept in step with the typed fields. */
  function applyChange(change: Partial<Lq01Parameters>) {
    const next = { ...p, ...change };
    setDraft(toLq01Draft(next));
    apply(next);
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
  const pathDifference = scalar(snapshot, "pathDifference");
  const selectedIntensity = scalar(snapshot, "selectedPositionIntensity");
  const screenProfile = array(snapshot, "screenIntensity").copy();

  const interference = p.mode === "interference";
  const prompt = interference ? LQ01_PROMPTS["phase-shift"] : LQ01_PROMPTS["inverse-square"];
  const chosen = selectedCandidates[prompt.id];
  const phaseReadout = `${(p.delta / Math.PI).toFixed(2)}π rad, ${(p.delta * (180 / Math.PI)).toFixed(0)}°`;

  return (
    <section
      className="laboratory lq01"
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
      <header className="lab-heading">
        <p className="eyebrow">An executable model</p>
        <h2 id={`${id}-title`}>{title}</h2>
        <span className="badge">{LQ01_MODEL.label}</span>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Its graph, values, model assumptions and explanations remain available; changing the
          settings requires JavaScript.
        </p>
      </noscript>

      <div className="lab-columns">
        <form
          onSubmit={submit}
          noValidate
          aria-label="Wave description laboratory settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset disabled={!ready}>
            <legend>What to look at</legend>
            <div className="actions lq01-view">
              <button
                type="button"
                aria-pressed={interference}
                className={interference ? "primary" : "secondary"}
                onClick={() => applyChange({ mode: "interference" })}
              >
                Two sources meeting on a screen
              </button>
              <button
                type="button"
                aria-pressed={!interference}
                className={interference ? "secondary" : "primary"}
                onClick={() => applyChange({ mode: "spreading" })}
              >
                One source, its energy spreading out
              </button>
            </div>

            <details className="lab-predict">
              <summary>Predict first</summary>
              <fieldset>
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
                      <strong>{c.label}.</strong> {c.description}.
                    </span>
                  </label>
                ))}
              </fieldset>
              {chosen && (
                <div className="lab-predict-reveal">
                  {interference ? (
                    <p>
                      The model says it drops to zero. Two equal waves half a wave apart cancel at
                      the centre, while in step they give four times one wave alone.
                    </p>
                  ) : (
                    <p>
                      The model says it drops to a quarter. The same power spreads over a sphere of
                      area 4πr², and doubling r makes that area four times larger.
                    </p>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      interference ? applyChange({ delta: Math.PI }) : applyChange({ r: 2 * p.r })
                    }
                  >
                    {interference ? "Delay one wave by half a wave" : "Double the distance"}
                  </button>
                </div>
              )}
            </details>

            {interference ? (
              <>
                <SliderField
                  id={`${id}-delta`}
                  label="Phase difference δ between the waves"
                  unit="rad"
                  min={0}
                  max={Math.PI * 2}
                  step={0.05}
                  value={draft.delta}
                  readout={phaseReadout}
                  onDraft={(v) => setDraft({ ...draft, delta: v })}
                  onCommit={(v) => commit("delta", v)}
                />
                <fieldset className="lab-choice">
                  <legend>What the detector records</legend>
                  <div className="actions">
                    <button
                      type="button"
                      aria-pressed={p.readout === "time-average"}
                      className={p.readout === "time-average" ? "primary" : "secondary"}
                      onClick={() => applyChange({ readout: "time-average" })}
                    >
                      An average over many cycles
                    </button>
                    <button
                      type="button"
                      aria-pressed={p.readout === "instantaneous"}
                      className={p.readout === "instantaneous" ? "primary" : "secondary"}
                      onClick={() => applyChange({ readout: "instantaneous" })}
                    >
                      One instant
                    </button>
                  </div>
                </fieldset>
              </>
            ) : (
              <>
                <SliderField
                  id={`${id}-radius`}
                  label="Distance from the source r"
                  unit="m"
                  min={0.2}
                  max={10}
                  step={0.1}
                  value={draft.r}
                  onDraft={(v) => setDraft({ ...draft, r: v })}
                  onCommit={(v) => commit("r", v)}
                />
                <div className="actions lq01-quick">
                  {[1, 2, 4].map((rad) => (
                    <button
                      key={rad}
                      type="button"
                      className="secondary"
                      aria-pressed={p.r === rad}
                      onClick={() => applyChange({ r: rad })}
                    >
                      r = {rad} m
                    </button>
                  ))}
                </div>
              </>
            )}

            <fieldset className="lab-choice">
              <legend>Try</legend>
              <div className="actions lq01-presets">
                {PRESETS_BY_MODE[p.mode].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="secondary"
                    onClick={() => preset(LQ01_PRESETS[key].parameters)}
                  >
                    {PRESET_LABELS[key]}
                  </button>
                ))}
              </div>
            </fieldset>

            <ExperimentSettings
              contents={
                interference ? "amplitudes, source spacing, probe position" : "source power"
              }
            >
              {interference ? (
                <>
                  <SliderField
                    id={`${id}-a1`}
                    label="Amplitude of wave 1, A₁"
                    unit="wave 1 alone = 1"
                    min={0}
                    max={2}
                    step={0.05}
                    value={draft.A1}
                    onDraft={(v) => setDraft({ ...draft, A1: v })}
                    onCommit={(v) => commit("A1", v)}
                  />
                  <SliderField
                    id={`${id}-a2`}
                    label="Amplitude of wave 2, A₂"
                    unit="wave 1 alone = 1"
                    min={0}
                    max={2}
                    step={0.05}
                    value={draft.A2}
                    onDraft={(v) => setDraft({ ...draft, A2: v })}
                    onCommit={(v) => commit("A2", v)}
                  />
                  <SliderField
                    id={`${id}-sep`}
                    label="Source separation d"
                    unit="in wavelengths"
                    min={0.5}
                    max={10}
                    step={0.2}
                    value={draft.separation}
                    onDraft={(v) => setDraft({ ...draft, separation: v })}
                    onCommit={(v) => commit("separation", v)}
                  />
                  <fieldset className="lab-choice">
                    <legend>Probe position on the screen</legend>
                    <div className="actions">
                      {(
                        [
                          ["center", "Centre"],
                          ["first-min", "First dark fringe"],
                          ["first-max", "First bright fringe"],
                        ] as const
                      ).map(([pos, label]) => (
                        <button
                          key={pos}
                          type="button"
                          aria-pressed={p.screenPosition === pos}
                          className={p.screenPosition === pos ? "primary" : "secondary"}
                          onClick={() => applyChange({ screenPosition: pos })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </>
              ) : (
                <SliderField
                  id={`${id}-power`}
                  label="Source power P"
                  unit="W"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={draft.P}
                  onDraft={(v) => setDraft({ ...draft, P: v })}
                  onCommit={(v) => commit("P", v)}
                />
              )}
              <div className="actions">
                <button type="submit">Apply settings</button>
                <button type="button" onClick={share} className="secondary">
                  Copy settings link
                </button>
              </div>
            </ExperimentSettings>

            {error && (
              <p id={`${id}-error`} role="alert" className="notice error">
                {error}
              </p>
            )}
            {linkNote && <p className="notice">{linkNote}</p>}
          </fieldset>
        </form>

        <div className="lab-results">
          {interference ? (
            <div className="lq01-plots">
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
                delta={p.delta}
                centerIntensity={centerIntensity}
              />
            </div>
          ) : (
            <div className="lq01-plots lq01-plots-single">
              <SpreadingPlot
                power={p.P}
                radius={p.r}
                intensity={pointSourceIntensity}
                shellPower={shellPower}
              />
            </div>
          )}
        </div>
      </div>

      <div data-view-id="lq-01-data-table" className="lab-values">
        <h3>Values at these settings</h3>
        {interference && (
          <p className="fine">
            Intensities are given in units of one wave of amplitude 1 on its own.
          </p>
        )}
        <section className="table-scroll" aria-label="Values at these settings">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {VALUE_ROWS[p.mode]
                // Under the instant readout the centre row is already this instant's value, so the
                // separate instant row would repeat it; and the centre row is not an average then.
                .filter(
                  (row) =>
                    !(p.readout === "instantaneous" && row.id === "instantaneousCenterIntensity"),
                )
                .map((row) => (
                  <tr key={row.id} data-quantity-id={row.id}>
                    <th scope="row">
                      {row.id === "centerIntensity" && p.readout === "instantaneous"
                        ? "Intensity at the centre, this instant"
                        : row.label}
                    </th>
                    <td data-output={row.id}>
                      <ValueCell snapshot={snapshot} id={row.id} />
                      {row.unit && ` ${row.unit}`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="lab-bottom">
        <div className="not-modeled">
          <h3>What this model leaves out</h3>
          <p>It adds continuous scalar waves and spreads energy over spheres. It does not model:</p>
          <ul>
            <li>polarization, or the vector components of the electromagnetic field;</li>
            <li>photon statistics, antibunching, or any quantum optics;</li>
            <li>absorption, emission, or detection by matter;</li>
            <li>light that is not monochromatic, or that has a finite coherence length;</li>
            <li>diffraction beyond the idealised pair of coherent point sources;</li>
            <li>
              an absolute intensity scale, unless a power and a detector geometry are declared.
            </li>
          </ul>
        </div>
      </div>

      <ShowTheCode listings={[]} />
    </section>
  );
}
