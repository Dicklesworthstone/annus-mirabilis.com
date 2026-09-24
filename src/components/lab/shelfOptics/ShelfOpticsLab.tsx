"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react";
import { executionLabelFor } from "../../../experiments/labels/executionLabelFor.ts";
import { executionLabelAttributes } from "../../../experiments/labels/resultAttributes.ts";
import {
  SHELF_CAPTIONS,
  SHELF_DEFINITIONS,
  type ShelfDraft,
  type ShelfId,
  shelfDraft,
} from "../../../experiments/shelfOptics/definition.ts";
import { evaluateShelfOptics } from "../../../experiments/shelfOptics/evaluation.ts";
import {
  applyShelfParameters,
  primaryShelfMetrics,
  type ShelfReport,
  shelfSnapshot,
} from "../../../experiments/shelfOptics/state.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { readablePowers } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";

/** Four significant figures: the models' inputs are given to about that, and ten figures showed
 * higher-order terms nobody can read ("0.400000005 fringes" for an ether shift of 0.4). */
function number(value: number): string {
  return value === 0
    ? "0"
    : readablePowers(Number(value.toPrecision(4)).toString()).replace(/^-/, "−");
}

/** A pure number has the unit "1", which is not written: "0.19", not "0.19 1". */
function unitText(unit: string | undefined): string {
  return unit === undefined || unit === "1" ? "" : unit;
}

/** The unit with its leading space, or nothing, so no space is left before punctuation. */
function spaced(unit: string | undefined): string {
  const text = unitText(unit);
  return text ? ` ${text}` : "";
}

function withUnit(unit: string | undefined): string {
  const text = unitText(unit);
  return text ? ` (${text})` : "";
}

/** Display geometry only. Bars, numbers and tables select the same accepted owner outputs. */
function ComparisonPlot({ report }: { report: ShelfReport }) {
  const titleId = useId();
  const points = primaryShelfMetrics(report);
  const extent = Math.max(...points.map((point) => Math.abs(point.value)));
  return (
    <figure className="shelf-plot" aria-labelledby={titleId}>
      <figcaption id={titleId}>{report.primaryMetric} · one common linear scale</figcaption>
      {points.map((point) => {
        const width = extent === 0 ? 0 : (50 * Math.abs(point.value)) / extent;
        return (
          <div className="shelf-plot-row" key={point.modelId} data-model-id={point.modelId}>
            <span>{point.modelLabel}</span>
            <div className="shelf-track" aria-hidden="true">
              <span className="shelf-zero" />
              <span
                className="shelf-bar"
                style={{ left: `${point.value < 0 ? 50 - width : 50}%`, width: `${width}%` }}
              />
            </div>
            <strong>
              {number(point.value)}
              {spaced(point.unit)}
            </strong>
          </div>
        );
      })}
      <p className="shelf-scale">
        {extent === 0
          ? "Every model gives zero for this observable at these settings. No nonzero bar is drawn."
          : `Bar range: ${number(-extent)} to +${number(extent)}${spaced(points[0]?.unit)}. The center line is zero. The scale is recalculated after Apply.`}
      </p>
    </figure>
  );
}

