import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTour, mathAndPhrasingHits } from "../../content/tours/tours.ts";
import { ME01_DEFAULTS } from "../../experiments/me01/definition.ts";
import { createMe01Session } from "../../experiments/me01/session.ts";
import { TEACHING_TAPES } from "../../experiments/permalink/teachingTapeCatalogue.ts";
import type { TapeV2 } from "../../experiments/permalink/types.ts";
import { LOCAL_PREDICT_PERSISTENCE } from "../../experiments/predict/localPredictPersistence.ts";
import { installPredictPersistence } from "../../experiments/predict/predictPersistence.ts";
import { readPredictionsDocument } from "../../experiments/predict/predictStorage.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { createContainer, installDom, uninstallDom } from "../../testing/reactDom.ts";
import { MassEnergyTourInstrument } from "./MassEnergyTourInstrument.tsx";
import {
  type MassEnergyTourId,
  type MassEnergyTourSpec,
  massEnergyTourSpec,
  type TourInstrumentStep,
  tourWorkedRow,
} from "./massEnergyTourSpec.ts";

const tour = loadTour(process.cwd(), "fifteen-minutes-mass-energy")?.tour;
assert.ok(tour);
const steps = tour.steps.filter((step): step is TourInstrumentStep => step.kind === "instrument");
function stepFor(id: MassEnergyTourId): TourInstrumentStep {
  const step = steps.find((candidate) => candidate.instrumentId === id);
  assert.ok(step);
  return step;
}
function specFor(id: MassEnergyTourId): MassEnergyTourSpec {
  const spec = massEnergyTourSpec(stepFor(id));
  assert.ok(spec);
  return spec;
}
const tape = TEACHING_TAPES.get("toward-low-speed");
assert.ok(tape);
function withTape(changed: TapeV2): ReadonlyMap<string, TapeV2> {
  return new Map([["toward-low-speed", changed]]);
}
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

