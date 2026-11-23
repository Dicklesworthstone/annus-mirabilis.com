"use client";

import { useEffect, useId, useState } from "react";
import {
  GAUSSIAN_LIMITS,
  GAUSSIAN_WIDTH_COUNTS,
  type GaussianIntervalResult,
  type GaussianRefusal,
  type GaussianSample,
  type GaussianWidthCount,
  INITIAL_GAUSSIAN_INTERVAL,
  readGaussianBand,
  readGaussianInterval,
} from "../../foundations/gaussianIntervals.ts";
import { exponentialSpoken, exponentialText } from "../../units/scientific.ts";
import { Sci } from "../lab/Sci.tsx";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";
import "./gaussianIntervals.css";

const W = 300;
const H = 194;
const LEFT = 32;
const RIGHT = 288;
const BASE = 142;
const TOP = 28;
const MAX_DENSITY = 0.85;
const rounded = (value: number) => Number(value.toPrecision(5));
const isPlain = (value: number) => value === 0 || (Math.abs(value) >= 0.001 && Math.abs(value) < 10000);
const shown = (value: number) =>
  isPlain(rounded(value))
    ? String(rounded(value)).replace(/^-/, "−")
    : exponentialText(rounded(value));
const spoken = (value: number) =>
  isPlain(rounded(value)) ? shown(value).replace("−", "minus ") : exponentialSpoken(rounded(value));
const percentage = (value: number) => spoken(100 * value);
// Keep distinct accepted bounds distinct; only calculated probabilities and densities are rounded.
const coordinate = (value: number) => String(value).replace(/^-/, "−");

function Reading({ value }: { readonly value: number }) {
  return isPlain(rounded(value)) ? <>{shown(value)}</> : <Sci value={rounded(value)} />;
}
const x = (position: number) =>
  LEFT +
  ((position - GAUSSIAN_LIMITS.minimumBound) /
    (GAUSSIAN_LIMITS.maximumBound - GAUSSIAN_LIMITS.minimumBound)) *
    (RIGHT - LEFT);
const y = (density: number) => BASE - (density / MAX_DENSITY) * (BASE - TOP);

function line(points: readonly GaussianSample[]): string {
  return "M " + points.map((point) => x(point.position) + "," + y(point.density)).join(" L ");
}

function area(points: readonly GaussianSample[]): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return "";
  return (
    "M " +
    x(first.position) +
    "," +
    BASE +
    " L " +
    points.map((point) => x(point.position) + "," + y(point.density)).join(" L ") +
    " L " +
    x(last.position) +
    "," +
    BASE +
    " Z"
  );
}

