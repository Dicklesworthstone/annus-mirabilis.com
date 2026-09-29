import { useId } from "react";
import { RECTANGLE_AREA, RECTANGLE_SIDES, rectangleArea } from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The rectangles foundation:error-and-inference opens with (dispatch 444).
 *
 * "Some questions the data cannot answer, however carefully you measure. If all you know of a
 * rectangle is that its area is 12 square centimetres, its sides could be 3 and 4, 2 and 6, or 1
 * and 12. The area fixes their product." That is the lesson's first move and the one its whole
 * §3 parallel rests on: watching particles spread gives the diffusion coefficient, and the
 * diffusion coefficient fixes a product of the molecular number and the particle radius, not
 * either of them.
 *
 * Its construction, RepeatedIntervals, is about confidence intervals and does not touch this.
 * Three rectangles at one scale say it in a way no sentence does: same area, visibly nothing
 * alike.
 */

const W = 300,
  H = 184,
  UNIT = 11,
  BASE = 146,
  GAP = 40;

export function OneAreaManyShapes({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);

  const total =
    RECTANGLE_SIDES.reduce((w, [side]) => w + side * UNIT, 0) + GAP * (RECTANGLE_SIDES.length - 1);
  let cursor = (W - total) / 2;
  const boxes = RECTANGLE_SIDES.map((sides) => {
    const left = cursor;
    cursor += sides[0] * UNIT + GAP;
    return { sides, left };
  });

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="error-and-inference"
    >
      <Title id={headingId} className="construction-title">
        One area, three shapes
      </Title>
      <p>
        Every rectangle below encloses {RECTANGLE_AREA} square centimetres. They are drawn at one
        scale, so the areas really are equal and the shapes really are not.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Three rectangles side by side at one scale, each enclosing ${RECTANGLE_AREA} square centimetres: ${RECTANGLE_SIDES.map(([a, b]) => `${a} by ${b}`).join(", ")}. The first is nearly square, the second is taller and narrower, and the third is a tall thin sliver. Knowing the area alone cannot tell them apart.`}
      >
        {boxes.map(({ sides, left }) => {
          const [wide, tall] = sides;
          return (
            <g key={`${wide}x${tall}`}>
              <rect
                className="bridge-bar-share"
                x={left}
                y={BASE - tall * UNIT}
                width={wide * UNIT}
                height={tall * UNIT}
              />
              <rect
                className="bridge-bar-whole"
                x={left}
                y={BASE - tall * UNIT}
                width={wide * UNIT}
                height={tall * UNIT}
              />
              <text
                className="bridge-number"
                x={left + (wide * UNIT) / 2}
                y={BASE + 18}
                textAnchor="middle"
              >
                {wide} × {tall}
              </text>
              <text
                className="bridge-number"
                x={left + (wide * UNIT) / 2}
                y={BASE + 34}
                textAnchor="middle"
              >
                {rectangleArea(sides)}
              </text>
            </g>
          );
        })}
        <text className="bridge-axis-name" x={W / 2} y={H - 4} textAnchor="middle">
          sides, and the area they enclose
        </text>
      </svg>

      <p className="fine">
        The measurement fixes the product and leaves the pair open. That is not a shortcoming of the
        measuring: no amount of care with the area will separate {RECTANGLE_SIDES[0]?.join(" and ")}{" "}
        from {RECTANGLE_SIDES[2]?.join(" and ")}. Another kind of observation has to do it.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Three rectangles at one scale, each enclosing {RECTANGLE_AREA} square centimetres:{" "}
          {RECTANGLE_SIDES.map(([a, b]) => `${a} by ${b}`).join(", ")}. The first is nearly square,
          the last is a thin sliver twelve centimetres tall, and no measurement of area however
          careful will tell you which one you have. The area fixes the product of the sides and says
          nothing about either side alone.
        </p>
        <p>
          The Brownian paper meets the same limit in its §3. Watching particles spread gives the
          diffusion coefficient, and the diffusion coefficient fixes a product of the molecular
          number and the particle radius. One more independent measurement, of the radius, is what
          separates them, exactly as a second measurement of one side would separate these
          rectangles.
        </p>
        <p>
          What it does not show: three is not the family. Any pair whose product is {RECTANGLE_AREA}{" "}
          lies on the same curve, including pairs that are not whole numbers, such as 2.5 by 4.8.
          These three are drawn because they are the three the lesson names, not because the
          possibilities can be counted, and a reader who took the picture for the whole set would be
          reading a limit into it that is not there.
        </p>
      </div>
    </section>
  );
}
