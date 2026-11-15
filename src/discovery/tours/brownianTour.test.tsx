import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTour, mathAndPhrasingHits } from "../../content/tours/tours.ts";
import { parseU64 } from "../../experiments/identity/u64.ts";
import { WALKTHROUGH_CATALOGUE } from "../../experiments/permalink/walkthroughCatalogue.ts";
import type { WalkthroughCatalogue, WalkthroughCheckpoint } from "../../experiments/permalink/walkthroughCheckpoints.ts";
import { PresentationProvider } from "../../experiments/presentation.ts";
import type { PublishedResult } from "../../experiments/store/instanceStore.ts";
import { createContainer, installDom, uninstallDom } from "../../testing/reactDom.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { BrownianTourInstrument } from "./BrownianTourInstrument.tsx";
import { TimedTour } from "./TimedTour.tsx";
import { BrownianTourView } from "./BrownianTourViews.tsx";
import { brownianAcceptedAction, brownianTourExecution, createBrownianTourOwner } from "./brownianTourOwners.ts";
import { brownianHistogram } from "./brownianTourPresentation.ts";
import { BrownianTourBindingError, brownianKernelActions, brownianTourSpec, type BrownianTourSpec, type BrownianTourStep } from "./brownianTourSpec.ts";

const loaded = loadTour(process.cwd(), "fifteen-minutes-brownian-motion");
assert.ok(loaded);
assert.deepEqual(loaded.problems, []);
const ids = ["bm-01", "bm-05", "bm-06"] as const;
type Id = typeof ids[number];
const specs = new Map<Id, BrownianTourSpec>();
function stepFor(id: Id): BrownianTourStep {
  const step = loaded!.tour.steps.find((entry) => entry.kind === "instrument" && entry.instrumentId === id);
  assert.ok(step?.kind === "instrument");
  return step;
}
function specFor(id: Id) {
  const spec = specs.get(id);
  assert.ok(spec);
  return spec;
}
beforeAll(async () => {
  for (const id of ids) {
    const spec = await brownianTourSpec(stepFor(id));
    assert.ok(spec);
    specs.set(id, spec);
  }
}, 120_000);
function scalar(outputs: readonly PublishedResult[], id: string) {
  const output = outputs.find((item) => item.quantityId === id);
  assert.ok(output?.status === "value" && typeof output.value === "number");
  return output.value;
}
function visible(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
}
function changeStops(change: (stop: WalkthroughCheckpoint) => WalkthroughCheckpoint): WalkthroughCatalogue {
  return {
    ...WALKTHROUGH_CATALOGUE,
    walkthroughs: WALKTHROUGH_CATALOGUE.walkthroughs.map((walkthrough) =>
      walkthrough.tapeId === "coin-to-bell"
        ? { ...walkthrough, checkpoints: walkthrough.checkpoints.map(change) }
        : walkthrough),
  };
}