/** One accepted Gaussian supplies the plot, interval, probability table and spoken description. */
export function BellAndItsWidths({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const id = useId();
  const Title = headingTag(headingLevel);
  const Sub = headingTag(headingLevel, 1);
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(INITIAL_GAUSSIAN_INTERVAL);
  const [width, setWidth] = useState("1");
  const [lower, setLower] = useState("-1");
  const [upper, setUpper] = useState("1");
  const [error, setError] = useState<GaussianRefusal | null>(null);
  useEffect(() => setReady(true), []);

  if (accepted.kind !== "accepted" || INITIAL_GAUSSIAN_INTERVAL.kind !== "accepted")
    return (
      <section className="foundation-construction">
        <Title className="construction-title">The bell, and what each width is worth</Title>
        <p>The worked Gaussian could not be calculated. The lesson above remains readable.</p>
      </section>
    );

  const view = accepted.interval;
  const reference = INITIAL_GAUSSIAN_INTERVAL.interval;
  const pending =
    width !== String(view.width) || lower !== String(view.lower) || upper !== String(view.upper);
  const errorFor = (field: "width" | "lower" | "upper") =>
    error?.field === field || (error?.field === "interval" && field !== "width");

  function accept(result: GaussianIntervalResult) {
    if (result.kind === "refused") {
      setError(result);
      return;
    }
    setAccepted(result);
    setWidth(String(result.interval.width));
    setLower(String(result.interval.lower));
    setUpper(String(result.interval.upper));
    setError(null);
  }

  function chooseBand(widths: GaussianWidthCount) {
    accept(readGaussianBand(width, widths));
  }

  const summary =
    "RMS width " +
    coordinate(view.width) +
    " micrometres. From " +
    coordinate(view.lower) +
    " to " +
    coordinate(view.upper) +
    " micrometres: " +
    percentage(view.inside) +
    " per cent of the probability. Outside this interval: " +
    percentage(view.outside) +
    " per cent.";

  return (
    <section
      className="foundation-construction"
      aria-labelledby={id + "-title"}
      data-foundation-construction="gaussian-distributions"
    >
      <Title id={id + "-title"} className="construction-title">
        The bell, and what each width is worth
      </Title>
      <p>
        Choose how wide the bell is and which interval to count. A wider bell has a lower peak
        because its total probability stays one. Keep the bounds fixed to see the chance change,
        or choose the same number of widths to see the familiar percentages stay the same.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          accept(readGaussianInterval(width, lower, upper));
        }}
      >
        <fieldset className="construction-controls" disabled={!ready}>
          <legend>Change the width and the interval</legend>
          <div className="gaussian-fields">
            <label htmlFor={id + "-width"}>
              RMS width (µm)
              <input
                id={id + "-width"}
                name="gaussian-width"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                maxLength={GAUSSIAN_LIMITS.textLength}
                value={width}
                aria-invalid={errorFor("width") || undefined}
                aria-describedby={id + "-help" + (errorFor("width") ? " " + id + "-error" : "")}
                onInput={(event) => {
                  setWidth(event.currentTarget.value);
                  setError(null);
                }}
              />
            </label>
            <label htmlFor={id + "-lower"}>
              Lower bound (µm)
              <input
                id={id + "-lower"}
                name="gaussian-lower"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                maxLength={GAUSSIAN_LIMITS.textLength}
                value={lower}
                aria-invalid={errorFor("lower") || undefined}
                aria-describedby={id + "-help" + (errorFor("lower") ? " " + id + "-error" : "")}
                onInput={(event) => {
                  setLower(event.currentTarget.value);
                  setError(null);
                }}
              />
            </label>
            <label htmlFor={id + "-upper"}>
              Upper bound (µm)
              <input
                id={id + "-upper"}
                name="gaussian-upper"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                maxLength={GAUSSIAN_LIMITS.textLength}
                value={upper}
                aria-invalid={errorFor("upper") || undefined}
                aria-describedby={id + "-help" + (errorFor("upper") ? " " + id + "-error" : "")}
                onInput={(event) => {
                  setUpper(event.currentTarget.value);
                  setError(null);
                }}
              />
            </label>
          </div>
          <p id={id + "-help"} className="fine">
            Width: 0.5 to 2 µm. Bounds: −6 to 6 µm, measured from the start. Equal bounds select a
            single point. The width buttons use the width currently entered above.
          </p>
          <div className="actions">
            <button type="submit">Apply width and interval</button>
            {GAUSSIAN_WIDTH_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                className="secondary"
                onClick={() => chooseBand(count)}
              >
                Within {count} {count === 1 ? "width" : "widths"}
              </button>
            ))}
            <button
              type="button"
              className="secondary"
              onClick={() => accept(INITIAL_GAUSSIAN_INTERVAL)}
            >
              Restore one-width example
            </button>
          </div>
        </fieldset>
        {error ? (
          <p id={id + "-error"} role="alert">
            {error.message} The drawing and table still use width {coordinate(view.width)} µm and
            bounds {coordinate(view.lower)} to {coordinate(view.upper)} µm.
          </p>
        ) : pending ? (
          <p className="fine">
            Apply the entries to update the curve and table together. Until then, the previous
            accepted width and interval remain shown.
          </p>
        ) : null}
      </form>

      <div data-gaussian-current>
        <p className="construction-status" role="status">
          {summary}
        </p>
        <svg
          className="bridge-figure bell-figure"
          viewBox={"0 0 " + W + " " + H}
          role="img"
          aria-label={
            "Two centered bell curves on fixed axes in micrometres and probability per micrometre. " +
            "The dashed reference has width 1 micrometre; the solid chosen curve has width " +
            coordinate(view.width) +
            " micrometres. Hatching marks the chosen interval. " +
            summary +
            " The distribution continues beyond the drawing on both sides."
          }
        >
          <defs>
            <pattern
              id={id + "-hatch"}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
            >
              <path className="gaussian-hatch" d="M -1 1 L 1 -1 M 0 6 L 6 0 M 5 7 L 7 5" />
            </pattern>
          </defs>
          <text className="bridge-axis-name" x="2" y="14">
            chance per micrometre
          </text>
          {[...reference.bands].reverse().map((band) => (
            <path
              key={band.widths}
              className={
                band.widths === 1
                  ? "bridge-band-inner"
                  : band.widths === 2
                    ? "bridge-band-middle"
                    : "bridge-band-outer"
              }
              d={area(band.samples)}
            />
          ))}
          <path
            data-gaussian-selection
            fill={"url(#" + id + "-hatch)"}
            d={area(view.intervalSamples)}
          />
          <path className="bridge-line" data-gaussian-curve d={line(view.samples)} />
          <path className="bridge-step" data-gaussian-reference d={line(reference.samples)} />
          {[
            { key: "lower", position: view.lower, density: view.lowerDensity },
            { key: "upper", position: view.upper, density: view.upperDensity },
          ].map((bound) => (
            <line
              key={bound.key}
              className="bridge-tick"
              x1={x(bound.position)}
              x2={x(bound.position)}
              y1={y(bound.density)}
              y2={BASE + 5}
            />
          ))}
          <line className="bridge-axis" x1={LEFT} y1={TOP} x2={LEFT} y2={BASE} />
          <line className="bridge-axis" x1={LEFT} y1={BASE} x2={RIGHT} y2={BASE} />
          {[0, 0.4, 0.8].map((tick) => (
            <text
              key={tick}
              className="bridge-number"
              x={LEFT - 5}
              y={y(tick) + 4}
              textAnchor="end"
            >
              {tick}
            </text>
          ))}
          {[-6, -3, 0, 3, 6].map((tick) => (
            <text
              key={tick}
              className="bridge-number"
              x={x(tick)}
              y={BASE + 19}
              textAnchor="middle"
            >
              {tick}
            </text>
          ))}
          <text
            className="bridge-axis-name"
            x={(LEFT + RIGHT) / 2}
            y={H - 7}
            textAnchor="middle"
          >
            displacement, micrometres
          </text>
        </svg>
        <p className="fine">
          Solid: chosen width. Dashed: fixed 1 µm reference. Hatched area: chosen interval.
          Both axes stay fixed. Tails outside the drawing are included in the probabilities.
          Probabilities and densities are rounded to five significant figures.
        </p>

        <table className="data-table gaussian-results-table">
          <caption>Where the probability lies for the chosen width</caption>
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">Probability, per cent</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Below {coordinate(view.lower)} µm</th>
              <td data-gaussian-output="below">
                <Reading value={100 * view.below} />
              </td>
            </tr>
            <tr>
              <th scope="row">
                From {coordinate(view.lower)} to {coordinate(view.upper)} µm
              </th>
              <td data-gaussian-output="inside">
                <Reading value={100 * view.inside} />
              </td>
            </tr>
            <tr>
              <th scope="row">Above {coordinate(view.upper)} µm</th>
              <td data-gaussian-output="above">
                <Reading value={100 * view.above} />
              </td>
            </tr>
            <tr>
              <th scope="row">Both outside regions together</th>
              <td data-gaussian-output="outside">
                <Reading value={100 * view.outside} />
              </td>
            </tr>
            <tr>
              <th scope="row">Below + inside + above</th>
              <td data-gaussian-output="total">
                <Reading value={100 * view.total} />
              </td>
            </tr>
          </tbody>
        </table>
        <table className="data-table gaussian-results-table">
          <caption>Curve heights are densities, not probabilities</caption>
          <thead>
            <tr>
              <th scope="col">Position</th>
              <th scope="col">Density, per µm</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Lower bound, {coordinate(view.lower)} µm</th>
              <td data-gaussian-output="lower-density">
                <Reading value={view.lowerDensity} />
              </td>
            </tr>
            <tr>
              <th scope="row">At the start, 0 µm</th>
              <td data-gaussian-output="peak">
                <Reading value={view.peakDensity} />
              </td>
            </tr>
            <tr>
              <th scope="row">Upper bound, {coordinate(view.upper)} µm</th>
              <td data-gaussian-output="upper-density">
                <Reading value={view.upperDensity} />
              </td>
            </tr>
          </tbody>
        </table>
        {view.lower === view.upper ? (
          <p className="fine">
            This interval has no width, so its probability is zero even though the curve is
            positive there. Probability belongs to an area under the curve, not a single height.
          </p>
        ) : null}
      </div>

      <p className="fine">
        The three pale bands keep the original 1 µm reference. One width is the RMS displacement,
        √(2Dt), along one coordinate. A width is a typical distance, never a limit.
      </p>
      <ul className="bell-key">
        {reference.bands.map((band) => (
          <li key={band.widths}>
            <svg className="bell-swatch" viewBox="0 0 28 18" aria-hidden="true">
              <rect
                className={
                  band.widths === 1
                    ? "bridge-band-inner"
                    : band.widths === 2
                      ? "bridge-band-middle"
                      : "bridge-band-outer"
                }
                x="1"
                y="1"
                width="26"
                height="16"
              />
              <rect className="bridge-bar-whole" x="1" y="1" width="26" height="16" />
            </svg>
            <span>
              Within {band.widths === 1 ? "one width" : band.widths === 2 ? "two widths" : "three widths"}
              {" "}either way: about{" "}
              {Number((100 * band.probability).toPrecision(band.widths === 3 ? 3 : 2))} per cent.
            </span>
          </li>
        ))}
      </ul>

      <details>
        <summary>Assumptions behind this comparison</summary>
        <p>
          Ideal model, host calculation. This is a centered, unbounded Gaussian along one
          coordinate, without drift or walls. It shows consequences of that model, not measured
          particle counts. Choosing a width does not separately determine diffusivity and elapsed
          time. The curve and its interval probabilities use the same Gaussian calculation as the
          diffusion laboratory.
        </p>
        <p>
          <a href="/lab/bm-06/">Explore diffusivity and time in the Gaussian laboratory</a>.
        </p>
      </details>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          At the initial 1 µm width, the interval from −1 to 1 µm contains about 68 per cent of the
          probability; about 32 per cent lies outside it. Keep those bounds and double the width
          to 2 µm: the peak falls by half and the interval contains about 38 per cent. Choose
          “Within 1 width” at that new width and the bounds move to −2 and 2 µm, containing about
          68 per cent again.
        </p>
        <p>
          The two-width band includes the one-width band: its roughly 95 per cent already includes
          that 68 per cent. Three widths include about 99.7 per cent. There is still probability
          farther away, on both sides. At any accepted setting the tables name the interval, its
          probability, both outside regions and the curve heights without requiring the drawing.
        </p>
      </div>
    </section>
  );
}
