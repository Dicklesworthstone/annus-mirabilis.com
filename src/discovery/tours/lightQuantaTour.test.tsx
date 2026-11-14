import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTour, mathAndPhrasingHits } from "../../content/tours/tours.ts";
import { PresentationProvider } from "../../experiments/presentation.ts";
import { WALKTHROUGH_CATALOGUE } from "../../experiments/permalink/walkthroughCatalogue.ts";
import type { WalkthroughCatalogue } from "../../experiments/permalink/walkthroughCheckpoints.ts";
import { LOCAL_PREDICT_PERSISTENCE } from "../../experiments/predict/localPredictPersistence.ts";
import { installPredictPersistence } from "../../experiments/predict/predictPersistence.ts";
import { readPredictionsDocument } from "../../experiments/predict/predictStorage.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { createContainer, installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createLq01Host } from "../../workers/host/lq01Host.ts";
import type { WorkerChannel } from "../../workers/scheduler/lq01Scheduler.ts";
import { LightQuantaTourInstrument } from "./LightQuantaTourInstrument.tsx";
import { createLightQuantaTourOwner, lightQuantaAcceptedAction } from "./lightQuantaTourOwners.ts";
import {
  type LightQuantaTourId,
  type LightQuantaTourSpec,
  type LightQuantaTourStep,
  lightQuantaTourSpec,
  lightQuantaWorkedRow,
  lightQuantaWaveExample,
} from "./lightQuantaTourSpec.ts";
import { LightQuantaTourView } from "./LightQuantaTourViews.tsx";
import { TimedTour } from "./TimedTour.tsx";

const loaded = loadTour(process.cwd(), "fifteen-minutes-light-quanta");
assert.ok(loaded);
assert.deepEqual(loaded.problems, []);
const tour = loaded.tour;
const steps = tour.steps.filter((step): step is LightQuantaTourStep => step.kind === "instrument");
function stepFor(id: LightQuantaTourId): LightQuantaTourStep {
  const step = steps.find((candidate) => candidate.instrumentId === id);
  assert.ok(step);
  return step;
}
async function specFor(id: LightQuantaTourId): Promise<LightQuantaTourSpec> {
  const spec = await lightQuantaTourSpec(stepFor(id));
  assert.ok(spec);
  return spec;
}
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/g, " ")
    .replace(/\s+/g, " ");
}
function changedWalkthrough(
  change: (catalogue: WalkthroughCatalogue) => WalkthroughCatalogue,
): WalkthroughCatalogue {
  return change(structuredClone(WALKTHROUGH_CATALOGUE));
}
const recording = WALKTHROUGH_CATALOGUE.walkthroughs.find(
  (walkthrough) => walkthrough.tapeId === "the-locked-positions",
);
assert.ok(recording);

