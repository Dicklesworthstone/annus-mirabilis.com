import type { ComparisonSnapshot } from "./Baseline.ts";
import { comparisonDisplay } from "./comparisonStatement.ts";

type Series = { length: number; at(index: number): number };
function series(snapshot: ComparisonSnapshot, id: string): readonly number[] | null {
  const result = snapshot.outputs.find((output) => output.quantityId === id);
  if (result?.status !== "value" || !result.value || typeof result.value !== "object") return null;
  const value = result.value as Partial<Series>;
  if (
    !Number.isSafeInteger(value.length) ||
    !value.length ||
    value.length > 1024 ||
    typeof value.at !== "function"
  )
    return null;
  const values = Array.from({ length: value.length }, (_, i) => (value as Series).at(i));
  return values.every(Number.isFinite) ? values : null;
}
function scalar(snapshot: ComparisonSnapshot, id: string): number | null {
  const result = snapshot.outputs.find((output) => output.quantityId === id);
  return result?.status === "value" &&
    typeof result.value === "number" &&
    Number.isFinite(result.value)
    ? result.value
    : null;
}
// Set on each text, not on their group: the site-wide `svg[role="img"] text` rule sets a font
// size on every label and would override one inherited from the group.
const label = { fontSize: "var(--comparison-label, 14px)" } as const;
/** Axis conversion only: every point, including the selected measurement, is owner-produced. */
export function ComparisonPlot({
  baseline,
  variant,
  uid,
}: {
  baseline: ComparisonSnapshot;
  variant: ComparisonSnapshot;
  uid: string;
}) {
  const curves = [
    { role: "baseline" as const, snapshot: baseline },
    { role: "variant" as const, snapshot: variant },
  ].map(({ role, snapshot }) => ({
    role,
    t: series(snapshot, "plotTimes"),
    y: series(snapshot, "plotSampleRms"),
    interval: scalar(snapshot, "observationInterval"),
    selected: scalar(snapshot, "sampleRms"),
  }));
  if (curves.some((curve) => !curve.t || !curve.y || curve.t.length !== curve.y.length))
    return (
      <p>
        The owner did not provide comparable curves. The accepted readout table remains available.
      </p>
    );
  const maxTime = Math.max(0, ...curves.flatMap((curve) => curve.t ?? []));
  const maxDisplacement = Math.max(
    0,
    ...curves.flatMap((curve) => [...(curve.y ?? []), curve.selected ?? 0]),
  );
  const x = (time: number) => 65 + 600 * (time / (maxTime || 1));
  const y = (position: number) => 270 - 235 * (position / (maxDisplacement || 1));
  return (
    <figure className="comparison-plot">
      <svg
        viewBox="0 0 720 310"
        role="img"
        aria-labelledby={`${uid}-plot-title ${uid}-plot-description`}
      >
        <title id={`${uid}-plot-title`}>Baseline and variant sample RMS on the same axes</title>
        <desc id={`${uid}-plot-description`}>
          Solid line: baseline. Dashed line: variant. Markers show the selected observation
          intervals. Remeasuring one recording changes the marker, not the full recorded curve. The
          tables below contain the selected values.
        </desc>
        <path d="M65 25V270H670" fill="none" stroke="currentColor" />
        {curves.map((curve) => (
          <g key={curve.role}>
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth={curve.role === "variant" ? 2 : 3}
              strokeDasharray={curve.role === "variant" ? "8 5" : undefined}
              points={(curve.t ?? [])
                .map((time, i) => `${x(time)},${y(curve.y?.[i] ?? 0)}`)
                .join(" ")}
            />
            {curve.interval !== null && curve.selected !== null && (
              <g>
                <path
                  d={`M${x(curve.interval)} 270V${y(curve.selected)}`}
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray={curve.role === "variant" ? "2 4" : "2 2"}
                />
                {curve.role === "baseline" ? (
                  <circle cx={x(curve.interval)} cy={y(curve.selected)} r="5" fill="currentColor" />
                ) : (
                  <rect
                    x={x(curve.interval) - 5}
                    y={y(curve.selected) - 5}
                    width="10"
                    height="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                )}
              </g>
            )}
          </g>
        ))}
        {/* The labels take their size from --comparison-label, which comparison.css raises on a
            phone: at 14 units in this 720-unit frame they rendered at 5.9px there. The bottom three
            share one baseline, and the top value sits inside the plot beside its tick, so that at
            the larger size it cannot run off the left edge. */}
        <path d="M59 35H65" fill="none" stroke="currentColor" />
        <g fill="currentColor">
          <text x="50" y="300" style={label}>
            0
          </text>
          <text x="665" y="300" textAnchor="end" style={label}>
            {comparisonDisplay(maxTime)} s
          </text>
          <text x="360" y="300" textAnchor="middle" style={label}>
            Elapsed time
          </text>
          <text x="68" y="27" style={label}>
            RMS displacement (μm)
          </text>
          <text x="72" y="54" style={label}>
            {comparisonDisplay(maxDisplacement, 1e6)}
          </text>
        </g>
      </svg>
      <figcaption>
        Baseline: solid line and round marker. Variant: dashed line and square marker. Both use one
        time axis and one displacement scale. These are synthetic sample readouts, not observations.
        The full curves overlap when only the observation interval changes.
      </figcaption>
    </figure>
  );
}
