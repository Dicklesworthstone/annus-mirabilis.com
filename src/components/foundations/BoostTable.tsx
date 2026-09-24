"use client";

import { useId, useState } from "react";
import { boostTyped, type MapKind, SPEED_SLIDER } from "../../foundations/boostMap.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/** Three decimals, trailing zeros dropped, a true minus sign, and no "−0". */
function fmt(n: number): string {
  const rounded = Number(n.toFixed(3));
  if (rounded === 0) return "0";
  return rounded < 0 ? `−${String(-rounded)}` : String(rounded);
}

/** One term of a row: "1.25 x", or plain "x" when the multiplier is exactly one. */
function term(coefficient: number, variable: string): string {
  const size = Math.abs(coefficient);
  return fmt(size) === "1" ? variable : `${fmt(size)} ${variable}`;
}

/** "1.25 x − 0.75 t": a row of the table written as the sum it stands for. */
function row(a: number, b: number, first: string, second: string): string {
  const parts: string[] = [];
  for (const [coefficient, variable] of [
    [a, first],
    [b, second],
  ] as const) {
    if (fmt(coefficient) === "0") continue;
    const sign = coefficient < 0 ? "−" : "+";
    const body = term(coefficient, variable);
    parts.push(parts.length === 0 ? (sign === "−" ? `−${body}` : body) : `${sign} ${body}`);
  }
  return parts.length === 0 ? "0" : parts.join(" ");
}

/**
 * The first two events share t = 0 in the old frame, and the first is the origin, so the second
 * event's t′ is the gap between them in the new frame.
 */
function simultaneity(gap: number): string {
  const lead = "The first two events happen at the same moment in the old frame.";
  if (fmt(gap) === "0") return `${lead} In the new frame they still do.`;
  const when = gap < 0 ? "earlier" : "later";
  return `${lead} In the new frame the one 10 light-seconds away happens ${fmt(Math.abs(gap))} seconds ${when} than the one at the origin.`;
}

const MAPS: readonly { readonly kind: MapKind; readonly label: string }[] = [
  { kind: "relativistic", label: "Relativistic" },
  { kind: "galilean", label: "Galilean" },
];

/**
 * The event-table transformer of foundation:matrices-linear-maps. The map and its readouts come
 * from src/foundations/boostMap.ts; this component only draws them. The typed field commits on
 * Enter or when it loses focus; the slider commits at once.
 */
export function BoostTable({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    labelId = useId(),
    fieldId = useId(),
    hintId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [draft, setDraft] = useState("0.6");
  const [committed, setCommitted] = useState("0.6");
  const [kind, setKind] = useState<MapKind>("relativistic");
  const outcome = boostTyped(committed, kind);
  const commit = (text: string) => {
    setDraft(text);
    setCommitted(text);
  };
  const thumb =
    outcome.status === "mapped"
      ? Math.min(SPEED_SLIDER.max, Math.max(SPEED_SLIDER.min, outcome.table.speedRatio))
      : 0;

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="matrices-linear-maps"
    >
      <Title id={headingId} className="construction-title">
        Try it: a change of frame as a table of multipliers
      </Title>
      <p>
        Choose the speed of the new frame as a fraction of c, and which rule to use. The table turns
        four events, measured in light-seconds and seconds, into the new frame's numbers.
      </p>

      <div className="construction-controls">
        <div className="button-group">
          {MAPS.map((m) => (
            <button
              key={m.kind}
              type="button"
              className={m.kind === kind ? undefined : "secondary"}
              aria-pressed={m.kind === kind}
              onClick={() => setKind(m.kind)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label id={labelId} htmlFor={fieldId}>
          Speed of the new frame, v/c
        </label>
        <input
          id={fieldId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          aria-describedby={hintId}
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
        <p id={hintId} className="fine">
          Type a speed and press Enter, or drag the slider from −0.9 to 0.9. A minus sign means the
          frame moves the other way.
        </p>
      </div>

      <div className="construction-display" role="status">
        {outcome.status === "mapped" ? (
          <>
            <p>
              <strong>x′ = {row(outcome.table.p, outcome.table.q, "x", "t")}</strong>
              <br />
              <strong>t′ = {row(outcome.table.r, outcome.table.s, "x", "t")}</strong>
            </p>
            <p>
              {kind === "relativistic" ? `γ = ${fmt(outcome.table.factor)}. ` : ""}
              Determinant {fmt(outcome.table.determinant)}.{" "}
              {outcome.table.keepsForwardLight && outcome.table.stretch
                ? `A flash from the origin still moves at c in the new frame, and the two light lines are stretched by ${fmt(outcome.table.stretch.forward)} and ${fmt(outcome.table.stretch.backward)}.`
                : `A flash from the origin now moves at ${fmt(1 - outcome.table.speedRatio)} light-seconds per second, not at c.`}
            </p>
          </>
        ) : (
          <p className="construction-status">{outcome.message}</p>
        )}
      </div>

      {outcome.status === "mapped" && (
        <>
          <Sub>Four events, before and after</Sub>
          <ul>
            {outcome.table.transformed.map((e) => (
              <li key={e.id}>
                {e.label}: (x, t) = ({fmt(e.x)}, {fmt(e.t)}) becomes (x′, t′) = ({fmt(e.xPrime)},{" "}
                {fmt(e.tPrime)}).
              </li>
            ))}
          </ul>
          <p>{simultaneity(outcome.table.transformed[1]?.tPrime ?? 0)}</p>
        </>
      )}

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Each row of the table makes one new coordinate from the old ones by multiplying and
          adding. For the relativistic rule at 0.6c the factor γ is 1.25, the determinant is 1, and
          a flash of light still moves at c in the new frame; two events that were simultaneous are
          7.5 seconds apart. The Galilean rule also has determinant 1 and keeps simultaneous events
          simultaneous, but it changes the speed of the flash. Writing the change of frame as a
          table is a later aid: the 1905 paper writes it as two equations.
        </p>
      </div>
    </section>
  );
}
