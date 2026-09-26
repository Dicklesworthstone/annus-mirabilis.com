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
  SR09_CAPTION,
  SR09_NOT_MODELED,
  SR09_OUTPUTS,
  type Sr09Parameters,
} from "../../../experiments/sr09/definition.ts";
import { validateSr09Parameters } from "../../../experiments/sr09/parameters.ts";
import { createSr09Session, type PreparedSr09Example } from "../../../experiments/sr09/session.ts";
import { SR09_TAPE } from "../../../experiments/sr09/tape.ts";
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
import { display, fixed, identity, result } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";
import { DopplerAberrationPlot } from "./DopplerAberrationPlot.tsx";

function numericOf(item: PublishedResult | undefined): number | null {
  if (!item) return null;
  if (item.status === "value" && typeof item.value === "number") return item.value;
  return null;
}

function SnapshotReading({
  snapshot,
  quantityId,
}: {
  snapshot: AcceptedSnapshot;
  quantityId: string;
}) {
  const item = result(snapshot, quantityId);
  if (item.status === "value" && typeof item.value === "number") {
    return <span data-quantity-id={quantityId}>{display(item.value)}</span>;
  }
  if (item.status === "outside-domain" || item.status === "not-applicable") {
    return <span data-quantity-id={quantityId}>{item.reason}</span>;
  }
  return <span data-quantity-id={quantityId}>{statusMessage(item.status)}</span>;
}

/** The typed fields, kept as the reader typed them and read on Apply (dispatch 165). */
type Sr09Typed = { beta: string; propagationAngleDeg: string; frequencyTHz: string };
function typedFrom(q: Sr09Parameters): Sr09Typed {
  return {
    beta: String(q.beta),
    propagationAngleDeg: String(q.propagationAngleDeg),
    frequencyTHz: String(q.frequencyTHz),
  };
}

// The manifest's prompts (scripts/generate-predict-prompts.mjs), one stable array for the gate.
const SR09_PROMPTS = PREDICT_PROMPTS["sr-09"] ?? [];

