"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import {
  LQ08_CAPTION,
  LQ08_HISTORICAL_CHECK,
  LQ08_NOT_MODELED,
  LQ08_OUTPUTS,
  LQ08_PRESETS,
} from "../../../experiments/lq08/definition.ts";
import type { MillikanOverlayResult } from "../../../experiments/lq08/millikan.ts";
import { lq08RangeSentence } from "../../../experiments/lq08/parameters.ts";
import { createLq08Session, type PreparedLq08Example } from "../../../experiments/lq08/session.ts";
import { LQ08_TAPE } from "../../../experiments/lq08/tape.ts";
import { LabTapeLink, useLabTapeLink } from "../../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { PREDICT_PROMPTS } from "../../../generated/predict-prompts.ts";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { KEPT_RESULT } from "../keptResult.ts";
import { PredictGatePanels, usePredictGate, withPredictions } from "../PredictGate.tsx";
import { fixed, identity } from "../presentation.ts";
import { Sci } from "../Sci.tsx";
import { SliderField } from "../SliderField.tsx";
import { withScripts } from "../subscripts.tsx";
import { MillikanFigure6Panel } from "./MillikanFigure6Panel.tsx";
import {
  CurrentVoltagePlot,
  EnergyLadderPlot,
  StoppingPotentialPlot,
} from "./PhotoelectricPlot.tsx";
import "./photoelectricLab.css";

export type PhotoelectricLabProps = Readonly<{
  example?: PreparedLq08Example | undefined;
  /** Millikan's 1916 points, or why they are withheld: built on the server from the record. */
  millikan?: MillikanOverlayResult | undefined;
  /** False for the optional second laboratory, so the page carries the caption readings once. */
  readings?: boolean;
  /**
   * Whether this laboratory restores a shared ?tape= link and offers one. The optional second
   * laboratory is independent of the link, so it does neither.
   */
  linked?: boolean;
  /**
   * Whether this laboratory asks its prompts before showing what they ask about. The optional
   * second laboratory is opened for a comparison, after the first has asked, so it does not.
   */
  predict?: boolean;
  /**
   * A session owned by the component that embeds the lab, so that something beside it reads the
   * same accepted snapshot (the light-quanta journey's check against the world). Omitted, the lab
   * owns its own, as on /lab/lq-08/.
   */
  session?: ReturnType<typeof createLq08Session> | undefined;
}>;

// The three prompts come from the manifest, content/experiments/lq-08.yaml, through the generated
// module; this file kept its own copy of them until 2026-09-24.
const LQ08_PROMPTS = PREDICT_PROMPTS["lq-08"] ?? [];
const NO_PROMPTS: typeof LQ08_PROMPTS = [];

/** Presets, in the order a reader meets the argument, named for what they set up. */
const PRESET_ORDER = [
  ["intensityProbe", "Green light, 600 THz, on a 2.0 eV metal"],
  ["subThreshold", "Red light, 450 THz, below the threshold"],
  ["twoMetals", "A metal with a 3.0 eV work function"],
  ["historicalCheck", "Einstein’s §8 check: 1.03 × 10¹⁵ Hz, no escape work"],
] as const satisfies readonly (readonly [keyof typeof LQ08_PRESETS, string])[];

type FieldKey =
  | "incidentPower"
  | "frequency"
  | "workFunction"
  | "quantumEfficiency"
  | "collectorPotential";

/** Display units for the typed fields: the value shown is the SI value divided by `scale`. */
const FIELDS: Readonly<Record<FieldKey, { label: string; scale: number; digits: number }>> = {
  incidentPower: { label: "Lamp power", scale: 1e-3, digits: 3 },
  frequency: { label: "Frequency ν", scale: 1e12, digits: 1 },
  workFunction: { label: "Work function Φ", scale: 1, digits: 2 },
  quantumEfficiency: { label: "Quantum efficiency", scale: 1, digits: 3 },
  collectorPotential: { label: "Collector potential", scale: 1, digits: 2 },
};

type Lq08Params = Readonly<Record<FieldKey, number>>;

function shown(key: FieldKey, params: Lq08Params): string {
  const field = FIELDS[key];
  return String(Number((params[key] / field.scale).toFixed(field.digits)));
}