describe("Brownian tour comparisons use scientific owner results", () => {
  test("the complete timed route contains its entrance and all three equation-free comparisons", async () => {
    const html = await exportMarkup(<TimedTour tour={loaded!.tour} />);
    const text = visible(html);
    const entrance = loaded!.tour.steps.find((step) => step.kind === "first-encounter");
    assert.ok(entrance?.kind === "first-encounter");
    expect(html).toContain('data-encounter-id="' + entrance.recordId + '"');
    expect(text).not.toContain("not built yet");
    expect(text).not.toContain("cannot be shown");
    expect(mathAndPhrasingHits(text)).toEqual([]);
    expect(html).not.toMatch(/class="katex|<math/);
    expect(html).not.toContain("data-tour-owner=");
    for (const id of ids) {
      const step = stepFor(id);
      expect(html).toContain('id="tour-step-' + step.id + '"');
      expect(html).toContain('data-instrument-id="' + id + '"');
      expect(html).toContain('data-tour-worked-example="' + id + '"');
      for (const choice of step.choices)
        expect(html).toContain('data-candidate-id="' + choice.candidateId + '"');
    }
    expect(html).toContain('href="/tapes/coin-to-bell/"');
    expect(html).toContain('id="tour-finish"');
  }, 120_000);

  test("every lesson has an equation-free worked comparison without mounting a live owner", () => {
    for (const id of ids) {
      const html = renderToStaticMarkup(
        <BrownianTourInstrument step={stepFor(id)} spec={specFor(id)} instanceId={"static-" + id} />,
      );
      expect(html).toContain('data-tour-worked-example="' + id + '"');
      expect(html).toContain("Static worked example");
      expect(html).not.toContain("data-tour-owner=");
      expect(html).not.toMatch(/class="katex|<math/);
      expect(mathAndPhrasingHits(visible(html))).toEqual([]);
      for (const choice of stepFor(id).choices)
        expect(html).toContain('data-candidate-id="' + choice.candidateId + '"');
    }
    const histogramHtml = renderToStaticMarkup(
      <BrownianTourInstrument step={stepFor("bm-05")} spec={specFor("bm-05")} instanceId="histograms" />,
    );
    expect(histogramHtml.match(/data-tour-histogram=/g)?.length).toBe(3);
    expect(histogramHtml).toContain("Read the histogram as a table");
    expect(histogramHtml).toContain('href="/tapes/coin-to-bell/"');
    expect(visible(histogramHtml)).toContain("fresh calculations");
  });

  test("four times the observation time doubles the model distance, without changing the recording setup", () => {
    const spec = specFor("bm-01");
    assert.ok(spec.id === "bm-01");
    const [first, later] = spec.actions;
    assert.ok(first && later);
    expect(later.parameters).toEqual({ ...first.parameters, interval: 4 });
    expect(first.parameters.constantSetId).toBe("einstein-1905-brownian-printed");
    expect(scalar(spec.workedRows[1]!.outputs, "rmsDisplacement1d"))
      .toBe(2 * scalar(spec.workedRows[0]!.outputs, "rmsDisplacement1d"));
    expect(scalar(spec.workedRows[1]!.outputs, "reusedRecording")).toBe(1);
    expect(scalar(spec.workedRows[1]!.outputs, "sampleRms"))
      .not.toBe(2 * scalar(spec.workedRows[0]!.outputs, "sampleRms"));
  });

  test("400-step rules have equal model spread and their own complete sample histograms", () => {
    const spec = specFor("bm-05");
    assert.ok(spec.id === "bm-05");
    expect(spec.initial.kernel).toBe("gaussian");
    expect(spec.actions.map((action) => action.tapeActionIndex)).toEqual([6, 4, 5]);
    const opening = spec.actions[0]!.parameters;
    for (const action of spec.actions) {
      expect(action.parameters).toEqual({ ...opening, kernel: action.parameters.kernel });
      expect(action.parameters.n).toBe(400);
    }
    const spreads = spec.workedRows.map((row) => scalar(row.outputs, "modelRms"));
    expect(spreads[0]).toBeCloseTo(1e-5, 15);
    expect(new Set(spreads).size).toBe(1);
    expect(new Set(spec.workedRows.map((row) => scalar(row.outputs, "sampleRms"))).size).toBe(3);
    assert.ok(spec.histograms && spec.histogramExtent);
    for (const item of spec.histograms) {
      const represented = item.data.observed.reduce((total, share) => total + share, 0) +
        (item.data.outsideLeft + item.data.outsideRight) / opening.walkers;
      expect(represented).toBeCloseTo(1, 12);
      expect(item.data.edges.length).toBe(item.data.observed.length + 1);
      expect(item.data.model.length).toBe(item.data.observed.length);
      expect(spec.histogramExtent[0]).toBeLessThanOrEqual(item.data.edges[0]!);
      expect(spec.histogramExtent[1]).toBeGreaterThanOrEqual(item.data.edges.at(-1)!);
    }
  });

  test("the authored one-distance interval gives about 68 percent, and two distances give about 95 percent", () => {
    const spec = specFor("bm-06");
    assert.ok(spec.id === "bm-06");
    const first = spec.workedRows[0]!, second = spec.workedRows[1]!;
    expect(scalar(first.outputs, "intervalProbability")).toBeCloseTo(0.6826894921370859, 7);
    expect(scalar(second.outputs, "intervalProbability")).toBeCloseTo(0.9544997361036416, 7);
    // The authored bounds retain their original rounding; the owner supplies the actual chance.
    expect(Math.abs(spec.initial.upper / scalar(first.outputs, "rmsDisplacement1d") - 1)).toBeLessThan(1e-6);
    expect(spec.actions[1]!.parameters).toEqual({
      ...spec.initial, lower: 2 * spec.initial.lower, upper: 2 * spec.initial.upper,
    });
    expect(scalar(second.outputs, "rmsDisplacement1d")).toBe(scalar(first.outputs, "rmsDisplacement1d"));
  });

  test("(brownianTourSpec.ts:181) (brownianTourSpec.ts:223) (brownianTourSpec.ts:272) another prompt or reveal cannot substitute for an authored lesson", async () => {
    for (const id of ids)
      await expect(brownianTourSpec({ ...stepFor(id), controlId: "wrong-control" }))
        .rejects.toMatchObject({ code: "brownian-tour-binding" });
  });

  test("(brownianTourSpec.ts:72) (brownianTourSpec.ts:187) (brownianTourSpec.ts:278) (brownianTourSpec.ts:302) unsafe or mismatched presets fail before becoming a comparison", async () => {
    const tracer = specFor("bm-01");
    const distribution = specFor("bm-06");
    assert.ok(tracer.id === "bm-01" && distribution.id === "bm-06");
    const reader = (parameterValues: Record<string, number | string | boolean>) =>
      (_id: string, presetId: string) => ({ presetId, label: "Injected test preset", parameterValues });
    await expect(brownianTourSpec(stepFor("bm-01"), undefined, reader({ ...tracer.initial, M: 800 })))
      .rejects.toMatchObject({ code: "brownian-tour-binding" });
    await expect(brownianTourSpec(stepFor("bm-01"), undefined, reader({ ...tracer.initial, a: 0 })))
      .rejects.toMatchObject({ code: "brownian-tour-owner" });
    await expect(brownianTourSpec(stepFor("bm-06"), undefined, reader({ ...distribution.initial, gridEnabled: true })))
      .rejects.toMatchObject({ code: "brownian-tour-binding" });
    await expect(brownianTourSpec(stepFor("bm-06"), undefined, reader({ ...distribution.initial, lower: -1e-6, upper: 1e-6 })))
      .rejects.toMatchObject({ code: "brownian-tour-binding" });
  });

  test("(brownianTourSpec.ts:113) (brownianTourSpec.ts:118) (brownianTourSpec.ts:120) (brownianTourSpec.ts:125) (brownianTourSpec.ts:134) (brownianTourSpec.ts:154) missing, incompatible or altered recorded settings cannot masquerade as the walkthrough", () => {
    expect(() => brownianKernelActions({ walkthroughs: [], problems: [] })).toThrow(BrownianTourBindingError);
    for (const mutate of [
      (stop: WalkthroughCheckpoint) => ({ ...stop, settings: { ...stop.settings, n: 399 } }),
      (stop: WalkthroughCheckpoint) => ({ ...stop, tape: null }),
      (stop: WalkthroughCheckpoint) => ({ ...stop, settings: { ...stop.settings, seed: "1906" } }),
      (stop: WalkthroughCheckpoint) => ({
        ...stop, tape: stop.tape ? { ...stop.tape, seed: parseU64("1906") } : null,
      }),
      (stop: WalkthroughCheckpoint) => ({
        ...stop, tape: stop.tape ? {
          ...stop.tape, modelIdentity: { ...stop.tape.modelIdentity, artifactDigest: "host:sha256:" + "a".repeat(64) },
        } : null,
      }),
      (stop: WalkthroughCheckpoint) => ({
        ...stop, tape: stop.tape ? {
          ...stop.tape, acceptedCheckpoint: { ...stop.tape.acceptedCheckpoint, acceptedActionIndex: -1 },
        } : null,
      }),
    ]) {
      expect(() => brownianKernelActions(changeStops((stop) => stop.settings.n === 400 ? mutate(stop) : stop)))
        .toThrow(BrownianTourBindingError);
    }
  });

  test("(brownianTourSpec.ts:139) (brownianTourSpec.ts:143) a broken recorded prefix is refused even if its final displayed settings look right", () => {
    for (const invalidPrevious of [false, true])
      expect(() => brownianKernelActions(changeStops((stop) =>
        stop.settings.n !== 400 || !stop.tape ? stop : {
          ...stop,
          tape: {
            ...stop.tape,
            events: stop.tape.events.map((event, index) => index ? event :
              invalidPrevious ? { ...event, previousValue: 999 } : { ...event, paramId: "unrecognized" }),
          },
        }))).toThrow(BrownianTourBindingError);
  });

  test("(brownianTourSpec.ts:162) a consistent recorded prefix cannot change the variance of only one rule", () => {
    const changed = changeStops((stop) => {
      if (stop.settings.n !== 400 || stop.settings.kernel !== "uniform" || !stop.tape) return stop;
      const stepRms = Number(stop.settings.stepRms) * 2;
      return {
        ...stop,
        settings: { ...stop.settings, stepRms },
        tape: { ...stop.tape, initialConditions: { ...stop.tape.initialConditions, stepRms } },
      };
    });
    expect(() => brownianKernelActions(changed)).toThrow("Only the step rule may differ");
  });

  test("histogram projection never invents unavailable arrays", () => {
    expect(brownianHistogram([])).toBeNull();
  });
});

describe("Brownian tour session identity and visibility", () => {
  test("constructing all three owners starts no worker; refused inputs retain the accepted result", () => {
    for (const id of ids) {
      const spec = specFor(id);
      let starts = 0;
      const owner = createBrownianTourOwner(spec, "lazy-" + id, () => {
        starts++;
        throw new Error("This test must not start a worker.");
      });
      const before = owner.getSnapshot().accepted;
      expect(starts).toBe(0);
      expect(owner.apply({ ...spec.initial, [id === "bm-05" ? "stepRms" : "a"]: -1 }).kind).toBe("refused");
      expect(owner.getSnapshot().accepted).toBe(before);
      expect(brownianAcceptedAction(spec, owner.getSnapshot())?.id).toBe(spec.actions[0]!.id);
      expect(brownianTourExecution(spec, owner.getSnapshot(), true)).toBe("static-example");
      owner.disconnect();
    }
  });

  test("hidden measurements keep their run; changing the step rule forks a run, while neither relabels old data", () => {
    for (const id of ids) {
      const spec = specFor(id);
      let starts = 0;
      const owner = createBrownianTourOwner(spec, "paused-" + id, () => {
        starts++;
        throw new Error("Hidden owners must not create a worker.");
      });
      const before = owner.getSnapshot().accepted;
      assert.ok(before);
      owner.setSchedulingPaused(true);
      try {
        expect(owner.apply(spec.actions[1]!.parameters).kind).toBe("accepted");
        const pending = owner.getSnapshot();
        expect(starts).toBe(0);
        expect(pending.accepted).toBe(before);
        expect(brownianAcceptedAction(spec, pending)?.id).toBe(spec.actions[0]!.id);
        if (id === "bm-05") expect(pending.requested?.runId).not.toBe(before.runId);
        else expect(pending.requested?.runId).toBe(before.runId);
        expect(brownianTourExecution(spec, pending, true)).toBe("static-example");
      } finally {
        owner.disconnect();
      }
    }
  });
});

describe("the Brownian live view preserves reader choices and accepted labels", () => {
  const roots: Root[] = [];
  beforeEach(async () => { await installDom({ intersections: "visible" }); });
  afterEach(async () => {
    for (const root of roots.splice(0)) await act(() => root.unmount());
    await uninstallDom();
  });

  test("reading-only mounts no owner and keeps all static answers available", async () => {
    const container = createContainer();
    const root = createRoot(container);
    roots.push(root);
    await act(() => root.render(
      <BrownianTourInstrument step={stepFor("bm-06")} spec={specFor("bm-06")}
        instanceId="brownian-reading-only" readingOnly />,
    ));
    expect(container.querySelector("[data-tour-owner]")).toBeNull();
    expect(container.querySelector("[data-tour-worked-example] table")).not.toBeNull();
    expect(mathAndPhrasingHits(container.textContent ?? "")).toEqual([]);
  });

  test("a pending request keeps the old interval, probability and static label; unmount releases its channel", async () => {
    const spec = specFor("bm-06");
    let starts = 0, disposals = 0;
    const factory = (): WorkerChannel => {
      starts++;
      return { send() {}, listen() { return () => {}; }, dispose() { disposals++; } };
    };
    const container = createContainer();
    const root = createRoot(container);
    roots.push(root);
    await act(() => root.render(
      <PresentationProvider presentation="tour">
        <BrownianTourView spec={spec} step={stepFor("bm-06")} instanceId="brownian-pending"
          mode={null} presentation="tour" workerFactory={factory} />
      </PresentationProvider>,
    ));
    const region = container.querySelector<HTMLElement>("[data-tour-owner]");
    const button = container.querySelector<HTMLButtonElement>('[data-tour-control="two-typical-distances"]');
    const cell = container.querySelector<HTMLElement>('[data-quantity-id="intervalProbability"]');
    assert.ok(region && button && cell);
    const acceptedProbability = cell.dataset.value;
    expect(starts).toBe(0);
    await act(() => button.click());
    expect(starts).toBe(1);
    expect(region.dataset.tourAction).toBe("one-typical-distance");
    expect(cell.dataset.value).toBe(acceptedProbability);
    expect(region.textContent).toContain("Static worked example");
    expect(mathAndPhrasingHits(region.textContent ?? "")).toEqual([]);
    await act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    expect(disposals).toBe(1);
  });
});
