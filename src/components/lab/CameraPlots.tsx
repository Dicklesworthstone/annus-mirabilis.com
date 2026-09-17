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
    Array.from({ length: t.length }, (_, i) => {
      const idx = i * p.d;
      return idx < s.values.length ? s.values.at(idx) : 0;
    }),
  );
  const tEnd = t.length > 0 ? t.at(t.length - 1) : 1;
  const lo = Math.min(0, ...values),
    hi = Math.max(1e-30, ...values),
    x = (v: number) => 70 + (460 * v) / (tEnd || 1),
    y = (v: number) => 242 - (205 * (v - lo)) / (hi - lo || 1);
  return (
    <figure className="plot camera-plot" {...identity(snapshot)}>
      <svg
        role="img"
        viewBox="0 0 570 300"
        aria-label="The same x path seen at frame starts, averaged during exposure, and measured by the camera. All positions are available in the numerical table."
      >
        <path className="axis" d="M70 25V245H530" />
        {[0, 0.5, 1].map((f) => (
          <g key={`fraction-${f}`}>
            <text x="63" y={y(lo + f * (hi - lo)) + 4} textAnchor="end">
              {display(lo + f * (hi - lo), 1e6)}
            </text>
            <text x={70 + 460 * f} y="267" textAnchor="middle">
              {display(tEnd * f)}
            </text>
          </g>
        ))}
        {series.map((s, j) => (
          <polyline
            key={s.id}
            data-camera-series={s.id}
            className={["camera-ideal", "camera-blurred", "curve"][j]}
            points={Array.from({ length: t.length }, (_, i) => {
              const xVal = t.at(i);
              const idx = i * p.d;
              const yVal = idx < s.values.length ? s.values.at(idx) : 0;
              return `${x(xVal)} ${y(yVal)}`;
            }).join(" ")}
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
  const t0 = times.length > 0 ? times.at(0) : 1e-6;
  const t5 = times.length > 5 ? times.at(5) : 1;
  const a0 = a.length > 0 ? a.at(0) : 1;
  const b5 = b.length > 5 ? b.at(5) : 1;
  const left = Math.log10(t5),
    right = Math.log10(t0),
    bottom = Math.log10(a0),
    top = Math.max(Math.log10(b5), bottom + 1);
  const x = (v: number) => 70 + (460 * (Math.log10(v) - left)) / (right - left || 1),
    y = (v: number) => 238 - (200 * (Math.log10(v) - bottom)) / (top - bottom || 1);
  return (
    <figure className="plot camera-plot" {...identity(snapshot)}>
      <svg
        role="img"
        viewBox="0 0 570 310"
        aria-label="Hypothetical zero-exposure apparent speeds on logarithmic axes. Localization error increases the apparent spread per interval. Numerical values follow."
      >
        <path className="axis" d="M70 25V242H530" />
        {[0, 2, 5].map((idx) => {
          const tVal = idx < times.length ? times.at(idx) : 0;
          return (
            <text key={`time-tick-${idx}`} x={x(tVal || 1e-6)} y="265" textAnchor="middle">
              {display(tVal)}
            </text>
          );
        })}
        {[bottom, (bottom + top) / 2, top].map((v) => (
          <text key={`speed-tick-${v}`} x="62" y={y(10 ** v) + 4} textAnchor="end">
            {display(10 ** v, 1e6)}
          </text>
        ))}
        {[
          { id: "ideal-speeds", curveClass: "camera-ideal", values: a },
          { id: "camera-speeds", curveClass: "curve", values: b },
        ].map((series) => (
          <polyline
            key={series.id}
            className={series.curveClass}
            points={Array.from({ length: times.length }, (_, j) => {
              const tVal = times.at(j);
              const val = j < series.values.length ? series.values.at(j) : 0;
              return `${x(tVal || 1e-6)} ${y(val)}`;
            }).join(" ")}
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
    n = Math.floor(values.length / 6);

  const trials = [];
  for (let idx = 0; idx < n; idx++) {
    const offset = idx * 6;
    const naiveLower = values.at(offset);
    const naiveUpper = values.at(offset + 1);
    const pairLower = values.at(offset + 2);
    const pairUpper = values.at(offset + 3);
    const isEmpty = values.at(offset + 4) === 1;
    const covers = values.at(offset + 5) === 1;
    trials.push({
      id: `trial-data-${idx + 1}`,
      idx,
      trialNum: idx + 1,
      naiveLower,
      naiveUpper,
      pairLower,
      pairUpper,
      cells: [
        { name: "naive-lower", val: naiveLower, isPair: false },
        { name: "naive-upper", val: naiveUpper, isPair: false },
        { name: "pair-lower", val: pairLower, isPair: true },
        { name: "pair-upper", val: pairUpper, isPair: true },
      ],
      isEmpty,
      covers,
    });
  }

  const max = Math.max(1.25, ...trials.map((t) => Math.max(t.naiveUpper, t.pairUpper)));
  const x = (v: number) => 55 + (475 * v) / max,
    y = (i: number) => 30 + (290 * (i + 0.5)) / (n || 1);
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
          {trials.map((t) => (
            <g key={t.id}>
              <line
                className="camera-ideal"
                x1={x(t.naiveLower)}
                x2={x(t.naiveUpper)}
                y1={y(t.idx) - 1}
                y2={y(t.idx) - 1}
              />
              {t.isEmpty ? (
                <text x="43" y={y(t.idx) + 4}>
                  ×
                </text>
              ) : (
                <line
                  className="curve"
                  x1={x(t.pairLower)}
                  x2={x(t.pairUpper)}
                  y1={y(t.idx) + 1}
                  y2={y(t.idx) + 1}
                />
              )}
            </g>
          ))}
          {[
            { id: "bound-0", val: 0 },
            { id: "bound-1", val: 1 },
            { id: "bound-max", val: max },
          ].map((bound) => (
            <text key={bound.id} x={x(bound.val)} y="344" textAnchor="middle">
              {display(bound.val)}
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
              {trials.map((t) => (
                <tr key={t.id}>
                  <th scope="row">{t.trialNum}</th>
                  {t.cells.map((cell) => (
                    <td key={`${t.id}-${cell.name}`}>
                      {cell.isPair && t.isEmpty ? "Empty set" : display(cell.val)}
                    </td>
                  ))}
                  <td>{t.covers ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
