"use client";

import { useId, useState } from "react";
import {
  MOMENTUM_FACTOR,
  POWERS,
  PRINTED_ONE_WATT_MANTISSA,
  pushNewtons,
  type Surface,
} from "../../foundations/lightPush.ts";
import { Sci } from "../lab/Sci.tsx";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * The one thing foundation:momentum-energy-light asks a reader to try (dispatch 468).
 *
 * The lesson is a chain of arithmetic with nothing to set: a beam of 1 W lands on a surface, its
 * momentum per second is 1/c, and "the push is 3.34 × 10⁻⁹ N", with a mirror receiving twice as
 * much because it reverses the momentum. Both are relations, and the page stated them and gave a
 * reader nothing to change.
 *
 * THE QUESTION IT ANSWERS: how hard does a beam of light push, and what does the surface have to
 * do with it? THE OBSERVABLE RESPONSE: the push in newtons, which moves with the power and doubles
 * the moment the surface becomes a mirror. THE OWNER: src/foundations/lightPush.ts, which takes
 * the speed of light from the waves owner's constant set; nothing is computed here.
 *
 * THE NONVISUAL EQUIVALENT is not an afterthought and is why the typed field exists: the power can
 * be typed as an exact number rather than chosen from the buttons, and the closing paragraph
 * states the relation and the current reading in words, so a reader who never sees the readout can
 * still set a value and learn what it does.
 */

export function PushOfLight({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    fieldId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [watts, setWatts] = useState<number>(POWERS[0]);
  const [typed, setTyped] = useState<string>(String(POWERS[0]));
  const [surface, setSurface] = useState<Surface>("absorbs");

  const push = pushNewtons(watts, surface);
  const other: Surface = surface === "absorbs" ? "reflects" : "absorbs";
  const setPower = (next: number) => {
    setWatts(next);
    setTyped(String(next));
  };

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="momentum-energy-light"
    >
      <Title id={headingId} className="construction-title">
        Try it: how hard the beam pushes
      </Title>
      <p>
        Set the power of the beam and say what the surface does with it. The push is the momentum
        the light delivers each second.
      </p>

      <div className="construction-controls">
        <fieldset className="button-group">
          <legend className="fine">Power of the beam</legend>
          {POWERS.map((p) => (
            <button
              key={p}
              type="button"
              className={p === watts ? undefined : "secondary"}
              aria-pressed={p === watts}
              onClick={() => setPower(p)}
            >
              {p} W
            </button>
          ))}
        </fieldset>
        <p className="fine">
          <label htmlFor={fieldId}>Or type a power, in watts: </label>
          <input
            id={fieldId}
            type="number"
            min="0"
            step="any"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
              const next = Number(event.target.value);
              if (Number.isFinite(next) && next >= 0) setWatts(next);
            }}
          />
        </p>
        <fieldset className="button-group">
          <legend className="fine">The surface</legend>
          {(["absorbs", "reflects"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={s === surface ? undefined : "secondary"}
              aria-pressed={s === surface}
              onClick={() => setSurface(s)}
            >
              {s === "absorbs" ? "absorbs the light" : "sends it straight back"}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="construction-display" role="status">
        <p>
          <strong>
            A beam of {watts} W on a surface that {surface === "absorbs" ? "absorbs" : "reflects"}{" "}
            it pushes with <Sci value={push} digits={4} /> newtons.
          </strong>{" "}
          A surface that {other === "absorbs" ? "absorbed" : "sent it straight back"} instead would
          feel <Sci value={pushNewtons(watts, other)} digits={4} /> N, a factor of{" "}
          {MOMENTUM_FACTOR.reflects / MOMENTUM_FACTOR.absorbs}.
        </p>
      </div>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          The push is the power divided by the speed of light, and a mirror receives twice as much
          because it reverses the light's momentum instead of merely stopping it. At the setting
          above, {watts} watts on a surface that{" "}
          {surface === "absorbs" ? "absorbs the light" : "sends it straight back"}, the push is{" "}
          <Sci value={push} digits={4} /> newtons. Doubling the power doubles the push, and
          switching between the two surfaces changes it by exactly a factor of{" "}
          {MOMENTUM_FACTOR.reflects / MOMENTUM_FACTOR.absorbs}, at any power.
        </p>
        <p>
          One watt absorbed gives about {PRINTED_ONE_WATT_MANTISSA} × 10⁻⁹ newtons, which is the
          number the lesson prints and why the push went unnoticed for so long.
        </p>
        <p>
          What it does not show: the surface is at rest and stays at rest. A mirror that is moving
          changes the light's frequency as well as its direction, which is §8 of the relativity
          paper and a harder problem than this; nothing here bears on it. Nor does it say anything
          about how the momentum gets there, only how much arrives each second.
        </p>
      </div>
    </section>
  );
}