describe("the light-quanta tour is a complete equation-free path", () => {
  test("the actual route contains its first encounter and all three owner-backed worked comparisons", async () => {
    const html = await exportMarkup(<TimedTour tour={tour} />);
    const text = visibleText(html);
    expect(html).toContain('data-encounter-id="entrance-light-quanta"');
    expect(text).toContain("How often can everything end up in the left part?");
    expect(text).not.toContain("first encounter cannot be shown");
    expect(text).not.toContain("is not built yet");
    expect(text).not.toContain("n ln V");
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
    expect(html).toContain('href="/tapes/the-locked-positions/"');
    expect(html).toContain('href="/papers/light-quanta/view/parallel/#s8-p7"');
    expect(html).toContain('id="tour-finish"');
  });

  test("display units change printed cells, never accepted energies or ownership", async () => {
    const spec = await specFor("lq-08");
    const html = renderToStaticMarkup(
      <LightQuantaTourInstrument
        step={stepFor("lq-08")}
        spec={spec}
        instanceId="static-electrons"
      />,
    );
    expect(html).toContain("milliwatts");
    expect(html).toContain("electronvolts");
    expect(html).toContain("trillions per second");
    expect(html).toContain("0.4814006");
    expect(html).toContain('data-owner-id="photoelectric.kMax"');
    const energy = spec.workedRows[0]?.outputs.find((output) => output.quantityId === "maxKineticEnergy");
    assert.ok(energy?.status === "value" && typeof energy.value === "number");
    expect(html).toContain('data-value="' + energy.value + '"');
    expect(energy.unit).toBe("J");
    expect(html).toContain("Static worked example");
    expect(html).not.toContain("data-tour-owner=");
  });

  test("(lightQuantaTourSpec.ts:143) unrelated presets cannot substitute for the authored phase question", async () => {
    const step = stepFor("lq-01");
    expect((await lightQuantaTourSpec(step))?.revealId).toBe("lq-01-phase-shifted");
    await expect(
      lightQuantaTourSpec({ ...step, reveal: { ...step.reveal, id: "lq-01-unequal-amplitudes" } }),
    ).rejects.toMatchObject({ code: "light-quanta-tour-binding" });
  });

  test("(lightQuantaTourSpec.ts:291) the lamp comparison refuses a different question or reveal", async () => {
    const step = stepFor("lq-08");
    expect((await lightQuantaTourSpec(step))?.revealId).toBe("double-power");
    await expect(lightQuantaTourSpec({ ...step, controlId: "frequency" })).rejects.toMatchObject({
      code: "light-quanta-tour-binding",
    });
  });

  test("(lightQuantaTourSpec.ts:199) the authored counting walkthrough must be present", async () => {
    await expect(
      lightQuantaTourSpec(stepFor("lq-05"), { walkthroughs: [], problems: [] }),
    ).rejects.toMatchObject({ code: "light-quanta-tour-tape" });
  });

  test("(lightQuantaTourSpec.ts:209) every checkpoint must replay, including the intermediate ten-independent case", async () => {
    const spec = await specFor("lq-05");
    expect(spec.initial).toMatchObject({ n: 10, f: 0.5, locked: false });
    for (const checkpoint of recording.checkpoints) {
      const changed = changedWalkthrough((catalogue) => ({
        ...catalogue,
        walkthroughs: catalogue.walkthroughs.map((walkthrough) =>
          walkthrough.tapeId !== recording.tapeId
            ? walkthrough
            : {
                ...walkthrough,
                checkpoints: walkthrough.checkpoints.map((candidate) =>
                  candidate.actionIndex !== checkpoint.actionIndex || !candidate.tape
                    ? candidate
                    : {
                        ...candidate,
                        tape: {
                          ...candidate.tape,
                          acceptedCheckpoint: {
                            ...candidate.tape.acceptedCheckpoint,
                            digest: "host:fnv1a64:0000000000000000",
                          },
                        },
                      },
                ),
              },
        ),
      }));
      await expect(lightQuantaTourSpec(stepFor("lq-05"), changed)).rejects.toMatchObject({
        code: "light-quanta-tour-tape",
      });
    }
  });

  test("(lightQuantaTourSpec.ts:232) a replayable sequence still needs both ten-independent and ten-locked stops", async () => {
    const onlyEnd: WalkthroughCatalogue = {
      walkthroughs: [{ ...recording, checkpoints: recording.checkpoints.slice(-1) }],
      problems: [],
    };
    await expect(lightQuantaTourSpec(stepFor("lq-05"), onlyEnd)).rejects.toMatchObject({
      code: "light-quanta-tour-tape",
    });
  });

  test("(lightQuantaTourSpec.ts:116) the wave worked example refuses settings the actual operation rejects", async () => {
    const spec = await specFor("lq-01");
    assert.ok(spec.id === "lq-01");
    await expect(
      lightQuantaWaveExample({ ...spec.initial, wavelength: 0 }),
    ).rejects.toMatchObject({ code: "light-quanta-tour-owner" });
  });

  test("(lightQuantaTourSpec.ts:97) a refused or pending calculation cannot become a worked comparison", async () => {
    const spec = await specFor("lq-08");
    const owner = createLightQuantaTourOwner(spec, "refused-worked-row");
    const accepted = owner.getSnapshot();
    expect(lightQuantaWorkedRow("good", "Good", accepted, { kind: "accepted" }).outputs.length).toBeGreaterThan(0);
    expect(() => lightQuantaWorkedRow("bad", "Bad", accepted, { kind: "refused" })).toThrow(
      "complete accepted calculation",
    );
    expect(() =>
      lightQuantaWorkedRow("pending", "Pending", { ...accepted, pending: true }, { kind: "accepted" }),
    ).toThrow("complete accepted calculation");
    expect(() =>
      lightQuantaWorkedRow("missing", "Missing", { ...accepted, accepted: null }, { kind: "accepted" }),
    ).toThrow("complete accepted calculation");
  });
});

