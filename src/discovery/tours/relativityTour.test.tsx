import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTour, mathAndPhrasingHits } from "../../content/tours/tours.ts";
import { LOCAL_PREDICT_PERSISTENCE } from "../../experiments/predict/localPredictPersistence.ts";
import { installPredictPersistence } from "../../experiments/predict/predictPersistence.ts";
import { readPredictionsDocument } from "../../experiments/predict/predictStorage.ts";
import { PresentationProvider } from "../../experiments/presentation.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { predictAnswerFor } from "../../experiments/sr01/session.ts";
import { SR03_PRESETS } from "../../experiments/sr03/definition.ts";
import type { PublishedResult } from "../../experiments/store/instanceStore.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { createContainer, installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import { evaluateSr03 } from "../../workers/operations/sr03.ts";
import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";
import { RelativityTourInstrument } from "./RelativityTourInstrument.tsx";
import { createRelativityTourOwner, relativityAcceptedAction } from "./relativityTourOwners.ts";
import {
  type RelativityTourId,
  type RelativityTourSpec,
  type RelativityTourStep,
  relativityRodExample,
  relativityTourSpec,
  relativityWorkedRow,
  requireRelativityPreset,
} from "./relativityTourSpec.ts";
import { RelativityTourView } from "./RelativityTourViews.tsx";
import { TimedTour } from "./TimedTour.tsx";

const loaded = loadTour(process.cwd(), "fifteen-minutes-special-relativity");
assert.ok(loaded);
assert.deepEqual(loaded.problems, []);
const tour = loaded.tour;
const steps = tour.steps.filter((step): step is RelativityTourStep => step.kind === "instrument");
const ids: readonly RelativityTourId[] = ["sr-01", "sr-03", "sr-06", "sr-09"];

function stepFor(id: RelativityTourId): RelativityTourStep {
  const step = steps.find((candidate) => candidate.instrumentId === id);
  assert.ok(step);
  return step;
}

async function specFor(id: RelativityTourId): Promise<RelativityTourSpec> {
  const spec = await relativityTourSpec(stepFor(id));
  assert.ok(spec);
  return spec;
}

function scalar(outputs: readonly (PublishedResult | ScientificResult)[], quantityId: string): number {
  const result = outputs.find((output) => output.quantityId === quantityId);
  assert.ok(result?.status === "value" && typeof result.value === "number");
  return result.value;
}

function rowValue(spec: RelativityTourSpec, id: string, quantityId: string): number {
  const row = spec.workedRows.find((candidate) => candidate.id === id);
  assert.ok(row);
  return scalar(row.outputs, quantityId);
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/g, " ")
    .replace(/\s+/g, " ");
}

