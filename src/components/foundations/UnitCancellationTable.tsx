"use client";

import { type ReactNode, useId, useState } from "react";
import {
  BASE_UNITS,
  CANCELLATION_FORMULAS,
  type CancellationFormula,
  checkFormula,
  type Dimensions,
  type Factor,
  PLACEMENT_WORDS,
} from "../../foundations/unitCancellation.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

const MINUS = "−";

/** Each formula drawn with real sub- and superscripts, which a menu option cannot hold. */
export const FORMULA_DISPLAY: Readonly<Record<string, ReactNode>> = {
  diffusivity: (
    <>
      D = k<sub>B</sub>T/(6πηa)
    </>
  ),
  "diffusivity-no-radius": (
    <>
      k<sub>B</sub>T/(6πη)
    </>
  ),
  spread: <>λ = √(2Dt)</>,
  "spread-no-root": <>2Dt</>,
  quantum: <>E = hν</>,
  "mass-energy": (
    <>
      L/V<sup>2</sup>
    </>
  ),
};

/**
 * Base units with raised powers: kg m<sup>2</sup> s<sup>−2</sup>. Exponents are markup, not the
 * superscript characters, which the reading faces do not all carry (src/units/scientific.ts).
 */
function BaseUnits({ dimensions }: { readonly dimensions: Dimensions }) {
  const parts = BASE_UNITS.filter((unit) => dimensions[unit] !== 0);
  if (parts.length === 0) return <>no units</>;
  return (
    <>
      {parts.map((unit, i) => {
        const power = dimensions[unit];
        const text = Number.isInteger(power) ? String(Math.abs(power)) : `${Math.abs(power) * 2}/2`;
        return (
          <span key={unit}>
            {i > 0 ? " " : ""}
            {unit}
            {power !== 1 && (
              <sup>
                {power < 0 ? MINUS : ""}
                {text}
              </sup>
            )}
          </span>
        );
      })}
    </>
  );
}

/** The base units as plain text, "kg m2 s-2", to tell whether a factor's unit already is one. */
const plainBaseUnits = (dimensions: Dimensions): string =>
  BASE_UNITS.filter((unit) => dimensions[unit] !== 0)
    .map((unit) => (dimensions[unit] === 1 ? unit : `${unit}${dimensions[unit]}`))
    .join(" ");

function FactorSymbol({ factor }: { readonly factor: Factor }) {
  return (
    <strong>
      {factor.symbol}
      {factor.subscript && <sub>{factor.subscript}</sub>}
    </strong>
  );
}

const find = (id: string): CancellationFormula =>
  CANCELLATION_FORMULAS.find((f) => f.id === id) ??
  (CANCELLATION_FORMULAS[0] as CancellationFormula);

/**
 * The unit-cancellation table of foundation:quantities-units. The formulas and the arithmetic of
 * powers come from src/foundations/unitCancellation.ts; this component only draws them.
 */
export function UnitCancellationTable({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const headingId = useId(),
    pickId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [formulaId, setFormulaId] = useState("diffusivity");
  const formula = find(formulaId);
  const { result, agrees } = checkFormula(formula);
  const quantity = formula.quantity.charAt(0).toUpperCase() + formula.quantity.slice(1);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="quantities-units"
    >
      <Title id={headingId} className="construction-title">
        Try it: cancelling units
      </Title>
      <p>
        Choose a formula. Each factor is written in the base units kilogram, metre, second and
        kelvin, the powers are added, and the sum is compared with the units the result must have.
        Two of the formulas are wrong on purpose.
      </p>

      <div className="construction-controls">
        <label htmlFor={pickId}>Formula</label>
        <select
          id={pickId}
          value={formula.id}
          onChange={(event) => setFormulaId(event.target.value)}
        >
          {CANCELLATION_FORMULAS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <p>
        <strong>{FORMULA_DISPLAY[formula.id]}</strong>
      </p>
      <ul>
        {formula.factors.map((factor) => (
          <li key={`${factor.symbol}-${factor.placement}`}>
            <FactorSymbol factor={factor} />, {factor.name}
            {factor.placement === "number" ? (
              <>, is {PLACEMENT_WORDS.number}.</>
            ) : (
              <>
                : {factor.unit}
                {plainBaseUnits(factor.dimensions) === factor.unit ? (
                  ", "
                ) : (
                  <>
                    , which is <BaseUnits dimensions={factor.dimensions} />,{" "}
                  </>
                )}
                {PLACEMENT_WORDS[factor.placement]}.
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="construction-display" role="status">
        <p>
          Adding the powers gives <BaseUnits dimensions={result} />. {quantity} must be{" "}
          <BaseUnits dimensions={formula.expected} />:{" "}
          {agrees ? (
            <strong>the units agree.</strong>
          ) : (
            <strong>the units disagree, so the formula is wrong.</strong>
          )}
        </p>
        {formula.fault && <p className="construction-status">{formula.fault}</p>}
      </div>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          A formula's units can be checked without any numbers: write every factor in kilograms,
          metres, seconds and kelvins, add the powers of the factors on top, subtract those
          underneath, and halve those under a square root. The Stokes-Einstein diffusion coefficient
          comes out in square metres per second. Leave out the radius and a metre too many survives;
          leave off the square root in the spread and the result is an area, not a length. The check
          catches both slips, but it cannot catch a wrong pure number such as 6π.
        </p>
      </div>
    </section>
  );
}
