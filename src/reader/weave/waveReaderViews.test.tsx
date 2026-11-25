import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { DopplerAberrationLab } from "../../components/lab/sr09/DopplerAberrationLab.tsx";
import { LightComplexLab } from "../../components/lab/sr10/LightComplexLab.tsx";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import { DEFAULT_PREPARED_EXAMPLE as waveExample } from "../../experiments/sr09/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as complexExample } from "../../experiments/sr10/session.ts";
import Sr09ClarificationView from "../../experiments/views/sr09View.tsx";
import Sr10ClarificationView from "../../experiments/views/sr10View.tsx";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";

let root: Root | null = null;
let main: HTMLElement;
let host: HTMLElement;

beforeEach(async () => {
  await installDom();
  installPredictPersistence(REMEMBERS_NOTHING);
  main = document.createElement("main");
  host = document.createElement("div");
  main.append(host);
  document.body.append(main);
  root = createRoot(host);
  window.history.replaceState(
    null,
    "",
    "/papers/special-relativity/s7/?open=instrument-view#s7-p3-s1",
  );
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});

function sentence(id: string, face: "german" | "english") {
  const node = document.createElement("span");
  node.className = face === "german" ? "source-sentence" : "translation-unit";
  node.setAttribute(face === "german" ? "data-sentence-id" : "data-translation-unit-id", id);
  node.setAttribute("aria-describedby", "existing-source-note");
  node.setAttribute("data-alignment-active", "true");
  node.textContent = `Unchanged ${face} sentence ${id}`;
  main.prepend(node);
  return node;
}

async function disclose(panel: HTMLDetailsElement, open: boolean) {
  await act(async () => {
    panel.open = open;
    panel.dispatchEvent(new Event("toggle"));
  });
}

async function mount(view: ReactNode) {
  await act(async () => root?.render(view));
  const panel = host.querySelector<HTMLDetailsElement>("[data-result-weave]");
  assert.ok(panel, "The production reader adapter must mount the existing session's weave");
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "awaiting",
  );
  expect(panel.querySelector("[data-weave-snapshot]")?.textContent).toContain(
    "Prepared worked example",
  );
  await disclose(panel, true);
  expect(main.querySelector("[data-live-weave-owner]")).toBeNull();
  expect(panel.querySelector('[role="status"]')?.textContent).toBe("");
  const skip = [...host.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Skip prediction",
  );
  assert.ok(skip);
  await act(async () => skip.click());
  return panel;
}

