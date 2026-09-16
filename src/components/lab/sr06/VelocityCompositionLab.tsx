"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { fromSr06Draft, toSr06Draft } from "../../../experiments/sr06/controls.ts";
import {
  SR06_CAPTION,
  SR06_MODEL,
  SR06_NOT_MODELED,
  SR06_PRESETS,
  type Sr06Mode,
  type Sr06Parameters,
} from "../../../experiments/sr06/definition.ts";
import { decodeSr06Settings, encodeSr06Settings } from "../../../experiments/sr06/permalink.ts";
import { createSr06Session, type PreparedSr06Example } from "../../../experiments/sr06/session.ts";
import { result } from "../presentation.ts";
import { VelocityCompositionPlot } from "./VelocityCompositionPlot.tsx";

function Readout({
  snapshot,
  id,
  digits = 6,
}: {
  snapshot: NonNullable<
    ReturnType<ReturnType<typeof createSr06Session>["getSnapshot"]>["accepted"]
  >;
  id: string;
  digits?: number;
}) {
  const r = result(snapshot, id);
  if (r.status === "value" && typeof r.value === "number")
    return <span data-output={id}>{r.value.toFixed(digits)}</span>;
  const text = r.status === "not-applicable" ? r.reason : "reason" in r ? r.reason : "No value.";
  return (
    <span data-output={id} data-result-status={r.status}>
      {text}
    </span>
  );
}

