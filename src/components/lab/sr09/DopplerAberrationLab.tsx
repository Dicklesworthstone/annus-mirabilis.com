"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  SR09_CAPTION,
  SR09_MODEL,
  SR09_NOT_MODELED,
  type Sr09Parameters,
} from "../../../experiments/sr09/definition.ts";
import { validateSr09Parameters } from "../../../experiments/sr09/parameters.ts";
import { createSr09Session, type PreparedSr09Example } from "../../../experiments/sr09/session.ts";
import type {
  AcceptedSnapshot,
  PublishedResult,
} from "../../../experiments/store/instanceStore.ts";
import { display, identity, result } from "../presentation.ts";
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
  return <span data-quantity-id={quantityId}>{item.status}</span>;
}

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
  const snapshot = (view.accepted ?? session.getServerSnapshot().accepted) as AcceptedSnapshot;
  const p = snapshot.parameters as Sr09Parameters;
  const [draft, setDraft] = useState(() => ({ ...example.parameters }));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setReady(true);
  }, []);
  function apply(parameters: Sr09Parameters) {
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
    const checked = validateSr09Parameters(draft);
    if (checked.kind !== "accepted") {
      setError(checked.refusal.message);
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
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-09"
      {...identity(snapshot)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">SR-09 · Doppler and aberration</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{SR09_MODEL.label}</span>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Frequency ratios, the transverse case, and the classical comparison remain available;
          changing the settings requires JavaScript.
        </p>
      </noscript>
      <p data-detail="0">{SR09_CAPTION.r0}</p>
      <p data-detail="1">{SR09_CAPTION.r1}</p>
      <p data-detail="2" hidden>
        {SR09_CAPTION.r2}
      </p>
      <p data-detail="3" hidden>
        {SR09_CAPTION.r3}
      </p>
      <p>
        Type a speed and an angle, or choose a named ray. Frequency and direction come from one
        wave-vector transform. The transverse case (θ = 90°) is the purely relativistic shift: the
        medium formulae give no change.
      </p>
      <div className="lab-columns">
        <form onSubmit={submit} aria-label="Doppler and aberration settings">
          <fieldset disabled={!ready}>
            <legend>Set the observer and the ray</legend>
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
                  value={draft.beta}
                  onChange={(event) =>
                    setDraft({ ...draft, beta: Number(event.currentTarget.value) })
                  }
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
                  value={draft.propagationAngleDeg}
                  onChange={(event) =>
                    setDraft({ ...draft, propagationAngleDeg: Number(event.currentTarget.value) })
                  }
                />
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-frequencyTHz`}>Frequency in K (THz)</label>
                <input
                  id={`${id}-frequencyTHz`}
                  type="number"
                  name="frequencyTHz"
                  inputMode="decimal"
                  min="1"
                  value={draft.frequencyTHz}
                  onChange={(event) =>
                    setDraft({ ...draft, frequencyTHz: Number(event.currentTarget.value) })
                  }
                />
              </div>
            </div>
            <div className="preset-list">
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
            <button type="submit">Apply settings</button>
            {error ? (
              <p className="notice" role="alert">
                {error}
              </p>
            ) : null}
          </fieldset>
        </form>
        <div className="lab-results">
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
          <h3>Accepted snapshot</h3>
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
      <p className="fine">Not modeled: {SR09_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

export function DopplerAberrationComparison({ example }: { example: PreparedSr09Example }) {
  return <DopplerAberrationLab example={example} />;
}
