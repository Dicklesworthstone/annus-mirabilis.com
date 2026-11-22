import { useId } from "react";
import { statusMessage } from "../../../experiments/results/explanations.ts";
import { SR09_EVENTS, type Sr09Parameters } from "../../../experiments/sr09/definition.ts";
import type { AcceptedSnapshot } from "../../../experiments/store/instanceStore.ts";
import { display } from "../presentation.ts";

/** Only reads the accepted publication. An older worked example may lack these outputs. */
function numeric(snapshot: AcceptedSnapshot, outputId: string, index?: number): number | null {
  const output = snapshot.outputs.find((entry) => entry.quantityId === outputId);
  if (output?.status !== "value") return null;
  if (typeof output.value === "number") return index === undefined ? output.value : null;
  if (index === undefined || index < 0 || index >= output.value.length) return null;
  return output.value.at(index);
}

function Reading({
  snapshot,
  outputId,
  index,
  factor = 1,
}: {
  snapshot: AcceptedSnapshot;
  outputId: string;
  index?: number;
  factor?: number;
}) {
  const value = numeric(snapshot, outputId, index);
  const output = snapshot.outputs.find((entry) => entry.quantityId === outputId);
  const unavailable =
    output?.status === "outside-domain" || output?.status === "not-applicable"
      ? output.reason
      : output && output.status !== "value"
        ? statusMessage(output.status)
        : "Not included in this example.";
  return (
    <span data-output-id={outputId} data-output-index={index}>
      {value === null ? unavailable : display(value, factor)}
    </span>
  );
}

