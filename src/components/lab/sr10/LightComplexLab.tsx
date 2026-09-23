"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  SR10_CAPTION,
  SR10_MODEL,
  SR10_NOT_MODELED,
  type Sr10Parameters,
} from "../../../experiments/sr10/definition.ts";
import { validateSr10Parameters } from "../../../experiments/sr10/parameters.ts";
import { createSr10Session, type PreparedSr10Example } from "../../../experiments/sr10/session.ts";
import type {
  AcceptedSnapshot,
  PublishedResult,
} from "../../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { display, identity, result } from "../presentation.ts";
import { LightComplexPlot } from "./LightComplexPlot.tsx";

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
  const snapshot = view.accepted;
  const p = (snapshot?.parameters ?? example.parameters) as Sr10Parameters;
  const [draft, setDraft] = useState(() => ({ ...example.parameters }));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReady(true);
  }, []);

  function apply(parameters: Sr10Parameters) {
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
    const checked = validateSr10Parameters(draft);
    if (checked.kind !== "accepted") {
      setError(checked.refusal.message);
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
  const volumeFactor = numericOf(result(snapshot, "volumeFactor"));
  const countermodelEnergy = numericOf(result(snapshot, "countermodelEnergyMoving"));
  const countermodelVolume = numericOf(result(snapshot, "countermodelVolumeMoving"));
  const countermodelEnergyFactor = numericOf(result(snapshot, "countermodelEnergyFactor"));
  const countermodelVolumeFactor = numericOf(result(snapshot, "countermodelVolumeFactor"));

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-10"
      {...identity(snapshot)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">The finite light complex</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{SR10_MODEL.label}</span>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Energy transformation, volume transformation, and the countermodel comparison remain
          available; changing the settings requires JavaScript.
        </p>
      </noscript>
      <p data-detail="0">{SR10_CAPTION.r0}</p>
      <p data-detail="1">{SR10_CAPTION.r1}</p>
      <p data-detail="2" hidden>
        {SR10_CAPTION.r2}
      </p>
      <p data-detail="3" hidden>
        {SR10_CAPTION.r3}
      </p>
      <div className="lab-columns">
        <form onSubmit={submit} aria-label="Light complex settings">
          <fieldset disabled={!ready}>
            <legend>Set observer speed and packet parameters</legend>
            <div className="lab-choice">
              <p className="fine">
                A bounded pulse of light does not transform like a solid rod. Its energy follows q =
                γ(1 − β cos φ) and its volume 1/q. The tempting mistake, &ldquo;it contracts like a
                rod&rdquo;, shows at φ = 90° in K, where q = γ and 1/γ differ by γ², and along the
                axis. At cos φ = β the energy factor equals 1/γ, so that ray cannot tell them apart.
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
                  value={draft.beta}
                  onChange={(event) =>
                    setDraft({ ...draft, beta: Number(event.currentTarget.value) })
                  }
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
                  value={draft.propagationAngleDeg}
                  onChange={(event) =>
                    setDraft({ ...draft, propagationAngleDeg: Number(event.currentTarget.value) })
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
                    value={draft.initialEnergyJ}
                    onChange={(event) =>
                      setDraft({ ...draft, initialEnergyJ: Number(event.currentTarget.value) })
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
                    value={draft.initialVolumeM3}
                    onChange={(event) =>
                      setDraft({ ...draft, initialVolumeM3: Number(event.currentTarget.value) })
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
                    Show material rod countermodel comparison (1/γ)
                  </label>
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
        <div className="lab-results">
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
                  <SnapshotReading snapshot={snapshot} quantityId="lightComplexEnergyMoving" /> J
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
                    <th scope="row">Countermodel E′ (1/γ)</th>
                    <td>
                      <SnapshotReading snapshot={snapshot} quantityId="countermodelEnergyMoving" />{" "}
                      J <span className="badge warning">(wrong model)</span>
                    </td>
                  </tr>
                  <tr className="countermodel-row">
                    <th scope="row">Countermodel V′ (1/γ)</th>
                    <td>
                      <SnapshotReading snapshot={snapshot} quantityId="countermodelVolumeMoving" />{" "}
                      m³ <span className="badge warning">(wrong model)</span>
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
      <p className="fine">Not modeled: {SR10_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

export function LightComplexComparison({ example }: { example: PreparedSr10Example }) {
  return <LightComplexLab example={example} />;
}
