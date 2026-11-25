import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { FieldEquationsLab } from "../../components/lab/sr07/FieldEquationsLab.tsx";
import { FieldFrameChangeLab } from "../../components/lab/sr08/FieldFrameChangeLab.tsx";
import { ChargeCurrentLab } from "../../components/lab/sr12/ChargeCurrentLab.tsx";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import { DEFAULT_PREPARED_EXAMPLE as equationsExample } from "../../experiments/sr07/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as fieldsExample } from "../../experiments/sr08/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as chargeExample } from "../../experiments/sr12/session.ts";
import Sr07ClarificationView from "../../experiments/views/sr07View.tsx";
import Sr08ClarificationView from "../../experiments/views/sr08View.tsx";
import Sr12ClarificationView from "../../experiments/views/sr12View.tsx";
import { C_SI } from "../../physics/reference/fields.ts";
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
    "/papers/special-relativity/s6/?open=instrument-view#s6-p5-s2",
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

async function mount(view: ReactNode, gated: boolean) {
  await act(async () => root?.render(view));
  const panel = host.querySelector<HTMLDetailsElement>("[data-result-weave]");
  assert.ok(panel, "The production reader adapter must mount its laboratory's accepted session");
  expect(panel.querySelector("[data-weave-snapshot]")?.textContent).toContain(
    "Prepared worked example",
  );
  await disclose(panel, true);
  if (gated) {
    expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
      "awaiting",
    );
    expect(main.querySelector("[data-live-weave-owner]")).toBeNull();
    expect(panel.querySelector('[role="status"]')?.textContent).toBe("");
    const skip = [...host.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Skip prediction",
    );
    assert.ok(skip);
    await act(async () => skip.click());
  }
  return panel;
}

