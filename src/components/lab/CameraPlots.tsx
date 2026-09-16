import type { Bm08Parameters } from "../../experiments/bm08/definition.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { InferenceValue } from "./InferencePlots.tsx";
import { array, display, identity, result } from "./presentation.ts";
export function CameraPath({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const p = snapshot.parameters as Bm08Parameters,
    t = array(snapshot, "times");
  const series = ["idealPositions", "blurredPositions", "positions"].map((id) => ({
    id,
    values: array(snapshot, id),
  }));
  const values = series.flatMap((s) =>
    Array.from({ length: t.length }, (_, i) => s.values.at(i * p.d)!),
  );
  const lo = Math.min(0, ...values),
    hi = Math.max(1e-30, ...values),
    x = (v: number) => 70 + (460 * v) / t.at(t.length - 1)!,
    y = (v: number) => 242 - (205 * (v - lo)) / (hi - lo);
  return (
    <figure className="plot camera-plot" {...identity(snapshot)}>
      <svg
        role="img"
        viewBox="0 0 570 300"
        aria-label="The same x path seen at frame starts, averaged during exposure, and measured by the camera. All positions are available in the numerical table."
      >
        <path className="axis" d="M70 25V245H530" />
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <text x="63" y={y(lo + f * (hi - lo)) + 4} textAnchor="end">
              {display(lo + f * (hi - lo), 1e6)}
            </text>
            <text x={70 + 460 * f} y="267" textAnchor="middle">
              {display(t.at(t.length - 1)! * f)}
            </text>
          </g>
        ))}
        {series.map((s, j) => (
          <polyline
            key={s.id}
            data-camera-series={s.id}
            className={["camera-ideal", "camera-blurred", "curve"][j]}
            points={Array.from(
              { length: t.length },
              (_, i) => `${x(t.at(i)!)} ${y(s.values.at(i * p.d)!)}`,
            ).join(" ")}
          />
        ))}
        <text x="70" y="17">
          x position (μm)
        </text>
        <text x="300" y="294" textAnchor="middle">
          Exposure start time (s)
        </text>
      </svg>
      <figcaption>
        Dashed: retained position at frame start. Dotted: exposure average before stage drift or
        localization error. Solid: camera observation. Lines only connect the selected frames; the y
        coordinate, when selected, is included in all estimates and tables.
      </figcaption>
    </figure>
  );
}
export function CameraSpeed({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const times = array(snapshot, "speedTimes"),
    a = array(snapshot, "idealSpeeds"),
    b = array(snapshot, "cameraSpeeds");
  const left = Math.log10(times.at(5)!),
    right = Math.log10(times.at(0)!),
    bottom = Math.log10(a.at(0)!),
    top = Math.max(Math.log10(b.at(5)!), bottom + 1);
  const x = (v: number) => 70 + (460 * (Math.log10(v) - left)) / (right - left),
    y = (v: number) => 238 - (200 * (Math.log10(v) - bottom)) / (top - bottom);
  return (
    <figure className="plot camera-plot" {...identity(snapshot)}>
      <svg
        role="img"
        viewBox="0 0 570 310"
        aria-label="Hypothetical zero-exposure apparent speeds on logarithmic axes. Localization error increases the apparent spread per interval. Numerical values follow."
      >
        <path className="axis" d="M70 25V242H530" />
        {[0, 2, 5].map((i) => (
          <text key={i} x={x(times.at(i)!)} y="265" textAnchor="middle">
            {display(times.at(i)!)}
          </text>
        ))}
        {[bottom, (bottom + top) / 2, top].map((v) => (
          <text key={v} x="62" y={y(10 ** v) + 4} textAnchor="end">
            {display(10 ** v, 1e6)}
          </text>
        ))}
        {[a, b].map((values, i) => (
          <polyline
            key={i}
            className={i ? "curve" : "camera-ideal"}
            points={Array.from(
              { length: times.length },
              (_, j) => `${x(times.at(j)!)} ${y(values.at(j)!)}`,
            ).join(" ")}
          />
        ))}
        <text x="70" y="17">
          Apparent spread speed (μm/s)
        </text>
        <text x="300" y="293" textAnchor="middle">
          Hypothetical spacing (s); logarithmic axes
        </text>
      </svg>
      <figcaption>
        Dashed: ideal spread divided by interval. Solid: the same model with localization noise and
        zero exposure. These are analytical comparisons, not extra observed frames or instantaneous
        particle velocities.
      </figcaption>
    </figure>
  );
}
export function CameraCoverage({ snapshot }: { snapshot: AcceptedSnapshot }) {
  if (result(snapshot, "coverageIntervals").status !== "value")
    return (
      <p className="notice">
        <InferenceValue snapshot={snapshot} id="coverageIntervals" />
      </p>
    );
  const values = array(snapshot, "coverageIntervals"),
    n = values.length / 6;
  const max = Math.max(
    1.25,
    ...Array.from({ length: n }, (_, i) => Math.max(values.at(i * 6 + 1)!, values.at(i * 6 + 3)!)),
  );
  const x = (v: number) => 55 + (475 * v) / max,
    y = (i: number) => 30 + (290 * (i + 0.5)) / n;
  return (
    <>
      <figure className="plot camera-plot" {...identity(snapshot)}>
        <svg
          role="img"
          viewBox="0 0 570 365"
          aria-label="All hypothetical naive and corrected intervals, normalized by the true diffusivity. A vertical line marks the true value. Empty corrected sets are shown as crosses at the left margin, not as zero-width intervals."
        >
          <path className="axis" d="M55 20V325H530" />
          <path className="camera-truth" d={`M${x(1)} 20V325`} />
          {Array.from({ length: n }, (_, i) => (
            <g key={i}>
              <line
                className="camera-ideal"
                x1={x(values.at(i * 6)!)}
                x2={x(values.at(i * 6 + 1)!)}
                y1={y(i) - 1}
                y2={y(i) - 1}
              />
              {values.at(i * 6 + 4) === 1 ? (
                <text x="43" y={y(i) + 4}>
                  ×
                </text>
              ) : (
                <line
                  className="curve"
                  x1={x(values.at(i * 6 + 2)!)}
                  x2={x(values.at(i * 6 + 3)!)}
                  y1={y(i) + 1}
                  y2={y(i) + 1}
                />
              )}
            </g>
          ))}
          {[0, 1, max].map((v, i) => (
            <text key={i} x={x(v)} y="344" textAnchor="middle">
              {display(v)}
            </text>
          ))}
          <text x="280" y="362" textAnchor="middle">
            Interval bounds / generating D
          </text>
        </svg>
        <figcaption>
          Dashed: deliberately naive zero-drift procedure, even when its assumptions fail. Solid:
          noise-aware disjoint pairs. The vertical marker is the fixed generating diffusivity. No
          intervals or empty sets are discarded.
        </figcaption>
      </figure>
      <details>
        <summary>Read every hypothetical interval</summary>
        <div className="table-scroll">
          <table data-coverage-table>
            <caption>All repeated procedures; bounds divided by generating D</caption>
            <thead>
              <tr>
                <th scope="col">Trial</th>
                <th scope="col">Naive lower</th>
                <th scope="col">Naive upper</th>
                <th scope="col">Pair lower</th>
                <th scope="col">Pair upper</th>
                <th scope="col">Pair covers</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: n }, (_, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  {[0, 1, 2, 3].map((c) => (
                    <td key={c}>
                      {c >= 2 && values.at(i * 6 + 4) === 1
                        ? "Empty set"
                        : display(values.at(i * 6 + c)!)}
                    </td>
                  ))}
                  <td>{values.at(i * 6 + 5) ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
