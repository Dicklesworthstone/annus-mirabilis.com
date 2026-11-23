"use client";

import { useEffect, useId, useState } from "react";
import { RAMP } from "../../foundations/bridgeFigures.ts";
import {
  INITIAL_RAMP_PARTITION,
  INTEGRATION_STRIP_LIMIT,
  type RampPartition,
  readRampPartition,
  REFERENCE_RAMP_PARTITION,
  type StripRule,
} from "../../foundations/integrationStrips.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

const W = 300;
const H = 168;
const LEFT = 34;
const RIGHT = 280;
const BASE = 124;
const TOP = 26;
const x = (position: number) => LEFT + (position / RAMP.micrometres) * (RIGHT - LEFT);
const y = (density: number) => BASE - (density / RAMP.topDensity) * (BASE - TOP);
const shown = (value: number) => String(Number(value.toPrecision(6)));
const RULE_LABELS: Readonly<Record<StripRule, string>> = {
  left: "Left edge",
  midpoint: "Midpoint",
  right: "Right edge",
};

function totalFor(partition: RampPartition, rule: StripRule): number {
  return rule === "left"
    ? partition.leftTotal
    : rule === "right"
      ? partition.rightTotal
      : partition.midpointTotal;
}

/** Both drawings use one accepted partition for their rectangles, labels and accessible text. */
function StripDrawing({ partition, rule }: { partition: RampPartition; rule: StripRule }) {
  const total = totalFor(partition, rule);
  const description =
    `The same density rises from zero to ${RAMP.topDensity} per micrometre in a straight line ` +
    `across ${RAMP.micrometres} micrometres. These ${partition.count} rectangles take the height ` +
    `at their ${RULE_LABELS[rule].toLowerCase()}; each is ${shown(partition.width)} micrometres wide. ` +
    `Their areas add to ${shown(total)}, compared with the exact triangle area ` +
    `${shown(partition.exactArea)}. The line and its enclosed area stay fixed when the rectangles change.`;
  return (
    <svg
      className="bridge-figure"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={description}
    >
      <text className="bridge-axis-name" x="2" y="14">
        {partition.count} strips: total {shown(total)}
      </text>
      {partition.strips.map((strip) => {
        const sample = strip.samples[rule];
        return (
          <g key={strip.index}>
            <rect
              className="bridge-bar-share"
              data-integration-strip={strip.index}
              x={x(strip.left)}
              y={y(sample.height)}
              width={x(strip.width) - x(0)}
              height={BASE - y(sample.height)}
            />
            <rect
              className="bridge-bar-whole"
              x={x(strip.left)}
              y={y(sample.height)}
              width={x(strip.width) - x(0)}
              height={BASE - y(sample.height)}
            />
          </g>
        );
      })}
      <line
        className="bridge-line"
        x1={x(0)}
        y1={y(0)}
        x2={x(RAMP.micrometres)}
        y2={y(RAMP.topDensity)}
      />
      <line className="bridge-axis" x1={LEFT} y1={TOP - 8} x2={LEFT} y2={BASE} />
      <line className="bridge-axis" x1={LEFT} y1={BASE} x2={RIGHT} y2={BASE} />
      {[0, RAMP.micrometres].map((tick) => (
        <text key={tick} className="bridge-number" x={x(tick)} y={BASE + 18} textAnchor="middle">
          {tick}
        </text>
      ))}
      <text className="bridge-number" x={LEFT - 6} y={y(RAMP.topDensity) + 4} textAnchor="end">
        {RAMP.topDensity}
      </text>
      <text className="bridge-axis-name" x={(LEFT + RIGHT) / 2} y={H - 6} textAnchor="middle">
        micrometres
      </text>
    </svg>
  );
}