export function Sr09Observations({
  snapshot,
  ready,
  announcementsEnabled,
  onSelectEvent,
}: {
  snapshot: AcceptedSnapshot;
  ready: boolean;
  announcementsEnabled: boolean;
  onSelectEvent(eventId: string): void;
}) {
  const id = useId();
  const parameters = snapshot.parameters as Sr09Parameters;
  const selectedIndex = SR09_EVENTS.findIndex((event) => event.id === parameters.selectedEventId);
  const selectedEvent = SR09_EVENTS[selectedIndex];
  const agreement = numeric(snapshot, "namedEventPhaseAgreement", selectedIndex);
  const phaseK = numeric(snapshot, "namedEventPhases", selectedIndex * 2);
  const phaseMoving = numeric(snapshot, "namedEventPhases", selectedIndex * 2 + 1);
  const verdict =
    phaseK === null || phaseMoving === null || agreement === null
      ? "The phase comparison is unavailable in this snapshot."
      : agreement === 1
        ? "The two evaluations agree within 10⁻¹² radians."
        : "The two evaluations do not agree within 10⁻¹² radians.";

  return (
    <div data-sr09-observations="">
      <section aria-labelledby={`${id}-detector`}>
        <h3 id={`${id}-detector`}>A detector counts cycles with its own clock</h3>
        <table>
          <caption>
            {parameters.detectorMotion === "rest-in-K"
              ? "Detector at rest in the stationary frame K."
              : parameters.detectorMotion === "rest-in-k"
                ? "Detector at rest in the selected moving frame k."
                : "Detector with a custom speed measured in K."}
          </caption>
          <tbody>
            <tr>
              <th scope="row">Detector speed in K (fraction of c)</th>
              <td>
                <Reading snapshot={snapshot} outputId="detectorSpeedK" />
              </td>
            </tr>
            <tr>
              <th scope="row">Counting window in K (fs)</th>
              <td>
                <Reading snapshot={snapshot} outputId="countingWindowK" factor={1e15} />
              </td>
            </tr>
            <tr>
              <th scope="row">Elapsed time on the detector (fs)</th>
              <td>
                <Reading snapshot={snapshot} outputId="detectorProperWindow" factor={1e15} />
              </td>
            </tr>
            <tr>
              <th scope="row">Accumulated wave cycles</th>
              <td>
                <Reading snapshot={snapshot} outputId="detectorCrossings" />
              </td>
            </tr>
            <tr>
              <th scope="row">Rate on the detector’s clock (THz)</th>
              <td>
                <Reading snapshot={snapshot} outputId="detectorProperRateHz" factor={1e-12} />
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          The counting window is a duration in K, entered as a number of source periods. The
          detector’s elapsed time is a different duration. Accumulated cycles measure the phase
          advance along the detector’s path; fractional cycles are retained, not rounded to an
          integer tally of crests. One femtosecond (fs) is 10⁻¹⁵ seconds.
        </p>
        <p>
          A detector at rest in k measures the wave frequency shown for k. A detector at rest in K
          or at a custom speed has its own rate. Keep that detector fixed while changing the
          observer, and its count and clock rate stay the same.
        </p>
      </section>

      <section aria-labelledby={`${id}-phase`}>
        <h3 id={`${id}-phase`}>Does the same event have the same phase?</h3>
        <p>
          These are two fixed events on the same wave, not events picked again when the observer
          changes. Their coordinates change between K and k. Each phase is evaluated from the wave
          and event in that frame, without reducing the result modulo a full turn.
        </p>
        <fieldset disabled={!ready}>
          <legend>Choose an event for the phase query</legend>
          {SR09_EVENTS.map((event) => (
            <label className="check" key={event.id} htmlFor={`${id}-${event.id}`}>
              <input
                id={`${id}-${event.id}`}
                name={`${id}-phase-event`}
                type="radio"
                value={event.id}
                checked={parameters.selectedEventId === event.id}
                onChange={() => onSelectEvent(event.id)}
              />{" "}
              {event.label}
            </label>
          ))}
        </fieldset>
        <p
          role="status"
          aria-live={announcementsEnabled ? "polite" : "off"}
          aria-atomic="true"
          data-phase-query=""
          data-selected-event-id={parameters.selectedEventId}
        >
          {selectedEvent ? `${selectedEvent.label}: ` : "Selected event unavailable. "}
          {phaseK !== null && phaseMoving !== null
            ? `phase in K ${display(phaseK)} rad; phase in k ${display(phaseMoving)} rad. `
            : ""}
          {verdict}
        </p>
        {SR09_EVENTS.map((event, eventIndex) => (
          <section
            key={event.id}
            className="table-scroll"
            aria-label={`${event.label} coordinate and phase table`}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll to any event-table columns outside this narrow region.
            tabIndex={0}
          >
            <table data-event-id={event.id}>
              <caption>{event.label} — the same event described twice</caption>
              <thead>
                <tr>
                  <th scope="col">Frame</th>
                  <th scope="col">Time (fs)</th>
                  <th scope="col">x (nm)</th>
                  <th scope="col">Phase (rad)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "K", time: "namedEventTimesK", position: "namedEventPositionsK" },
                  {
                    label: "k",
                    time: "namedEventTimesMoving",
                    position: "namedEventPositionsMoving",
                  },
                ].map((frame, frameIndex) => (
                  <tr key={frame.label}>
                    <th scope="row" style={{ width: "auto" }}>
                      {frame.label}
                    </th>
                    <td>
                      <Reading
                        snapshot={snapshot}
                        outputId={frame.time}
                        index={eventIndex}
                        factor={1e15}
                      />
                    </td>
                    <td>
                      <Reading
                        snapshot={snapshot}
                        outputId={frame.position}
                        index={eventIndex * 3}
                        factor={1e9}
                      />
                    </td>
                    <td>
                      <Reading
                        snapshot={snapshot}
                        outputId="namedEventPhases"
                        index={eventIndex * 2 + frameIndex}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        <p className="fine">
          Both events have y = z = 0 in both frames. Positions are in nanometres (nm), or 10⁻⁹
          metres. Agreement is a check of this model’s transformation, not an independent
          measurement of light.
        </p>
      </section>
    </div>
  );
}
