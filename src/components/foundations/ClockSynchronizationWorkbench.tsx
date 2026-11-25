"use client";

import { useEffect, useId, useState } from "react";
import {
  CLOCK_READING_LIMITS,
  type ClockReadingField,
  type ClockReadingsDraft,
  type ClockSynchronization,
  type ClockSynchronizationRefusal,
  type ClockSynchronizationResult,
  clockReadingsDraft,
  INITIAL_CLOCK_SYNCHRONIZATION,
  readClockSynchronization,
  setClockByMidpoint,
  shiftClockReadings,
} from "../../foundations/clockSynchronization.ts";
import { sci } from "../../foundations/configurations.ts";
import { type HeadingLevel, headingTag } from "./headingLevel.ts";
import "./clockSynchronization.css";

const FIELDS = [
  { id: "leaves", label: "A when the flash leaves (seconds)" },
  { id: "reflection", label: "B when the flash reflects (seconds)" },
  { id: "returns", label: "A when the flash returns (seconds)" },
] as const;
const shown = (value: number) => sci(value, 8);

/** Event order is fixed. Changing a clock's display does not bend the path of the signal. */
function ClockExchangeDiagram({
  value,
  summary,
}: {
  readonly value: ClockSynchronization;
  readonly summary: string;
}) {
  return (
    <svg
      className="bridge-figure"
      viewBox="0 0 320 234"
      role="img"
      aria-label={`A signal exchange in one frame, with events ordered down the page rather than plotted on a time scale. The flash leaves A at ${shown(value.readings.leaves)} seconds, reflects when B displays ${shown(value.readings.reflection)} seconds, and returns to A at ${shown(value.readings.returns)} seconds. ${summary}`}
      data-clock-diagram="exchange"
    >
      <text className="bridge-axis-name" x="80" y="22" textAnchor="middle">
        clock A
      </text>
      <text className="bridge-axis-name" x="240" y="22" textAnchor="middle">
        clock B
      </text>
      <line className="bridge-axis" x1="80" y1="34" x2="80" y2="190" />
      <line className="bridge-axis" x1="240" y1="34" x2="240" y2="190" />
      <path
        className="bridge-arrow"
        d="M 80 52 L 233 111 M 240 114 L 87 173"
        data-clock-signal="path"
      />
      <path
        className="bridge-marker"
        d="M 240 114 L 230 105 L 226 115 Z M 80 176 L 94 177 L 90 167 Z"
      />
      {[
        [80, 52],
        [240, 114],
        [80, 176],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} className="bridge-dot" cx={x} cy={y} r="4" />
      ))}
      <text className="bridge-number" x="80" y="44" textAnchor="middle">
        leaves: {sci(value.readings.leaves, 5)}
      </text>
      <text className="bridge-number" x="240" y="143" textAnchor="middle">
        reflects: {sci(value.readings.reflection, 5)}
      </text>
      <text className="bridge-number" x="80" y="210" textAnchor="middle">
        returns: {sci(value.readings.returns, 5)}
      </text>
    </svg>
  );
}

