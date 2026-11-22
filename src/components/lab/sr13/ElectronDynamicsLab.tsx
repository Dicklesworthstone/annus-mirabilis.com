"use client";
import { type FormEvent, useEffect, useId, useState } from "react";
import { getKernelListingsForInstrument } from "../../../content/kernel/listings.ts";
import { readTypedNumber } from "../../../experiments/controls/typedNumber.ts";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { LabTapeLink, useLabTapeLink } from "../../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { statusMessage } from "../../../experiments/results/explanations.ts";
import { refusalSentence } from "../../../experiments/results/refusalSentence.ts";
import type { RequestRefusal } from "../../../experiments/results/refusals.ts";
import {
  SR13_CAPTION,
  SR13_DEFAULTS,
  SR13_NOT_MODELED,
  SR13_OUTPUTS,
  type Sr13Parameters,
} from "../../../experiments/sr13/definition.ts";
import { validateSr13Parameters } from "../../../experiments/sr13/parameters.ts";
import { createSr13Session, type PreparedSr13Example } from "../../../experiments/sr13/session.ts";
import { SR13_TAPE } from "../../../experiments/sr13/tape.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type {
  AcceptedSnapshot,
  PublishedResult,
} from "../../../experiments/store/instanceStore.ts";
import { createReaderCheckpointBinding } from "../../../experiments/store/readerCheckpoint.ts";
import { useRetainedSession } from "../../../experiments/store/retainedSession.tsx";
import { useInstrumentView } from "../../../experiments/store/useExperimentSnapshot.ts";
import { PREDICT_PROMPTS } from "../../../generated/predict-prompts.ts";
import { SR13_READER_WEAVE } from "../../../reader/weave/electronPassages.ts";
import { SessionResultWeave } from "../../../reader/weave/SessionResultWeave.tsx";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { KEPT_RESULT } from "../keptResult.ts";
import { LabMargin } from "../LabMargin.tsx";
import { PredictGatePanels, usePredictGate, withPredictions } from "../PredictGate.tsx";
import { display, fixed, identity, result, sentenceNumber } from "../presentation.ts";
import { ShowTheCode } from "../ShowTheCode.tsx";
import { withScripts } from "../subscripts.tsx";
import { WalkthroughControl } from "../WalkthroughControl.tsx";
import { ElectronDynamicsPlot } from "./ElectronDynamicsPlot.tsx";

function numericOf(item: PublishedResult | undefined): number | null {
  if (!item) return null;
  if (item.status === "value" && typeof item.value === "number") return item.value;
  return null;
}

function SnapshotReading({
  snapshot,
  quantityId,
  unit,
}: {
  snapshot: AcceptedSnapshot;
  quantityId: string;
  /** Printed after a number only: after a refusal's sentence it read "magnitude is zero. m". */
  unit?: string;
}) {
  const item = result(snapshot, quantityId);
  if (item.status === "value" && typeof item.value === "number") {
    return (
      <span data-quantity-id={quantityId}>
        {display(item.value)}
        {unit ? ` ${unit}` : ""}
      </span>
    );
  }
  if (item.status === "outside-domain" || item.status === "not-applicable") {
    return <span data-quantity-id={quantityId}>{item.reason}</span>;
  }
  return <span data-quantity-id={quantityId}>{statusMessage(item.status)}</span>;
}

// The manifest's prompts (scripts/generate-predict-prompts.mjs), one stable array for the gate.
const SR13_PROMPTS = PREDICT_PROMPTS["sr-13"] ?? [];

