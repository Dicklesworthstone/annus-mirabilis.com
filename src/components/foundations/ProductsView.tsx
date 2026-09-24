"use client";

import { useId, useState } from "react";
import { A, ANGLE_SLIDER, B_LENGTH, showProductsTyped } from "../../foundations/productsView.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/** Three decimals, trailing zeros dropped, a true minus sign, and no "−0". */
function fmt(n: number): string {
  const rounded = Number(n.toFixed(3));
  if (rounded === 0) return "0";
  return rounded < 0 ? `−${String(-rounded)}` : String(rounded);
}

/**
 * Drawing units per model unit: about one unit to the pixel, so the site-wide
 * svg[role="img"] text rule gives the labels their normal size (labShell.css).
 */
const SCALE = 30;
/** Model coordinates to SVG ones: scaled, and flipped because SVG's y runs down. */
const svg = (x: number, y: number) => ({ x: x * SCALE, y: -y * SCALE });
/**
 * The drawing's extent in model units. b is 3 long and a is 4, so the parallelogram's far corner
 * a + b reaches x = 7 and anything reaches at most 3 above or below; the box leaves room for labels.
 */
const X_MIN = -3.8;
const X_MAX = 7.6;
const Y_REACH = 3.8;

/**
 * The projection and oriented-area view of foundation:dot-cross-products. The products come from
 * src/foundations/productsView.ts; this component only draws them. The typed field commits on
 * Enter or blur; the slider commits at once.
 */
export function ProductsView({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    labelId = useId(),
    fieldId = useId(),
    hintId = useId(),
    markerId = `head-${useId().replace(/[^a-zA-Z0-9]/g, "")}`,
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [draft, setDraft] = useState("60");
  const [committed, setCommitted] = useState("60");
  const outcome = showProductsTyped(committed);
  const commit = (text: string) => {
    setDraft(text);
    setCommitted(text);
  };
  const view = outcome.status === "shown" ? outcome.view : null;
  const thumb = view ? Math.min(ANGLE_SLIDER.max, Math.max(ANGLE_SLIDER.min, view.angle)) : 0;

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="dot-cross-products"
    >
      <Title id={headingId} className="construction-title">
        Try it: a projection and an area
      </Title>
      <p>
        Arrow a is 4 long along x. Arrow b is {B_LENGTH} long; turn it and watch how much of it lies
        along a, and how much area the two arrows span.
      </p>

      <div className="construction-controls">
        <label id={labelId} htmlFor={fieldId}>
          Angle from a to b, in degrees
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
          Type an angle and press Enter, or drag the slider from −180° to 180°. A positive angle
          turns b counterclockwise from a.
        </p>
      </div>

      {view &&
        (() => {
          const tipA = svg(A.x, A.y);
          const tipB = svg(view.b.x, view.b.y);
          const corner = svg(A.x + view.b.x, A.y + view.b.y);
          const foot = svg(view.projection, 0);
          return (
            <svg
              className="vector-axes-figure"
              viewBox={`${X_MIN * SCALE} ${-Y_REACH * SCALE} ${(X_MAX - X_MIN) * SCALE} ${2 * Y_REACH * SCALE}`}
              role="img"
              aria-label={`Arrow a along x and arrow b at ${fmt(view.angle)} degrees, with the parallelogram they span and b's projection on a.`}
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
                x1={X_MIN * SCALE}
                y1={0}
                x2={X_MAX * SCALE}
                y2={0}
              />
              <polygon
                className="products-area"
                points={`0,0 ${tipA.x},${tipA.y} ${corner.x},${corner.y} ${tipB.x},${tipB.y}`}
              />
              <line className="vector-projection" x1={tipB.x} y1={tipB.y} x2={foot.x} y2={foot.y} />
              <line
                className="vector-arrow"
                x1={0}
                y1={0}
                x2={tipA.x}
                y2={tipA.y}
                markerEnd={`url(#${markerId})`}
              />
              <line
                className="products-arrow-b"
                x1={0}
                y1={0}
                x2={tipB.x}
                y2={tipB.y}
                markerEnd={`url(#${markerId})`}
              />
              <text x={tipA.x + 0.2 * SCALE} y={tipA.y + 0.6 * SCALE}>
                a
              </text>
              <text x={tipB.x + 0.2 * SCALE} y={tipB.y - 0.2 * SCALE}>
                b
              </text>
            </svg>
          );
        })()}

      <div className="construction-display" role="status">
        {view ? (
          <>
            <p>
              <strong>
                a·b = 4 × {B_LENGTH} × cos {fmt(view.angle)}° = {fmt(view.dot)}.
              </strong>{" "}
              b's projection on a is {fmt(view.projection)}: that much of b lies along a.
            </p>
            <p>
              <strong>
                a × b has size {fmt(Math.abs(view.cross))}, the area of the parallelogram
              </strong>
              {view.crossDirection === "none"
                ? ", which is zero: the arrows lie along one line and span no area."
                : `, and points ${view.crossDirection}.`}
            </p>
          </>
        ) : (
          outcome.status === "refused" && <p className="construction-status">{outcome.message}</p>
        )}
      </div>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The dot product 4 × 3 × cos φ measures how much of b lies along a: 6 at 60°, zero at 90°,
          −12 at 180°. The cross product has size 4 × 3 × sin φ, the area of the parallelogram the
          arrows span, largest at 90° and zero when they line up. By the right-hand rule it points
          out of the page when b is counterclockwise from a and into the page when it is clockwise;
          swapping the order of a and b reverses it. The figure shows a thick, b thinner, the
          parallelogram with a dashed outline, and a dotted line from b's tip to its projection on
          a.
        </p>
      </div>
    </section>
  );
}
