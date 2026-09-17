"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { getKernelListingsForInstrument } from "../../../content/kernel/listings.ts";
import {
  SR11_CAPTION,
  SR11_MODEL,
  SR11_NOT_MODELED,
  type Sr11Parameters,
} from "../../../experiments/sr11/definition.ts";
import { validateSr11Parameters } from "../../../experiments/sr11/parameters.ts";
import { createSr11Session, type PreparedSr11Example } from "../../../experiments/sr11/session.ts";
import type {
  AcceptedSnapshot,
  PublishedResult,
} from "../../../experiments/store/instanceStore.ts";
import { display, identity, result } from "../presentation.ts";
import { ShowTheCode } from "../ShowTheCode.tsx";
import { MovingMirrorPlot } from "./MovingMirrorPlot.tsx";

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
  const snapshot = view.accepted ?? session.getServerSnapshot().accepted;
  if (!snapshot) return null;
  const p = snapshot.parameters as Sr11Parameters;
  const [draft, setDraft] = useState(() => ({ ...example.parameters }));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReady(true);
  }, []);

  function apply(parameters: Sr11Parameters) {
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
    const checked = validateSr11Parameters(draft);
    if (checked.kind !== "accepted") {
      setError(checked.refusal.message);
      return;
    }
    apply(checked.data);
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
          <p className="eyebrow">SR-11 · Moving mirror reflection and radiation pressure</p>
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

      <p data-detail="0">{SR11_CAPTION.r0}</p>
      <p data-detail="1">{SR11_CAPTION.r1}</p>
      <p data-detail="2" hidden>
        {SR11_CAPTION.r2}
      </p>
      <p data-detail="3" hidden>
        {SR11_CAPTION.r3}
      </p>

      <p>
        Set the mirror velocity ratio β = v/c and incident angle φ, or select a preset scenario. The
        reflection modifies frequency, ray direction, and amplitude, while radiation pressure does
        mechanical work that conserves energy across reference frames.
      </p>

      <div className="lab-columns">
        <form onSubmit={submit} aria-label="Moving mirror reflection settings">
          <fieldset disabled={!ready}>
            <legend>Set mirror motion and incident ray</legend>
            <div className="input-grid">
              <label>
                Mirror velocity β = v/c
                <input
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
              </label>

              <label>
                Incident angle φ (degrees)
                <input
                  type="number"
                  name="incidentAngleDeg"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  max="180"
                  value={draft.incidentAngleDeg}
                  onChange={(event) =>
                    setDraft({ ...draft, incidentAngleDeg: Number(event.currentTarget.value) })
                  }
                />
              </label>

              <label>
                Incident energy density u
                <input
                  type="number"
                  name="incidentEnergyDensity"
                  inputMode="decimal"
                  step="0.1"
                  min="0.1"
                  max="100"
                  value={draft.incidentEnergyDensity}
                  onChange={(event) =>
                    setDraft({ ...draft, incidentEnergyDensity: Number(event.currentTarget.value) })
                  }
                />
              </label>

              <label>
                Mirror surface area Am
                <input
                  type="number"
                  name="mirrorArea"
                  inputMode="decimal"
                  step="0.1"
                  min="0.1"
                  max="100"
                  value={draft.mirrorArea}
                  onChange={(event) =>
                    setDraft({ ...draft, mirrorArea: Number(event.currentTarget.value) })
                  }
                />
              </label>

              <label>
                Description frame
                <select
                  name="frame"
                  value={draft.frame}
                  onChange={(event) =>
                    setDraft({ ...draft, frame: event.currentTarget.value as "lab" | "mirror" })
                  }
                >
                  <option value="lab">Laboratory frame (K)</option>
                  <option value="mirror">Mirror rest frame (k)</option>
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
                    beta: 0.6,
                    incidentAngleDeg: 0,
                    frame: "lab",
                  })
                }
              >
                Receding 0.6c (normal)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  apply({
                    ...p,
                    beta: -0.6,
                    incidentAngleDeg: 0,
                    frame: "lab",
                  })
                }
              >
                Approaching -0.6c (head-on)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  apply({
                    ...p,
                    beta: 0.6,
                    incidentAngleDeg: 30,
                    frame: "lab",
                  })
                }
              >
                Oblique 30° (0.6c)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  apply({
                    ...p,
                    beta: 0.6,
                    incidentAngleDeg: 53.13010235,
                    frame: "lab",
                  })
                }
              >
                Interception limit (53.13°)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  apply({
                    ...p,
                    beta: 0.6,
                    incidentAngleDeg: 0,
                    frame: "mirror",
                  })
                }
              >
                Mirror frame (0.6c)
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  apply({
                    ...p,
                    beta: 0,
                    incidentAngleDeg: 0,
                    frame: "lab",
                  })
                }
              >
                Stationary (β = 0)
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
          <MovingMirrorPlot
            beta={draft.beta}
            incidentAngleDeg={draft.incidentAngleDeg}
            phiReflectedDeg={phiReflDeg ?? 0}
            frequencyRatio={freqRatio ?? 1}
            radiationPressure={radPressure ?? 0}
            radiationForce={radForce ?? 0}
            incidentPower={pInc ?? 0}
            reflectedPower={pRefl ?? 0}
            workRate={pWork ?? 0}
            energyBalanceResidual={pResidual ?? 0}
            frame={draft.frame}
            isApplicable={isApplicable}
            notApplicableReason={notApplicableReason}
          />

          <h3>Accepted snapshot</h3>
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
                  <SnapshotReading snapshot={snapshot} quantityId="radiationPressure" /> Pa
                </td>
              </tr>
              <tr>
                <th scope="row">Radiation force F</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="radiationForce" /> N
                </td>
              </tr>
              <tr>
                <th scope="row">Incident power P_inc</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="incidentPower" /> W
                </td>
              </tr>
              <tr>
                <th scope="row">Reflected power P_refl</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="reflectedPower" /> W
                </td>
              </tr>
              <tr>
                <th scope="row">Work rate P·v·Am</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="workRate" /> W
                </td>
              </tr>
              <tr>
                <th scope="row">Energy balance residual</th>
                <td>
                  <SnapshotReading snapshot={snapshot} quantityId="energyBalanceResidual" /> W
                </td>
              </tr>
            </tbody>
          </table>

          <p>
            At normal incidence with a receding mirror (β = 0.6), the incident power is 0.4 IA_m,
            the reflected power is 0.1 IA_m, and the mirror receives mechanical work rate 0.3 IA_m.
            Energy conservation holds exactly with zero residual.
          </p>
        </div>
      </div>

      <ShowTheCode listings={getKernelListingsForInstrument("sr-11")} />

      <p className="fine">Not modeled: {SR11_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

export function MovingMirrorComparison({ example }: { example: PreparedSr11Example }) {
  return <MovingMirrorLab example={example} />;
}