describe("the complete relativity tour", () => {
  test("the actual route includes its encounter and all four worked comparisons without equations or JavaScript", async () => {
    const html = await exportMarkup(<TimedTour tour={tour} />);
    const text = visibleText(html);
    expect(html).toContain('data-encounter-id="entrance-special-relativity"');
    expect(text).not.toContain("first encounter cannot be shown");
    expect(text).not.toContain("is not built yet");
    expect(mathAndPhrasingHits(text)).toEqual([]);
    expect(html).not.toMatch(/class="katex|<math/);
    expect(html).not.toContain("data-tour-owner=");
    for (const step of steps) {
      expect(html).toContain('id="tour-step-' + step.id + '"');
      expect(html).toContain('data-tour-worked-example="' + step.instrumentId + '"');
      expect(html).toContain('data-instrument-id="' + step.instrumentId + '"');
      for (const choice of step.choices)
        expect(html).toContain('data-candidate-id="' + choice.candidateId + '"');
    }
    expect(html).toContain('id="tour-finish"');
  });

  test("all initial comparisons bind the registered prediction to its actual accepted reveal and provenance", async () => {
    for (const id of ids) {
      const spec = await specFor(id);
      const owner = createRelativityTourOwner(spec, "binding-" + id);
      expect(relativityAcceptedAction(spec, owner.getSnapshot())?.id).toBe(stepFor(id).reveal.id);
      expect(spec.revealId).toBe(stepFor(id).reveal.id);
      expect(spec.prompt.supportedCandidateId).toBe(stepFor(id).supportedCandidateId);
      expect(spec.sourceDigest).toMatch(/^source:sha256:[a-f0-9]{64}$/);
      expect(mathAndPhrasingHits(JSON.stringify(spec.prompt))).toEqual([]);
      expect(spec.workedRows.every((row) => row.outputs.length > 0)).toBe(true);
    }
  });

  test("the synchronized clock comparison has a direction and a gap, and vanishes at rest", async () => {
    const spec = await specFor("sr-01");
    assert.ok(spec.id === "sr-01");
    expect(predictAnswerFor(spec.initial)).toBe("trailing-clock-ahead");
    expect(rowValue(spec, spec.revealId, "desynchronization")).toBe(6);
    expect(rowValue(spec, "clocks-half-speed", "desynchronization")).toBe(3);
    expect(rowValue(spec, "clocks-at-rest", "desynchronization")).toBe(0);
  });

  test("both rod comparisons mark actual endpoints; arbitrary platform marks would give the wrong answer", async () => {
    const spec = await specFor("sr-03");
    expect(rowValue(spec, spec.revealId, "readingsOnRodEnds")).toBe(1);
    expect(rowValue(spec, spec.revealId, "measuredLength")).toBeCloseTo(8, 12);
    expect(rowValue(spec, spec.revealId, "temporalSeparationK")).toBe(0);
    expect(rowValue(spec, spec.revealId, "temporalSeparationKPrime")).toBeCloseTo(-6, 12);
    expect(rowValue(spec, "rod-simultaneous", "readingsOnRodEnds")).toBe(1);
    expect(rowValue(spec, "rod-simultaneous", "measuredLength")).toBeCloseTo(10, 12);
    expect(rowValue(spec, "rod-simultaneous", "temporalSeparationKPrime")).toBeCloseTo(0, 12);
    const unrelated = await evaluateSr03(SR03_PRESETS["sr-03-boost-0.6c"]!.parameters);
    assert.ok(unrelated.kind === "accepted");
    expect(scalar(unrelated.data.outputs, "readingsOnRodEnds")).toBe(0);
    expect(scalar(unrelated.data.outputs, "temporalSeparationKPrime")).toBeCloseTo(-7.5, 12);
  });

  test("ordinary addition disagrees at the authored speeds and the real owner preserves light speed", async () => {
    const spec = await specFor("sr-06");
    assert.ok(spec.id === "sr-06");
    expect(rowValue(spec, spec.revealId, "composedSpeedOverC")).toBeCloseTo(15 / 17, 12);
    expect(rowValue(spec, spec.revealId, "galileanSpeedOverC")).toBeCloseTo(1.2, 12);
    expect(rowValue(spec, "light-in-moving-frame", "composedSpeedOverC")).toBe(1);
    const owner = createRelativityTourOwner(spec, "speed-property");
    for (const movingSpeed of [0, 0.05, 0.2, 0.6, 0.99, 1]) {
      expect(owner.apply({ ...spec.initial, movingSpeed }).kind).toBe("accepted");
      const speed = scalar(owner.getSnapshot().accepted!.outputs, "composedSpeedOverC");
      expect(speed).toBeGreaterThanOrEqual(0.6);
      expect(speed).toBeLessThanOrEqual(1);
    }
    const html = renderToStaticMarkup(
      <RelativityTourInstrument step={stepFor("sr-06")} spec={spec} instanceId="units" />,
    );
    expect(html).toContain("88.23529");
    expect(html).toContain("percent of light speed");
    expect(html).toContain('data-value="' + rowValue(spec, spec.revealId, "composedSpeedOverC") + '"');
  });

  test("approach and recession are reciprocal while the two medium assumptions predict different shifts", async () => {
    const spec = await specFor("sr-09");
    const toward = rowValue(spec, spec.revealId, "dopplerFactor");
    const away = rowValue(spec, "sr-09-receding-0.6", "dopplerFactor");
    expect(toward).toBe(2);
    expect(away).toBe(0.5);
    expect(toward * away).toBe(1);
    expect(rowValue(spec, spec.revealId, "classicalObserverDopplerFactor")).toBe(1.6);
    expect(rowValue(spec, spec.revealId, "classicalSourceDopplerFactor")).toBe(2.5);
    expect(rowValue(spec, "sr-09-transverse-0.6", "dopplerFactor")).toBeCloseTo(1.25, 12);
  });

  test("(relativityTourSpec.ts:132) wrong prompts, controls, candidates and the obsolete rod preset are refused", async () => {
    const step = stepFor("sr-03");
    for (const changed of [
      { ...step, promptId: "sr-03-predict-causal-order" },
      { ...step, controlId: "v" },
      { ...step, reveal: { ...step.reveal, id: "sr-03-boost-0.6c" } },
      { ...step, reveal: { ...step.reveal, kind: "tape" as const } },
      { ...step, choices: [step.choices[0]!, step.choices[0]!, step.choices[2]!] },
      { ...step, supportedCandidateId: "still-simultaneous" },
    ])
      await expect(relativityTourSpec(changed)).rejects.toMatchObject({
        code: "relativity-tour-binding",
      });
  });

  test("(relativityTourSpec.ts:155) a missing or refused preset cannot become the opening comparison", () => {
    const preset = { pairBeta: 0.6 };
    expect(requireRelativityPreset(preset)).toBe(preset);
    assert.throws(() => requireRelativityPreset(undefined), {
      name: "RelativityTourBindingError",
      code: "relativity-tour-binding",
    });
  });

  test("(relativityTourSpec.ts:189) a rod example cannot be prepared outside the owner's admitted domain", async () => {
    const spec = await specFor("sr-03");
    assert.ok(spec.id === "sr-03");
    await expect(relativityRodExample({ ...spec.initial, v: 1 })).rejects.toMatchObject({
      code: "relativity-tour-owner",
    });
  });

  test("(relativityTourSpec.ts:170) refused, pending and incomplete snapshots cannot become worked answers", async () => {
    const spec = await specFor("sr-01");
    const owner = createRelativityTourOwner(spec, "unfinished");
    const view = owner.getSnapshot();
    expect(relativityWorkedRow("good", "Good", view, { kind: "accepted" }).outputs.length).toBeGreaterThan(0);
    for (const [snapshot, applied] of [
      [view, { kind: "refused" }],
      [{ ...view, pending: true }, { kind: "accepted" }],
      [{ ...view, accepted: null }, { kind: "accepted" }],
      [{ ...view, accepted: { ...view.accepted!, final: false } }, { kind: "accepted" }],
    ] as const)
      assert.throws(() => relativityWorkedRow("bad", "Bad", snapshot, applied), {
        name: "RelativityTourBindingError",
        code: "relativity-tour-owner",
      });
  });

  test("every owner refuses a light-speed observer without changing its accepted identity or row label", async () => {
    const invalid = { "sr-01": { pairBeta: 1 }, "sr-03": { v: 1 }, "sr-06": { frameBeta: 1 }, "sr-09": { beta: 1 } };
    for (const id of ids) {
      const spec = await specFor(id);
      const owner = createRelativityTourOwner(spec, "refusal-" + id);
      const before = owner.getSnapshot().accepted;
      expect(owner.apply({ ...spec.initial, ...invalid[id] }).kind).toBe("refused");
      expect(owner.getSnapshot().accepted).toBe(before);
      expect(relativityAcceptedAction(spec, owner.getSnapshot())?.id).toBe(spec.revealId);
    }
  });
});

describe("the compact relativity controls use accepted owner state", () => {
  const roots: Root[] = [];
  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    installPredictPersistence(LOCAL_PREDICT_PERSISTENCE);
  });
  afterEach(async () => {
    for (const root of roots.splice(0)) await act(() => root.unmount());
    await uninstallDom();
  });

  function required<T extends Element = HTMLElement>(container: ParentNode, selector: string): T {
    const element = container.querySelector<T>(selector);
    assert.ok(element, "Missing " + selector);
    return element;
  }

  async function click(container: ParentNode, selector: string) {
    await act(() => required<HTMLElement>(container, selector).click());
  }

  async function mount(id: RelativityTourId, readingOnly = false, instanceId = "live-" + id) {
    const container = createContainer();
    const root = createRoot(container);
    roots.push(root);
    const spec = await specFor(id);
    await act(async () => {
      root.render(
        <RelativityTourInstrument
          step={stepFor(id)}
          spec={spec}
          instanceId={instanceId}
          readingOnly={readingOnly}
        />,
      );
    });
    await act(async () => { await import("./RelativityTourViews.tsx"); });
    return { container, root, spec };
  }

  const live = (container: ParentNode) => required<HTMLElement>(container, "[data-tour-owner]");
  const cell = (container: ParentNode, id: string) =>
    required<HTMLElement>(live(container), '[data-quantity-id="' + id + '"]');

  test("the real prediction panel conceals the answer until a choice and preserves the owner snapshot", async () => {
    const { container } = await mount("sr-09");
    const before = live(container).dataset.snapshotVersion;
    expect(required(live(container), "[data-predict-response]").getAttribute("data-predict-response")).toBe("awaiting");
    const candidate = stepFor("sr-09").choices[0]!;
    await click(live(container), 'input[type="radio"][value="' + candidate.candidateId + '"]');
    expect(required(live(container), "[data-predict-response]").getAttribute("data-predict-response")).toBe("shown");
    expect(live(container).dataset.snapshotVersion).toBe(before);
    expect(readPredictionsDocument(createStorageContext()).prompts["sr-09"]?.[stepFor("sr-09").promptId]?.prediction).toEqual({
      form: "candidate",
      candidateId: candidate.candidateId,
    });
    expect(mathAndPhrasingHits(container.textContent ?? "")).toEqual([]);
  });

  test("exploring skips an unanswered prediction and one instance cannot change another", async () => {
    const first = await mount("sr-06", false, "first-speed");
    const second = await mount("sr-06", false, "second-speed");
    await click(first.container, '[data-tour-control="no-second-motion"]');
    expect(Number(cell(first.container, "composedSpeedOverC").dataset.value)).toBe(0.6);
    expect(Number(cell(second.container, "composedSpeedOverC").dataset.value)).toBeCloseTo(15 / 17, 12);
    expect(live(second.container).dataset.tourAction).toBe(second.spec.revealId);
    expect(required(live(first.container), "[data-predict-response]").getAttribute("data-predict-response")).toBe("shown");
    expect(readPredictionsDocument(createStorageContext()).prompts["sr-06"]?.[stepFor("sr-06").promptId]).toEqual({ status: "skipped" });
    await click(first.container, '[data-tour-control="light-in-moving-frame"]');
    expect(Number(cell(first.container, "composedSpeedOverC").dataset.value)).toBe(1);
    expect(live(first.container).textContent).toContain("Ideal model, host calculation");
    expect(live(first.container).querySelector('[role="alert"]')).toBeNull();
    expect(mathAndPhrasingHits(live(first.container).textContent ?? "")).toEqual([]);
  });

  test("reading-only retains the full table and mounts no owner until the explicit load action", async () => {
    const { container } = await mount("sr-03", true);
    expect(container.querySelector("[data-tour-owner]")).toBeNull();
    expect(container.querySelector('[data-tour-worked-example="sr-03"] table')).not.toBeNull();
    await click(container, "[data-load-experiment]");
    expect(live(container).dataset.tourOwner).toBe("sr-03");
    expect(Number(cell(container, "measuredLength").dataset.value)).toBeCloseTo(8, 12);
  });

  test("a pending rod measurement retains its accepted label, preserves the physical run and disposes its worker", async () => {
    const spec = await specFor("sr-03");
    assert.ok(spec.id === "sr-03");
    const pending: unknown[] = [];
    let receiver: ((message: unknown) => void) | null = null;
    let creations = 0;
    let disposals = 0;
    const host = createSr03Host((message) => receiver?.(structuredClone(message)), spec.sourceDigest);
    const workerFactory = (): WorkerChannel => {
      creations++;
      return {
        send(message) { pending.push(structuredClone(message)); },
        listen(onMessage) {
          receiver = onMessage;
          queueMicrotask(() => host.hello());
          return () => { receiver = null; };
        },
        dispose() { disposals++; host.dispose(); },
      };
    };
    const container = createContainer();
    const root = createRoot(container);
    roots.push(root);
    await act(() => root.render(
      <PresentationProvider presentation="tour">
        <RelativityTourView
          instanceId="rod-pending"
          mode={null}
          presentation="tour"
          spec={spec}
          step={stepFor("sr-03")}
          workerFactory={workerFactory}
        />
      </PresentationProvider>,
    ));
    const originalRun = live(container).dataset.runId;
    expect(creations).toBe(0);
    await click(container, '[data-tour-control="rod-simultaneous"]');
    expect(creations).toBe(1);
    expect(live(container).getAttribute("aria-busy")).toBe("true");
    expect(live(container).dataset.tourAction).toBe(spec.revealId);
    expect(Number(cell(container, "measuredLength").dataset.value)).toBeCloseTo(8, 12);
    expect(pending.length).toBeGreaterThan(0);
    await act(async () => {
      for (const message of pending.splice(0)) await host.receive(message);
    });
    expect(live(container).getAttribute("aria-busy")).toBe("false");
    expect(live(container).dataset.tourAction).toBe("rod-simultaneous");
    expect(Number(cell(container, "measuredLength").dataset.value)).toBeCloseTo(10, 12);
    expect(live(container).dataset.runId).toBe(originalRun);
    expect(live(container).textContent).toContain("Ideal model, host calculation");
    expect(mathAndPhrasingHits(container.textContent ?? "")).toEqual([]);
    await act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    expect(disposals).toBe(1);
  });
});