const NUMERIC_FIELDS = {
  initialSpeed: { label: "Initial speed β = v/c", min: -0.95, max: 0.95, step: "0.01" },
  initialDirectionDeg: {
    label: "Initial direction in the x–y plane (degrees)",
    min: 0,
    max: 360,
    step: "1",
  },
  integrationInterval: {
    label: "Trajectory duration (seconds)",
    min: 1e-13,
    max: 1e-6,
    step: "any",
  },
  electricFieldX: { label: "Electric field Ex (V/m)", min: -1e8, max: 1e8, step: "10000" },
  electricFieldY: { label: "Electric field Ey (V/m)", min: -1e8, max: 1e8, step: "10000" },
  electricFieldZ: { label: "Electric field Ez (V/m)", min: -1e8, max: 1e8, step: "10000" },
  magneticFieldX: { label: "Magnetic field Bx (Tesla)", min: -10, max: 10, step: "0.005" },
  magneticFieldY: { label: "Magnetic field By (Tesla)", min: -10, max: 10, step: "0.005" },
  magneticFieldZ: { label: "Magnetic field Bz (Tesla)", min: -10, max: 10, step: "0.005" },
  customCharge: { label: "Custom particle charge q (C)", min: -1e-6, max: 1e-6, step: "any" },
  customMass: { label: "Custom particle rest mass m (kg)", min: 1e-31, max: 1e-3, step: "any" },
} as const;
type NumericField = keyof typeof NUMERIC_FIELDS;
type Sr13Typed = Readonly<Record<NumericField, string>>;
// Keep the reader's text until Apply: a cleared number field must not silently become zero.
function typedFrom(p: Sr13Parameters): Sr13Typed {
  return Object.fromEntries(
    (Object.keys(NUMERIC_FIELDS) as NumericField[]).map((name) => [
      name,
      String(p[name] ?? SR13_DEFAULTS[name]),
    ]),
  ) as Sr13Typed;
}

function unavailableReason(snapshot: AcceptedSnapshot, quantityId: string): string {
  const item = result(snapshot, quantityId);
  return item.status === "outside-domain" || item.status === "not-applicable"
    ? item.reason
    : statusMessage(item.status);
}