/** Refine a sum while keeping the density fixed; invalid drafts never replace accepted results. */
export function AddingInStrips({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const id = useId();
  const Title = headingTag(headingLevel);
  const Sub = headingTag(headingLevel, 1);
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(INITIAL_RAMP_PARTITION);
  const [draft, setDraft] = useState(String(INITIAL_RAMP_PARTITION.count));
  const [rule, setRule] = useState<StripRule>("left");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setReady(true), []);

  function apply(text: string) {
    const result = readRampPartition(text);
    if (result.kind === "refused") {
      setError(
        `${result.message} The adjustable drawing and totals still use ` +
          `${accepted.count} accepted strips.`,
      );
      return;
    }
    setAccepted(result.partition);
    setDraft(String(result.partition.count));
    setError(null);
  }

  return (
    <section
      className="foundation-construction"
      aria-labelledby={id}
      data-foundation-construction="integration"
    >
      <Title id={id} className="construction-title">
        The same triangle, cut two ways
      </Title>
      <p>
        A density rises from 0 to {RAMP.topDensity} per micrometre across {RAMP.micrometres} μm.
        Keep this line fixed and change only the rectangles used to add its area. The first
        drawing keeps the four left-edge strips from the worked example.
      </p>
      <StripDrawing partition={REFERENCE_RAMP_PARTITION} rule="left" />
      <p className="fine">
        Reference: four strips, each 1 μm wide, add to {shown(REFERENCE_RAMP_PARTITION.leftTotal)}.
        The triangle itself has area {shown(REFERENCE_RAMP_PARTITION.exactArea)}.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply(draft);
        }}
      >
        <fieldset className="construction-controls" disabled={!ready}>
          <legend>Cut and compare the same density</legend>
          <label htmlFor={`${id}-count`}>Number of strips</label>
          <input
            id={`${id}-count`}
            name="strips"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={16}
            value={draft}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
            onInput={(event) => {
              setDraft(event.currentTarget.value);
              setError(null);
            }}
          />
          <p id={`${id}-hint`} className="fine">
            Enter a whole number from 1 to {INTEGRATION_STRIP_LIMIT}, then apply it. Each rectangle
            contributes its height times its width; the table lets you inspect every contribution.
          </p>
          <div className="actions">
            <button type="submit">Apply strips</button>
            <button
              type="button"
              disabled={accepted.count * 2 > INTEGRATION_STRIP_LIMIT}
              onClick={() => apply(String(accepted.count * 2))}
            >
              Double the strips
            </button>
            <button
              type="button"
              onClick={() => {
                setRule("left");
                apply(String(INITIAL_RAMP_PARTITION.count));
              }}
            >
              Restore eight strips
            </button>
          </div>
          <label htmlFor={`${id}-rule`}>Where each rectangle takes its height</label>
          <select
            id={`${id}-rule`}
            name="sampling"
            value={rule}
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (next === "left" || next === "midpoint" || next === "right") setRule(next);
            }}
          >
            <option value="left">Left edge</option>
            <option value="midpoint">Midpoint</option>
            <option value="right">Right edge</option>
          </select>
        </fieldset>
      </form>
      {error && (
        <p id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
      {draft.trim() !== String(accepted.count) && (
        <p className="fine">
          Apply the edited count to change the second drawing. It still shows {accepted.count}{" "}
          strips.
        </p>
      )}

      <div data-integration-current="">
        <StripDrawing partition={accepted} rule={rule} />
        <div className="construction-display">
          <dl className="readout-grid">
            <dt>Left-edge sum, below the triangle</dt>
            <dd data-integration-output="left">{shown(accepted.leftTotal)}</dd>
            <dt>Midpoint sum</dt>
            <dd data-integration-output="midpoint">{shown(accepted.midpointTotal)}</dd>
            <dt>Right-edge sum, above the triangle</dt>
            <dd data-integration-output="right">{shown(accepted.rightTotal)}</dd>
            <dt>Exact triangle area</dt>
            <dd data-integration-output="exact">{shown(accepted.exactArea)}</dd>
            <dt>Gap between upper and lower sums</dt>
            <dd data-integration-output="gap">{shown(accepted.bracketWidth)}</dd>
          </dl>
        </div>
        <p role="status">
          {accepted.count} strips, each {shown(accepted.width)} μm wide. The drawing uses the{" "}
          {RULE_LABELS[rule].toLowerCase()} and its rectangles total{" "}
          {shown(totalFor(accepted, rule))}.
          The exact area stays {shown(accepted.exactArea)}.
        </p>
        <details>
          <summary>Inspect the height, width and area of each strip</summary>
          <section
            className="construction-table-wrap"
            aria-label="Strip arithmetic"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard readers need to scroll the off-screen columns of this labelled table region.
            tabIndex={0}
          >
            <table className="data-table">
              <caption>
                {RULE_LABELS[rule]} rectangles. Height is per micrometre, width is in micrometres,
                and each area has no unit. Printed values are rounded after the sums are calculated.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Strip</th>
                  <th scope="col">Span, μm</th>
                  <th scope="col">Height, per μm</th>
                  <th scope="col">Width, μm</th>
                  <th scope="col">Area</th>
                </tr>
              </thead>
              <tbody>
                {accepted.strips.map((strip) => (
                  <tr key={strip.index} data-integration-row={strip.index}>
                    <th scope="row">{strip.index + 1}</th>
                    <td>
                      {shown(strip.left)} to {shown(strip.right)}
                    </td>
                    <td>{shown(strip.samples[rule].height)}</td>
                    <td>{shown(strip.width)}</td>
                    <td>{shown(strip.samples[rule].area)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </details>
      </div>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The two drawings initially use four and eight left-edge strips. Their areas add to{" "}
          {shown(REFERENCE_RAMP_PARTITION.leftTotal)} and {shown(INITIAL_RAMP_PARTITION.leftTotal)},
          below the triangle's exact area of {shown(INITIAL_RAMP_PARTITION.exactArea)}. Left-edge
          rectangles miss a wedge above each strip. Right-edge rectangles include an extra wedge
          and give an upper estimate.
          Doubling the strip count halves the gap between those two estimates.
        </p>
        <p>
          Midpoint rectangles give area 1 even with a single strip here, because this density is
          a straight line. That exactness does not hold for a general curved density. The controls
          change an approximation to the area, never the density or its total probability. A
          right-edge sum greater than 1 is an overestimate, not a probability greater than 1.
        </p>
        <p>
          The integral is the limiting area as the strip widths shrink. The finite sums let you
          compare this approach from above and below; they do not replace the mathematical limit.
        </p>
      </div>
    </section>
  );
}
