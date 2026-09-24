"use client";

import { useId, useState } from "react";
import { SPEED_SLIDER } from "../../foundations/boostMap.ts";
import { addTypedSpeeds } from "../../foundations/rapidityAdder.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/** Four decimals with a true minus sign, and no "−0.0000". */
function fmt(n: number): string {
  const text = Math.abs(n).toFixed(4);
  return n < 0 && Number(text) !== 0 ? `−${text}` : text;
}

/** One speed: a label, a typed field that commits on Enter or blur, and a slider that commits at once. */
function SpeedField({
  label,
  value,
  onCommit,
}: {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (next: string) => void;
}) {
  const labelId = useId(),
    fieldId = useId();
  const [draft, setDraft] = useState(value);
  const numeric = Number(value.replace(/−/g, "-").replace(",", "."));
  const thumb = Number.isFinite(numeric)
    ? Math.min(SPEED_SLIDER.max, Math.max(SPEED_SLIDER.min, numeric))
    : 0;
  const commit = (text: string) => {
    setDraft(text);
    onCommit(text);
  };
  return (
    <>
      <label id={labelId} htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(event.currentTarget.value);
          }
        }}
      />
      <input
        type="range"
        aria-labelledby={labelId}
        min={SPEED_SLIDER.min}
        max={SPEED_SLIDER.max}
        step={SPEED_SLIDER.step}
        value={thumb}
        onChange={(event) => commit(event.target.value)}
      />
    </>
  );
}

/**
 * The rapidity adder of foundation:hyperbolic-functions-rapidity. The arithmetic comes from
 * src/foundations/rapidityAdder.ts; this component only draws it.
 */
export function RapidityAdder({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [first, setFirst] = useState("0.6");
  const [second, setSecond] = useState("0.6");
  const outcome = addTypedSpeeds(first, second);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="hyperbolic-functions-rapidity"
    >
      <Title id={headingId} className="construction-title">
        Try it: adding speeds by adding rapidities
      </Title>
      <p>
        A frame moves at the first speed, and something moves at the second speed inside it, along
        the same line. Both are fractions of c. The readout adds their rapidities and turns the sum
        back into a speed.
      </p>

      <div className="construction-controls">
        <SpeedField label="First speed, v/c" value={first} onCommit={setFirst} />
        <SpeedField label="Second speed, w/c" value={second} onCommit={setSecond} />
        <p className="fine">
          Type a speed and press Enter, or drag a slider from −0.9 to 0.9. A minus sign means the
          other direction along the line.
        </p>
      </div>

      <div className="construction-display" role="status">
        {outcome.status === "added" ? (
          <>
            <p>
              Rapidities: {fmt(outcome.sum.firstRapidity)} + {fmt(outcome.sum.secondRapidity)} ={" "}
              {fmt(outcome.sum.rapiditySum)}.
            </p>
            <p>
              <strong>
                tanh({fmt(outcome.sum.rapiditySum)}) = {fmt(outcome.sum.combined)}: together the
                speeds make {fmt(outcome.sum.combined)}c.
              </strong>
            </p>
            <p>
              §5's rule, (v + w)/(1 + vw/c²), gives {fmt(outcome.sum.composition)} as well. Adding
              the speeds directly would give {fmt(outcome.sum.galilean)}c
              {Math.abs(outcome.sum.galilean) >= 1 ? ", at or beyond the speed of light." : "."}
            </p>
          </>
        ) : (
          <p className="construction-status">{outcome.message}</p>
        )}
      </div>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Each speed along a line has a rapidity, the number whose hyperbolic tangent is the speed
          as a fraction of c. Rapidities add: 0.6c and 0.6c have rapidities of 0.6931 each, their
          sum is 1.3863, and its hyperbolic tangent is 0.8824, the same 15c/17 that §5 of the
          relativity paper gives. Adding the speeds themselves would give 1.2c. Rapidity is a later
          aid, from 1910 and 1911, and it adds only along one line.
        </p>
      </div>
    </section>
  );
}
