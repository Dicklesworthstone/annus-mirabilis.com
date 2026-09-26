import type { MillikanOverlayResult } from "../../../experiments/lq08/millikan.ts";
import { fixed } from "../presentation.ts";
import { Sci } from "../Sci.tsx";

type Plottable = Extract<MillikanOverlayResult, { kind: "plottable" }>;

/**
 * Millikan's 1916 sodium points on his own scale, beside LQ-08's model (dispatch 249).
 *
 * His Fig. 6 (Phys. Rev. 7, p. 373) plots the intercepts of the photocurrent curves on the potential
 * axis: signed, and uncorrected for the contact E.M.F. between sodium and collector. So they are
 * drawn here on a signed-volt axis of their own and never on the model's stopping-potential axis,
 * and nothing shifts them onto it. What the two share is the slope: the line through the five points
 * he says fixed it, the slopes he printed, and h/e from the laboratory's constants. Every number
 * arrives computed in millikan.ts; this only projects and formats.
 */
export function MillikanFigure6Panel({ data }: { data: Plottable }) {
  const width = 420;
  const height = 250;
  const padding = { top: 20, right: 24, bottom: 50, left: 62 };
  const minNu = 5.0e14;
  const maxNu = 1.25e15;
  const minV = -2.5;
  const maxV = 1.0;
  const scaleX = (nu: number) =>
    padding.left + ((nu - minNu) / (maxNu - minNu)) * (width - padding.left - padding.right);
  const scaleY = (v: number) =>
    height -
    padding.bottom -
    ((v - minV) / (maxV - minV)) * (height - padding.top - padding.bottom);
  const usedCount = data.points.filter((p) => p.usedForSlope).length;
  const evidence = data.evidenceLabel.charAt(0).toUpperCase() + data.evidenceLabel.slice(1);

  return (
    <section
      data-testid="millikan-fig6-panel"
      data-view-id="lq-08-millikan-fig6"
      style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
    >
      <h3 style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", fontWeight: 600 }}>
        Millikan, 1916: sodium, on his own scale
      </h3>
      <p className="fine" style={{ margin: 0 }}>
        {evidence}. Not on the 1904 shelf.
      </p>
      <p className="fine" style={{ margin: 0 }}>
        His Fig. 6 plots, for each mercury line, the potential on the sodium at which its
        photocurrent stops, before the contact potential between sodium and collector is taken out.
        So the points sit on his scale, not the model&apos;s, and what compares is the slope.
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Millikan's 1916 sodium points: intercept potential against frequency, ${data.points.length} points, the line through the ${usedCount} that fixed his slope`}
        style={{
          width: "100%",
          height: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="var(--line)"
          strokeWidth="1.5"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="var(--line)"
          strokeWidth="1.5"
        />
        {/* Zero volts: the lines above it strike the axis on the positive side. */}
        <line
          x1={padding.left}
          y1={scaleY(0)}
          x2={width - padding.right}
          y2={scaleY(0)}
          stroke="var(--line)"
          strokeDasharray="3,3"
        />
        {[-2, -1, 0, 1].map((v) => (
          <text
            key={`v${v}`}
            x={padding.left - 8}
            y={scaleY(v) + 5}
            textAnchor="end"
            fill="var(--muted)"
          >
            {v > 0 ? `+${v}` : v === 0 ? "0" : `−${Math.abs(v)}`}
          </text>
        ))}
        {[6e14, 8e14, 1e15, 1.2e15].map((nu) => (
          <text
            key={`nu${nu}`}
            x={scaleX(nu)}
            y={height - padding.bottom + 22}
            textAnchor="middle"
            fill="var(--muted)"
          >
            {fixed(nu / 1e12, 0)}
          </text>
        ))}
        <text x={(padding.left + width - padding.right) / 2} y={height - 6} textAnchor="middle">
          Frequency (THz)
        </text>
        <text
          x={16}
          y={(padding.top + height - padding.bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${(padding.top + height - padding.bottom) / 2})`}
        >
          Volts
        </text>
        <line
          data-testid="millikan-fig6-line"
          x1={scaleX(data.fittedLine.startHz)}
          y1={scaleY(data.fittedLine.startVolts)}
          x2={scaleX(data.fittedLine.endHz)}
          y2={scaleY(data.fittedLine.endVolts)}
          stroke="var(--ink)"
          strokeWidth="1.5"
        />
        {data.points.map((p) => (
          <circle
            key={p.frequencyHz}
            data-frequency-hz={p.frequencyHz}
            data-intercept-volts={p.interceptVolts}
            data-used-for-slope={p.usedForSlope}
            cx={scaleX(p.frequencyHz)}
            cy={scaleY(p.interceptVolts)}
            r="4.5"
            fill={p.usedForSlope ? "var(--accent)" : "var(--panel)"}
            stroke="var(--accent)"
            strokeWidth="2"
          />
        ))}
      </svg>
      <p
        className="fine"
        style={{
          margin: 0,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "var(--type-fine)",
        }}
      >
        Line through the {usedCount} points he says fixed the slope (filled):{" "}
        <Sci value={data.fittedSlopeVs} digits={2} /> V&middot;s &plusmn;{" "}
        <Sci value={data.fittedSlopeStdErr} digits={1} />, fitted here to his points as read from
        the figure.
      </p>
      {data.printedSlopes.map((s) => (
        <p
          key={s.label}
          className="fine"
          style={{
            margin: 0,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "var(--type-fine)",
          }}
        >
          {s.label}: <Sci value={s.slopeVs} digits={3} /> V&middot;s
        </p>
      ))}
      <p
        className="fine"
        style={{
          margin: 0,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "var(--type-fine)",
        }}
      >
        h/e from this laboratory&apos;s constants: <Sci value={data.modelLineSlopeVs} digits={4} />{" "}
        V&middot;s
      </p>
      <details>
        <summary className="fine">His points</summary>
        <table className="fine">
          <thead>
            <tr>
              <th scope="col">Frequency (THz)</th>
              <th scope="col">Potential (V)</th>
              <th scope="col">Fixed the slope</th>
            </tr>
          </thead>
          <tbody>
            {data.points.map((p) => (
              <tr key={p.frequencyHz}>
                <td>{fixed(p.frequencyHz / 1e12, 1)}</td>
                <td>
                  {p.interceptVolts < 0 ? "−" : "+"}
                  {fixed(Math.abs(p.interceptVolts), 3)}
                </td>
                <td>{p.usedForSlope ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="fine" style={{ margin: 0 }}>
        {data.citation} Fig. 6.
      </p>
    </section>
  );
}