describe("the compact controls use accepted owner state", () => {
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
    await act(() => required<HTMLButtonElement>(container, selector).click());
  }
  async function mount(
    id: LightQuantaTourId,
    options: { readingOnly?: boolean; instanceId?: string } = {},
  ) {
    const container = createContainer();
    const root = createRoot(container);
    roots.push(root);
    const spec = await specFor(id);
    await act(async () => {
      root.render(
        <LightQuantaTourInstrument
          step={stepFor(id)}
          spec={spec}
          instanceId={options.instanceId ?? "interactive-" + id}
          {...(options.readingOnly !== undefined ? { readingOnly: options.readingOnly } : {})}
        />,
      );
    });
    await act(async () => {
      await import("./LightQuantaTourViews.tsx");
    });
    return { container, root, spec };
  }
  const live = (container: ParentNode) => required<HTMLElement>(container, "[data-tour-owner]");
  const cell = (container: ParentNode, id: string) =>
    required<HTMLElement>(live(container), '[data-quantity-id="' + id + '"]');

  test("ten independent choices become one shared choice, without changing another instance", async () => {
    const first = await mount("lq-05", { instanceId: "first-count" });
    const second = await mount("lq-05", { instanceId: "second-count" });
    expect(Number(cell(first.container, "configurationProbability").dataset.value)).toBe(1 / 1024);
    await click(first.container, '[data-tour-control="ten-together"]');
    expect(Number(cell(first.container, "configurationProbability").dataset.value)).toBe(0.5);
    expect(cell(first.container, "configurationProbability").dataset.ownerId).toBe(
      "radiation.lockedPositionsProbability",
    );
    expect(live(first.container).textContent).toContain("Ideal model, host calculation");
    expect(Number(cell(second.container, "configurationProbability").dataset.value)).toBe(1 / 1024);
    expect(live(second.container).dataset.tourAction).toBe("ten-independent");
    expect(mathAndPhrasingHits(first.container.textContent ?? "")).toEqual([]);
  });

  test("doubling power doubles the emission rate and leaves the accepted electron energy unchanged", async () => {
    const { container } = await mount("lq-08");
    const energy = cell(container, "maxKineticEnergy").dataset.value;
    const count = Number(cell(container, "emissionRate").dataset.value);
    await click(container, '[data-tour-control="double-power"]');
    expect(cell(container, "maxKineticEnergy").dataset.value).toBe(energy);
    expect(Number(cell(container, "emissionRate").dataset.value)).toBe(2 * count);
    expect(live(container).dataset.tourAction).toBe("double-power");
    expect(live(container).textContent).toContain("Ideal model, host calculation");
    expect(mathAndPhrasingHits(container.textContent ?? "")).toEqual([]);
  });

  test("reading-only keeps the full comparison and loads no live owner until explicitly requested", async () => {
    const { container } = await mount("lq-08", { readingOnly: true });
    expect(container.querySelector("[data-tour-owner]")).toBeNull();
    expect(container.querySelector('[data-tour-worked-example="lq-08"] table')).not.toBeNull();
    await click(container, "[data-load-experiment]");
    expect(live(container).dataset.tourOwner).toBe("lq-08");
  });

  test("prediction is optional; a chosen candidate retains its real prompt identity without resetting the owner", async () => {
    const { container } = await mount("lq-08");
    await click(container, '[data-tour-control="double-power"]');
    expect(live(container).dataset.tourAction).toBe("double-power");
    const candidate = stepFor("lq-08").choices[0]!;
    await click(container, '[data-predict-candidate="' + candidate.candidateId + '"]');
    expect(
      readPredictionsDocument(createStorageContext()).prompts["lq-08"]?.[
        stepFor("lq-08").promptId
      ]?.prediction,
    ).toEqual({ form: "candidate", candidateId: candidate.candidateId });
    expect(live(container).dataset.tourAction).toBe("double-power");
    expect(live(container).textContent).toContain("You chose: " + candidate.text);
  });

  test("a phase request retains the old row and label until the actual worker owner accepts it, then releases its worker", async () => {
    const spec = await specFor("lq-01");
    assert.ok(spec.id === "lq-01");
    const pending: unknown[] = [];
    let receiver: ((message: unknown) => void) | null = null;
    let disposals = 0;
    const host = createLq01Host((message) => receiver?.(structuredClone(message)), spec.sourceDigest);
    const workerFactory = (): WorkerChannel => ({
      send(message) {
        pending.push(structuredClone(message));
      },
      listen(onMessage) {
        receiver = onMessage;
        queueMicrotask(() => host.hello());
        return () => {
          receiver = null;
        };
      },
      dispose() {
        disposals++;
        host.dispose();
      },
    });
    const container = createContainer();
    const root = createRoot(container);
    roots.push(root);
    await act(() =>
      root.render(
        <PresentationProvider presentation="tour">
          <LightQuantaTourView
            instanceId="wave-pending"
            mode={null}
            presentation="tour"
            spec={spec}
            step={stepFor("lq-01")}
            workerFactory={workerFactory}
          />
        </PresentationProvider>,
      ),
    );
    expect(pending.length).toBe(0);
    expect(Number(cell(container, "centerIntensity").dataset.value)).toBe(4);
    await click(container, '[data-tour-control="lq-01-phase-shifted"]');
    expect(live(container).getAttribute("aria-busy")).toBe("true");
    expect(live(container).dataset.tourAction).toBe("lq-01-equal-amplitudes");
    expect(Number(cell(container, "centerIntensity").dataset.value)).toBe(4);
    expect(pending.length).toBeGreaterThan(0);
    await act(async () => {
      for (const message of pending.splice(0)) await host.receive(message);
    });
    expect(live(container).dataset.tourAction).toBe("lq-01-phase-shifted");
    expect(Number(cell(container, "centerIntensity").dataset.value)).toBe(0);
    expect(live(container).textContent).toContain("Ideal model, host calculation");
    await act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    expect(disposals).toBe(1);
  });
});

test("refused settings leave the accepted action identity unchanged", async () => {
  const spec = await specFor("lq-08");
  const owner = createLightQuantaTourOwner(spec, "refused-preset");
  const before = owner.getSnapshot().accepted;
  expect(owner.apply({ ...spec.initial, incidentPower: -1 }).kind).toBe("refused");
  expect(owner.getSnapshot().accepted).toBe(before);
  expect(lightQuantaAcceptedAction(spec, owner.getSnapshot())?.id).toBe(spec.actions[0]?.id);
});
