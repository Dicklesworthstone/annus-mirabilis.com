"use client";

import { useEffect, useId, useState } from "react";
import { sci } from "../../foundations/configurations.ts";
import {
  FLUX_BALANCE_LIMITS,
  FLUX_BALANCE_PRESETS,
  FLUX_REGIONS,
  type FluxBalance,
  type FluxBalanceDraft,
  type FluxBalanceField,
  type FluxBalanceRefusal,
  type FluxBalanceResult,
  type FluxRegionId,
  fluxBalance,
  fluxBalanceDraft,
  INITIAL_FLUX_BALANCE,
  readFluxBalance,
} from "../../foundations/fluxBalance.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";
import "./fluxBalance.css";

const FIELDS = [
  { id: "entering", label: "Crossings into the left stretch" },
  { id: "between", label: "Crossings from left stretch to right" },
  { id: "leaving", label: "Crossings out of the right stretch" },
  { id: "seconds", label: "Elapsed time (seconds)" },
  { id: "area", label: "Cross-sectional area (mm²)" },
] as const;
const shown = (value: number) => sci(value, 5);

/** The drawing changes its selected boundary, never the underlying crossings. */
function CrossingDiagram({
  balance,
  selected,
  summary,
}: {
  readonly balance: FluxBalance;
  readonly selected: FluxRegionId;
  readonly summary: string;
}) {
  const counts = [balance.inputs.entering, balance.inputs.between, balance.inputs.leaving];
  return (
    <svg
      className="bridge-figure"
      viewBox="0 0 320 184"
      role="img"
      aria-label={`Two connected stretches of tube, each one millimetre long. All counted crossings are rightward: ${counts[0]} enter on the left, ${counts[1]} pass through the middle, and ${counts[2]} leave on the right. The dashed outline is the region being counted. ${summary}`}
      data-flux-diagram={selected}
    >
      <text className="bridge-axis-name" x="160" y="20" textAnchor="middle">
        Same crossings, chosen boundary
      </text>
      {[42, 160].map((x) => (
        <rect key={x} className="bridge-bar-whole" x={x} y="70" width="118" height="62" />
      ))}
      <rect
        className="bridge-step"
        x={selected === "right" ? 156 : 38}
        y="62"
        width={selected === "whole" ? 244 : 126}
        height="78"
      />
      {[42, 160, 278].map((x, index) => (
        <g key={x}>
          <text className="bridge-number" x={x} y="46" textAnchor="middle">
            {counts[index]} cross
          </text>
          <line className="bridge-arrow" x1={x - 24} y1="78" x2={x + 17} y2="78" />
          <path className="bridge-marker" d={`M ${x + 24} 78 l -10 -5 v 10 Z`} />
        </g>
      ))}
      {(["left", "right"] as const).map((id, index) => (
        <g key={id}>
          <text className="bridge-axis-name" x={101 + 118 * index} y="108" textAnchor="middle">
            {balance.regions[id].initialCount} → {balance.regions[id].finalCount}
          </text>
          <text className="bridge-number" x={101 + 118 * index} y="158" textAnchor="middle">
            {id} stretch
          </text>
          <text className="bridge-number" x={101 + 118 * index} y="178" textAnchor="middle">
            1 mm long
          </text>
        </g>
      ))}
    </svg>
  );
}

