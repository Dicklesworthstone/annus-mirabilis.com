"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  SR08_CAPTION,
  SR08_MODEL,
  SR08_NOT_MODELED,
  type Sr08Parameters,
} from "../../../experiments/sr08/definition.ts";
import { validateSr08Parameters } from "../../../experiments/sr08/parameters.ts";
import { createSr08Session, type PreparedSr08Example } from "../../../experiments/sr08/session.ts";
import type { PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { display, identity, result } from "../presentation.ts";
import { FieldFrameChangePlot } from "./FieldFrameChangePlot.tsx";

const C_SI = 299792458;

function OutputReading({ item }: { item: PublishedResult | undefined }) {
  if (!item) return <span>missing</span>;
  if (item.status === "value") {
    if (typeof item.value === "number") {
      return <span data-quantity-id={item.quantityId}>{display(item.value)}</span>;
    }
    if (item.value instanceof Float64Array) {
      const formatted = Array.from(item.value)
        .map((v) => display(v))
        .join(", ");
      return <span data-quantity-id={item.quantityId}>({formatted})</span>;
    }
  }
  if (item.status === "not-applicable" || item.status === "outside-domain") {
    return <span data-quantity-id={item.quantityId}>{item.reason}</span>;
  }
  return <span data-quantity-id={item.quantityId}>{item.status}</span>;
}

function SnapshotReading({
  snapshot,
  quantityId,
}: {
  snapshot: Parameters<typeof result>[0];
  quantityId: string;
}) {
  return <OutputReading item={result(snapshot, quantityId)} />;
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
      setError(outcome.refusal.message);
      return;
    }
    setDraft(parameters);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateSr08Parameters(draft);
    if (checked.kind !== "accepted") {
      setError(checked.refusal.message);
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

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-08"
      {...identity(snapshot)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">SR-08 · Electrodynamics §6</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{SR08_MODEL.label}</span>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          The field transformations, invariant checks, and §6 new manner of expression remain
          available; changing the settings requires JavaScript.
        </p>
      </noscript>

      <p data-detail="0">{SR08_CAPTION.r0}</p>
      <p data-detail="1">{SR08_CAPTION.r1}</p>
      <p data-detail="2" hidden>
        {SR08_CAPTION.r2}
      </p>
      <p data-detail="3" hidden>
        {SR08_CAPTION.r3}
      </p>

      <div className="lab-columns">
        <form
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
              <label>
                Boost v/c
                <input
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
              </label>
              <label>
                Electric Ey (V/m)
                <input
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
              </label>
              <label>
                Magnetic Bz (T)
                <input
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
              </label>
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
            <h3>Transformation Ledger</h3>
            <table>
              <caption>
                Comparison of electromagnetic field quantities across stationary (K) and moving (k)
                frames.
              </caption>
              <tbody>
                <tr>
                  <th scope="row">E (Stationary K)</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="electricFieldStationary" /> V/m
                  </td>
                </tr>
                <tr>
                  <th scope="row">E′ (Moving k)</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="electricFieldMoving" /> V/m
                  </td>
                </tr>
                <tr>
                  <th scope="row">B (Stationary K)</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="magneticFieldStationary" /> T
                  </td>
                </tr>
                <tr>
                  <th scope="row">B′ (Moving k)</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="magneticFieldMoving" /> T
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
                    <SnapshotReading snapshot={snapshot} quantityId="fieldInvariantEDotB" /> T·V/m
                  </td>
                </tr>
                <tr>
                  <th scope="row">Laboratory Force F</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="transverseForceLaboratory" /> N
                  </td>
                </tr>
                <tr>
                  <th scope="row">Comoving Force F′</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="transverseForceComoving" /> N
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
            onClick={() => setPrediction("none")}
          >
            No magnetic field
          </button>
          <button
            type="button"
            className={prediction === "perp" ? "selected" : "secondary"}
            onClick={() => setPrediction("perp")}
          >
            Perpendicular magnetic field B′z
          </button>
          <button
            type="button"
            className={prediction === "par" ? "selected" : "secondary"}
            onClick={() => setPrediction("par")}
          >
            Parallel magnetic field B′x
          </button>
        </div>
        {prediction ? (
          <div className="predict-feedback" role="status">
            <p>
              {prediction === "perp"
                ? "Correct. In the moving frame, B′z = −γ(v/c²)Ey = −2.5017×10⁻⁹ T appears perpendicular to both the boost and the electric field."
                : "According to Einstein §6, a boost transforms a transverse electric field into both an electric field E′y = γEy and a magnetic field B′z = −γ(v/c²)Ey."}
            </p>
          </div>
        ) : null}
      </section>

      <p className="fine">Not modeled: {SR08_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}
