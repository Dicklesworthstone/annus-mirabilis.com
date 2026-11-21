"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
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
  SR08_CAPTION,
  SR08_NOT_MODELED,
  type Sr08Parameters,
} from "../../../experiments/sr08/definition.ts";
import {
  createSr08Session,
  type PreparedSr08Example,
  SR08_SESSION_OUTPUTS,
} from "../../../experiments/sr08/session.ts";
import { SR08_TAPE } from "../../../experiments/sr08/tape.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { createReaderCheckpointBinding } from "../../../experiments/store/readerCheckpoint.ts";
import { useRetainedSession } from "../../../experiments/store/retainedSession.tsx";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { display, fixed, identity, result, sentenceNumber } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";
import { FieldFrameChangePlot } from "./FieldFrameChangePlot.tsx";
import {
  readSr08Settings,
  SR08_NUMBER_FIELDS,
  type Sr08NumberField,
  type Sr08TypedSettings,
  typedSr08Settings,
} from "./fieldSettings.ts";
import "../labControls.css";
import { getKernelListingsForInstrument } from "../../../content/kernel/listings.ts";
import { useInstrumentView } from "../../../experiments/store/useExperimentSnapshot.ts";
import { PREDICT_PROMPTS } from "../../../generated/predict-prompts.ts";
import { KEPT_RESULT } from "../keptResult.ts";
import { LabMargin } from "../LabMargin.tsx";
import { PredictGatePanels, usePredictGate, withPredictions } from "../PredictGate.tsx";
import { ShowTheCode } from "../ShowTheCode.tsx";
import { WalkthroughControl } from "../WalkthroughControl.tsx";

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

