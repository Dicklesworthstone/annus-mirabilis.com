"use client";

import { type FormEvent, useId, useState } from "react";
import { avogadroBasis } from "../../../experiments/avogadro/basis.ts";
import {
  AVOGADRO_FIELDS,
  type AvogadroKey,
  type AvogadroParameters,
  encodeAvogadroParameters,
} from "../../../experiments/avogadro/definition.ts";
import { evaluateAvogadro } from "../../../experiments/avogadro/session.ts";
import {
  AVOGADRO_STUDY_ROUTES,
  type AvogadroSensitivityStudy,
  type SensitivityPoint,
  parseSensitivityValues,
  studyAvogadroSensitivity,
} from "../../../experiments/avogadro/sensitivity.ts";
import { decodeResult } from "../../../experiments/results/codec.ts";
import { ResultStatusNote } from "../../../experiments/results/ResultStatusNote.tsx";
import { display, unitText } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";
import styles from "./AvogadroLab.module.css";

// Apply the same scientific-result boundary as the instance store before any trial is displayed.
const referenceOwner = (parameters: AvogadroParameters) => {
  const evaluated = evaluateAvogadro(parameters);
  return evaluated.kind === "accepted"
    ? { ...evaluated, outputs: evaluated.outputs.map(decodeResult) }
    : evaluated;
};

function inputReading(key: AvogadroKey, value: number) {
  if (key === "constantBasis") return avogadroBasis({ constantBasis: value }).label;
  if (key === "radiusKnown" || key === "independentModel") return value === 1 ? "Yes" : "No";
  return display(value);
}
function suggestedValues(key: AvogadroKey, parameters: AvogadroParameters): string {
  if (["constantBasis", "radiusKnown", "independentModel"].includes(key)) return "0, 1";
  if (key === "coefficient") return "1, 2.5";
  const value = parameters[key];
  const field = AVOGADRO_FIELDS[key];
  const candidates = [value * 0.8, value, value * 1.2]
    .map((candidate) => (key === "coordinateCount" ? Math.round(candidate) : candidate))
    .filter((candidate) => candidate >= field.min && candidate <= field.max);
  return [...new Set(candidates)].join(", ");
}

/** The table and its links carry one frozen study, not the current draft controls. */
function StudyRow({
  point,
  parameter,
  baseline = false,
}: {
  point: SensitivityPoint;
  parameter: AvogadroKey;
  baseline?: boolean;
}) {
  return (
    <tr>
      <th scope="row">
        {baseline ? "Baseline: " : "Trial: "}
        {inputReading(parameter, point.parameterValue)}
        <br />
        <a href={`/lab/avogadro-lab/?${encodeAvogadroParameters(point.parameters)}`}>
          Open these settings
        </a>
      </th>
      {point.readings.map(({ result, ratio, ratioReason }) => (
        <td
          key={result.quantityId}
          data-study-quantity-id={result.quantityId}
          data-study-result-status={result.status}
        >
          {result.status === "value" && typeof result.value === "number" ? (
            <>
              {display(result.value)} {unitText(result.unit)}
              {result.uncertainty?.kind === "statistical-interval" && (
                <p className="fine">
                  Conditional {100 * result.uncertainty.coverage}% interval:{" "}
                  {display(result.uncertainty.lower)} to {display(result.uncertainty.upper)}{" "}
                  {unitText(result.unit)}.
                </p>
              )}
            </>
          ) : (
            <ResultStatusNote result={result} />
          )}
          {!baseline && (
            <p className="fine">
              {ratio === null ? ratioReason : <>Trial / baseline: {display(ratio)}.</>}
            </p>
          )}
        </td>
      ))}
    </tr>
  );
}