async function typeField(suffix: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[id$="-${suffix}"]`);
  assert.ok(input);
  // Happy DOM does not dispatch React's synthetic onChange for number inputs. Exercise the
  // installed handler, as the laboratory's existing form tests do, without applying the draft.
  const key = Object.keys(input).find((candidate) => candidate.startsWith("__reactProps$"));
  const props = key
    ? (input as unknown as Record<string, { onChange(event: unknown): void }>)[key]
    : undefined;
  assert.ok(props);
  await act(async () => {
    input.value = value;
    props.onChange({ target: input, currentTarget: input });
  });
}

async function submit() {
  const form = host.querySelector("form");
  assert.ok(form);
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

function expectCleared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
    expect(node.getAttribute("aria-describedby")).toBe("existing-source-note");
    expect(node.getAttribute("data-alignment-active")).toBe("true");
  }
}

for (const fixture of [
  {
    id: "sr-09",
    View: Sr09ClarificationView,
    sentences: ["s7-p3-s1", "s7-p5-s2", "s7-p2-s2"],
  },
  { id: "sr-10", View: Sr10ClarificationView, sentences: ["s8-p5-s1", "s8-p2-s2"] },
] as const) {
  test(`${fixture.id} reader pointers follow accepted inputs, honor prediction, and clear on refusal and unmount`, async () => {
    const nodes = fixture.sentences.flatMap((id) => [
      sentence(id, "german"),
      sentence(id, "english"),
    ]);
    const unrelated = sentence("s7-p1-s1", "german");
    const originalText = nodes.map((node) => node.textContent);
    const panel = await mount(
      <fixture.View instanceId={`reader-${fixture.id}`} mode={null} presentation="standard" />,
    );
    const laboratory = host.querySelector(`[data-instrument-id="${fixture.id}"]`);
    assert.ok(laboratory);
    const runId = laboratory.getAttribute("data-run-id");
    for (const node of nodes) {
      expect(node.getAttribute("data-live-weave-meaning")).toBe(
        (node.getAttribute("data-sentence-id") ?? node.getAttribute("data-translation-unit-id")) ===
          "s7-p2-s2"
          ? "agreement-within-stated-bound"
          : "quantity-compared",
      );
    }
    expectCleared([unrelated]);
    expect(nodes.map((node) => node.textContent)).toEqual(originalText);

    // Editing the form cannot relabel the earlier accepted comparison.
    await typeField("beta", "-0.6");
    expect(panel.querySelector('[data-weave-context="beta"]')?.textContent).toContain("0.6 c");
    expect(panel.querySelector('[data-weave-context="beta"]')?.textContent).not.toContain("-0.6");
    await submit();
    expect(panel.querySelector('[data-weave-context="beta"]')?.textContent).toContain("-0.6 c");
    expect(laboratory.getAttribute("data-run-id")).toBe(runId);
    expect(panel.querySelector("[data-weave-snapshot]")?.textContent).not.toContain(
      "Prepared worked example",
    );
    const keptReading = host.querySelector('[data-quantity-id="dopplerFactor"]')?.textContent;
    expect(keptReading).toBeTruthy();

    // A refusal before the store issues a request must still withdraw the paper annotations.
    await typeField("beta", "1.5");
    await submit();
    expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
    expect(panel.querySelector('[data-weave-lit="true"]')).toBeNull();
    expect(panel.querySelector("[data-weave-context]")).toBeNull();
    expect(host.querySelector('[data-quantity-id="dopplerFactor"]')?.textContent).toBe(keptReading);
    expectCleared(nodes);

    await typeField("beta", "0.6");
    await submit();
    expect(panel.querySelector("[data-weave-inactive]")).toBeNull();
    expect(nodes[0]?.hasAttribute("data-live-weave-owner")).toBe(true);
    await disclose(panel, false);
    expectCleared(nodes);
    await disclose(panel, true);
    expect(nodes[0]?.hasAttribute("data-live-weave-owner")).toBe(true);
    await act(async () => root?.unmount());
    root = null;
    expectCleared(nodes);
    expect(nodes.map((node) => node.textContent)).toEqual(originalText);
  });
}

test("both standalone labs retain their prepared source links without JavaScript", () => {
  for (const [view, ids] of [
    [
      <DopplerAberrationLab key="wave" example={waveExample} />,
      ["s7-p3-s1", "s7-p5-s2", "s7-p2-s2"],
    ],
    [<LightComplexLab key="complex" example={complexExample} />, ["s8-p5-s1", "s8-p2-s2"]],
  ] as const) {
    const html = renderToStaticMarkup(view);
    expect(html).toContain('data-result-weave="special-relativity"');
    expect(html).toContain("Prepared worked example");
    for (const id of ids) {
      expect(html).toContain(`/view/german/#${id}`);
      expect(html).toContain(`/view/english/#${id}`);
    }
  }
});

test("the phase pointer and its evidence follow the reader's named event while retaining the run", async () => {
  const target = sentence("s7-p2-s2", "german");
  const panel = await mount(
    <Sr09ClarificationView
      instanceId="phase-selection-reader"
      mode={null}
      presentation="standard"
    />,
  );
  const laboratory = host.querySelector('[data-instrument-id="sr-09"]');
  assert.ok(laboratory);
  const runId = laboratory.getAttribute("data-run-id");
  expect(target.getAttribute("data-live-weave-meaning")).toBe("agreement-within-stated-bound");
  expect(panel.querySelector('[data-weave-context="selectedEventId"]')?.textContent).toContain(
    "Origin cycle tick",
  );
  const offset = host.querySelector<HTMLInputElement>('input[value="sr-09-event-offset"]');
  assert.ok(offset);
  await act(async () => offset.click());
  expect(laboratory.getAttribute("data-run-id")).toBe(runId);
  expect(panel.querySelector('[data-weave-context="selectedEventId"]')?.textContent).toContain(
    "Offset downstream event",
  );
  expect(panel.querySelector('[data-weave-row="sr09-phase-invariance"]')?.textContent).toContain(
    "10⁻¹² radians",
  );
  expect(target.getAttribute("data-live-weave-meaning")).toBe("agreement-within-stated-bound");
});
