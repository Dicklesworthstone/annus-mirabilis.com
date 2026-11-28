import { useEffect, useMemo, useState } from "react";
import type { Lq05ExperimentView } from "../../../experiments/lq05/session.ts";
import { GroupedOccupancy } from "../../../reasoning/independence/GroupedOccupancy.tsx";
import {
  type SampledOccupancySource,
  sampledOccupancyState,
} from "../../../reasoning/independence/state.ts";
import "../../../reasoning/independence/independence.css";

export function OccupancySample({
  view,
  source,
}: {
  view: Lq05ExperimentView;
  source: SampledOccupancySource;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const sample = view.evaluation.sampling;
  const comparison = useMemo(() => sampledOccupancyState(sample, source), [sample, source]);
  const label = source === "worked-sample" ? "Worked-example sample" : "Accepted simulation sample";
  return (
    <section
      className="occupancy-workbench"
      aria-label="Simulated occupancy counts"
      data-occupancy-source={source}
      data-occupancy-run={view.accepted.runId}
      data-occupancy-allocation={sample.allocationId}
    >
      <h3>How many points landed inside?</h3>
      <p>
        {label} for {sample.n} {view.accepted.parameters.locked ? "locked" : "independent"} points
        in a fraction {sample.f} of the volume. Each of the {sample.trials} simulated placements
        contributes once to the table.
      </p>
      <details>
        <summary>Counts for all {sample.trials} placements</summary>
        <table>
          <caption>
            {label} with seed {sample.seed}
          </caption>
          <thead>
            <tr>
              <th scope="col">Points inside</th>
              <th scope="col">Placements</th>
            </tr>
          </thead>
          <tbody>
            {sample.occupancyCounts.map((count, k) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: K is the measured integer count.
              <tr key={k} data-occupancy-k={k}>
                <th scope="row">{k}</th>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="fine">
          Random stream <code>{sample.allocationId}</code>, seed {sample.seed}, draws consumed{" "}
          {sample.drawCountAfter - sample.drawCountBefore}.
        </p>
      </details>
      {comparison ? (
        <GroupedOccupancy state={comparison} ready={ready} />
      ) : (
        <p className="fine">
          To compare groupings, use at most 12 points and 10,000 trials, and choose one quarter, one
          half, three quarters or the whole volume. The table shows the counts at your settings.
        </p>
      )}
    </section>
  );
}
