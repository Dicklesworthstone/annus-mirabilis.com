"use client";

import { useId, useState } from "react";
import {
  type Arrangement,
  configurations,
  describeMagnitude,
  GRAM_MOLECULE,
  PARTICLE_CHOICES,
  SQUEEZES,
  type Squeeze,
  sci,
} from "../../foundations/configurations.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/** Keep a number's "× 10⁻²³" on the line its mantissa is on. */
const together = (s: string) => s.replace(/ × /g, " × ");

const BOX_WIDTH = 80;
const BOX_HEIGHT = 36;

/** The cell each particle is in, as a reader would say it for this squeeze. */
function cellName(cell: number, squeeze: Squeeze): string {
  if (squeeze.cells === 2) return cell === 1 ? "left" : "right";
  return squeeze.cells === 4 ? `quarter ${cell}` : `tenth ${cell}`;
}

/** The short form printed under a card: L and R for halves, the cell number otherwise. */
function cellMark(cell: number, squeeze: Squeeze): string {
  if (squeeze.cells === 2) return cell === 1 ? "L" : "R";
  return String(cell);
}

function ArrangementCard({ arrangement, squeeze }: { arrangement: Arrangement; squeeze: Squeeze }) {
  const width = BOX_WIDTH / squeeze.cells;
  const perCell = new Map<number, number>();
  const dots = arrangement.cells.map((cell, particle) => {
    const slot = perCell.get(cell) ?? 0;
    perCell.set(cell, slot + 1);
    return { particle, cell, slot };
  });
  const label = `${arrangement.cells
    .map((cell, i) => `particle ${i + 1} in the ${cellName(cell, squeeze)}`)
    .join(", ")}${arrangement.inside ? ": all inside" : ""}`;
  return (
    <li className={arrangement.inside ? "config-card config-card-inside" : "config-card"}>
      <svg
        className="config-box"
        viewBox={`0 0 ${BOX_WIDTH} ${BOX_HEIGHT}`}
        role="img"
        aria-label={label}
      >
        <rect
          className="config-kept"
          x={0}
          y={0}
          width={width * squeeze.kept}
          height={BOX_HEIGHT}
        />
        {Array.from({ length: squeeze.cells }, (_, i) => i + 1).map((cell) => (
          <rect
            key={cell}
            className="config-cell"
            x={(cell - 1) * width}
            y={0}
            width={width}
            height={BOX_HEIGHT}
          />
        ))}
        {dots.map(({ particle, cell, slot }) => {
          const count = perCell.get(cell) ?? 1;
          return (
            <circle
              key={particle}
              className="config-particle"
              cx={(cell - 1) * width + (width * (slot + 1)) / (count + 1)}
              cy={BOX_HEIGHT / 2}
              r={Math.min(3.5, width / (count + 1) / 2.2)}
            />
          );
        })}
      </svg>
      <span className="config-mark">
        {arrangement.cells.map((cell) => cellMark(cell, squeeze)).join(" ")}
      </span>
      {arrangement.inside && <span className="config-inside-note">all inside</span>}
    </li>
  );
}

/**
 * The entropy-multiplicity lesson's construction. The counts, W, ln W and the entropy change come
 * from src/foundations/configurations.ts; this component only lays them out.
 */
