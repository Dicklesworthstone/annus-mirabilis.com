"use client";

import { useId, useState } from "react";
import {
  amount,
  DISTANCES,
  FORCES,
  ledger,
  MASSES,
  START_SPEEDS,
  ZEROS,
} from "../../foundations/energyLedger.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

function Choice({
  legend,
  values,
  value,
  unit,
  onChoose,
}: {
  legend: string;
  values: readonly number[];
  value: number;
  unit: string;
  onChoose: (v: number) => void;
}) {
  return (
    <fieldset className="button-group">
      <legend className="fine">{legend}</legend>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          className={v === value ? undefined : "secondary"}
          aria-pressed={v === value}
          onClick={() => onChoose(v)}
        >
          {amount(v)} {unit}
        </button>
      ))}
    </fieldset>
  );
}

/**
 * The work-energy lesson's construction: a before-and-after ledger. The arithmetic is
 * src/foundations/energyLedger.ts; this component lays out its rows.
 */
export function EnergyLedger({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [mass, setMass] = useState(3);
  const [startSpeed, setStartSpeed] = useState(0);
  const [force, setForce] = useState(3);
  const [distance, setDistance] = useState(2);
  const [zero, setZero] = useState(0);
  const row = ledger({ mass, startSpeed, force, distance, zero });
  const counted = zero === 0 ? "from zero" : `from ${amount(zero)} J`;

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="work-energy"
    >
      <Title id={headingId} className="construction-title">
        Try it: a before-and-after ledger
      </Title>
      <p>
        A steady push along the motion does work equal to the force times the distance, and the work
        becomes energy of motion. Choose the body, how fast it is already going, and the push. The
        last choice changes where every energy is counted from.
      </p>

      <div className="construction-controls">
        <Choice legend="Mass" values={MASSES} value={mass} unit="kg" onChoose={setMass} />
        <Choice
          legend="Speed before the push"
          values={START_SPEEDS}
          value={startSpeed}
          unit="m/s"
          onChoose={setStartSpeed}
        />
        <Choice legend="Force" values={FORCES} value={force} unit="N" onChoose={setForce} />
        <Choice
          legend="Distance pushed"
          values={DISTANCES}
          value={distance}
          unit="m"
          onChoose={setDistance}
        />
        <Choice
          legend="Count every energy from"
          values={ZEROS}
          value={zero}
          unit="J"
          onChoose={setZero}
        />
      </div>

      <div className="construction-display" role="status">
        <p>
          <strong>
            The push does {amount(force)} N × {amount(distance)} m = {amount(row.work)} J of work,
            and the {amount(mass)} kg body goes from {amount(startSpeed)} to{" "}
            {amount(row.speedAfter)} m/s.
          </strong>{" "}
          {zero === 0
            ? "Its energy of motion rises by exactly the work."
            : `Counted from ${amount(zero)} J, both totals are ${amount(zero)} J larger, and the work, the energy of motion and the speed are unchanged.`}
        </p>
      </div>

      <table className="data-table">
        <caption>The ledger, in joules</caption>
        <thead>
          <tr>
            <th scope="col">Entry</th>
            <th scope="col">Energy of motion</th>
            <th scope="col">Counted {counted}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Before the push, ½mv²</th>
            <td>{amount(row.before)}</td>
            <td>{amount(row.countedBefore)}</td>
          </tr>
          <tr>
            <th scope="row">Work done, F × d</th>
            <td>+ {amount(row.work)}</td>
            <td>+ {amount(row.work)}</td>
          </tr>
          <tr>
            <th scope="row">After the push</th>
            <td>{amount(row.after)}</td>
            <td>{amount(row.countedAfter)}</td>
          </tr>
        </tbody>
      </table>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          A push of 3 N through 2 m does 6 J of work. A 3 kg body starting at rest ends with 6 J of
          energy of motion, which at ½mv² is a speed of 2 m/s, the lesson's worked example read the
          other way. From rest, doubling the distance doubles the work but raises the speed only by
          a factor of √2, about 1.41, because energy of motion grows with the square of the speed.
          Counting every energy from 100 J or from a million joules changes both totals by the same
          amount and changes no difference, so nothing that can be measured changes. That is why a
          comparison of energies gives a difference in mass, and never the total energy stored
          inside a body.
        </p>
      </div>
    </section>
  );
}
