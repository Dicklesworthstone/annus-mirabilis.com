"use client";

import { useId, useMemo, useState } from "react";
import { CHECK_LABELS, compareGroupedOccupancy, type OccupancyState } from "./state.ts";

function grouping(sizes: readonly number[]) {
  return sizes.join(" + ");
}

function digits(number: number) {
  return Number(number.toPrecision(8)).toString();
}

export function GroupedOccupancy({
  state,
  ready,
  anchorId,
}: {
  state: OccupancyState;
  ready: boolean;
  anchorId?: string;
}) {
  const id = useId();
  const { comparison, checks, evidence } = state;
  const sampled =
    state.evidenceSource === "accepted-sample" || state.evidenceSource === "worked-sample";
  const recordName =
    state.evidenceSource === "worked-sample"
      ? "worked-example sample"
      : state.evidenceSource === "accepted-sample"
        ? "accepted simulation record"
        : state.evidenceSource === "illustrative"
          ? "illustration"
          : "accepted record";
  const candidates = useMemo(
    () => compareGroupedOccupancy(comparison.settings, checks, evidence?.counts),
    [comparison.settings, checks, evidence],
  );
  const [selection, setSelection] = useState("");
  const chosen =
    candidates.find((item) => grouping(item.groups) === selection) ??
    candidates.find((item) => item.groups.every((size) => size === 2)) ??
    candidates.find((item) => item.groups.length > 1 && item.groups.some((size) => size > 1)) ??
    candidates[0];
  if (!chosen) return null;
  const matches = candidates.filter((item) => item.matchesIndependent).length;
  const possible = candidates.filter((item) => item.relativeLogLikelihood !== null).length;

  return (
    <details className="occupancy-grouped" id={anchorId}>
      <summary>Could some of the points be moving in groups?</summary>
      <p>
        Suppose each group stays together at one position, and each group chooses its position
        independently. A group of two adds either two points or zero to the count. Which groupings
        could you distinguish using the same volume and the same observations?
      </p>
      <p data-group-matches>
        {matches} of {candidates.length} possible groupings give the same predictions as separate
        points for{" "}
        {sampled
          ? "the all-inside probability and count variance"
          : checks.length
            ? "the measurements you selected above"
            : "the empty set of measurements"}
        .{checks.length === 0 && " Select a measurement above to narrow the comparison."}
      </p>
      {evidence && (
        <p data-group-evidence>
          {possible} of {candidates.length} groupings can produce the {evidence.trials}-placement{" "}
          {recordName}.
          {possible > 0
            ? " A relative log likelihood of zero marks the best fit among these candidates. Negative values give the log likelihood relative to that fit. Several groupings can still be possible."
            : " Every grouping assigns zero probability to at least one observed count. Check the assumptions about the volume, grouping and counting."}
        </p>
      )}
      <section
        className="occupancy-table-scroll"
        aria-label="Predictions for every grouping"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the horizontally scrollable results table needs keyboard access
        tabIndex={0}
      >
        <table>
          <caption>
            Group sizes for {comparison.settings.n} points in a region occupying{" "}
            {comparison.settings.quarters}/4 of the volume
          </caption>
          <thead>
            <tr>
              <th scope="col">Group sizes</th>
              <th scope="col">All inside</th>
              <th scope="col">Count variance</th>
              <th scope="col">Matches independent points on selected measurements?</th>
              {evidence && <th scope="col">Relative log likelihood of {recordName}</th>}
            </tr>
          </thead>
          <tbody>
            {candidates.map((item) => (
              <tr key={grouping(item.groups)}>
                <th scope="row">{grouping(item.groups)}</th>
                <td>{digits(item.statistics["all-inside"])}</td>
                <td>{digits(item.statistics["count-variance"])}</td>
                <td>{item.matchesIndependent ? "Yes" : "No"}</td>
                {evidence && (
                  <td>
                    {item.relativeLogLikelihood === null
                      ? `Impossible at counts ${item.impossibleCounts.join(", ")}`
                      : digits(item.relativeLogLikelihood)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <label htmlFor={id}>Inspect the count probabilities of one grouping</label>
      <select
        id={id}
        value={grouping(chosen.groups)}
        disabled={!ready}
        onChange={(event) => setSelection(event.currentTarget.value)}
      >
        {candidates.map((item) => (
          <option key={grouping(item.groups)}>{grouping(item.groups)}</option>
        ))}
      </select>
      <table>
        <caption>Count probabilities for group sizes {grouping(chosen.groups)}</caption>
        <thead>
          <tr>
            <th scope="col">Points inside</th>
            <th scope="col">Probability</th>
            {evidence && (
              <th scope="col">{sampled ? "Simulated occurrences" : "Accepted occurrences"}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {chosen.probabilities.map((probability, count) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: array indices are the physical counts
            <tr key={count}>
              <th scope="row">{count}</th>
              <td>{digits(probability)}</td>
              {evidence && <td>{evidence.counts[count]}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Each of the {chosen.groups.length} independently placed groups must land inside for all the
        points to be inside. The exponent on the volume fraction is therefore {chosen.groups.length}
        . The mean count is {digits(chosen.statistics["mean-count"])}. Every grouping shares that
        mean.
      </p>
      {checks.length > 0 && (
        <p className="fine">
          {sampled ? "Measurements compared" : "Selected measurements"}:{" "}
          {checks.map((check) => CHECK_LABELS[check]).join("; ")}.
        </p>
      )}
    </details>
  );
}
