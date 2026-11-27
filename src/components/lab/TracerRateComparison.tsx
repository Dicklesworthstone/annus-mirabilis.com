import {
  recordedSampleIndex,
  recordingTimeAfter,
} from "../../experiments/playback/recordingClock.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { array, display } from "./presentation.ts";

export const TRACER_PLAYBACK_RATES = [1, 25] as const;

/** The same first tracer and sample-and-hold rule as the plot, readable without a running clock. */
export function TracerRateComparison({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const times = array(snapshot, "traceTimes");
  const coordinates = array(snapshot, "traceCoordinates");
  const duration = times.at(times.length - 1);
  const fastFinish = duration / TRACER_PLAYBACK_RATES[1];
  const moments = [...new Set([0, fastFinish / 2, fastFinish, duration])];
  return (
    <details>
      <summary>Compare normal and fast playback without animation</summary>
      <table>
        <caption>
          Tracer 1 in the same recording. Each cell gives the last recorded sample time and its (x,
          y) position in micrometres.
        </caption>
        <thead>
          <tr>
            <th scope="col">Elapsed playback time</th>
            {TRACER_PLAYBACK_RATES.map((rate) => (
              <th key={rate} scope="col">{rate}× playback</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {moments.map((elapsed) => (
            <tr key={elapsed}>
              <th scope="row">{display(elapsed)} s</th>
              {TRACER_PLAYBACK_RATES.map((rate) => {
                const sample = recordedSampleIndex(times, recordingTimeAfter(elapsed, rate, duration));
                return (
                  <td key={rate}>
                    {display(times.at(sample))} s · ({display(coordinates.at(2 * sample), 1e6)},{" "}
                    {display(coordinates.at(2 * sample + 1), 1e6)}) μm
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p>Both views hold the final recorded position once they reach it.</p>
    </details>
  );
}
