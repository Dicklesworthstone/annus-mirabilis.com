"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { readTypedNumber } from "../../../experiments/controls/typedNumber.ts";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { LabTapeLink, useLabTapeLink } from "../../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { statusMessage } from "../../../experiments/results/explanations.ts";
import { refusalSentence } from "../../../experiments/results/refusalSentence.ts";
import {
  SR10_CAPTION,
  SR10_NOT_MODELED,
  SR10_OUTPUTS,
  type Sr10Parameters,
} from "../../../experiments/sr10/definition.ts";
import { validateSr10Parameters } from "../../../experiments/sr10/parameters.ts";
import {
  createSr10Session,
  type PreparedSr10Example,
  sr10Comparison,
} from "../../../experiments/sr10/session.ts";
import { SR10_TAPE } from "../../../experiments/sr10/tape.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type {
  AcceptedSnapshot,
  PublishedResult,
} from "../../../experiments/store/instanceStore.ts";
import { PREDICT_PROMPTS } from "../../../generated/predict-prompts.ts";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { KEPT_RESULT } from "../keptResult.ts";
import { PredictGatePanels, usePredictGate, withPredictions } from "../PredictGate.tsx";
import { display, fixed, identity, result, sentenceNumber } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";
import { LightComplexPlot } from "./LightComplexPlot.tsx";

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
  /** Printed after a number only: after a refusal's sentence it read as part of the sentence. */
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
const SR10_PROMPTS = PREDICT_PROMPTS["sr-10"] ?? [];

/** The typed fields, kept as the reader typed them and read on Apply (dispatch 165). */
type Sr10Typed = {
  beta: string;
  propagationAngleDeg: string;
  initialEnergyJ: string;
  initialVolumeM3: string;
};
function typedFrom(q: Sr10Parameters): Sr10Typed {
  return {
    beta: String(q.beta),
    propagationAngleDeg: String(q.propagationAngleDeg),
    initialEnergyJ: String(q.initialEnergyJ),
    initialVolumeM3: String(q.initialVolumeM3),
  };
}

