"use client";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { getKernelListingsForInstrument } from "../../../content/kernel/listings.ts";
import { statusMessage } from "../../../experiments/results/explanations.ts";
import {
  SR11_CAPTION,
  SR11_MODEL,
  SR11_NOT_MODELED,
  type Sr11Parameters,
} from "../../../experiments/sr11/definition.ts";
import { createSr11Session, type PreparedSr11Example } from "../../../experiments/sr11/session.ts";
import type {
  AcceptedSnapshot,
  PublishedResult,
} from "../../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { display, identity, result } from "../presentation.ts";
import { Sci } from "../Sci.tsx";
import { ShowTheCode } from "../ShowTheCode.tsx";
import { SliderField } from "../SliderField.tsx";
import { withScripts } from "../subscripts.tsx";
import { MovingMirrorPlot } from "./MovingMirrorPlot.tsx";

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
        {/* The powers are in watts at the speed of light, around 10^8: a power of ten reads, nine
            digits do not. */}
        {Math.abs(item.value) >= 1e5 ? <Sci value={item.value} digits={4} /> : display(item.value)}
        {unit ? ` ${unit}` : ""}
      </span>
    );
  }
  if (item.status === "outside-domain" || item.status === "not-applicable") {
    return <span data-quantity-id={quantityId}>{item.reason}</span>;
  }
  return <span data-quantity-id={quantityId}>{statusMessage(item.status)}</span>;
}

type NumericKey = "beta" | "incidentAngleDeg" | "incidentEnergyDensity" | "mirrorArea";

const FIELD_LABELS: Readonly<Record<NumericKey, string>> = {
  beta: "Mirror velocity β = v/c",
  incidentAngleDeg: "Incident angle φ",
  incidentEnergyDensity: "Incident energy density u",
  mirrorArea: "Mirror surface area A_{m}",
};

