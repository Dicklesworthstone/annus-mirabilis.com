import { useId } from "react";
import {
  type Bm01Parameters,
  TRACE_COUNT,
  TRACE_POINTS,
} from "../../experiments/bm01/definition.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { ScaleBar } from "../../visuals/kit/ScaleBar.tsx";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import { array, display, identity, scalar } from "./presentation.ts";

export function TracerPaths({ snapshot, zoom }: { snapshot: AcceptedSnapshot; zoom: number }) {
  const id = useId(),
    p = snapshot.parameters as Bm01Parameters,
    trace = array(snapshot, "traceCoordinates"),
    positions = array(snapshot, "tracerPositions");
  const halfWidth = 5e-6 / zoom,
    coord = (x: number) => 150 + (x / halfWidth) * 125;
  const representationScale: RepresentationScale = {
    spatialMagnification: { appliesTo: "scene", factor: zoom },
    simulatedElapsedTime: { quantityId: "elapsedTime", value: p.interval, unit: "s" },
    playbackMultiplier: 1,
    glyphSize: { drawnPx: 3, represents: "none" },
    quantityNormalization: { kind: "none" },
  };
  let outside = 0;
  for (let i = 0; i < p.M; i++)
    if (Math.abs(positions.at(i * 3)) > halfWidth || Math.abs(positions.at(i * 3 + 1)) > halfWidth)
      outside++;
  return (
    <figure
      className="plot"
      {...identity(snapshot)}
      data-result-status="value"
      data-scale-bar="1um"
    >
      <svg
        viewBox="0 0 300 300"
        role="img"
        aria-label={`Displacement traces of ${Math.min(TRACE_COUNT, p.M)} synthetic tracers. ${outside} of ${p.M} endpoints are outside the viewport; all remain in the statistics.`}
      >
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x="25" y="25" width="250" height="250" />
          </clipPath>
        </defs>
        <rect x="25" y="25" width="250" height="250" fill="none" className="axis" />
        <path d="M25 150H275M150 25V275" className="axis" />
        <g clipPath={`url(#${id}-clip)`}>
          {Array.from({ length: Math.min(TRACE_COUNT, p.M) }, (_, i) => {
            const path = Array.from(
              { length: TRACE_POINTS },
              (_, k) =>
                `${k ? "L" : "M"}${coord(trace.at((i * TRACE_POINTS + k) * 2))},${300 - coord(trace.at((i * TRACE_POINTS + k) * 2 + 1))}`,
            ).join(" ");
            return <path key={path} d={path} className="curve tracer-path" />;
          })}
        </g>
        <circle cx="150" cy="150" r="3" />
        <ScaleBar
          scale={representationScale}
          physicalLength={1}
          unit="μm"
          basePixelsPerUnit={25}
          x={35}
          y={260}
        />
        <text x="25" y="293">
          −{display(halfWidth, 1e6)} μm
        </text>
        <text x="205" y="293">
          +{display(halfWidth, 1e6)} μm
        </text>
        <text x="30" y="17">
          y displacement
        </text>
      </svg>
      <figcaption>
        Displacements from a common origin, not a literal microscope image. Lines connect recorded
        positions and do not supply an instantaneous velocity. {outside} / {p.M} endpoints lie
        outside this view; none are removed from the ensemble.
      </figcaption>
    </figure>
  );
}
export function TracerHistogram({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const edges = array(snapshot, "histogramEdges"),
    observed = array(snapshot, "histogramFrequencies"),
    model = array(snapshot, "histogramModel");
  const maximum = Math.max(
    ...Array.from({ length: observed.length }, (_, i) => Math.max(observed.at(i), model.at(i))),
    0.01,
  );
  const x = (i: number) => 35 + (i / observed.length) * 240,
    y = (v: number) => 205 - (v / maximum) * 165;
  return (
    <figure className="plot" {...identity(snapshot)}>
      <svg
        viewBox="0 0 300 255"
        role="img"
        aria-label="Histogram of every tracer's signed coordinate displacement. Solid bars are sampled proportions; the dashed line gives model probabilities for the same bins."
      >
        <path d="M35 35V205H275" className="axis" />
        {Array.from({ length: observed.length }, (_, i) => {
          const xPos = x(i);
          return (
            <rect
              key={xPos}
              x={xPos}
              y={y(observed.at(i))}
              width={240 / observed.length - 0.5}
              height={205 - y(observed.at(i))}
              className="histogram-bar"
            />
          );
        })}
        <path
          d={Array.from(
            { length: model.length },
            (_, i) => `${i ? "L" : "M"}${x(i + 0.5)},${y(model.at(i))}`,
          ).join(" ")}
          className="comparison-curve"
        />
        <text x="35" y="20">
          Fraction in each bin
        </text>
        <text x="35" y="228">
          {display(edges.at(0), 1e6)} μm
        </text>
        <text x="212" y="228">
          {display(edges.at(edges.length - 1), 1e6)} μm
        </text>
      </svg>
      <figcaption>
        Solid bars: the synthetic sample. Dashed line: probabilities of the same bins under the
        unbounded model, not a density curve. Counts beyond the plotted range:{" "}
        {scalar(snapshot, "underflow")} left, {scalar(snapshot, "overflow")} right.
      </figcaption>
    </figure>
  );
}
export const PLOT_KINDS: Readonly<
  Record<string, { suffix: string; label: string; unit: string; factor: number }>
> = {
  mean: { suffix: "Mean", label: "Signed coordinate mean", unit: "μm", factor: 1e6 },
  "mean-square": {
    suffix: "Msd",
    label: "Total mean-square displacement",
    unit: "μm²",
    factor: 1e12,
  },
  rms: { suffix: "Rms", label: "RMS distance", unit: "μm", factor: 1e6 },
  apparent: { suffix: "Apparent", label: "Apparent coordinate speed", unit: "μm/s", factor: 1e6 },
};
export function TracerScaling({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const p = snapshot.parameters as Bm01Parameters;
  const kind = PLOT_KINDS[p.statistic];
  if (!kind) {
    return (
      <section {...identity(snapshot)} data-refusal-code="unknown-statistic">
        <h3>Plot refusal</h3>
        <p className="notice" role="alert">
          Unknown plot statistic &ldquo;{p.statistic}&rdquo;. Valid choices are &ldquo;mean&rdquo;,
          &ldquo;mean-square&rdquo;, &ldquo;rms&rdquo;, or &ldquo;apparent&rdquo;.
        </p>
      </section>
    );
  }
  const times = array(snapshot, "plotTimes"),
    sample = array(snapshot, `plotSample${kind.suffix}`),
    model = array(snapshot, `plotModel${kind.suffix}`);
  const log = p.statistic !== "mean",
    raw = [...sample.copy(), ...model.copy()],
    admitted = raw.filter((v) => !log || v > 0),
    transform = (v: number) => (log ? Math.log10(v) : v);
  let lo = Math.min(...admitted.map(transform)),
    hi = Math.max(...admitted.map(transform));
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const timeLo = Math.log10(times.at(0)),
    timeHi = Math.log10(times.at(times.length - 1));
  const x = (i: number) => 40 + ((Math.log10(times.at(i)) - timeLo) / (timeHi - timeLo || 1)) * 230,
    y = (v: number) => 205 - ((transform(v) - lo) / (hi - lo)) * 160;
  const path = (values: ReturnType<typeof array>) => {
    let started = false;
    return Array.from({ length: values.length }, (_, i) => {
      const v = values.at(i);
      if (log && v <= 0) {
        started = false;
        return "";
      }
      const point = `${started ? "L" : "M"}${x(i)},${y(v)}`;
      started = true;
      return point;
    }).join(" ");
  };
  return (
    <section {...identity(snapshot)}>
      <h3>{kind.label} over recorded time</h3>
      <figure className="plot">
        <svg
          viewBox="0 0 300 250"
          role="img"
          aria-label={`${kind.label} compared with the model. Time uses a logarithmic axis; the vertical axis is ${log ? "logarithmic" : "linear"}. Exact values are in the following table.`}
        >
          <path d="M40 35V205H270" className="axis" />
          <path d={path(sample)} className="curve" />
          <path d={path(model)} className="comparison-curve" />
          <text x="40" y="19">
            {kind.unit} · {log ? "log scale" : "linear scale"}
          </text>
          <text x="40" y="230">
            {display(times.at(0))} s
          </text>
          <text x="220" y="230">
            {display(times.at(times.length - 1))} s
          </text>
        </svg>
        <figcaption>
          Solid: this sample. Dashed: the model. The time axis is logarithmic.{" "}
          {log
            ? "Zero sample values, if any, remain in the table but cannot appear on a log scale."
            : ""}{" "}
          All times refer to the same recorded paths.
        </figcaption>
      </figure>
      <details>
        <summary>Read the comparison as a table</summary>
        <table>
          <caption>
            {kind.label} ({kind.unit})
          </caption>
          <thead>
            <tr>
              <th>Time (s)</th>
              <th>Sample</th>
              <th>Model</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: times.length }, (_, i) => {
              const timeVal = display(times.at(i));
              return (
                <tr key={timeVal}>
                  <th scope="row">{timeVal}</th>
                  <td>{display(sample.at(i), kind.factor)}</td>
                  <td>{display(model.at(i), kind.factor)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </section>
  );
}