async function typeField(suffix: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[id$="-${suffix}"]`);
  assert.ok(input);
  // Happy DOM's number inputs do not dispatch React's synthetic onChange. Invoke the
  // installed input handler, leaving the trial unapplied until the actual form submission.
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
    id: "sr-07",
    View: Sr07ClarificationView,
    sentences: ["s6-p2-s1", "s6-p5-s2"],
    meanings: ["quantity-compared", "quantity-compared"],
    field: "beta",
    context: "boostBeta",
    speed: 0.6,
    unit: "c",
    reading: "residualMax",
    gated: false,
  },
  {
    id: "sr-08",
    View: Sr08ClarificationView,
    sentences: ["s6-p5-s2"],
    meanings: ["quantity-compared"],
    field: "boost",
    context: "boost",
    speed: 0.6 * C_SI,
    unit: "m/s",
    reading: "electricFieldMoving",
    gated: true,
  },
  {
    id: "sr-12",
    View: Sr12ClarificationView,
    sentences: ["s9-p2-s1", "s9-p3-s1"],
    meanings: ["quantity-compared", "assumption-active"],
    field: "boost-number",
    context: "boost",
    speed: 0.6 * C_SI,
    unit: "m/s",
    reading: "chargeDensityMoving",
    gated: true,
  },
] as const) {
  test(`${fixture.id} keeps accepted context and clears refused source pointers`, async () => {
    const nodes = fixture.sentences.flatMap((id) => [
      sentence(id, "german"),
      sentence(id, "english"),
    ]);
    const unrelated = sentence("s6-p1-s1", "german");
    const originalText = nodes.map((node) => node.textContent);
    const panel = await mount(
      <fixture.View instanceId={`reader-${fixture.id}`} mode={null} presentation="standard" />,
      fixture.gated,
    );
    const laboratory = host.querySelector(`[data-instrument-id="${fixture.id}"]`);
    assert.ok(laboratory);
    const runId = laboratory.getAttribute("data-run-id");
    for (const [index, node] of nodes.entries()) {
      expect(node.getAttribute("data-live-weave-meaning")).toBe(
        fixture.meanings[Math.floor(index / 2)],
      );
    }
    expectCleared([unrelated]);
    expect(nodes.map((node) => node.textContent)).toEqual(originalText);

    await typeField(fixture.field, "-0.6");
    const context = `[data-weave-context="${fixture.context}"]`;
    expect(panel.querySelector(context)?.textContent).toContain(`${fixture.speed} ${fixture.unit}`);
    expect(panel.querySelector(context)?.textContent).not.toContain(`-${fixture.speed}`);
    await submit();
    expect(panel.querySelector(context)?.textContent).toContain(
      `-${fixture.speed} ${fixture.unit}`,
    );
    expect(laboratory.getAttribute("data-run-id")).toBe(runId);
    expect(panel.querySelector("[data-weave-snapshot]")?.textContent).not.toContain(
      "Prepared worked example",
    );
    const reading = `[data-quantity-id="${fixture.reading}"]`;
    const keptReading = host.querySelector(reading)?.textContent;
    expect(keptReading).toBeTruthy();

    // Validation happens before the store request. The form must still withdraw the old pointer.
    await typeField(fixture.field, "1.5");
    await submit();
    expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
    expect(panel.querySelector('[data-weave-lit="true"]')).toBeNull();
    expect(panel.querySelector("[data-weave-context]")).toBeNull();
    expect(host.querySelector(reading)?.textContent).toBe(keptReading);
    expectCleared(nodes);

    await typeField(fixture.field, "0.6");
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

test("the field-equation grouping prediction also pauses the open source weave", async () => {
  const nodes = [sentence("s6-p2-s1", "german"), sentence("s6-p5-s2", "english")];
  const panel = await mount(
    <Sr07ClarificationView instanceId="grouping-weave" mode={null} presentation="standard" />,
    false,
  );
  const next = [...host.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Next step",
  );
  assert.ok(next);
  await act(async () => next.click());
  await act(async () => next.click());
  expect(panel.closest("[hidden]")).not.toBeNull();
  expectCleared(nodes);
  expect(panel.querySelector('[role="status"]')?.textContent).toBe("");

  const candidate = host.querySelector<HTMLInputElement>(
    'input[name="candidate"][value="beta-N-minus"]',
  );
  assert.ok(candidate);
  const form = candidate.closest("form");
  assert.ok(form);
  await act(async () => {
    candidate.click();
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(panel.closest("[hidden]")).toBeNull();
  expect(nodes[0]?.hasAttribute("data-live-weave-owner")).toBe(true);
});

test("standalone fields do not opt into paper highlighting", async () => {
  const node = sentence("s6-p5-s2", "german");
  await mount(<FieldFrameChangeLab example={fieldsExample} restoreFromLocation={false} />, true);
  expectCleared([node]);
});

test("the new-manner passage follows the accepted charge rest frame and clears after a refusal", async () => {
  const nodes = [sentence("s6-p10-s1", "german"), sentence("s6-p10-s1", "english")];
  const panel = await mount(
    <Sr08ClarificationView instanceId="charge-rest-reader" mode={null} presentation="standard" />,
    true,
  );
  expectCleared(nodes);
  const rest = [...host.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Charge at rest in k",
  );
  assert.ok(rest);
  await act(async () => rest.click());
  for (const node of nodes)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  expect(
    panel.querySelector('[data-weave-row="sr08-new-manner-expression"]')?.textContent,
  ).toContain("exactly zero in all three components");
  const laboratory = host.querySelector('[data-instrument-id="sr-08"]');
  assert.ok(laboratory);
  const runId = laboratory.getAttribute("data-run-id");

  await typeField("boost", "-0.6");
  expect(nodes[0]?.hasAttribute("data-live-weave-owner")).toBe(true);
  await submit();
  expect(laboratory.getAttribute("data-run-id")).toBe(runId);
  expectCleared(nodes);

  await act(async () => rest.click());
  expect(nodes[0]?.hasAttribute("data-live-weave-owner")).toBe(true);
  await typeField("boost", "1.5");
  await submit();
  expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  expectCleared(nodes);
});

test("standalone labs retain prepared German and English links without JavaScript", () => {
  for (const [view, ids] of [
    [<FieldEquationsLab key="equations" example={equationsExample} />, ["s6-p2-s1", "s6-p5-s2"]],
    [<FieldFrameChangeLab key="fields" example={fieldsExample} />, ["s6-p5-s2", "s6-p10-s1"]],
    [<ChargeCurrentLab key="charge" example={chargeExample} />, ["s9-p2-s1", "s9-p3-s1"]],
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
