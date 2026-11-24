import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { EquationScope } from "../equations/EquationScope.tsx";
import { SemanticEquation } from "../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../equations/viewTypes.ts";
import equationPayload from "../generated/bm01-equations.json";
import { bm01Laboratory, bm01ReplayFixture, deferred } from "../testing/bm01ReplayHarness.ts";
import { FIXTURE_BROWNIAN_SOURCE_BLOCKS } from "../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { BrownianLabCompanion } from "./BrownianLabCompanion.tsx";
import {
  type BrownianLabContextValue,
  BrownianLabProvider,
  useBrownianLab,
} from "./BrownianLabContext.tsx";
import { BrownianReaderInvestigation } from "./BrownianReaderInvestigation.tsx";
import { BrownianSourceAction } from "./BrownianSourceAction.tsx";
import {
  type BrownianSourceContextValue,
  BrownianSourceProvider,
  useBrownianSource,
} from "./BrownianSourceContext.tsx";
import { createBrownianLabSession, type SharedBrownianLab } from "./brownianLabSession.ts";
import { FootnotesSection } from "./faces/Footnote.tsx";
import { SourceBlock } from "./faces/SourceBlock.tsx";
import { usePinnedEquations } from "./layout/PinnedEquationContext.tsx";
import type { PinnedEquationStore } from "./layout/pinnedEquationStore.ts";
import { ReaderLayout } from "./layout/ReaderLayout.tsx";
import { BROWNIAN_GERMAN_SOURCE_HREF, type SourceCompanionPassage } from "./sourceCompanion.ts";

const first = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((block) => block.id === "bm-s4-p1");
const second = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((block) => block.id === "bm-s5-p1");
const note = FIXTURE_BROWNIAN_SOURCE_BLOCKS.find((block) => block.id === "bm-s5-fn1");
const rms = (equationPayload.equations as readonly CompiledEquation[]).find(
  (equation) => equation.id === "eq-model-bm-rms",
);
assert.ok(first && second && note && rms);
const rmsEquation = rms;
const sourceHtml = renderToStaticMarkup(
  <main data-reader-root data-face="german">
    <SourceBlock block={first} />
    <SourceBlock block={second} />
    <FootnotesSection footnotes={[note]} anchored />
  </main>,
);
const passages: readonly SourceCompanionPassage[] = [
  {
    id: "argument-steps",
    title: "Independent steps",
    targets: [first, second].map((block) => ({
      id: block.id,
      label: block.id,
      germanHref: `${BROWNIAN_GERMAN_SOURCE_HREF}#${block.id}`,
      english: [{ href: `/papers/brownian-motion/view/english/#en-${block.id}`, label: block.id }],
    })),
  },
  {
    id: "argument-displacement",
    title: "Observable displacement",
    targets: [
      {
        id: second.id,
        label: second.id,
        germanHref: `${BROWNIAN_GERMAN_SOURCE_HREF}#${second.id}`,
        english: [],
      },
    ],
  },
];

