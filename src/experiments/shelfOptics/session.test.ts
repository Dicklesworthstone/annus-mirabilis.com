import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { SHELF_DEFINITIONS, SHELF_IDS, type ShelfParameters } from "./definition.ts";
import { evaluateShelfOptics } from "./evaluation.ts";
import { createShelfOpticsSession, type ShelfView } from "./session.ts";
import { primaryShelfMetrics, type ShelfApply, type ShelfReport } from "./state.ts";

function primaryValues(view: ShelfView): number[] {
  const output = view.accepted?.outputs[0];
  if (output?.status !== "value" || typeof output.value === "number")
    throw new Error("The comparison must publish a model-ordered numeric vector.");
  return Array.from(output.value.copy());
}

function assertCoherent(view: ShelfView): void {
  expect(view.accepted?.parameters).toEqual(view.comparison.report.parameters);
  expect(primaryValues(view)).toEqual(
    primaryShelfMetrics(view.comparison.report).map((metric) => metric.value),
  );
  expect(view.accepted?.outputs[0]?.quantityId).toBe(
    primaryShelfMetrics(view.comparison.report)[0]?.quantityId,
  );
}

describe("the shared shelf laboratory owner", () => {
  for (const id of SHELF_IDS) {
    test(`${id} keeps one coherent accepted report and canonical comparison`, () => {
      const example = evaluateShelfOptics(SHELF_DEFINITIONS[id].defaults);
      let evaluations = 0;
      const session = createShelfOpticsSession(`${id}:owner-test`, example, (parameters) => {
        evaluations++;
        return evaluateShelfOptics(parameters);
      });
      const initial = session.getSnapshot();
      expect(session.getServerSnapshot()).toBe(initial);
      expect(session.getSnapshot()).toBe(initial);
      expect(initial.comparison.revision).toBe(0);
      assertCoherent(initial);

      const acceptedViews: ShelfView[] = [];
      const unsubscribe = session.subscribe(() => {
        const view = session.getSnapshot();
        // Pending requests still describe their preceding accepted comparison consistently.
        assertCoherent(view);
        if (view.status === "accepted") acceptedViews.push(view);
      });
      const parameters = example.parameters;
      const changed: ShelfParameters =
        parameters.instrumentId === "shelf-fizeau"
          ? { ...parameters, waterSpeed: 0 }
          : { ...parameters, beta: 0 };
      expect(session.apply(changed).kind).toBe("accepted");
      const accepted = session.getSnapshot();
      expect(evaluations).toBe(1);
      expect(acceptedViews).toEqual([accepted]);
      expect(accepted.comparison.revision).toBe(1);
      expect(accepted.accepted?.runId).not.toBe(initial.accepted?.runId);
      expect(accepted.accepted?.parentRunId).toBe(initial.accepted?.runId);
      expect(accepted.accepted?.parameters).toEqual(changed);
      expect(primaryValues(accepted).every((value) => value === 0)).toBe(true);
      expect(session.getServerSnapshot()).toBe(initial);
      expect(initial.comparison.report).toEqual(example);
      expect(Object.isFrozen(accepted.comparison.report)).toBe(true);
      expect(Object.isFrozen(accepted.comparison.report.rows[0]?.metrics)).toBe(true);

      const output = accepted.accepted?.outputs[0];
      if (output?.status !== "value" || typeof output.value === "number")
        throw new Error("Missing accepted comparison vector.");
      output.value.copy().fill(12345);
      expect(primaryValues(accepted).every((value) => value === 0)).toBe(true);

      const malformed =
        changed.instrumentId === "shelf-fizeau"
          ? { ...changed, waterSpeed: "1e500" }
          : { ...changed, beta: "1e500" };
      expect(session.apply(malformed).kind).toBe("refused");
      expect(evaluations).toBe(1);
      expect(session.getSnapshot()).toBe(accepted);
      expect(acceptedViews).toEqual([accepted]);
      unsubscribe();
    });
  }

  test("reentrant subscribers cannot replace a comparison during its publication", () => {
    const defaults = SHELF_DEFINITIONS["shelf-maxwell-galilean"].defaults;
    if (defaults.instrumentId !== "shelf-maxwell-galilean")
      throw new Error("Wrong Maxwell defaults.");
    let evaluations = 0;
    const session = createShelfOpticsSession(
      "shelf-reentrant",
      evaluateShelfOptics(defaults),
      (parameters) => {
        evaluations++;
        return evaluateShelfOptics(parameters);
      },
    );
    const nested: ShelfApply[] = [];
    const unsubscribe = session.subscribe(() => {
      assertCoherent(session.getSnapshot());
      nested.push(session.apply({ ...defaults, beta: 0 }));
      assertCoherent(session.getSnapshot());
    });
    const requested = { ...defaults, beta: 0.2 };
    expect(session.apply(requested).kind).toBe("accepted");
    expect(nested.map((result) => result.kind)).toEqual(["refused", "refused"]);
    expect(evaluations).toBe(1);
    expect(session.getSnapshot().comparison.report.parameters).toEqual(requested);
    expect(session.getSnapshot().accepted?.parameters).toEqual(requested);
    expect(session.getSnapshot().comparison.revision).toBe(1);
    unsubscribe();
    expect(session.apply({ ...defaults, beta: 0 }).kind).toBe("accepted");
    expect(session.getSnapshot().comparison.revision).toBe(2);
    expect(evaluations).toBe(2);
    assertCoherent(session.getSnapshot());
  });

  test("a later comparison remains part of the accepted Fizeau report without invented ids", () => {
    const defaults = SHELF_DEFINITIONS["shelf-fizeau"].defaults;
    if (defaults.instrumentId !== "shelf-fizeau") throw new Error("Wrong Fizeau defaults.");
    const session = createShelfOpticsSession("fizeau-later", evaluateShelfOptics(defaults));
    expect(session.getSnapshot().comparison.report.later).toEqual([]);
    expect(session.apply({ ...defaults, waterSpeed: -7, showLater: true }).kind).toBe("accepted");
    const later = session.getSnapshot();
    expect(later.comparison.report.later).toHaveLength(4);
    expect(later.accepted?.outputs).toHaveLength(1);
    expect(later.comparison.report.parameters).toEqual({
      ...defaults,
      waterSpeed: -7,
      showLater: true,
    });
    assertCoherent(later);
    expect(session.apply({ ...defaults, showLater: false }).kind).toBe("accepted");
    expect(session.getSnapshot().comparison.report.later).toEqual([]);
    expect(later.comparison.report.later).toHaveLength(4);
  });

  test("the model-order and primary-owner contracts reject drift before changing state", () => {
    const defaults = SHELF_DEFINITIONS["shelf-michelson-morley"].defaults;
    let mutate: (report: ShelfReport) => ShelfReport = (report) => report;
    const session = createShelfOpticsSession(
      "shelf-contract",
      evaluateShelfOptics(defaults),
      (parameters) => mutate(evaluateShelfOptics(parameters)),
    );
    const initial = session.getSnapshot();
    mutate = (report) => ({ ...report, rows: [...report.rows].reverse() });
    expect(session.apply(defaults).kind).toBe("refused");
    expect(session.getSnapshot()).toBe(initial);
    mutate = (report) => ({
      ...report,
      rows: report.rows.map((row) => ({
        ...row,
        metrics: row.metrics.map((metric) =>
          metric.label === report.primaryMetric ? { ...metric, ownerId: "unregistered" } : metric,
        ),
      })),
    });
    expect(session.apply(defaults).kind).toBe("refused");
    expect(session.getSnapshot()).toBe(initial);
    mutate = (report) => ({
      ...report,
      rows: report.rows.map((row) => ({
        ...row,
        metrics: row.metrics.map((metric) =>
          metric.label === report.primaryMetric ? { ...metric, value: Number.NaN } : metric,
        ),
      })),
    });
    expect(session.apply(defaults).kind).toBe("refused");
    expect(session.getSnapshot()).toBe(initial);
    mutate = (report) => report;
    expect(session.apply(defaults).kind).toBe("accepted");
    expect(session.getSnapshot().comparison.revision).toBe(1);
    assertCoherent(session.getSnapshot());
  });

  test("an initial comparison refuses different units: primary-observable-mismatch", () => {
    const report = evaluateShelfOptics(SHELF_DEFINITIONS["shelf-michelson-morley"].defaults);
    const malformed: ShelfReport = {
      ...report,
      rows: report.rows.map((row, index) => ({
        ...row,
        metrics: row.metrics.map((metric) =>
          index === 1 && metric.label === report.primaryMetric ? { ...metric, unit: "s" } : metric,
        ),
      })),
    };
    assert.throws(() => createShelfOpticsSession("invalid-observable", malformed), {
      code: "primary-observable-mismatch",
    });
  });

  test("a rejected initial report is never accepted: publication-refused", () => {
    const report = evaluateShelfOptics(SHELF_DEFINITIONS["shelf-michelson-morley"].defaults);
    const malformed: ShelfReport = {
      ...report,
      rows: report.rows.map((row) => ({
        ...row,
        metrics: row.metrics.map((metric) =>
          metric.label === report.primaryMetric ? { ...metric, ownerId: " " } : metric,
        ),
      })),
    };
    assert.throws(() => createShelfOpticsSession("unpublished-report", malformed), {
      code: "publication-refused",
    });
  });

  test("separate placements and caller-owned input objects cannot mutate another comparison", () => {
    const report = evaluateShelfOptics(SHELF_DEFINITIONS["shelf-maxwell-galilean"].defaults);
    const left = createShelfOpticsSession("shelf-left", report);
    const right = createShelfOpticsSession("shelf-right", report);
    const original = right.getSnapshot();
    const parameters = report.parameters;
    if (parameters.instrumentId !== "shelf-maxwell-galilean")
      throw new Error("Wrong Maxwell defaults.");
    expect(left.apply({ ...parameters, wavenumber: parameters.wavenumber * 2 }).kind).toBe(
      "accepted",
    );
    expect(right.getSnapshot()).toBe(original);
    expect(primaryValues(left.getSnapshot())).toEqual(primaryValues(original));
    const originalAbsolute = original.comparison.report.rows[0]?.metrics[1]?.value;
    expect(left.getSnapshot().comparison.report.rows[0]?.metrics[1]?.value).toBe(
      (originalAbsolute ?? Number.NaN) * 4,
    );
    const metric = report.rows[0]?.metrics[0];
    if (!metric) throw new Error("Missing source metric.");
    expect(Reflect.set(metric, "value", 12345)).toBe(true);
    expect(original.comparison.report.rows[0]?.metrics[0]?.value).not.toBe(12345);
    expect(left.getSnapshot().accepted?.instanceId).toBe("shelf-left");
    expect(right.getSnapshot().accepted?.instanceId).toBe("shelf-right");
  });
});
