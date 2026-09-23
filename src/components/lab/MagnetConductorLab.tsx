"use client";
import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  SR02_APPARATUS_CAPTIONS,
  SR02_APPARATUS_LABEL,
  SR02_CAPTION,
  SR02_MODEL,
  SR02_NOT_MODELED,
  type Sr02Parameters,
} from "../../experiments/sr02/definition.ts";
import { validateSr02Parameters } from "../../experiments/sr02/parameters.ts";
import { createSr02Session, type PreparedSr02Example } from "../../experiments/sr02/session.ts";
import type { AcceptedSnapshot, PublishedResult } from "../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import { display, identity, result } from "./presentation.ts";

const SPEED_06C = 0.6 * 299792458;

function OutputReading({ item }: { item: PublishedResult | undefined }) {
  if (!item) return <span>missing</span>;
  if (item.status === "value" && typeof item.value === "number") {
    return <span data-quantity-id={item.quantityId}>{display(item.value)}</span>;
  }
  if (item.status === "not-applicable" || item.status === "outside-domain") {
    return <span data-quantity-id={item.quantityId}>{item.reason}</span>;
  }
  if (item.status === "underdetermined") {
    return (
      <span data-quantity-id={item.quantityId} data-status="underdetermined">
        {item.neededInformation.join("; ")}
      </span>
    );
  }
  if (item.status === "symbolic") {
    return (
      <span data-quantity-id={item.quantityId} data-status="symbolic">
        {item.unspecifiedSymbols.join(", ")}
      </span>
    );
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

export function MagnetConductorLab({
  example,
  title = "Magnet and conductor",
}: {
  example: PreparedSr02Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createSr02Session(`sr02-${id}`, example));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const snapshot = (view.accepted ?? session.getServerSnapshot().accepted) as AcceptedSnapshot;
  const p = snapshot.parameters as Sr02Parameters;
  const [draft, setDraft] = useState(() => ({ ...example.parameters }));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setReady(true);
  }, []);
  function apply(parameters: Sr02Parameters) {
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
    const checked = validateSr02Parameters(draft);
    if (checked.kind !== "accepted") {
      setError(checked.refusal.message);
      return;
    }
    apply(checked.data);
  }
  const apparatus = p.mode === "apparatus";
  const resolutionOpen = p.resolution === "shown";
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id={apparatus ? "sr-02:apparatus" : "sr-02"}
      {...identity(snapshot)}
      data-execution-label={apparatus ? "static" : "host"}
      data-source-digest={example.sourceDigest}
      data-mode={p.mode}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">Magnet and conductor</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{apparatus ? SR02_APPARATUS_LABEL : SR02_MODEL.label}</span>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          The two descriptions, the named-speed comparison and the apparatus captions remain
          available; changing the settings requires JavaScript.
        </p>
      </noscript>
      <p data-detail="0">{SR02_CAPTION.r0}</p>
      <p data-detail="1">{SR02_CAPTION.r1}</p>
      <p data-detail="2" hidden>
        {SR02_CAPTION.r2}
      </p>
      <p data-detail="3" hidden>
        {SR02_CAPTION.r3}
      </p>
      <p>
        Choose which body is described as moving, type a speed, and inspect both accounts of the
        same current. No dragging is required. The ether-plus-local-time account is not declared
        refuted; at the speeds of real apparatus it agrees to first order in v/c.
      </p>
      <div className="lab-columns">
        <form
          onSubmit={submit}
          aria-label="Magnet and conductor settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset disabled={!ready}>
            <legend>Set the description</legend>
            <fieldset>
              <legend>Mode</legend>
              <label className="check">
                <input
                  type="radio"
                  name="mode"
                  checked={draft.mode === "analytic"}
                  onChange={() => setDraft({ ...draft, mode: "analytic" })}
                />{" "}
                Narrow analytic model
              </label>
              <label className="check">
                <input
                  type="radio"
                  name="mode"
                  checked={draft.mode === "apparatus"}
                  onChange={() => setDraft({ ...draft, mode: "apparatus" })}
                />{" "}
                Qualitative reconstruction
              </label>
            </fieldset>
            <fieldset>
              <legend>Description frame</legend>
              <label className="check">
                <input
                  type="radio"
                  name="descriptionFrame"
                  checked={draft.descriptionFrame === "magnet-rest"}
                  onChange={() => setDraft({ ...draft, descriptionFrame: "magnet-rest" })}
                />{" "}
                Magnet at rest
              </label>
              <label className="check">
                <input
                  type="radio"
                  name="descriptionFrame"
                  checked={draft.descriptionFrame === "conductor-rest"}
                  onChange={() => setDraft({ ...draft, descriptionFrame: "conductor-rest" })}
                />{" "}
                Conductor at rest
              </label>
            </fieldset>
            <div className="input-grid">
              <div className="input-field">
                <label htmlFor={`${id}-speed`}>Relative speed (m/s)</label>
                <input
                  id={`${id}-speed`}
                  type="number"
                  name="speed"
                  inputMode="decimal"
                  value={draft.speed}
                  onChange={(event) =>
                    setDraft({ ...draft, speed: Number(event.currentTarget.value) })
                  }
                />
              </div>
            </div>
            <div className="preset-list">
              <button
                type="button"
                className="secondary"
                onClick={() => apply({ ...p, speed: 10 })}
              >
                Show 10 m/s
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => apply({ ...p, speed: SPEED_06C })}
              >
                Show 0.6c
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => apply({ ...p, pathOrientation: "transverse", sliceDeclared: false })}
              >
                Path across the motion
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  apply({ ...p, pathOrientation: "along-motion", sliceDeclared: false })
                }
              >
                Path along the motion
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  apply({ ...p, pathOrientation: "along-motion", sliceDeclared: true })
                }
              >
                Declare the slice frame
              </button>
            </div>
            <button type="submit">Apply settings</button>
            <ExperimentSettings contents="the magnetic field strength and segment length">
              <div className="input-grid">
                <div className="input-field">
                  <label htmlFor={`${id}-magneticField`}>Uniform B (T)</label>
                  <input
                    id={`${id}-magneticField`}
                    type="number"
                    name="magneticField"
                    inputMode="decimal"
                    value={draft.magneticField}
                    onChange={(event) =>
                      setDraft({ ...draft, magneticField: Number(event.currentTarget.value) })
                    }
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-segmentLength`}>Segment length (m)</label>
                  <input
                    id={`${id}-segmentLength`}
                    type="number"
                    name="segmentLength"
                    inputMode="decimal"
                    value={draft.segmentLength}
                    onChange={(event) =>
                      setDraft({ ...draft, segmentLength: Number(event.currentTarget.value) })
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
          {apparatus ? (
            <ApparatusPanel
              motionState={p.motionState}
              resolutionOpen={resolutionOpen}
              onMotion={(motionState) => apply({ ...p, motionState })}
            />
          ) : (
            <AnalyticPanel snapshot={snapshot} />
          )}
        </div>
      </div>
      <p className="fine">Not modeled: {SR02_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

function ApparatusPanel({
  motionState,
  resolutionOpen,
  onMotion,
}: {
  motionState: Sr02Parameters["motionState"];
  resolutionOpen: boolean;
  onMotion: (state: Sr02Parameters["motionState"]) => void;
}) {
  return (
    <div data-panel="apparatus">
      <h3>Qualitative reconstruction</h3>
      <svg
        role="img"
        aria-labelledby="sr02-schematic"
        viewBox="0 0 320 120"
        width="100%"
        height="120"
      >
        <title id="sr02-schematic">
          Magnet, coil and galvanometer. Illustration only; no field is computed in this mode.
        </title>
        <rect x="20" y="40" width="70" height="40" fill="none" stroke="currentColor" />
        <text x="30" y="64" fontSize="11">
          magnet
        </text>
        <circle cx="160" cy="60" r="28" fill="none" stroke="currentColor" />
        <text x="142" y="64" fontSize="11">
          coil
        </text>
        <rect x="230" y="35" width="70" height="50" fill="none" stroke="currentColor" />
        <text x="236" y="64" fontSize="11">
          meter
        </text>
      </svg>
      <fieldset>
        <legend>Which body moves</legend>
        <label className="check">
          <input
            type="radio"
            name="motionState"
            checked={motionState === "magnet-moves"}
            onChange={() => onMotion("magnet-moves")}
          />{" "}
          Magnet moves
        </label>
        <label className="check">
          <input
            type="radio"
            name="motionState"
            checked={motionState === "coil-moves"}
            onChange={() => onMotion("coil-moves")}
          />{" "}
          Coil moves
        </label>
      </fieldset>
      <p>
        {motionState === "magnet-moves"
          ? SR02_APPARATUS_CAPTIONS.magnetMoves
          : SR02_APPARATUS_CAPTIONS.coilMoves}
      </p>
      <p>{SR02_APPARATUS_CAPTIONS.observation}</p>
      <details open={resolutionOpen || undefined}>
        <summary>How the 1905 paper removes this asymmetry (§6)</summary>
        <p data-resolution="section-6">{SR02_APPARATUS_CAPTIONS.resolution}</p>
      </details>
    </div>
  );
}

function AnalyticPanel({ snapshot }: { snapshot: Parameters<typeof result>[0] }) {
  const ratio = result(snapshot, "electromotiveForceConductorFrame");
  return (
    <div data-panel="analytic">
      <h3>Accepted snapshot</h3>
      <table>
        <caption>
          Both descriptions of the same event. The electromotive-force ratio names the simultaneity
          slice that fixed the path.
        </caption>
        <tbody>
          <tr>
            <th scope="row">B (magnet rest)</th>
            <td>
              <SnapshotReading snapshot={snapshot} quantityId="magneticFieldStationary" /> T
            </td>
          </tr>
          <tr>
            <th scope="row">E (magnet rest)</th>
            <td>
              <SnapshotReading snapshot={snapshot} quantityId="electricFieldStationary" /> V/m
            </td>
          </tr>
          <tr>
            <th scope="row">E′_y (conductor rest)</th>
            <td>
              <SnapshotReading snapshot={snapshot} quantityId="electricFieldMoving" /> V/m
            </td>
          </tr>
          <tr>
            <th scope="row">Force on q (magnet rest)</th>
            <td>
              <SnapshotReading snapshot={snapshot} quantityId="transverseForceLaboratory" /> N
            </td>
          </tr>
          <tr>
            <th scope="row">Force on q (conductor rest)</th>
            <td>
              <SnapshotReading snapshot={snapshot} quantityId="transverseForceComoving" /> N
            </td>
          </tr>
          <tr>
            <th scope="row">Electromotive force, magnet rest</th>
            <td>
              <SnapshotReading snapshot={snapshot} quantityId="electromotiveForceMagnetFrame" /> V
            </td>
          </tr>
          <tr>
            <th scope="row">Electromotive force, conductor rest</th>
            <td data-slice-frame="K">
              <SnapshotReading snapshot={snapshot} quantityId="electromotiveForceConductorFrame" />
              {ratio.status === "value" ? " V (slice: magnet rest K)" : null}
            </td>
          </tr>
          <tr>
            <th scope="row">Excess γ − 1</th>
            <td>
              <SnapshotReading snapshot={snapshot} quantityId="electromotiveForceExcess" />
            </td>
          </tr>
          <tr>
            <th scope="row">Endpoint offset</th>
            <td>
              <SnapshotReading snapshot={snapshot} quantityId="endpointSimultaneityOffset" /> s
            </td>
          </tr>
          <tr>
            <th scope="row">Circuit current</th>
            <td>
              <SnapshotReading snapshot={snapshot} quantityId="inducedCircuitCurrent" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function MagnetConductorComparison({ example }: { example: PreparedSr02Example }) {
  return <MagnetConductorLab example={example} />;
}
