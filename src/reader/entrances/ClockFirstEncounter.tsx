"use client";

import type { FormEvent } from "react";
import { useEffect, useId, useState } from "react";
import type { EntranceRecord } from "../../content/entrances/entranceRecord.ts";
import {
  CLOCK_INITIAL,
  CLOCK_WORKED_EXAMPLES,
  type ClockExample,
  clockExample,
  parseClockDraft,
} from "./clockExample.ts";
import "./countingEntrance.css";

/**
 * No tabIndex on the table container. Measured against the built site, it never overflows,
 * so a tab stop here would be a stop with nothing to scroll: 320px 288/288 and 1280px
 * 780/780 scrollWidth over clientWidth. `encounter-table` is not one of the
 * AUDITED_SCROLL_CLASSES in src/testing/a11y/scrollableRegions.test.ts, so this is a
 * removal that satisfies both that ratchet and a11y/noNoninteractiveTabindex (am-6iz4).
 *
 * A plain div, not a named section: the table renders three times with one label, which made
 * three landmarks of the same name (axe landmark-unique). Each table's caption names it.
 */
function ClockTable({ example, agreed }: { example: ClockExample; agreed: boolean }) {
  return (
    <div className="encounter-table">
      <table>
        <caption>
          Readings in seconds. The distant entry is an assignment, not a local observation at A.
        </caption>
        <thead>
          <tr>
            <th scope="col">Event and whose reading it is</th>
            <th scope="col">Reading</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Flash leaves A: A’s clock</th>
            <td>{example.readings.departure}</td>
          </tr>
          <tr>
            <th scope="row">Flash reflects at B: proposed assignment to B’s clock</th>
            <td data-reflection-reading>
              {agreed ? example.assigned : "Not assigned before an agreement"}
            </td>
          </tr>
          <tr>
            <th scope="row">Flash returns to A: A’s clock</th>
            <td>{example.readings.reception}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** No choice gates the worked route. The exact same accepted record drives every representation. */
export function ClockFirstEncounter({ record }: { record: EntranceRecord }) {
  const id = useId();
  const [ready, setReady] = useState(false);
  const [example, setExample] = useState(CLOCK_INITIAL);
  const [departure, setDeparture] = useState("0");
  const [reception, setReception] = useState("10");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setReady(true);
  }, []);
  const sliderAvailable =
    example.elapsed >= 2 && example.elapsed <= 40 && example.readings.departure <= 1e6 - 40;
  const dirty =
    departure !== String(example.readings.departure) ||
    reception !== String(example.readings.reception);
  function accept(next: ClockExample) {
    setExample(next);
    setDeparture(String(next.readings.departure));
    setReception(String(next.readings.reception));
    setError("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const result = parseClockDraft(departure, reception);
    if (result.kind === "refused") setError(result.message);
    else accept(result.example);
  }
  return (
    <section
      id="entry-special-relativity"
      tabIndex={-1}
      className="reader-passage clock-entrance"
      data-encounter-id={record.id}
      aria-labelledby={`${id}-title`}
    >
      <p className="eyebrow">First encounter · No algebra required</p>
      <h2 id={`${id}-title`}>{record.question}</h2>
      <p>{record.story}</p>
      <p className="notice">
        An authored clock-setting example. The readings below are not experimental evidence.
      </p>
      {/* No table before the question. One stood here, and its middle row, "Not assigned before
          an agreement", answered "What would you say?" before the reader was asked; the story
          above already gives the two readings. The first table follows the choices. */}
      <h3>What would you say?</h3>
      <p>Open any answer to examine its assumptions. Nothing must be answered to continue.</p>
      {record.choices?.map((choice) => (
        <details key={choice.id} data-clock-choice>
          <summary>{choice.text}</summary>
          <p>{choice.explanation}</p>
        </details>
      ))}
      <section aria-labelledby={`${id}-agreement`}>
        <h3 id={`${id}-agreement`}>State the agreement before assigning the reading</h3>
        <p>{record.agreement}</p>
        <fieldset disabled={!ready}>
          <legend>Choose whether to use the equal-travel-time agreement</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            Use this agreement for the example below
          </label>
        </fieldset>
        <form onSubmit={submit}>
          <fieldset disabled={!ready}>
            <legend>Change the two local readings, in seconds</legend>
            <label htmlFor={`${id}-departure`}>Departure at A</label>{" "}
            <input
              id={`${id}-departure`}
              type="text"
              inputMode="decimal"
              value={departure}
              onChange={(event) => setDeparture(event.target.value)}
            />
            <label htmlFor={`${id}-reception`}>Return to A</label>{" "}
            <input
              id={`${id}-reception`}
              type="text"
              inputMode="decimal"
              value={reception}
              onChange={(event) => setReception(event.target.value)}
            />
            <button type="submit">Apply readings</button>
          </fieldset>
        </form>
        {dirty && (
          <p data-clock-draft>
            Draft readings have not been applied. The table and laboratory link still use the
            accepted example.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {sliderAvailable ? (
          <fieldset disabled={!ready}>
            <legend>Or adjust the accepted round-trip duration</legend>
            <label htmlFor={`${id}-elapsed`}>Seconds from departure to return</label>{" "}
            <input
              id={`${id}-elapsed`}
              type="range"
              min="2"
              max="40"
              step="any"
              value={example.elapsed}
              onChange={(event) => {
                const result = clockExample({
                  departure: example.readings.departure,
                  reception: example.readings.departure + Number(event.target.value),
                });
                if (result.kind === "ready") accept(result.example);
                else setError(result.message);
              }}
            />
            <p className="fine">
              The slider offers durations from 2 to 40 seconds. The editable readings above also
              admit other durations.
            </p>
          </fieldset>
        ) : (
          <p>
            The accepted duration is outside this slider’s range. Use the editable readings to
            change it; no value has been clamped.
          </p>
        )}
        <div data-clock-accepted>
          <ClockTable example={example} agreed={agreed} />
        </div>
        <p role="status" aria-live="polite" aria-atomic="true" data-clock-announcement>
          Leaves at {example.readings.departure}, returns at {example.readings.reception}.
          {agreed
            ? ` Reflection assigned ${example.assigned} under the equal-travel-time agreement.`
            : " No distant reading has been assigned because no agreement is selected."}
        </p>
        <figure>
          <svg
            viewBox="0 0 320 145"
            role="img"
            aria-label={`The outward flash goes from A to B and the reflected flash comes back to A. ${agreed ? `B is assigned ${example.assigned}.` : "B has no assigned reading yet."}`}
          >
            <text x="30" y="24" textAnchor="middle">
              A
            </text>
            <text x="290" y="24" textAnchor="middle">
              B
            </text>
            <path
              d="M30 50 H290 M280 43 L290 50 L280 57 M290 90 H30 M40 83 L30 90 L40 97"
              fill="none"
              stroke="currentColor"
            />
            <text x="160" y="42" textAnchor="middle">
              Outward flash
            </text>
            <text x="160" y="115" textAnchor="middle">
              Returning flash
            </text>
          </svg>
          <figcaption>
            A path sketch, not a scale drawing or an animation measuring travel time. The complete
            readings are in the table.
          </figcaption>
        </figure>
        <p>
          <a data-current-clock-lab href={example.labHref}>
            Load the accepted round trip in the clock laboratory →
          </a>
        </p>
        <p className="fine">
          The laboratory uses the stated agreement and an ideal stationary separation that
          reproduces this round trip. No measured separation or independently measured one-way speed
          is inferred here.
        </p>
      </section>
      <section aria-labelledby={`${id}-worked`}>
        <h3 id={`${id}-worked`}>The whole worked route, without controls</h3>
        <p>{record.consistencyCase} Both tables here use the equal-travel-time agreement.</p>
        {CLOCK_WORKED_EXAMPLES.map((item) => (
          <section key={item.readings.departure} data-clock-worked>
            <h4>
              Leaves at {item.readings.departure}, returns at {item.readings.reception}
            </h4>
            <ClockTable example={item} agreed />
          </section>
        ))}
        <p>
          In the first example, the reflection is assigned {CLOCK_INITIAL.assigned} while its
          returning signal reaches A at {CLOCK_INITIAL.readings.reception}. Those are different
          events. In the second, the reflection is assigned {CLOCK_WORKED_EXAMPLES[1]!.assigned} and
          the signal returns at {CLOCK_WORKED_EXAMPLES[1]!.readings.reception}.
        </p>
      </section>
      <details>
        <summary>What is getting in the way?</summary>
        {record.helpEntries.map((entry) => (
          <section key={entry.obstacle}>
            <h4>{entry.obstacle}</h4>
            <p>{entry.clarification}</p>
          </section>
        ))}
        <p>
          <a href={`#${id}-worked`}>Show me the second flash again →</a>
        </p>
      </details>
      <section className="entrance-bridge" aria-labelledby={`${id}-bridge`}>
        <h3 id={`${id}-bridge`}>Next: another pair of clocks glides past</h3>
        <p>
          Suppose a moving pair of stations uses the same agreement with its own flashes. Will it
          agree with us about which distant events happen at the same moment?
        </p>
        <p>{record.bridge.newSkill}</p>
        <p>{record.bridge.whyUsefulHere}</p>
        <p>
          <a
            href="/foundations/frames-events/"
            data-foundation="frames-events"
            data-return-caption="Back to the first encounter: the reading assigned to the reflection at B."
          >
            More guidance: an event is not the moment you see it →
          </a>
        </p>
        <p>
          <a href={example.movingPairHref}>
            Compare a pair moving at sixty percent of light speed →
          </a>
        </p>
        <p>
          <a href="/papers/special-relativity/s1/#arg-sr-synchronization">
            Continue to the section 1 clock-setting argument →
          </a>
        </p>
      </section>
    </section>
  );
}