export function FieldFrameChangeLab({
  instanceId,
  restoreFromLocation = true,
  example,
  title = "Electric and magnetic frame change",
}: {
  example: PreparedSr08Example;
  instanceId?: string | undefined;
  restoreFromLocation?: boolean | undefined;
  title?: string;
}) {
  const id = useId();
  const session = useRetainedSession(
    {
      experimentId: "sr-08",
      instanceId: instanceId ?? `sr08-${id}`,
      sourceDigest: example?.sourceDigest,
    },
    (retainedId) => createSr08Session(retainedId, example),
    createReaderCheckpointBinding(SR08_TAPE),
  );
  const view = useInstrumentView(session);
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(
    SR08_TAPE,
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
      setTyped(typedSr08Settings(restored));
    },
  );
  // Predict mode (am-inst-predict-mode-ti7m): the result waits for the reader's answer.
  const gate = usePredictGate("sr-08", SR08_PROMPTS);
  const [draft, setDraft] = useState<Sr08Parameters>(() => ({ ...session.acceptedParameters() }));
  const [typed, setTyped] = useState<Sr08TypedSettings>(() =>
    typedSr08Settings(session.acceptedParameters()),
  );
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

  const snapshot = view.accepted ?? session.getServerSnapshot().accepted;
  if (!snapshot) return null;
  const p = snapshot.parameters as unknown as Sr08Parameters;

  function apply(parameters: Sr08Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      refuse(outcome.refusal, refusalSentence(outcome.refusal));
      return;
    }
    setDraft(parameters);
    setTyped(typedSr08Settings(parameters));
    accept();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = readSr08Settings(draft, typed);
    if (checked.kind !== "accepted") {
      refuse(checked.refusal, checked.requirement);
      return;
    }
    apply(checked.data);
  }

  function placeChargeAtRest(frame: "stationary" | "moving") {
    const checked = readSr08Settings(draft, {
      ...typed,
      chargeVelocityX: frame === "moving" ? typed.boost : "0",
      chargeVelocityY: "0",
      chargeVelocityZ: "0",
    });
    if (checked.kind !== "accepted") {
      refuse(checked.refusal, checked.requirement);
      return;
    }
    apply({
      ...checked.data,
      // Reuse the accepted SI boost exactly, without a second fraction-of-c round trip.
      chargeVelocityX: frame === "moving" ? checked.data.boost : 0,
      chargeVelocityY: 0,
      chargeVelocityZ: 0,
    });
  }

  function numberFields(group: Sr08NumberField["group"]) {
    return (
      <div className="input-grid">
        {SR08_NUMBER_FIELDS.filter((field) => field.group === group).map((field) => (
          <div className="input-field" key={field.key}>
            <label htmlFor={`${id}-${field.name}`}>{field.label}</label>
            <input
              id={`${id}-${field.name}`}
              type="number"
              name={field.name}
              step={field.step}
              {...(field.key === "boost" ? { min: -0.95, max: 0.95 } : {})}
              value={typed[field.key]}
              onChange={(event) => setTyped({ ...typed, [field.key]: event.currentTarget.value })}
            />
          </div>
        ))}
      </div>
    );
  }

  const eStat = result(snapshot, "electricFieldStationary");
  const eMov = result(snapshot, "electricFieldMoving");
  const bStat = result(snapshot, "magneticFieldStationary");
  const bMov = result(snapshot, "magneticFieldMoving");
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
          validationRefusal={refusal}
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
              <legend>Notation guide</legend>
              <label className="check">
                <input
                  type="radio"
                  name="unitLayer"
                  checked={draft.unitLayer === "si"}
                  onChange={() => setDraft({ ...draft, unitLayer: "si" })}
                />{" "}
                Modern field names
              </label>
              <label className="check">
                <input
                  type="radio"
                  name="unitLayer"
                  checked={draft.unitLayer === "gaussian"}
                  onChange={() => setDraft({ ...draft, unitLayer: "gaussian" })}
                />{" "}
                Einstein’s printed field names
              </label>
            </fieldset>

            <p className="fine">
              Numerical inputs and readings stay in SI units. The printed-name guide identifies
              Einstein’s symbols; it does not convert SI values to Gaussian units.
            </p>
            {numberFields("observer")}

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
            <ExperimentSettings contents="all field components and the test charge’s motion">
              <fieldset>
                <legend>Electric field in stationary frame K</legend>
                {numberFields("electric")}
              </fieldset>
              <fieldset>
                <legend>Magnetic field in stationary frame K</legend>
                {numberFields("magnetic")}
              </fieldset>
              <fieldset>
                <legend>Test charge in stationary frame K</legend>
                {numberFields("charge")}
                <p className="fine">
                  The sign of q sets the sign of the force. A zero charge feels no electromagnetic
                  force; the field transformation is unchanged.
                </p>
                {numberFields("velocity")}
                <p className="fine">
                  Enter each velocity as a fraction of c. Their combined speed must remain below c.
                  Changing these components changes the charge’s motion; changing the observer boost
                  describes that same motion from another frame.
                </p>
                <div className="preset-list">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => placeChargeAtRest("stationary")}
                  >
                    Charge at rest in K
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => placeChargeAtRest("moving")}
                  >
                    Charge at rest in k
                  </button>
                </div>
                <p className="fine">
                  These two buttons apply the current fields, charge and boost together with the
                  selected rest-frame velocity.
                </p>
              </fieldset>
              <label className="check">
                <input
                  type="checkbox"
                  name="decomposeComponents"
                  checked={draft.decomposeComponents}
                  onChange={(event) =>
                    setDraft({ ...draft, decomposeComponents: event.currentTarget.checked })
                  }
                />{" "}
                Show the electric arrow’s x and y components
              </label>
              <p className="fine">Changes here apply with Apply settings.</p>
              {/* The recorded walkthrough, played into this session. Its records became
              carryable in f64267b03, when their checkpoint digests were recorded. */}
              <WalkthroughControl
                binding={SR08_TAPE}
                session={session}
                onPlayed={(parameters) => {
                  setDraft({ ...(parameters as Sr08Parameters) });
                  setTyped(typedSr08Settings(parameters as Sr08Parameters));
                }}
              />
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
          {p.unitLayer === "gaussian" && (
            <aside className="notice" aria-label="Einstein’s printed field names">
              <p>
                In §6, (X, Y, Z) name the electric components and (L, M, N) the magnetic components.
                V is the speed of light and β is the factor now called γ. Einstein’s Gaussian field
                normalization differs from SI. The values and units below remain SI, including when
                this guide is open.
              </p>
            </aside>
          )}
          <FieldFrameChangePlot
            electricStationary={eStat}
            electricMoving={eMov}
            magneticStationary={bStat}
            magneticMoving={bMov}
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
                frames. Each vector lists its x, y and z components, in that order.
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
                  <th scope="row">Charge velocity u (Stationary K)</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="chargeVelocityStationary"
                      unit="m/s"
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Charge velocity u′ (Moving k)</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="chargeVelocityMoving"
                      unit="m/s"
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
                  <th scope="row">Invariant E² − c²B² (K)</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="fieldInvariantE2MinusC2B2" />{" "}
                    (V/m)²
                  </td>
                </tr>
                <tr>
                  <th scope="row">Invariant E′² − c²B′² (k)</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="fieldInvariantE2MinusC2B2Moving"
                      unit="(V/m)²"
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Invariant E · B (K)</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="fieldInvariantEDotB"
                      unit="T·V/m"
                    />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Invariant E′ · B′ (k)</th>
                  <td>
                    <SnapshotReading
                      snapshot={snapshot}
                      quantityId="fieldInvariantEDotBMoving"
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
                  <th scope="row">Moving-frame force F′</th>
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
          <details>
            <summary>Why do the two frames give different forces?</summary>
            <p>
              Force is momentum change per unit time. Both the momentum components and the time
              between events depend on the frame. Compare the force from the moving frame’s fields
              with the transformed laboratory force, rather than requiring F and F′ to be equal. The
              frame k is the charge’s rest frame only when its velocity u′ is zero.
            </p>
            <div className="table-wrapper">
              <table>
                <caption>
                  One accepted charge state, two ways to calculate its moving-frame force
                </caption>
                <tbody>
                  {(
                    [
                      ["Electric contribution qE (K)", "electricForceStationary", "N"],
                      ["Magnetic contribution q(u × B) (K)", "magneticForceStationary", "N"],
                      ["Electric contribution qE′ (k)", "electricForceMoving", "N"],
                      ["Magnetic contribution q(u′ × B′) (k)", "magneticForceMoving", "N"],
                      ["Force from transformed fields (k)", "transverseForceComoving", "N"],
                      ["Force from transforming F (k)", "forceMovingFromFourForce", "N"],
                      [
                        "Difference between the two calculations",
                        "forceTransformationResidual",
                        "N",
                      ],
                      ["Time ratio dt′/dt along the charge’s motion", "particleTimeJacobian", ""],
                    ] as const
                  ).map(([label, quantityId, unit]) => (
                    <tr key={quantityId}>
                      <th scope="row">{label}</th>
                      <td>
                        <SnapshotReading snapshot={snapshot} quantityId={quantityId} unit={unit} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fine">
              The transformed-force calculation is a modern consistency check, not a premise of
              Einstein’s derivation. Small numerical residuals can remain after rounding. Choosing
              “Charge at rest in k” sets u′ to zero: the force there is entirely electric, making
              §6’s new manner of expression directly inspectable.
            </p>
          </details>
        </div>
      </div>

      {/* The caption's readings follow the instrument (dispatch 263). Above the predict gate they
          pushed the instrument more than 1000px down at 1440; every sentence is still here. */}
      <p data-detail="0">
        <noscript>
          <b className="reading-label">In one breath</b>
        </noscript>
        {withScripts(SR08_CAPTION.r0)}
      </p>
      <p data-detail="1">
        <noscript>
          <b className="reading-label">Full explanation</b>
        </noscript>
        {withScripts(SR08_CAPTION.r1)}
      </p>
      <p data-detail="2" hidden>
        <noscript>
          <b className="reading-label">Every step</b>
        </noscript>
        {withScripts(SR08_CAPTION.r2)}
      </p>
      <LabMargin>{withScripts(SR08_CAPTION.r3)}</LabMargin>

      <p className="fine">Not modeled: {SR08_NOT_MODELED.join("; ")}.</p>
      {/* The reader can read the evaluator that produced these numbers (am-f3e4). */}
      <ShowTheCode instrumentId="sr-08" listings={getKernelListingsForInstrument("sr-08")} />
    </section>
  );
}
