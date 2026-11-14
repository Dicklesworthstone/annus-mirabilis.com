import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { SpectrumLab } from "../../components/lab/lq03/SpectrumLab.tsx";
import { MovingClocksLab } from "../../components/lab/sr05/MovingClocksLab.tsx";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import Lq03ClarificationView from "../../experiments/views/lq03View.tsx";
import Sr05ClarificationView from "../../experiments/views/sr05View.tsx";
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

async function mount(element: ReactNode, paper: string) {
  window.history.replaceState(null, "", `/papers/${paper}/s4/?open=instrument-view#s4-p1`);
  await act(async () => root?.render(element));
  const panel = host.querySelector<HTMLDetailsElement>("[data-result-weave]");
  assert.ok(panel, "The real reader adapter must render its session's weave");
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "awaiting",
  );
  expect(panel.querySelector("[data-weave-snapshot]")?.textContent).toContain(
    "Prepared worked example",
  );
  expect(panel.querySelector("[data-weave-inactive]")).toBeNull();
  // The prepared comparison stays in the no-script HTML. Even opening its hidden disclosure
  // must not annotate the paper or announce an answer while the optional prediction is waiting.
  await disclose(panel, true);
  expect(main.querySelector("[data-live-weave-owner]")).toBeNull();
  expect(panel.querySelector('[role="status"]')?.textContent).toBe("");
  await disclose(panel, false);
  const skip = [...host.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Skip prediction",
  );
  assert.ok(skip, "The reader must be able to reveal the comparison without a prediction");
  await act(async () => skip.click());
  expect(panel.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
    "shown",
  );
  return panel;
}

async function disclose(panel: HTMLDetailsElement, open: boolean) {
  await act(async () => {
    panel.open = open;
    panel.dispatchEvent(new Event("toggle"));
  });
}

function lit(predicate: string) {
  return host.querySelector(`[data-weave-row="${predicate}"] [data-weave-lit="true"]`) !== null;
}

function expectCleared(nodes: readonly Element[]) {
  for (const node of nodes) {
    expect(node.hasAttribute("data-live-weave-owner")).toBe(false);
    expect(node.hasAttribute("data-live-weave-meaning")).toBe(false);
    expect(node.getAttribute("aria-describedby")).toBe("existing-source-note");
    expect(node.getAttribute("data-alignment-active")).toBe("true");
  }
}

