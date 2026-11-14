import type { AcceptedSnapshot } from "../../../experiments/store/instanceStore.ts";
import { fixed, result } from "../presentation.ts";

function num(snapshot: AcceptedSnapshot, id: string): number | null {
  const r = result(snapshot, id);
  return r.status === "value" && typeof r.value === "number" ? r.value : null;
}

type Anchor = "start" | "middle" | "end";

/**
 * An arrow from the origin, labelled beside its tip on one side (side 1 is to the arrow's left on
 * screen, -1 its right). The labels used to sit 10 units beyond each tip, so at the default, where
 * all four vectors lie along +x, "v" and "w" landed 8 units apart and "Galilean" ran past the
 * 200-unit edge. Alternating sides keeps neighbouring tips' labels apart, and a label near an edge
 * is anchored to end or start there, so it stays inside the drawing.
 */
function arrow(
  x: number,
  y: number,
  color: string,
  label: string,
  side: 1 | -1,
  scale: number,
): {
  line: string;
  tip: string;
  lx: number;
  ly: number;
  anchor: Anchor;
  color: string;
  label: string;
} {
  const x2 = 100 + x * scale;
  const y2 = 100 - y * scale;
  const len = Math.hypot(x2 - 100, y2 - 100) || 1;
  const ux = (x2 - 100) / len;
  const uy = (y2 - 100) / len;
  // The screen-left normal of (ux, uy) is (uy, -ux); the label's baseline sits 3 units lower than
  // its centre line, so a label below the arrow is pushed a little further out.
  const nx = side * uy;
  const ny = -side * ux;
  const px = x2 + 9 * nx;
  const py = y2 + 9 * ny + (ny > 0 ? 6 : 0);
  const anchor: Anchor = px > 170 ? "end" : px < 30 ? "start" : "middle";
  const lx =
    anchor === "end" ? Math.min(px + 4, 196) : anchor === "start" ? Math.max(px - 4, 4) : px;
  return {
    line: `M100 100 L${x2} ${y2}`,
    tip: `${x2},${y2} ${x2 - 8 * ux + 4 * uy},${y2 - 8 * uy - 4 * ux} ${x2 - 8 * ux - 4 * uy},${y2 - 8 * uy + 4 * ux}`,
    lx,
    ly: Math.min(Math.max(py, 10), 196),
    anchor,
    color,
    label,
  };
}

export function VelocityCompositionPlot({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const ux = num(snapshot, "composedUxOverC");
  const uy = num(snapshot, "composedUyOverC");
  const U = num(snapshot, "composedSpeedOverC");
  const gal = num(snapshot, "galileanSpeedOverC");
  const p = snapshot.parameters as { frameBeta: number; mode: string };
  // Every physical vector is published by the same owner as the table. Only projection into
  // the drawing's coordinates belongs here; a saved control for another mode is not a vector.
  const wx = num(snapshot, "movingUxOverC");
  const wy = num(snapshot, "movingUyOverC");
  const galileanX = num(snapshot, "galileanUxOverC");
  const galileanY = num(snapshot, "galileanUyOverC");
  const scale =
    80 /
    Math.max(
      1,
      Math.abs(p.frameBeta),
      ...[ux, uy, wx, wy, galileanX, galileanY].map((v) => Math.abs(v ?? 0)),
    );
  const arrows =
    ux !== null &&
    uy !== null &&
    wx !== null &&
    wy !== null &&
    galileanX !== null &&
    galileanY !== null
      ? [
          arrow(p.frameBeta, 0, "var(--accent)", "v", 1, scale),
          arrow(wx, wy, "var(--ink)", "w", -1, scale),
          arrow(galileanX, galileanY, "var(--muted)", "Galilean", -1, scale),
          arrow(ux, uy, "var(--plot)", "U", 1, scale),
        ]
      : null;
  const matrixOut = result(snapshot, "productMatrix");
  const matrix =
    matrixOut.status === "value" && typeof matrixOut.value !== "number" ? matrixOut.value : null;
  return (
    <div className="sr06-plot">
      {arrows ? (
        <svg viewBox="0 0 200 200" role="img" aria-labelledby="sr06-plot-title">
          <title id="sr06-plot-title">Velocity composition in units of c</title>
          <circle
            cx="100"
            cy="100"
            r={scale}
            fill="none"
            stroke="currentColor"
            strokeDasharray="3 3"
          />
          <path d="M20 100 H180 M100 20 V180" stroke="currentColor" strokeWidth="0.5" />
          {arrows.map((a) => (
            <g key={a.label} data-velocity-vector={a.label}>
              <path d={a.line} stroke={a.color} fill="none" strokeWidth="1.6" />
              <polygon points={a.tip} fill={a.color} />
              <text x={a.lx} y={a.ly} fontSize="8" fill={a.color} textAnchor={a.anchor}>
                {a.label}
              </text>
            </g>
          ))}
        </svg>
      ) : (
        <p>
          The velocity diagram is unavailable for this result. Read the explanation in the table.
        </p>
      )}
      <p className="fine">
        The dashed circle is light speed. The Galilean sum is labeled and is not the model. Composed
        speed {U === null ? "unavailable" : `${fixed(U, 6)} c`}
        {gal === null ? "" : `; Galilean ${fixed(gal, 6)} c`}.
      </p>
      {p.mode === "two-boosts" ? (
        <p className="fine">
          Here w is the second boost velocity, measured in the intermediate frame.
        </p>
      ) : null}
      {matrix && matrix.length === 16 ? (
        <table className="sr06-matrix">
          <caption>Two-boost product matrix (full 4×4, not a parallel-axis shortcut)</caption>
          <tbody>
            {[0, 1, 2, 3].map((i) => (
              <tr key={i}>
                {[0, 1, 2, 3].map((j) => (
                  <td key={j}>{fixed(matrix.at(i * 4 + j), 5)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
