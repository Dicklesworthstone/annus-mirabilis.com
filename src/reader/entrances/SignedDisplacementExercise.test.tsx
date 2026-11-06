import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { withMode1904Guard } from "../../physics/reference/constants.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { SignedDisplacementExercise } from "./SignedDisplacementExercise.tsx";

describe("the signed-displacement exercise before JavaScript", () => {
  test("the actual arithmetic and its illustrative status are readable without a later physical model", () => {
    const html = withMode1904Guard(() => renderToStaticMarkup(<SignedDisplacementExercise />));
    expect(html).toContain("Static worked example");
    expect(html).toContain("authored arithmetic examples");
    expect(html).toContain("not a measured dataset");
    expect(html).toContain("three steps left");
    expect(html).toContain("three steps right");
    expect(html).toContain('data-output="signed-sum">0 units');
    expect(html).toContain('data-output="mean-absolute">2 units');
    expect(html).toContain('data-output="mean-square">5 squared units');
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript is off");
    expect(html).not.toMatch(/molecular|Gaussian|Langevin|diffusivity|modern-si|299792458|6\.022/);
    expect(html).not.toContain('data-instrument-id="');
    expect(html).not.toContain('type="range"');
  });
});

function find<T extends Element>(container: HTMLElement, selector: string): T {
  const element = container.querySelector<T>(selector);
  expect(element).not.toBeNull();
  return element as T;
}

type Handlers = Record<string, ((event: unknown) => void) | undefined>;

/** The established happy-dom control pattern, using the real mounted component's handlers. */
function props(input: HTMLInputElement, target: Element = input): Handlers {
  const key = Object.keys(input).find((candidate) => candidate.startsWith("__reactProps$"));
  expect(key).toBeDefined();
  const handlers = key
    ? (target as unknown as Record<string, Handlers | undefined>)[key]
    : undefined;
  expect(handlers).toBeDefined();
  return handlers ?? {};
}

async function edit(container: HTMLElement, mark: number, text: string) {
  const input = find<HTMLInputElement>(container, `input[name="mark-${mark}"]`);
  await act(async () => {
    input.value = text;
    const handler = props(input).onChange;
    expect(handler).toBeDefined();
    handler?.({ target: input, currentTarget: input });
  });
}

async function submit(container: HTMLElement) {
  const input = find<HTMLInputElement>(container, "input");
  const form = find<HTMLFormElement>(container, "form");
  await act(async () => {
    const handler = props(input, form).onSubmit;
    expect(handler).toBeDefined();
    handler?.({ preventDefault() {} });
  });
}

function readouts(container: HTMLElement) {
  return Object.fromEntries(
    [...container.querySelectorAll("[data-output]")].map((cell) => [
      cell.getAttribute("data-output"),
      cell.textContent,
    ]),
  );
}

async function click(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent === label,
  );
  expect(button).toBeDefined();
  await act(async () => button?.click());
}

describe("the signed-displacement form keeps its accepted arithmetic", () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
    await act(async () => root.render(<SignedDisplacementExercise />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  test("typed edits wait for Apply, then all rows and summaries agree", async () => {
    const exercise = find<HTMLElement>(container, "[data-exercise]");
    const original = readouts(container);
    await edit(container, 1, "-2");
    await edit(container, 2, "0");
    await edit(container, 4, "5");
    expect(readouts(container)).toEqual(original);
    expect(exercise.getAttribute("data-accepted-revision")).toBe("0");
    await submit(container);
    expect(readouts(container)).toEqual({
      "signed-sum": "4 units",
      "mean-signed": "1 units",
      "mean-absolute": "2 units",
      "mean-square": "7.5 squared units",
    });
    expect(exercise.getAttribute("data-accepted-revision")).toBe("1");
    expect(container.textContent).toContain("Calculated from your coordinates");
    const lastRow = find<HTMLTableRowElement>(container, '[data-displacement-row="mark-4"]');
    expect(lastRow.textContent).toContain("five steps right");
    expect([...lastRow.querySelectorAll("td")].map((cell) => cell.textContent)).toEqual([
      "five steps right",
      "+5",
      "5",
      "25",
    ]);
    expect(find(container, '[role="status"]').textContent).toContain("Coordinates applied");
  });

  test("blank and fractional inputs preserve the last result, identify the field, and recover", async () => {
    const exercise = find<HTMLElement>(container, "[data-exercise]");
    await edit(container, 4, "5");
    await submit(container);
    const previous = readouts(container);
    const revision = exercise.getAttribute("data-accepted-revision");
    for (const bad of ["", "0.5", "1e400", "1000001"]) {
      await edit(container, 2, bad);
      await submit(container);
      expect(readouts(container)).toEqual(previous);
      expect(exercise.getAttribute("data-accepted-revision")).toBe(revision);
      expect(exercise.getAttribute("data-currency-state")).toBe("refused");
      expect(find(container, '[role="alert"]').textContent).toContain("last accepted coordinates");
      expect(find(container, 'input[name="mark-2"]').getAttribute("aria-invalid")).toBe("true");
    }
    await edit(container, 2, "-1");
    await submit(container);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(exercise.getAttribute("data-currency-state")).toBe("current");
    expect(readouts(container)).toEqual(previous);
  });

  test("doubling uses the shown coordinates, updates their form, and reset restores the authored case", async () => {
    await click(container, "Double the shown displacements");
    expect(readouts(container)).toEqual({
      "signed-sum": "0 units",
      "mean-signed": "0 units",
      "mean-absolute": "4 units",
      "mean-square": "20 squared units",
    });
    expect(
      [...container.querySelectorAll<HTMLInputElement>("input")].map((input) => input.value),
    ).toEqual(["-6", "-2", "2", "6"]);
    await click(container, "Restore the authored example");
    expect(readouts(container)["mean-square"]).toBe("5 squared units");
    expect(
      [...container.querySelectorAll<HTMLInputElement>("input")].map((input) => input.value),
    ).toEqual(["-3", "-1", "1", "3"]);
  });

  test("doubling outside the declared arithmetic range cannot replace the accepted example", async () => {
    await edit(container, 4, "1000000");
    await submit(container);
    const previous = readouts(container);
    const acceptedForm = [...container.querySelectorAll<HTMLInputElement>("input")].map(
      (input) => input.value,
    );
    await click(container, "Double the shown displacements");
    expect(readouts(container)).toEqual(previous);
    expect(
      [...container.querySelectorAll<HTMLInputElement>("input")].map((input) => input.value),
    ).toEqual(acceptedForm);
    expect(find(container, '[role="alert"]').textContent).toContain(
      "between −1,000,000 and +1,000,000",
    );
  });
});
