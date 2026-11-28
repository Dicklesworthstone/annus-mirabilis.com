import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { OccupancySample } from "../../components/lab/lq05/OccupancySample.tsx";
import {
  compareGroupedOccupancy,
  sampledOccupancyState,
} from "../../reasoning/independence/state.ts";
import { LQ05_DEFAULTS } from "./definition.ts";
import { createLq05Session, type Lq05ExperimentView } from "./session.ts";

const settings = { ...LQ05_DEFAULTS, n: 4, f: 0.5, seed: "12345", trials: 256, locked: false };
const fit = (view: Lq05ExperimentView) => {
  const state = sampledOccupancyState(view.evaluation.sampling, "accepted-sample");
  expect(state?.evidence?.counts).toEqual(view.evaluation.sampling.occupancyCounts);
  return compareGroupedOccupancy(
    state!.comparison.settings,
    state!.checks,
    state!.evidence!.counts,
  );
};

test("an accepted sample is refit at each accepted seed, model and size, while a refusal retains the old record", () => {
  const session = createLq05Session("evidence", settings);
  const original = session.getServerSnapshot();
  const independent = fit(original);
  expect(independent.find((g) => g.groups.length === 4)?.relativeLogLikelihood).toBe(0);
  expect(independent.find((g) => g.groups.length === 1)?.relativeLogLikelihood).toBeNull();
  session.apply({ ...settings, locked: true });
  const locked = session.getSnapshot();
  const groups = fit(locked);
  expect(groups.find((g) => g.groups.length === 1)?.relativeLogLikelihood).toBe(0);
  expect(groups.find((g) => g.groups.length === 4)?.relativeLogLikelihood).toBeLessThan(0);

  const { document } = new Window();
  document.body.innerHTML = renderToStaticMarkup(
    <>
      <OccupancySample view={original} source="worked-sample" />
      <OccupancySample view={locked} source="accepted-sample" />
    </>,
  );
  expect(document.querySelectorAll("#grouped-positions")).toHaveLength(0);
  for (const [source, view] of [
    ["worked-sample", original],
    ["accepted-sample", locked],
  ] as const) {
    const section = document.querySelector(`[data-occupancy-source="${source}"]`);
    expect(section?.getAttribute("data-occupancy-run")).toBe(view.accepted.runId);
    expect(section?.getAttribute("data-occupancy-allocation")).toBe(
      view.evaluation.sampling.allocationId,
    );
    expect(section?.querySelector("caption")?.textContent).toContain("12345");
    expect(section?.querySelector("select")?.disabled).toBe(true);
    expect(section?.querySelector("[data-group-evidence]")?.textContent).toContain(
      source === "worked-sample" ? "worked-example sample" : "accepted simulation record",
    );
    expect(
      [...section!.querySelectorAll("[data-occupancy-k] td")].map((td) => Number(td.textContent)),
    ).toEqual(view.evaluation.sampling.occupancyCounts);
  }
  session.apply({ ...settings, seed: "98765", trials: 161, n: 5, f: 0.75 });
  const changed = session.getSnapshot();
  expect(fit(changed)).toHaveLength(7);
  expect(changed.evaluation.sampling.occupancyCounts).not.toEqual(
    locked.evaluation.sampling.occupancyCounts,
  );
  expect(session.apply({ ...settings, n: -1 }).kind).toBe("refused");
  expect(session.getSnapshot().evaluation).toBe(changed.evaluation);
});

test("group fitting keeps the exact experiment and bounded sample size, including endpoints", () => {
  const session = createLq05Session("bounded-fit", settings);
  for (const [patch, eligible] of [
    [{ n: 12, f: 1, trials: 10000 }, true],
    [{ n: 13 }, false],
    [{ f: 0.74999999 }, false],
    [{ trials: 10001 }, false],
  ] as const) {
    expect(session.apply({ ...settings, ...patch }).kind).toBe("accepted");
    const view = session.getSnapshot();
    const sample = view.evaluation.sampling;
    const fit = sampledOccupancyState(sample, "accepted-sample");
    expect(Boolean(fit)).toBe(eligible);
    const html = renderToStaticMarkup(<OccupancySample view={view} source="accepted-sample" />);
    expect(html.includes("data-group-evidence")).toBe(eligible);
    expect(html.match(/data-occupancy-k=/g)).toHaveLength(sample.n + 1);
    expect(sample.occupancyCounts.reduce((a, b) => a + b, 0)).toBe(sample.trials);
  }
});
