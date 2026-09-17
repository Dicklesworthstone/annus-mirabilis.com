import type { ComparisonSnapshot } from "./Baseline.ts";
import { comparisonDisplay } from "./comparisonStatement.ts";

type Series = { length: number; at(index: number): number };
function series(snapshot: ComparisonSnapshot, id: string): readonly number[] | null {
  const result = snapshot.outputs.find((output) => output.quantityId === id);
  if (result?.status !== "value" || !result.value || typeof result.value !== "object") return null;
  const value = result.value as Partial<Series>;
  if (!Number.isSafeInteger(value.length) || !value.length || value.length > 1024 || typeof value.at !== "function") return null;
  const values = Array.from({ length: value.length }, (_, i) => (value as Series).at(i));
  return values.every(Number.isFinite) ? values : null;
}
function scalar(snapshot: ComparisonSnapshot, id: string): number | null {
  const result = snapshot.outputs.find((output) => output.quantityId === id);
  return result?.status === "value" && typeof result.value === "number" && Number.isFinite(result.value) ? result.value : null;
}
/** Axis conversion only: every point, including the selected measurement, is owner-produced. */
export function ComparisonPlot({ baseline, variant, uid }: { baseline: ComparisonSnapshot; variant: ComparisonSnapshot; uid: string }) {
  const curves = [baseline, variant].map((snapshot) => ({ t: series(snapshot, "plotTimes"), y: series(snapshot, "plotSampleRms"),
    interval: scalar(snapshot, "observationInterval"), selected: scalar(snapshot, "sampleRms") }));
  if (curves.some((curve) => !curve.t || !curve.y || curve.t.length !== curve.y.length))
    return <p>The owner did not provide comparable curves. The accepted readout table remains available.</p>;
  const maxTime = Math.max(0, ...curves.flatMap((curve) => curve.t ?? []));
  const maxDisplacement = Math.max(0, ...curves.flatMap((curve) => [...(curve.y ?? []), curve.selected ?? 0]));
  const x = (time: number) => 65 + 600 * (time / (maxTime || 1));
  const y = (position: number) => 270 - 235 * (position / (maxDisplacement || 1));
  return <figure className="comparison-plot">
    <svg viewBox="0 0 720 320" role="img" aria-labelledby={`${uid}-plot-title ${uid}-plot-description`}>
      <title id={`${uid}-plot-title`}>Baseline and variant sample RMS on the same axes</title>
      <desc id={`${uid}-plot-description`}>Solid line: baseline. Dashed line: variant. Markers show the selected observation intervals.
        Remeasuring one recording changes the marker, not the full recorded curve. The tables below contain the selected values.</desc>
      <path d="M65 25V270H670" fill="none" stroke="currentColor" />
      {curves.map((curve, index) => <g key={index}>
        <polyline fill="none" stroke="currentColor" strokeWidth={index ? 2 : 3} strokeDasharray={index ? "8 5" : undefined}
          points={(curve.t ?? []).map((time, i) => `${x(time)},${y(curve.y?.[i] ?? 0)}`).join(" ")} />
        {curve.interval !== null && curve.selected !== null && <g>
          <path d={`M${x(curve.interval)} 270V${y(curve.selected)}`} fill="none" stroke="currentColor" strokeDasharray={index ? "2 4" : "2 2"} />
          {index === 0 ? <circle cx={x(curve.interval)} cy={y(curve.selected)} r="5" fill="currentColor" />
            : <rect x={x(curve.interval) - 5} y={y(curve.selected) - 5} width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" />}
        </g>}
      </g>)}
      <g fill="currentColor" fontSize="14"><text x="50" y="289">0</text><text x="665" y="289" textAnchor="end">{comparisonDisplay(maxTime)} s</text>
        <text x="360" y="313" textAnchor="middle">Elapsed time</text><text x="68" y="20">RMS displacement (μm)</text>
        <text x="55" y="42" textAnchor="end">{comparisonDisplay(maxDisplacement, 1e6)}</text></g>
    </svg>
    <figcaption>Baseline: solid line and round marker. Variant: dashed line and square marker. Both use one time axis and one displacement scale.
      These are synthetic sample readouts, not observations. The full curves overlap when only the observation interval changes.</figcaption>
  </figure>;
}
