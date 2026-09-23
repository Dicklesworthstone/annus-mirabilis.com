import type { ReactNode } from "react";
import type { Bm03Parameters } from "../../../experiments/bm03/definition.ts";
import type { Bm03Evaluation } from "../../../experiments/bm03/session.ts";
import { fixed } from "../presentation.ts";
import "./bm03.css";

export interface ConfigurationPlotProps {
  parameters: Bm03Parameters;
  evaluation: Bm03Evaluation;
  clipId: string;
}

/**
 * Each step is a small picture beside its working. Every step used to be drawn, words and all,
 * in one 540-unit SVG, where the site's label size rendered at 7.1px on a 390px phone; the words
 * are HTML now, and the picture is 220 units wide. The numbers in the words come from the
 * reader's settings and the evaluation: step 2 used to say "2 options × 2 options = 4" at every
 * volume ratio.
 */
export function ConfigurationPlot({ parameters, evaluation, clipId }: ConfigurationPlotProps) {
  const { Np, volumeRatio, model, step, notation } = parameters;
  const isPrinted = notation === "printed";
  const isLocked = model === "locked-cluster";
  const V = isPrinted ? "V*" : "V";

  const ratio = Math.max(0.5, Math.min(volumeRatio, 4));
  const exact = evaluation.exactDecimalString;
  const squared = Number((volumeRatio * volumeRatio).toPrecision(6));

  let title: string;
  let lead: ReactNode;
  let picture: ReactNode = null;
  let pictureLabel = "";
  let card: ReactNode;

  if (step === "one-particle") {
    const boxWidth = 60 * Math.min(ratio, 2.5);
    title = `Step 1: one particle in the accessible volume ${V}`;
    lead = "Its possible positions are proportional to the room it has.";
    pictureLabel = `A particle in a box of volume ${volumeRatio} times V₀`;
    picture = (
      <>
        <rect
          x={110 - boxWidth / 2}
          y="20"
          width={boxWidth}
          height="100"
          fill="var(--wash)"
          stroke="var(--plot)"
          strokeWidth="2"
          rx="6"
        />
        <circle cx="110" cy="70" r="8" fill="var(--accent)" />
        <text x="110" y="148" textAnchor="middle">
          {V} = {volumeRatio} × V₀
        </text>
      </>
    );
    card = (
      <>
        <p className="bm03-card-title">Integral over (x₁, y₁, z₁)</p>
        <p className="bm03-math">B₁ = ∫ dx₁ dy₁ dz₁ = {V}</p>
        <p>Factor ratio: {volumeRatio}</p>
      </>
    );
  } else if (step === "two-particles") {
    const k = Math.max(1, Math.min(4, Math.round(ratio)));
    const cell = 150 / k;
    const states = exact ?? String(isLocked ? volumeRatio : squared);
    title = isLocked
      ? "Step 2: two particles locked together"
      : "Step 2: two independent particles";
    lead = isLocked
      ? `Locked together, the pair moves as one unit, so it has only the ${volumeRatio} choices of one particle.`
      : `Independence multiplies the choices: ${volumeRatio} for particle 1 × ${volumeRatio} for particle 2 = ${squared}.`;
    pictureLabel = `${states} arrangement states`;
    picture = (
      <>
        <rect
          x="35"
          y="10"
          width="150"
          height="120"
          fill="var(--wash)"
          stroke="var(--plot)"
          strokeWidth="1.5"
          rx="4"
        />
        {Array.from({ length: k - 1 }, (_, i) => 35 + cell * (i + 1)).map((x) => (
          <line
            key={`col-${x}`}
            x1={x}
            y1="10"
            x2={x}
            y2="130"
            stroke="var(--line)"
            strokeDasharray="3,3"
          />
        ))}
        {Array.from({ length: k - 1 }, (_, i) => 10 + (120 / k) * (i + 1)).map((y) => (
          <line
            key={`row-${y}`}
            x1="35"
            y1={y}
            x2="185"
            y2={y}
            stroke="var(--line)"
            strokeDasharray="3,3"
          />
        ))}
        {Array.from({ length: k * (isLocked ? 1 : k) }, (_, i) => ({
          col: isLocked ? i : i % k,
          row: isLocked ? i : Math.floor(i / k),
        })).map(({ col, row }) => (
          <circle
            key={`pt-${col}-${row}`}
            cx={35 + cell * (col + 0.5)}
            cy={10 + (120 / k) * (row + 0.5)}
            r="6"
            fill="var(--accent)"
          />
        ))}
        <text x="110" y="152" textAnchor="middle">
          {states} arrangement states
        </text>
      </>
    );
    card = (
      <>
        <p className="bm03-card-title">
          {isLocked ? "Integral over the locked pair" : "Integral over two independent particles"}
        </p>
        <p className="bm03-math">
          {isLocked ? `B = ∫ dx dy dz = ${V}` : `B₂ = ∫…∫ dx₁ … dz₂ = ${V}²`}
        </p>
        <p>
          Volume factor: {isLocked ? volumeRatio : `(${volumeRatio})²`} ={" "}
          <strong>{exact ?? (isLocked ? volumeRatio : squared)}</strong>
        </p>
        <p className="fine">
          {isLocked
            ? `The choices grow only as V/V₀ = ${volumeRatio}.`
            : `The choices grow as (V/V₀)² = ${squared}.`}
        </p>
      </>
    );
  } else if (step === "many-particles") {
    const shown = Math.min(Np, 24);
    title = `Step 3: ${Np.toLocaleString()} particles, and the logarithm in the free energy`;
    lead = isPrinted ? (
      <>
        The product V*<sup>n</sup> becomes the sum n lg V* in the logarithm of the free energy.
      </>
    ) : (
      <>
        The product V
        <sup>
          N<sub>p</sub>
        </sup>{" "}
        becomes the sum N<sub>p</sub> ln V in the logarithm of the free energy.
      </>
    );
    pictureLabel =
      Np > shown ? `${shown} of ${Np.toLocaleString()} particles shown` : `${Np} particles`;
    picture = (
      <>
        <rect
          x="20"
          y="10"
          width="180"
          height="120"
          fill="var(--wash)"
          stroke="var(--plot)"
          strokeWidth="1.5"
          rx="6"
        />
        {Array.from({ length: shown }, (_, i) => ({
          cx: 40 + ((i * 37 + 13) % 140),
          cy: 30 + ((i * 53 + 7) % 80),
        })).map(({ cx, cy }) => (
          <circle
            key={`dot-${Np}-${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="4"
            fill="var(--plot)"
            opacity="0.8"
          />
        ))}
        <text x="110" y="152" textAnchor="middle">
          {pictureLabel}
        </text>
      </>
    );
    card = (
      <>
        <p className="bm03-card-title">The configuration integral, in logarithms</p>
        <p className="bm03-math">
          {isPrinted ? (
            <>
              B = V*<sup>n</sup> · J, so lg B = n lg V* + lg J
            </>
          ) : (
            <>
              B = V
              <sup>
                N<sub>p</sub>
              </sup>{" "}
              · J, so ln B = N<sub>p</sub> ln V + ln J
            </>
          )}
        </p>
        <p className="bm03-math">
          {isPrinted ? (
            "F = −2κT lg B"
          ) : (
            <>
              F = −k<sub>B</sub>T ln B
            </>
          )}
        </p>
        <p className="bm03-accent">
          {Np <= 12 ? (
            <>
              Factor ratio: <strong>{exact}</strong>
            </>
          ) : (
            <>
              Factor ratio: 10<sup>{fixed(evaluation.log10Exponent, 4)}</sup> (natural log{" "}
              {evaluation.naturalLogExponent.toFixed(2)})
            </>
          )}
        </p>
        <p className="fine">
          J does not depend on V for a dilute suspension with no external field.
        </p>
      </>
    );
  } else {
    title = "Step 4: the volume derivative gives the ideal pressure law";
    lead = `Taking −∂F/∂${V} drops the volume-independent J and the constant F₀.`;
    // A sketch, not a calculation: the particles in their box, pressing on its walls.
    const units = isLocked ? 1 : Math.min(Np, 12);
    pictureLabel = isLocked
      ? "One locked unit in a box, pressing on its walls"
      : `${Np.toLocaleString()} independent particles in a box, pressing on its walls`;
    picture = (
      <>
        <defs>
          <marker
            id={`${clipId}-push`}
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--accent)" />
          </marker>
        </defs>
        <rect
          x="45"
          y="15"
          width="130"
          height="110"
          fill="var(--wash)"
          stroke="var(--plot)"
          strokeWidth="2"
          rx="6"
        />
        {Array.from({ length: units }, (_, i) => ({
          cx: 60 + ((i * 37 + 13) % 100),
          cy: 30 + ((i * 53 + 7) % 80),
        })).map(({ cx, cy }) => (
          <circle
            key={`unit-${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={isLocked ? 9 : 4}
            fill="var(--plot)"
          />
        ))}
        {[
          { x1: 45, x2: 18 },
          { x1: 175, x2: 202 },
        ].map(({ x1, x2 }) => (
          <line
            key={`push-${x1}`}
            x1={x1}
            y1="70"
            x2={x2}
            y2="70"
            stroke="var(--accent)"
            strokeWidth="2.5"
            markerEnd={`url(#${clipId}-push)`}
          />
        ))}
        <text x="110" y="152" textAnchor="middle">
          p on the walls
        </text>
      </>
    );
    card = (
      <>
        <p>
          <span className="bm03-card-title">Free energy: </span>
          <span className="bm03-math">
            {isPrinted ? (
              "F = −2κT n lg V* − 2κT lg J + F₀"
            ) : (
              <>
                F = −Np k<sub>B</sub>T ln V − k<sub>B</sub>T ln J + F₀
              </>
            )}
          </span>
        </p>
        <p>
          <span className="bm03-card-title">Derivative: </span>
          <span className="bm03-math">
            {isPrinted ? (
              "p = −∂F/∂V* = 2κT · (n / V*) + 0 + 0 = (RT / N) · (n / V*)"
            ) : (
              <>
                p = −∂F/∂V = Np k<sub>B</sub>T / V + 0 + 0 = n k<sub>B</sub>T
              </>
            )}
          </span>
        </p>
        <p className={isLocked ? "bm03-contrast bm03-contrast-locked" : "bm03-contrast"}>
          {isLocked ? (
            <>
              Locked cluster: one independent unit, so p = k<sub>B</sub>T / V. Pressure counts
              units, not constituents.
            </>
          ) : (
            <>
              Independent model: {Np.toLocaleString()} independent units, so p ={" "}
              {Np.toLocaleString()} k<sub>B</sub>T / V.
            </>
          )}
        </p>
      </>
    );
  }

  return (
    <div
      className="configuration-svg-wrap"
      data-step={step}
      data-model={model}
      data-notation={notation}
    >
      <p className="bm03-step-title">{title}</p>
      <p className="fine bm03-step-lead">{lead}</p>
      <div className="bm03-step-grid">
        {picture ? (
          <svg
            viewBox="0 0 220 165"
            className="configuration-canvas"
            role="img"
            aria-label={pictureLabel}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width="220" height="165" />
              </clipPath>
            </defs>
            {picture}
          </svg>
        ) : null}
        <div className="bm03-card">{card}</div>
      </div>
    </div>
  );
}