function ComparisonTable({ report }: { report: ShelfReport }) {
  const columns = report.rows[0]?.metrics ?? [];
  return (
    <section
      className="shelf-table-scroll"
      aria-label="Computed model comparison, scroll horizontally if needed"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
      tabIndex={0}
    >
      <table>
        <caption>Computed values · shared inputs · not experimental observations</caption>
        <thead>
          <tr>
            <th scope="col">Observable</th>
            {report.rows.map((row) => (
              <th scope="col" key={row.modelId}>
                {row.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.label}>
              <th scope="row">
                {column.label}
                {withUnit(column.unit)}
              </th>
              {report.rows.map((row) => {
                const metric = row.metrics.find((entry) => entry.label === column.label);
                return (
                  <td
                    key={row.modelId}
                    data-model-id={row.modelId}
                    data-owner-id={metric?.ownerId}
                    data-quantity-id={metric?.quantityId}
                    data-value={metric?.value}
                  >
                    {metric ? number(metric.value) : "Not supplied"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type PredictionRecord = Readonly<{
  text: string;
  before: ShelfReport;
  after: ShelfReport;
  revision: number;
}>;

/**
 * The one input each comparison's question turns on, kept beside the result. The calibration
 * fields (arm length, wavelength, water path, index, wavenumber) and the switches sit in the
 * Experiment settings drawer; they change the scale of the answer, not the question.
 */
const PRIMARY_FIELDS: Readonly<Record<ShelfId, readonly string[]>> = {
  "shelf-michelson-morley": ["beta"],
  "shelf-fizeau": ["waterSpeed"],
  "shelf-maxwell-galilean": ["beta"],
};

export function ShelfOpticsLab({
  example,
  laterEquation,
}: {
  example: ShelfReport;
  laterEquation?: ReactNode;
}) {
  const instance = useId();
  const definition = SHELF_DEFINITIONS[example.parameters.instrumentId];
  const caption = SHELF_CAPTIONS[example.parameters.instrumentId];
  const [initial] = useState(() => shelfSnapshot(example));
  const [accepted, setAccepted] = useState(initial);
  // Earned per state (am-inst-execution-labels-5ywv): the build's worked example until a reader's
  // settings are accepted, a host calculation after. There is no instance store here, so the test is
  // identity with the snapshot the lab started from, as in the reasoning workbenches (12a926b9).
  const executionKind = accepted === initial ? "static-example" : "host-accepted";
  const [draft, setDraft] = useState<ShelfDraft>(() => shelfDraft(example.parameters));
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState("");
  const [recordedPrediction, setRecordedPrediction] = useState<PredictionRecord | null>(null);
  const report = accepted.report;

  useEffect(() => {
    setReady(true);
  }, []);

  function edit(key: string, value: string | boolean) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setError("");
  }

  function apply(raw: unknown) {
    const result = applyShelfParameters(accepted, raw, evaluateShelfOptics);
    if (result.kind === "refused") {
      setError(result.message);
      return;
    }
    setRecordedPrediction(
      prediction.trim()
        ? {
            text: prediction,
            before: accepted.report,
            after: result.snapshot.report,
            revision: result.snapshot.revision,
          }
        : null,
    );
    setPrediction("");
    setAccepted(result.snapshot);
    setDraft(shelfDraft(result.snapshot.report.parameters));
    setDirty(false);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(draft);
  }

  const primaryKeys = PRIMARY_FIELDS[report.parameters.instrumentId];
  const primary = definition.fields.filter((field) => primaryKeys.includes(field.key));
  const secondary = definition.fields.filter((field) => !primaryKeys.includes(field.key));
  const settingsContents = [
    ...secondary.map((field) => field.label.toLowerCase()),
    ...(definition.switches.length > 0 ? ["the comparison switches"] : []),
  ].join(", ");

  function fieldRow(field: (typeof definition.fields)[number]) {
    return (
      <div className="shelf-field" key={field.key}>
        <label htmlFor={`${instance}-${field.key}`}>
          {field.label}
          {withUnit(field.unit)}
        </label>
        <input
          id={`${instance}-${field.key}`}
          type="text"
          inputMode="text"
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
          value={String(draft[field.key] ?? "")}
          aria-describedby={`${instance}-${field.key}-range`}
          onChange={(event) => edit(field.key, event.currentTarget.value)}
        />
        <small id={`${instance}-${field.key}-range`}>
          Supported range: {readablePowers(String(field.min))} to{" "}
          {readablePowers(String(field.max))}
          {spaced(field.unit)}. Scientific notation is accepted: type 10⁻⁹ as <kbd>1e-9</kbd>.
        </small>
      </div>
    );
  }

  return (
    <section
      className="shelf-lab laboratory"
      aria-labelledby={`${instance}-title`}
      data-instrument-id={report.parameters.instrumentId}
      data-instance-id={instance}
      data-run-id={`${instance}-${accepted.revision}`}
      data-snapshot-version={accepted.revision}
      data-input-revision={accepted.revision}
      data-accepted-input-revision={accepted.revision}
      // Evaluated synchronously on an accepted apply, so nothing is ever pending.
      data-pending="false"
      {...executionLabelAttributes(executionKind)}
      data-calibration="modern-si-2019"
      data-ready={String(ready)}
    >
      <header className="lab-heading">
        <h2 id={`${instance}-title`}>Change one setting and compare the consequences</h2>
        <span className="badge">{executionLabelFor(executionKind).text}</span>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. The complete default comparison below was calculated on the server by
          the reference owner. The controls require JavaScript; the numbers, equations and
          explanations do not.
        </p>
      </noscript>
      <div className="lab-columns">
        <form onSubmit={submit} noValidate aria-label={`${definition.title} settings`}>
          <fieldset disabled={!ready}>
            <legend className="visually-hidden">Model inputs · SI units</legend>
            <details className="lab-predict">
              <summary>Predict first</summary>
              <label htmlFor={`${instance}-prediction`}>
                Which model output will change, and why?
              </label>
              <textarea
                id={`${instance}-prediction`}
                rows={3}
                maxLength={2000}
                value={prediction}
                onChange={(event) => setPrediction(event.currentTarget.value)}
              />
              <p className="fine">
                Your next accepted calculation shows the before-and-after values beside this note.
                No score or answer gate is used. The note stays in this tab and is not uploaded or
                saved.
              </p>
            </details>
            {primary.map(fieldRow)}
            <div className="actions">
              <button type="submit">Apply settings</button>
              <button
                type="button"
                className="secondary"
                onClick={() => apply(definition.defaults)}
              >
                Restore illustrative defaults
              </button>
            </div>
            <ExperimentSettings contents={settingsContents}>
              {secondary.map(fieldRow)}
              {definition.switches.map((field) => (
                <label className="shelf-switch" key={field.key}>
                  <input
                    type="checkbox"
                    checked={draft[field.key] === true}
                    onChange={(event) => edit(field.key, event.currentTarget.checked)}
                  />
                  {field.label}
                </label>
              ))}
              <p className="fine">Changes here apply with Apply settings.</p>
            </ExperimentSettings>
          </fieldset>
          <p role="alert" data-shelf-error>
            {error}
          </p>
        </form>
        <div
          className="shelf-results lab-results"
          data-shelf-results
          data-revision={accepted.revision}
        >
          <ComparisonPlot report={report} />
          <p role="status" aria-atomic="true" className="fine">
            {dirty
              ? "Your edits are not applied yet. These results are from the last accepted calculation."
              : `Accepted calculation ${accepted.revision}. Every model row shares these inputs.`}
          </p>
          <details>
            <summary>Inputs used for these results</summary>
            <dl>
              {Object.entries(shelfDraft(report.parameters)).map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {definition.fields.find((field) => field.key === key)?.label ??
                      definition.switches.find((field) => field.key === key)?.label ??
                      key}
                  </dt>
                  <dd>
                    {readablePowers(String(value))}{" "}
                    {unitText(definition.fields.find((field) => field.key === key)?.unit)}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
          <ComparisonTable report={report} />
          <p className="shelf-interpretation">{report.interpretation}</p>
          {report.later.length > 0 && (
            <section
              className="shelf-later"
              aria-labelledby={`${instance}-later`}
              data-historical-status="later-development"
            >
              <h3 id={`${instance}-later`}>Later relativistic comparison · not a 1904 premise</h3>
              <p>
                This compares forward light speeds, not an additional observed fringe dataset.
                Velocity increments are shown separately so their small difference is not hidden by
                the much larger light speed.
              </p>
              {laterEquation}
              <dl>
                {report.later.map((metric) => (
                  <div key={metric.label}>
                    <dt>{metric.label}</dt>
                    <dd data-owner-id={metric.ownerId}>
                      {number(metric.value)}
                      {spaced(metric.unit)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {recordedPrediction && (
            <section className="shelf-prediction" aria-labelledby={`${instance}-comparison`}>
              <h3 id={`${instance}-comparison`}>
                Your prediction for calculation {recordedPrediction.revision}
              </h3>
              <p className="shelf-prediction-text">{recordedPrediction.text}</p>
              <p>
                Before → after, for {report.primaryMetric}. Both sides are model calculations, not
                observations.
              </p>
              <dl>
                {primaryShelfMetrics(recordedPrediction.before).map((before) => {
                  const after = primaryShelfMetrics(recordedPrediction.after).find(
                    (point) => point.modelId === before.modelId,
                  );
                  return (
                    <div key={before.modelId}>
                      <dt>{before.modelLabel}</dt>
                      <dd>
                        {number(before.value)} → {after ? number(after.value) : "not supplied"}{" "}
                        {unitText(before.unit)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          )}
        </div>
      </div>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(caption.r0)}</p>
      <p data-detail="1">{withScripts(caption.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(caption.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(caption.r3)}
      </p>
    </section>
  );
}
