"use client";

import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { typedOrNaN } from "../../../experiments/controls/typedNumber.ts";
import { ShareControl } from "../../../experiments/permalink/ShareControl.tsx";
import { refusalSentence } from "../../../experiments/results/refusalSentence.ts";
import type { RequestRefusal } from "../../../experiments/results/refusals.ts";
import {
  evaluateHistoricalSr04,
  type HistoricalSr04Inputs,
  SR04_HISTORICAL_DEFAULTS,
  SR04_HISTORICAL_MODE,
  SR04_HISTORICAL_PATH,
  validateHistoricalSr04,
} from "../../../experiments/sr04/historical.ts";
import {
  historicalSr04Tape,
  loadHistoricalSr04TapeFromUrl,
} from "../../../experiments/sr04/historicalTape.ts";

type Draft = Record<keyof HistoricalSr04Inputs, string>;
const draftOf = (p: HistoricalSr04Inputs): Draft => ({
  objectSpeed: String(p.objectSpeed),
  observerSpeed: String(p.observerSpeed),
  vOverC: String(p.vOverC),
});
const fields = [
  ["objectSpeed", "Object speed in the original frame (m/s)"],
  ["observerSpeed", "Observer speed in the original frame (m/s)"],
  ["vOverC", "Observer speed for the light-ray comparison (fraction of c)"],
] as const;

export function HistoricalGalileanLab({
  restoreSettingsFromUrl = false,
}: {
  restoreSettingsFromUrl?: boolean;
}) {
  const id = useId();
  const [accepted, setAccepted] = useState(SR04_HISTORICAL_DEFAULTS);
  const [draft, setDraft] = useState<Draft>(() => draftOf(SR04_HISTORICAL_DEFAULTS));
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState<RequestRefusal | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    if (!restoreSettingsFromUrl) return;
    let active = true;
    void loadHistoricalSr04TapeFromUrl(window.location.href).then((result) => {
      if (!active) return;
      if (result.kind === "loaded") {
        setDraft(draftOf(result.settings as HistoricalSr04Inputs));
        setNotice("The shared settings are in the form. Apply them to update the calculation.");
      } else if (result.kind === "not-restored") setNotice(result.notice);
    });
    return () => {
      active = false;
    };
  }, [restoreSettingsFromUrl]);
  const snapshot = useMemo(() => evaluateHistoricalSr04(accepted), [accepted]);
  const tape = useMemo(() => historicalSr04Tape(accepted), [accepted]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateHistoricalSr04(
      Object.fromEntries(fields.map(([key]) => [key, typedOrNaN(draft[key])])),
    );
    if (checked.kind !== "accepted") {
      setFailure(checked.refusal);
      setNotice("");
      return;
    }
    setAccepted(checked.data);
    setRevision((r) => r + 1);
    setFailure(null);
    setNotice(
      "Settings applied. The table now shows the Galilean predictions for your accepted settings.",
    );
  }
  const rows = [
    ["slowCaseGalilean", "Object speed assigned by the observer", snapshot.slowCaseGalilean, "m/s"],
    [
      "rightRayFraction",
      "Right-going ray in the moving coordinates",
      snapshot.rightRayFraction,
      "c",
    ],
    ["leftRayFraction", "Left-going ray in the moving coordinates", snapshot.leftRayFraction, "c"],
  ] as const;
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-04"
      data-instrument-mode={SR04_HISTORICAL_MODE}
      data-preset-id="sr-04-galilean-1904"
      data-accepted-input-revision={revision}
      data-currency-state={failure ? "refused" : "current"}
    >
      <header className="lab-heading">
        <p className="eyebrow">A Galilean change of frame · 1904 workspace</p>
        <h2 id={`${id}-title`}>Subtract the observer's motion</h2>
        <p className="fine">
          {revision === 0
            ? "Static worked example from illustrative settings"
            : "Calculated from your accepted settings"}
        </p>
      </header>
      <p>
        Ordinary mechanics assigns an object's velocity by subtracting the observer's velocity.
        Apply the same rule to two light rays in an ether frame and inspect the prediction.
      </p>
      <p>This pedagogical reconstruction uses x′ = x − vt and t′ = t, so u′ = u − v.</p>
      <p>
        The slow-object and light-ray examples have separate observer settings. Light-related speeds
        are declared fractions of c; no measured value of c is supplied.
      </p>
      <form onSubmit={submit} aria-label="Galilean comparison settings">
        <fieldset disabled={!hydrated} aria-describedby={`${id}-domain`}>
          <legend>Illustrative settings</legend>
          <p className="fine" id={`${id}-domain`}>
            Object and slow-case observer speeds run from −10,000 to +10,000 m/s. The
            light-comparison observer speed runs from −0.95 to +0.95 of c. An entry outside these
            stated ranges is refused, never rounded or clamped.
          </p>
          <div className="input-grid">
            {fields.map(([key, label]) => (
              <div className="input-field" key={key}>
                <label htmlFor={`${id}-${key}`}>{label}</label>
                <input
                  id={`${id}-${key}`}
                  name={key}
                  type="text"
                  value={draft[key]}
                  aria-invalid={failure?.affected.parameterIds?.includes(key) ? true : undefined}
                  aria-describedby={
                    failure?.affected.parameterIds?.includes(key) ? `${id}-error` : `${id}-domain`
                  }
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((current) => ({ ...current, [key]: value }));
                  }}
                />
              </div>
            ))}
          </div>
          <button type="submit">Apply settings</button>
        </fieldset>
      </form>
      {failure ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="notice error"
          data-refusal-code={failure.code}
        >
          {refusalSentence(failure)} The table keeps the last accepted settings.
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="notice">
          {notice}
        </p>
      ) : null}
      <div className="table-scroll">
        <table>
          <caption>Accepted Galilean predictions; the sign gives direction</caption>
          <thead>
            <tr>
              <th scope="col">Comparison</th>
              <th scope="col">Predicted velocity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, label, result, unit]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td data-output={key}>
                  {result.status === "value"
                    ? `${Number(result.value.toPrecision(8))} ${unit}`
                    : result.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        The differing light-ray values are the ether-frame prediction under this coordinate rule.
        Compare that expectation with the failed ether-drift searches and Poincaré's 1904 principle
        of relativity on the desk. This calculation alone does not decide which interpretation to
        keep.
      </p>
      <p className="fine">
        What is left out: apparatus details, measurement errors and any change to the Galilean time
        convention. These are calculations from illustrative settings, not historical measurements.
      </p>
      <details>
        <summary>Which code calculates the comparison?</summary>
        <p>
          The <code>galileanVelocity</code> owner in{" "}
          <code>src/physics/reference/kinematics.ts</code>
          calculates every velocity. This mode runs under the historical constant guard.
        </p>
      </details>
      <noscript>
        <p className="notice">
          JavaScript is off. The worked table is complete; editing settings requires JavaScript.
        </p>
      </noscript>
      {hydrated && tape ? (
        <ShareControl tape={tape} baseUrl={`${window.location.origin}${SR04_HISTORICAL_PATH}`} />
      ) : null}
    </section>
  );
}
