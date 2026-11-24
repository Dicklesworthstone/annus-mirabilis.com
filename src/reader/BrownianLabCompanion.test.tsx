import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { display, scalar } from "../components/lab/presentation.ts";
import { EquationScope } from "../equations/EquationScope.tsx";
import { SemanticEquation } from "../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../equations/viewTypes.ts";
import equationPayload from "../generated/bm01-equations.json";
import {
  type Bm01ReplayFixture,
  bm01Laboratory,
  bm01ReplayFixture,
} from "../testing/bm01ReplayHarness.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { BrownianLabCompanion } from "./BrownianLabCompanion.tsx";
import {
  type BrownianLabContextValue,
  BrownianLabProvider,
  useBrownianLab,
} from "./BrownianLabContext.tsx";
import { BrownianReaderInvestigation } from "./BrownianReaderInvestigation.tsx";
import { createBrownianLabSession, type SharedBrownianLab } from "./brownianLabSession.ts";
import { LazyInlineTracerLab } from "./LazyInlineTracerLab.tsx";
import { PinnedEquationProvider, usePinnedEquations } from "./layout/PinnedEquationContext.tsx";
import type { PinnedEquationStore } from "./layout/pinnedEquationStore.ts";

const rms = (equationPayload.equations as readonly CompiledEquation[]).find(
  (equation) => equation.id === "eq-model-bm-rms",
);
assert.ok(rms);
const rmsEquation = rms;

