import { useId } from "react";
import {
  MINUTE_DISPLACEMENT_MICROMETRES,
  MINUTE_DISPLACEMENT_SQUARED_MANTISSA,
  PLACES,
} from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The picture foundation:bridge-scientific-notation-units asks for (dispatch 401).
 *
 * The obstacle the lesson names in its own first paragraph is miscounting: 0.000001 m is "easy to
 * miscount by one zero, which is a factor of ten". A reader who has just been told that cannot
 * check it by reading the same string of zeros again, so the places are drawn as counted steps,
 * with the named units sitting on the rungs that have names.
 *
 * The second rung is the lesson's other claim, that a square micrometre is 10⁻¹² m² and not 10⁻⁶
 * m². Both rungs are drawn at the same scale, so squaring is visibly twice as far along the same
 * ruler rather than an assertion about an exponent.
 *
 * This is not the orders-of-magnitude scale (MagnitudeScale.tsx), which compares two numbers a
 * reader chooses on a zoomable logarithmic axis. This one is fixed, has no controls, and is about
 * counting decimal places and carrying a unit through squaring.
 */

const W = 300,
  H = 180;
const ORIGIN = 26,
  STEP = 19;
const LENGTHS_Y = 62,
  AREAS_Y = 150;
const x = (power: number) => ORIGIN + -power * STEP;

const MICRO = PLACES[PLACES.length - 1] as (typeof PLACES)[number];

export function CountingThePlaces({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="bridge-scientific-notation-units"
    >
      <Title id={headingId} className="construction-title">
        The places, counted, and what squaring does to them
      </Title>
      <p>
        Each step along either ruler is one place after the decimal point, and one factor of ten.
        Both rulers are drawn at the same scale.
      </p>

      <svg
        className="bridge-figure places-figure"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Two rulers of powers of ten, drawn at the same scale. The upper one runs from the metre to ten to the minus six, six steps, with the centimetre at two steps, the millimetre at three and the micrometre at six. The lower one runs from the square metre to ten to the minus twelve, twelve steps, with the square micrometre at the far end. A broken line joins the micrometre on the upper ruler to the square micrometre on the lower one, twice as far along."
      >
        <text className="bridge-axis-name" x="2" y="14">
          lengths: one step is one place
        </text>
        <line className="bridge-axis" x1={x(0)} y1={LENGTHS_Y} x2={x(-6)} y2={LENGTHS_Y} />
        {PLACES.map((place) => (
          <g key={place.power}>
            <line
              className="bridge-tick"
              x1={x(place.power)}
              y1={LENGTHS_Y}
              x2={x(place.power)}
              y2={LENGTHS_Y + (place.name ? 9 : 5)}
            />
            {place.name ? (
              <text
                className="bridge-number"
                x={x(place.power)}
                y={LENGTHS_Y - 9}
                textAnchor="middle"
              >
                {place.symbol}
              </text>
            ) : null}
          </g>
        ))}
        <text className="bridge-number" x={x(0)} y={LENGTHS_Y + 22} textAnchor="middle">
          10⁰
        </text>
        <text className="bridge-number" x={x(-6)} y={LENGTHS_Y + 22} textAnchor="middle">
          10⁻⁶
        </text>
        <text className="bridge-number" x={x(-3)} y={LENGTHS_Y + 22} textAnchor="middle">
          10⁻³
        </text>

        <line
          className="bridge-step"
          x1={x(-6)}
          y1={LENGTHS_Y + 30}
          x2={x(-12)}
          y2={AREAS_Y - 26}
        />
        <text className="bridge-number" x={x(-8.6)} y={LENGTHS_Y + 52}>
          squared
        </text>

        <text className="bridge-axis-name" x="2" y={AREAS_Y - 40}>
          areas: the same scale, twice as far
        </text>
        <line className="bridge-axis" x1={x(0)} y1={AREAS_Y} x2={x(-12)} y2={AREAS_Y} />
        {[0, -2, -4, -6, -8, -10, -12].map((power) => (
          <line
            key={power}
            className="bridge-tick"
            x1={x(power)}
            y1={AREAS_Y}
            x2={x(power)}
            y2={AREAS_Y + (power === 0 || power === -12 ? 9 : 5)}
          />
        ))}
        <text className="bridge-number" x={x(0)} y={AREAS_Y - 9} textAnchor="middle">
          m²
        </text>
        <text className="bridge-number" x={x(-12)} y={AREAS_Y - 9} textAnchor="middle">
          {MICRO.symbol}²
        </text>
        <text className="bridge-number" x={x(0)} y={AREAS_Y + 22} textAnchor="middle">
          10⁰
        </text>
        <text className="bridge-number" x={x(-6)} y={AREAS_Y + 22} textAnchor="middle">
          10⁻⁶
        </text>
        <text className="bridge-number" x={x(-12)} y={AREAS_Y + 22} textAnchor="middle">
          10⁻¹²
        </text>
      </svg>

      <p className="fine">
        A square micrometre sits at twelve places along the lower ruler. Six is where the micrometre
        itself sits, one ruler up.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The upper ruler counts places after the decimal point in metres. The centimetre is two
          places along, the millimetre three and the micrometre six, so a micrometre is 10⁻⁶ m, or
          0.000001 m. A reader who loses count by one rung has the length wrong by a factor of ten.
        </p>
        <p>
          The lower ruler counts the same places for areas and is twice as long. The micrometre at
          six places becomes a square micrometre at twelve, 10⁻¹² m². This is why the Brownian
          paper's displacement after a minute, about {MINUTE_DISPLACEMENT_MICROMETRES} μm or{" "}
          {MINUTE_DISPLACEMENT_MICROMETRES} × 10⁻⁶ m, has a square of{" "}
          {MINUTE_DISPLACEMENT_SQUARED_MANTISSA} × 10⁻¹¹ m² rather than anything measured in 10⁻⁶
          m². Squaring a measurement squares the number and the unit together, the power of ten
          included.
        </p>
      </div>
    </section>
  );
}
