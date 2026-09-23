import type { Bm07Parameters } from "../../experiments/bm07/definition.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { renderInferenceFamily } from "./inferenceView.ts";
import { array, display, identity, result } from "./presentation.ts";

export function InferenceValue({
  snapshot,
  id,
  factor = 1,
}: {
  snapshot: AcceptedSnapshot;
  id: string;
  factor?: number;
}) {
  const r = result(snapshot, id);
  if (r.status === "value" && typeof r.value === "number")
    return (
      <span data-output={id} data-value={r.value}>
        {display(r.value, factor)}
      </span>
    );
  const text =
    r.status === "underdetermined"
      ? r.compatibleFamily
      : "reason" in r
        ? r.reason
        : "No numerical value is available for this question.";
  return (
    <span data-output={id} data-result-status={r.status}>
      {text}
    </span>
  );
}

export function InferenceInterval({
  snapshot,
  id,
  factor = 1,
}: {
  snapshot: AcceptedSnapshot;
  id: string;
  factor?: number;
}) {
  if (result(snapshot, id).status !== "value")
    return <InferenceValue snapshot={snapshot} id={id} />;
  const v = array(snapshot, id);
  const lower = v.at(0);
  const upper = v.at(1);
  if (lower === undefined || upper === undefined) {
    return <InferenceValue snapshot={snapshot} id={id} />;
  }
  return (
    <span data-output={id} data-lower={lower} data-upper={upper}>
      {display(lower, factor)} – {display(upper, factor)}
    </span>
  );
}