export function DopplerAberrationLab({
  example,
  title = "Doppler principle and aberration",
}: {
  example: PreparedSr09Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createSr09Session(`sr09-${id}`, example));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(
    SR09_TAPE,
    session,
    session.acceptedParameters(),
    true,
    (restored) => {
      setDraft({ ...restored });
      setTyped(typedFrom(restored));
    },
  );
  // Predict mode (am-inst-predict-mode-ti7m): the result waits for the reader's answer.
  const gate = usePredictGate("sr-09", SR09_PROMPTS);
  const snapshot = (view.accepted ?? session.getServerSnapshot().accepted) as AcceptedSnapshot;
  const p = snapshot.parameters as Sr09Parameters;
  const [draft, setDraft] = useState(() => ({ ...example.parameters }));
  // A number field hands "" for a cleared field or for "abc"; stored as Number(value) that was 0,
  // applied as β = 0 or θ = 0 without a word. The text is read on Apply instead.
  const [typed, setTyped] = useState(() => typedFrom(example.parameters));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setReady(true);
  }, []);
  function apply(parameters: Sr09Parameters) {
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
    const angle = readTypedNumber(typed.propagationAngleDeg, "the propagation angle θ");
    if (angle.kind === "refused") return setError(angle.requirement);
    const frequency = readTypedNumber(typed.frequencyTHz, "the frequency in K");
    if (frequency.kind === "refused") return setError(frequency.requirement);
    const checked = validateSr09Parameters({
      ...draft,
      beta: beta.value,
      propagationAngleDeg: angle.value,
      frequencyTHz: frequency.value,
    });
    if (checked.kind !== "accepted") {
      setError(refusalSentence(checked.refusal));
      return;
    }
    apply(checked.data);
  }
  const doppler = numericOf(result(snapshot, "dopplerFactor"));
  const thetaK = numericOf(result(snapshot, "propagationAngleStationary"));
  const thetaPrime = numericOf(result(snapshot, "propagationAngleMoving"));
  const nuK = numericOf(result(snapshot, "waveFrequencyStationary"));
  const nuPrime = numericOf(result(snapshot, "waveFrequencyMoving"));
  const beta = numericOf(result(snapshot, "frameSpeed"));
  const gammaVal = numericOf(result(snapshot, "lorentzFactor"));
  const receding = numericOf(result(snapshot, "recedingDopplerFactor"));
  const approaching = numericOf(result(snapshot, "approachingDopplerFactor"));
  // One sentence for the status line: the ray in each frame and the Doppler factor between them.
  const statusSummary =
    doppler !== null &&
    thetaK !== null &&
    thetaPrime !== null &&
    nuK !== null &&
    nuPrime !== null &&
    beta !== null
      ? `a ray at ${fixed(thetaK, 1)}° and ${fixed(nuK / 1e12, 1)} THz in the stationary frame K arrives in the frame moving at ${fixed(beta, 3)}c at ${fixed(thetaPrime, 1)}° and ${fixed(nuPrime / 1e12, 1)} THz, a Doppler factor of ${fixed(doppler, 4)}.`
      : "the moving frame's angle and frequency are outside the model's domain for these settings.";
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      SR09_OUTPUTS,
      example.sourceDigest,
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-09"
      {...identity(snapshot)}
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "waveFrequencyMoving")}
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">Doppler and aberration</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${SR09_NOT_MODELED.join("; ")}.` })}
        />
      </div>
      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Frequency ratios, the transverse case, and the classical comparison remain available;
          changing the settings requires JavaScript.
        </p>
      </noscript>
      <PredictGatePanels gate={gate} />
      <div className="lab-columns">
        <form noValidate onSubmit={submit} aria-label="Doppler and aberration settings">
          <fieldset disabled={!ready}>
            <legend>Set the observer and the ray</legend>
            <div className="lab-choice">
              <p className="fine">Choose a named ray, or type a speed and an angle.</p>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => apply({ ...p, beta: 0.6, propagationAngleDeg: 0 })}
                >
                  Receding 0.6c (θ = 0°)
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => apply({ ...p, beta: 0.6, propagationAngleDeg: 180 })}
                >
                  Approaching 0.6c (θ = 180°)
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => apply({ ...p, beta: 0.6, propagationAngleDeg: 90 })}
                >
                  Transverse 0.6c (θ = 90°)
                </button>
              </div>
              <p className="fine">
                The transverse case (θ = 90°) is the purely relativistic shift: the medium formulae
                give no change there.
              </p>
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
                  Propagation angle θ in K (degrees)
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
            <ExperimentSettings contents="the source frequency">
              <div className="input-grid">
                <div className="input-field">
                  <label htmlFor={`${id}-frequencyTHz`}>Frequency in K (THz)</label>
                  <input
                    id={`${id}-frequencyTHz`}
                    type="number"
                    name="frequencyTHz"
                    inputMode="decimal"
                    min="1"
                    value={typed.frequencyTHz}
                    onChange={(event) =>
                      setTyped({ ...typed, frequencyTHz: event.currentTarget.value })
                    }
                  />
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
          worked={snapshot === session.getServerSnapshot().accepted}
          summary={statusSummary}
          response={gate.response}
        />
        <LabTapeLink link={withPredictions(tapeLink, gate)} />
        <div className="lab-results" {...gate.response}>
          {doppler !== null &&
          thetaK !== null &&
          thetaPrime !== null &&
          nuK !== null &&
          nuPrime !== null &&
          beta !== null ? (
            <DopplerAberrationPlot
              beta={beta}
              gamma={gammaVal ?? Number.NaN}
              thetaStationaryDeg={thetaK}
              thetaMovingDeg={thetaPrime}
              frequencyStationaryTHz={nuK / 1e12}
              frequencyMovingTHz={nuPrime / 1e12}
              dopplerFactor={doppler}
              cosThetaMoving={Math.cos((thetaPrime * Math.PI) / 180)}
              earthOrbitAberrationFormatted=""
              secondOrderShift={Number.NaN}
              recedingFactor={receding ?? undefined}
              approachingFactor={approaching ?? undefined}
            />
          ) : (
            <p>The model does not admit this observer. No inertial observer at |v| ≥ c.</p>
          )}
          <h3>Values at these settings</h3>
          <table>
            <caption>
              Relativistic factors from one wave-vector transform, beside the two medium formulae
              that are right for sound.
            </caption>
            <tbody>
              <tr>
                <th scope="row">Relativistic ν′/ν</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="dopplerFactor" />
                </td>
              </tr>
              <tr>
                <th scope="row">Lorentz factor γ</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="lorentzFactor" />
                </td>
              </tr>
              <tr>
                <th scope="row">Medium, moving observer</th>
                <td>
                  <SnapshotReading
                    snapshot={snapshot}
                    quantityId="classicalObserverDopplerFactor"
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">Medium, moving source</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="classicalSourceDopplerFactor" />
                </td>
              </tr>
              <tr>
                <th scope="row">Receding line of sight</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="recedingDopplerFactor" />
                </td>
              </tr>
              <tr>
                <th scope="row">Approaching line of sight</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="approachingDopplerFactor" />
                </td>
              </tr>
              <tr>
                <th scope="row">Angle in k</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="propagationAngleMoving" /> °
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            At θ = 90° the two medium formulae both give 1. The paper&apos;s factor is γ. That is
            the transverse Doppler shift, which has no classical counterpart. The medium formulae
            are not declared refuted: they are right for sound and agree with the paper to first
            order in v/c.
          </p>
        </div>
      </div>
      {/* The caption's readings follow the instrument (dispatch 263). Above the predict gate they
          pushed the instrument more than 1000px down at 1440; every sentence is still here. */}
      <p data-detail="0">{withScripts(SR09_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(SR09_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(SR09_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(SR09_CAPTION.r3)}
      </p>

      <p className="fine">Not modeled: {SR09_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

export function DopplerAberrationComparison({ example }: { example: PreparedSr09Example }) {
  return <DopplerAberrationLab example={example} />;
}
