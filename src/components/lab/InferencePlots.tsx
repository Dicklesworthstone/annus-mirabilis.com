import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { array, display, identity, result } from "./presentation.ts";
import type { Bm07Parameters } from "../../experiments/bm07/definition.ts";

export function InferenceValue({ snapshot, id, factor = 1 }: { snapshot: AcceptedSnapshot; id: string; factor?: number }) {
  const r = result(snapshot, id);
  if (r.status === "value" && typeof r.value === "number") return <span data-output={id} data-value={r.value}>{display(r.value, factor)}</span>;
  const text = r.status === "underdetermined" ? r.compatibleFamily : "reason" in r ? r.reason : "No numerical value is available for this question.";
  return <span data-output={id} data-result-status={r.status}>{text}</span>;
}
export function InferenceInterval({ snapshot, id, factor = 1 }: { snapshot: AcceptedSnapshot; id: string; factor?: number }) {
  if (result(snapshot, id).status !== "value") return <InferenceValue snapshot={snapshot} id={id}/>;
  const v = array(snapshot, id);
  return <span data-output={id} data-lower={v.at(0)} data-upper={v.at(1)}>{display(v.at(0)!, factor)} – {display(v.at(1)!, factor)}</span>;
}
export function InferencePath({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const p = snapshot.parameters as Bm07Parameters, times = array(snapshot, "observationTimes"), values = array(snapshot, "observationPositions");
  const coordinates = values.copy();
  const max = Math.max(...coordinates.map(Math.abs), 1e-30);
  const x = (t: number) => 65 + 465 * t / times.at(times.length - 1)!;
  const y = (v: number) => 142 - 102 * v / max;
  return <figure className="plot" {...identity(snapshot)}>
    <svg role="img" viewBox="0 0 570 300" aria-label="Observed synthetic coordinates versus time; every selected position is in the table below.">
      <path className="axis" d="M65 25V250H530M65 142H530"/>
      {[1, 0, -1].map(k => <text key={k} x="57" y={y(k * max) + 4} textAnchor="end">{display(k * max, 1e6)}</text>)}
      {[0, .5, 1].map(f => <text key={f} x={65 + 465 * f} y="270" textAnchor="middle">{display(times.at(times.length - 1)! * f)}</text>)}
      {Array.from({ length: p.d }, (_, c) => <polyline key={c} data-coordinate={c} className={c === 0 ? "curve" : "comparison-curve"} points={Array.from({ length: times.length }, (_, i) => `${x(times.at(i)!)} ${y(values.at(i * p.d + c)!)}`).join(" ")}/>)}
      <text x="65" y="17">Displacement (μm)</text><text x="300" y="294" textAnchor="middle">Observation time (s)</text>
    </svg>
    <figcaption>One synthetic path, observed at the accepted spacing. Solid: x; dashed: y when selected. Connecting lines join observations; they do not claim a resolved microscopic trajectory.</figcaption>
  </figure>;
}
export function InferenceFamily({ snapshot }: { snapshot: AcceptedSnapshot }) {
  if (result(snapshot, "familyNumbers").status !== "value") return <p className="notice"><InferenceValue snapshot={snapshot} id="familyNumbers"/></p>;
  const radii = array(snapshot, "familyRadii"), numbers = array(snapshot, "familyNumbers");
  const loX = Math.log10(radii.at(0)!), hiX = Math.log10(radii.at(radii.length - 1)!);
  const loY = Math.log10(numbers.at(numbers.length - 1)!), hiY = Math.log10(numbers.at(0)!);
  const x = (a: number) => 72 + 458 * (Math.log10(a) - loX) / (hiX - loX);
  const y = (n: number) => 240 - 205 * (Math.log10(n) - loY) / (hiY - loY);
  const indices = [0, 20, 40];
  return <figure className="plot" {...identity(snapshot)}>
    <svg role="img" viewBox="0 0 570 300" aria-label="Compatible radius and molecular-number pairs on logarithmic axes. A larger assumed radius gives a smaller inferred molecular number.">
      <path className="axis" d="M72 25V245H530"/>
      {indices.map(i => <g key={i}><text x={x(radii.at(i)!)} y="265" textAnchor="middle">{display(radii.at(i)!, 1e6)}</text><text x="64" y={y(numbers.at(i)!) + 4} textAnchor="end">{display(numbers.at(i)!, 1e-23)}</text></g>)}
      <polyline className="curve" data-family-curve points={Array.from({ length: radii.length }, (_, i) => `${x(radii.at(i)!)} ${y(numbers.at(i)!)}`).join(" ")}/>
      <text x="72" y="17">N (10²³ mol⁻¹); logarithmic axes</text><text x="300" y="292" textAnchor="middle">Assumed radius (μm)</text>
    </svg>
    <figcaption>Each pair gives the same point estimate of diffusivity at the assumed temperature and viscosity. This is a compatible family, not a confidence region and not a second measurement of the radius.</figcaption>
    <details><summary>Read all compatible pairs</summary><div className="table-scroll"><table><caption>Radius–number family for this accepted estimate</caption><thead><tr><th scope="col">Radius (μm)</th><th scope="col">N (10²³ mol⁻¹)</th></tr></thead><tbody>{Array.from({ length: radii.length }, (_, i) => <tr key={i}><th scope="row">{display(radii.at(i)!, 1e6)}</th><td>{display(numbers.at(i)!, 1e-23)}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
export function InferenceCoverage({ snapshot, molecular = false }: { snapshot: AcceptedSnapshot; molecular?: boolean }) {
  const key = molecular ? "coverageMolecular" : "coverageDiffusion", countId = molecular ? "molecularCoveringCount" : "diffusionCoveringCount";
  if (result(snapshot, key).status !== "value") return <p className="notice"><InferenceValue snapshot={snapshot} id={key}/></p>;
  const values = array(snapshot, key), rows = values.length / 4;
  const bounds = Array.from({ length: rows }, (_, i) => [values.at(4 * i + 1)!, values.at(4 * i + 2)!]).flat();
  const lo = Math.min(0, ...bounds.map(Math.log10)), hi = Math.max(0, ...bounds.map(Math.log10));
  const x = (v: number) => 65 + 465 * (Math.log10(v) - lo) / Math.max(hi - lo, .01);
  const y = (i: number) => 32 + 340 * i / Math.max(rows - 1, 1);
  return <figure className="plot" {...identity(snapshot)} data-coverage-kind={molecular ? "molecular" : "diffusion"}>
    <svg role="img" viewBox="0 0 570 425" aria-label={`${rows} hypothetical ${molecular ? "molecular-number" : "diffusivity"} confidence intervals divided by the true generating parameter. Dashed intervals miss the true value.`}>
      <path className="axis" d="M65 20V380H530"/><line x1={x(1)} x2={x(1)} y1="20" y2="380" className="inference-truth"/>
      {Array.from({ length: rows }, (_, i) => <g key={i} className={values.at(i * 4 + 3) === 1 ? "inference-cover" : "inference-miss"}><line x1={x(values.at(i * 4 + 1)!)} x2={x(values.at(i * 4 + 2)!)} y1={y(i)} y2={y(i)}/><circle cx={x(values.at(i * 4)!)} cy={y(i)} r="1.8"/></g>)}
      <text x="57" y="36" textAnchor="end">1</text><text x="57" y="376" textAnchor="end">{rows}</text><text x={x(1)} y="17" textAnchor="middle">True value = 1</text>
      {[lo, (lo + hi) / 2, hi].map((v, i) => <text key={i} x={65 + 465 * i / 2} y="400" textAnchor="middle">{display(10 ** v)}</text>)}
      <text x="300" y="422" textAnchor="middle">Estimate / generating value (logarithmic scale)</text>
    </svg>
    <figcaption><InferenceValue snapshot={snapshot} id={countId}/> of {rows} intervals cover the fixed generating value. Solid intervals cover it; dashed intervals miss. Every trial is retained, including misses. The finite fraction need not equal the target coverage.</figcaption>
    <details><summary>Read every hypothetical interval</summary><div className="table-scroll"><table><caption>Conditional intervals normalized by the generating value</caption><thead><tr><th scope="col">Trial</th><th scope="col">Estimate</th><th scope="col">Lower</th><th scope="col">Upper</th><th scope="col">Covers?</th></tr></thead><tbody>{Array.from({ length: rows }, (_, i) => <tr key={i}><th scope="row">{i + 1}</th>{[0, 1, 2].map(c => <td key={c}>{display(values.at(i * 4 + c)!)}</td>)}<td>{values.at(i * 4 + 3) === 1 ? "Yes" : "No"}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