async function typeProbe(value: string) {
  const input = host.querySelector<HTMLInputElement>('input[name="probeNu"]');
  assert.ok(input);
  // Happy DOM does not dispatch React's synthetic onChange for text inputs. Exercise the
  // installed draft handler without submitting, just as the existing form integration tests do.
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

async function submitSpectrum() {
  const form = host.querySelector("form");
  assert.ok(form);
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

test("the real moving-clock reader view highlights the German sentence and both English halves, then clears them", async () => {
  const nodes = [
    sentence("s4-p9-s2", "german"),
    sentence("s4-p9-s2a", "english"),
    sentence("s4-p9-s2b", "english"),
  ];
  const unrelated = sentence("s4-p9-s1", "german");
  const originalText = nodes.map((node) => node.textContent);
  const panel = await mount(
    <Sr05ClarificationView instanceId="reader-clock" mode={null} presentation="standard" />,
    "special-relativity",
  );
  const laboratory = host.querySelector("[data-instrument-id='sr-05']");
  expect(laboratory?.getAttribute("data-instance-id")).toBe("reader-clock");
  expect(lit("sr05-s4-moving-clock")).toBe(true);
  expectCleared(nodes);
  await disclose(panel, true);
  for (const node of nodes) {
    expect(node.getAttribute("data-live-weave-meaning")).toBe("quantity-compared");
    const descriptions = node.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(descriptions).toContain("existing-source-note");
    expect(
      descriptions.some((id) =>
        document.getElementById(id)?.textContent?.includes("loss per second"),
      ),
    ).toBe(true);
  }
  expectCleared([unrelated]);
  expect(nodes.map((node) => node.textContent)).toEqual(originalText);

  await act(async () =>
    host.querySelector<HTMLButtonElement>('[data-preset-id="sr-05-low-speed-1e-4"]')?.click(),
  );
  expect(lit("sr05-s4-moving-clock")).toBe(false);
  expectCleared(nodes);
  expect(host.querySelector('[data-field="dilationLossExact"]')?.textContent).not.toBe("0");

  await act(async () =>
    host.querySelector<HTMLButtonElement>('[data-preset-id="sr-05-inertial-0.6c"]')?.click(),
  );
  expect(lit("sr05-s4-moving-clock")).toBe(true);
  await disclose(panel, false);
  expectCleared(nodes);
  await disclose(panel, true);
  expect(nodes[0]?.hasAttribute("data-live-weave-owner")).toBe(true);
  await act(async () => root?.unmount());
  root = null;
  expectCleared(nodes);
});

test("the real spectrum reader points only from accepted settings and withdraws pointers for a refused request", async () => {
  const wien = [sentence("s4-p1-s3", "german"), sentence("s4-p1-s3", "english")];
  const classical = [sentence("s2-p2-s2", "german"), sentence("s2-p2-s2", "english")];
  const panel = await mount(
    <Lq03ClarificationView instanceId="reader-spectrum" mode={null} presentation="standard" />,
    "light-quanta",
  );
  const laboratory = host.querySelector("[data-instrument-id='lq-03']");
  const runId = laboratory?.getAttribute("data-run-id");
  const href = window.location.href;
  await disclose(panel, true);
  expect(lit("lq03-s4-wien-confirmed-within-limits")).toBe(true);
  expect(wien[0]?.getAttribute("data-live-weave-meaning")).toBe("agreement-within-stated-bound");
  expectCleared(classical);

  await typeProbe("1e11");
  expect(lit("lq03-s4-wien-confirmed-within-limits")).toBe(true);
  expect(lit("lq03-s2-classical-regime")).toBe(false);
  expect(host.querySelector('[data-weave-context="probeNu"]')?.textContent).toContain(
    "600000000000000",
  );
  await submitSpectrum();
  expect(lit("lq03-s4-wien-confirmed-within-limits")).toBe(false);
  expect(lit("lq03-s2-classical-regime")).toBe(true);
  expect(lit("lq03-s4-outside-wien-regime")).toBe(true);
  expect(wien[0]?.getAttribute("data-live-weave-meaning")).toBe("outside-selected-domain");
  expect(classical[0]?.getAttribute("data-live-weave-meaning")).toBe(
    "agreement-within-stated-bound",
  );
  expect(laboratory?.getAttribute("data-instance-id")).toBe("reader-spectrum");
  expect(laboratory?.getAttribute("data-run-id")).toBe(runId);
  expect(window.location.href).toBe(href);

  await typeProbe("");
  await submitSpectrum();
  expect(host.querySelector('[data-weave-inactive="refused"]')).not.toBeNull();
  expect(host.querySelector('[data-weave-lit="true"]')).toBeNull();
  expectCleared([...wien, ...classical]);
  await typeProbe("6e14");
  await submitSpectrum();
  expect(lit("lq03-s4-wien-confirmed-within-limits")).toBe(true);
  expect(lit("lq03-s2-classical-regime")).toBe(false);
  expectCleared(classical);
  await act(async () => root?.unmount());
  root = null;
  expectCleared(wien);
});

test("a reader view cannot annotate a different paper whose sentence ids happen to match", async () => {
  const node = sentence("s4-p9-s2", "german");
  const panel = await mount(
    <Sr05ClarificationView instanceId="wrong-paper-clock" mode={null} presentation="standard" />,
    "light-quanta",
  );
  await disclose(panel, true);
  expect(lit("sr05-s4-moving-clock")).toBe(true);
  expectCleared([node]);
});

for (const [paper, sentenceId, element] of [
  ["special-relativity", "s4-p9-s2", <MovingClocksLab key="clock" />],
  ["light-quanta", "s4-p1-s3", <SpectrumLab key="spectrum" restoreFromLocation={false} />],
] as const) {
  test(`${paper} standalone lab keeps readable passage links without claiming the surrounding paper`, async () => {
    const node = sentence(sentenceId, "german");
    const panel = await mount(element, paper);
    await disclose(panel, true);
    expect(
      host.querySelector(`a[href="/papers/${paper}/view/german/#${sentenceId}"]`),
    ).not.toBeNull();
    expect(
      host.querySelector(`a[href="/papers/${paper}/view/english/#${sentenceId}"]`),
    ).not.toBeNull();
    expectCleared([node]);
  });
}

test("both reader adapters include the prepared comparison and exact source links in server HTML", () => {
  const clock = renderToStaticMarkup(
    <Sr05ClarificationView instanceId="server-clock" mode={null} presentation="standard" />,
  );
  const spectrum = renderToStaticMarkup(
    <Lq03ClarificationView instanceId="server-spectrum" mode={null} presentation="standard" />,
  );
  expect(clock).toContain('data-weave-predicate="sr05-s4-moving-clock"');
  expect(clock).toContain("/papers/special-relativity/view/english/#s4-p9-s2");
  expect(spectrum).toContain('data-weave-predicate="lq03-s4-wien-confirmed-within-limits"');
  expect(spectrum).toContain("/papers/light-quanta/view/german/#s4-p1-s3");
  expect(clock).toContain("Prepared worked example");
  expect(spectrum).toContain("Prepared worked example");
  for (const html of [clock, spectrum]) {
    expect(html).not.toContain('data-weave-inactive="refused"');
    expect(html).toContain('data-predict-response="awaiting"');
  }
});