export function ConfigurationCounter({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [n, setN] = useState(4);
  const [squeezeIndex, setSqueezeIndex] = useState(0);
  const squeeze = SQUEEZES[squeezeIndex] as Squeeze;
  const state = configurations(n, squeeze);
  const ratio = `${squeeze.kept}/${squeeze.cells}`;
  const mole = n === GRAM_MOLECULE;
  const everyOne =
    n === 1 ? "the particle" : n === 2 ? "both" : mole ? "every one of them" : `all ${n}`;

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="entropy-multiplicity"
    >
      <Title id={headingId} className="construction-title">
        Try it: counting arrangements
      </Title>
      <p>
        Cut the box into equal parts and let each particle land in any part with the same chance,
        whatever the others do. Every arrangement is then as likely as every other, and the
        probability of a state is the share of arrangements that produce it. Choose how many
        particles, and how much of the box they must all be found in.
      </p>

      <div className="construction-controls">
        <fieldset className="button-group">
          <legend className="fine">How many particles</legend>
          {PARTICLE_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={choice === n ? undefined : "secondary"}
              aria-pressed={choice === n}
              onClick={() => setN(choice)}
            >
              {choice === GRAM_MOLECULE ? "a gram-molecule" : choice}
            </button>
          ))}
        </fieldset>
        <fieldset className="button-group">
          <legend className="fine">All of them in</legend>
          {SQUEEZES.map((s, i) => (
            <button
              key={s.name}
              type="button"
              className={i === squeezeIndex ? undefined : "secondary"}
              aria-pressed={i === squeezeIndex}
              onClick={() => setSqueezeIndex(i)}
            >
              {s.name}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="construction-display" role="status">
        <p>
          <strong>
            Of {together(describeMagnitude(state.total))} equally likely arrangements,{" "}
            {together(describeMagnitude(state.favourable))} put {everyOne} in {squeeze.part}.
          </strong>{" "}
          So W&nbsp;=&nbsp;({ratio}){mole ? together(" to the power 6.02 × 10²³") : <sup>{n}</sup>}{" "}
          = {together(describeMagnitude(state.probability))}.
        </p>
        <p>
          ln&nbsp;W = {mole ? together("6.02 × 10²³") : n} × ln({ratio}) ={" "}
          {together(sci(state.lnW))}, so the entropy changes by S&nbsp;−&nbsp;S₀ = k<sub>B</sub>
          &nbsp;ln&nbsp;W = {together(sci(state.entropyChange))} joules per kelvin
          {mole ? ", which for a gram-molecule is R ln(v/v₀)" : ""}.
        </p>
      </div>

      {state.listing && state.splits ? (
        <>
          <p>
            Under each box, the marks say where particle 1, particle 2 and so on are, in that order.
            {n > 1
              ? " The same picture can come up more than once, because the particles are told apart: particle 1 alone outside and particle 2 alone outside are two different arrangements."
              : ""}
          </p>
          <table className="data-table config-splits">
            <caption>How many arrangements give each count in {squeeze.part}</caption>
            <thead>
              <tr>
                <th scope="col">Particles in {squeeze.part}</th>
                <th scope="col">Arrangements</th>
              </tr>
            </thead>
            <tbody>
              {state.splits.map((split) => (
                <tr key={split.inside}>
                  <td>{split.inside === n && n > 1 ? `all ${n}` : split.inside}</td>
                  <td>{split.arrangements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {state.listing ? (
        <ul className="config-cards" aria-label={`All ${state.listing.length} arrangements`}>
          {state.listing.map((arrangement) => (
            <ArrangementCard
              key={arrangement.cells.join("-")}
              arrangement={arrangement}
              squeeze={squeeze}
            />
          ))}
        </ul>
      ) : (
        <p className="construction-status">
          The arrangements are drawn one by one only when there are at most 16 of them. Here there
          are {describeMagnitude(state.total)}.
        </p>
      )}

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          With four particles and the box cut in half there are 16 arrangements, and one of them has
          all four on the left, so W = 1/16. Each particle adds a factor of ½ to W and adds ln ½,
          about −0.693, to ln W: the chances multiply and their logarithms add. Two on each side
          comes up in 6 of the 16 arrangements, more than any other split, which is why particles
          left to themselves are found spread out. At a hundred particles W is about 8 × 10⁻³¹. For
          a gram-molecule W cannot be written as a decimal at all, yet the entropy change is an
          ordinary number, R ln ½, about −5.76 joules per kelvin. Squeezing into nine tenths of the
          box lowers the entropy less, but for a gram-molecule it is still a state that is possible
          but never seen.
        </p>
      </div>
    </section>
  );
}
