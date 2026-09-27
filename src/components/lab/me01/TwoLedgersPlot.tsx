import type { Me01Parameters } from "../../../experiments/me01/definition.ts";
import type { Me01Snapshot } from "../../../experiments/me01/session.ts";
import type { ScientificResult } from "../../../experiments/results/types.ts";
import { fixed, numberText } from "../presentation.ts";
import "./me01.css";

export interface TwoLedgersPlotProps {
  parameters: Me01Parameters;
  evaluation: Me01Snapshot;
  clipId: string;
}

/** A scalar result's value, or null when the model returned none. The drawing never computes one
 * itself: it used to fall back on a Lorentz factor worked out here from the frame speed. */
function scalarOf(
  res: { status: string; value?: number | Float64Array } | undefined,
): number | null {
  return res && res.status === "value" && typeof res.value === "number" ? res.value : null;
}

/**
 * A ledger line's own cell. The body's energies come back `symbolic` - the kernel is not told what
 * E₀ or H₀ are, and the argument does not need them - so the cell shows the symbol the snapshot
 * names rather than a number, with its status on the element (the pattern MagnetConductorLab's
 * reading uses). Nothing is computed here: every number is the accepted snapshot's, in units of L.
 */
function LedgerCell({
  result,
  inL,
  output,
}: {
  result: ScientificResult | undefined;
  inL: (x: number | null) => string;
  output: string;
}) {
  if (result?.status === "symbolic")
    return (
      <td data-output={output} data-status="symbolic">
        {result.unspecifiedSymbols.join(", ")}
      </td>
    );
  if (result?.status === "value") return <td data-output={output}>{inL(scalarOf(result))}</td>;
  return (
    <td data-output={output} data-status={result?.status ?? "unavailable"}>
      not computed at these settings
    </td>
  );
}

const label = { fontSize: "12px", fontFamily: "var(--font-sans)" } as const;

