"use client";

import { useId, useMemo, useState } from "react";
import type { ImportedTrajectory } from "../../experiments/bm07/trajectoryCsv.ts";
import { inspectTrajectory, trajectoryTrackIds } from "../../experiments/bm07/trajectoryInspection.ts";

const number = (value: number) => value === 0 ? "0" : value.toExponential(5);
const axisNames = ["x", "y", "z"] as const;

/** Parent keys this inspector by the accepted run, not by a draft revision. */
export function TrajectoryInspection({ trajectory }: { trajectory: ImportedTrajectory }) {
  const id = useId();
  const tracks = useMemo(() => trajectoryTrackIds(trajectory), [trajectory]);
  const [track, setTrack] = useState(tracks[0]!);
  const [coordinate, setCoordinate] = useState(0);
  const [page, setPage] = useState(1);
  const view = useMemo(() => inspectTrajectory(trajectory, track, coordinate, page),
    [trajectory, track, coordinate, page]);
  return (
    <section className="trajectory-inspection" aria-labelledby={`${id}-heading`}>
      <h4 id={`${id}-heading`}>Inspect the accepted recording</h4>
      <p>Every accepted position is available here. These controls only change the view;
        they do not select data for the estimate or change its assumptions.</p>
      <div className="input-grid">
        <label htmlFor={`${id}-track`}>Track to inspect
          <select id={`${id}-track`} value={track} onChange={(event) => { setTrack(event.target.value); setPage(1); }}>
            {tracks.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-coordinate`}>Coordinate to plot
          <select id={`${id}-coordinate`} value={coordinate} onChange={(event) => setCoordinate(Number(event.target.value))}>
            {axisNames.slice(0, trajectory.dimension).map((axis, index) => <option key={axis} value={index}>{axis} (m)</option>)}
          </select>
        </label>
      </div>
      <figure>
        <svg viewBox="0 0 640 300" role="img" aria-labelledby={`${id}-plot-title ${id}-plot-desc`}>
          <title id={`${id}-plot-title`}>{axisNames[coordinate]} position against time for track {track}</title>
          <desc id={`${id}-plot-desc`}>Positions {view.start} through {view.end} of {view.total}.
            Time spans {number(view.timeRange[0])} to {number(view.timeRange[1])} seconds;
            position spans {number(view.coordinateRange[0])} to {number(view.coordinateRange[1])} metres.
            Dots are recorded samples, with no inferred connecting path. The same samples appear in the table.
          </desc>
          <path d="M85 20V250H610" fill="none" stroke="currentColor" />
          {view.points.map(({ source, horizontal, vertical }) => (
            <circle key={source.row} cx={85 + horizontal * 525} cy={250 - vertical * 225} r="3.5" fill="currentColor">
              <title>CSV row {source.row}: {number(source.time)} s, {number(source.coordinates[coordinate]!)} m</title>
            </circle>
          ))}
          <g fill="currentColor" fontSize="12">
            <text x="85" y="270">{number(view.timeRange[0])}</text>
            <text x="610" y="270" textAnchor="end">{number(view.timeRange[1])}</text>
            <text x="350" y="292" textAnchor="middle">Time (s)</text>
            <text x="80" y="30" textAnchor="end">{number(view.coordinateRange[1])}</text>
            <text x="80" y="250" textAnchor="end">{number(view.coordinateRange[0])}</text>
            <text x="12" y="145" transform="rotate(-90 12 145)" textAnchor="middle">{axisNames[coordinate]} (m)</text>
          </g>
        </svg>
        <figcaption>Recorded samples only: no interpolated trajectory, fitted curve or simulated
          motion. The axes span this entire track and stay fixed across pages.
          {view.coordinateRange[0] === view.coordinateRange[1] && " All recorded values of this coordinate coincide; the vertical scale is degenerate, not a measured spread."}
        </figcaption>
      </figure>
      <p role="status">Track {track}: positions {view.start}–{view.end} of {view.total}. Page {view.page} of {view.pages}.</p>
      <div className="actions" aria-label="Accepted position pages">
        <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1}>Previous positions</button>
        <button type="button" onClick={() => setPage(page + 1)} disabled={page === view.pages}>Next positions</button>
      </div>
      <div className="trajectory-table-scroll" tabIndex={0} role="region" aria-label="Accepted positions in SI units">
        <table>
          <caption>Track {track}, positions {view.start}–{view.end}: the table and plot use the same accepted samples.</caption>
          <thead><tr><th scope="col">CSV row</th><th scope="col">Time (s)</th>
            {axisNames.slice(0, trajectory.dimension).map((axis) => <th scope="col" key={axis}>{axis} (m)</th>)}
          </tr></thead>
          <tbody>{view.points.map(({ source }) => <tr key={source.row}>
            <th scope="row">{source.row}</th><td>{number(source.time)}</td>
            {source.coordinates.map((value, index) => <td key={axisNames[index]}>{number(value)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p>Analysis uses every admitted observation, not only the displayed page or track.
        The JSON export retains original track labels; the SI CSV uses numeric track IDs for spreadsheet safety.</p>
    </section>
  );
}
