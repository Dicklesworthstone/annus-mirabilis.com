"use client";

import { useId, useState } from "react";
import { ALIGNED_ANGLE, ANGLE_SLIDER, ARROW, turnAxesTyped } from "../../foundations/vectorAxes.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/** Three decimals, trailing zeros dropped, a true minus sign, and no "−0". */
function fmt(n: number): string {
  const rounded = Number(n.toFixed(3));
  if (rounded === 0) return "0";
  return rounded < 0 ? `−${String(-rounded)}` : String(rounded);
}

/**
 * Drawing units per model unit. The site sizes every figure's labels with one rule,
 * svg[role="img"] text { font-size: var(--type-fine) }, read in viewBox units, so a drawing is laid
 * out about one unit to the pixel (labShell.css explains the convention). At 25 the figure is
 * 340 units wide and its labels read near their normal size at the 20rem the figure is capped at.
 */
const SCALE = 25;

/** Model coordinates to SVG ones: scaled, and flipped because SVG's y runs down. */
const svg = (x: number, y: number) => ({ x: x * SCALE, y: -y * SCALE });

/** Half the axis length, in model units; the arrow is 5 long. */
const REACH = 6;
/** The margin around the axes for labels, in model units. */
const MARGIN = 0.8;

/**
 * The turnable-axes construction of foundation:vectors-components. The components come from
 * src/foundations/vectorAxes.ts; this component only draws them and projects them into the
 * figure. The typed field commits on Enter or blur; the slider commits at once.
 */
export function TurnedAxes({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    labelId = useId(),
    fieldId = useId(),
    hintId = useId(),
    markerId = `arrowhead-${useId().replace(/[^a-zA-Z0-9]/g, "")}`,
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [draft, setDraft] = useState("36.87");
  const [committed, setCommitted] = useState("36.87");
  const outcome = turnAxesTyped(committed);
  const commit = (text: string) => {
    setDraft(text);
    setCommitted(text);
  };
  const axes = outcome.status === "turned" ? outcome.axes : null;
  const thumb = axes ? Math.min(ANGLE_SLIDER.max, Math.max(ANGLE_SLIDER.min, axes.angle)) : 0;

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="vectors-components"
    >
      <Title id={headingId} className="construction-title">
        Try it: one arrow, turned axes
      </Title>
      <p>
        The arrow is fixed: 5 units long, 3 along the original x axis and 4 along y. Turn the axes
        and read the arrow's components along the new ones.
      </p>

      <div className="construction-controls">
        <label id={labelId} htmlFor={fieldId}>
          Angle of the turned axes, in degrees
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
          min={ANGLE_SLIDER.min}
          max={ANGLE_SLIDER.max}
          step={ANGLE_SLIDER.step}
          value={thumb}
          onChange={(event) => commit(event.target.value)}
        />
        <p id={hintId} className="fine">
          Type an angle and press Enter, or drag the slider from −90° to 90°. Try{" "}
          {fmt(ALIGNED_ANGLE)}°, where the new x axis lies along the arrow.
        </p>
      </div>

      {axes && (
        <svg
          className="vector-axes-figure"
          viewBox={`${-(REACH + MARGIN) * SCALE} ${-(REACH + MARGIN) * SCALE} ${2 * (REACH + MARGIN) * SCALE} ${2 * (REACH + MARGIN) * SCALE}`}
          role="img"
          aria-label={`The arrow, 3 along x and 4 along y, drawn with the original axes dashed and the axes turned by ${fmt(axes.angle)} degrees solid.`}
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto"
            >
              <path d="M0 0 L10 5 L0 10 z" className="vector-arrow-head" />
            </marker>
          </defs>
          <line
            className="vector-axis-original"
            x1={-REACH * SCALE}
            y1={0}
            x2={REACH * SCALE}
            y2={0}
          />
          <line
            className="vector-axis-original"
            x1={0}
            y1={-REACH * SCALE}
            x2={0}
            y2={REACH * SCALE}
          />
          <text x={(REACH + 0.1) * SCALE} y={0.6 * SCALE}>
            x
          </text>
          <text x={0.2 * SCALE} y={-(REACH + 0.2) * SCALE}>
            y
          </text>
          {(() => {
            const { cos, sin } = axes;
            const xEnd = svg(REACH * cos, REACH * sin);
            const xStart = svg(-REACH * cos, -REACH * sin);
            const yEnd = svg(-REACH * sin, REACH * cos);
            const yStart = svg(REACH * sin, -REACH * cos);
            const tip = svg(ARROW.x, ARROW.y);
            const footX = svg(axes.along * cos, axes.along * sin);
            const footY = svg(-axes.across * sin, axes.across * cos);
            const xLabel = svg((REACH + 0.4) * cos, (REACH + 0.4) * sin);
            const yLabel = svg(-(REACH + 0.4) * sin, (REACH + 0.4) * cos);
            return (
              <>
                <line
                  className="vector-axis-turned"
                  x1={xStart.x}
                  y1={xStart.y}
                  x2={xEnd.x}
                  y2={xEnd.y}
                />
                <line
                  className="vector-axis-turned"
                  x1={yStart.x}
                  y1={yStart.y}
                  x2={yEnd.x}
                  y2={yEnd.y}
                />
                <text x={xLabel.x} y={xLabel.y}>
                  x′
                </text>
                <text x={yLabel.x} y={yLabel.y}>
                  y′
                </text>
                <line
                  className="vector-projection"
                  x1={tip.x}
                  y1={tip.y}
                  x2={footX.x}
                  y2={footX.y}
                />
                <line
                  className="vector-projection"
                  x1={tip.x}
                  y1={tip.y}
                  x2={footY.x}
                  y2={footY.y}
                />
                <line
                  className="vector-arrow"
                  x1={0}
                  y1={0}
                  x2={tip.x}
                  y2={tip.y}
                  markerEnd={`url(#${markerId})`}
                />
              </>
            );
          })()}
        </svg>
      )}

      <div className="construction-display" role="status">
        {axes ? (
          <>
            <p>
              <strong>
                In axes turned by {fmt(axes.angle)}°, the arrow is {fmt(axes.along)} along x′ and{" "}
                {fmt(axes.across)} along y′.
              </strong>
            </p>
            <p>
              Its length is √({fmt(axes.along)}² + {fmt(axes.across)}²) = {fmt(axes.length)}, the
              same 5 as in the original axes, where it is 3 along x and 4 along y.
              {axes.aligned ? " The new x axis now lies along the arrow." : ""}
            </p>
          </>
        ) : (
          outcome.status === "refused" && <p className="construction-status">{outcome.message}</p>
        )}
      </div>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Turning the axes changes the numbers that describe the arrow and leaves the arrow alone.
          At 36.87° the components are 4.8 and 1.4, at 53.13° they are 5 and 0, and at every angle
          the length is 5. The figure draws the original axes dashed, the turned axes solid, and
          dotted lines from the arrow's tip to its component along each turned axis.
        </p>
      </div>
    </section>
  );
}