export function ClockSynchronizationWorkbench({
  headingLevel = 3,
}: {
  readonly headingLevel?: HeadingLevel;
}) {
  const id = useId();
  const Title = headingTag(headingLevel, 1);
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(INITIAL_CLOCK_SYNCHRONIZATION);
  const [draft, setDraft] = useState<ClockReadingsDraft>({
    leaves: "0",
    reflection: "7",
    returns: "10",
  });
  const [error, setError] = useState<ClockSynchronizationRefusal | null>(null);
  useEffect(() => setReady(true), []);

  if (accepted.kind !== "accepted")
    return <p>The clock construction is unavailable. The worked figures remain readable.</p>;

  const value = accepted.synchronization;
  const pending = FIELDS.some((field) => draft[field.id] !== String(value.readings[field.id]));
  const summary = value.synchronized
    ? `B agrees with the midpoint rule: its reflection reading is ${shown(value.assignedReflection)} seconds. The assigned outward and return durations are each ${shown(value.assignedOutwardDuration)} seconds.`
    : `B is ${shown(value.discrepancy)} seconds ${value.offset > 0 ? "ahead of" : "behind"} the assigned reflection reading of ${shown(value.assignedReflection)} seconds. Set B ${value.offset > 0 ? "back" : "forward"} by ${shown(value.discrepancy)} seconds to apply the rule.`;

  function accept(result: ClockSynchronizationResult) {
    if (result.kind === "refused") {
      setError(result);
      return;
    }
    setAccepted(result);
    setDraft(clockReadingsDraft(result.synchronization));
    setError(null);
  }

  function update(field: ClockReadingField, reading: string) {
    setDraft((current) => ({ ...current, [field]: reading }));
    setError(null);
  }

  const rows = [
    ["origin", "Common offset added to the accepted clock origin", value.originOffset],
    ["departure", "A's departure reading", value.readings.leaves],
    ["reflection", "B's reflection reading", value.readings.reflection],
    ["return", "A's return reading", value.readings.returns],
    ["round-trip", "Round-trip duration, measured by A alone", value.roundTrip],
    ["midpoint", "Reflection reading assigned by the midpoint rule", value.assignedReflection],
    [
      "outward-difference",
      "B reflection minus A departure (different clocks)",
      value.outwardReadingDifference,
    ],
    [
      "return-difference",
      "A return minus B reflection (different clocks)",
      value.returnReadingDifference,
    ],
    ["offset", "B's offset from the assigned reflection reading", value.offset],
    ["correction", "Adjustment to B (add this to its reading)", value.correction],
    ["assigned-outward", "Outward duration assigned by the rule", value.assignedOutwardDuration],
    ["assigned-return", "Return duration assigned by the rule", value.assignedReturnDuration],
  ] as const;

  return (
    <section className="clock-synchronization" aria-labelledby={`${id}-title`}>
      <Title id={`${id}-title`}>Try it: set the distant clock</Title>
      <p>
        Choose the three clock readings from one flash sent out and back. A's two readings measure
        the round trip. The midpoint rule assigns B's reading at reflection. The clocks stand at
        rest in the same frame; no moving observer is introduced here.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          accept(readClockSynchronization(draft, value));
        }}
      >
        <fieldset className="construction-controls" disabled={!ready}>
          <legend>Choose the readings of the same signal</legend>
          <div className="clock-synchronization-fields">
            {FIELDS.map(({ id: field, label }) => {
              const invalid = error?.field === field;
              return (
                <label key={field} htmlFor={`${id}-${field}`}>
                  {label}
                  <input
                    id={`${id}-${field}`}
                    name={`clock-sync-${field}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={CLOCK_READING_LIMITS.textLength}
                    value={draft[field]}
                    aria-invalid={invalid || undefined}
                    aria-describedby={`${id}-help${invalid ? ` ${id}-error` : ""}`}
                    onInput={(event) => update(field, event.currentTarget.value)}
                  />
                </label>
              );
            })}
          </div>
          <p id={`${id}-help`} className="fine">
            Readings can be negative and run from −1000000 to 1000000 seconds. A's return must be
            later than its departure. B's unsynchronised reading can lie outside that interval.
            Apply all three readings together.
          </p>
          <div className="actions">
            <button type="submit">Apply clock readings</button>
            <button
              type="button"
              className="secondary"
              onClick={() => accept(setClockByMidpoint(value))}
            >
              Set B by the midpoint rule
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => accept(shiftClockReadings(value))}
            >
              Add 10 seconds to all readings
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => accept(INITIAL_CLOCK_SYNCHRONIZATION)}
            >
              Restore the first readings
            </button>
          </div>
          <p className="fine">
            Setting B keeps A's two accepted readings. Adding 10 changes the origin shared by the
            clocks and keeps the same interval calculations. These buttons use the accepted readings
            and replace unfinished edits. Applying new readings starts a new account with no added
            origin offset.
          </p>
        </fieldset>
      </form>
      {error ? (
        <p id={`${id}-error`} role="alert">
          {error.message} The drawing and table still show the last accepted clock readings.
        </p>
      ) : pending ? (
        <p className="fine">
          Changes are waiting. Apply the readings to update the drawing and table together.
        </p>
      ) : null}

      <div className="construction-display" data-clock-current="accepted">
        <p role="status" aria-live="polite" aria-atomic="true">
          {summary}
        </p>
        <ClockExchangeDiagram value={value} summary={summary} />
        <p className="fine">
          The drawing shows event order, not a time scale. Its clock labels are rounded to five
          significant digits. Setting B changes the display at reflection; the flash follows the
          same path.
        </p>
        <table className="data-table">
          <caption>
            The three readings and what the rule assigns, in seconds, rounded to eight significant
            digits
          </caption>
          <thead>
            <tr>
              <th scope="col">Reading or interval</th>
              <th scope="col">Seconds</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, label, number]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td data-clock-value={key}>{shown(number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {value.outwardReadingDifference < 0 || value.returnReadingDifference < 0 ? (
          <p>
            A negative difference between these different clocks is allowed before they agree. It
            describes their displays, not light travelling backwards in time.
          </p>
        ) : null}
        <p>
          Before setting B, subtracting one clock's reading from the other's does not measure a
          one-way travel time. The rule assigns equal outward and return durations, each half the
          round trip measured by A. It supplies synchronisation; it is not an independent
          measurement of the one-way speed of light.
        </p>
        <p className="fine">
          Decimal calculations can leave a tiny rounding difference. Setting B uses the computed
          midpoint exactly; no tolerance turns a nonzero difference into agreement. A common origin
          change retains that accepted comparison and its intervals.
        </p>
      </div>
    </section>
  );
}
