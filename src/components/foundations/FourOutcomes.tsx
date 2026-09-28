import { useId } from "react";
import { type Half, outcomes, TOKENS } from "../../foundations/bridgeFigures.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The picture foundation:bridge-probability-notation counts out and does not show (dispatch 409).
 *
 * The lesson's first paragraph lists the four outcomes of dropping two tokens into a box and says
 * one of the four is both left. Four boxes are that count drawn, and what a reader gets from seeing
 * them is the step the sentence cannot force: left-then-right and right-then-left are two outcomes
 * and not one, which is why the denominator is four rather than three.
 *
 * The boxes come from `outcomes(TOKENS)` rather than from four hand-placed drawings, so the figure
 * cannot show a different number of outcomes than the arithmetic the lesson quotes.
 *
 * The favoured outcome is marked twice over and never by colour alone: a wash behind it and a
 * filled triangle beneath it. Which box it is, and which half is which, are also said in the words
 * underneath, because a box is 60 viewBox units wide and a caption naming an outcome does not fit
 * inside one: at this figure's drawn width a label of that length would run off the left edge.
 *
 * A SECOND PANEL WAS TRIED AND DROPPED, and the reason is a measurement rather than a preference.
 * The lesson's second paragraph contrasts 23 of 100 with a quarter of 100, and a bar drawn for it
 * puts those two marks about 5 viewBox units apart: at this figure's drawn width, 22rem against a
 * 300-unit viewBox, that is about 6 px. A reader cannot see a difference of 6 px, so the drawing
 * would have shown the two numbers as the same at exactly the point the lesson says they differ.
 * The sentence does that job and the picture would have undone it.
 */

const W = 300,
  H = 104;
const BOX_W = 60,
  BOX_H = 44,
  GAP = 12;
const BOX_Y = 28;
const TOKEN_R = 7;
const MARGIN = (W - (BOX_W * 4 + GAP * 3)) / 2;

/**
 * One outcome's tokens, each carrying the ordinal the drawing stacks it by: the first token is
 * drawn above the second, and that order is what tells left-then-right from right-then-left. The
 * ordinal is the token's identity rather than its position in a list, which is also why the keys
 * below do not read an array index.
 */
const tokensOf = (outcome: readonly Half[]) =>
  outcome.map((half, index) => ({ ordinal: index + 1, half }));

export function FourOutcomes({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const all = outcomes(TOKENS);
  const favoured = all.findIndex((o) => o.every((half) => half === "left"));

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="bridge-probability-notation"
    >
      <Title id={headingId} className="construction-title">
        Every way two tokens can land
      </Title>
      <p>
        Each box is one way the drop can come out, with the first token above the second. There are{" "}
        {all.length} boxes because a box divides in two and there are {TOKENS} tokens, and the
        shaded one is the single outcome with both tokens on the left.
      </p>

      <svg
        className="bridge-figure"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${all.length} boxes in a row, each divided into a left half and a right half and each holding two tokens: both left, left then right, right then left, and both right. The first box, the one with both tokens in the left half, is shaded and marked beneath with a filled triangle. The other ${all.length - 1} are unmarked.`}
      >
        <text className="bridge-number" x={MARGIN + BOX_W / 4} y={BOX_Y - 8} textAnchor="middle">
          left
        </text>
        <text
          className="bridge-number"
          x={MARGIN + (BOX_W * 3) / 4}
          y={BOX_Y - 8}
          textAnchor="middle"
        >
          right
        </text>
        {all.map((outcome, i) => {
          const x = MARGIN + i * (BOX_W + GAP);
          const middle = x + BOX_W / 2;
          const isFavoured = i === favoured;
          return (
            <g key={outcome.join("-")}>
              {isFavoured && (
                <rect className="bridge-bar-share" x={x} y={BOX_Y} width={BOX_W} height={BOX_H} />
              )}
              <rect className="bridge-bar-whole" x={x} y={BOX_Y} width={BOX_W} height={BOX_H} />
              <line className="bridge-grid" x1={middle} y1={BOX_Y} x2={middle} y2={BOX_Y + BOX_H} />
              {tokensOf(outcome).map(({ ordinal, half }) => (
                <circle
                  key={`token-${ordinal}`}
                  className="bridge-dot-moved"
                  cx={half === "left" ? x + BOX_W / 4 : x + (BOX_W * 3) / 4}
                  cy={BOX_Y + 13 + (ordinal - 1) * 18}
                  r={TOKEN_R}
                />
              ))}
              {isFavoured && (
                <polygon
                  className="bridge-marker"
                  points={`${middle - 6},${BOX_Y + BOX_H + 12} ${middle + 6},${BOX_Y + BOX_H + 12} ${middle},${BOX_Y + BOX_H + 2}`}
                />
              )}
            </g>
          );
        })}
        <text className="bridge-number" x={W / 2} y={H - 4} textAnchor="middle">
          one of the {all.length}
        </text>
      </svg>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The {all.length} boxes, from the left, are: both tokens left; the first left and the
          second right; the first right and the second left; both right. They are equally likely,
          and counting them is the whole of where one in {all.length} comes from. The middle two are
          the ones a reader is most likely to collapse into one, and the drawing keeps them apart:
          the tokens are in a different order, and either order is a way the drop can happen.
        </p>
        <p>
          The drawing is about one drop, and says nothing about how a run of drops will come out.
          How often both land left over a hundred drops is a different number, counted rather than
          reasoned, and the paragraph above it says so.
        </p>
      </div>
    </section>
  );
}
