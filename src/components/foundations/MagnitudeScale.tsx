"use client";

import { type CSSProperties, useId, useState } from "react";
import {
  compare,
  enclosingDecades,
  MAGNITUDE_FAMILIES,
  type MagnitudeFamily,
  type MagnitudeItem,
  positionOnScale,
} from "../../foundations/magnitudes.ts";
import { Sci } from "../lab/Sci.tsx";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

type FamilyId = MagnitudeFamily["id"];

const DEFAULT_PAIRS: Readonly<Record<FamilyId, readonly [string, string]>> = {
  sizes: ["water-molecule", "grain"],
  speeds: ["jet", "earth"],
};

const MINUS = "−";
const power = (n: number) => (n < 0 ? `${MINUS}${-n}` : String(n));

/** A ratio as a reader says it: 3,300 times, or 1.2 × 10⁴ once it is long. */
function Ratio({ value }: { readonly value: number }) {
  if (value >= 1e5) return <Sci value={value} digits={1} />;
  return <>{Number(value.toPrecision(2)).toLocaleString("en-US")}</>;
}

const find = (family: MagnitudeFamily, id: string): MagnitudeItem =>
  family.items.find((item) => item.id === id) ?? (family.items[0] as MagnitudeItem);

/**
 * The log scale of foundation:orders-of-magnitude. Values, positions and comparisons come from
 * src/foundations/magnitudes.ts; this component only draws them. Each number has its own row and
 * its own line of powers of ten, so two values a fraction of a power apart never overlap, and the
 * rows themselves are the table equivalent.
 */
export function MagnitudeScale({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    firstId = useId(),
    secondId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [familyId, setFamilyId] = useState<FamilyId>("sizes");
  const [pairs, setPairs] = useState(DEFAULT_PAIRS);
  const [zoomed, setZoomed] = useState(false);

  const family =
    MAGNITUDE_FAMILIES.find((f) => f.id === familyId) ?? (MAGNITUDE_FAMILIES[0] as MagnitudeFamily);
  const [firstChoice, secondChoice] = pairs[family.id];
  const first = find(family, firstChoice);
  const second = find(family, secondChoice);
  const comparison = compare(first, second);
  const range = enclosingDecades(
    zoomed ? [first.value, second.value] : family.items.map((item) => item.value),
  );
  const unit = family.unit ? ` ${family.unit}` : "";
  const choose = (slot: 0 | 1, id: string) =>
    setPairs((current) => {
      const next: [string, string] = [...current[family.id]];
      next[slot] = id;
      return { ...current, [family.id]: next };
    });

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="orders-of-magnitude"
    >
      <Title id={headingId} className="construction-title">
        Try it: placing numbers on a scale of powers of ten
      </Title>
      <p>
        Each line below runs from one power of ten to another, with a tick at every factor of ten.
        Pick two numbers to compare them, and zoom the lines to the stretch between them.
      </p>

      <div className="construction-controls">
        <div className="button-group">
          {MAGNITUDE_FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              className={f.id === familyId ? undefined : "secondary"}
              aria-pressed={f.id === familyId}
              onClick={() => {
                setFamilyId(f.id);
                setZoomed(false);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label htmlFor={firstId}>Compare</label>
        <select id={firstId} value={first.id} onChange={(event) => choose(0, event.target.value)}>
          {family.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <label htmlFor={secondId}>with</label>
        <select id={secondId} value={second.id} onChange={(event) => choose(1, event.target.value)}>
          {family.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="construction-display" role="status">
        {comparison.larger.id === comparison.smaller.id ? (
          <p>Those are the same number. Pick two different ones to compare.</p>
        ) : (
          <p>
            {comparison.larger.label} is <Ratio value={comparison.ratio} /> times{" "}
            {comparison.smaller.label.charAt(0).toLowerCase() + comparison.smaller.label.slice(1)}:{" "}
            {comparison.powers.toFixed(1)} powers of ten apart.
          </p>
        )}
        <button type="button" className="secondary" onClick={() => setZoomed((z) => !z)}>
          {zoomed ? "Show the whole range" : "Zoom to these two"}
        </button>
      </div>

      <Sub>
        {family.label}, {zoomed ? "zoomed to the two compared" : "the whole range"}
      </Sub>
      <p className="fine">
        Each line runs from 10<sup>{power(range.low)}</sup> at the left to 10
        <sup>{power(range.high)}</sup> at the right, measuring {family.axis}. Each tick is ten times
        the one before.
      </p>
      <ol className="magnitude-rows">
        {family.items.map((item) => {
          const at = positionOnScale(item.value, range);
          return (
            <li key={item.id}>
              {item.label}: <Sci value={item.value} digits={1} />
              {unit}
              {at === null ? (
                <span className="fine"> (outside this view)</span>
              ) : (
                <span
                  className="magnitude-track"
                  aria-hidden="true"
                  style={{ "--decades": range.high - range.low } as CSSProperties}
                >
                  <span className="magnitude-dot" style={{ left: `${at * 100}%` }} />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          On a scale of powers of ten, equal steps are equal factors of ten. A water molecule and a
          Brownian grain sit three and a half powers of ten apart: the grain is about 3,300 times
          larger. The Earth's speed is about a ten-thousandth of the speed of light, and its square,
          the size of relativity's corrections, is a hundred million times smaller than one.
          Kaufmann's fast electrons are not placed here: the site holds no dataset for their speeds
          yet.
        </p>
      </div>
    </section>
  );
}
