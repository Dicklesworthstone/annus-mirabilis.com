"use client";

import { useId, useState } from "react";
import {
  CONVERSION_PAIRS,
  type ConversionOutcome,
  type ConversionSystem,
  convertForPair,
  convertTyped,
  EXACTNESS_NOTES,
  PRINTED_CONVERSIONS,
  SYSTEM_LABELS,
} from "../../foundations/unitConversions.ts";
import { Sci } from "../lab/Sci.tsx";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

const SYSTEMS: readonly ConversionSystem[] = ["mechanical", "electromagnetic", "electrostatic"];

/** One conversion as a sentence: 1.35 × 10⁻² P = 0.00135 Pa s, with a unit both sides share. */
function Converted({
  outcome,
  per,
}: {
  readonly outcome: Extract<ConversionOutcome, { status: "converted" }>;
  readonly per?: string | undefined;
}) {
  const tail = per ? ` ${per}` : "";
  return (
    <>
      <Sci value={outcome.input} digits={outcome.digits} /> {outcome.pair.fromSymbol}
      {tail} = <Sci value={outcome.value} digits={outcome.digits} /> {outcome.pair.toSymbol}
      {tail}
    </>
  );
}

/**
 * The conversion calculator of foundation:unit-system-1905. The arithmetic and every factor's
 * exact-or-conventional status come from src/foundations/unitConversions.ts, which reads them
 * from the site's unit table; this component only draws them.
 */
export function UnitConversionCalculator({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const headingId = useId(),
    inputId = useId(),
    hintId = useId(),
    pairFieldId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [text, setText] = useState("1.35e-2");
  const [pairId, setPairId] = useState("poise");
  const outcome = convertTyped(text, pairId);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="unit-system-1905"
    >
      <Title id={headingId} className="construction-title">
        Try it: converting a printed number
      </Title>
      <p>
        Type a number and choose the unit it was printed in. The calculator multiplies by a ratio
        equal to one, taken from the site's table of units, and says whether that ratio is exact or
        a convention.
      </p>

      <div className="construction-controls">
        <label htmlFor={inputId}>Number to convert</label>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={text}
          aria-describedby={hintId}
          onChange={(event) => setText(event.target.value)}
        />
        <p id={hintId} className="fine">
          Write 1.35e-2 or 1,35 · 10^-2. A comma is read as a decimal comma, as the papers print it.
        </p>
        <label htmlFor={pairFieldId}>Its unit, and the SI unit to convert to</label>
        <select id={pairFieldId} value={pairId} onChange={(event) => setPairId(event.target.value)}>
          {SYSTEMS.map((system) => (
            <optgroup key={system} label={SYSTEM_LABELS[system]}>
              {CONVERSION_PAIRS.filter((pair) => pair.system === system).map((pair) => (
                <option key={pair.id} value={pair.id}>
                  {pair.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="construction-display" role="status">
        {outcome.status === "converted" ? (
          <>
            <p>
              <strong>
                <Converted outcome={outcome} />
              </strong>
            </p>
            <p>
              Ratio used: 1 {outcome.pair.fromSymbol} ={" "}
              <Sci value={outcome.factor} digits={outcome.pair.factorDigits} />{" "}
              {outcome.pair.toSymbol}.
            </p>
            <p className="construction-status">{EXACTNESS_NOTES[outcome.exactness]}</p>
          </>
        ) : (
          <p className="construction-status">{outcome.message}</p>
        )}
      </div>

      <Sub>The papers' own numbers, converted</Sub>
      <ul>
        {PRINTED_CONVERSIONS.map((row) => {
          const converted = convertForPair(row.value, row.pairId, row.digits);
          return (
            <li key={row.id}>
              {row.quantity} ({row.source}):{" "}
              {converted.status === "converted" ? (
                <>
                  <Converted outcome={converted} per={row.per} />.{" "}
                  {converted.exactness === "exact" ? "Exact." : "Conventional."}
                </>
              ) : (
                converted.message
              )}
            </li>
          );
        })}
      </ul>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          A number printed in a CGS unit becomes an SI number when it is multiplied by a ratio equal
          to one. The mechanical ratios are exact. The electrical ratios are conventional, because
          they take the magnetic constant as exactly 4π × 10⁻⁷ H/m. The calculator converts units
          only: it never replaces a historical constant with a modern one.
        </p>
      </div>
    </section>
  );
}
