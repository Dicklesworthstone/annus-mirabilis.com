import type { ComparisonSnapshot } from "../../experiments/compare/Baseline.ts";
import { comparisonDisplay } from "../../experiments/compare/comparisonStatement.ts";
import {
  cameraComparisonFrames,
  cameraComparisonInterval,
  type CameraComparisonFrame,
} from "../../experiments/bm08/comparison.ts";

const intervals = [
  ["naiveInterval", "Naive independent-increment interval"],
  ["centeredInterval", "Drift-centered independent-increment interval"],
  ["pairInterval", "Noise-aware disjoint-pair confidence set"],
] as const;

function IntervalCell({ snapshot, id }: {
  snapshot: ComparisonSnapshot;
  id: (typeof intervals)[number][0];
}) {
  const interval = cameraComparisonInterval(snapshot, id);
  return interval.status === "value" ? (
    <span data-camera-interval={id} data-result-status="value">
      {comparisonDisplay(interval.lower, 1e12)} to {comparisonDisplay(interval.upper, 1e12)} μm²/s
    </span>
  ) : (
    <span data-camera-interval={id} data-result-status="not-applicable">{interval.reason}</span>
  );
}

function FrameTable({ rows, label }: { rows: readonly CameraComparisonFrame[]; label: string }) {
  return (
    <details>
      <summary>Read every {label.toLowerCase()} frame and coordinate</summary>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard scrolling of the complete frame table */}
      <section className="comparison-scroll" tabIndex={0} aria-label={`${label} camera frames`}>
        <table>
          <caption>{label}: accepted frame-start times in seconds and positions in μm</caption>
          <thead><tr>
            <th scope="col">Frame</th><th scope="col">Time</th><th scope="col">Coordinate</th>
            <th scope="col">Latent position</th><th scope="col">Exposure average</th><th scope="col">Camera position</th>
          </tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={`${row.frame}-${row.coordinate}`}>
              <th scope="row">{row.frame}</th><td>{comparisonDisplay(row.time)}</td><td>{row.coordinate}</td>
              <td>{comparisonDisplay(row.latent, 1e6)}</td>
              <td>{comparisonDisplay(row.blurred, 1e6)}</td>
              <td>{comparisonDisplay(row.observed, 1e6)}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </details>
  );
}

/** Layout arithmetic only: all positions, times and intervals are accepted owner outputs. */
export function CameraComparisonReadouts({ baseline, variant, uid }: {
  baseline: ComparisonSnapshot; variant: ComparisonSnapshot; uid: string;
}) {
  const first = cameraComparisonFrames(baseline), second = cameraComparisonFrames(variant);
  const series = [
    { label: "Baseline", rows: first.filter((row) => row.coordinate === "x") },
    { label: "Variant", rows: second.filter((row) => row.coordinate === "x") },
  ];
  const times = series.flatMap((entry) => entry.rows.map((row) => row.time));
  const positions = series.flatMap((entry) => entry.rows.flatMap((row) => [row.latent, row.blurred, row.observed]));
  const tMin = Math.min(...times), tMax = Math.max(...times);
  const low = Math.min(...positions), high = Math.max(...positions);
  const padding = Math.max((high - low) * 0.08, 1e-9);
  const yMin = low - padding, yMax = high + padding;
  const x = (time: number) => 72 + ((time - tMin) / (tMax - tMin || 1)) * 490;
  const y = (position: number) => 228 - ((position - yMin) / (yMax - yMin)) * 192;
  const path = (rows: readonly CameraComparisonFrame[], key: "latent" | "blurred" | "observed") =>
    rows.map((row, i) => `${i === 0 ? "M" : "L"}${x(row.time).toFixed(3)},${y(row[key]).toFixed(3)}`).join(" ");
  return (
    <div data-camera-comparison-readouts data-baseline-snapshot={baseline.snapshotVersion}
      data-variant-snapshot={variant.snapshotVersion}>
      <h3>The same particle, two observations</h3>
      <p>
        Both plots use the same time and position scales. They show the x coordinate only;
        the tables below retain every selected coordinate. Lines join sampled positions as guides,
        not as a reconstruction of motion between frames.
      </p>
      <div className="camera-comparison-plots">
        {series.map(({ label, rows }) => (
          <figure key={label}>
            <figcaption>{label}</figcaption>
            <svg viewBox="0 0 600 280" role="img" aria-labelledby={`${uid}-${label}-title ${uid}-${label}-desc`}>
              <title id={`${uid}-${label}-title`}>{label} camera positions on the shared scales</title>
              <desc id={`${uid}-${label}-desc`}>
                {rows.length} sampled x positions. Short dashes show latent frame-start positions,
                long dashes show exposure averages, and a solid line shows camera positions.
                All plotted values are available in the frame table below.
              </desc>
              <path d="M72,36V228H562" className="camera-comparison-axis" />
              <text x="66" y="42" textAnchor="end">{comparisonDisplay(yMax, 1e6)}</text>
              <text x="66" y="228" textAnchor="end">{comparisonDisplay(yMin, 1e6)}</text>
              <text x="72" y="247">{comparisonDisplay(tMin)}</text>
              <text x="562" y="247" textAnchor="end">{comparisonDisplay(tMax)}</text>
              <text x="310" y="271" textAnchor="middle">Time (s)</text>
              <text x="74" y="20">Position in x (μm)</text>
              <path d={path(rows, "latent")} className="camera-comparison-latent" />
              <path d={path(rows, "blurred")} className="camera-comparison-blurred" />
              <path d={path(rows, "observed")} className="camera-comparison-observed" />
            </svg>
          </figure>
        ))}
      </div>
      <p className="camera-comparison-legend">
        <span className="camera-comparison-latent-key">
          Short dashes: latent frame-start positions
        </span>
        {" · "}
        <span className="camera-comparison-blurred-key">Long dashes: exposure averages</span>
        {" · "}
        <span className="camera-comparison-observed-key">Solid: camera positions</span>
      </p>
      <h3>Which uncertainty statement applies?</h3>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard scrolling of the paired confidence sets */}
      <section className="comparison-scroll" tabIndex={0} aria-label="Paired camera confidence sets">
        <table>
          <caption>Each confidence set belongs to its own completed observation and estimator settings</caption>
          <thead><tr><th scope="col">Procedure</th>
            <th scope="col">Baseline ({comparisonDisplay(baseline.parameters.coverage ?? "", 100)}% target)</th>
            <th scope="col">Variant ({comparisonDisplay(variant.parameters.coverage ?? "", 100)}% target)</th>
          </tr></thead>
          <tbody>{intervals.map(([id, label]) => (
            <tr key={id}><th scope="row">{label}</th>
              <td><IntervalCell snapshot={baseline} id={id} /></td>
              <td><IntervalCell snapshot={variant} id={id} /></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <p>
        These are paired observations, not independent trials. Neither overlapping intervals nor
        their ratios establish statistical significance. No uncertainty for a difference or ratio
        is calculated here. A negative unconstrained point estimate stays negative; an unavailable
        interval keeps the owner's explanation instead of becoming zero.
      </p>
      <FrameTable rows={first} label="Baseline" />
      <FrameTable rows={second} label="Variant" />
    </div>
  );
}
