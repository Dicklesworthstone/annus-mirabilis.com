import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MagnetConductorLab } from "../../components/lab/MagnetConductorLab.tsx";
import { VelocityCompositionLab } from "../../components/lab/sr06/VelocityCompositionLab.tsx";
import { WaveDescriptionLab } from "../../components/lab/WaveDescriptionLab.tsx";
import type { PreparedLq01Example } from "../../experiments/lq01/session.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import { DEFAULT_PREPARED_EXAMPLE as magnetExample } from "../../experiments/sr02/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as compositionExample } from "../../experiments/sr06/session.ts";
import Lq01ClarificationView from "../../experiments/views/lq01View.tsx";
import Sr02ClarificationView from "../../experiments/views/sr02View.tsx";
import Sr06ClarificationView from "../../experiments/views/sr06View.tsx";
import waveExample from "../../generated/lq01-example.json";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";

let root: Root | null = null;
let main: HTMLElement;
let host: HTMLElement;

beforeEach(async () => {
  await installDom({ intersections: "visible" });
  installPredictPersistence(REMEMBERS_NOTHING);
  main = document.createElement("main");
  host = document.createElement("div");
  main.append(host);
  document.body.append(main);
  root = createRoot(host);
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
  node.textContent = `Unchanged ${face} sentence ${id}`;
  main.prepend(node);
  return node;
}

function button(label: string) {
  const found = [...host.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === label,
  );
  assert.ok(found, `Missing button: ${label}`);
  return found;
}

async function openWeave() {
  const panel = host.querySelector<HTMLDetailsElement>("[data-result-weave]");
  assert.ok(panel);
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "awaiting",
  );
  expect(panel.querySelector("[data-weave-snapshot]")?.textContent).toContain(
    "Prepared worked example",
  );
  await act(async () => {
    panel.open = true;
    panel.dispatchEvent(new Event("toggle"));
  });
  expect(main.querySelector("[data-live-weave-owner]")).toBeNull();
  expect(panel.querySelector('[role="status"]')?.textContent).toBe("");
  // Follow the instrument's gate; it decides when a recorded or skipped prediction reveals results.
  for (
    let i = 0;
    i < 5 &&
    panel.closest("[data-predict-response]")?.getAttribute("data-predict-response") === "awaiting";
    i++
  ) {
    await act(async () => button("Skip prediction").click());
  }
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "shown",
  );
  return panel;
}

async function typeInto(selector: string, text: string) {
  const input = host.querySelector<HTMLInputElement>(selector);
  assert.ok(input, `Missing input: ${selector}`);
  // Happy DOM does not dispatch React's synthetic text onChange; use the real installed handler.
  const key = Object.keys(input).find((candidate) => candidate.startsWith("__reactProps$"));
  const props = key
    ? (input as unknown as Record<string, { onChange(event: unknown): void }>)[key]
    : undefined;
  assert.ok(props);
  await act(async () => {
    input.value = text;
    props.onChange({ target: input, currentTarget: input });
  });
}

