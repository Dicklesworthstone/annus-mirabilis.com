"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ExecutionChrome } from "../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../experiments/labels/executionLabelFor.ts";
import { labelRootAttributes } from "../../experiments/labels/resultAttributes.ts";
import { createLq01BrowserChannel } from "../../experiments/lq01/browser.ts";
import { fromLq01Draft, type Lq01Draft, toLq01Draft } from "../../experiments/lq01/controls.ts";
import {
  LQ01_CAPTION,
  LQ01_OUTPUTS,
  LQ01_PRESETS,
  type Lq01Parameters,
} from "../../experiments/lq01/definition.ts";
import { LQ01_DRAFT_TAPE } from "../../experiments/lq01/draftTape.ts";
import { decodeLq01Settings } from "../../experiments/lq01/permalink.ts";
import { createLq01Session, type PreparedLq01Example } from "../../experiments/lq01/session.ts";
import { LabTapeLink, useDraftTapeLink } from "../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import { instrumentRootAttributes } from "../../experiments/store/identityAttributes.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import { AcceptedStatus } from "./AcceptedStatus.tsx";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import { KEPT_RESULT } from "./keptResult.ts";
import { PredictGatePanels, usePredictGate, withPredictions } from "./PredictGate.tsx";
import { array, identity, result, scalar, sentenceNumber } from "./presentation.ts";
import { Sci } from "./Sci.tsx";
import { SliderField } from "./SliderField.tsx";
import { withScripts } from "./subscripts.tsx";
import {
  InterferencePlot,
  phaseInDegrees,
  phaseInPi,
  SpreadingPlot,
  WavefrontPlot,
} from "./WaveDescriptionPlots.tsx";
import "./waveDescriptionLab.css";

export type WaveDescriptionLabProps = Readonly<{
  example: PreparedLq01Example;
  title?: string;
}>;

type Mode = Lq01Parameters["mode"];

// One prompt per view, as ME-03 does per mode: the phase prompt with the two sources, the distance
// prompt with the one.
const LQ01_PROMPTS_BY_MODE: Readonly<Record<Mode, (typeof PREDICT_PROMPTS)[string]>> = {
  interference: (PREDICT_PROMPTS["lq-01"] ?? []).filter(
    (p) => p.promptId === "lq-01-predict-phase-shift",
  ),
  spreading: (PREDICT_PROMPTS["lq-01"] ?? []).filter(
    (p) => p.promptId === "lq-01-predict-inverse-square",
  ),
};

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
  // A shared ?tape= link puts its settings in the form and starts nothing; Apply calculates them.
  const tapeLink = useDraftTapeLink(LQ01_DRAFT_TAPE, p, true, (settings) =>
    setDraft(toLq01Draft(settings as unknown as Lq01Parameters)),
  );

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
  // The drawings, axes and controls come first; the curve and the numbers they ask about wait.
  const gate = usePredictGate("lq-01", LQ01_PROMPTS_BY_MODE[p.mode]);
  const phaseDegrees = phaseInDegrees(p.delta);
  const phaseReadout = `${phaseInPi(p.delta)}π rad${phaseDegrees === null ? "" : `, ${phaseDegrees}°`}`;
  // One sentence for the status line, from the accepted outputs of the mode on screen.
  const statusSummary = interference
    ? `two waves of amplitude ${sentenceNumber(p.A1)} and ${sentenceNumber(p.A2)}, ${phaseDegrees === null ? `${phaseInPi(p.delta)}π rad` : `${phaseDegrees}°`} apart in phase: the centre of the screen has intensity ${sentenceNumber(centerIntensity)}, where one wave of amplitude 1 alone gives 1, and the fringes have visibility ${sentenceNumber(fringeVisibility)}.`
    : `a ${sentenceNumber(p.P)} W source spread over a sphere of radius ${sentenceNumber(p.r)} m gives ${sentenceNumber(pointSourceIntensity)} W/m², and the whole sphere still carries ${sentenceNumber(shellPower)} W.`;

  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      LQ01_OUTPUTS,
      example.sourceDigest,
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
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
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "centerIntensity")}
      data-source-digest={example.sourceDigest}
      data-result-status={primaryResult.status}
      {...(view.refusal ? { "data-refusal-code": view.refusal.code } : {})}
    >
      <header className="lab-heading">
        <p className="eyebrow">An executable model</p>
        <h2 id={`${id}-title`}>{title}</h2>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome state={executionKind} view={view} />
      </div>

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

            <PredictGatePanels gate={gate} />

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
              </div>
            </ExperimentSettings>

            {error && (
              <p id={`${id}-error`} role="alert" className="notice error">
                {error} {KEPT_RESULT}
              </p>
            )}
            {linkNote && <p className="notice">{linkNote}</p>}
          </fieldset>
        </form>
        <AcceptedStatus
          worked={snapshot === session.getServerSnapshot().accepted}
          summary={statusSummary}
          response={gate.response}
        />
        <LabTapeLink link={withPredictions(tapeLink, gate)} />

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
                response={gate.response}
              />
              <WavefrontPlot
                separation={p.separation}
                delta={p.delta}
                centerIntensity={centerIntensity}
                response={gate.response}
              />
            </div>
          ) : (
            <div className="lq01-plots lq01-plots-single">
              <SpreadingPlot
                power={p.P}
                radius={p.r}
                intensity={pointSourceIntensity}
                shellPower={shellPower}
                response={gate.response}
              />
            </div>
          )}
        </div>
      </div>

      <div data-view-id="lq-01-data-table" className="lab-values" {...gate.response}>
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

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(LQ01_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(LQ01_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(LQ01_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(LQ01_CAPTION.r3)}
      </p>

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
    </section>
  );
}