/** The values table: each output in the reader's words, with the unit it is shown in. */
const VALUE_ROWS: readonly {
  id: string;
  label: string;
  unit: string;
  scale?: number;
}[] = [
  { id: "quantumEnergy", label: "Energy of one quantum, hν", unit: "eV", scale: 1.602176634e-19 },
  { id: "thresholdFrequency", label: "Threshold frequency, Φ/h", unit: "THz", scale: 1e12 },
  {
    id: "maxKineticEnergy",
    label: "Largest electron energy, hν − Φ",
    unit: "eV",
    scale: 1.602176634e-19,
  },
  { id: "stoppingPotentialMagnitude", label: "Stopping potential", unit: "V" },
  { id: "quantumRate", label: "Quanta arriving each second", unit: "per second" },
  { id: "emissionRate", label: "Electrons freed each second", unit: "per second" },
  { id: "photocurrent", label: "Current at this collector potential", unit: "μA", scale: 1e-6 },
];

function ValueCell({
  out,
  unit,
  scale = 1,
}: {
  out: PublishedResult | undefined;
  unit: string;
  scale?: number | undefined;
}) {
  if (!out) return <>Not reported</>;
  if (out.status === "value" && typeof out.value === "number") {
    const v = out.value / scale;
    const text =
      v !== 0 && (Math.abs(v) >= 1e4 || Math.abs(v) < 1e-3) ? (
        <Sci value={v} digits={3} />
      ) : (
        String(Number(v.toPrecision(4)))
      );
    return (
      <>
        {text} {unit}
      </>
    );
  }
  if (out.status === "not-applicable") return <>Not applicable: {out.reason}</>;
  if ("reason" in out) return <>{String(out.reason)}</>;
  return <>Not determined by these settings</>;
}