describe("the mass–energy tour's authored bindings and no-JavaScript surface", () => {
  test("all three owners retain questions, native answers, useful worked tables, and plain-word labels", () => {
    for (const id of ["me-01", "me-02", "me-03"] as const) {
      const step = stepFor(id);
      const spec = specFor(id);
      const html = renderToStaticMarkup(
        <MassEnergyTourInstrument step={step} spec={spec} instanceId={`static-${id}`} />,
      );
      expect(html).toContain(`data-instrument-id="${id}"`);
      expect(html).toContain(`data-tour-worked-example="${id}"`);
      expect(html).not.toContain("data-tour-owner=");
      expect(html).toContain("Static worked example");
      expect(html).toContain("<table>");
      expect(html).toContain(`href="/lab/${id}/"`);
      for (const choice of step.choices)
        expect(html).toContain(`data-candidate-id="${choice.candidateId}"`);
      for (const row of spec.workedRows) expect(html).toContain(`data-tour-result-row="${row.id}"`);
      expect(mathAndPhrasingHits(visibleText(html))).toEqual([]);
      expect(html).not.toMatch(/class="katex|<math/);
    }
  });

  test("(massEnergyTourSpec.ts:119) the two-flash prompt accepts its tilt preset and refuses a different existing preset", () => {
    const step = stepFor("me-01");
    const accepted = massEnergyTourSpec(step);
    expect(accepted?.revealId).toBe("me-01-sixty-degree-tilt");
    expect(
      accepted?.actions.find((action) => action.id === step.reveal.id)?.parameters,
    ).toMatchObject({
      emissionAngle: 60,
    });
    assert.throws(
      () =>
        massEnergyTourSpec({
          ...step,
          reveal: { ...step.reveal, id: "me-01-transverse-emission" },
        }),
      {
        name: "MassEnergyTourBindingError",
        code: "mass-energy-tour-binding",
        message: "The two-flash tour must use its authored tilt prompt and preset.",
      },
    );
  });

  test("(massEnergyTourSpec.ts:263) the sealed-box prompt accepts its internal-transfer preset and refuses the externally heated box", () => {
    const step = stepFor("me-03");
    const accepted = massEnergyTourSpec(step);
    expect(accepted?.revealId).toBe("me-03-sealed-lamp-and-mirror");
    expect(
      accepted?.actions.find((action) => action.id === step.reveal.id)?.parameters,
    ).toMatchObject({
      boundary: "combined-isolated-system",
      disposition: "retained",
      inputEnergy: 0,
    });
    assert.throws(
      () =>
        massEnergyTourSpec({ ...step, reveal: { ...step.reveal, id: "me-03-heated-sealed-box" } }),
      {
        name: "MassEnergyTourBindingError",
        code: "mass-energy-tour-binding",
        message: "The sealed-box tour must use its authored lamp-and-mirror prompt and preset.",
      },
    );
  });

  test("an instrument from another paper retains its full-laboratory fallback", () => {
    expect(massEnergyTourSpec({ ...stepFor("me-01"), instrumentId: "bm-01" })).toBeNull();
  });

  test("(massEnergyTourSpec.ts:183) a compatible tape is accepted, while missing or changed-source tapes are refused", () => {
    expect(specFor("me-02").actions.map((action) => action.tapeActionIndex)).toEqual([
      0,
      ...tape.events.map((event) => event.actionIndex),
    ]);
    for (const catalogue of [
      new Map<string, TapeV2>(),
      withTape({
        ...tape,
        modelIdentity: { ...tape.modelIdentity, artifactDigest: `host:sha256:${"f".repeat(64)}` },
      }),
    ]) {
      assert.throws(() => massEnergyTourSpec(stepFor("me-02"), catalogue), {
        name: "MassEnergyTourBindingError",
        code: "mass-energy-tour-tape",
        message: "The low-speed tour needs its compatible authored teaching tape.",
      });
    }
  });

  test("(massEnergyTourSpec.ts:194) the tape's valid opening is accepted, while invalid opening settings cannot become a worked example", () => {
    expect(specFor("me-02").initial).toMatchObject({ beta: 0.6, energyUnit: "normalized" });
    for (const initialConditions of [
      { beta: 1, emittedEnergy: 1 },
      { beta: 0.6, emittedEnergy: 1, energyUnit: "joule" },
    ]) {
      assert.throws(
        () => massEnergyTourSpec(stepFor("me-02"), withTape({ ...tape, initialConditions })),
        {
          name: "MassEnergyTourBindingError",
          code: "mass-energy-tour-tape",
          message: "The low-speed tape must begin with accepted comparison units.",
        },
      );
    }
  });

  test("(massEnergyTourSpec.ts:210) the sequence accepts speed events and refuses other commands or invalid speeds", () => {
    const first = tape.events[0];
    assert.ok(first);
    expect(specFor("me-02").actions[1]?.parameters).toMatchObject({ beta: first.value });
    for (const event of [
      { ...first, commandClass: "measurement-change" as const },
      { ...first, value: 1 },
    ]) {
      assert.throws(
        () => massEnergyTourSpec(stepFor("me-02"), withTape({ ...tape, events: [event] })),
        {
          name: "MassEnergyTourBindingError",
          code: "mass-energy-tour-tape",
          message: "The low-speed tour can only step through accepted observer-speed controls.",
        },
      );
    }
  });

  test("worked rows require an accepted calculation and never reuse the previous values after refusal", () => {
    const owner = createMe01Session("worked-refusal");
    const accepted = owner.apply(ME01_DEFAULTS);
    expect(tourWorkedRow("accepted", "Accepted", owner.getSnapshot(), accepted).outputs).toBe(
      owner.getSnapshot().accepted?.outputs,
    );
    const refused = owner.apply({ ...ME01_DEFAULTS, frameSpeed: 1 });
    assert.throws(() => tourWorkedRow("refused", "Refused", owner.getSnapshot(), refused), {
      name: "MassEnergyTourBindingError",
      code: "mass-energy-tour-owner",
    });
    assert.throws(
      () => tourWorkedRow("empty", "Empty", { ...owner.getSnapshot(), accepted: null }, accepted),
      {
        name: "MassEnergyTourBindingError",
        code: "mass-energy-tour-owner",
      },
    );
  });
});

describe("the tour's live comparisons", () => {
  const roots: Root[] = [];
  beforeEach(async () => {
    await installDom();
    installPredictPersistence(LOCAL_PREDICT_PERSISTENCE);
  });
  afterEach(async () => {
    for (const root of roots.splice(0)) await act(() => root.unmount());
    await uninstallDom();
  });

  function required<T extends Element = HTMLElement>(container: ParentNode, selector: string): T {
    const element = container.querySelector<T>(selector);
    assert.ok(element, `Missing ${selector}`);
    return element;
  }
  async function click(container: ParentNode, selector: string) {
    await act(() => required<HTMLButtonElement>(container, selector).click());
  }
  async function mount(
    id: MassEnergyTourId,
    options: { spec?: MassEnergyTourSpec; readingOnly?: boolean; instanceId?: string } = {},
  ) {
    const container = createContainer();
    const root = createRoot(container);
    roots.push(root);
    const spec = options.spec ?? specFor(id);
    const step = stepFor(id);
    const instanceId = options.instanceId ?? `interactive-${id}`;
    const render = () => (
      <MassEnergyTourInstrument
        step={step}
        spec={spec}
        instanceId={instanceId}
        {...(options.readingOnly !== undefined ? { readingOnly: options.readingOnly } : {})}
      />
    );
    await act(async () => {
      root.render(render());
    });
    // The actual dispatch loader is asynchronous; flush its import before inspecting its owner.
    await act(async () => {
      await import("./MassEnergyTourViews.tsx");
    });
    return { container, root, render };
  }
  const live = (container: ParentNode) => required<HTMLElement>(container, "[data-tour-owner]");
  const cell = (container: ParentNode, id: string) =>
    required<HTMLElement>(live(container), `[data-quantity-id="${id}"]`);
  function plain(container: HTMLElement) {
    expect(mathAndPhrasingHits(container.textContent ?? "")).toEqual([]);
    expect(container.querySelector("math, .katex")).toBeNull();
  }

  test("tilting the real pair preserves the accepted sum, earns the host label, and leaves another placement alone", async () => {
    const first = await mount("me-01", { instanceId: "first-pair" });
    const second = await mount("me-01", { instanceId: "second-pair" });
    const before = live(first.container).dataset.snapshotVersion;
    expect(cell(first.container, "lightComplexEnergyMoving").dataset.value).toBe("1.25");
    expect(live(first.container).textContent).toContain("Static worked example");
    await click(first.container, '[data-tour-control="me-01-sixty-degree-tilt"]');
    expect(live(first.container).dataset.tourAction).toBe("me-01-sixty-degree-tilt");
    expect(live(first.container).dataset.snapshotVersion).not.toBe(before);
    expect(cell(first.container, "lightComplexEnergyMoving").dataset.ownerId).toBe(
      "massEnergy.movingBalanceLight",
    );
    expect(cell(first.container, "lightComplexEnergyMoving").dataset.value).toBe("1.25");
    expect(cell(first.container, "kineticEnergyDifference").dataset.value).toBe("0.25");
    expect(live(first.container).textContent).toContain("Ideal model, host calculation");
    expect(live(second.container).dataset.tourAction).toBe("me-01-default");
    expect(live(second.container).dataset.snapshotVersion).toBe(before);
    await click(first.container, '[data-tour-control="me-01-transverse-emission"]');
    expect(cell(first.container, "lightComplexEnergyMoving").dataset.value).toBe("1.25");
    const after = live(first.container).dataset.snapshotVersion;
    await act(() => first.root.render(first.render()));
    expect(live(first.container).dataset.snapshotVersion).toBe(after);
    expect(live(first.container).dataset.instanceId).toBe("first-pair");
    plain(first.container);
  });

  test("the declared speed sequence approaches the limit and never substitutes zero for an undefined finite-speed estimate", async () => {
    const { container } = await mount("me-02");
    let previous = Number(cell(container, "finiteSpeedMassProxy").dataset.value);
    for (const event of tape.events) {
      await click(container, "[data-tour-next]");
      expect(live(container).dataset.tapeActionIndex).toBe(String(event.actionIndex));
      expect(live(container).dataset.tourAction).toBe(`action-${event.actionIndex}`);
      const finite = cell(container, "finiteSpeedMassProxy");
      if (event.value === 0) {
        expect(finite.dataset.status).toBe("not-applicable");
        expect(finite.hasAttribute("data-value")).toBe(false);
        expect(finite.textContent).toContain("not defined");
      } else {
        const current = Number(finite.dataset.value);
        expect(current).toBeGreaterThan(1);
        expect(current).toBeLessThan(previous);
        previous = current;
      }
      expect(cell(container, "inertialMassDecrease").dataset.status).toBe("analytic-limit");
      expect(cell(container, "inertialMassDecrease").dataset.value).toBe("1");
      expect(cell(container, "inertialMassDecrease").textContent).toContain("Analytic limit");
      plain(container);
    }
    expect(container.querySelector("[data-tour-next]")).toBeNull();
    await click(container, '[data-tour-control="opening"]');
    expect(cell(container, "finiteSpeedMassProxy").dataset.status).toBe("value");
    expect(Number(cell(container, "finiteSpeedMassProxy").dataset.value)).toBeCloseTo(
      1.3888888889,
      9,
    );
  });

  test("changing the selected boundary compares the same sealed system without starting another physical run", async () => {
    const { container } = await mount("me-03");
    const runId = live(container).dataset.runId;
    const revision = live(container).dataset.inputRevision;
    expect(cell(container, "energyChange").dataset.value).toBe("-1");
    expect(cell(container, "massChange").textContent).toBe("Decreases");
    await click(container, '[data-reveal-action="me-03-sealed-lamp-and-mirror"]');
    expect(cell(container, "energyChange").dataset.value).toBe("0");
    expect(cell(container, "massChange").textContent).toBe("Unchanged");
    expect(cell(container, "systemEnergyChange").dataset.value).toBe("0");
    expect(live(container).dataset.runId).toBe(runId);
    expect(live(container).dataset.inputRevision).toBe(revision);
    await click(container, '[data-tour-control="body-alone"]');
    expect(cell(container, "massChange").textContent).toBe("Decreases");
    expect(cell(container, "systemEnergyChange").dataset.value).toBe("0");
    plain(container);
  });

  test("reading-only retains the worked table and waits for the dispatcher's explicit load action", async () => {
    const { container } = await mount("me-01", { readingOnly: true });
    expect(container.querySelector("[data-tour-owner]")).toBeNull();
    expect(container.querySelector("[data-tour-worked-example] table")).not.toBeNull();
    await click(container, "[data-load-experiment]");
    expect(live(container).dataset.presentation).toBe("tour");
    await click(container, '[data-tour-control="me-01-sixty-degree-tilt"]');
    expect(cell(container, "lightComplexEnergyMoving").dataset.value).toBe("1.25");
    expect(container.querySelector("[data-tour-worked-example] table")).not.toBeNull();
  });

  test("an inadmissible control preserves the previous owner identity and exposes the refusal", async () => {
    const spec = specFor("me-01");
    assert.ok(spec.id === "me-01");
    const invalid: MassEnergyTourSpec = {
      ...spec,
      actions: spec.actions.map((action, index) =>
        index === 1 ? { ...action, parameters: { ...action.parameters, frameSpeed: 1 } } : action,
      ),
    };
    const { container } = await mount("me-01", { spec: invalid });
    const version = live(container).dataset.snapshotVersion;
    await click(container, '[data-tour-control="me-01-sixty-degree-tilt"]');
    expect(live(container).dataset.snapshotVersion).toBe(version);
    expect(live(container).dataset.tourAction).toBe("me-01-default");
    expect(cell(container, "lightComplexEnergyMoving").dataset.value).toBe("1.25");
    expect(live(container).querySelector('[data-currency-state="refused"]')).not.toBeNull();
    expect(
      live(container).querySelector('[role="alert"][data-refusal-code="invalid-parameter"]'),
    ).not.toBeNull();
    plain(container);
  });

  test("a missing source identity cannot earn a live calculation label", async () => {
    const { container } = await mount("me-01", {
      spec: { ...specFor("me-01"), sourceDigest: "source:sha256:default" },
    });
    await click(container, '[data-tour-control="me-01-sixty-degree-tilt"]');
    expect(live(container).querySelector('[data-execution-label="unavailable"]')).not.toBeNull();
    expect(
      live(container).querySelector(
        '[data-execution-label="host"], [data-execution-label="frankensim"]',
      ),
    ).toBeNull();
  });

  test("a candidate is kept under its real prompt identity without scoring, resetting the owner, or silently revising the choice", async () => {
    const { container } = await mount("me-01");
    const version = live(container).dataset.snapshotVersion;
    const candidate = "me-01-candidate-sum-unchanged";
    await click(container, `[data-predict-candidate="${candidate}"]`);
    const doc = readPredictionsDocument(createStorageContext());
    expect(doc.prompts["me-01"]?.[stepFor("me-01").promptId]?.prediction).toEqual({
      form: "candidate",
      candidateId: candidate,
    });
    expect(live(container).dataset.snapshotVersion).toBe(version);
    expect(live(container).textContent).toContain("You chose: It stays the same.");
    const another = required<HTMLButtonElement>(
      container,
      '[data-predict-candidate="me-01-candidate-sum-increases"]',
    );
    expect(another.disabled).toBe(true);
    await act(() => another.click());
    expect(
      readPredictionsDocument(createStorageContext()).prompts["me-01"]?.[stepFor("me-01").promptId]
        ?.prediction,
    ).toEqual({ form: "candidate", candidateId: candidate });
    expect(live(container).textContent).not.toMatch(/\bCorrect!|\bIncorrect!|Your score/);
    await click(container, '[data-tour-control="me-01-sixty-degree-tilt"]');
    expect(live(container).textContent).toContain("Ideal model, host calculation");
  });

  test("keeping an answer private records no candidate and leaves every control usable", async () => {
    const { container } = await mount("me-03");
    const keep = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "I have a prediction in mind",
    );
    assert.ok(keep);
    await act(() => keep.click());
    expect(
      readPredictionsDocument(createStorageContext()).prompts["me-03"]?.[stepFor("me-03").promptId],
    ).toEqual({ status: "predicted-unrecorded" });
    expect(live(container).textContent).toContain("Your prediction stays with you");
    await click(container, '[data-tour-control="me-03-sealed-lamp-and-mirror"]');
    expect(cell(container, "massChange").textContent).toBe("Unchanged");
  });

  test("skipping prediction also leaves the tape sequence available", async () => {
    const { container } = await mount("me-02");
    const skip = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Explore without recording a prediction",
    );
    assert.ok(skip);
    await act(() => skip.click());
    expect(
      readPredictionsDocument(createStorageContext()).prompts["me-02"]?.[stepFor("me-02").promptId],
    ).toEqual({ status: "skipped" });
    await click(container, "[data-tour-next]");
    expect(live(container).dataset.tapeActionIndex).toBe("1");
    expect(live(container).textContent).toContain("Explore freely. No prediction was recorded.");
  });
});
