"use client";

import { useId, useState } from "react";
import {
  DEFAULT_OBSERVATIONS,
  INITIAL_OBSERVATION_SUMMARY,
  readObservations,
} from "../../foundations/observations.ts";
import { exponentialSpoken } from "../../units/scientific.ts";
import { Sci, SciSvg } from "../lab/Sci.tsx";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";
import "./observationWorkbench.css";

// Display rounding only. Every computation and plot position uses the accepted, unrounded data.
const rounded = (value: number) => Number(value.toPrecision(4));
const spoken = (value: number) => exponentialSpoken(rounded(value));

export function ThreeAverages({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const id = useId();
  const Title = headingTag(headingLevel);
  const Sub = headingTag(headingLevel, 1);
  const [summary, setSummary] = useState(INITIAL_OBSERVATION_SUMMARY);
  const [draft, setDraft] = useState(DEFAULT_OBSERVATIONS);
  const [acceptedText, setAcceptedText] = useState(DEFAULT_OBSERVATIONS);
  const [error, setError] = useState("");

  function apply(text: string) {
    const result = readObservations(text);
    if (result.kind === "invalid") {
      setError(result.reason);
      return;
    }
    setSummary(result.summary);
    setDraft(text);
    setAcceptedText(text);
    setError("");
  }

  const low = Math.min(0, ...summary.values);
  const high = Math.max(0, ...summary.values);
  const padding = (high - low || 1) * 0.1;
  const x = (value: number) => 38 + ((value - low + padding) / (high - low + 2 * padding)) * 324;
  const axis = 42 + summary.count * 12;
  const lengths = [
    { label: "Signed mean", value: summary.mean },
    { label: "Mean distance", value: summary.meanAbsolute },
    { label: "RMS", value: summary.rms },
    { label: "Standard deviation", value: summary.standardDeviation },
  ];
  const lengthLow = Math.min(0, summary.mean);
  const lengthHigh = Math.max(summary.rms, summary.standardDeviation, 0);
  const lengthSpan = lengthHigh - lengthLow || 1;
  const lengthX = (value: number) => 164 + ((value - lengthLow) / lengthSpan) * 212;

  return (
    <section
      className="foundation-construction observation-workbench"
      aria-labelledby={`${id}-title`}
      data-foundation-construction="mean-variance-rms"
    >
      <Title id={`${id}-title`} className="construction-title">
        One question, three answers
      </Title>
      <p>
        Enter signed displacements from a common start. Compare the average position, average
        distance, and root mean square. Then move the whole sample to see why spread around its own
        mean is a different question.
      </p>
      <form
        className="construction-controls observation-entry"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          apply(draft);
        }}
      >
        <label htmlFor={`${id}-observations`}>Displacements in micrometres (µm)</label>
        <textarea
          id={`${id}-observations`}
          name="observations"
          rows={2}
          value={draft}
          maxLength={4096}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
          onInput={(event) => {
            setDraft(event.currentTarget.value);
            setError("");
          }}
        />
        <p id={`${id}-help`} className="fine">
          Use 1 to 32 numbers separated by commas or spaces, from −1000 to 1000 µm. A nonzero
          magnitude must be at least 0.000001 µm. The examples are invented observations.
        </p>
        <div className="observation-actions">
          <button type="submit">Apply observations</button>
          <button type="button" className="secondary" onClick={() => apply(DEFAULT_OBSERVATIONS)}>
            Balanced sample
          </button>
          <button type="button" className="secondary" onClick={() => apply("0, 2, 4, 6")}>
            Shifted example (+3 µm)
          </button>
          <button type="button" className="secondary" onClick={() => apply("3, 3, 3, 3")}>
            All at 3 µm
          </button>
        </div>
        {error ? (
          <p id={`${id}-error`} role="alert">
            {error} The last accepted sample is still shown.
          </p>
        ) : null}
        {draft !== acceptedText && !error ? (
          <p className="fine">
            Apply the edited observations to update the drawings, averages, and table together.
          </p>
        ) : null}
      </form>

      <p role="status" aria-atomic="true">
        {summary.count} observations: mean <Sci value={rounded(summary.mean)} /> µm, RMS{" "}
        <Sci value={rounded(summary.rms)} /> µm, standard deviation{" "}
        <Sci value={rounded(summary.standardDeviation)} /> µm.
      </p>
      <svg
        className="bridge-figure observation-figure"
        viewBox={`0 0 400 ${axis + 58}`}
        role="img"
        aria-label={`${summary.count} entered observations, each on its own row, measured in micrometres from the same zero. Their signed mean is ${spoken(summary.mean)} micrometres, shown by the dashed line. Every observation and its deviation from that mean is listed in the table below.`}
      >
        <line className="bridge-grid" x1={x(0)} y1={18} x2={x(0)} y2={axis} />
        <line className="bridge-step" x1={x(summary.mean)} y1={18} x2={x(summary.mean)} y2={axis} />
        {summary.rows.map((row) => (
          <g key={row.index}>
            <text className="bridge-number" x={8} y={32 + row.index * 12}>
              {row.index + 1}
            </text>
            <circle className="bridge-dot" cx={x(row.value)} cy={28 + row.index * 12} r={4} />
          </g>
        ))}
        <line className="bridge-axis" x1={28} y1={axis} x2={372} y2={axis} />
        {[...new Set([low, 0, high])].map((value) => (
          <g key={value}>
            <line className="bridge-tick" x1={x(value)} y1={axis} x2={x(value)} y2={axis + 6} />
            <text className="bridge-number" x={x(value)} y={axis + 24} textAnchor="middle">
              <SciSvg value={rounded(value)} />
            </text>
          </g>
        ))}
        <text className="bridge-axis-name" x={200} y={axis + 49} textAnchor="middle">
          displacement from the start (µm)
        </text>
      </svg>

      <svg
        className="bridge-figure observation-figure"
        viewBox="0 0 400 202"
        role="img"
        aria-label={`Four lengths compared on one micrometre scale. The signed mean is ${spoken(summary.mean)}, mean distance is ${spoken(summary.meanAbsolute)}, root mean square is ${spoken(summary.rms)}, and standard deviation is ${spoken(summary.standardDeviation)}. RMS measures distance from zero; standard deviation measures spread around the sample mean. Squared quantities are reported separately below.`}
      >
        {lengths.map((entry, index) => (
          <g key={entry.label}>
            <text className="bridge-number" x={4} y={28 + index * 36}>
              {entry.label}
            </text>
            <line
              className="bridge-grid"
              x1={164}
              y1={24 + index * 36}
              x2={376}
              y2={24 + index * 36}
            />
            <line
              className="bridge-axis"
              x1={lengthX(0)}
              y1={24 + index * 36}
              x2={lengthX(entry.value)}
              y2={24 + index * 36}
            />
            <circle className="bridge-dot" cx={lengthX(entry.value)} cy={24 + index * 36} r={4} />
          </g>
        ))}
        <line className="bridge-step" x1={lengthX(0)} y1={12} x2={lengthX(0)} y2={155} />
        {[...new Set([lengthLow, 0, lengthHigh])].map((value) => (
          <text
            key={value}
            className="bridge-number"
            x={lengthX(value)}
            y={174}
            textAnchor="middle"
          >
            <SciSvg value={rounded(value)} />
          </text>
        ))}
        <text className="bridge-axis-name" x={270} y={197} textAnchor="middle">
          micrometres
        </text>
      </svg>

      <dl className="readout-grid observation-readouts">
        <dt>Signed mean</dt>
        <dd data-observation-output="mean">
          <Sci value={rounded(summary.mean)} /> µm
        </dd>
        <dt>Mean distance from zero</dt>
        <dd data-observation-output="mean-absolute">
          <Sci value={rounded(summary.meanAbsolute)} /> µm
        </dd>
        <dt>Root mean square</dt>
        <dd data-observation-output="rms">
          <Sci value={rounded(summary.rms)} /> µm
        </dd>
        <dt>Standard deviation</dt>
        <dd data-observation-output="standard-deviation">
          <Sci value={rounded(summary.standardDeviation)} /> µm
        </dd>
        <dt>Mean square</dt>
        <dd data-observation-output="mean-square">
          <Sci value={rounded(summary.meanSquare)} /> µm²
        </dd>
        <dt>Variance around the mean</dt>
        <dd data-observation-output="variance">
          <Sci value={rounded(summary.variance)} /> µm²
        </dd>
      </dl>
      <p>
        Mean square = variance + squared mean: <Sci value={rounded(summary.meanSquare)} /> µm² ={" "}
        <Sci value={rounded(summary.variance)} /> µm² + <Sci value={rounded(summary.squaredMean)} />{" "}
        µm². Taking the square root gives RMS from the mean square, and standard deviation from the
        variance.
      </p>
      <section
        className="construction-table-wrap"
        aria-labelledby={`${id}-table`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard readers need to scroll the off-screen columns of this labelled table region.
        tabIndex={0}
      >
        <table>
          <caption id={`${id}-table`}>
            Each observation and its contribution to the two squares
          </caption>
          <thead>
            <tr>
              <th scope="col">Observation</th>
              <th scope="col">Displacement (µm)</th>
              <th scope="col">Square (µm²)</th>
              <th scope="col">Deviation from mean (µm)</th>
              <th scope="col">Squared deviation (µm²)</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => (
              <tr key={row.index} data-observation-row={row.index}>
                <th scope="row">{row.index + 1}</th>
                <td>
                  <Sci value={rounded(row.value)} />
                </td>
                <td>
                  <Sci value={rounded(row.square)} />
                </td>
                <td>
                  <Sci value={rounded(row.deviation)} />
                </td>
                <td>
                  <Sci value={rounded(row.squaredDeviation)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="fine">
        Both squared columns are averaged by dividing by {summary.count}, the number of
        observations. This describes the entered sample; it does not use the divisor one less than
        the sample size that appears in an unbiased variance estimate. Readouts are rounded to four
        significant figures; calculations use the entered values.
      </p>
      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The points have mean <Sci value={rounded(summary.mean)} /> µm and variance{" "}
          <Sci value={rounded(summary.variance)} /> µm² around that mean. Their RMS distance from
          the start is <Sci value={rounded(summary.rms)} /> µm; their standard deviation around the
          mean is <Sci value={rounded(summary.standardDeviation)} /> µm.
          {summary.mean === 0
            ? " The mean is zero here, so RMS and standard deviation coincide."
            : " The nonzero mean contributes to RMS even when every point has the same displacement."}
        </p>
        <p>
          The balanced example has mean zero and variance 5 µm². Shifting those four points by 3 µm
          changes their mean to 3 µm and mean square to 14 µm², while variance stays 5 µm². Putting
          all four at 3 µm makes the variance zero and the RMS 3 µm.
        </p>
        <p>
          These are sample descriptions. They do not establish a random-motion model, prove that
          drift is absent, or estimate an uncertainty from repeated experiments.
        </p>
      </div>
    </section>
  );
}
