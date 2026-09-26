import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { array, display, fixed, identity, readablePowers, result } from "./presentation.ts";

/** A share of the peak at one decimal, or two significant figures below one percent, so the far
 * tails read 0.034% rather than a flat 0%. */
function shareOfPeak(percent: number): string {
  return `${percent >= 1 ? fixed(percent, 1) : readablePowers(percent.toPrecision(2))}%`;
}
/** Graphics map accepted owner samples to pixels. The plot never evaluates a density or probability.
 * Both drawings here are 300 units wide, like the walk and tracer plots: at 640 units the site's
 * label size rendered at 6.7px on a 390px phone.
 *
 * Below the drawing, the same curve as numbers: every fifth accepted sample (17 of 81, one every
 * half RMS distance), each with its displacement, its density and its height as a share of the
 * peak. The drawing's own description gives only the peak, so a reader who cannot see the curve
 * could not read its shape; the table is in the HTML, inside a disclosure that works without
 * script, and it reads the accepted samples, never a density of its own. */
export function DistributionPlot({
  snapshot,
  clipId,
}: {
  snapshot: AcceptedSnapshot;
  clipId: string;
}) {
  const x = array(snapshot, "positionCoordinate1d");
  const density = result(snapshot, "probabilityDensity");
  const left = x.at(0),
    right = x.at(x.length - 1);
  const px = (value: number) => 38 + (240 * (value - left)) / (right - left);
  const lower = snapshot.parameters.lower as number,
    upper = snapshot.parameters.upper as number;
  const shadeLeft = Math.max(38, Math.min(278, px(lower))),
    shadeRight = Math.max(38, Math.min(278, px(upper)));
  let curve = "",
    area = "",
    peak = 0;
  if (density.status === "value" && typeof density.value !== "number") {
    const y = density.value;
    for (let i = 0; i < y.length; i++) peak = Math.max(peak, y.at(i));
    const points = Array.from(
      { length: x.length },
      (_, i) => `${px(x.at(i))},${210 - (170 * y.at(i)) / peak}`,
    );
    curve = `M${points.join(" L")}`;
    area = `${curve} L278,210 L38,210 Z`;
  }
  const rms = result(snapshot, "rmsDisplacement1d");
  const curveRows: {
    id: string;
    spread: string;
    position: string;
    density: string;
    share: string;
  }[] = [];
  if (
    density.status === "value" &&
    typeof density.value !== "number" &&
    rms.status === "value" &&
    typeof rms.value === "number" &&
    rms.value > 0 &&
    peak > 0
  ) {
    const y = density.value;
    const spread = rms.value;
    const every = Math.max(1, Math.round((x.length - 1) / 16));
    for (let i = 0; i < x.length; i += every)
      curveRows.push({
        id: `curve-row-${i}`,
        spread: fixed(x.at(i) / spread, 1),
        position: display(x.at(i), 1e6),
        density: display(y.at(i), 1e-6),
        share: shareOfPeak((100 * y.at(i)) / peak),
      });
  }
  return (
    <>
      <figure className="plot" {...identity(snapshot)} data-result-status={density.status}>
        <svg
          viewBox="0 0 300 270"
          role="img"
          aria-labelledby={`${clipId}-title ${clipId}-description`}
        >
          <title id={`${clipId}-title`}>Displacement probability density</title>
          <desc id={`${clipId}-description`}>
            {density.status === "analytic-limit"
              ? "All probability is at zero displacement. There is no finite density curve."
              : `A symmetric model density centered at zero. The selected interval is shaded. Peak density is ${display(peak, 1e-6)} per micrometre. The probability and interval are also given in the results table.`}
          </desc>
          <line className="axis" x1="38" y1="210" x2="278" y2="210" />
          <line className="axis" x1="38" y1="30" x2="38" y2="210" />
          {density.status === "analytic-limit" ? (
            <g>
              <line className="curve" x1="158" x2="158" y1="210" y2="60" />
              <path className="curve" d="M148,75 L158,60 L168,75" />
              <text x="158" y="40" textAnchor="middle">
                All probability at zero
              </text>
            </g>
          ) : (
            <>
              <defs>
                <clipPath id={clipId}>
                  <rect
                    x={shadeLeft}
                    y="20"
                    width={Math.max(0, shadeRight - shadeLeft)}
                    height="190"
                  />
                </clipPath>
              </defs>
              <path className="area" d={area} clipPath={`url(#${clipId})`} />
              {/* The interval's limits. The tint alone marked them, at 1.78:1 on the light paper;
                  each limit inside the drawing also gets a line. A limit beyond the drawn range
                  gets none, since a line at the edge would claim a limit that is not there. */}
              {[px(lower), px(upper)]
                .filter((edge) => edge > 38 && edge < 278)
                .map((edge) => (
                  <line
                    key={`interval-limit-${edge}`}
                    className="interval-limit"
                    x1={edge}
                    x2={edge}
                    y1="40"
                    y2="210"
                  />
                ))}
              <path className="curve" d={curve} />
              <text x="38" y="20">
                Density (per μm)
              </text>
            </>
          )}
          <text x="38" y="234" textAnchor="middle">
            {display(left, 1e6)}
          </text>
          <text x="158" y="234" textAnchor="middle">
            0
          </text>
          <text x="278" y="234" textAnchor="middle">
            {display(right, 1e6)}
          </text>
          <text x="158" y="259" textAnchor="middle">
            Signed displacement (μm)
          </text>
        </svg>
        <figcaption>
          {density.status === "analytic-limit"
            ? "A point distribution, not an infinitely high bar. A closed interval containing zero has probability one."
            : "The curve shows four RMS distances on either side of zero. The interval probability uses the full unbounded model, including any part outside this picture."}
        </figcaption>
      </figure>
      {curveRows.length > 0 && (
        <details>
          <summary>Read the curve as numbers, at {curveRows.length} points</summary>
          <section
            className="table-scroll"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns cannot be reached by keyboard at all (am-bc6s)
            tabIndex={0}
            aria-label="The plotted density as numbers"
          >
            <table className="curve-values" {...identity(snapshot)}>
              <caption>
                The accepted density at the plotted points, from the same calculation
              </caption>
              <thead>
                <tr>
                  <th scope="col">RMS distances from zero</th>
                  <th scope="col">Displacement (μm)</th>
                  <th scope="col">Density (per μm)</th>
                  <th scope="col">Share of the peak height</th>
                </tr>
              </thead>
              <tbody>
                {curveRows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.spread}</th>
                    <td>{row.position}</td>
                    <td>{row.density}</td>
                    <td>{row.share}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </details>
      )}
    </>
  );
}
export function GridComparison({ snapshot }: { snapshot: AcceptedSnapshot }) {
  if (result(snapshot, "cellMasses").status !== "value") return null;
  const grid = array(snapshot, "cellMasses"),
    analytic = array(snapshot, "cellProbabilities");
  let peak = 0;
  for (let i = 0; i < grid.length; i++) peak = Math.max(peak, grid.at(i), analytic.at(i));
  const points = (values: typeof grid) =>
    Array.from(
      { length: values.length },
      (_, i) => `${38 + (240 * i) / (values.length - 1)},${210 - (170 * values.at(i)) / peak}`,
    ).join(" ");
  return (
    <section
      {...identity(snapshot)}
      className="grid-comparison"
      aria-label="Numerical grid comparison"
    >
      <h3>Compare probabilities, not heights</h3>
      <p>
        The solid line is the numerical probability in each cell. The dashed line is the unbounded
        model’s probability over the same cell. The grid has reflecting walls; the analytic model
        does not.
      </p>
      <svg
        viewBox="0 0 300 250"
        role="img"
        aria-label="Numerical and analytic cell probabilities; exact values follow in the cell table."
      >
        <line className="axis" x1="38" x2="278" y1="210" y2="210" />
        <polyline className="curve" points={points(grid)} />
        <polyline className="comparison-curve" points={points(analytic)} />
        <text x="38" y="20">
          Probability in each cell
        </text>
        <text x="38" y="235">
          Cell 0
        </text>
        <text x="278" y="235" textAnchor="end">
          Cell {grid.length - 1}
        </text>
      </svg>
      <details>
        <summary>Read all {grid.length} cell probabilities</summary>
        <div className="table-scroll">
          <table>
            <caption>Accepted numerical and analytic probabilities for the same cells</caption>
            <thead>
              <tr>
                <th scope="col">Cell</th>
                <th scope="col">Numerical</th>
                <th scope="col">Unbounded analytic</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: grid.length }, (_, i) => ({
                id: `cell-row-${i}`,
                cell: i,
                numerical: display(grid.at(i)),
                analyticProb: display(analytic.at(i)),
              })).map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.cell}</th>
                  <td>{row.numerical}</td>
                  <td>{row.analyticProb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">
          A cell far enough from the start that its unbounded probability is below 2.2 × 10⁻³⁰⁸, the
          smallest ordinary number the calculation can hold, shows 0.
        </p>
      </details>
    </section>
  );
}