describe("the contextual Original companion", () => {
  let container: HTMLElement;
  let root: Root | null;
  let shared: SharedBrownianLab | null;
  let source: BrownianSourceContextValue | null;
  let laboratory: BrownianLabContextValue | null;
  let pins: PinnedEquationStore | null;
  let loads: number;
  let calls: string[];
  let request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  const fetchSource = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    return request(input, init);
  }) as typeof fetch;
  const loadLaboratory = async () => {
    loads++;
    assert.ok(shared, "Source navigation alone must not request a numerical owner.");
    return shared;
  };

  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    window.history.replaceState({}, "", "/papers/brownian-motion/s4/#argument-steps");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    shared = null;
    source = null;
    laboratory = null;
    pins = null;
    loads = 0;
    calls = [];
    request = async () => new Response(sourceHtml);
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    shared?.dispose();
    await uninstallDom();
  });

  function Probe() {
    source = useBrownianSource();
    laboratory = useBrownianLab();
    pins = usePinnedEquations();
    return null;
  }
  function Reader() {
    return (
      <BrownianReaderInvestigation active>
        <BrownianLabProvider loadLaboratory={loadLaboratory}>
          <BrownianSourceProvider passages={passages} fetchSource={fetchSource}>
            <div data-reader-root>
              <ReaderLayout
                outline={<p>Outline</p>}
                companion={
                  <BrownianLabCompanion>
                    <p>Reading notes</p>
                  </BrownianLabCompanion>
                }
              >
                {passages.map((passage) => (
                  <article key={passage.id} id={passage.id} data-unit={passage.id} tabIndex={-1}>
                    <p>{passage.title}</p>
                    <BrownianSourceAction passageId={passage.id} />
                  </article>
                ))}
                <section id="source-test-equation">
                  <EquationScope scope="source-test-passage" scopeLabel="passage">
                    <SemanticEquation equation={rmsEquation} />
                  </EquationScope>
                </section>
                <Probe />
              </ReaderLayout>
            </div>
          </BrownianSourceProvider>
        </BrownianLabProvider>
      </BrownianReaderInvestigation>
    );
  }
  const render = async () =>
    act(async () =>
      root?.render(
        <StrictMode>
          <Reader />
        </StrictMode>,
      ),
    );
  function companion(slot = "column") {
    const value = container.querySelector<HTMLElement>(`[data-brownian-companion="${slot}"]`);
    assert.ok(value);
    return value;
  }
  function sourcePanel(slot = "column") {
    const value = container.querySelector<HTMLElement>(`[data-brownian-source-panel="${slot}"]`);
    assert.ok(value);
    return value;
  }
  function sourceAction(passage = "argument-steps") {
    const value = container.querySelector<HTMLAnchorElement>(
      `[data-brownian-source-action="${passage}"]`,
    );
    assert.ok(value);
    return value;
  }
  async function click(region: Element, label: string) {
    const button = [...region.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === label,
    );
    assert.ok(button, label);
    await act(async () => button.click());
  }
  async function until(check: () => boolean) {
    for (let attempt = 0; attempt < 200 && !check(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    expect(check()).toBe(true);
  }
  async function choose(panel: HTMLElement, label: string, value: string) {
    const labelElement = [...panel.querySelectorAll("label")].find(
      (item) => item.textContent === label,
    );
    assert.ok(labelElement);
    const select = document.getElementById(labelElement.htmlFor) as HTMLSelectElement;
    assert.ok(select);
    await act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  function context() {
    assert.ok(source);
    return source;
  }

  test("server and initial client reading keep canonical fallbacks and fetch neither source nor laboratory", async () => {
    const html = renderToStaticMarkup(<Reader />);
    expect(html).toContain(`href="${BROWNIAN_GERMAN_SOURCE_HREF}#bm-s4-p1"`);
    expect(html).not.toContain('data-original-source="');
    expect(html).not.toContain(first.diplomaticText);
    expect(calls).toEqual([]);
    expect(loads).toBe(0);
    await render();
    await click(companion(), "Original");
    expect(companion("sheet").dataset.companionMode).toBe("original");
    expect(sourcePanel().textContent).toContain("choose a passage above");
    expect(calls).toEqual([]);
    expect(loads).toBe(0);
  });

  test("an explicit passage loads one shared source page, retaining the main passage and exact outbound routes", async () => {
    await render();
    const passage = container.querySelector("#argument-steps");
    const location = window.location.href;
    await act(async () => sourceAction().click());
    await until(() => sourcePanel().querySelector('[data-original-source="bm-s4-p1"]') !== null);
    expect(calls).toEqual([BROWNIAN_GERMAN_SOURCE_HREF]);
    expect(loads).toBe(0);
    expect(container.querySelector("#argument-steps")).toBe(passage);
    expect(window.location.href).toBe(location);
    const link = passages[0]?.targets[0]?.english[0];
    assert.ok(link);
    expect(sourcePanel().querySelector(`a[href="${link.href}"]`)).not.toBeNull();
    await choose(sourcePanel(), "Printed passage", "bm-s5-p1");
    expect(sourcePanel("sheet").querySelector('[data-original-source="bm-s5-p1"]')).not.toBeNull();
    expect(sourcePanel().querySelector('[data-footnote-id="bm-s5-fn1"]')).not.toBeNull();
    const ids = [
      ...sourcePanel().querySelectorAll("[id]"),
      ...sourcePanel("sheet").querySelectorAll("[id]"),
    ].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    await click(companion(), "Notes");
    await click(companion("sheet"), "Original");
    expect(context().target?.id).toBe("bm-s5-p1");
    expect(calls).toEqual([BROWNIAN_GERMAN_SOURCE_HREF]);
  });

  test("a delayed page cannot restore an old source choice or reopen Original after the reader leaves it", async () => {
    const held = deferred<Response>();
    request = async () => held.promise;
    await render();
    await act(async () => sourceAction().click());
    expect(context().loading).toBe(true);
    await act(async () => sourceAction("argument-displacement").click());
    await click(companion(), "Notes");
    await act(async () => held.resolve(new Response(sourceHtml)));
    await until(() => context().source !== null);
    expect(context().passage?.id).toBe("argument-displacement");
    expect(context().target?.id).toBe("bm-s5-p1");
    expect(companion().dataset.companionMode).toBe("notes");
    expect(companion("sheet").dataset.companionMode).toBe("notes");
    expect(calls).toEqual([BROWNIAN_GERMAN_SOURCE_HREF]);
    expect(loads).toBe(0);
  });

  test("a failed fetch preserves its canonical link and an explicit retry fills the current source choice", async () => {
    request = async () => new Response("Unavailable", { status: 503 });
    await render();
    await act(async () => sourceAction().click());
    await until(() => context().error !== null);
    expect(sourcePanel().querySelector('[role="alert"]')).not.toBeNull();
    expect(
      sourcePanel().querySelector(`a[href="${BROWNIAN_GERMAN_SOURCE_HREF}#bm-s4-p1"]`),
    ).not.toBeNull();
    request = async () => new Response(sourceHtml);
    await click(sourcePanel(), "Try loading the source again");
    await until(() => sourcePanel().querySelector('[data-original-source="bm-s4-p1"]') !== null);
    expect(context().error).toBeNull();
    expect(calls).toEqual([BROWNIAN_GERMAN_SOURCE_HREF, BROWNIAN_GERMAN_SOURCE_HREF]);
    expect(loads).toBe(0);
  });

  test("a passage action opens the visible mobile sheet, focuses its heading and returns to the invoking passage", async () => {
    await render();
    const column = container.querySelector<HTMLElement>("[data-reader-companion-column]");
    const sheet = container.querySelector<HTMLDetailsElement>("[data-bottom-sheet]");
    assert.ok(column && sheet);
    column.getClientRects = () => [] as unknown as DOMRectList;
    sheet.getClientRects = () => [{ width: 320, height: 40 }] as unknown as DOMRectList;
    const origin = sourceAction();
    origin.focus();
    const location = window.location.href;
    await act(async () => origin.click());
    expect(sheet.open).toBe(true);
    expect(document.activeElement).toBe(sourcePanel("sheet").querySelector("h2"));
    expect(document.activeElement).not.toBe(sourcePanel().querySelector("h2"));
    await click(sourcePanel("sheet"), "Return to the reading");
    expect(sheet.open).toBe(false);
    expect(document.activeElement).toBe(origin);
    expect(window.location.href).toBe(location);
  });

  test("a departing reader aborts a pending page and its late resolution creates no new companion", async () => {
    const held = deferred<Response>();
    const signals: AbortSignal[] = [];
    request = async (_input, init) => {
      if (init?.signal) signals.push(init.signal);
      return held.promise;
    };
    await render();
    await act(async () => sourceAction().click());
    const signal = signals[0];
    assert.ok(signal);
    await act(async () => root?.unmount());
    root = null;
    expect(signal.aborted).toBe(true);
    await act(async () => held.resolve(new Response(sourceHtml)));
    expect(container.children.length).toBe(0);
    expect(loads).toBe(0);
  });

  test("the genuine BM01 accepted run, dirty controls and selected pinned term survive Original and responsive switches", async () => {
    const fixture = await bm01ReplayFixture();
    const actual = bm01Laboratory(fixture, { hold: () => true });
    shared = createBrownianLabSession(actual.session, fixture.example);
    await render();
    await click(companion(), "Laboratory");
    await until(() => container.querySelectorAll("[data-brownian-lab-panel]").length === 2);
    const radius = container.querySelector<HTMLInputElement>(
      '[data-brownian-lab-panel="column"] input[name="a"]',
    );
    assert.ok(radius);
    async function edit(value: string) {
      assert.ok(radius);
      const key = Object.keys(radius).find((name) => name.startsWith("__reactProps$"));
      assert.ok(key);
      const props = (radius as unknown as Record<string, { onChange(event: unknown): void }>)[key];
      assert.ok(props);
      await act(async () => {
        radius.value = value;
        props.onChange({ target: radius, currentTarget: radius });
      });
    }
    await edit("1");
    const form = radius.closest("form");
    assert.ok(form);
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    await until(() => (actual.channels[0]?.results.length ?? 0) > 0);
    await act(async () => actual.channels[0]?.release());
    await until(() => !actual.session.getSnapshot().pending);
    const accepted = actual.session.getSnapshot().accepted;
    assert.ok(accepted);
    expect(accepted.parameters.a).toBe(1e-6);
    await edit("0.75");
    const pinButton = container.querySelector<HTMLButtonElement>(
      '#source-test-equation [data-pin-equation="eq-model-bm-rms"]',
    );
    assert.ok(pinButton);
    await act(async () => pinButton.click());
    assert.ok(pins);
    const pinned = pins.getSnapshot().pinned;
    const term = rmsEquation.terms.find((item) => item.quantityId === "diffusionCoefficient");
    assert.ok(pinned && term);
    const selected = {
      nodeId: `${rmsEquation.paper}/${term.termId}`,
      quantityId: term.quantityId,
      kind: "term" as const,
    };
    await act(async () => pinned.context.store.select(selected));
    const passage = container.querySelector("#argument-steps");
    const location = window.location.href;
    await act(async () => sourceAction().click());
    await choose(sourcePanel(), "Printed passage", "bm-s5-p1");
    await click(companion("sheet"), "Notes");
    await click(companion(), "Pinned equation");
    expect(pins.getSnapshot().pinned?.context.store.getSnapshot()).toEqual(selected);
    await click(companion("sheet"), "Original");
    expect(context().target?.id).toBe("bm-s5-p1");
    await click(companion(), "Laboratory");
    expect(actual.session.getSnapshot().accepted).toBe(accepted);
    expect(radius.value).toBe("0.75");
    expect(
      container.querySelector<HTMLInputElement>('[data-brownian-lab-panel="sheet"] input[name="a"]')
        ?.value,
    ).toBe("0.75");
    assert.ok(laboratory);
    expect(laboratory.laboratory).toBe(shared);
    expect(laboratory.dirty).toBe(true);
    expect(loads).toBe(1);
    expect(actual.channels.length).toBe(1);
    expect(actual.channels[0]?.disposed).toBe(false);
    expect(pins.getSnapshot().pinned?.context.store.getSnapshot()).toEqual(selected);
    expect(container.querySelector("#argument-steps")).toBe(passage);
    expect(window.location.href).toBe(location);
  }, 20_000);
});
