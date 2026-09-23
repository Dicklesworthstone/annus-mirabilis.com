"use client";

import { type ReactNode, useId, useMemo, useState } from "react";
import type { ImportedTrajectory } from "../../experiments/bm07/trajectoryCsv.ts";
import {
  inspectTrajectory,
  trajectoryTrackIds,
} from "../../experiments/bm07/trajectoryInspection.ts";
import { display } from "./presentation.ts";
import { Sci, SciSvg } from "./Sci.tsx";

const number = (value: number): ReactNode => (value === 0 ? "0" : <Sci value={value} digits={5} />);
/** The same number inside SVG <text>. `Sci` is HTML (a span with <sup>), which a browser does not
 * draw inside an SVG: every value on this plot but a literal 0 rendered with zero width. */
const svgNumber = (value: number): ReactNode =>
  value === 0 ? "0" : <SciSvg value={value} digits={5} />;
/** Plain text for an SVG <title> or <desc>, which hold text only: a `Sci` span there made React
 * pass an array of nodes where a string belongs. */
const plainNumber = (value: number): string => (value === 0 ? "0" : display(value));
const axisNames = ["x", "y", "z"] as const;

/** Parent keys this inspector by the accepted run, not by a draft revision. */
export function TrajectoryInspection({ trajectory }: { trajectory: ImportedTrajectory }) {
  const id = useId();
  const tracks = useMemo(() => trajectoryTrackIds(trajectory), [trajectory]);
  const [track, setTrack] = useState(tracks[0] ?? "");
  const [coordinate, setCoordinate] = useState(0);
  const [page, setPage] = useState(1);
  const view = useMemo(
    () => inspectTrajectory(trajectory, track, coordinate, page),
    [trajectory, track, coordinate, page],
  );
  return (
    <section className="trajectory-inspection" aria-labelledby={`${id}-heading`}>
      <h4 id={`${id}-heading`}>Inspect the accepted recording</h4>
      <p>
        Every accepted position is available here. These controls only change the view; they do not
        select data for the estimate or change its assumptions.
      </p>
      <div className="input-grid">
        <div className="input-field">
          <label htmlFor={`${id}-track`}>Track to inspect</label>
          <select
            id={`${id}-track`}
            value={track}
            onChange={(event) => {
              setTrack(event.target.value);
              setPage(1);
            }}
          >
            {tracks.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <div className="input-field">
          <label htmlFor={`${id}-coordinate`}>Coordinate to plot</label>
          <select
            id={`${id}-coordinate`}
            value={coordinate}
            onChange={(event) => setCoordinate(Number(event.target.value))}
          >
            {axisNames.slice(0, trajectory.dimension).map((axis, index) => (
              <option key={axis} value={index}>
                {axis} (m)
              </option>
            ))}
          </select>
        </div>
      </div>
      <figure className="trajectory-plot">
        {/* The vertical extent is HTML: at five significant figures a value such as 3.49540 × 10⁻⁶
            is wider than any gutter a phone-width drawing can spare. */}
        <p className="fine trajectory-plot-range">
          Vertical axis: {axisNames[coordinate]} (m), from {number(view.coordinateRange[0])} at the
          bottom to {number(view.coordinateRange[1])} at the top.
        </p>
        <svg viewBox="0 0 300 300" role="img" aria-labelledby={`${id}-plot-title ${id}-plot-desc`}>
          <title id={`${id}-plot-title`}>
            {`${axisNames[coordinate]} position against time for track ${track}`}
          </title>
          <desc id={`${id}-plot-desc`}>
            {`Positions ${view.start} through ${view.end} of ${view.total}. Time spans ${plainNumber(view.timeRange[0])} to ${plainNumber(view.timeRange[1])} seconds; position spans ${plainNumber(view.coordinateRange[0])} to ${plainNumber(view.coordinateRange[1])} metres. Dots are recorded samples, with no inferred connecting path. The same samples appear in the table.`}
          </desc>
          <path d="M20 34V250H285" fill="none" stroke="currentColor" />
          {view.points.map(({ source, horizontal, vertical }) => (
            <circle
              key={source.row}
              cx={20 + horizontal * 265}
              cy={250 - vertical * 216}
              r="3.5"
              fill="currentColor"
            >
              <title>
                {`CSV row ${source.row}: ${plainNumber(source.time)} s, ${plainNumber(source.coordinates[coordinate] ?? 0)} m`}
              </title>
            </circle>
          ))}
          {/* 300 units wide, like the other lab plots: at 640 units the site's label size rendered
              at 6.7px on a 390px phone. */}
          <g fill="currentColor">
            <text x="20" y="270">
              {svgNumber(view.timeRange[0])}
            </text>
            <text x="285" y="270" textAnchor="end">
              {svgNumber(view.timeRange[1])}
            </text>
            <text x="152" y="292" textAnchor="middle">
              Time (s)
            </text>
            <text x="20" y="22">
              {axisNames[coordinate]} (m)
            </text>
          </g>
        </svg>
        <figcaption>
          Recorded samples only: no interpolated trajectory, fitted curve or simulated motion. The
          axes span this entire track and stay fixed across pages.
          {view.coordinateRange[0] === view.coordinateRange[1] &&
            " All recorded values of this coordinate coincide; the vertical scale is degenerate, not a measured spread."}
        </figcaption>
      </figure>
      <p role="status">
        Track {track}: positions {view.start}–{view.end} of {view.total}. Page {view.page} of{" "}
        {view.pages}.
      </p>
      <nav className="actions" aria-label="Accepted position pages">
        <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1}>
          Previous positions
        </button>
        <button type="button" onClick={() => setPage(page + 1)} disabled={page === view.pages}>
          Next positions
        </button>
      </nav>
      <section className="trajectory-table-scroll" aria-label="Accepted positions in SI units">
        <table>
          <caption>
            Track {track}, positions {view.start}–{view.end}: the table and plot use the same
            accepted samples.
          </caption>
          <thead>
            <tr>
              <th scope="col">CSV row</th>
              <th scope="col">Time (s)</th>
              {axisNames.slice(0, trajectory.dimension).map((axis) => (
                <th scope="col" key={axis}>
                  {axis} (m)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.points.map(({ source }) => (
              <tr key={source.row}>
                <th scope="row">{source.row}</th>
                <td>{number(source.time)}</td>
                {source.coordinates.map((value, index) => (
                  <td key={axisNames[index]}>{number(value)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p>
        Analysis uses every admitted observation, not only the displayed page or track. The JSON
        export retains original track labels; the SI CSV uses numeric track IDs for spreadsheet
        safety.
      </p>
    </section>
  );
}