export function LightComplexLab({
  example,
  title = "The finite light complex",
}: {
  example: PreparedSr10Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createSr10Session(`sr10-${id}`, example));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(
    SR10_TAPE,
    session,
    session.acceptedParameters(),
    true,
    (restored) => {
      setDraft({ ...restored });
      setTyped(typedFrom(restored));
    },
  );
  // Predict mode (am-inst-predict-mode-ti7m): the result waits for the reader's answer.
  const gate = usePredictGate("sr-10", SR10_PROMPTS);
  const snapshot = view.accepted;
  const p = (snapshot?.parameters ?? example.parameters) as Sr10Parameters;
  const [draft, setDraft] = useState(() => ({ ...example.parameters }));
  // A number field hands "" for a cleared field or for "abc"; stored as Number(value) that was 0,
  // applied as β = 0 or φ = 0 without a word. The text is read on Apply instead.
  const [typed, setTyped] = useState(() => typedFrom(example.parameters));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReady(true);
  }, []);

  function apply(parameters: Sr10Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      setError(refusalSentence(outcome.refusal));
      return;
    }
    setDraft(parameters);
    setTyped(typedFrom(parameters));
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const beta = readTypedNumber(typed.beta, "the observer speed β");
    if (beta.kind === "refused") return setError(beta.requirement);
    const angle = readTypedNumber(typed.propagationAngleDeg, "the propagation angle φ");
    if (angle.kind === "refused") return setError(angle.requirement);
    const energy = readTypedNumber(typed.initialEnergyJ, "the initial energy in K");
    if (energy.kind === "refused") return setError(energy.requirement);
    const volume = readTypedNumber(typed.initialVolumeM3, "the initial volume in K");
    if (volume.kind === "refused") return setError(volume.requirement);
    const checked = validateSr10Parameters({
      ...draft,
      beta: beta.value,
      propagationAngleDeg: angle.value,
      initialEnergyJ: energy.value,
      initialVolumeM3: volume.value,
    });
    if (checked.kind !== "accepted") {
      setError(refusalSentence(checked.refusal));
      return;
    }
    apply(checked.data);
  }

  if (!snapshot) throw new Error("SR-10 requires an accepted snapshot.");

  const beta = numericOf(result(snapshot, "frameSpeed"));
  const phiK = numericOf(result(snapshot, "propagationAngleStationary"));
  const phiPrime = numericOf(result(snapshot, "propagationAngleMoving"));
  const energyK = numericOf(result(snapshot, "lightComplexEnergyStationary"));
  const energyPrime = numericOf(result(snapshot, "lightComplexEnergyMoving"));
  const volumeK = numericOf(result(snapshot, "lightComplexVolumeStationary"));
  const volumePrime = numericOf(result(snapshot, "lightComplexVolumeMoving"));
  const ampK = numericOf(result(snapshot, "lightAmplitudeStationary"));
  const ampPrime = numericOf(result(snapshot, "lightAmplitudeMoving"));
  const qFactor = numericOf(result(snapshot, "dopplerFactor"));
  const gammaVal = numericOf(result(snapshot, "lorentzFactor"));
  const energyDensityFactor = numericOf(result(snapshot, "energyDensityFactor"));
  // One sentence for the status line: the light complex's energy, volume and ray in each frame.
  const statusSummary =
    beta !== null &&
    phiK !== null &&
    phiPrime !== null &&
    energyK !== null &&
    energyPrime !== null &&
    volumeK !== null &&
    volumePrime !== null
      ? `seen from the frame moving at ${fixed(beta, 3)}c, a light complex of ${sentenceNumber(energyK)} J filling ${sentenceNumber(volumeK)} m³ in the stationary frame carries ${sentenceNumber(energyPrime)} J in ${sentenceNumber(volumePrime)} m³, ${fixed(phiPrime, 1) === fixed(phiK, 1) ? `its ray still at ${fixed(phiK, 1)}°` : `its ray at ${fixed(phiPrime, 1)}° instead of ${fixed(phiK, 1)}°`}.`
      : "the moving frame's energy and volume are outside the model's domain for these settings.";
  const volumeFactor = numericOf(result(snapshot, "volumeFactor"));
  // The rigid-body countermodel is a labelled comparison beside the accepted snapshot, for the same
  // accepted settings; none of the reader's numbers is taken from it.
  const comparison = sr10Comparison(p);
  const fromComparison = (quantityId: string) =>
    numericOf(
      comparison.results.find((r) => r.quantityId === quantityId) as PublishedResult | undefined,
    );
  const countermodelEnergy = fromComparison("countermodelEnergyMoving");
  const countermodelVolume = fromComparison("countermodelVolumeMoving");
  const countermodelEnergyFactor = fromComparison("countermodelEnergyFactor");
  const countermodelVolumeFactor = fromComparison("countermodelVolumeFactor");

  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      SR10_OUTPUTS,
      example.sourceDigest,
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-10"
      {...identity(snapshot)}
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "frameSpeed")}
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">The finite light complex</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${SR10_NOT_MODELED.join("; ")}.` })}
        />
      </div>
      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Energy transformation, volume transformation, and the countermodel comparison remain
          available; changing the settings requires JavaScript.
        </p>
      </noscript>
      <PredictGatePanels gate={gate} />
      <div className="lab-columns">
        <form noValidate onSubmit={submit} aria-label="Light complex settings">
          <fieldset disabled={!ready}>
            <legend>Set observer speed and packet parameters</legend>
            <div className="lab-choice">
              <p className="fine">
                A bounded pulse of light does not transform like a solid rod. Its energy follows q =
                γ(1 − β cos φ) and its volume 1/q. The tempting mistake keeps light&rsquo;s energy
                density, q², but gives the packet a rod&rsquo;s volume, 1/γ, so its energy becomes
                q²/γ. Along the axis that is 0.2 against 0.5 at 0.6c, and for a ray transverse in
                the moving frame, cos φ = β, it is 0.512 against 0.8. At φ = 90° in K, q = γ and the
                two agree at 1.25, so that ray cannot tell them apart.
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => apply({ ...p, beta: 0.6, propagationAngleDeg: 0 })}
                >
                  Receding along axis (φ = 0°, 0.6c)
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => apply({ ...p, beta: 0.6, propagationAngleDeg: 180 })}
                >
                  Approaching along axis (φ = 180°, 0.6c)
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => apply({ ...p, beta: 0.6, propagationAngleDeg: 53.13010235415598 })}
                >
                  Transverse in k (cos φ = 0.6)
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => apply({ ...p, beta: 0.6, propagationAngleDeg: 90 })}
                >
                  Transverse in K (φ = 90°)
                </button>
              </div>
            </div>
            <div className="input-grid">
              <div className="input-field">
                <label htmlFor={`${id}-beta`}>Observer speed β = v/c</label>
                <input
                  id={`${id}-beta`}
                  type="number"
                  name="beta"
                  inputMode="decimal"
                  step="0.01"
                  min="-0.95"
                  max="0.95"
                  value={typed.beta}
                  onChange={(event) => setTyped({ ...typed, beta: event.currentTarget.value })}
                />
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-propagationAngleDeg`}>
                  Propagation angle φ in K (degrees)
                </label>
                <input
                  id={`${id}-propagationAngleDeg`}
                  type="number"
                  name="propagationAngleDeg"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  max="360"
                  value={typed.propagationAngleDeg}
                  onChange={(event) =>
                    setTyped({ ...typed, propagationAngleDeg: event.currentTarget.value })
                  }
                />
              </div>
            </div>
            <button type="submit">Apply settings</button>
            <ExperimentSettings contents="initial energy and volume, the material rod countermodel">
              <div className="input-grid">
                <div className="input-field">
                  <label htmlFor={`${id}-initialEnergyJ`}>Initial energy in K (Joules)</label>
                  <input
                    id={`${id}-initialEnergyJ`}
                    type="number"
                    name="initialEnergyJ"
                    inputMode="decimal"
                    min="0.01"
                    step="0.1"
                    value={typed.initialEnergyJ}
                    onChange={(event) =>
                      setTyped({ ...typed, initialEnergyJ: event.currentTarget.value })
                    }
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-initialVolumeM3`}>Initial volume in K (m³)</label>
                  <input
                    id={`${id}-initialVolumeM3`}
                    type="number"
                    name="initialVolumeM3"
                    inputMode="decimal"
                    min="0.01"
                    step="0.1"
                    value={typed.initialVolumeM3}
                    onChange={(event) =>
                      setTyped({ ...typed, initialVolumeM3: event.currentTarget.value })
                    }
                  />
                </div>
                <div className="checkbox-row" style={{ marginTop: "0.5rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      name="showCountermodel"
                      checked={draft.showCountermodel}
                      onChange={(event) =>
                        setDraft({ ...draft, showCountermodel: event.currentTarget.checked })
                      }
                    />
                    Show the rigid-rod countermodel (volume 1/γ)
                  </label>
                </div>
              </div>
              <p className="fine">Changes here apply with Apply settings.</p>
            </ExperimentSettings>
            {error ? (
              <p className="notice" role="alert">
                {error} {KEPT_RESULT}
              </p>
            ) : null}
          </fieldset>
        </form>
        <AcceptedStatus
          worked={snapshot === undefined || snapshot === session.getServerSnapshot().accepted}
          summary={statusSummary}
          response={gate.response}
        />
        <LabTapeLink link={withPredictions(tapeLink, gate)} />
        <div className="lab-results" {...gate.response}>
          {beta !== null &&
          phiK !== null &&
          phiPrime !== null &&
          energyK !== null &&
          energyPrime !== null &&
          volumeK !== null &&
          volumePrime !== null &&
          qFactor !== null &&
          volumeFactor !== null &&
          energyDensityFactor !== null &&
          gammaVal !== null ? (
            <LightComplexPlot
              beta={beta}
              gamma={gammaVal}
              phiStationaryDeg={phiK}
              phiMovingDeg={phiPrime}
              energyStationaryJ={energyK}
              energyMovingJ={energyPrime}
              volumeStationaryM3={volumeK}
              volumeMovingM3={volumePrime}
              amplitudeStationary={ampK ?? 1}
              amplitudeMoving={ampPrime ?? 1}
              energyFactor={qFactor}
              volumeFactor={volumeFactor}
              energyDensityFactor={energyDensityFactor}
              showCountermodel={draft.showCountermodel}
              countermodelEnergyJ={countermodelEnergy ?? undefined}
              countermodelVolumeM3={countermodelVolume ?? undefined}
              countermodelEnergyFactor={countermodelEnergyFactor ?? undefined}
              countermodelVolumeFactor={countermodelVolumeFactor ?? undefined}
            />
          ) : (
            <p>The model does not admit this observer. No inertial observer at |v| ≥ c.</p>
          )}
          <h3>Values at these settings</h3>
          <table>
            <caption>
              Relativistic light complex transformation factors compared to the naive material
              contraction countermodel.
            </caption>
            <tbody>
              <tr>
                <th scope="row">Energy in K (E)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="lightComplexEnergyStationary" />{" "}
                  J
                </td>
              </tr>
              <tr>
                <th scope="row">Physical energy in k (E′)</th>
                <td>
                  <SnapshotReading
                    snapshot={snapshot}
                    quantityId="lightComplexEnergyMoving"
                    unit="J"
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">Volume in K (V)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="lightComplexVolumeStationary" />{" "}
                  m³
                </td>
              </tr>
              <tr>
                <th scope="row">Physical volume in k (V′)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="lightComplexVolumeMoving" /> m³
                </td>
              </tr>
              <tr>
                <th scope="row">Energy ratio E′/E (q)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="dopplerFactor" />
                </td>
              </tr>
              <tr>
                <th scope="row">Volume ratio V′/V (1/q)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="volumeFactor" />
                </td>
              </tr>
              <tr>
                <th scope="row">Material volume factor 1/γ</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="materialVolumeFactor" />
                </td>
              </tr>
              <tr>
                <th scope="row">Lorentz factor γ</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="lorentzFactor" />
                </td>
              </tr>
              <tr>
                <th scope="row">Transformed angle in k (φ′)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="propagationAngleMoving" /> °
                </td>
              </tr>
              {draft.showCountermodel ? (
                <>
                  <tr className="countermodel-row">
                    <th scope="row">Countermodel E′ (q²/γ)</th>
                    <td
                      data-quantity-id="countermodelEnergyMoving"
                      data-model-id={comparison.modelId}
                    >
                      {countermodelEnergy === null
                        ? "Not defined here"
                        : `${display(countermodelEnergy)} J`}{" "}
                      <span className="badge warning">(wrong model)</span>
                    </td>
                  </tr>
                  <tr className="countermodel-row">
                    <th scope="row">Countermodel V′ (1/γ)</th>
                    <td
                      data-quantity-id="countermodelVolumeMoving"
                      data-model-id={comparison.modelId}
                    >
                      {countermodelVolume === null
                        ? "Not defined here"
                        : `${display(countermodelVolume)} m³`}{" "}
                      <span className="badge warning">(wrong model)</span>
                    </td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
          <p>
            Remarkably, the energy factor E′/E equals the Doppler frequency ratio ν′/ν = q across
            all angles and speeds. This exact proportionality between light energy and wave
            frequency holds invariantly for any bounded light packet under Lorentz transformations.
          </p>
        </div>
      </div>
      {/* The caption's readings follow the instrument (dispatch 263). Above the predict gate they
          pushed the instrument more than 1000px down at 1440; every sentence is still here. */}
      <p data-detail="0">{withScripts(SR10_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(SR10_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(SR10_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(SR10_CAPTION.r3)}
      </p>

      <p className="fine">Not modeled: {SR10_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

export function LightComplexComparison({ example }: { example: PreparedSr10Example }) {
  return <LightComplexLab example={example} />;
}
