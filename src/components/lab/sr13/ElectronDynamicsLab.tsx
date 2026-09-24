"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { LabTapeLink, useLabTapeLink } from "../../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { statusMessage } from "../../../experiments/results/explanations.ts";
import { refusalSentence } from "../../../experiments/results/refusalSentence.ts";
import {
  SR13_CAPTION,
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
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { display, fixed, identity, result, sentenceNumber } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";
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

export function ElectronDynamicsLab({
  example,
  title = "Dynamics of the slowly accelerated electron",
}: {
  example: PreparedSr13Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createSr13Session(`sr13-${id}`, example));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(SR13_TAPE, session, session.acceptedParameters());
  const snapshot = (view.accepted ?? session.getServerSnapshot().accepted) as AcceptedSnapshot;
  const p = snapshot.parameters as Sr13Parameters;
  const [draft, setDraft] = useState(() => ({ ...example.parameters }));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReady(true);
  }, []);

  function apply(parameters: Sr13Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      setError(refusalSentence(outcome.refusal));
      return;
    }
    setDraft(parameters);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateSr13Parameters(draft);
    if (checked.kind !== "accepted") {
      setError(refusalSentence(checked.refusal));
      return;
    }
    apply(checked.data);
  }

  const beta = numericOf(result(snapshot, "speedRatio")) ?? draft.initialSpeed;
  const gammaVal = numericOf(result(snapshot, "lorentzFactor")) ?? 1;
  const longM = numericOf(result(snapshot, "longitudinalMass")) ?? 0;
  const transMComov = numericOf(result(snapshot, "transverseMassComoving")) ?? 0;
  const transMLab = numericOf(result(snapshot, "transverseMassLaboratory")) ?? 0;
  const keExact = numericOf(result(snapshot, "kineticEnergy")) ?? 0;
  const keNewt = numericOf(result(snapshot, "kineticEnergyNewtonian")) ?? 0;
  const potExact = numericOf(result(snapshot, "acceleratingPotential")) ?? 0;
  const potNewt = numericOf(result(snapshot, "acceleratingPotentialNewtonian")) ?? 0;
  const rm = numericOf(result(snapshot, "radiusCurvatureMagnetic")) ?? Infinity;
  const re = numericOf(result(snapshot, "radiusCurvatureElectric")) ?? Infinity;
  // The path the chamber draws: the same accepted snapshot as every number beside it. Looked up, not
  // required, so a snapshot prepared before the kernel published a path renders without one.
  const path = snapshot.outputs.find((o) => o.quantityId === "trajectoryPositions");
  const trajectory = path?.status === "value" && typeof path.value !== "number" ? path.value : null;
  // One sentence for the status line: the electron's kinetic energy and the potential that gives
  // it, each beside what Newton's formula says.
  const statusSummary =
    numericOf(result(snapshot, "kineticEnergy")) !== null &&
    numericOf(result(snapshot, "acceleratingPotential")) !== null
      ? `an electron at ${fixed(beta, 3)}c, γ = ${fixed(gammaVal, 4)}, carries ${sentenceNumber(keExact)} J of kinetic energy where Newton's formula gives ${sentenceNumber(keNewt)} J; reaching this speed from rest takes ${sentenceNumber(potExact)} V, against ${sentenceNumber(potNewt)} V by Newton's formula.`
      : "the electron's energy is outside the model's domain at this speed.";

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
      <div className="lab-columns">
        <form noValidate onSubmit={submit} aria-label="Electron dynamics controls">
          <fieldset disabled={!ready}>
            <legend>Set field strengths, initial speed, and conventions</legend>
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
                    apply({
                      ...p,
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
                    apply({
                      ...p,
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
                    apply({
                      ...p,
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
                    apply({
                      ...p,
                      initialSpeed: 0.6,
                      electricFieldY: 1e5,
                      magneticFieldZ: 0.01,
                      datasetOverlay: "none",
                    })
                  }
                >
                  Crossed fields (E and B together)
                </button>
              </div>
            </div>
            <div className="input-grid">
              <div className="input-field">
                <label htmlFor={`${id}-initialSpeed`}>Initial speed β = v/c</label>
                <input
                  id={`${id}-initialSpeed`}
                  type="number"
                  name="initialSpeed"
                  inputMode="decimal"
                  step="0.01"
                  min="-0.95"
                  max="0.95"
                  value={draft.initialSpeed}
                  onChange={(event) =>
                    setDraft({ ...draft, initialSpeed: Number(event.currentTarget.value) })
                  }
                />
              </div>
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
            </div>
            <button type="submit">Apply settings</button>
            <ExperimentSettings contents="electric and magnetic field strengths, mass language, a historical dataset overlay">
              <div className="input-grid">
                <div className="input-field">
                  <label htmlFor={`${id}-electricFieldY`}>Electric field Ey (V/m)</label>
                  <input
                    id={`${id}-electricFieldY`}
                    type="number"
                    name="electricFieldY"
                    inputMode="decimal"
                    step="10000"
                    value={draft.electricFieldY}
                    onChange={(event) =>
                      setDraft({ ...draft, electricFieldY: Number(event.currentTarget.value) })
                    }
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-magneticFieldZ`}>Magnetic field Bz (Tesla)</label>
                  <input
                    id={`${id}-magneticFieldZ`}
                    type="number"
                    name="magneticFieldZ"
                    inputMode="decimal"
                    step="0.005"
                    value={draft.magneticFieldZ}
                    onChange={(event) =>
                      setDraft({ ...draft, magneticFieldZ: Number(event.currentTarget.value) })
                    }
                  />
                </div>
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
            </ExperimentSettings>
            {error ? (
              <p className="notice" role="alert">
                {error}
              </p>
            ) : null}
          </fieldset>
        </form>
        <AcceptedStatus
          worked={snapshot === session.getServerSnapshot().accepted}
          summary={statusSummary}
        />
        <LabTapeLink link={tapeLink} />
        <div className="lab-results">
          <ElectronDynamicsPlot
            initialSpeed={beta}
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
            radiusCurvatureMagneticM={rm}
            radiusCurvatureElectricM={re}
            lorentzFactor={gammaVal}
            datasetOverlay={p.datasetOverlay}
            trajectory={trajectory}
            integrationIntervalS={p.integrationInterval}
          />
          <h3>Values at these settings</h3>
          <table>
            <caption>
              Relativistic electron dynamics quantities computed under current settings.
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
                <th scope="row">Accelerating potential (P = W/e)</th>
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
                  Magnetic curvature radius (R<sub>m</sub>)
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
                  Electric curvature radius (R<sub>e</sub>)
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
      {/* The caption follows the instrument it describes; above it, it came between a phone's heading and the result. */}
      <p data-detail="0">{withScripts(SR13_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(SR13_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(SR13_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(SR13_CAPTION.r3)}
      </p>
      <p className="fine">Not modeled: {SR13_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

export function ElectronDynamicsComparison({ example }: { example: PreparedSr13Example }) {
  return <ElectronDynamicsLab example={example} />;
}