export function InferencePath({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const p = snapshot.parameters as Bm07Parameters,
    times = array(snapshot, "observationTimes"),
    values = array(snapshot, "observationPositions");
  const coordinates = values.copy();
  const max = Math.max(...coordinates.map(Math.abs), 1e-30);
  const maxTime = times.length > 0 ? (times.at(times.length - 1) ?? 1) : 1;
  const safeMaxTime = maxTime > 0 ? maxTime : 1;
  // 300 units wide, like the walk and tracer plots: at 570 units the site's label size rendered
  // at 7.5px on a 390px phone. The plot starts at x = 68 so a value such as -7.9094 fits.
  const x = (t: number) => 68 + (217 * t) / safeMaxTime;
  const y = (v: number) => 142 - (102 * v) / max;
  const coordinateList = Array.from({ length: p.d }, (_, c) => `coord-${c}`);

  return (
    <figure className="plot" {...identity(snapshot)}>
      <svg
        role="img"
        viewBox="0 0 300 300"
        aria-label="Observed synthetic coordinates versus time; every selected position is in the table below."
      >
        <path className="axis" d="M68 25V250H285M68 142H285" />
        {[1, 0, -1].map((k) => (
          <text key={k} x="62" y={y(k * max) + 4} textAnchor="end">
            {display(k * max, 1e6)}
          </text>
        ))}
        {[0, 0.5, 1].map((f) => (
          <text key={f} x={68 + 217 * f} y="270" textAnchor={f === 1 ? "end" : "middle"}>
            {display(safeMaxTime * f)}
          </text>
        ))}
        {coordinateList.map((coordKey, c) => (
          <polyline
            key={coordKey}
            data-coordinate={c}
            className={c === 0 ? "curve" : "comparison-curve"}
            points={Array.from({ length: times.length }, (_, i) => {
              const t = times.at(i) ?? 0;
              const v = values.at(i * p.d + c) ?? 0;
              return `${x(t)} ${y(v)}`;
            }).join(" ")}
          />
        ))}
        <text x="68" y="17">
          Displacement (μm)
        </text>
        <text x="176" y="294" textAnchor="middle">
          Observation time (s)
        </text>
      </svg>
      <figcaption>
        One synthetic path, observed at the accepted spacing. Solid: x; dashed: y when selected.
        Connecting lines join observations; they do not claim a resolved microscopic trajectory.
      </figcaption>
    </figure>
  );
}

/** Shared with the fixed-observation inference workbench; no duplicate family view. */
export function InferenceFamily({ snapshot }: { snapshot: AcceptedSnapshot }) {
  return <div {...{ dangerouslySetInnerHTML: { __html: renderInferenceFamily(snapshot) } }} />;
}

export function InferenceCoverage({
  snapshot,
  molecular = false,
}: {
  snapshot: AcceptedSnapshot;
  molecular?: boolean;
}) {
  const key = molecular ? "coverageMolecular" : "coverageDiffusion",
    countId = molecular ? "molecularCoveringCount" : "diffusionCoveringCount";
  if (result(snapshot, key).status !== "value")
    return (
      <p className="notice">
        <InferenceValue snapshot={snapshot} id={key} />
      </p>
    );
  const values = array(snapshot, key),
    rows = Math.floor(values.length / 4);

  type TrialItem = {
    index: number;
    id: string;
    estimate: number;
    lower: number;
    upper: number;
    covers: boolean;
  };

  const trials: TrialItem[] = [];
  for (let i = 0; i < rows; i++) {
    const est = values.at(i * 4);
    const low = values.at(i * 4 + 1);
    const up = values.at(i * 4 + 2);
    const cov = values.at(i * 4 + 3);
    if (est !== undefined && low !== undefined && up !== undefined) {
      trials.push({
        index: i,
        id: `trial-item-${i + 1}`,
        estimate: est,
        lower: low,
        upper: up,
        covers: cov === 1,
      });
    }
  }

  const bounds = trials.flatMap((t) => [t.lower, t.upper]);
  const lo = Math.min(0, ...bounds.map(Math.log10));
  const hi = Math.max(0, ...bounds.map(Math.log10));
  const span = Math.max(hi - lo, 0.01);
  const x = (v: number) => 68 + (217 * (Math.log10(v) - lo)) / span;
  const y = (i: number) => 32 + (340 * i) / Math.max(rows - 1, 1);

  return (
    <figure
      className="plot"
      {...identity(snapshot)}
      data-coverage-kind={molecular ? "molecular" : "diffusion"}
    >
      <svg
        role="img"
        viewBox="0 0 300 425"
        aria-label={`${rows} hypothetical ${molecular ? "molecular-number" : "diffusivity"} confidence intervals divided by the true generating parameter. Dashed intervals miss the true value.`}
      >
        <path className="axis" d="M68 20V380H285" />
        <line x1={x(1)} x2={x(1)} y1="20" y2="380" className="inference-truth" />
        {trials.map((trial) => (
          <g key={trial.id} className={trial.covers ? "inference-cover" : "inference-miss"}>
            <line x1={x(trial.lower)} x2={x(trial.upper)} y1={y(trial.index)} y2={y(trial.index)} />
            <circle cx={x(trial.estimate)} cy={y(trial.index)} r="1.8" />
          </g>
        ))}
        <text x="62" y="36" textAnchor="end">
          1
        </text>
        <text x="62" y="376" textAnchor="end">
          {rows}
        </text>
        <text x={Math.min(235, Math.max(118, x(1)))} y="17" textAnchor="middle">
          True value = 1
        </text>
        {[
          { key: "lo", v: lo, xPos: 68, anchor: "middle" },
          { key: "mid", v: (lo + hi) / 2, xPos: 68 + 217 / 2, anchor: "middle" },
          { key: "hi", v: hi, xPos: 285, anchor: "end" },
        ].map((tick) => (
          <text key={tick.key} x={tick.xPos} y="400" textAnchor={tick.anchor}>
            {display(10 ** tick.v)}
          </text>
        ))}
        <text x="176" y="422" textAnchor="middle">
          Estimate ÷ true value, log scale
        </text>
      </svg>
      <figcaption>
        <InferenceValue snapshot={snapshot} id={countId} /> of {rows} intervals cover the fixed
        generating value. Solid intervals cover it; dashed intervals miss. Every trial is retained,
        including misses. The finite fraction need not equal the target coverage.
      </figcaption>
      <details>
        <summary>Read every hypothetical interval</summary>
        <div className="table-scroll">
          <table>
            <caption>Conditional intervals normalized by the generating value</caption>
            <thead>
              <tr>
                <th scope="col">Trial</th>
                <th scope="col">Estimate</th>
                <th scope="col">Lower</th>
                <th scope="col">Upper</th>
                <th scope="col">Covers?</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((trial) => (
                <tr key={trial.id}>
                  <th scope="row">{trial.index + 1}</th>
                  <td>{display(trial.estimate)}</td>
                  <td>{display(trial.lower)}</td>
                  <td>{display(trial.upper)}</td>
                  <td>{trial.covers ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
