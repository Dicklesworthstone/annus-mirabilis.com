import type { Bm07Parameters } from "../../experiments/bm07/definition.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
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
  const x = (t: number) => 65 + (465 * t) / safeMaxTime;
  const y = (v: number) => 142 - (102 * v) / max;
  const coordinateList = Array.from({ length: p.d }, (_, c) => `coord-${c}`);

  return (
    <figure className="plot" {...identity(snapshot)}>
      <svg
        role="img"
        viewBox="0 0 570 300"
        aria-label="Observed synthetic coordinates versus time; every selected position is in the table below."
      >
        <path className="axis" d="M65 25V250H530M65 142H530" />
        {[1, 0, -1].map((k) => (
          <text key={k} x="57" y={y(k * max) + 4} textAnchor="end">
            {display(k * max, 1e6)}
          </text>
        ))}
        {[0, 0.5, 1].map((f) => (
          <text key={f} x={65 + 465 * f} y="270" textAnchor="middle">
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
        <text x="65" y="17">
          Displacement (μm)
        </text>
        <text x="300" y="294" textAnchor="middle">
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

export function InferenceFamily({ snapshot }: { snapshot: AcceptedSnapshot }) {
  if (result(snapshot, "familyNumbers").status !== "value")
    return (
      <p className="notice">
        <InferenceValue snapshot={snapshot} id="familyNumbers" />
      </p>
    );
  const radii = array(snapshot, "familyRadii"),
    numbers = array(snapshot, "familyNumbers");

  const rFirst = radii.length > 0 ? radii.at(0) : undefined;
  const rLast = radii.length > 0 ? radii.at(radii.length - 1) : undefined;
  const nFirst = numbers.length > 0 ? numbers.at(0) : undefined;
  const nLast = numbers.length > 0 ? numbers.at(numbers.length - 1) : undefined;

  if (rFirst === undefined || rLast === undefined || nFirst === undefined || nLast === undefined) {
    return (
      <p className="notice">
        <InferenceValue snapshot={snapshot} id="familyNumbers" />
      </p>
    );
  }

  const loX = Math.log10(rFirst),
    hiX = Math.log10(rLast);
  const loY = Math.log10(nLast),
    hiY = Math.log10(nFirst);
  const spanX = hiX - loX !== 0 ? hiX - loX : 1;
  const spanY = hiY - loY !== 0 ? hiY - loY : 1;
  const x = (a: number) => 72 + (458 * (Math.log10(a) - loX)) / spanX;
  const y = (n: number) => 240 - (205 * (Math.log10(n) - loY)) / spanY;
  const indices = [0, 20, 40];

  const samplePoints = indices
    .map((idx) => {
      const r = radii.at(idx);
      const n = numbers.at(idx);
      return r !== undefined && n !== undefined ? { idx, r, n } : null;
    })
    .filter((pt): pt is { idx: number; r: number; n: number } => pt !== null);

  const familyPairs = Array.from({ length: radii.length }, (_, i) => {
    const r = radii.at(i);
    const n = numbers.at(i);
    return r !== undefined && n !== undefined ? { r, n, i } : null;
  }).filter((p): p is { r: number; n: number; i: number } => p !== null);

  return (
    <figure className="plot" {...identity(snapshot)}>
      <svg
        role="img"
        viewBox="0 0 570 300"
        aria-label="Compatible radius and molecular-number pairs on logarithmic axes. A larger assumed radius gives a smaller inferred molecular number."
      >
        <path className="axis" d="M72 25V245H530" />
        {samplePoints.map((pt) => (
          <g key={`sample-point-${pt.idx}`}>
            <text x={x(pt.r)} y="265" textAnchor="middle">
              {display(pt.r, 1e6)}
            </text>
            <text x="64" y={y(pt.n) + 4} textAnchor="end">
              {display(pt.n, 1e-23)}
            </text>
          </g>
        ))}
        <polyline
          className="curve"
          data-family-curve
          points={familyPairs.map((p) => `${x(p.r)} ${y(p.n)}`).join(" ")}
        />
        <text x="72" y="17">
          N (10²³ mol⁻¹); logarithmic axes
        </text>
        <text x="300" y="292" textAnchor="middle">
          Assumed radius (μm)
        </text>
      </svg>
      <figcaption>
        Each pair gives the same point estimate of diffusivity at the assumed temperature and
        viscosity. This is a compatible family, not a confidence region and not a second measurement
        of the radius.
      </figcaption>
      <details>
        <summary>Read all compatible pairs</summary>
        <div className="table-scroll">
          <table>
            <caption>Radius–number family for this accepted estimate</caption>
            <thead>
              <tr>
                <th scope="col">Radius (μm)</th>
                <th scope="col">N (10²³ mol⁻¹)</th>
              </tr>
            </thead>
            <tbody>
              {familyPairs.map((pair) => (
                <tr key={`radius-row-${pair.i}-${pair.r}`}>
                  <th scope="row">{display(pair.r, 1e6)}</th>
                  <td>{display(pair.n, 1e-23)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
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
  const x = (v: number) => 65 + (465 * (Math.log10(v) - lo)) / span;
  const y = (i: number) => 32 + (340 * i) / Math.max(rows - 1, 1);

  return (
    <figure
      className="plot"
      {...identity(snapshot)}
      data-coverage-kind={molecular ? "molecular" : "diffusion"}
    >
      <svg
        role="img"
        viewBox="0 0 570 425"
        aria-label={`${rows} hypothetical ${molecular ? "molecular-number" : "diffusivity"} confidence intervals divided by the true generating parameter. Dashed intervals miss the true value.`}
      >
        <path className="axis" d="M65 20V380H530" />
        <line x1={x(1)} x2={x(1)} y1="20" y2="380" className="inference-truth" />
        {trials.map((trial) => (
          <g key={trial.id} className={trial.covers ? "inference-cover" : "inference-miss"}>
            <line x1={x(trial.lower)} x2={x(trial.upper)} y1={y(trial.index)} y2={y(trial.index)} />
            <circle cx={x(trial.estimate)} cy={y(trial.index)} r="1.8" />
          </g>
        ))}
        <text x="57" y="36" textAnchor="end">
          1
        </text>
        <text x="57" y="376" textAnchor="end">
          {rows}
        </text>
        <text x={x(1)} y="17" textAnchor="middle">
          True value = 1
        </text>
        {[
          { key: "lo", v: lo, xPos: 65 },
          { key: "mid", v: (lo + hi) / 2, xPos: 65 + 465 / 2 },
          { key: "hi", v: hi, xPos: 65 + 465 },
        ].map((tick) => (
          <text key={tick.key} x={tick.xPos} y="400" textAnchor="middle">
            {display(10 ** tick.v)}
          </text>
        ))}
        <text x="300" y="422" textAnchor="middle">
          Estimate / generating value (logarithmic scale)
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
