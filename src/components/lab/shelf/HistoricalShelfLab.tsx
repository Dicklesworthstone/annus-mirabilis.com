"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { typedOrNaN } from "../../../experiments/controls/typedNumber.ts";
import { executionLabelFor } from "../../../experiments/labels/executionLabelFor.ts";
import { executionLabelAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { deriveExecutionStateKind } from "../../../experiments/provenance/executionState.ts";
import {
  SHELF_DEFINITIONS,
  type ShelfField,
  type ShelfId,
  shelfDefaults,
  shelfFields,
  shelfPath,
} from "../../../experiments/shelf/definition.ts";
import {
  HISTORICAL_SHELF_BINDINGS,
  historicalShelfModelLabel,
  historicalShelfUnitLabel,
} from "../../../experiments/shelf/historicalExample.ts";
import { createShelfSession, type ShelfReading } from "../../../experiments/shelf/session.ts";
import { decodeShelfSettings, encodeShelfSettings } from "../../../experiments/shelf/settings.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type { Parameters, PublishedResult } from "../../../experiments/store/instanceStore.ts";
import { useInstrumentView } from "../../../experiments/store/useExperimentSnapshot.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { KEPT_RESULT } from "../keptResult.ts";
import { Sci } from "../Sci.tsx";

type Draft = Readonly<Record<string, string | boolean>>;

function draftFor(parameters: Parameters): Draft {
  return Object.fromEntries(
    Object.entries(parameters).map(([key, value]) => [
      key,
      typeof value === "boolean" ? value : String(value),
    ]),
  );
}

const PRIMARY_FIELDS: Readonly<Record<ShelfId, readonly string[]>> = {
  "shelf-michelson-morley": ["beta", "contraction"],
  "shelf-fizeau": ["waterSpeedFractionOfC", "hypothesis", "reversal"],
  "shelf-maxwell-galilean": ["beta", "map"],
};

function selectedModel(instrumentId: ShelfId, parameters: Parameters): string {
  switch (instrumentId) {
    case "shelf-michelson-morley":
      return parameters.contraction ? "With contraction" : "Without contraction";
    case "shelf-fizeau":
      return String(parameters.hypothesis);
    case "shelf-maxwell-galilean":
      return String(parameters.map);
  }
}

function ReadingValue({ result }: { result: PublishedResult | undefined }) {
  if (result?.status === "value" && typeof result.value === "number") {
    return <Sci value={result.value} digits={3} />;
  }
  if (result?.status === "outside-domain") {
    return <span>{result.reason}</span>;
  }
  return <span>This reading is unavailable.</span>;
}

/** Every cell selects an accepted owner output; neither the table nor the drawing solves a model. */
function ComparisonTable({
  readings,
  outputs,
  selected,
}: {
  readings: readonly ShelfReading[];
  outputs: readonly PublishedResult[];
  selected: string;
}) {
  const models = [...new Set(readings.map((reading) => reading.model))];
  const rows = readings.filter((reading) => reading.model === models[0]);
  return (
    <section
      className="table-scroll"
      aria-label="Computed hypothesis comparison, scroll horizontally if needed"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a horizontal reading region needs keyboard access
      tabIndex={0}
    >
      <table>
        <caption>Predictions at the accepted settings · illustrative model calculations</caption>
        <thead>
          <tr>
            <th scope="col">Observable</th>
            {models.map((model) => (
              <th key={model} scope="col" data-selected-model={model === selected}>
                {historicalShelfModelLabel(model)}
                {model === selected && <small> · selected</small>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                {row.label}
                {historicalShelfUnitLabel(row.unit) && ` (${historicalShelfUnitLabel(row.unit)})`}
              </th>
              {models.map((model) => {
                const reading = readings.find(
                  (item) => item.model === model && item.label === row.label,
                );
                const result = outputs.find((item) => item.quantityId === reading?.id);
                return (
                  <td
                    key={model}
                    data-model={model}
                    data-output={reading?.id}
                    data-owner-id={result?.ownerId}
                    data-quantity-id={result?.quantityId}
                    data-result-status={result?.status}
                    data-value={
                      result?.status === "value" && typeof result.value === "number"
                        ? result.value
                        : undefined
                    }
                  >
                    <ReadingValue result={result} />
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

/** Display-only orientation: the two fixed-length strokes do not depict a calculated contraction. */
function MichelsonOrientation({ orientation }: { orientation: string }) {
  const id = useId();
  const turned = orientation === "90";
  return (
    <figure>
      <svg
        viewBox="0 0 360 190"
        width="360"
        height="190"
        style={{ maxWidth: "100%", height: "auto" }}
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
        data-orientation={orientation}
      >
        <title id={`${id}-title`}>{`Two arms after a ${orientation}° turn`}</title>
        <desc id={`${id}-description`}>
          Arm {turned ? "B" : "A"} lies along the ether wind; arm {turned ? "A" : "B"} lies across
          it. The drawing is a schematic, not a scale representation of contraction.
        </desc>
        <g fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M90 145H265M90 145V35" />
          <path d="M265 132V158M77 35H103" />
          <path d="M175 80H290L278 74M290 80L278 86" strokeWidth="2" />
          <circle cx="90" cy="145" r="6" />
        </g>
        <g fill="currentColor" fontSize="15">
          <text x="170" y="169">
            Arm {turned ? "B" : "A"}
          </text>
          <text x="25" y="91">
            Arm {turned ? "A" : "B"}
          </text>
          <text x="172" y="65">
            Ether wind
          </text>
        </g>
      </svg>
      <figcaption>
        A quarter-turn exchanges the arms. The table compares the round trips parallel and
        perpendicular to the wind at either orientation. Schematic, not to scale.
      </figcaption>
    </figure>
  );
}

export function HistoricalShelfLab({
  instrumentId,
  title,
}: {
  instrumentId: ShelfId;
  title?: string | undefined;
}) {
  return <HistoricalShelfInstance key={instrumentId} instrumentId={instrumentId} title={title} />;
}

function HistoricalShelfInstance({
  instrumentId,
  title,
}: {
  instrumentId: ShelfId;
  title?: string | undefined;
}) {
  const instanceId = useId();
  const definition = SHELF_DEFINITIONS[instrumentId];
  const binding = HISTORICAL_SHELF_BINDINGS[instrumentId];
  const [fields] = useState(() => shelfFields(instrumentId, "1904"));
  const [session] = useState(() => createShelfSession(instrumentId, "1904", instanceId));
  const [initial] = useState(() => session.getSnapshot().accepted);
  const view = useInstrumentView(session);
  const accepted = view.accepted;
  const [draft, setDraft] = useState<Draft>(() => draftFor(shelfDefaults(instrumentId, "1904")));
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [refusal, setRefusal] = useState<Readonly<{ code: string; message: string }> | null>(null);
  const [linkNotice, setLinkNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [prediction, setPrediction] = useState("");
  const [recordedPrediction, setRecordedPrediction] = useState("");

  useEffect(() => {
    setReady(true);
    // Desk placements must not consume a different instrument's address or settings.
    if (window.location.pathname !== shelfPath(instrumentId, "1904")) return;
    const link = decodeShelfSettings(instrumentId, "1904", window.location.search);
    if (link.kind === "settings") {
      setDraft(draftFor(link.parameters));
      setDirty(true);
      setLoaded(true);
    } else if (link.kind === "invalid") {
      setLinkNotice(link.message);
    }
  }, [instrumentId]);

  if (!accepted) return <p className="notice">This comparison is unavailable.</p>;
  // The session validates every accepted publication against the shelf-optics owner contracts.
  // A draft, a loaded link, or a refused update never earns a new execution label.
  const executionKind = deriveExecutionStateKind({
    isStatic: accepted === initial,
    isUnavailable: accepted.outputs.some((output) => output.ownerId !== "shelf-optics"),
    primaryOutputs: accepted.outputs.map((output) => ({
      outputId: output.quantityId,
      ownerKind: "host-reference",
      acceptedThisSnapshot: output.ownerId === "shelf-optics",
    })),
  });
  const selected = selectedModel(instrumentId, accepted.parameters);
  const primary = fields.filter((field) => PRIMARY_FIELDS[instrumentId].includes(field.id));
  const secondary = fields.filter((field) => !PRIMARY_FIELDS[instrumentId].includes(field.id));

  function edit(field: string, value: string | boolean) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setRefusal(null);
  }

  function apply(parameters: Parameters) {
    const result = session.apply(parameters);
    if (result.kind === "refused") {
      setRefusal(result);
      return;
    }
    setDraft(draftFor(result.parameters));
    setDirty(false);
    setRefusal(null);
    setLoaded(false);
    setLinkNotice("");
    setRecordedPrediction(prediction.trim());
    setPrediction("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(
      Object.fromEntries(
        fields.map((field) => [
          field.id,
          field.kind === "number" ? typedOrNaN(String(draft[field.id] ?? "")) : draft[field.id],
        ]),
      ) as Parameters,
    );
  }

  function fieldRow(field: ShelfField) {
    const id = `${instanceId}-${field.id}`;
    return (
      <div className="input-field" key={field.id}>
        <label htmlFor={id}>{field.label}</label>
        {field.kind === "choice" ? (
          <select
            id={id}
            name={field.id}
            value={String(draft[field.id])}
            onChange={(event) => edit(field.id, event.currentTarget.value)}
          >
            {field.choices?.map((choice) => (
              <option key={choice} value={choice}>
                {field.id === "orientation" ? `${choice}°` : historicalShelfModelLabel(choice)}
              </option>
            ))}
          </select>
        ) : field.kind === "boolean" ? (
          <input
            id={id}
            name={field.id}
            type="checkbox"
            checked={draft[field.id] === true}
            aria-describedby={field.help ? `${id}-help` : undefined}
            onChange={(event) => edit(field.id, event.currentTarget.checked)}
          />
        ) : (
          <input
            id={id}
            name={field.id}
            type="text"
            inputMode="text"
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
            value={String(draft[field.id] ?? "")}
            aria-describedby={`${id}-help`}
            onChange={(event) => edit(field.id, event.currentTarget.value)}
          />
        )}
        {field.help && <small id={`${id}-help`}>{field.help}</small>}
      </div>
    );
  }

  return (
    <section
      className="laboratory"
      aria-labelledby={`${instanceId}-title`}
      data-instrument-id={instrumentId}
      data-mode="1904"
      data-mode-id={binding.modeId}
      data-preset-id={binding.presetId}
      data-mode-locked="true"
      data-observer-revision={accepted.revisions.observer}
      data-currency-state={refusal ? "refused" : "current"}
      data-refusal-code={refusal?.code}
      {...instrumentRootAttributes(view)}
      {...executionLabelAttributes(executionKind)}
    >
      <header className="lab-heading" data-case-heading>
        <div>
          <p className="eyebrow">1904 · Compare the hypotheses</p>
          <h2 id={`${instanceId}-title`}>{title ?? definition.title}</h2>
        </div>
        <span className="badge">{executionLabelFor(executionKind).text}</span>
      </header>
      <p className="lab-question">{definition.question}</p>
      <p>
        These are illustrative settings, not historical observations. Speeds are entered as
        fractions of the symbol <i>c</i>; no measured value of light speed is supplied.
      </p>

      <form onSubmit={submit} aria-label="Historical optical comparison settings">
        <fieldset disabled={!ready}>
          <legend>Change an assumption</legend>
          <div className="input-grid">{primary.map(fieldRow)}</div>
          <ExperimentSettings
            contents={secondary.map((field) => field.label.toLowerCase()).join(", ")}
          >
            <div className="input-grid">{secondary.map(fieldRow)}</div>
          </ExperimentSettings>
          <details>
            <summary>Make a prediction before applying</summary>
            <p>{definition.prediction}</p>
            <label htmlFor={`${instanceId}-prediction`}>Your prediction, optional</label>
            <textarea
              id={`${instanceId}-prediction`}
              maxLength={1000}
              value={prediction}
              onChange={(event) => setPrediction(event.currentTarget.value)}
            />
            <small>This note stays in this open comparison and is not sent or saved.</small>
          </details>
          <div className="actions">
            <button type="submit">Apply settings</button>
            <button type="button" onClick={() => apply(shelfDefaults(instrumentId, "1904"))}>
              Restore example settings
            </button>
          </div>
          {refusal && (
            <p className="notice" role="alert">
              {refusal.message} {KEPT_RESULT}
            </p>
          )}
        </fieldset>
        {loaded && (
          <p data-settings-loaded>Shared settings are in the form. Apply them to calculate.</p>
        )}
        {linkNotice && (
          <p className="notice" data-settings-notice>
            {linkNotice}
          </p>
        )}
        <noscript>
          <p>The worked comparison below is complete. Changing its settings requires JavaScript.</p>
        </noscript>
      </form>

      <p role="status" aria-live="polite" aria-atomic="true">
        {refusal
          ? KEPT_RESULT
          : dirty
            ? "The form has unapplied settings. The comparison still shows the last accepted settings."
            : `The comparison shows the accepted settings. Selected: ${historicalShelfModelLabel(selected)}.`}
      </p>
      {instrumentId === "shelf-michelson-morley" && (
        <MichelsonOrientation orientation={String(accepted.parameters.orientation)} />
      )}
      <ComparisonTable readings={session.readings} outputs={accepted.outputs} selected={selected} />
      {instrumentId === "shelf-michelson-morley" && (
        <p>
          Time units are one wavelength divided by <i>c</i>. A fringe shift is a number of fringes.
        </p>
      )}
      {instrumentId === "shelf-fizeau" && (
        <p>
          Time units are metres divided by <i>c</i>. The speed entries are multiples of <i>c</i>. A
          negative flow reverses the paths. The reversal option compares the two opposite flows.
        </p>
      )}
      {instrumentId === "shelf-maxwell-galilean" && (
        <p>
          Zero residual means this scalar wave satisfies the wave equation with its form unchanged.
          The Lorentz column tests the 1904 mathematical substitution; it does not select its
          physical interpretation.
        </p>
      )}
      {recordedPrediction && (
        <aside className="notice" data-recorded-prediction>
          <h3>Your prediction for this comparison</h3>
          <p>{recordedPrediction}</p>
          <p>
            Compare it with the accepted values above. You can change one assumption and try again.
          </p>
        </aside>
      )}
      <details>
        <summary>What the comparison tells us</summary>
        <p>{definition.explanation}</p>
      </details>
      <p>
        <strong>Not modeled:</strong> {definition.notModeled.join("; ")}.
      </p>
      <p>
        <a href={encodeShelfSettings(instrumentId, "1904", accepted.parameters)}>
          Link to these accepted settings
        </a>
        . The link restores the form; choose Apply settings to calculate.
      </p>
    </section>
  );
}
