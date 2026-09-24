"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
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
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { display, identity, result } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";
import { FieldFrameChangePlot } from "./FieldFrameChangePlot.tsx";

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
  const [draft, setDraft] = useState<Sr08Parameters>(() => ({ ...example.parameters }));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState<string | null>(null);

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
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateSr08Parameters(draft);
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

      <p data-detail="0">{withScripts(SR08_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(SR08_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(SR08_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(SR08_CAPTION.r3)}
      </p>

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
                  value={draft.boost / C_SI}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      boost: Number(event.currentTarget.value) * C_SI,
                    })
                  }
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
                    value={draft.electricFieldY}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        electricFieldY: Number(event.currentTarget.value),
                      })
                    }
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-bz`}>Magnetic Bz (T)</label>
                  <input
                    id={`${id}-bz`}
                    type="number"
                    name="bz"
                    step="1e-9"
                    value={draft.magneticFieldZ}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        magneticFieldZ: Number(event.currentTarget.value),
                      })
                    }
                  />
                </div>
              </div>
              <p className="fine">Changes here apply with Apply settings.</p>
            </ExperimentSettings>
            {error ? (
              <p id={`${id}-error`} className="notice" role="alert">
                {error}
              </p>
            ) : null}
          </fieldset>
        </form>

        <div className="lab-results">
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

      <section className="predict-section">
        <h3>Predict: Appearing magnetic field</h3>
        <p>
          When a pure electric field in the y direction is described from a frame moving along x at
          0.6c, what magnetic field appears?
        </p>
        <div className="predict-choices">
          <button
            type="button"
            className={prediction === "none" ? "selected" : "secondary"}
            aria-pressed={prediction === "none"}
            onClick={() => setPrediction("none")}
          >
            No magnetic field
          </button>
          <button
            type="button"
            className={prediction === "perp" ? "selected" : "secondary"}
            aria-pressed={prediction === "perp"}
            onClick={() => setPrediction("perp")}
          >
            Perpendicular magnetic field B′z
          </button>
          <button
            type="button"
            className={prediction === "par" ? "selected" : "secondary"}
            aria-pressed={prediction === "par"}
            onClick={() => setPrediction("par")}
          >
            Parallel magnetic field B′x
          </button>
        </div>
        {prediction ? (
          <div className="predict-feedback" role="status">
            <p>
              The model: in Einstein&apos;s §6 a boost turns a transverse electric field into both
              an electric field E′y = γEy and a magnetic field B′z = −γ(v/c²)Ey, here −2.5017×10⁻⁹
              T, perpendicular to both the boost and the electric field.
            </p>
          </div>
        ) : null}
      </section>

      <p className="fine">Not modeled: {SR08_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}