export function ElectronDynamicsLab({
  instanceId,
  restoreFromLocation = true,
  example,
  title = "Dynamics of the slowly accelerated electron",
  highlightPaper = false,
}: {
  example: PreparedSr13Example;
  instanceId?: string | undefined;
  restoreFromLocation?: boolean | undefined;
  title?: string;
  highlightPaper?: boolean;
}) {
  const id = useId();
  const session = useRetainedSession(
    {
      experimentId: "sr-13",
      instanceId: instanceId ?? `sr13-${id}`,
      sourceDigest: example?.sourceDigest,
    },
    (retainedId) => createSr13Session(retainedId, example),
    createReaderCheckpointBinding(SR13_TAPE),
  );
  const view = useInstrumentView(session);
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(
    SR13_TAPE,
    session,
    session.acceptedParameters(),
    restoreFromLocation,
    /*
     * BOTH halves of the form, as this laboratory's own apply handler does. `typed` holds the TEXT
     * in the number inputs, so updating `draft` alone left a reader who opened a shared link
     * looking at the restored results beside the previous numbers -- and re-applying without
     * retyping would have sent the stale text back. SR-09 and SR-10 always called both.
     */
    (restored) => {
      setDraft({ ...restored });
      setTyped(typedFrom(restored));
    },
  );
  // Predict mode (am-inst-predict-mode-ti7m): the result waits for the reader's answer.
  const gate = usePredictGate("sr-13", SR13_PROMPTS);
  const snapshot = (view.accepted ?? session.getServerSnapshot().accepted) as AcceptedSnapshot;
  const p = snapshot.parameters as Sr13Parameters;
  const [draft, setDraft] = useState(() => ({ ...session.acceptedParameters() }));
  const [typed, setTyped] = useState<Sr13Typed>(() => typedFrom(session.acceptedParameters()));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  /**
   * The refusal OBJECT beside the sentence, so the chrome can mark the readouts stale (am-m79c).
   *
   * Every refusal this form raises has one: the session's and the validator's always did, and the
   * typed fields gained theirs when readTypedNumber began carrying a registered code. Before that a
   * reader who typed a non-numeric value was told why and was not told that the numbers beside the
   * message still belonged to the previous settings.
   */
  const [refusal, setRefusal] = useState<RequestRefusal | null>(null);
  function refuse(raised: RequestRefusal, sentence: string) {
    setError(sentence);
    setRefusal(raised);
  }
  function accept() {
    setError("");
    setRefusal(null);
  }

  useEffect(() => {
    setReady(true);
  }, []);

  function apply(parameters: Sr13Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      refuse(outcome.refusal, refusalSentence(outcome.refusal));
      return;
    }
    setDraft(parameters);
    setTyped(typedFrom(parameters));
    accept();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parameters = { ...draft };
    for (const name of Object.keys(NUMERIC_FIELDS) as NumericField[]) {
      if (draft.particle === "electron" && (name === "customCharge" || name === "customMass")) {
        continue;
      }
      const label = NUMERIC_FIELDS[name].label;
      const number = readTypedNumber(typed[name], label.charAt(0).toLowerCase() + label.slice(1));
      if (number.kind === "refused") return refuse(number.refusal, number.requirement);
      parameters[name] = number.value;
    }
    const checked = validateSr13Parameters(parameters);
    if (checked.kind !== "accepted") {
      refuse(checked.refusal, refusalSentence(checked.refusal));
      return;
    }
    apply(checked.data);
  }

  function numberField(name: NumericField, disabled = false) {
    const { label, min, max, step } = NUMERIC_FIELDS[name];
    return (
      <div className="input-field" key={name}>
        <label htmlFor={`${id}-${name}`}>{label}</label>
        <input
          id={`${id}-${name}`}
          type="number"
          name={name}
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={typed[name]}
          onChange={(event) => setTyped({ ...typed, [name]: event.currentTarget.value })}
        />
      </div>
    );
  }

  function preset(settings: Partial<Sr13Parameters>) {
    apply({
      ...SR13_DEFAULTS,
      forceConvention: p.forceConvention,
      massLanguage: p.massLanguage,
      ...settings,
    });
  }

  const beta = numericOf(result(snapshot, "speedRatio")) ?? draft.initialSpeed;
  const gammaVal = numericOf(result(snapshot, "lorentzFactor")) ?? 1;
  const longM = numericOf(result(snapshot, "longitudinalMass")) ?? 0;
  const transMComov = numericOf(result(snapshot, "transverseMassComoving")) ?? 0;
  const transMLab = numericOf(result(snapshot, "transverseMassLaboratory")) ?? 0;
  const keExact = numericOf(result(snapshot, "kineticEnergy")) ?? 0;
  const keNewt = numericOf(result(snapshot, "kineticEnergyNewtonian")) ?? 0;
  const potExact = numericOf(result(snapshot, "acceleratingPotential"));
  const potNewt = numericOf(result(snapshot, "acceleratingPotentialNewtonian"));
  const rm = numericOf(result(snapshot, "radiusCurvatureMagnetic"));
  const re = numericOf(result(snapshot, "radiusCurvatureElectric"));
  // The path the chamber draws: the same accepted snapshot as every number beside it. Looked up, not
  // required, so a snapshot prepared before the kernel published a path renders without one.
  const path = snapshot.outputs.find((o) => o.quantityId === "trajectoryPositions");
  const trajectory = path?.status === "value" && typeof path.value !== "number" ? path.value : null;
  const particleName = p.particle === "electron" ? "an electron" : "the custom particle";
  const statusSummary =
    `${particleName} initially at ${fixed(beta, 3)}c, γ = ${fixed(gammaVal, 4)}, carries ${sentenceNumber(keExact)} J of kinetic energy where Newton's formula gives ${sentenceNumber(keNewt)} J. ` +
    (potExact !== null && potNewt !== null
      ? `Reaching this speed from rest takes ${sentenceNumber(potExact)} V, against ${sentenceNumber(potNewt)} V by Newton's formula.`
      : unavailableReason(snapshot, "acceleratingPotential"));

  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      SR13_OUTPUTS,
      example.sourceDigest,
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-13"
      {...identity(snapshot)}
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "longitudinalMass")}
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">Electron dynamics and force conventions</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          validationRefusal={refusal}
          modelNote={modelNoteFromView(view, { notModeled: `${SR13_NOT_MODELED.join("; ")}.` })}
        />
      </div>
      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Kinetic energy, accelerating potential, mass coefficients, and deflection curves remain
          available; changing the parameters requires JavaScript.
        </p>
      </noscript>
      <PredictGatePanels gate={gate} />
      <div className="lab-columns">
        <form noValidate onSubmit={submit} aria-label="Electron dynamics controls">
          <fieldset disabled={!ready}>
            <legend>Set the particle, initial motion, fields, and conventions</legend>
            <div className="lab-choice">
              <p className="fine">
                Section 10 examines the motion of a slowly accelerated electron in electromagnetic
                fields. By combining rest-frame dynamics with stationary coordinate measurements,
                Einstein derives longitudinal mass μγ³ and transverse mass μγ². Planck&apos;s
                laboratory force convention yields transverse mass μγ. Both conventions make
                identical predictions for physical deflections, potentials, and trajectories.
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    preset({
                      initialSpeed: 0.6,
                      electricFieldY: 1e5,
                      magneticFieldZ: 0,
                      forceConvention: "source",
                      datasetOverlay: "none",
                    })
                  }
                >
                  Convention at 0.6c (1.5625 × m vs 1.25 × m)
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    preset({
                      initialSpeed: 0.95,
                      electricFieldY: 0,
                      magneticFieldZ: 0,
                      datasetOverlay: "none",
                    })
                  }
                >
                  High speed (0.95c, W ≈ 2.20mc²)
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    preset({
                      initialSpeed: 0.6,
                      electricFieldY: 0,
                      magneticFieldZ: 0.01,
                      datasetOverlay: "none",
                    })
                  }
                >
                  Magnetic deflection (B = 0.01 T)
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    preset({
                      initialSpeed: 0.6,
                      electricFieldY: 1e5,
                      magneticFieldZ: 0.01,
                      datasetOverlay: "none",
                    })
                  }
                >
                  Crossed fields (E and B together)
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => preset({ electricFieldX: -1e5, electricFieldY: 0 })}
                >
                  Parallel electric acceleration
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    preset({ initialDirectionDeg: 45, electricFieldY: 0, magneticFieldZ: 0.01 })
                  }
                >
                  Oblique injection (45° in a magnetic field)
                </button>
              </div>
            </div>
            <div className="input-grid">
              {numberField("initialSpeed")}
              {numberField("initialDirectionDeg")}
              {numberField("integrationInterval")}
              <div className="input-field">
                <label htmlFor={`${id}-forceConvention`}>Force convention</label>
                <select
                  id={`${id}-forceConvention`}
                  name="forceConvention"
                  value={draft.forceConvention}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      forceConvention: event.currentTarget.value as "source" | "laboratory",
                    })
                  }
                >
                  <option value="source">Source (Einstein 1905: comoving force)</option>
                  <option value="laboratory">Laboratory (Planck 1906: F = dp/dt)</option>
                </select>
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-particle`}>Particle</label>
                <select
                  id={`${id}-particle`}
                  name="particle"
                  value={draft.particle}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      particle: event.currentTarget.value as "electron" | "custom",
                    })
                  }
                >
                  <option value="electron">Electron (negative elementary charge)</option>
                  <option value="custom">Custom particle (choose charge and rest mass)</option>
                </select>
              </div>
            </div>
            <p className="fine">
              The initial velocity lies in the x–y plane: 0° points along +x and 90° along +y. A
              negative β reverses that direction. The chamber shows the x–y projection; motion along
              z is not shown. The calculation refines its time steps and checks the path before
              drawing it. If rapid turns cannot be resolved within its calculation budget, shorten
              the duration or reduce the fields.
            </p>
            <div className="input-grid">
              {numberField("customCharge", draft.particle !== "custom")}
              {numberField("customMass", draft.particle !== "custom")}
            </div>
            <p className="fine">
              Custom charge and mass apply only to the custom particle. The sign of q sets the
              direction of its electric and magnetic deflections; q = 0 gives an uncharged particle.
            </p>
            <button type="submit">Apply settings</button>
            <ExperimentSettings contents="all electric and magnetic field components, mass language, a historical dataset overlay">
              <div className="input-grid">
                {numberField("electricFieldX")}
                {numberField("electricFieldY")}
                {numberField("electricFieldZ")}
                {numberField("magneticFieldX")}
                {numberField("magneticFieldY")}
                {numberField("magneticFieldZ")}
                <div className="input-field">
                  <label htmlFor={`${id}-massLanguage`}>Mass language</label>
                  <select
                    id={`${id}-massLanguage`}
                    name="massLanguage"
                    value={draft.massLanguage}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        massLanguage: event.currentTarget.value as "1905" | "modern",
                      })
                    }
                  >
                    <option value="1905">1905 Velocity-dependent masses</option>
                    <option value="modern">Modern invariant mass + momentum</option>
                  </select>
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-datasetOverlay`}>Historical dataset overlay</label>
                  <select
                    id={`${id}-datasetOverlay`}
                    name="datasetOverlay"
                    value={draft.datasetOverlay}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        datasetOverlay: event.currentTarget.value as
                          | "none"
                          | "kaufmann-1902-1906"
                          | "bucherer-1908",
                      })
                    }
                  >
                    <option value="none">None, model curve only</option>
                    <option value="kaufmann-1902-1906">
                      Kaufmann 1902–1906, not yet digitized
                    </option>
                    <option value="bucherer-1908">Bucherer 1908, not yet digitized</option>
                  </select>
                </div>
              </div>
              <p className="fine">Changes here apply with Apply settings.</p>
              {/* The recorded walkthrough, played into this session. Its records became
              carryable in f64267b03, when their checkpoint digests were recorded. */}
              <WalkthroughControl
                binding={SR13_TAPE}
                session={session}
                onPlayed={(parameters) => {
                  setDraft({ ...(parameters as Sr13Parameters) });
                  setTyped(typedFrom(parameters as Sr13Parameters));
                }}
              />
            </ExperimentSettings>
            {error ? (
              <p className="notice" role="alert">
                {error} {KEPT_RESULT}
              </p>
            ) : null}
          </fieldset>
        </form>
        <AcceptedStatus
          worked={snapshot === session.getServerSnapshot().accepted}
          summary={statusSummary}
          response={gate.response}
        />
        <LabTapeLink link={withPredictions(tapeLink, gate)} />
        <div className="lab-results" {...gate.response}>
          {path?.status === "outside-domain" ? (
            <p className="notice" role="status" data-trajectory-status="outside-domain">
              Trajectory unavailable: {path.reason}
            </p>
          ) : path?.status === "value" &&
            path.uncertainty?.kind === "numerical-error-estimate" ? (
            <p className="fine" data-trajectory-status="value">
              Trajectory numerical check: {display(path.uncertainty.magnitude)} m.{" "}
              {path.uncertainty.method}
            </p>
          ) : null}
          <ElectronDynamicsPlot
            initialSpeed={p.initialSpeed}
            initialDirectionDeg={p.initialDirectionDeg}
            electricFieldX={p.electricFieldX}
            electricFieldY={p.electricFieldY}
            electricFieldZ={p.electricFieldZ}
            magneticFieldX={p.magneticFieldX}
            magneticFieldY={p.magneticFieldY}
            magneticFieldZ={p.magneticFieldZ}
            forceConvention={p.forceConvention}
            massLanguage={p.massLanguage}
            particle={p.particle}
            longitudinalMassKg={longM}
            transverseMassComovingKg={transMComov}
            transverseMassLaboratoryKg={transMLab}
            kineticEnergyJ={keExact}
            kineticEnergyNewtonianJ={keNewt}
            acceleratingPotentialV={potExact}
            acceleratingPotentialNewtonianV={potNewt}
            acceleratingPotentialReason={unavailableReason(snapshot, "acceleratingPotential")}
            acceleratingPotentialNewtonianReason={unavailableReason(
              snapshot,
              "acceleratingPotentialNewtonian",
            )}
            radiusCurvatureMagneticM={rm}
            radiusCurvatureElectricM={re}
            radiusCurvatureMagneticReason={unavailableReason(snapshot, "radiusCurvatureMagnetic")}
            radiusCurvatureElectricReason={unavailableReason(snapshot, "radiusCurvatureElectric")}
            lorentzFactor={gammaVal}
            datasetOverlay={p.datasetOverlay}
            trajectory={trajectory}
            trajectoryReason={path?.status === "outside-domain" ? path.reason : undefined}
            integrationIntervalS={p.integrationInterval}
          />
          <h3>Values at the initial speed</h3>
          <p className="fine">
            Energy, potential, and mass coefficients refer to the initial speed, before the fields
            act. Each reference radius assumes a separate purely transverse field of the displayed
            magnitude; neither is the curvature of a general combined-field trajectory.
          </p>
          <table>
            <caption>
              Relativistic particle dynamics quantities computed under the accepted settings.
            </caption>
            <tbody>
              <tr>
                <th scope="row">Lorentz factor γ</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="lorentzFactor" />
                </td>
              </tr>
              <tr>
                <th scope="row">Longitudinal mass (m · γ³)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="longitudinalMass" unit="kg" />
                </td>
              </tr>
              <tr>
                <th scope="row">Transverse mass: comoving (m · γ²)</th>
                <td>
                  <SnapshotReading
                    snapshot={snapshot}
                    quantityId="transverseMassComoving"
                    unit="kg"
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">Transverse mass: laboratory (m · γ)</th>
                <td>
                  <SnapshotReading
                    snapshot={snapshot}
                    quantityId="transverseMassLaboratory"
                    unit="kg"
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">Relativistic kinetic energy (W)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="kineticEnergy" unit="J" />
                </td>
              </tr>
              <tr>
                <th scope="row">Accelerating potential (P = W/|q|)</th>
                <td>
                  <SnapshotReading
                    snapshot={snapshot}
                    quantityId="acceleratingPotential"
                    unit="V"
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">
                  Pure transverse magnetic reference radius (R<sub>m</sub>)
                </th>
                <td>
                  <SnapshotReading
                    snapshot={snapshot}
                    quantityId="radiusCurvatureMagnetic"
                    unit="m"
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">
                  Pure transverse electric reference radius (R<sub>e</sub>)
                </th>
                <td>
                  <SnapshotReading
                    snapshot={snapshot}
                    quantityId="radiusCurvatureElectric"
                    unit="m"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div {...gate.response}>
        <SessionResultWeave
          session={session}
          binding={SR13_READER_WEAVE}
          suspended={refusal !== null}
          announcementsEnabled={gate.open}
          highlightPaper={highlightPaper}
        />
      </div>
      {/* The caption follows the instrument it describes; above it, it came between a phone's heading and the result. */}
      <p data-detail="0">
        <noscript>
          <b className="reading-label">In one breath</b>
        </noscript>
        {withScripts(SR13_CAPTION.r0)}
      </p>
      <p data-detail="1">
        <noscript>
          <b className="reading-label">Full explanation</b>
        </noscript>
        {withScripts(SR13_CAPTION.r1)}
      </p>
      <p data-detail="2" hidden>
        <noscript>
          <b className="reading-label">Every step</b>
        </noscript>
        {withScripts(SR13_CAPTION.r2)}
      </p>
      <LabMargin>{withScripts(SR13_CAPTION.r3)}</LabMargin>
      <p className="fine">Not modeled: {SR13_NOT_MODELED.join("; ")}.</p>
      {/* The reader can read the evaluator that produced these numbers (am-f3e4). */}
      <ShowTheCode instrumentId="sr-13" listings={getKernelListingsForInstrument("sr-13")} />
    </section>
  );
}

export function ElectronDynamicsComparison({ example }: { example: PreparedSr13Example }) {
  return <ElectronDynamicsLab example={example} />;
}
