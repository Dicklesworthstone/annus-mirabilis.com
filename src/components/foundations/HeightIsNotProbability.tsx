"use client";

import { useId, useState } from "react";
import {
  DEFAULT_HISTOGRAM_BOUNDARIES,
  DEFAULT_HISTOGRAM_OBSERVATIONS,
  type HistogramUnit,
  INITIAL_HISTOGRAM,
  type ObservationRefusal,
  projectHistogram,
  readHistogram,
} from "../../foundations/observations.ts";
import { exponentialSpoken, exponentialText } from "../../units/scientific.ts";
import { Sci, SciSvg } from "../lab/Sci.tsx";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";
import "./observationWorkbench.css";

const rounded = (value: number) => Number(value.toPrecision(4));
const spoken = (value: number) => exponentialSpoken(rounded(value));
const textNumber = (value: number) => exponentialText(rounded(value));

export function HeightIsNotProbability({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const id = useId();
  const Title = headingTag(headingLevel);
  const Sub = headingTag(headingLevel, 1);
  const [histogram, setHistogram] = useState(INITIAL_HISTOGRAM);
  const [draftObservations, setDraftObservations] = useState(DEFAULT_HISTOGRAM_OBSERVATIONS);
  const [draftBoundaries, setDraftBoundaries] = useState(DEFAULT_HISTOGRAM_BOUNDARIES);
  const [accepted, setAccepted] = useState({
    observations: DEFAULT_HISTOGRAM_OBSERVATIONS,
    boundaries: DEFAULT_HISTOGRAM_BOUNDARIES,
  });
  const [error, setError] = useState<ObservationRefusal | null>(null);
  const [unit, setUnit] = useState<HistogramUnit>("micrometre");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const projection = projectHistogram(histogram, unit);
  const metres = projectHistogram(histogram, "metre");
  const selected = projection.bins[selectedIndex];
  const selectedMicrometres = histogram.bins[selectedIndex];
  const selectedMetres = metres.bins[selectedIndex];
  const pending =
    draftObservations !== accepted.observations || draftBoundaries !== accepted.boundaries;

  function apply(observations: string, boundaries: string) {
    const result = readHistogram(observations, boundaries);
    if (result.kind === "invalid") {
      setError(result);
      return;
    }
    setHistogram(result.histogram);
    setDraftObservations(observations);
    setDraftBoundaries(boundaries);
    setAccepted({ observations, boundaries });
    setSelectedIndex(0);
    setError(null);
  }

  const low = Math.min(...projection.bins.map((bin) => bin.lower));
  const high = Math.max(...projection.bins.map((bin) => bin.upper));
  const maxDensity = Math.max(...projection.bins.map((bin) => bin.density));
  const x = (value: number) => 40 + ((value - low) / (high - low)) * 320;
  const y = (value: number) => 174 - (value / maxDensity) * 116;

  return (
    <section
      className="foundation-construction observation-workbench"
      aria-labelledby={`${id}-title`}
      data-foundation-construction="distributions"
    >
      <Title id={`${id}-title`} className="construction-title">
        The height moves, the area does not
      </Title>
      <p>
        Place observations into intervals. Each bar has area equal to its share of the observations:
        its height is that share divided by its width. Try unequal widths, then change the ruler
        from micrometres to metres.
      </p>
      <form
        className="construction-controls observation-entry"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          apply(draftObservations, draftBoundaries);
        }}
      >
        <label htmlFor={`${id}-observations`}>Observed displacements in micrometres (µm)</label>
        <textarea
          id={`${id}-observations`}
          name="observations"
          rows={2}
          value={draftObservations}
          maxLength={4096}
          aria-invalid={error?.field === "observations" ? true : undefined}
          aria-describedby={`${id}-help${error?.field === "observations" ? ` ${id}-error` : ""}`}
          onInput={(event) => {
            setDraftObservations(event.currentTarget.value);
            setError(null);
          }}
        />
        <label htmlFor={`${id}-boundaries`}>
          Bin boundaries in micrometres (µm), in increasing order
        </label>
        <textarea
          id={`${id}-boundaries`}
          name="boundaries"
          rows={2}
          value={draftBoundaries}
          maxLength={4096}
          aria-invalid={error?.field === "boundaries" ? true : undefined}
          aria-describedby={`${id}-help ${id}-boundary-help${error?.field === "boundaries" ? ` ${id}-error` : ""}`}
          onInput={(event) => {
            setDraftBoundaries(event.currentTarget.value);
            setError(null);
          }}
        />
        <p id={`${id}-help`} className="fine">
          Use 1 to 32 observations and 2 to 13 boundaries, separated by commas or spaces. Numbers
          must be between −1000 and 1000 µm; nonzero magnitudes must be at least 0.000001 µm.
        </p>
        <p id={`${id}-boundary-help`} className="fine">
          Every observation must fit between the first and last boundaries. Bin widths must be at
          least 0.000001 µm. A boundary belongs to the bin on its right; the last bin includes its
          right edge too. The initial observations are invented.
        </p>
        <div className="observation-actions">
          <button type="submit">Apply observations and bins</button>
          <button
            type="button"
            className="secondary"
            onClick={() => apply(DEFAULT_HISTOGRAM_OBSERVATIONS, DEFAULT_HISTOGRAM_BOUNDARIES)}
          >
            Equal-width example
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => apply(DEFAULT_HISTOGRAM_OBSERVATIONS, "0, 2, 3, 8")}
          >
            Unequal-width example
          </button>
        </div>
        {error ? (
          <p id={`${id}-error`} role="alert">
            {error.reason} The last accepted histogram is still shown.
          </p>
        ) : null}
        {pending && !error ? (
          <p className="fine">
            Apply both entries to update the histogram and its table together. The current drawing
            still uses the last accepted observations and bins.
          </p>
        ) : null}
      </form>

      <div className="observation-choices">
        <label htmlFor={`${id}-unit`}>Ruler for the display</label>
        <select
          id={`${id}-unit`}
          name="histogram-unit"
          value={unit}
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (value === "micrometre" || value === "metre") setUnit(value);
          }}
        >
          <option value="micrometre">Micrometres (µm)</option>
          <option value="metre">Metres (m)</option>
        </select>
        <label htmlFor={`${id}-selected`}>Bin to inspect</label>
        <select
          id={`${id}-selected`}
          name="histogram-bin"
          value={selectedIndex}
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            if (projection.bins.some((bin) => bin.index === value)) setSelectedIndex(value);
          }}
        >
          {projection.bins.map((bin) => (
            <option key={bin.index} value={bin.index}>
              Bin {bin.index + 1}: {textNumber(bin.lower)} to {textNumber(bin.upper)}{" "}
              {projection.symbol}
            </option>
          ))}
        </select>
      </div>
      <p role="status" aria-atomic="true">
        {histogram.count} observations in {histogram.bins.length} bins. Total share{" "}
        <Sci value={rounded(histogram.totalProbability)} />. Heights are per {unit}.
        {selected ? (
          <>
            {" "}
            Selected bin {selected.index + 1}: {selected.count} observations, share{" "}
            <Sci value={rounded(selected.probability)} />.
          </>
        ) : null}
      </p>
      <svg
        className="bridge-figure observation-figure"
        viewBox="0 0 400 245"
        role="img"
        aria-label={`A histogram of ${histogram.count} entered observations in ${histogram.bins.length} intervals. Horizontal distances are in ${unit}s and heights are probability density per ${unit}. Bar widths follow the entered boundaries, so area gives the share in each interval. Bin ${histogram.tallestBin + 1} reaches a greatest height and bin ${histogram.largestShareBin + 1} holds a greatest share. The table gives every count, width, height, and area.`}
      >
        <text className="bridge-axis-name" x={40} y={19}>
          density per {unit}
        </text>
        <text className="bridge-number" x={40} y={40}>
          highest <SciSvg value={rounded(maxDensity)} />
        </text>
        {projection.bins.map((bin) => (
          <g key={bin.index}>
            <rect
              className={`bridge-bar${bin.index === selectedIndex ? " observation-selected-bin" : ""}`}
              x={x(bin.lower)}
              y={y(bin.density)}
              width={x(bin.upper) - x(bin.lower)}
              height={174 - y(bin.density)}
            />
            {x(bin.upper) - x(bin.lower) > 18 ? (
              <text
                className="bridge-number"
                x={(x(bin.lower) + x(bin.upper)) / 2}
                y={194}
                textAnchor="middle"
              >
                {bin.index + 1}
              </text>
            ) : null}
          </g>
        ))}
        <line className="bridge-axis" x1={40} y1={174} x2={360} y2={174} />
        <line className="bridge-axis" x1={40} y1={50} x2={40} y2={174} />
        <text className="bridge-number" x={40} y={215} textAnchor="start">
          <SciSvg value={rounded(low)} />
        </text>
        <text className="bridge-number" x={360} y={215} textAnchor="end">
          <SciSvg value={rounded(high)} />
        </text>
        <text className="bridge-axis-name" x={200} y={239} textAnchor="middle">
          displacement ({projection.symbol}); bin numbers below bars
        </text>
      </svg>

      {selected && selectedMicrometres && selectedMetres ? (
        <>
          <dl className="readout-grid observation-readouts">
            <dt>Selected bin</dt>
            <dd data-histogram-output="selected">{selected.index + 1}</dd>
            <dt>Observations in the bin</dt>
            <dd data-histogram-output="count">
              {selected.count} of {histogram.count}
            </dd>
            <dt>Bin width</dt>
            <dd data-histogram-output="width">
              <Sci value={rounded(selected.width)} /> {projection.symbol}
            </dd>
            <dt>Probability density</dt>
            <dd data-histogram-output="density">
              <Sci value={rounded(selected.density)} /> per {unit}
            </dd>
            <dt>Share of observations</dt>
            <dd data-histogram-output="probability">
              <Sci value={rounded(selected.probability)} />
            </dd>
            <dt>Area: density × width</dt>
            <dd data-histogram-output="area">
              <Sci value={rounded(selected.area)} />
            </dd>
          </dl>
          <svg
            className="bridge-figure observation-figure"
            viewBox="0 0 400 210"
            role="img"
            aria-label={`Selected bin ${selected.index + 1}, shown as one rectangle under two rulers. Its width is ${spoken(selectedMicrometres.width)} micrometres or ${spoken(selectedMetres.width)} metres. Its density is ${spoken(selectedMicrometres.density)} per micrometre or ${spoken(selectedMetres.density)} per metre. Multiplying either width by its matching density gives the same dimensionless area ${spoken(selected.probability)}. This schematic is labelled with the accepted bin values; its pixel size is fixed.`}
          >
            <text className="bridge-number" x={200} y={24} textAnchor="middle">
              height <SciSvg value={rounded(selectedMicrometres.density)} /> per µm
            </text>
            <text className="bridge-number" x={200} y={47} textAnchor="middle">
              or <SciSvg value={rounded(selectedMetres.density)} /> per m
            </text>
            {selected.count > 0 ? (
              <rect className="bridge-bar" x={96} y={62} width={208} height={80} />
            ) : (
              <line className="bridge-axis" x1={96} y1={142} x2={304} y2={142} />
            )}
            <text className="bridge-axis-name" x={200} y={108} textAnchor="middle">
              area <SciSvg value={rounded(selected.probability)} />
            </text>
            <line className="bridge-axis" x1={72} y1={142} x2={328} y2={142} />
            <text className="bridge-number" x={200} y={166} textAnchor="middle">
              width <SciSvg value={rounded(selectedMicrometres.width)} /> µm
            </text>
            <text className="bridge-number" x={200} y={190} textAnchor="middle">
              or <SciSvg value={rounded(selectedMetres.width)} /> m
            </text>
          </svg>
          <p className="fine">
            The selected-bin diagram is a labelled schematic. Changing units multiplies density by a
            million and divides width by a million. Its area and its count stay fixed.
          </p>
        </>
      ) : null}

      <section
        className="construction-table-wrap"
        aria-labelledby={`${id}-table`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard readers need to scroll the off-screen columns of this labelled table region.
        tabIndex={0}
      >
        <table>
          <caption id={`${id}-table`}>Every accepted bin, using {unit}s for length</caption>
          <thead>
            <tr>
              <th scope="col">Bin</th>
              <th scope="col">Interval ({projection.symbol})</th>
              <th scope="col">Count</th>
              <th scope="col">Width ({projection.symbol})</th>
              <th scope="col">Density (per {unit})</th>
              <th scope="col">Share</th>
              <th scope="col">Area</th>
            </tr>
          </thead>
          <tbody>
            {projection.bins.map((bin) => (
              <tr key={bin.index} data-histogram-row={bin.index}>
                <th scope="row">{bin.index + 1}</th>
                <td>
                  <Sci value={rounded(bin.lower)} /> ≤ x {bin.includesUpper ? "≤" : "<"}{" "}
                  <Sci value={rounded(bin.upper)} />
                </td>
                <td>{bin.count}</td>
                <td>
                  <Sci value={rounded(bin.width)} />
                </td>
                <td>
                  <Sci value={rounded(bin.density)} />
                </td>
                <td>
                  <Sci value={rounded(bin.probability)} />
                </td>
                <td>
                  <Sci value={rounded(bin.area)} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                Total
              </th>
              <td>{histogram.count}</td>
              <td colSpan={2}>All observations included</td>
              <td>
                <Sci value={rounded(histogram.totalProbability)} />
              </td>
              <td>
                <Sci value={rounded(histogram.totalProbability)} />
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
      <p className="fine">
        Numbers are rounded to four significant figures. Counts and calculations use the entered
        values; rounded rows may not add to exactly one.
      </p>
      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Every observation is counted once. A bin's share is its count divided by {histogram.count}
          . Its density is that share divided by the bin width, and multiplying height by width
          recovers the share. A density may exceed one; the share stays between zero and one.
        </p>
        <p>
          Bin {histogram.tallestBin + 1} reaches a greatest height. Bin{" "}
          {histogram.largestShareBin + 1} contains a greatest share.
          {histogram.tallestBin !== histogram.largestShareBin
            ? " They differ here: the tallest bar does not contain the most observations."
            : " Try the unequal-width example: a narrow bar can be taller while enclosing a smaller share."}{" "}
          The same physical interval has the same share when its ruler changes.
        </p>
        <p>
          These bars describe the entered observations. A bin's share is the probability of landing
          in that bin if one of those observations is chosen uniformly. Inferring a continuous
          distribution or a probability for a future observation needs a model and evidence beyond
          this histogram. The bars do not reveal where within a bin its observations lie.
        </p>
      </div>
    </section>
  );
}
