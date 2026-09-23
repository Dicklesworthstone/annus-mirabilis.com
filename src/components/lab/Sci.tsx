/**
 * A power of ten, drawn the way a printed page draws it: 2.070974 × 10⁻²⁰, with the
 * exponent raised by markup in the surrounding face. Replaces `toExponential` output
 * in the laboratories; see src/units/scientific.ts for why, and for the digit rules.
 *
 * The group is named with a spoken form, because "10" followed by a raised "−20" is
 * otherwise read aloud as "10 minus 20", which is a different number. The name is an
 * `aria-label` on an image-role span rather than visually hidden text, so that
 * `textContent` and `innerText` stay the number a reader sees: the browser lanes read
 * `[data-output]` cells as text, and a copied selection should not carry a spelling.
 */

import {
  exponentialParts,
  exponentialSpoken,
  naturalLogSpoken,
  partsFromNaturalLog,
} from "../../units/scientific.ts";
import "./sci.css";

interface SciProps {
  readonly value: number;
  /** The same argument `toExponential` took at this call site. */
  readonly digits?: number | undefined;
}

export function Sci({ value, digits }: SciProps) {
  const parts = exponentialParts(value, digits);
  if (parts.kind === "plain") return <span className="sci">{parts.text}</span>;
  return (
    <span className="sci" role="img" aria-label={exponentialSpoken(value, digits)}>
      {parts.mantissa}
      {" × "}10<sup>{parts.exponent}</sup>
    </span>
  );
}

/**
 * A number known only through its natural logarithm, because it lies outside double precision,
 * drawn like every other number on the page: 3.215 × 10⁻⁴⁰⁰, or, when even the exponent is too long
 * for a mantissa to be meaningful, 10 raised to −4.168 × 10²⁸⁵. See partsFromNaturalLog.
 */
export function SciFromLn({ ln, digits }: { readonly ln: number; readonly digits?: number }) {
  const parts = partsFromNaturalLog(ln, digits);
  const label = naturalLogSpoken(ln, digits);
  if (parts.kind === "scientific")
    return (
      <span className="sci" role="img" aria-label={label}>
        {parts.mantissa}
        {" × "}10<sup>{parts.exponent}</sup>
      </span>
    );
  const e = parts.exponent;
  return (
    <span className="sci" role="img" aria-label={label}>
      10
      <sup>
        {e.kind === "plain" ? (
          e.text
        ) : (
          <>
            {e.mantissa}
            {" × "}10<sup>{e.exponent}</sup>
          </>
        )}
      </sup>
    </span>
  );
}

/**
 * A bare power of ten whose exponent is itself a measured number, e.g. a probability
 * reported only through its logarithm: 10 raised to −123.4567. Was printed "10^(−123.4567)".
 */
export function PowerOfTen({
  exponent,
  digits,
}: {
  readonly exponent: number;
  readonly digits: number;
}) {
  const text = exponent.toFixed(digits).replace(/^-/, "−");
  return (
    <span className="sci" role="img" aria-label={`10 to the power ${text.replace("−", "minus ")}`}>
      10<sup>{text}</sup>
    </span>
  );
}

/**
 * The same number inside an SVG `<text>`. `<sup>` does not exist there, so the exponent
 * is a smaller tspan lifted by `dy`, followed by an empty-width tspan that drops the
 * baseline back, so text after the number continues on the line it started on.
 * (`baseline-shift` would be neater but is not honoured on tspan by every engine.)
 *
 * The two `dy` values are equal in PARENT ems, not in their own: an em on the exponent
 * tspan is 0.75 of the parent's, so its -0.5em lifts 0.375 parent em, and the reset
 * tspan, at the parent's size, drops exactly 0.375em.
 */
export function SciSvg({ value, digits }: SciProps) {
  const parts = exponentialParts(value, digits);
  if (parts.kind === "plain") return <>{parts.text}</>;
  return (
    <>
      {parts.mantissa}
      {" × "}10
      <tspan dy="-0.5em" fontSize="0.75em">
        {parts.exponent}
      </tspan>
      <tspan dy="0.375em">{"​"}</tspan>
    </>
  );
}

/**
 * A subscript inside an SVG `<text>`, where `<sub>` does not exist: "E" then a lowered "y". As in
 * SciSvg, the lowered tspan is at 0.75 of the parent size, so its 0.25em drop is 0.1875 parent em,
 * and the empty reset tspan at the parent's size lifts exactly that much, so text after the
 * subscript continues on the line it started on. Programmer notation (E_y, k_B) is what this
 * replaces in the laboratories' drawings.
 */
export function SubSvg({ children }: { readonly children: string }) {
  return (
    <>
      <tspan dy="0.25em" fontSize="0.75em">
        {children}
      </tspan>
      <tspan dy="-0.1875em">{"\u200b"}</tspan>
    </>
  );
}