export function MovingMirrorLab({
  example,
  title = "Moving mirror reflection and radiation pressure",
}: {
  example: PreparedSr11Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createSr11Session(`sr11-${id}`, example));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const [drafts, setDrafts] = useState<Partial<Record<NumericKey, string>>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReady(true);
  }, []);

  const snapshot = view.accepted ?? session.getServerSnapshot().accepted;
  if (!snapshot) return null;
  const p = snapshot.parameters as Sr11Parameters;

  function apply(parameters: Sr11Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      setError(outcome.refusal.message);
      return false;
    }
    setError("");
    return true;
  }

  function preset(change: Partial<Sr11Parameters>) {
    setDrafts({});
    apply({ ...p, ...change });
  }

  /** Commit one typed or dragged value against the accepted settings. */
  function commit(key: NumericKey, text: string) {
    const n = Number(text.trim());
    if (text.trim() === "" || !Number.isFinite(n)) {
      setDrafts((d) => ({ ...d, [key]: text }));
      setError(`${FIELD_LABELS[key]}: enter a number.`);
      return;
    }
    if (apply({ ...p, [key]: n })) {
      setDrafts((d) => {
        const { [key]: _done, ...rest } = d;
        return rest;
      });
    } else {
      setDrafts((d) => ({ ...d, [key]: text }));
    }
  }

  function field(key: NumericKey) {
    return {
      id: `${id}-${key}`,
      label: FIELD_LABELS[key],
      value: drafts[key] ?? String(p[key]),
      onDraft: (v: string) => setDrafts((d) => ({ ...d, [key]: v })),
      onCommit: (v: string) => commit(key, v),
    };
  }

  const freqRatio = numericOf(result(snapshot, "frequencyRatio"));
  const phiReflDeg = numericOf(result(snapshot, "phiReflectedDeg"));
  const radPressure = numericOf(result(snapshot, "radiationPressure"));
  const radForce = numericOf(result(snapshot, "radiationForce"));
  const pInc = numericOf(result(snapshot, "incidentPower"));
  const pRefl = numericOf(result(snapshot, "reflectedPower"));
  const pWork = numericOf(result(snapshot, "workRate"));
  const pResidual = numericOf(result(snapshot, "energyBalanceResidual"));

  const isApplicable = freqRatio !== null;
  const notApplicableItem = result(snapshot, "frequencyRatio");
  const notApplicableReason = "reason" in notApplicableItem ? notApplicableItem.reason : undefined;

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-11"
      {...identity(snapshot)}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">Moving mirror reflection and radiation pressure</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{SR11_MODEL.label}</span>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          Frequency ratios, radiation pressure, and energy ledgers remain available; changing the
          settings requires JavaScript.
        </p>
      </noscript>

      <div className="lab-columns">
        <div>
          <fieldset disabled={!ready} className="lab-choice">
            <legend>Try</legend>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => preset({ beta: 0.6, incidentAngleDeg: 0, frame: "lab" })}
              >
                Receding 0.6c (normal)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => preset({ beta: -0.6, incidentAngleDeg: 0, frame: "lab" })}
              >
                Approaching -0.6c (head-on)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => preset({ beta: 0.6, incidentAngleDeg: 30, frame: "lab" })}
              >
                Oblique 30° (0.6c)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => preset({ beta: 0.6, incidentAngleDeg: 53.13010235, frame: "lab" })}
              >
                Interception limit (53.13°)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => preset({ beta: 0.6, incidentAngleDeg: 0, frame: "mirror" })}
              >
                Mirror frame (0.6c)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => preset({ beta: 0, incidentAngleDeg: 0, frame: "lab" })}
              >
                Stationary (β = 0)
              </button>
            </div>
          </fieldset>

          <fieldset disabled={!ready}>
            <SliderField {...field("beta")} unit="" min={-0.95} max={0.95} step={0.01} />
            <SliderField {...field("incidentAngleDeg")} unit="degrees" min={0} max={180} step={1} />
            <div className="input-field lab-slider">
              <label htmlFor={`${id}-frame`}>Description frame</label>
              <select
                id={`${id}-frame`}
                name="frame"
                value={p.frame}
                onChange={(event) =>
                  apply({ ...p, frame: event.currentTarget.value as "lab" | "mirror" })
                }
              >
                <option value="lab">Laboratory frame (K)</option>
                <option value="mirror">Mirror rest frame (k)</option>
              </select>
            </div>
            <ExperimentSettings contents="incident energy density, mirror area">
              <SliderField
                {...field("incidentEnergyDensity")}
                unit="energy per volume"
                min={0.1}
                max={100}
                step={0.1}
              />
              <SliderField {...field("mirrorArea")} unit="area" min={0.1} max={100} step={0.1} />
            </ExperimentSettings>
          </fieldset>
          {error ? (
            <p className="notice error" role="alert">
              {withScripts(error)}
            </p>
          ) : null}
        </div>

        <div className="lab-results">
          <MovingMirrorPlot
            beta={p.beta}
            incidentAngleDeg={p.incidentAngleDeg}
            phiReflectedDeg={phiReflDeg ?? 0}
            frequencyRatio={freqRatio ?? 1}
            radiationPressure={radPressure ?? 0}
            radiationForce={radForce ?? 0}
            incidentPower={pInc ?? 0}
            reflectedPower={pRefl ?? 0}
            workRate={pWork ?? 0}
            energyBalanceResidual={pResidual ?? 0}
            frame={p.frame}
            isApplicable={isApplicable}
            notApplicableReason={notApplicableReason}
          />

          <h3>Values at these settings</h3>
          <table>
            <caption>
              Relativistic wave reflection quantities and energy conservation ledger across frames.
            </caption>
            <tbody>
              <tr>
                <th scope="row">Frequency ratio ν′′′/ν</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="frequencyRatio" />
                </td>
              </tr>
              <tr>
                <th scope="row">Reflection cosine cos(φ′′′)</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="cosPhiReflected" />
                </td>
              </tr>
              <tr>
                <th scope="row">Reflection angle φ′′′</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="phiReflectedDeg" /> °
                </td>
              </tr>
              <tr>
                <th scope="row">Amplitude ratio A′′′/A</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="amplitudeRatio" />
                </td>
              </tr>
              <tr>
                <th scope="row">Radiation pressure P</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="radiationPressure" unit="Pa" />
                </td>
              </tr>
              <tr>
                <th scope="row">Radiation force F</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="radiationForce" unit="N" />
                </td>
              </tr>
              <tr>
                <th scope="row">Incident power</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="incidentPower" unit="W" />
                </td>
              </tr>
              <tr>
                <th scope="row">Reflected power</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="reflectedPower" unit="W" />
                </td>
              </tr>
              <tr>
                <th scope="row">
                  Work done on the mirror, P·v·A<sub>m</sub>
                </th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="workRate" unit="W" />
                </td>
              </tr>
              <tr>
                <th scope="row">Energy balance residual</th>
                <td>
                  <SnapshotReading
                    snapshot={snapshot}
                    quantityId="energyBalanceResidual"
                    unit="W"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <p>
            At normal incidence with a receding mirror (β = 0.6), the incident power is 0.4 IA
            <sub>m</sub>, the reflected power 0.1 IA<sub>m</sub>, and the mirror receives mechanical
            work at the rate 0.3 IA<sub>m</sub>. Energy is conserved exactly, with zero residual.
          </p>
        </div>
      </div>
      {/* The caption follows the instrument it describes; above it, it came between a phone's heading and the result. */}
      <p data-detail="0">{withScripts(SR11_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(SR11_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(SR11_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(SR11_CAPTION.r3)}
      </p>

      <ShowTheCode listings={getKernelListingsForInstrument("sr-11")} />

      <p className="fine">Not modeled: {SR11_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

export function MovingMirrorComparison({ example }: { example: PreparedSr11Example }) {
  return <MovingMirrorLab example={example} />;
}
