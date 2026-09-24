"use client";

import { useId, useState } from "react";
import {
  FACTOR_SLIDER,
  fourFigures,
  PAPER_SPREAD_UM,
  scaleByTyped,
} from "../../foundations/scaling.ts";
import { Sci } from "../lab/Sci.tsx";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/** A factor as a reader reads it: 4, 1.414, 0.7071, and 1.000 × 10⁹ once it stops fitting. */
function Factor({ value }: { readonly value: number }) {
  const abs = Math.abs(value);
  if (abs >= 1e5 || (abs > 0 && abs < 1e-3)) return <Sci value={value} digits={3} />;
  return <>{fourFigures(value)}</>;
}

/**
 * The scaling construction of foundation:ratios-scaling. The factors come from
 * src/foundations/scaling.ts; this component only draws them.
 *
 * The typed field and the slider set one factor. Dragging commits at once; typing edits a draft
 * that commits when the field loses focus or on Enter, so a half-typed "0." is never scaled by.
 * A typed factor outside the slider's range leaves the thumb at the nearer end and the field
 * showing what was typed, so the number shown is always the number used.
 */
export function ScalingTable({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    labelId = useId(),
    fieldId = useId(),
    hintId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [draft, setDraft] = useState("2");
  const [committed, setCommitted] = useState("2");
  const outcome = scaleByTyped(committed);
  const numeric = outcome.status === "scaled" ? outcome.k : FACTOR_SLIDER.min;
  const thumb = Math.min(FACTOR_SLIDER.max, Math.max(FACTOR_SLIDER.min, numeric));
  const commit = (text: string) => {
    setDraft(text);
    setCommitted(text);
  };

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="ratios-scaling"
    >
      <Title id={headingId} className="construction-title">
        Try it: scaling by a factor
      </Title>
      <p>
        Choose a factor k and multiply a length by it. The readout shows what happens to an area, a
        volume and the spread of a diffusing particle, with the Brownian paper's 0.8 micrometres
        worked through.
      </p>

      <div className="construction-controls">
        <label id={labelId} htmlFor={fieldId}>
          Scale factor k
        </label>
        <input
          id={fieldId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          aria-describedby={hintId}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(event.currentTarget.value);
            }
          }}
        />
        <input
          type="range"
          aria-labelledby={labelId}
          min={FACTOR_SLIDER.min}
          max={FACTOR_SLIDER.max}
          step={FACTOR_SLIDER.step}
          value={thumb}
          onChange={(event) => commit(event.target.value)}
        />
        <p id={hintId} className="fine">
          Type a factor and press Enter, or drag the slider from 0.5 to 5.
        </p>
      </div>

      <div className="construction-display" role="status">
        {outcome.status === "scaled" ? (
          <dl className="readout-grid">
            <dt>Length</dt>
            <dd>
              × k = <Factor value={outcome.length} />
            </dd>
            <dt>Area</dt>
            <dd>
              × k² = <Factor value={outcome.area} />
            </dd>
            <dt>Volume</dt>
            <dd>
              × k³ = <Factor value={outcome.volume} />
            </dd>
            <dt>Spread, k times as long</dt>
            <dd>
              × √k = <Factor value={outcome.spreadLongerTime} />: {PAPER_SPREAD_UM} μm in 1 s
              becomes <Factor value={outcome.paperSpreadLongerTimeUm} /> μm in{" "}
              <Factor value={outcome.k} /> s
            </dd>
            <dt>Spread, k times the radius</dt>
            <dd>
              × 1/√k = <Factor value={outcome.spreadLargerRadius} />: {PAPER_SPREAD_UM} μm becomes{" "}
              <Factor value={outcome.paperSpreadLargerRadiusUm} /> μm, and k times the viscosity
              does the same
            </dd>
          </dl>
        ) : (
          <p className="construction-status">{outcome.message}</p>
        )}
      </div>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Multiplying a length by k multiplies an area by k² and a volume by k³. A diffusing
          particle's spread grows as the square root of the time, so k times as long gives √k times
          the spread. Multiplying the radius or the viscosity by k divides the diffusion coefficient
          by k and the spread by √k. At k = 2 the spread changes by 1.414 or by 0.7071, not by 2 or
          by one half.
        </p>
      </div>
    </section>
  );
}