export function VelocityCompositionLab({
  example,
  title = "Why speeds do not simply add",
}: {
  example: PreparedSr06Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createSr06Session(`sr06-${id}`, example.parameters));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const snapshot = view.accepted!;
  const p = snapshot.parameters as Sr06Parameters;
  const [draft, setDraft] = useState(() => toSr06Draft(p));
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [predict, setPredict] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const shared = decodeSr06Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toSr06Draft(shared.parameters));
      setNote(
        "Shared settings are loaded as a draft. The worked example stays until you apply them.",
      );
    } else if (shared.kind === "invalid") setNote(shared.message);
  }, []);

  function apply(next: Sr06Parameters) {
    const r = session.apply(next);
    if (r.kind !== "accepted") {
      setError(String(r.refusal.details?.requirements ?? r.refusal.message));
      return;
    }
    setError("");
    setDraft(toSr06Draft(next));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      apply(fromSr06Draft(draft));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Those settings were refused.");
    }
  }

  function setMode(mode: Sr06Mode) {
    apply({ ...p, mode });
  }

  return (
    <section className="laboratory-shell" aria-label={title} data-instrument-id="sr-06">
      <header className="lab-heading">
        <p className="eyebrow">{SR06_MODEL.label}</p>
        <h2>{title}</h2>
        <p className="caption-r0">{SR06_CAPTION.r0}</p>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. The worked case 0.6c with 0.6c composes to 15/17 of light speed, about
          0.882353c. Changing settings requires JavaScript.
        </p>
      </noscript>
      {predict === null ? (
        <form
          className="predict-block"
          onSubmit={(e) => {
            e.preventDefault();
            const chosen = new FormData(e.currentTarget).get("candidate");
            if (typeof chosen === "string") setPredict(chosen);
          }}
        >
          <p id={`${id}-predict`}>
            An object moves at 0.6c relative to a frame that moves at 0.6c. What speed does the
            platform measure?
          </p>
          <label>
            <input type="radio" name="candidate" value="galilean-sum" /> 1.2 times light speed
          </label>
          <label>
            <input type="radio" name="candidate" value="relativistic-15-17" /> About 0.88 of light
            speed
          </label>
          <label>
            <input type="radio" name="candidate" value="unchanged-0-6c" /> 0.6 of light speed
          </label>
          <button type="submit" disabled={!ready}>
            Record this prediction
          </button>
        </form>
      ) : (
        <p className="notice" data-prompt-id="sr-06-predict-collinear" data-candidate-id={predict}>
          Prediction recorded as {predict}. The composition below is the model, not a score.
        </p>
      )}
      <div className="lab-columns">
        <form onSubmit={submit} noValidate>
          <fieldset>
            <legend>Compose two motions</legend>
            <label htmlFor={`${id}-v`}>
              Frame speed v/c
              <input
                id={`${id}-v`}
                name="frameBeta"
                type="number"
                step="0.01"
                min="-0.95"
                max="0.95"
                value={draft.frameBeta}
                onChange={(e) => setDraft({ ...draft, frameBeta: e.target.value })}
              />
            </label>
            <label htmlFor={`${id}-w`}>
              Moving-frame speed w/c
              <input
                id={`${id}-w`}
                name="movingSpeed"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={draft.movingSpeed}
                onChange={(e) => setDraft({ ...draft, movingSpeed: e.target.value })}
              />
            </label>
            <label htmlFor={`${id}-alpha`}>
              Angle α in the moving frame (degrees)
              <input
                id={`${id}-alpha`}
                name="alphaDeg"
                type="number"
                step="1"
                value={draft.alphaDeg}
                onChange={(e) => setDraft({ ...draft, alphaDeg: e.target.value })}
              />
            </label>
            <fieldset>
              <legend>Mode</legend>
              {(["collinear", "angled", "two-boosts"] as const).map((mode) => (
                <label key={mode}>
                  <input
                    type="radio"
                    name="mode"
                    checked={p.mode === mode}
                    onChange={() => setMode(mode)}
                  />
                  {mode}
                </label>
              ))}
            </fieldset>
            {p.mode === "two-boosts" ? (
              <>
                <label htmlFor={`${id}-v2`}>
                  Second boost speed / c
                  <input
                    id={`${id}-v2`}
                    type="number"
                    step="0.01"
                    min="-0.95"
                    max="0.95"
                    value={draft.secondBeta}
                    onChange={(e) => setDraft({ ...draft, secondBeta: e.target.value })}
                  />
                </label>
                <label htmlFor={`${id}-a2`}>
                  Second boost angle (degrees)
                  <input
                    id={`${id}-a2`}
                    type="number"
                    step="1"
                    value={draft.secondAngleDeg}
                    onChange={(e) => setDraft({ ...draft, secondAngleDeg: e.target.value })}
                  />
                </label>
              </>
            ) : null}
            <label>
              <input
                type="checkbox"
                checked={p.showRapidity}
                onChange={() => apply({ ...p, showRapidity: !p.showRapidity })}
              />
              Show rapidity (Minkowski 1908 aid; not the 1905 presentation)
            </label>
            <button type="submit">Apply settings</button>
          </fieldset>
          {error ? <p className="notice error">{error}</p> : null}
          {note ? <p className="fine">{note}</p> : null}
          <p>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const href = encodeSr06Settings(p);
                if (typeof window !== "undefined") window.history.replaceState(null, "", href);
              }}
            >
              Copy these settings into the address
            </button>
          </p>
        </form>
        <div>
          <VelocityCompositionPlot snapshot={snapshot} />
          <table className="inference-summary">
            <caption>Accepted composition (fractions of c)</caption>
            <tbody>
              <tr>
                <th scope="row">U_x / c</th>
                <td>
                  <Readout snapshot={snapshot} id="composedUxOverC" />
                </td>
              </tr>
              <tr>
                <th scope="row">U_y / c</th>
                <td>
                  <Readout snapshot={snapshot} id="composedUyOverC" />
                </td>
              </tr>
              <tr>
                <th scope="row">U / c</th>
                <td>
                  <Readout snapshot={snapshot} id="composedSpeedOverC" />
                </td>
              </tr>
              <tr>
                <th scope="row">Printed §5 U / c</th>
                <td>
                  <Readout snapshot={snapshot} id="printedSpeedOverC" />
                </td>
              </tr>
              <tr>
                <th scope="row">Galilean |v + w| / c</th>
                <td>
                  <Readout snapshot={snapshot} id="galileanSpeedOverC" />
                </td>
              </tr>
              <tr>
                <th scope="row">Shortfall 1 − U/c</th>
                <td>
                  <Readout snapshot={snapshot} id="shortfall" digits={8} />
                </td>
              </tr>
              <tr>
                <th scope="row">Wigner rotation (degrees)</th>
                <td>
                  <Readout snapshot={snapshot} id="rotationDeg" digits={4} />
                </td>
              </tr>
            </tbody>
          </table>
          {p.showRapidity ? (
            <table className="inference-summary">
              <caption>Rapidity, a later geometric aid (Minkowski 1908)</caption>
              <tbody>
                <tr>
                  <th scope="row">φ(v)</th>
                  <td>
                    <Readout snapshot={snapshot} id="rapidityFrame" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">φ(w)</th>
                  <td>
                    <Readout snapshot={snapshot} id="rapidityMoving" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">φ(v) + φ(w)</th>
                  <td>
                    <Readout snapshot={snapshot} id="rapiditySum" />
                  </td>
                </tr>
              </tbody>
            </table>
          ) : null}
          <table className="inference-summary">
            <caption>Fizeau limit panel (Laue 1907 interpretation; no 1851 dataset here)</caption>
            <tbody>
              <tr>
                <th scope="row">Composition increment (m/s)</th>
                <td>
                  <Readout snapshot={snapshot} id="fizeauIncrement" digits={8} />
                </td>
              </tr>
              <tr>
                <th scope="row">Fresnel first order (m/s)</th>
                <td>
                  <Readout snapshot={snapshot} id="fresnelIncrement" digits={8} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <section className="action-contract">
        <h3>Same scientific action without the plot</h3>
        <p>
          Type v/c, w/c, and the angle. Read U_x, U_y, U, the shortfall from light speed, and, in
          two-boosts mode, the rotation angle from the table. Ask whether the result is still below
          light speed.
        </p>
      </section>
      <p className="not-modeled">Not modeled: {SR06_NOT_MODELED.join("; ")}.</p>
      <div>
        <p className="eyebrow">Presets</p>
        {SR06_PRESETS.map((preset) => (
          <button
            key={preset.presetId}
            type="button"
            className="secondary"
            onClick={() => apply({ ...p, ...preset.parameterValues })}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="caption-r1">{SR06_CAPTION.r1}</p>
      <p className="caption-r2" hidden>
        {SR06_CAPTION.r2}
      </p>
      <p className="caption-r3" hidden>
        {SR06_CAPTION.r3}
      </p>
    </section>
  );
}

export function VelocityCompositionComparison({ example }: { example: PreparedSr06Example }) {
  return <VelocityCompositionLab example={example} />;
}
