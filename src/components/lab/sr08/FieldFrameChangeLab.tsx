"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  declaredDomains,
  domainRequirement,
} from "../../../experiments/controls/declaredDomain.ts";
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
  SR08_CAPTION,
  SR08_NOT_MODELED,
  type Sr08Parameters,
} from "../../../experiments/sr08/definition.ts";
import { validateSr08Parameters } from "../../../experiments/sr08/parameters.ts";
import {
  createSr08Session,
  type PreparedSr08Example,
  SR08_SESSION_OUTPUTS,
} from "../../../experiments/sr08/session.ts";
import { SR08_TAPE } from "../../../experiments/sr08/tape.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { display, fixed, identity, result, sentenceNumber } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";
import { FieldFrameChangePlot } from "./FieldFrameChangePlot.tsx";
import "../labControls.css";
import { PREDICT_PROMPTS } from "../../../generated/predict-prompts.ts";
import { KEPT_RESULT } from "../keptResult.ts";
import { PredictGatePanels, usePredictGate, withPredictions } from "../PredictGate.tsx";

const C_SI = 299792458;

function OutputReading({ item }: { item: PublishedResult | undefined }) {
  if (!item) return <span>Not computed at these settings.</span>;
  if (item.status === "value") {
    if (typeof item.value === "number") {
      return <span data-quantity-id={item.quantityId}>{display(item.value)}</span>;
    }
    // A vector arrives as a NumericView, not a Float64Array. Testing for Float64Array never
    // matched, so every vector reading fell through and printed the word "value".
    const view = item.value;
    const formatted = Array.from({ length: view.length }, (_, i) => display(view.at(i))).join(", ");
    return <span data-quantity-id={item.quantityId}>({formatted})</span>;
  }
  if (item.status === "not-applicable" || item.status === "outside-domain") {
    return <span data-quantity-id={item.quantityId}>{item.reason}</span>;
  }
  return <span data-quantity-id={item.quantityId}>{statusMessage(item.status)}</span>;
}

function SnapshotReading({
  snapshot,
  quantityId,
  unit,
}: {
  snapshot: Parameters<typeof result>[0];
  quantityId: string;
  /** Printed after a number only: after a refusal's sentence it read as part of the sentence. */
  unit?: string;
}) {
  const item = result(snapshot, quantityId);
  return (
    <>
      <OutputReading item={item} />
      {unit && item?.status === "value" ? ` ${unit}` : ""}
    </>
  );
}

// The manifest's prompt (scripts/generate-predict-prompts.mjs), one stable array for the gate. It
// replaces a question this file kept for itself, drawn below the results it asked about.
const SR08_PROMPTS = PREDICT_PROMPTS["sr-08"] ?? [];

/** The fields a reader types, as text: the boost as a fraction of c, and the two field components. */
type Sr08Typed = Readonly<{ boost: string; ey: string; bz: string }>;
function typedFrom(p: Sr08Parameters): Sr08Typed {
  return {
    boost: String(Number((p.boost / C_SI).toPrecision(12))),
    ey: String(p.electricFieldY),
    bz: String(p.magneticFieldZ),
  };
}
/** A typed boost that overflows once multiplied by c reads as outside the declared range. */
const BOOST_DOMAIN = declaredDomains("sr-08").boost;
const BOOST_TOO_LARGE = BOOST_DOMAIN
  ? domainRequirement(BOOST_DOMAIN, { label: "Boost speed", unit: "c", scale: 1 / C_SI })
  : "Enter a boost speed below the speed of light.";