export function FluxBalanceWorkbench({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const id = useId();
  const Title = headingTag(headingLevel, 1);
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(INITIAL_FLUX_BALANCE);
  const [draft, setDraft] = useState<FluxBalanceDraft>({
    entering: "7",
    between: "4",
    leaving: "5",
    seconds: "1",
    area: "1",
  });
  const [selected, setSelected] = useState<FluxRegionId>("whole");
  const [error, setError] = useState<FluxBalanceRefusal | null>(null);
  useEffect(() => setReady(true), []);

  if (accepted.kind !== "accepted")
    return <p>The counting construction is unavailable. The worked figures remain readable.</p>;

  const balance = accepted.balance;
  const view = balance.regions[selected];
  const label = FLUX_REGIONS.find((region) => region.id === selected)?.label ?? "Selected region";
  const pending = FIELDS.some((field) => draft[field.id] !== String(balance.inputs[field.id]));
  const change =
    view.change === 0
      ? "keeps the same count"
      : view.change > 0
        ? `gains ${view.change} particles`
        : `loses ${-view.change} particles`;
  const summary = `${label} ${change} over ${shown(balance.inputs.seconds)} seconds: ${view.initialCount} becomes ${view.finalCount}. Its average concentration goes from ${shown(view.initialConcentration)} to ${shown(view.finalConcentration)} particles per cubic millimetre.`;

  function accept(result: FluxBalanceResult) {
    if (result.kind === "refused") {
      setError(result);
      return;
    }
    setAccepted(result);
    setDraft(fluxBalanceDraft(result.balance));
    setError(null);
  }

  function update(field: FluxBalanceField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  const rows = [
    ["start", "Count at the start", view.initialCount],
    ["enter", "Enter through the chosen region's left edge", view.entered],
    ["leave", "Leave through its right edge", view.left],
    ["change", "Change in count", view.change],
    ["end", "Count at the end", view.finalCount],
    ["volume", "Volume of this region (mm³)", view.volume],
    [
      "density-start",
      "Average concentration at the start (particles/mm³)",
      view.initialConcentration,
    ],
    ["density-end", "Average concentration at the end (particles/mm³)", view.finalConcentration],
    ["flux-left", "Rightward flux at the left edge (particles/mm²/s)", view.leftFlux],
    ["flux-right", "Rightward flux at the right edge (particles/mm²/s)", view.rightFlux],
    ["density-rate", "Concentration change per second (particles/mm³/s)", view.concentrationRate],
    [
      "flux-balance",
      "Left flux minus right flux, divided by length (particles/mm³/s)",
      view.negativeFluxGradient,
    ],
  ] as const;

  return (
    <section className="flux-balance" aria-labelledby={`${id}-title`}>
      <Title id={`${id}-title`}>Try it: choose what counts as inside</Title>
      <p>
        Two adjoining stretches each start with {FLUX_BALANCE_LIMITS.initialCountPerStretch}{" "}
        particles and are each 1 mm long. Choose the crossings, then count either stretch or both
        together. These are authored counts, not measured data. No particles are made or destroyed,
        the walls stay fixed, and all crossings in this example go from left to right.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          accept(readFluxBalance(draft));
        }}
      >
        <fieldset className="construction-controls" disabled={!ready}>
          <legend>Choose one interval of crossings</legend>
          <div className="flux-balance-fields">
            {FIELDS.map(({ id: field, label: fieldLabel }) => {
              const invalid = error?.field === field;
              return (
                <label key={field} htmlFor={`${id}-${field}`}>
                  {fieldLabel}
                  <input
                    id={`${id}-${field}`}
                    name={`flux-${field}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={FLUX_BALANCE_LIMITS.textLength}
                    value={draft[field]}
                    aria-invalid={invalid || undefined}
                    aria-describedby={`${id}-help${invalid ? ` ${id}-error` : ""}`}
                    onInput={(event) => update(field, event.currentTarget.value)}
                  />
                </label>
              );
            })}
          </div>
          <p id={`${id}-help`} className="fine">
            Crossings are whole counts from 0 to 100. Time is 0.000001 to 60 seconds; area is
            0.000001 to 100 mm². Apply all values together. A region cannot end with a negative
            count.
          </p>
          <div className="actions">
            <button type="submit">Apply crossings and dimensions</button>
            {FLUX_BALANCE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="secondary"
                onClick={() => accept(fluxBalance({ ...balance.inputs, ...preset }))}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className="secondary"
              onClick={() => {
                accept(INITIAL_FLUX_BALANCE);
                setSelected("whole");
              }}
            >
              Restore the first example
            </button>
          </div>
          <p className="fine">
            The examples keep the displayed time and area. They replace any unfinished edits.
          </p>
        </fieldset>
      </form>
      {error ? (
        <p id={`${id}-error`} role="alert">
          {error.message} The drawing and table still show the last accepted crossings, time and
          area.
        </p>
      ) : pending ? (
        <p className="fine">Changes are waiting. Apply them to update the whole example.</p>
      ) : null}

      <fieldset className="construction-controls" disabled={!ready}>
        <legend>Choose the boundary around the same crossings</legend>
        <label htmlFor={`${id}-region`}>Region to count</label>
        <select
          id={`${id}-region`}
          name="flux-region"
          value={selected}
          onChange={(event) => {
            const region = FLUX_REGIONS.find((item) => item.id === event.currentTarget.value);
            if (region) setSelected(region.id);
          }}
        >
          {FLUX_REGIONS.map((region) => (
            <option key={region.id} value={region.id}>
              {region.label}
            </option>
          ))}
        </select>
      </fieldset>
      <div className="construction-display" data-flux-current>
        <p role="status" aria-live="polite" aria-atomic="true">
          {summary}
        </p>
        <CrossingDiagram balance={balance} selected={selected} summary={summary} />
        <table className="data-table">
          <caption>
            {label}, over {shown(balance.inputs.seconds)} seconds with area{" "}
            {shown(balance.inputs.area)} mm²
          </caption>
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, name, value]) => (
              <tr key={key}>
                <th scope="row">{name}</th>
                <td data-flux-value={key}>{shown(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {selected === "whole"
            ? `The ${balance.inputs.between} middle crossings leave the left stretch and enter the right one. They cancel from the combined count: only the ${view.entered} arrivals and ${view.left} departures at its outer edges change the total.`
            : `The middle is an edge of this region. The same crossing counts as leaving the left stretch and entering the right one; choosing the boundary changes the accounting, not the particles.`}
        </p>
        <p>
          Concentration counts what is inside per unit volume. Flux counts what crosses per unit
          area per second. Their last two table rows agree because the difference in boundary flux,
          divided by the region's length, is its average concentration change per second.
        </p>
      </div>
      <p className="fine">
        These are averages over the chosen region and time interval. They do not locate individual
        particles or say when within the interval a crossing happened. A steady stream keeps each
        count fixed while particles cross; no crossings keeps the same counts with zero transport.
        In both cases the concentration change is zero, for different reasons.
      </p>
    </section>
  );
}