export function PhotoelectricLab({
  example,
  millikan,
  readings = true,
  linked = true,
  predict = true,
  session: sharedSession,
}: PhotoelectricLabProps) {
  const instanceId = useId();
  const session = useMemo(
    () => sharedSession ?? createLq08Session(instanceId, example),
    [sharedSession, instanceId, example],
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  // The drawings' frames and the controls come first; what the prompts ask about waits.
  const gate = usePredictGate("lq-08", predict ? LQ08_PROMPTS : NO_PROMPTS);
  const [showMillikan, setShowMillikan] = useState<boolean>(true);
  const [drafts, setDrafts] = useState<Partial<Record<FieldKey, string>>>({});
  const [error, setError] = useState("");

  const accepted = view.accepted;
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation; no example, no earned label.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      LQ08_OUTPUTS,
      example?.sourceDigest ?? "",
      accepted !== undefined && accepted === session.getServerSnapshot().accepted,
    ).label,
  );
  const params = (accepted?.parameters ??
    example?.parameters ?? {
      incidentPower: 0.001,
      frequency: 6.0e14,
      workFunction: 2.2,
      quantumEfficiency: 0.1,
      collectorPotential: 0.0,
    }) as Lq08Params;

  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(LQ08_TAPE, session, accepted?.parameters ?? null, linked);

  const outputs = accepted?.outputs ?? [];
  const find = (id: string) => outputs.find((o) => o.quantityId === id);
  const qEnergyRes = find("quantumEnergy");
  const tfRes = find("thresholdFrequency");
  const kMaxRes = find("maxKineticEnergy");
  const vsRes = find("stoppingPotentialMagnitude");
  const eRateRes = find("emissionRate");
  const pcRes = find("photocurrent");
  const qRateRes = find("quantumRate");

  const qEnergyEv =
    qEnergyRes?.status === "value" ? (qEnergyRes.value as number) / 1.602176634e-19 : 0;
  const kMaxEv = kMaxRes?.status === "value" ? (kMaxRes.value as number) / 1.602176634e-19 : null;
  const vsVal = vsRes?.status === "value" ? (vsRes.value as number) : null;
  const tfVal = tfRes?.status === "value" ? (tfRes.value as number) : 0;
  const eRateVal = eRateRes?.status === "value" ? (eRateRes.value as number) : 0;
  const pcVal = pcRes?.status === "value" ? (pcRes.value as number) : null;
  const qRateVal = qRateRes?.status === "value" ? (qRateRes.value as number) : null;
  // One sentence for the status line, from the accepted outputs: what a quantum carries against
  // the work function, and what that leaves the fastest electron.
  const frequencyThz = fixed(params.frequency / 1e12, 1);
  const quantum = `a quantum of ${frequencyThz} THz light carries ${fixed(qEnergyEv, 2)} eV`;
  const statusSummary =
    kMaxEv === null || vsVal === null
      ? `${quantum}, less than the ${fixed(params.workFunction, 2)} eV work function, so no electron is freed.`
      : kMaxEv === 0
        ? `${quantum}, exactly the work function, so an electron is freed with no energy to spare.`
        : `${quantum}, more than the ${fixed(params.workFunction, 2)} eV work function, so the fastest electrons leave with ${fixed(kMaxEv, 2)} eV and a stopping potential of ${fixed(vsVal, 2)} V holds them back.`;

  // Saturation current in microamperes: e * eRate * 1e6
  const iSatMicroAmps = eRateVal * 1.602176634e-19 * 1e6;
  const pcMicroAmps = pcVal !== null ? pcVal * 1e6 : null;

  function apply(patch: Partial<Lq08Params>) {
    const outcome = session.apply(patch);
    if (outcome.kind === "refused") {
      const req = outcome.refusal.details?.requirements;
      setError(typeof req === "string" ? req : outcome.refusal.message);
      return false;
    }
    setError("");
    return true;
  }

  function commit(key: FieldKey, text: string) {
    const n = Number(text.trim());
    if (text.trim() === "" || !Number.isFinite(n)) {
      setDrafts((d) => ({ ...d, [key]: text }));
      setError(`${FIELDS[key].label}: enter a number.`);
      return;
    }
    const stored = n * FIELDS[key].scale;
    if (!Number.isFinite(stored)) {
      // 1e300 THz is a number, but not one in hertz: say the range rather than "enter a number".
      setDrafts((d) => ({ ...d, [key]: text }));
      setError(lq08RangeSentence(key));
      return;
    }
    if (apply({ [key]: stored })) {
      setDrafts((d) => {
        const { [key]: _done, ...rest } = d;
        return rest;
      });
    } else {
      setDrafts((d) => ({ ...d, [key]: text }));
    }
  }

  function field(key: FieldKey) {
    return {
      id: `${instanceId}-${key}`,
      value: drafts[key] ?? shown(key, params),
      onDraft: (v: string) => setDrafts((d) => ({ ...d, [key]: v })),
      onCommit: (v: string) => commit(key, v),
    };
  }

  function preset(key: keyof typeof LQ08_PRESETS) {
    setDrafts({});
    apply(LQ08_PRESETS[key].parameters);
  }

  return (
    <section
      className="laboratory lq08"
      data-testid="photoelectric-lab"
      data-instrument-id="lq-08"
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "stoppingPotentialMagnitude")}
      {...(accepted ? identity(accepted) : {})}
    >
      <header className="lab-heading">
        <p className="eyebrow">The photoelectric apparatus</p>
        <h2>Photoelectric apparatus laboratory</h2>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${LQ08_NOT_MODELED.join("; ")}.` })}
        />
      </div>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built,
          and its values and explanations remain available. The controls need JavaScript to respond.
        </p>
      </noscript>

      <div className="lab-columns">
        <div>
          <PredictGatePanels gate={gate} />

          <SliderField
            {...field("frequency")}
            label={FIELDS.frequency.label}
            unit="THz"
            min={300}
            max={1200}
            step={5}
            readout={`${(params.frequency / 1e12).toFixed(1)} THz: one quantum carries hν = ${qEnergyEv.toFixed(2)} eV`}
          />
          <SliderField
            {...field("incidentPower")}
            label={FIELDS.incidentPower.label}
            unit="mW"
            min={0.1}
            max={10}
            step={0.1}
            readout={`${(params.incidentPower * 1e3).toFixed(2)} mW`}
          />
          {qRateVal !== null && (
            <p className="fine lab-slider-readout" {...gate.response}>
              <Sci value={qRateVal} digits={3} /> quanta arrive each second.
            </p>
          )}

          <fieldset className="lab-choice">
            <legend>Try</legend>
            <div className="actions">
              {PRESET_ORDER.map(([key, label]) => (
                <button key={key} type="button" className="secondary" onClick={() => preset(key)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <ExperimentSettings
            contents={`work function, quantum efficiency, collector potential${millikan?.kind === "plottable" ? ", Millikan’s 1916 data" : ""}`}
          >
            <SliderField
              {...field("workFunction")}
              label={FIELDS.workFunction.label}
              unit="eV"
              min={0}
              max={5.5}
              step={0.05}
              readout={`${params.workFunction.toFixed(2)} eV, a hypothetical metal unless a preset names one`}
            />
            <SliderField
              {...field("quantumEfficiency")}
              label={FIELDS.quantumEfficiency.label}
              unit="fraction of absorbed quanta that free an electron"
              min={0.01}
              max={1}
              step={0.01}
            />
            <SliderField
              {...field("collectorPotential")}
              label={FIELDS.collectorPotential.label}
              unit="V"
              min={-3}
              max={3}
              step={0.05}
            />
            {millikan?.kind === "plottable" && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={showMillikan}
                  onChange={(e) => setShowMillikan(e.target.checked)}
                />
                Show Millikan’s 1916 sodium measurements beside the stopping-potential plot
              </label>
            )}
          </ExperimentSettings>

          {error && (
            <p role="alert" className="notice error">
              {error} {KEPT_RESULT}
            </p>
          )}
          <AcceptedStatus
            worked={accepted === undefined || accepted === session.getServerSnapshot().accepted}
            summary={statusSummary}
            response={gate.response}
          />
          {linked && <LabTapeLink link={withPredictions(tapeLink, gate)} />}
        </div>

        <div className="lab-results">
          <div className="lq08-plots">
            <EnergyLadderPlot
              frequency={params.frequency}
              workFunction={params.workFunction}
              quantumEnergyEv={qEnergyEv}
              kMaxEv={kMaxEv}
              thresholdFrequency={tfVal}
              response={gate.response}
            />
            <StoppingPotentialPlot
              currentFrequency={params.frequency}
              currentWorkFunction={params.workFunction}
              currentStoppingPotential={vsVal}
              millikanData={millikan}
              response={gate.response}
            />
            {millikan?.kind === "plottable" && showMillikan && (
              <MillikanFigure6Panel data={millikan} />
            )}
            <CurrentVoltagePlot
              collectorPotential={params.collectorPotential}
              stoppingPotential={vsVal}
              saturationCurrentMicroAmps={iSatMicroAmps}
              currentAtOperatingPoint={pcMicroAmps}
              response={gate.response}
            />
          </div>
        </div>
      </div>

      <div className="lab-values" {...gate.response}>
        <h3>Values at these settings</h3>
        <section className="table-scroll" aria-label="Values at these settings">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {VALUE_ROWS.map((row) => (
                <tr key={row.id} data-quantity-id={row.id}>
                  <th scope="row">{row.label}</th>
                  <td data-output={row.id}>
                    <ValueCell out={find(row.id)} unit={row.unit} scale={row.scale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      {readings && (
        <>
          <p data-detail="0">{withScripts(LQ08_CAPTION.r0)}</p>
          <p data-detail="1">{withScripts(LQ08_CAPTION.r1)}</p>
          <p data-detail="2" hidden>
            {withScripts(LQ08_CAPTION.r2)}
          </p>
          <p data-detail="3" hidden>
            {withScripts(LQ08_CAPTION.r3)}
          </p>
        </>
      )}

      <div className="lab-bottom">
        <div className="lq08-historical">
          <h3>Einstein’s 1905 §8 check, by order of magnitude</h3>
          <p>
            <strong>What was neglected:</strong> {LQ08_HISTORICAL_CHECK.neglectStatement}
          </p>
          <p>
            <strong>What it is not:</strong> {LQ08_HISTORICAL_CHECK.notNamedMetalStatement}
          </p>
          <p>
            <strong>As printed:</strong> Π = Rβν / E ={" "}
            {LQ08_HISTORICAL_CHECK.representationA.stoppingPotentialVolts.toFixed(2)} V, “
            {LQ08_HISTORICAL_CHECK.representationA.printedText}”. Slope{" "}
            <Sci value={LQ08_HISTORICAL_CHECK.representationA.slopeVsPerHz} digits={3} /> V·s,
            against a modern h/e of{" "}
            <Sci value={LQ08_HISTORICAL_CHECK.representationA.modernSlopeVsPerHz} digits={3} /> V·s.
          </p>
          <p>
            <strong>At these settings:</strong> ν = {(params.frequency / 1e12).toFixed(1)} THz gives
            hν = {fixed(qEnergyEv, 3)} eV; with the hypothetical Φ ={" "}
            {params.workFunction.toFixed(2)} eV the stopping potential is{" "}
            {vsVal === null ? "not defined, since no electron escapes" : `${fixed(vsVal, 3)} V`}.
          </p>
        </div>
        <div className="not-modeled">
          <h3>What this model leaves out</h3>
          <p>
            It follows Einstein’s 1905 rule that one absorbed quantum gives its energy to one
            electron, which spends Φ escaping. It does not model:
          </p>
          <ul>
            {LQ08_NOT_MODELED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function PhotoelectricComparison({
  example,
  millikan,
}: {
  example?: PreparedLq08Example;
  millikan?: MillikanOverlayResult;
}) {
  const [second, setSecond] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <>
      <PhotoelectricLab example={example} millikan={millikan} />
      <div
        className="comparison-toggle"
        style={{
          margin: "1.5rem 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <button
          type="button"
          className="button secondary"
          disabled={!ready}
          onClick={() => setSecond(!second)}
        >
          {second ? "Close the second laboratory" : "Open an independent second laboratory"}
        </button>
        <p className="fine" style={{ margin: 0 }}>
          Compare two setups side by side in your reading. Each laboratory has its own settings,
          stepwise state and accepted results.
        </p>
      </div>
      {second && (
        <PhotoelectricLab
          example={example}
          millikan={millikan}
          readings={false}
          linked={false}
          predict={false}
        />
      )}
    </>
  );
}