export function AvogadroSensitivity({
  parameters,
  snapshotVersion,
  ready,
}: {
  parameters: AvogadroParameters;
  snapshotVersion: number;
  ready: boolean;
}) {
  const id = useId();
  const [parameter, setParameter] = useState<AvogadroKey>("alphaScale");
  const [values, setValues] = useState("0.8, 1, 1.2");
  const [accepted, setAccepted] = useState<Readonly<{
    study: AvogadroSensitivityStudy;
    sourceRevision: number;
  }> | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseSensitivityValues(values);
    if (parsed.kind !== "accepted") {
      setError(parsed.reason);
      return;
    }
    const decision = studyAvogadroSensitivity(parameters, parameter, parsed.values, referenceOwner);
    if (decision.kind !== "accepted") {
      setError(decision.reason);
      return;
    }
    setAccepted(Object.freeze({ study: decision.study, sourceRevision: snapshotVersion }));
    setError("");
    setMessage(
      `Calculated ${decision.study.points.length} trial settings across three routes. Only the selected input changed; the main laboratory settings are unchanged.`,
    );
  }
  const study = accepted?.study;
  return (
    <section aria-labelledby={`${id}-title`} data-avogadro-sensitivity>
      <h3 id={`${id}-title`}>Which observation moves which answer?</h3>
      <p>
        Predict which routes will change when you vary one input. Then compare their calculated
        answers while every other accepted input stays fixed. This explores sensitivity, not new
        measurements or a combined estimate.
      </p>
      <form onSubmit={submit} aria-label="One-input molecular-number study">
        <fieldset disabled={!ready}>
          <legend>Use the main laboratory's accepted settings as the baseline</legend>
          <div className="input-field">
            <label htmlFor={`${id}-parameter`}>Input to vary</label>
            <select
              id={`${id}-parameter`}
              value={parameter}
              onChange={(event) => {
                const key = event.target.value as AvogadroKey;
                setParameter(key);
                setValues(suggestedValues(key, parameters));
              }}
            >
              {Object.entries(AVOGADRO_FIELDS).map(([key, field]) => (
                <option key={key} value={key}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>
          <p>
            Accepted baseline: {inputReading(parameter, parameters[parameter])}. Units and allowed
            values follow the input label above.
          </p>
          <div className="input-field">
            <label htmlFor={`${id}-values`}>
              Trial values, separated by commas (at most seven)
            </label>
            <input
              id={`${id}-values`}
              type="text"
              maxLength={512}
              value={values}
              onChange={(event) => setValues(event.target.value)}
              required
            />
          </div>
          <button className="button" type="submit">
            Calculate the controlled study
          </button>
        </fieldset>
      </form>
      <noscript>
        <p>
          The main worked example remains readable above. Calculating a new sensitivity study
          requires JavaScript.
        </p>
      </noscript>
      {error && (
        <p className="notice" role="alert">
          {withScripts(error)} The previous completed study is unchanged.
        </p>
      )}
      <p role="status">{message}</p>
      {accepted && study && (
        <div data-study-source-revision={accepted.sourceRevision}>
          <p>
            Baseline: accepted revision {accepted.sourceRevision}, using{" "}
            {avogadroBasis(study.baseline.parameters).label.toLowerCase()} for its diffusion routes.
            Each trial preserves its own selected basis in its settings link. The radiation route
            keeps its historical constants.
            {accepted.sourceRevision !== snapshotVersion && (
              <>
                {" "}
                This is an earlier completed study; the main laboratory now has different accepted
                settings. Calculate again to use them.
              </>
            )}
          </p>
          <section
            className={styles.tableWrap}
            aria-label="Three-route sensitivity results"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard access to a horizontally scrollable results table
            tabIndex={0}
          >
            <table>
              <caption>
                {AVOGADRO_FIELDS[study.parameter].label}. Every other input is held fixed.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Setting</th>
                  {AVOGADRO_STUDY_ROUTES.map((route) => (
                    <th scope="col" key={route.id}>
                      {route.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <StudyRow point={study.baseline} parameter={study.parameter} baseline />
                {study.points.map((point) => (
                  <StudyRow key={point.parameterValue} point={point} parameter={study.parameter} />
                ))}
              </tbody>
            </table>
          </section>
          <p className="fine">
            The Brownian intervals remain conditional on exact auxiliary inputs. Ratios have no
            invented uncertainty intervals. The three routes share assumptions; their agreement is
            not a statistical test of independence.
          </p>
          <details>
            <summary>Inspect the inputs held fixed</summary>
            <dl>
              {Object.entries(AVOGADRO_FIELDS)
                .filter(([key]) => key !== study.parameter)
                .map(([key, field]) => (
                  <div key={key}>
                    <dt>{field.label}</dt>
                    <dd>
                      {inputReading(
                        key as AvogadroKey,
                        study.baseline.parameters[key as AvogadroKey],
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </details>
        </div>
      )}
    </section>
  );
}
