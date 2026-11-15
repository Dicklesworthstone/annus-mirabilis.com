import type { BrownianHistogram } from "./brownianTourPresentation.ts";

const number = new Intl.NumberFormat("en", { maximumSignificantDigits: 4 });

/** The plotted quantities are accepted owner outputs, never a fitted replacement curve. */
export function BrownianTourHistogram({
  histogram,
  label,
  extent,
  maximum,
}: {
  histogram: BrownianHistogram;
  label: string;
  extent: readonly [number, number];
  maximum: number;
}) {
  const { edges, observed, model } = histogram;
  const top = Math.max(maximum, ...observed, ...model);
  const x = (value: number) => 48 + (value - extent[0]) / (extent[1] - extent[0]) * 424;
  const y = (value: number) => 210 - value / top * 166;
  return (
    <figure className="plot" data-tour-histogram={label} style={{ marginInline: 0 }}>
      <svg
        viewBox="0 0 520 270"
        style={{ display: "block", width: "100%", maxWidth: "40rem", height: "auto" }}
        role="img"
        aria-label={label + ". Bars show the fraction of endpoints in each distance interval. The dashed line gives the bell model's chance in the same intervals. All values are available in the following table."}
      >
        <path d="M48 36V210H472" fill="none" stroke="currentColor" />
        {observed.map((value, index) => (
          <rect
            key={edges[index]!}
            x={x(edges[index]!)}
            y={y(value)}
            width={Math.max(0, x(edges[index + 1]!) - x(edges[index]!) - 1)}
            height={210 - y(value)}
            fill="var(--accent, currentColor)"
            opacity="0.65"
          />
        ))}
        <path
          d={model.map((value, index) =>
            (index ? "L" : "M") + x((edges[index]! + edges[index + 1]!) / 2) + "," + y(value),
          ).join(" ")}
          fill="none"
          stroke="var(--ink, currentColor)"
          strokeWidth="2"
          strokeDasharray="5 4"
        />
        <text x="48" y="22">Fraction in each distance interval</text>
        <text x="4" y="46">{number.format(top)}</text>
        <text x="22" y="213">0</text>
        <text x="48" y="235">{number.format(extent[0] * 1e6)}</text>
        <text x="472" y="235" textAnchor="end">{number.format(extent[1] * 1e6)}</text>
        <text x="260" y="258" textAnchor="middle">Distance from the start in micrometres</text>
      </svg>
      <figcaption>
        {label}. Bars show synthetic endpoint shares; the dashed line gives bell-model probabilities
        over these same bins. The distance scale stays fixed across step rules. Bin boundaries
        may differ, as listed below. Outside these bins: {histogram.outsideLeft} left and{" "}
        {histogram.outsideRight} right; those endpoints remain in every statistic.
      </figcaption>
      <details>
        <summary>Read the histogram as a table</summary>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard readers need access to a horizontally scrolling data table. */}
        <div className="table-scroll" role="region" aria-label={label + " histogram values"} tabIndex={0}>
          <table>
            <caption>{label}: distance bounds in micrometres, shares in percent</caption>
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Sample share</th>
                <th scope="col">Bell-model share</th>
              </tr>
            </thead>
            <tbody>
              {observed.map((value, index) => (
                <tr key={edges[index]!}>
                  <td>{number.format(edges[index]! * 1e6)}</td>
                  <td>{number.format(edges[index + 1]! * 1e6)}</td>
                  <td>{number.format(value * 100)}</td>
                  <td>{number.format(model[index]! * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
