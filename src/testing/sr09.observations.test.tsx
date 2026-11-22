import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import type { Root } from "react-dom/client";
import { DopplerAberrationLab } from "../components/lab/sr09/DopplerAberrationLab.tsx";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../experiments/predict/predictPersistence.ts";
import { DEFAULT_PREPARED_EXAMPLE } from "../experiments/sr09/session.ts";
import { installDom, uninstallDom } from "./reactDom.ts";

let root: Root;
let host: HTMLDivElement;

function required<T>(value: T | null | undefined): T {
  assert(value);
  return value;
}

beforeEach(async () => {
  await installDom();
  installPredictPersistence(REMEMBERS_NOTHING);
  host = document.createElement("div");
  document.body.append(host);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(host);
  await act(async () => {
    root.render(
      <DopplerAberrationLab example={DEFAULT_PREPARED_EXAMPLE} restoreFromLocation={false} />,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  installPredictPersistence(REMEMBERS_NOTHING);
  await uninstallDom();
});

function output(id: string, index?: number): HTMLElement {
  return required(
    host.querySelector<HTMLElement>(
      `[data-output-id="${id}"]${index === undefined ? "" : `[data-output-index="${index}"]`}`,
    ),
  );
}

function instrument(): HTMLElement {
  return required(host.querySelector<HTMLElement>('[data-instrument-id="sr-09"]'));
}

async function type(name: string, value: string) {
  const input = required(host.querySelector<HTMLInputElement>(`input[name="${name}"]`));
  const set = required(Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set);
  await act(async () => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function chooseDetector(value: string) {
  const select = required(host.querySelector<HTMLSelectElement>('select[name="detectorMotion"]'));
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function apply() {
  const form = required(
    host.querySelector<HTMLFormElement>('form[aria-label="Doppler and aberration settings"]'),
  );
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function reveal() {
  const skip = required(
    [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Skip prediction",
    ),
  );
  await act(async () => skip.click());
}

describe("SR-09 detector and named-event interaction", () => {
  test("new answers and their announcements stay behind the prediction response mask", async () => {
    const count = output("detectorCrossings");
    const phase = output("namedEventPhases", 0);
    expect(count.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
      "awaiting",
    );
    expect(phase.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
      "awaiting",
    );
    expect(host.querySelector("[data-phase-query]")?.getAttribute("aria-live")).toBe("off");
    await reveal();
    expect(count.closest("[data-predict-response]")?.getAttribute("data-predict-response")).toBe(
      "shown",
    );
    expect(host.querySelector("[data-phase-query]")?.getAttribute("aria-live")).toBe("polite");
  });

  test("real detector controls publish the counting interval, proper clock, and independent observer view", async () => {
    await reveal();
    expect(output("detectorCrossings").textContent).toBe("4");
    expect(output("detectorProperRateHz").textContent).toBe("250");
    await chooseDetector("rest-in-K");
    await type("countingWindowCycles", "20");
    expect(output("detectorCrossings").textContent).toBe("4");
    await apply();
    expect(output("detectorCrossings").textContent).toBe("20");
    expect(output("countingWindowK").textContent).toBe("40");
    expect(output("detectorProperWindow").textContent).toBe("40");
    expect(output("detectorProperRateHz").textContent).toBe("500");
    const run = instrument().getAttribute("data-run-id");
    await type("countingWindowCycles", "40");
    await apply();
    expect(instrument().getAttribute("data-run-id")).toBe(run);
    expect(output("detectorCrossings").textContent).toBe("40");
    expect(output("detectorProperRateHz").textContent).toBe("500");

    await chooseDetector("custom");
    await type("detectorSpeed", "-0.8");
    await type("countingWindowCycles", "20");
    await apply();
    expect(output("detectorCrossings").textContent).toBe("36");
    expect(output("detectorProperWindow").textContent).toBe("24");
    expect(output("detectorProperRateHz").textContent).toBe("1500");
    const customRun = instrument().getAttribute("data-run-id");
    await type("beta", "0.8");
    await apply();
    expect(instrument().getAttribute("data-run-id")).toBe(customRun);
    expect(output("detectorCrossings").textContent).toBe("36");
    expect(output("detectorProperRateHz").textContent).toBe("1500");
  });

  test("event selection preserves unsubmitted edits and keeps the event when the observer changes", async () => {
    await reveal();
    const run = instrument().getAttribute("data-run-id");
    const originalPhase = output("namedEventPhases", 2).textContent;
    const originalCoordinate = output("namedEventTimesMoving", 1).textContent;
    await type("countingWindowCycles", "30");
    const offset = required(
      host.querySelector<HTMLInputElement>('input[value="sr-09-event-offset"]'),
    );
    await act(async () => offset.click());
    expect(offset.checked).toBe(true);
    expect(host.querySelector<HTMLInputElement>('input[name="countingWindowCycles"]')?.value).toBe(
      "30",
    );
    expect(output("detectorCrossings").textContent).toBe("4");
    expect(instrument().getAttribute("data-run-id")).toBe(run);
    expect(host.querySelector("[data-phase-query]")?.textContent).toContain(
      "Offset downstream event",
    );
    expect(host.querySelector("[data-phase-query]")?.textContent).toContain("agree within");
    await type("beta", "0.8");
    await apply();
    expect(instrument().getAttribute("data-run-id")).toBe(run);
    expect(offset.checked).toBe(true);
    expect(output("namedEventTimesMoving", 1).textContent).not.toBe(originalCoordinate);
    expect(output("namedEventPhases", 2).textContent).toBe(originalPhase);
    expect(host.querySelector("[data-phase-query]")?.getAttribute("data-selected-event-id")).toBe(
      "sr-09-event-offset",
    );
  });

  test("blank windows and forbidden detector speeds keep every accepted reading", async () => {
    await reveal();
    const run = instrument().getAttribute("data-run-id");
    const phase = output("namedEventPhases", 0).textContent;
    await type("countingWindowCycles", "");
    await apply();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("counting window");
    expect(output("detectorCrossings").textContent).toBe("4");
    expect(output("namedEventPhases", 0).textContent).toBe(phase);
    expect(instrument().getAttribute("data-run-id")).toBe(run);
    await type("countingWindowCycles", "20");
    await chooseDetector("custom");
    await type("detectorSpeed", "1");
    await apply();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("detector speed");
    expect(output("detectorCrossings").textContent).toBe("4");
    expect(output("detectorProperRateHz").textContent).toBe("250");
    expect(instrument().getAttribute("data-run-id")).toBe(run);
  });
});
