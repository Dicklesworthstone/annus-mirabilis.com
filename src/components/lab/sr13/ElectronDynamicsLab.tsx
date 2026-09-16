"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  SR13_CAPTION,
  SR13_MODEL,
  SR13_NOT_MODELED,
  type Sr13Parameters,
} from "../../../experiments/sr13/definition.ts";
import { validateSr13Parameters } from "../../../experiments/sr13/parameters.ts";
import { createSr13Session, type PreparedSr13Example } from "../../../experiments/sr13/session.ts";
import type {
  AcceptedSnapshot,
  PublishedResult,
} from "../../../experiments/store/instanceStore.ts";
import { display, identity, result } from "../presentation.ts";
import { ElectronDynamicsPlot } from "./ElectronDynamicsPlot.tsx";

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
  const snapshot = view.accepted!;
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
      setError(outcome.refusal.message);
      return;
    }
    setDraft(parameters);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateSr13Parameters(draft);
    if (checked.kind !== "accepted") {
      setError(checked.refusal.message);
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

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-13"
      {...identity(snapshot)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">SR-13 · Electron dynamics and force conventions</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{SR13_MODEL.label}</span>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Kinetic energy, accelerating potential, mass coefficients, and deflection curves remain available;
          changing the parameters requires JavaScript.
        </p>
      </noscript>
      <p data-detail="0">{SR13_CAPTION.r0}</p>
      <p data-detail="1">{SR13_CAPTION.r1}</p>
      <p data-detail="2" hidden>
        {SR13_CAPTION.r2}
      </p>
      <p data-detail="3" hidden>
        {SR13_CAPTION.r3}
      </p>
      <p>
        Section 10 examines the motion of a slowly accelerated electron in electromagnetic fields.
        By combining rest-frame dynamics with stationary coordinate measurements, Einstein derives
        longitudinal mass μγ³ and transverse mass μγ². Planck&apos;s laboratory force convention yields
        transverse mass μγ. Both conventions make identical predictions for physical deflections,
        potentials, and trajectories.
      </p>
      <div className="lab-columns">
        <form onSubmit={submit} aria-label="Electron dynamics controls">
          <fieldset disabled={!ready}>
            <legend>Set field strengths, initial speed, and conventions</legend>
            <div className="input-grid">
              <label>
                Initial speed β = v/c
                <input
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
              </label>
              <label>
                Electric field Ey (V/m)
                <input
                  type="number"
                  name="electricFieldY"
                  inputMode="decimal"
                  step="10000"
                  value={draft.electricFieldY}
                  onChange={(event) =>
                    setDraft({ ...draft, electricFieldY: Number(event.currentTarget.value) })
                  }
                />
              </label>
              <label>
                Magnetic field Bz (Tesla)
                <input
                  type="number"
                  name="magneticFieldZ"
                  inputMode="decimal"
                  step="0.005"
                  value={draft.magneticFieldZ}
                  onChange={(event) =>
                    setDraft({ ...draft, magneticFieldZ: Number(event.currentTarget.value) })
                  }
                />
              </label>
              <label>
                Force convention
                <select
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
              </label>
              <label>
                Mass language
                <select
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
              </label>
              <label>
                Historical dataset overlay
                <select
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
                  <option value="none">None (model curve only)</option>
                  <option value="kaufmann-1902-1906">Kaufmann 1902–1906 (Radium β-rays)</option>
                  <option value="bucherer-1908">Bucherer 1908 (Velocity filter)</option>
                </select>
              </label>
            </div>
            <div className="preset-list">
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
                Convention at 0.6c (1.5625m vs 1.25m)
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
                    datasetOverlay: "kaufmann-1902-1906",
                  })
                }
              >
                Kaufmann 1902–1906 overlay
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
                    datasetOverlay: "bucherer-1908",
                  })
                }
              >
                Bucherer 1908 overlay
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
          <ElectronDynamicsPlot
            initialSpeed={beta}
            initialDirectionDeg={draft.initialDirectionDeg}
            electricFieldX={draft.electricFieldX}
            electricFieldY={draft.electricFieldY}
            electricFieldZ={draft.electricFieldZ}
            magneticFieldX={draft.magneticFieldX}
            magneticFieldY={draft.magneticFieldY}
            magneticFieldZ={draft.magneticFieldZ}
            forceConvention={draft.forceConvention}
            massLanguage={draft.massLanguage}
            particle={draft.particle}
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
            datasetOverlay={draft.datasetOverlay}
          />
          <h3>Accepted snapshot</h3>
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
                  <SnapshotReading snapshot={snapshot} quantityId="longitudinalMass" /> kg
                </td>
              </tr>
              <tr>
                <th scope="row">Transverse mass: comoving (m · γ²)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="transverseMassComoving" /> kg
                </td>
              </tr>
              <tr>
                <th scope="row">Transverse mass: laboratory (m · γ)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="transverseMassLaboratory" /> kg
                </td>
              </tr>
              <tr>
                <th scope="row">Relativistic kinetic energy (W)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="kineticEnergy" /> J
                </td>
              </tr>
              <tr>
                <th scope="row">Accelerating potential (P = W/e)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="acceleratingPotential" /> V
                </td>
              </tr>
              <tr>
                <th scope="row">Magnetic curvature radius (R_m)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="radiusCurvatureMagnetic" /> m
                </td>
              </tr>
              <tr>
                <th scope="row">Electric curvature radius (R_e)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="radiusCurvatureElectric" /> m
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="fine">Not modeled: {SR13_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

export function ElectronDynamicsComparison({ example }: { example: PreparedSr13Example }) {
  return <ElectronDynamicsLab example={example} />;
}
