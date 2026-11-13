import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PPE_TASK } from "../discovery/brownian/journeyII.ts";
import {
  DiscoveryInvestigationProvider,
  useDiscoveryInvestigation,
} from "../discovery/investigation/context.tsx";
import type { InvestigationStore } from "../discovery/investigation/core.ts";
import { KeptInvestigations } from "../discovery/investigation/KeptInvestigations.tsx";
import { readStoredInvestigation } from "../discovery/investigation/persistence.ts";
import { INVESTIGATIONS } from "../discovery/investigation/specs.ts";
import { PpeTask } from "../discovery/PpeTask.tsx";
import { createBm01Session } from "../experiments/bm01/session.ts";
import { bm01Laboratory, bm01ReplayFixture } from "../testing/bm01ReplayHarness.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import {
  BrownianChapterPractice,
  BrownianReaderInvestigation,
} from "./BrownianReaderInvestigation.tsx";
import InlineTracerLab from "./InlineTracerLab.tsx";
import { LazyInlineTracerLab } from "./LazyInlineTracerLab.tsx";

describe("the chapter investigation shares the inline tracer's accepted owner", () => {
  let root: Root | undefined;
  let store: InvestigationStore | null;
  let labs: ReturnType<typeof bm01Laboratory>[];
  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    window.history.replaceState({}, "", "/papers/brownian-motion/s5/");
    store = null;
    labs = [];
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    for (const lab of labs) lab.session.disconnect();
    await uninstallDom();
  });
  function Probe() {
    store = useDiscoveryInvestigation();
    return null;
  }
  async function until(check: () => boolean) {
    for (let attempt = 0; attempt < 200 && !check(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    expect(check()).toBe(true);
  }
  function button(label: string) {
    const found = [...document.querySelectorAll("button")].find(
      (element) => element.textContent?.trim() === label,
    );
    assert.ok(found, label);
    return found;
  }
  async function click(label: string) {
    await act(async () => button(label).click());
  }
  async function openWorkspace() {
    const disclosure = document.querySelector<HTMLDetailsElement>(".investigation-disclosure");
    assert.ok(disclosure);
    await act(async () => {
      disclosure.open = true;
      disclosure.dispatchEvent(new Event("toggle"));
    });
    await until(() => document.querySelector('textarea[id$="-prediction"]') !== null);
  }

  test("a closed lazy laboratory cannot supply an invented starting reading", async () => {
    await act(async () =>
      root?.render(
        <BrownianReaderInvestigation active>
          <BrownianChapterPractice />
          <LazyInlineTracerLab />
          <Probe />
        </BrownianReaderInvestigation>,
      ),
    );
    await openWorkspace();
    assert.ok(store);
    expect(store.getSnapshot().current).toBeNull();
    expect(button("Pin prediction and starting reading").disabled).toBe(true);
    expect(document.querySelector('[data-instrument-id="bm-01"]')).toBeNull();
    expect(readStoredInvestigation("brownian-motion").status).toBe("missing");
  });

  for (const deepLink of [false, true]) {
    test(`${deepLink ? "a direct chapter-laboratory hash" : "the task's laboratory link"} opens the lazy ensemble and a repeat visit preserves its owner`, async () => {
      const target = INVESTIGATIONS["brownian-motion"].laboratoryAnchor;
      if (deepLink) window.history.replaceState({}, "", `/papers/brownian-motion/s5/#${target}`);
      await act(async () =>
        root?.render(
          <BrownianReaderInvestigation active>
            <BrownianChapterPractice />
            <LazyInlineTracerLab revealForAnchor={target} />
            <Probe />
          </BrownianReaderInvestigation>,
        ),
      );
      const link = document.querySelector<HTMLAnchorElement>(`a[href="#${target}"]`);
      assert.ok(link);
      if (!deepLink) await act(async () => link.click());
      await until(() => document.querySelector('[data-instrument-id="bm-01"]') !== null);
      const disclosure = document.querySelector<HTMLDetailsElement>('[data-inline-lab="bm-01"]');
      assert.ok(disclosure);
      expect(disclosure.open).toBe(true);
      assert.ok(store);
      const accepted = store.getSnapshot().current;
      assert.ok(accepted);
      expect(accepted.origin).toBe("prepared-worked-example");
      await act(async () => {
        disclosure.open = false;
        disclosure.dispatchEvent(new Event("toggle"));
      });
      await act(async () => link.click());
      expect(disclosure.open).toBe(true);
      expect(store.getSnapshot().current).toEqual(accepted);
    });
  }

  test("pin, apply, capture, explain and reopen preserve the real readings across reader, Discover and notebook", async () => {
    const fixture = await bm01ReplayFixture();
    const lab = bm01Laboratory(fixture, { hold: () => true });
    labs.push(lab);
    const session = createBm01Session("chapter-inline-tracer", fixture.example, lab.factory);
    await act(async () =>
      root?.render(
        <BrownianReaderInvestigation active>
          <BrownianChapterPractice />
          <InlineTracerLab session={session} example={fixture.example} />
          <Probe />
        </BrownianReaderInvestigation>,
      ),
    );
    await openWorkspace();
    assert.ok(store);
    const owner = store;
    const prediction = document.querySelector<HTMLTextAreaElement>('textarea[id$="-prediction"]');
    assert.ok(prediction);
    prediction.value = "The displacement should fall by less than half.";
    await click("Pin prediction and starting reading");
    const baseline = owner.getSnapshot().report?.baseline.reading;
    assert.ok(baseline);
    expect(baseline.instanceId).toBe(session.getSnapshot().accepted?.instanceId);
    expect(baseline.origin).toBe("prepared-worked-example");

    // Use the inline laboratory's actual form. The only test control holds worker delivery,
    // so the workspace must refuse to capture while the real numerical owner is still pending.
    const radius = document.querySelector<HTMLInputElement>('input[name="a"]');
    assert.ok(radius);
    const propsKey = Object.keys(radius).find((key) => key.startsWith("__reactProps$"));
    assert.ok(propsKey);
    const props = (radius as unknown as Record<string, { onChange(event: unknown): void }>)[
      propsKey
    ];
    assert.ok(props);
    await act(async () => {
      radius.value = "1";
      props.onChange({ target: radius, currentTarget: radius });
    });
    const form = radius.closest("form");
    assert.ok(form);
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    await until(() => (lab.channels[0]?.results.length ?? 0) > 0);
    expect(session.getSnapshot().pending).toBe(true);
    expect(button("Capture changed reading").disabled).toBe(true);
    expect(owner.getSnapshot().current).toBeNull();
    expect(owner.getSnapshot().report?.observations).toEqual([]);
    await act(async () => lab.channels[0]?.release());
    await until(() => !session.getSnapshot().pending);
    await click("Capture changed reading");
    const changed = owner.getSnapshot().report?.observations[0]?.reading;
    assert.ok(changed);
    expect(changed.instanceId).toBe(baseline.instanceId);
    expect(changed.origin).toBe("accepted-laboratory-result");
    expect(changed.parameters.a).toBe(1e-6);
    expect(changed.outputs).toEqual(
      session
        .getSnapshot()
        .accepted?.outputs.filter((output) =>
          INVESTIGATIONS["brownian-motion"].quantities.some(({ id }) => id === output.quantityId),
        ),
    );
    expect(owner.getSnapshot().report?.baseline.reading).toEqual(baseline);

    const explanation = document.querySelector<HTMLTextAreaElement>('textarea[id$="-explanation"]');
    assert.ok(explanation);
    explanation.value = "More drag reduces D; displacement depends on its square root.";
    await click("Keep my explanation");
    const saved = readStoredInvestigation("brownian-motion");
    expect(saved.status).toBe("ok");
    expect(saved.report).toEqual(owner.getSnapshot().report);
    const exactSaved = JSON.stringify(saved.report);

    // The actual discovery provider/task pair opens the same record without a live owner.
    await act(async () =>
      root?.render(
        <DiscoveryInvestigationProvider spec={INVESTIGATIONS["brownian-motion"]}>
          <PpeTask task={PPE_TASK} />
          <Probe />
        </DiscoveryInvestigationProvider>,
      ),
    );
    await openWorkspace();
    assert.ok(store);
    expect(store.getSnapshot().restored).toBe(true);
    expect(JSON.stringify(store.getSnapshot().report)).toBe(exactSaved);
    expect(button("Capture changed reading").disabled).toBe(true);
    expect(document.body.textContent).toContain(saved.report?.prediction ?? "missing prediction");

    await act(async () => root?.render(<KeptInvestigations />));
    const kept = document.querySelector('[data-kept-investigation="brownian-motion"]');
    assert.ok(kept);
    expect(kept.textContent).toContain(saved.report?.prediction ?? "missing prediction");
    expect(kept.textContent).toContain(saved.report?.explanation ?? "missing explanation");
    expect(JSON.stringify(readStoredInvestigation("brownian-motion").report)).toBe(exactSaved);
  }, 20_000);
});
