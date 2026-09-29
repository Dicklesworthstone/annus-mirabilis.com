import {
  BOUNDARY_CHOICES,
  EMITTED_JOULES,
  PRINTED_MASS_EXPONENT,
  PRINTED_MASS_MANTISSA,
} from "../../discovery/boundaryChoices.ts";
import "../../discovery/journeySkeleton.css";

/**
 * The three boundaries the journey tells a reader to draw (dispatch 450).
 *
 * "In the ledger below one joule of light leaves a body: draw the boundary around the body alone,
 * around the light, or around both, and read the mass that goes with it." The laboratory beneath
 * draws one boundary at a time, which is what makes it a laboratory a reader operates. The
 * comparison the sentence asks for is the three together, and only together do they say the thing
 * the journey is for: the same emission, weighed three ways, gives a loss, a gain and no change.
 *
 * The mass is derived from the speed of light in src/physics/reference/massEnergy.ts rather than
 * written here, and the wording of each boundary is the laboratory's own, so a reader meets one
 * vocabulary rather than two.
 */

const W = 300,
  PANEL = 88,
  GAP = 10,
  LEFT = 6,
  TOP = 24,
  BOX = 62;

/** Short enough to sit under a panel; the full wording of each is in the caption. */
const SHORT: Readonly<Record<string, string>> = {
  "body-alone": "the body",
  radiation: "the light",
  "combined-isolated-system": "both",
};

export function ThreeBoundaries() {
  const printed = `${PRINTED_MASS_MANTISSA} × 10${PRINTED_MASS_EXPONENT === -17 ? "⁻¹⁷" : ""} kg`;
  const height = TOP + BOX + 48;

  return (
    <figure className="journey-boundaries">
      <svg
        className="journey-boundaries-figure"
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={`Three boundaries drawn around the same emission of ${EMITTED_JOULES} joule of light. Around the body alone, the body ends ${BOUNDARY_CHOICES[0]?.reading}. Around the radiation, it ${BOUNDARY_CHOICES[1]?.reading}. Around both together, the mass is ${BOUNDARY_CHOICES[2]?.reading}. The same emission, weighed three ways.`}
      >
        {BOUNDARY_CHOICES.map((choice, i) => {
          const left = LEFT + i * (PANEL + GAP);
          const centre = left + PANEL / 2;
          const encloseBody = choice.id !== "radiation";
          const encloseLight = choice.id !== "body-alone";
          return (
            <g key={choice.id}>
              {/* The boundary: the same dashed line in all three, around different contents. */}
              <rect
                className="journey-boundary-line"
                x={left}
                y={TOP}
                width={PANEL}
                height={BOX}
                rx="4"
              />
              {encloseBody ? (
                <circle
                  className="journey-boundary-body"
                  cx={centre - 18}
                  cy={TOP + BOX / 2}
                  r="13"
                />
              ) : (
                <circle
                  className="journey-boundary-outside"
                  cx={centre - 18}
                  cy={TOP + BOX / 2}
                  r="13"
                />
              )}
              {[0, 1, 2].map((k) => (
                <line
                  key={k}
                  className={encloseLight ? "journey-boundary-ray" : "journey-boundary-ray-outside"}
                  x1={centre + 4}
                  y1={TOP + BOX / 2 - 10 + k * 10}
                  x2={centre + 30}
                  y2={TOP + BOX / 2 - 10 + k * 10}
                />
              ))}
              <text className="journey-boundary-label" x={centre} y={TOP - 8}>
                {SHORT[choice.id]}
              </text>
              <text className="journey-boundary-label" x={centre} y={TOP + BOX + 18}>
                {choice.change === -1 ? "−" : choice.change === 1 ? "+" : "no change"}
              </text>
            </g>
          );
        })}
        {/* The mass once, across the whole figure: under a single 88-unit panel it ran off the
            left edge, which the label audit caught. */}
        <text className="journey-boundary-label" x={W / 2} y={TOP + BOX + 38}>
          the mass of {EMITTED_JOULES} joule: {printed}
        </text>
      </svg>
      <figcaption className="fine">
        One emission of {EMITTED_JOULES} joule, weighed three ways. Drawn round the body alone it
        ends {BOUNDARY_CHOICES[0]?.reading}; drawn round the light, that{" "}
        {BOUNDARY_CHOICES[1]?.reading}; drawn round both, the mass is {BOUNDARY_CHOICES[2]?.reading}
        . The boundary is the same dashed line in all three and only its contents change, because
        the choice is the reader's and not the physics'. What it does not show is where the mass
        went while it was in transit: the drawing has three moments and no between, and the question
        of what a boundary reads during the crossing needs the laboratory below, not this.
      </figcaption>
    </figure>
  );
}