export function FieldFrameChangeLab({
  example,
  title = "Electric and magnetic frame change",
}: {
  example: PreparedSr08Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createSr08Session(`sr08-${id}`, example));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(
    SR08_TAPE,
    session,
    session.acceptedParameters(),
    true,
    (restored) => setDraft({ ...restored }),
  );
  // Predict mode (am-inst-predict-mode-ti7m): the result waits for the reader's answer.
  const gate = usePredictGate("sr-08", SR08_PROMPTS);
  const [draft, setDraft] = useState<Sr08Parameters>(() => ({ ...example.parameters }));
  // The three typed fields keep the reader's text and are read on Apply, so a cleared field is
  // refused by name rather than becoming 0 (dispatch 165).
  const [typed, setTyped] = useState<Sr08Typed>(() => typedFrom(example.parameters));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReady(true);
  }, []);

  const snapshot = view.accepted ?? session.getServerSnapshot().accepted;
  if (!snapshot) return null;
  const p = snapshot.parameters as unknown as Sr08Parameters;

  function apply(parameters: Sr08Parameters) {
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
    const boost = readTypedNumber(typed.boost, "the boost speed", (v) => v * C_SI, BOOST_TOO_LARGE);
    if (boost.kind === "refused") return setError(boost.requirement);
    const ey = readTypedNumber(typed.ey, "the electric field Ey");
    if (ey.kind === "refused") return setError(ey.requirement);
    const bz = readTypedNumber(typed.bz, "the magnetic field Bz");
    if (bz.kind === "refused") return setError(bz.requirement);
    const checked = validateSr08Parameters({
      ...draft,
      boost: boost.value,
      electricFieldY: ey.value,
      magneticFieldZ: bz.value,
    });
    if (checked.kind !== "accepted") {
      setError(refusalSentence(checked.refusal));
      return;
    }
    apply(checked.data);
  }

  const eStat = result(snapshot, "electricFieldStationary");
  const eMov = result(snapshot, "electricFieldMoving");
  const bStat = result(snapshot, "magneticFieldStationary");
  const bMov = result(snapshot, "magneticFieldMoving");
  const invDot = result(snapshot, "fieldInvariantEDotB");
  const invDiff = result(snapshot, "fieldInvariantE2MinusC2B2");
  const gRes = result(snapshot, "lorentzFactor");
  const fLab = result(snapshot, "transverseForceLaboratory");
  const fCom = result(snapshot, "transverseForceComoving");
  // One sentence for the status line: each field before and after the change of frame.
  const vectorText = (item: PublishedResult, unit: string) => {
    if (item.status !== "value" || typeof item.value === "number") return null;
    const components = item.value;
    return `(${Array.from({ length: components.length }, (_, i) => sentenceNumber(components.at(i))).join(", ")}) ${unit}`;
  };
  const fields = [
    vectorText(eStat, "V/m"),
    vectorText(eMov, "V/m"),
    vectorText(bStat, "T"),
    vectorText(bMov, "T"),
  ] as const;
  const statusSummary = fields.every((text) => text !== null)
    ? `seen from the frame moving at ${fixed(p.boost / C_SI, 3)}c, the electric field ${fields[0]} becomes ${fields[1]} and the magnetic field ${fields[2]} becomes ${fields[3]}.`
    : "the moving frame's fields are not computed at these settings.";

  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      SR08_SESSION_OUTPUTS,
      example.sourceDigest,
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-08"
      {...identity(snapshot)}
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "electricFieldStationary")}
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">Electrodynamics §6</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${SR08_NOT_MODELED.join("; ")}.` })}
        />
      </div>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          The field transformations, invariant checks, and §6 new manner of expression remain
          available; changing the settings requires JavaScript.
        </p>
      </noscript>

      <PredictGatePanels gate={gate} />
      <div className="lab-columns">
        <form
          noValidate
          onSubmit={submit}
          aria-label="Electric and magnetic frame change settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset disabled={!ready}>
            <legend>Set observer and fields</legend>

            <fieldset>
              <legend>Description frame</legend>
              <label className="check">
                <input
                  type="radio"
                  name="descriptionFrame"
                  checked={draft.descriptionFrame === "stationary"}
                  onChange={() => apply({ ...p, descriptionFrame: "stationary" })}
                />{" "}
                Stationary frame K
              </label>
              <label className="check">
                <input
                  type="radio"
                  name="descriptionFrame"
                  checked={draft.descriptionFrame === "moving"}
                  onChange={() => apply({ ...p, descriptionFrame: "moving" })}
                />{" "}
                Moving frame k
              </label>
            </fieldset>

            <fieldset>
              <legend>Unit convention</legend>
              <label className="check">
                <input
                  type="radio"
                  name="unitLayer"
                  checked={draft.unitLayer === "si"}
                  onChange={() => setDraft({ ...draft, unitLayer: "si" })}
                />{" "}
                SI (V/m, T)
              </label>
              <label className="check">
                <input
                  type="radio"
                  name="unitLayer"
                  checked={draft.unitLayer === "gaussian"}
                  onChange={() => setDraft({ ...draft, unitLayer: "gaussian" })}
                />{" "}
                Historical Gaussian
              </label>
            </fieldset>

            <div className="input-grid">
              <div className="input-field">
                <label htmlFor={`${id}-boost`}>Boost v/c</label>
                <input
                  id={`${id}-boost`}
                  type="number"
                  name="boost"
                  step="0.05"
                  min="-0.95"
                  max="0.95"
                  value={typed.boost}
                  onChange={(event) => setTyped({ ...typed, boost: event.currentTarget.value })}
                />
              </div>
            </div>

            <div className="preset-list">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  apply({
                    ...p,
                    boost: 0.6 * C_SI,
                    electricFieldX: 0,
                    electricFieldY: 1,
                    electricFieldZ: 0,
                    magneticFieldX: 0,
                    magneticFieldY: 0,
                    magneticFieldZ: 0,
                  })
                }
              >
                Pure E at 0.6c
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  apply({
                    ...p,
                    boost: 10,
                    electricFieldX: 0,
                    electricFieldY: 0,
                    electricFieldZ: 0,
                    magneticFieldX: 0,
                    magneticFieldY: 0,
                    magneticFieldZ: 1,
                  })
                }
              >
                Pure B at 10 m/s
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  apply({
                    ...p,
                    boost: 0.6 * C_SI,
                    electricFieldX: 0,
                    electricFieldY: 1,
                    electricFieldZ: 0,
                    magneticFieldX: 0,
                    magneticFieldY: 0,
                    magneticFieldZ: 1 / C_SI,
                  })
                }
              >
                Null field invariant (E = cB)
              </button>
            </div>

            <button type="submit">Apply settings</button>
            <ExperimentSettings contents="the electric and magnetic field strengths">
              <div className="input-grid">
                <div className="input-field">
                  <label htmlFor={`${id}-ey`}>Electric Ey (V/m)</label>
                  <input
                    id={`${id}-ey`}
                    type="number"
                    name="ey"
                    step="0.1"
                    value={typed.ey}
                    onChange={(event) => setTyped({ ...typed, ey: event.currentTarget.value })}
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-bz`}>Magnetic Bz (T)</label>
                  <input
                    id={`${id}-bz`}
                    type="number"
                    name="bz"
                    step="1e-9"
                    value={typed.bz}
                    onChange={(event) => setTyped({ ...typed, bz: event.currentTarget.value })}
                  />
                </div>
              </div>
              <p className="fine">Changes here apply with Apply settings.</p>
            </ExperimentSettings>
            {error ? (
              <p id={`${id}-error`} className="notice" role="alert">
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
          <FieldFrameChangePlot
            electricStationary={eStat}
            electricMoving={eMov}
            magneticStationary={bStat}
            magneticMoving={bMov}
            invariantDot={invDot}
            invariantDiff={invDiff}
            gamma={gRes}
            forceLab={fLab}
            forceComoving={fCom}
            frame={p.descriptionFrame}
            unitLayer={p.unitLayer}
            decompose={p.decomposeComponents}
          />

          <div className="table-wrapper">
            <h3>Transformation ledger</h3>
            <table>
              <caption>
                Comparison of electromagnetic field quantities across stationary (K) and moving (k)
                frames.
              </caption>
              <tbody>
                <tr>
                  <th scope="row">E (Stationary K)</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="electricFieldStationary"
                      unit="V/m"
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row">E′ (Moving k)</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="electricFieldMoving"
                      unit="V/m"
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row">B (Stationary K)</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="magneticFieldStationary"
                      unit="T"
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row">B′ (Moving k)</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="magneticFieldMoving"
                      unit="T"
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Lorentz Factor γ</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="lorentzFactor" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Invariant E² − c²B²</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="fieldInvariantE2MinusC2B2" />{" "}
                    (V/m)²
                  </td>
                </tr>
                <tr>
                  <th scope="row">Invariant E · B</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="fieldInvariantEDotB"
                      unit="T·V/m"
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Laboratory force F</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="transverseForceLaboratory"
                      unit="N"
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Comoving force F′</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="transverseForceComoving"
                      unit="N"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* The caption's readings follow the instrument (dispatch 263). Above the predict gate they
          pushed the instrument more than 1000px down at 1440; every sentence is still here. */}
      <p data-detail="0">{withScripts(SR08_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(SR08_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(SR08_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(SR08_CAPTION.r3)}
      </p>

      <p className="fine">Not modeled: {SR08_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}