describe("the Brownian reader's actual compact laboratory", () => {
  let fixture: Bm01ReplayFixture;
  let lab: ReturnType<typeof bm01Laboratory>;
  let shared: SharedBrownianLab;
  let root: Root | null;
  let container: HTMLElement;
  let loads: number;
  let current: BrownianLabContextValue | null;
  let pins: PinnedEquationStore | null;

  beforeAll(async () => {
    fixture = await bm01ReplayFixture();
  });
  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    window.history.replaceState({}, "", "/papers/brownian-motion/s5/#kept-passage");
    lab = bm01Laboratory(fixture, { hold: () => true });
    shared = createBrownianLabSession(lab.session, fixture.example);
    loads = 0;
    current = null;
    pins = null;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    shared.dispose();
    await uninstallDom();
  });

  function Probe() {
    current = useBrownianLab();
    pins = usePinnedEquations();
    return null;
  }
  const loader = async () => {
    loads++;
    return shared;
  };
  function Reader() {
    return (
      <BrownianReaderInvestigation active>
        <BrownianLabProvider loadLaboratory={loader}>
          <PinnedEquationProvider>
            <div data-reader-root>
              <p id="kept-passage" data-unit="kept-passage">
                The passage remains mounted.
              </p>
              <section id="passage-equation">
                <EquationScope scope="test-passage" scopeLabel="passage">
                  <SemanticEquation equation={rmsEquation} />
                </EquationScope>
              </section>
              <BrownianLabCompanion slot="column">
                <p>Notes beside the passage</p>
              </BrownianLabCompanion>
              <BrownianLabCompanion slot="sheet">
                <p>Notes beside the passage</p>
              </BrownianLabCompanion>
              <LazyInlineTracerLab revealForAnchor="lab-bm-01" />
              <Probe />
            </div>
          </PinnedEquationProvider>
        </BrownianLabProvider>
      </BrownianReaderInvestigation>
    );
  }
  function context() {
    assert.ok(current);
    return current;
  }
  function companion(slot = "column") {
    const element = container.querySelector<HTMLElement>(
      '[data-brownian-companion="' + slot + '"]',
    );
    assert.ok(element);
    return element;
  }
  function panel(slot = "column") {
    const element = container.querySelector<HTMLElement>(
      '[data-brownian-lab-panel="' + slot + '"]',
    );
    assert.ok(element);
    return element;
  }
  function button(region: Element, label: string) {
    const element = [...region.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    assert.ok(element, label);
    return element;
  }
  async function click(region: Element, label: string) {
    await act(async () => button(region, label).click());
  }
  function input(region: Element, name: string) {
    const element = region.querySelector<HTMLInputElement>('input[name="' + name + '"]');
    assert.ok(element);
    return element;
  }
  async function edit(element: HTMLInputElement, value: string) {
    const key = Object.keys(element).find((name) => name.startsWith("__reactProps$"));
    assert.ok(key);
    const props = (element as unknown as Record<string, { onChange(event: unknown): void }>)[key];
    assert.ok(props);
    await act(async () => {
      element.value = value;
      props.onChange({ target: element, currentTarget: element });
    });
  }
  async function submit(element: HTMLInputElement) {
    const form = element.closest("form");
    assert.ok(form);
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }
  async function until(check: () => boolean) {
    for (let attempt = 0; attempt < 200 && !check(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    expect(check()).toBe(true);
  }
  async function render() {
    await act(async () =>
      root?.render(
        <StrictMode>
          <Reader />
        </StrictMode>,
      ),
    );
  }
  async function open() {
    await click(companion(), "Laboratory");
    await until(() => container.querySelectorAll("[data-brownian-lab-panel]").length === 2);
  }
  function outputs(region: Element) {
    return ["diffusionCoefficient", "rmsDisplacement1d", "sampleRms"].map(
      (quantity) => region.querySelector('[data-output="' + quantity + '"]')?.textContent,
    );
  }

  test("server markup keeps the notes; opening both responsive views loads one owner even in StrictMode", async () => {
    const html = renderToStaticMarkup(<Reader />);
    expect(loads).toBe(0);
    expect(html).toContain("Notes beside the passage");
    expect(html).not.toContain("data-brownian-lab-panel");
    expect(html).not.toContain("tracerPositions");
    await render();
    const passage = container.querySelector("#kept-passage");
    const location = window.location.href;
    expect(loads).toBe(0);
    await open();
    expect(loads).toBe(1);
    expect(lab.channels).toHaveLength(0);
    expect(panel().dataset.instanceId).toBe(lab.session.getSnapshot().accepted?.instanceId);
    expect(panel("sheet").dataset.instanceId).toBe(panel().dataset.instanceId);
    expect(outputs(panel())).toEqual(outputs(panel("sheet")));
    await click(companion(), "Notes");
    expect(companion("sheet").dataset.companionMode).toBe("notes");
    await click(companion("sheet"), "Laboratory");
    expect(loads).toBe(1);
    expect(container.querySelector("#kept-passage")).toBe(passage);
    expect(window.location.href).toBe(location);
  });

  test("shared drafts and accepted readings follow the genuine numerical owner without a second run", async () => {
    await render();
    await open();
    const before = lab.session.getSnapshot().accepted;
    assert.ok(before);
    const readings = outputs(panel());
    await edit(input(panel(), "a"), "1");
    expect(input(panel("sheet"), "a").value).toBe("1");
    expect(lab.session.getSnapshot().accepted).toBe(before);
    await submit(input(panel(), "a"));
    await until(() => (lab.channels[0]?.results.length ?? 0) > 0);
    expect(lab.session.getSnapshot().pending).toBe(true);
    expect(outputs(panel())).toEqual(readings);
    expect(panel().textContent).toContain("last accepted");
    await act(async () => lab.channels[0]?.release());
    await until(() => !lab.session.getSnapshot().pending);
    const accepted = lab.session.getSnapshot().accepted;
    assert.ok(accepted);
    expect(accepted.parameters.a).toBe(1e-6);
    expect(accepted.instanceId).toBe(before.instanceId);
    expect(outputs(panel())).toEqual([
      display(scalar(accepted, "diffusionCoefficient"), 1e12),
      display(scalar(accepted, "rmsDisplacement1d"), 1e6),
      display(scalar(accepted, "sampleRms"), 1e6),
    ]);
    expect(outputs(panel("sheet"))).toEqual(outputs(panel()));
    expect(lab.channels).toHaveLength(1);
    await act(async () => root?.unmount());
    root = null;
    expect(lab.channels[0]?.disposed).toBe(true);
  }, 20_000);

  test("refused compact settings retain the exact accepted result and shared draft until reset", async () => {
    await render();
    await open();
    const accepted = lab.session.getSnapshot().accepted;
    const readings = outputs(panel());
    await edit(input(panel(), "a"), "-1");
    await submit(input(panel(), "a"));
    expect(panel().querySelector("[data-apply-failure]")).not.toBeNull();
    expect(lab.session.getSnapshot().accepted).toBe(accepted);
    expect(outputs(panel())).toEqual(readings);
    expect(input(panel("sheet"), "a").value).toBe("-1");
    expect(lab.channels).toHaveLength(0);
    await click(panel("sheet"), "Use accepted tracer settings");
    expect(panel().querySelector("[data-apply-failure]")).toBeNull();
    expect(input(panel(), "a").value).toBe(String(fixture.example.parameters.a * 1e6));
  });

  test("the full inline controls reuse the compact owner, follow clean fields and preserve dirty fields", async () => {
    await render();
    await open();
    const disclosure = container.querySelector<HTMLDetailsElement>('[data-inline-lab="bm-01"]');
    assert.ok(disclosure);
    await act(async () => {
      disclosure.open = true;
      disclosure.dispatchEvent(new Event("toggle"));
    });
    await until(
      () => container.querySelector('[data-inline-lab="bm-01"] input[name="a"]') !== null,
    );
    const fullRadius = input(disclosure, "a");
    expect(loads).toBe(1);
    await edit(input(panel(), "a"), "1");
    await submit(input(panel(), "a"));
    await until(() => (lab.channels[0]?.results.length ?? 0) > 0);
    await act(async () => lab.channels[0]?.release());
    await until(() => !lab.session.getSnapshot().pending);
    expect(fullRadius.value).toBe("1");

    await edit(fullRadius, "1.5");
    await edit(input(panel(), "a"), "2");
    await submit(input(panel(), "a"));
    await until(
      () => !lab.session.getSnapshot().pending && lab.session.acceptedParameters().a === 2e-6,
    );
    expect(fullRadius.value).toBe("1.5");
    expect(input(panel("sheet"), "a").value).toBe("2");
    expect(lab.channels).toHaveLength(1);
    await submit(fullRadius);
    await until(
      () => !lab.session.getSnapshot().pending && lab.session.acceptedParameters().a === 1.5e-6,
    );
    expect(input(panel(), "a").value).toBe("1.5");
    expect(input(panel("sheet"), "a").value).toBe("1.5");
    expect(panel().dataset.instanceId).toBe(
      disclosure.querySelector<HTMLElement>('[data-instrument-id="bm-01"]')?.dataset.instanceId,
    );
  }, 20_000);

  test("a real passage equation stays pinned with its selected term while companion modes change", async () => {
    await render();
    await open();
    await edit(input(panel(), "a"), "0.75");
    const passage = container.querySelector("#kept-passage");
    const location = window.location.href;
    const pin = container.querySelector<HTMLButtonElement>(
      '#passage-equation [data-pin-equation="eq-model-bm-rms"]',
    );
    assert.ok(pin);
    await act(async () => pin.click());
    assert.ok(pins);
    const pinned = pins.getSnapshot().pinned;
    assert.ok(pinned);
    const term = rmsEquation.terms.find((item) => item.quantityId === "diffusionCoefficient");
    assert.ok(term);
    const selection = {
      nodeId: rmsEquation.paper + "/" + term.termId,
      quantityId: term.quantityId,
      kind: "term" as const,
    };
    await act(async () => pinned.context.store.select(selection));
    expect(companion().dataset.companionMode).toBe("equation");
    expect(companion("sheet").dataset.companionMode).toBe("equation");
    await click(companion(), "Notes");
    await click(companion("sheet"), "Laboratory");
    expect(input(panel(), "a").value).toBe("0.75");
    expect(pins.getSnapshot().pinned?.context.store.getSnapshot()).toEqual(selection);
    expect(container.querySelector("#kept-passage")).toBe(passage);
    expect(window.location.href).toBe(location);
    expect(context().laboratory).toBe(shared);
    expect(loads).toBe(1);
    expect(lab.channels).toHaveLength(0);
  });
});
