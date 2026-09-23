import { useId } from "react";
import type { AcceptedAnalysis } from "./session.ts";

function number(value: number): string {
  return Number(value.toPrecision(5)).toString();
}
/** Only projects the owner's accepted observations and predictions into SVG coordinates. */
export function PhotoelectricPlots({ state }: { state: AcceptedAnalysis }) {
  const id = useId();
  const result = state.fit;
  const positions = new Map(result.usedRows.map((row, index) => [row, index]));
  const used = state.record.rows.filter((r) => !state.excludedRows.includes(r.row));
  const fitted =
    result.status === "value"
      ? used
          .map((r, i) => ({ x: r.frequencyTHz, y: result.fit.fittedValues[i]! }))
          .sort((a, b) => a.x - b.x)
      : [];
  const residuals =
    result.status === "value"
      ? used.map((r, i) => ({ x: r.frequencyTHz, y: result.fit.residuals[i]! }))
      : [];
  function chart(residual: boolean) {
    const points = residual
      ? residuals
      : state.record.rows.map((r) => ({ x: r.frequencyTHz, y: r.stoppingV }));
    if (!points.length) return null;
    const xs = points.map((p) => p.x);
    const ys = residual
      ? [0, ...points.map((p) => p.y)]
      : [
          ...state.record.rows.flatMap((r) => [
            r.stoppingV - (r.sigmaV ?? 0),
            r.stoppingV + (r.sigmaV ?? 0),
          ]),
          ...fitted.map((p) => p.y),
        ];
    const loX = Math.min(...xs),
      hiX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const padY = Math.max((maxY - minY) * 0.12, 0.01);
    const lowY = minY - padY,
      highY = maxY + padY;
    const spanX = hiX - loX || Math.max(1, Math.abs(loX) * 0.01);
    const originX = hiX === loX ? loX - spanX / 2 : loX;
    // The plot starts at x = 140, not 80: at a phone's label size a y value such as -0.06432,
    // right-aligned at the axis, needs about 115 units of room.
    const x = (v: number) => 140 + ((v - originX) / spanX) * 510;
    const y = (v: number) => 215 - ((v - lowY) / (highY - lowY)) * 180;
    const label = residual
      ? "Residuals: measured voltage minus fitted voltage"
      : "Stopping potentials and fitted line";
    return (
      <figure className="photo-data-plot">
        {/* The vertical axis is named in HTML: inside the drawing, at a phone's label size, it
            collided with the top value on its own axis. */}
        <p className="photo-data-axis-title">
          {residual ? "Residual (V)" : "Stopping potential (V)"}
        </p>
        <svg
          viewBox="0 0 720 275"
          role="img"
          aria-labelledby={`${id}-${residual}-title ${id}-${residual}-desc`}
        >
          <title id={`${id}-${residual}-title`}>{label}</title>
          <desc id={`${id}-${residual}-desc`}>
            Frequency in terahertz on the horizontal axis;{" "}
            {residual ? "residual" : "stopping potential"} in volts on the vertical axis. The
            observation table below contains the same values.
          </desc>
          <path d="M140 30V215H660" fill="none" stroke="currentColor" />
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              {/* The first value starts at the axis and the last ends at the plot's edge, so that at a
                  phone's label size the first clears the lowest value on the vertical axis. */}
              <text
                x={140 + t * 510}
                y="239"
                textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"}
              >
                {number(originX + t * spanX)}
              </text>
              <text x="132" y={219 - t * 180} textAnchor="end">
                {number(lowY + t * (highY - lowY))}
              </text>
            </g>
          ))}
          <text x="400" y="266" textAnchor="middle">
            Frequency (THz)
          </text>
          {residual ? (
            <path d={`M140 ${y(0)}H650`} stroke="currentColor" strokeDasharray="6 4" />
          ) : (
            fitted.length > 0 && (
              <polyline
                points={fitted.map((p) => `${x(p.x)},${y(p.y)}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            )
          )}
          {residual
            ? residuals.map((p, i) => (
                <circle key={used[i]!.row} cx={x(p.x)} cy={y(p.y)} r="4" fill="currentColor" />
              ))
            : state.record.rows.map((r) => {
                const cx = x(r.frequencyTHz),
                  cy = y(r.stoppingV);
                const selected = positions.has(r.row);
                return (
                  <g key={r.row}>
                    {r.sigmaV !== undefined && (
                      <path
                        d={`M${cx} ${y(r.stoppingV - r.sigmaV)}V${y(r.stoppingV + r.sigmaV)}`}
                        stroke="currentColor"
                        opacity="0.55"
                      />
                    )}
                    {selected ? (
                      <circle cx={cx} cy={cy} r="4" fill="currentColor" />
                    ) : (
                      <path
                        d={`M${cx - 5} ${cy - 5}l10 10m-10 0l10 -10`}
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    )}
                  </g>
                );
              })}
        </svg>
        <figcaption>
          {label}.{" "}
          {residual
            ? "A pattern in the residuals can reveal departures hidden by a convincing straight-line plot. Only included rows have residuals here."
            : "Circles are included observations; crosses remain visible when excluded. The dashed line is fitted to included rows, not supplied by the theoretical value of h/e. Vertical bars, when present, show the entered one-sigma voltage uncertainties."}
        </figcaption>
      </figure>
    );
  }
  return (
    <div>
      {chart(false)}
      {chart(true)}
    </div>
  );
}
