import { type ReactNode, useId, useMemo, useState } from "react";
import {
  type AcceptedMeasuredAnalysis,
  compareMeasuredScope,
  isMomentAnalysis,
  observationDifference,
  summarizeMeasuredAnalysis,
} from "../../experiments/bm07/trajectoryComparison.ts";
import { trajectoryTrackIds } from "../../experiments/bm07/trajectoryInspection.ts";
import { display } from "./presentation.ts";

export function MeasuredTrajectoryComparison({ current }: { current: AcceptedMeasuredAnalysis }) {
  const id = useId();
  const [pinned, setPinned] = useState<AcceptedMeasuredAnalysis | null>(null);
  const [trackChoice, setTrackChoice] = useState("");
  const different = useMemo(
    () =>
      pinned
        ? observationDifference(pinned.analysis.trajectory, current.analysis.trajectory)
        : null,
    [pinned, current],
  );
  const tracking = Boolean(
    pinned && (isMomentAnalysis(pinned.analysis) || isMomentAnalysis(current.analysis)),
  );
  const tracks = useMemo(() => trajectoryTrackIds(current.analysis.trajectory), [current]);
  const track = tracks.includes(trackChoice) ? trackChoice : (tracks[0] ?? "");
  const show = pinned && pinned.run !== current.run && !different;
  const summaries = show
    ? ([
        summarizeMeasuredAnalysis(pinned.analysis, track),
        summarizeMeasuredAnalysis(current.analysis, track),
      ] as const)
    : null;
  const comparison = summaries ? compareMeasuredScope(...summaries) : null;
  type Summary = ReturnType<typeof summarizeMeasuredAnalysis>;
  const row = (label: string, render: (s: Summary) => ReactNode) =>
    summaries && (
      <tr>
        <th scope="row">{label}</th>
        <td>{render(summaries[0])}</td>
        <td>{render(summaries[1])}</td>
      </tr>
    );
  return (
    <section aria-labelledby={`${id}-title`} className="reading">
      <h3 id={`${id}-title`}>Compare models on these observations</h3>
      <p>
        Pin an accepted analysis, then apply another model or assumption to the same positions. The
        pinned result stays in this tab until released or the imported data are cleared.
      </p>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          disabled={pinned?.run === current.run}
          onClick={() => {
            setPinned(current);
            setTrackChoice("");
          }}
        >
          {pinned ? "Replace pinned analysis with current result" : "Pin this accepted analysis"}
        </button>
        {pinned && (
          <button type="button" className="secondary" onClick={() => setPinned(null)}>
            Release pinned analysis
          </button>
        )}
      </div>
      {pinned && (
        <p role="status">
          Pinned result {pinned.run} from {pinned.source}. Current accepted result {current.run}{" "}
          from {current.source}.
        </p>
      )}
      {different && (
        <p className="notice" data-measured-comparison="different-record">
          {different} These runs use different observations. A difference between their fitted
          values would mix model changes with data changes.
        </p>
      )}
      {summaries && pinned && (
        <>
          <p>
            The two ledgers have identical track IDs in the same order, elapsed times, coordinate
            axes and calibrated SI positions. The estimators can use those positions differently.
          </p>
          {tracking && tracks.length > 1 && (
            <div className="input-field">
              <label htmlFor={`${id}-track`}>Track for per-track moment estimates</label>
              <select
                id={`${id}-track`}
                value={track}
                onChange={(event) => setTrackChoice(event.target.value)}
              >
                {tracks.map((key) => (
                  <option key={key}>{key}</option>
                ))}
              </select>
            </div>
          )}
          <table className="inference-summary">
            <caption>Accepted diffusion analyses of the same measured positions</caption>
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Pinned result {pinned.run}</th>
                <th scope="col">Current result {current.run}</th>
              </tr>
            </thead>
            <tbody>
              {row("Observation model", (s) => s.model)}
              {row("Tracks and coordinate axes", (s) => (
                <>
                  {s.tracks.length ? s.tracks.join(", ") : "No admitted track"} ·{" "}
                  {s.axes.join(", ")}
                </>
              ))}
              {row("Measurements used", (s) => s.sample)}
              {row("Diffusion point estimate (m²/s)", (s) =>
                s.estimate === null ? "Unavailable" : display(s.estimate),
              )}
              {row("Diffusion confidence set (m²/s)", (s) =>
                s.interval
                  ? `[${display(s.interval.lower)}, ${display(s.interval.upper)}] at ${Number((100 * s.interval.coverage).toFixed(4))}% coverage`
                  : s.intervalNote,
              )}
              {row("Model assumptions and limits", (s) => s.limits)}
            </tbody>
          </table>
          <p data-measured-comparison={comparison?.kind}>
            {comparison?.kind === "comparable" ? (
              <>
                Current minus pinned diffusion estimate: {display(comparison.difference)} m²/s. This
                arithmetic change uses the same observations. The individual confidence sets do not
                give a confidence interval for their difference.
              </>
            ) : comparison?.kind === "different-scope" ? (
              "The estimates cover different tracks or coordinate axes. Their values are shown with their respective samples; there is no matched difference for this comparison."
            ) : (
              "A matched difference needs two physically admissible, resolved diffusion estimates."
            )}
          </p>
        </>
      )}
    </section>
  );
}
