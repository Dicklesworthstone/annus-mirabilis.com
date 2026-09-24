"use client";

import { type CSSProperties, useId, useState } from "react";
import {
  COVERAGE,
  DEFAULT_SEED,
  DEGREES_CHOICES,
  drawRepeatedIntervals,
  ROWS_DRAWN,
  TRIAL_CHOICES,
  TRUE_DIFFUSIVITY,
} from "../../foundations/repeatedIntervals.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";

/**
 * A new seed, only on the reader's explicit request, and then shown: AGENTS.md lets ambient entropy
 * choose a seed only through a "new trial" action, and never through Math.random.
 */
function freshSeed(): string {
  const words = new BigUint64Array(1);
  crypto.getRandomValues(words);
  return (words[0] ?? 0n).toString();
}

const at = (value: number, max: number): string => `${Math.min(100, (value / max) * 100)}%`;

/**
 * The repeated-experiment view of the error-and-inference lesson. The draws and the intervals come
 * from src/foundations/repeatedIntervals.ts; this component only draws them. An interval that
 * misses is drawn hollow and says "misses" in words, so colour is never the only channel.
 */
export function RepeatedIntervals({ headingLevel = 3 }: { readonly headingLevel?: HeadingLevel }) {
  const headingId = useId(),
    Title = headingTag(headingLevel),
    Sub = headingTag(headingLevel, 1);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [trials, setTrials] = useState<number>(TRIAL_CHOICES[0]);
  const [q, setQ] = useState<number>(DEGREES_CHOICES[0]);
  const outcome = drawRepeatedIntervals({ seed, q, trials });
  const percent = Math.round(COVERAGE * 100);

  const rows = outcome.status === "drawn" ? outcome.intervals.slice(0, ROWS_DRAWN) : [];
  const axisMax = Math.max(1, Math.ceil(Math.max(0, ...rows.map((r) => r.upper)) * 2) / 2);

  return (
    <section
      className="foundation-construction"
      aria-labelledby={headingId}
      data-foundation-construction="error-and-inference"
    >
      <Title id={headingId} className="construction-title">
        Try it: many experiments, many intervals
      </Title>
      <p>
        A made-up generator produces particle paths with a diffusion coefficient of{" "}
        {TRUE_DIFFUSIVITY} μm²/s. Each experiment estimates it from q squared displacements and
        forms the {percent} per cent interval. Count how many of the intervals catch the value the
        generator used.
      </p>

      <div className="construction-controls">
        <div className="button-group">
          {TRIAL_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              className={n === trials ? undefined : "secondary"}
              aria-pressed={n === trials}
              onClick={() => setTrials(n)}
            >
              {n} experiments
            </button>
          ))}
        </div>
        <div className="button-group">
          {DEGREES_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              className={n === q ? undefined : "secondary"}
              aria-pressed={n === q}
              onClick={() => setQ(n)}
            >
              q = {n}
            </button>
          ))}
        </div>
        <div className="button-group">
          <button type="button" className="secondary" onClick={() => setSeed(freshSeed())}>
            Draw a new set
          </button>
        </div>
      </div>

      <div className="construction-display" role="status">
        {outcome.status === "drawn" ? (
          <>
            <p>
              <strong>
                {outcome.covered} of {outcome.trials} intervals cover {TRUE_DIFFUSIVITY} μm²/s.
              </strong>{" "}
              The procedure promises {percent} of every 100 in the long run; a set of{" "}
              {outcome.trials} can land a little above or below that.
            </p>
            <p className="fine">
              Seed {outcome.seed}, q = {outcome.q}.
            </p>
          </>
        ) : (
          <p className="construction-status">{outcome.message}</p>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <Sub>
            {outcome.status === "drawn" && outcome.trials > ROWS_DRAWN
              ? `The first ${ROWS_DRAWN} of ${outcome.trials} experiments`
              : `All ${rows.length} experiments`}
          </Sub>
          <p className="fine">
            Each line runs from 0 at the left to {axisMax} μm²/s at the right. The upright mark is{" "}
            {TRUE_DIFFUSIVITY}, the value the generator used.
          </p>
          <ol className="magnitude-rows">
            {rows.map((r) => (
              <li key={r.index}>
                Experiment {r.index}: {r.lower.toFixed(3)} to {r.upper.toFixed(3)} μm²/s,{" "}
                {r.covers ? "covers" : <strong>misses</strong>}
                <span className="interval-track" aria-hidden="true">
                  <span
                    className="interval-truth"
                    style={{ left: at(TRUE_DIFFUSIVITY, axisMax) }}
                  />
                  <span
                    className={r.covers ? "interval-bar" : "interval-bar interval-bar-miss"}
                    style={
                      {
                        left: at(r.lower, axisMax),
                        width: `calc(${at(r.upper, axisMax)} - ${at(r.lower, axisMax)})`,
                      } as CSSProperties
                    }
                  />
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="construction-text-equivalent">
        <Sub>What it shows, in words</Sub>
        <p>
          Every experiment gives a different interval, because every sample is different. The value
          the generator used never moves; the intervals move around it. Over many experiments about{" "}
          {percent} in 100 intervals cover it and the rest miss, which is all the {percent} per cent
          promises. With q = 10 the intervals are much wider than with q = 100, and the promise is
          the same. The data here are made up, so the view tests the procedure, not molecules.
        </p>
      </div>
    </section>
  );
}