async function submit() {
  const form = host.querySelector("form");
  assert.ok(form);
  await act(async () =>
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}

function expectCleared(panel: HTMLDetailsElement, nodes: HTMLElement[]) {
  expect(panel.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  expect(panel.querySelector('[data-weave-lit="true"]')).toBeNull();
  expect(panel.querySelector("[data-weave-context]")).toBeNull();
  expect(main.querySelector("[data-live-weave-owner]")).toBeNull();
  for (const node of nodes) {
    expect(node.getAttribute("aria-describedby")).toBe("existing-source-note");
    expect(node.textContent).toStartWith("Unchanged ");
  }
}

test("composition reader highlights its current physical branch, then clears a refused trial without erasing the calculation", async () => {
  window.history.replaceState(null, "", "/papers/special-relativity/s5/");
  const sublight = [sentence("s5-p2-s8", "german"), sentence("s5-p2-s8", "english")];
  const light = [sentence("s5-p6-s1", "german"), sentence("s5-p6-s1", "english")];
  await act(async () =>
    root?.render(
      <Sr06ClarificationView instanceId="reader-composition" mode={null} presentation="standard" />,
    ),
  );
  const panel = await openWeave();
  for (const node of sublight)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  for (const node of light) expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
  await act(async () => button("A transverse light ray").click());
  expect(panel.querySelector("[data-weave-snapshot]")?.textContent).toContain("Accepted trial");
  for (const node of sublight) expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
  for (const node of light)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  const measurement = host.querySelector('[data-output="composedSpeedOverC"]')?.textContent;
  await typeInto('input[name="movingSpeed"]', "1.5");
  await submit();
  expectCleared(panel, [...sublight, ...light]);
  expect(host.querySelector('[data-output="composedSpeedOverC"]')?.textContent).toBe(measurement);
  expect(
    panel.querySelector('a[href="/papers/special-relativity/view/german/#s5-p6-s1"]'),
  ).not.toBeNull();
  await act(async () => button("0.6c along 0.6c").click());
  for (const node of sublight)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  for (const node of light) expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
});

test("wave reader gates the averaged-wave passages and clears a locally refused amplitude", async () => {
  window.history.replaceState(null, "", "/papers/light-quanta/s0/");
  const waves = [sentence("s0-p2-s1", "german"), sentence("s0-p2-s1", "english")];
  const average = [sentence("s0-p2-s2", "german"), sentence("s0-p2-s2", "english")];
  const spreading = [sentence("s0-p1-s4", "german"), sentence("s0-p1-s4", "english")];
  await act(async () =>
    root?.render(
      <Lq01ClarificationView instanceId="reader-waves" mode={null} presentation="standard" />,
    ),
  );
  const panel = await openWeave();
  for (const node of [...waves, ...average])
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  for (const node of spreading) expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
  expect(panel.querySelector('[data-weave-row="lq01-s0-energy-spreading"]')).toBeNull();
  const measurement = host.querySelector('[data-view-id="lq-01-data-table"] table')?.textContent;
  await typeInto('input[id$="-a1"][type="text"]', "-1");
  await submit();
  expectCleared(panel, [...waves, ...average, ...spreading]);
  expect(host.querySelector('[data-view-id="lq-01-data-table"] table')?.textContent).toBe(
    measurement,
  );
  expect(
    panel.querySelector('a[href="/papers/light-quanta/view/english/#s0-p2-s2"]'),
  ).not.toBeNull();
});

test("magnet reader suspends on a blank typed field even without a session refusal, and separates the qualitative apparatus", async () => {
  window.history.replaceState(null, "", "/papers/special-relativity/s0/");
  const nodes = [
    sentence("s0-p1-s3", "german"),
    sentence("s0-p1-s3", "english"),
    sentence("s6-p10-s1", "german"),
    sentence("s6-p10-s1", "english"),
  ];
  await act(async () =>
    root?.render(
      <Sr02ClarificationView instanceId="reader-magnet" mode={null} presentation="standard" />,
    ),
  );
  const panel = await openWeave();
  for (const node of nodes)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  const measurement = host.querySelector(
    '[data-quantity-id="transverseForceLaboratory"]',
  )?.textContent;
  await typeInto('input[name="speed"]', "");
  await submit();
  expectCleared(panel, nodes);
  expect(host.querySelector('[data-quantity-id="transverseForceLaboratory"]')?.textContent).toBe(
    measurement,
  );
  await act(async () => button("Show 0.6c").click());
  for (const node of nodes)
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
  const apparatus = host.querySelectorAll<HTMLInputElement>('input[name="mode"]')[1];
  assert.ok(apparatus);
  await act(async () => apparatus.click());
  await submit();
  expect(host.querySelector("[data-result-weave]")).toBeNull();
  expect(main.querySelector("[data-live-weave-owner]")).toBeNull();
  expect(host.querySelector('[data-panel="apparatus"]')).not.toBeNull();
  for (const id of ["s0-p1-s3", "s6-p10-s1"]) {
    expect(
      host.querySelector(`a[href="/papers/special-relativity/view/german/#${id}"]`),
    ).not.toBeNull();
    expect(
      host.querySelector(`a[href="/papers/special-relativity/view/english/#${id}"]`),
    ).not.toBeNull();
  }
});

test("standalone no-script laboratories retain their prepared source and translation links", () => {
  for (const [view, paper, sentenceIds] of [
    [
      <VelocityCompositionLab key="composition" example={compositionExample} />,
      "special-relativity",
      ["s5-p2-s8", "s5-p6-s1"],
    ],
    [
      <WaveDescriptionLab key="wave" example={waveExample as PreparedLq01Example} />,
      "light-quanta",
      ["s0-p2-s1", "s0-p2-s2"],
    ],
    [
      <MagnetConductorLab key="magnet" example={magnetExample} />,
      "special-relativity",
      ["s0-p1-s3", "s6-p10-s1"],
    ],
  ] as const) {
    const html = renderToStaticMarkup(view);
    expect(html).toContain(`data-result-weave="${paper}"`);
    expect(html).toContain("Prepared worked example");
    for (const id of sentenceIds) {
      expect(html).toContain(`/view/german/#${id}`);
      expect(html).toContain(`/view/english/#${id}`);
    }
  }
});
