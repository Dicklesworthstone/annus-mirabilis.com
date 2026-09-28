import { useId } from "react";
import { SHARES, shareOf } from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The picture foundation:bridge-fractions-ratios asks for (dispatch 401).
 *
 * The lesson's worked example is already a drawing in words: one particle of four moves right, two
 * of eight move right, and the fraction is 0.25 both times. Two rows of dots and two bars are the
 * whole argument, and they make the claim checkable by looking rather than by trusting the
 * division: the shaded stretch of the two bars is the same length, drawn from counts of four and
 * of eight.
 *
 * A dot that counts is filled and a dot that does not is an outline, so the two kinds are told
 * apart by shape as well as by fill.
 */

const W = 300,
  H = 156;
const BAR_LEFT = 20,
  BAR_RIGHT = 232,
  BAR_H = 16;
const ROWS = [
  { y: 32, barY: 56, radius: 11 },
  { y: 104, barY: 128, radius: 8 },
] as const;

export function SameShareTwice({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const fractions = SHARES.map(shareOf);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="bridge-fractions-ratios"
    >
      <Title id={headingId} className="construction-title">
        One in four and two in eight, drawn side by side
      </Title>
      <p>
        The filled dots are the ones that moved. Under each row, a bar with that share of its length
        shaded. The two groups have different sizes and the two shaded stretches are the same
        length.
      </p>

      <svg
        className="bridge-figure shares-figure"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Two rows of dots with a bar under each. The first row has four dots of which one is filled, and its bar has a quarter of its length shaded. The second row has eight dots of which two are filled, and its bar has the same length shaded. Both shares are ${fractions[0]}.`}
      >
        {SHARES.map((row, r) => {
          const { y, barY, radius } = ROWS[r] as (typeof ROWS)[number];
          const step = (BAR_RIGHT - BAR_LEFT) / row.group;
          const shaded = BAR_LEFT + (BAR_RIGHT - BAR_LEFT) * shareOf(row);
          return (
            <g key={row.group}>
              {Array.from({ length: row.group }, (_, i) => ({
                cx: BAR_LEFT + step * (i + 0.5),
                moved: i < row.moved,
              })).map((dot) => (
                <circle
                  key={dot.cx}
                  className={dot.moved ? "bridge-dot-moved" : "bridge-dot-still"}
                  cx={dot.cx}
                  cy={y}
                  r={radius}
                />
              ))}
              <rect
                className="bridge-bar-whole"
                x={BAR_LEFT}
                y={barY}
                width={BAR_RIGHT - BAR_LEFT}
                height={BAR_H}
              />
              <rect
                className="bridge-bar-share"
                x={BAR_LEFT}
                y={barY}
                width={shaded - BAR_LEFT}
                height={BAR_H}
              />
              <line
                className="bridge-tick"
                x1={shaded}
                y1={barY - 5}
                x2={shaded}
                y2={barY + BAR_H + 5}
              />
              <text className="bridge-number" x={BAR_RIGHT + 8} y={y + 5}>
                {row.moved} of {row.group}
              </text>
              <text className="bridge-number" x={BAR_RIGHT + 8} y={barY + 13}>
                {shareOf(row)}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="fine">
        The shaded stretch is the same length in both bars. A label that long does not fit inside a
        drawing, and a drawing's text does not reflow on a narrow screen, so it is written here.
      </p>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The first row is a group of {SHARES[0]?.group} with {SHARES[0]?.moved} filled, and the bar
          under it is shaded for a quarter of its length. The second row is a group of{" "}
          {SHARES[1]?.group} with {SHARES[1]?.moved} filled, and the bar under it is shaded for the
          same length as the first. Doubling how many moved and doubling the size of the group
          together leave the share where it was, at {fractions[0]}.
        </p>
        <p>
          The dots are counted and the bars are measured, so the two rows agree by two different
          routes. A fraction records how much of the group moved. The size of the group is a
          separate fact, and the fraction has already divided it out.
        </p>
      </div>
    </section>
  );
}