export function TwoLedgersPlot({ parameters, evaluation, clipId }: TwoLedgersPlotProps) {
  const { frameSpeed, emittedEnergyRestFrame, emissionAngle, notation, premise, step } = parameters;
  const isModern = notation === "modern";
  const isRelaxed = premise === "relaxed";

  const p1Val = scalarOf(evaluation.pulse1Moving);
  const p2Val = scalarOf(evaluation.pulse2Moving);
  const subVal = scalarOf(evaluation.subtractionDifference);
  const inL = (x: number | null) =>
    x === null || emittedEnergyRestFrame <= 0
      ? "not computed"
      : `${fixed(x / emittedEnergyRestFrame, 4)} L`;

  // Visual layout: the diagram alone, 340 units wide, so a 12-unit label reads near 12px on a
  // phone. The accounts that shared its 620-unit frame are HTML beside it.
  const cx = 180;
  const cy = 130;
  const rad = (emissionAngle * Math.PI) / 180;

  // Arrow lengths scaled to each pulse's share of L; a missing value draws the rest-frame half.
  const share = (x: number | null) =>
    x === null || emittedEnergyRestFrame <= 0 ? 0.5 : x / emittedEnergyRestFrame;
  const baseLen = 70;
  const len1 = Math.max(20, Math.min(130, baseLen * (share(p1Val) / 0.5)));
  const len2 = Math.max(20, Math.min(130, baseLen * (share(p2Val) / 0.5)));

  const x1 = cx + len1 * Math.cos(rad);
  const y1 = cy - len1 * Math.sin(rad);
  const x2 = cx - len2 * Math.cos(rad);
  const y2 = cy + len2 * Math.sin(rad);

  const gammaSymbol = isModern ? "γ" : "1/√(1 − v²/V²)";

  const pulse1Label = `pulse 1: ${inL(p1Val)}`;
  const pulse2Label = `pulse 2: ${inL(p2Val)}`;
  /**
   * A pulse label sits just beyond its arrow's tip, clamped so the whole label stays inside the
   * drawing (x 18 to 330). Unclamped, the longest arrow pushed "Pulse 2: 1.0000 L" to begin 140px
   * left of the drawing at the default 0.6c and 0 degrees. The width is estimated at about 0.6 em
   * a character of bold sans at the 12-unit label size.
   */
  function pulseLabelX(tipX: number, growsRight: boolean, text: string) {
    const width = text.length * 12 * 0.6;
    return growsRight ? Math.min(tipX + 8, 330 - width) : Math.max(tipX - 8, 18 + width);
  }

  return (
    <div
      className="two-ledgers-svg-wrap"
      data-step={step}
      data-premise={premise}
      data-notation={notation}
      data-view-id="me-01-ledgers"
    >
      <div className="me01-figure-grid">
        <div className="emission-geometry">
          <p className="me01-figure-title">Seen from a frame moving at v = {frameSpeed}c</p>
          <p className="fine me01-figure-sub">
            The body sends out two equal pulses in opposite directions, at φ ={" "}
            {numberText(emissionAngle)}° to the direction of motion.
          </p>
          <svg
            viewBox="0 0 340 275"
            className="two-ledgers-canvas"
            role="img"
            aria-label={`Two opposite pulses seen from a frame moving at ${frameSpeed}c, at ${emissionAngle} degrees to the motion: pulse 1 ${inL(p1Val)}, pulse 2 ${inL(p2Val)}`}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width="340" height="275" />
              </clipPath>
              <marker
                id="arrow-pulse1"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--me01-pulse-1)" />
              </marker>
              <marker
                id="arrow-pulse2"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ea580c" />
              </marker>
              <marker
                id="arrow-velocity"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#059669" />
              </marker>
            </defs>

            {/* The line of motion */}
            <line
              x1="20"
              y1={cy}
              x2="330"
              y2={cy}
              stroke="var(--line)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />

            {/* The moving frame's velocity */}
            {Math.abs(frameSpeed) > 0 && (
              <g className="velocity-vector">
                <line
                  x1={cx}
                  y1={cy + 45}
                  x2={cx + (frameSpeed > 0 ? 60 : -60)}
                  y2={cy + 45}
                  stroke="#059669"
                  strokeWidth="2.5"
                  markerEnd="url(#arrow-velocity)"
                />
                <text
                  x={cx + (frameSpeed > 0 ? 30 : -30)}
                  y={cy + 64}
                  textAnchor="middle"
                  fontWeight="bold"
                  fill="var(--ink)"
                  style={label}
                >
                  v = {frameSpeed}c
                </text>
              </g>
            )}

            <line
              x1={cx}
              y1={cy}
              x2={x1}
              y2={y1}
              stroke="var(--me01-pulse-1)"
              strokeWidth="3.5"
              markerEnd="url(#arrow-pulse1)"
            />
            <line
              x1={cx}
              y1={cy}
              x2={x2}
              y2={y2}
              stroke="#ea580c"
              strokeWidth="3.5"
              markerEnd="url(#arrow-pulse2)"
            />

            {/* The emitting body, at rest in its own frame */}
            <circle cx={cx} cy={cy} r="17" fill="var(--ink)" stroke="var(--ink)" strokeWidth="2" />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fill="var(--paper)"
              fontWeight="bold"
              style={label}
            >
              body
            </text>

            {/* Pulse labels, clamped into the drawing (see pulseLabelX) */}
            <text
              x={pulseLabelX(x1, Math.cos(rad) >= 0, pulse1Label)}
              y={Math.max(20, y1 - 8)}
              textAnchor={Math.cos(rad) >= 0 ? "start" : "end"}
              fontWeight="bold"
              fill="var(--ink)"
              style={label}
            >
              {pulse1Label}
            </text>
            <text
              x={pulseLabelX(x2, Math.cos(rad) <= 0, pulse2Label)}
              y={Math.min(268, y2 + 18)}
              textAnchor={Math.cos(rad) <= 0 ? "start" : "end"}
              fontWeight="bold"
              fill="var(--ink)"
              style={label}
            >
              {pulse2Label}
            </text>
          </svg>
        </div>

        <div className="ledger-summary">
          <p className="me01-figure-title">The two energy accounts</p>
          {/* THE TABLE THE MANIFEST DECLARES (am-jioj). me-01 declares a view `table-two-ledgers`
              of kind `table`, and two of its actions promise a reader will "read the moving ledger
              values in the table". Until this, the accounts were a two-item definition list giving
              each frame's light total and its balance equation, so the promise named a structure
              that was not here and the individual pulse energies lived only as labels inside the
              drawing. Two accounts of the same emission, line by line, are tabular: a reader moving
              by row compares the same line in the two frames, which a nested list cannot offer. */}
          <section
            className="table-scroll"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns cannot be reached by keyboard at all (am-bc6s)
            tabIndex={0}
            aria-label="The two energy accounts, line by line, in the body's rest frame and in the moving frame"
          >
            <table className="me01-ledger-table" data-view="table-two-ledgers">
              <caption>
                Each line in units of the emitted energy L, for the accepted settings: v ={" "}
                {numberText(frameSpeed)}c, φ = {numberText(emissionAngle)}°. The body sends out two
                equal halves, L/2 each, in its own frame; the moving frame sees them unequal.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Line of the account</th>
                  <th scope="col">Rest frame (K₀)</th>
                  <th scope="col">Moving frame (k)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Body&apos;s energy before emission</th>
                  <LedgerCell
                    result={evaluation.restBodyBefore}
                    inL={inL}
                    output="restBodyBefore"
                  />
                  <LedgerCell
                    result={evaluation.movingBodyBefore}
                    inL={inL}
                    output="movingBodyBefore"
                  />
                </tr>
                <tr>
                  <th scope="row">Light sent out</th>
                  <LedgerCell
                    result={evaluation.restBalanceLight}
                    inL={inL}
                    output="restBalanceLight"
                  />
                  <LedgerCell
                    result={evaluation.movingBalanceLight}
                    inL={inL}
                    output="movingBalanceLight"
                  />
                </tr>
                <tr>
                  <th scope="row">…of which pulse 1</th>
                  <td>L/2</td>
                  <LedgerCell result={evaluation.pulse1Moving} inL={inL} output="pulse1Moving" />
                </tr>
                <tr>
                  <th scope="row">…of which pulse 2</th>
                  <td>L/2</td>
                  <LedgerCell result={evaluation.pulse2Moving} inL={inL} output="pulse2Moving" />
                </tr>
                <tr>
                  <th scope="row">…the two pulses together</th>
                  <td>L</td>
                  <LedgerCell
                    result={evaluation.pulseSumMoving}
                    inL={inL}
                    output="pulseSumMoving"
                  />
                </tr>
                <tr>
                  <th scope="row">Body&apos;s energy after emission</th>
                  <LedgerCell result={evaluation.restBodyAfter} inL={inL} output="restBodyAfter" />
                  <LedgerCell
                    result={evaluation.movingBodyAfter}
                    inL={inL}
                    output="movingBodyAfter"
                  />
                </tr>
                <tr>
                  <th scope="row">The account as an equation</th>
                  <td className="me01-equation" colSpan={2}>
                    E₀ − E₁ = L; H₀ − H₁ = {gammaSymbol}·L
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
          <div className="me01-subtraction">
            <p className="me01-figure-title">Subtracting one account from the other</p>
            <p className="me01-equation">(H₀ − E₀) − (H₁ − E₁) = L({gammaSymbol} − 1)</p>
            <p>
              Drop in energy of motion:{" "}
              <strong>{isRelaxed ? "not determined" : inL(subVal)}</strong>
            </p>
            <p className="fine">
              {isRelaxed
                ? "With the premise relaxed (C ≠ C′), the drop ΔK is not determined."
                : "The body's internal energies at rest cancel."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
