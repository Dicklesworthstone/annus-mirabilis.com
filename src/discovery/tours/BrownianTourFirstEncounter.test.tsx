import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import brownianEntrance from "../../../content/arguments/brownian-motion/entrance-brownian-motion.json";
import { validateEntranceRecord } from "../../content/entrances/entranceRecord.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { BrownianTourFirstEncounter } from "./BrownianTourFirstEncounter.tsx";

const record = validateEntranceRecord(brownianEntrance);

describe("the Brownian tour entrance before JavaScript", () => {
  test("the authored and doubled comparisons are readable without algebra or an interactive owner", () => {
    const html = renderToStaticMarkup(<BrownianTourFirstEncounter record={record} />);
    const text = html.replace(/<[^>]*>/g, "");
    expect(html).toContain('id="entry-brownian-motion"');
    expect(html).toContain('data-tour-entrance="brownian-motion"');
    expect(html).toContain("three steps left");
    expect(html).toContain("three steps right");
    expect(html).toContain("5 squared units");
    expect(html).toContain("20 squared units");
    expect(html).toContain("2.236 units");
    expect(html).toContain("4.472 units");
    expect(html).toContain("not a measured dataset");
    expect(html).toContain("disabled");
    expect(html).toContain("The worked tables are available without JavaScript");
    expect(text).not.toMatch(/[²³√∑=]|\\(?:frac|sqrt|Delta)\b/u);
    expect(html).not.toMatch(/class="(?:formula|katex)|<math\b|<sup\b|<sub\b/);
    expect(html).not.toContain('data-instrument-id="');
    expect(html).toContain('href="/foundations/mean-variance-rms/"');
    expect(html).toContain('href="/lab/bm-01/"');
    expect(html).toContain('href="/papers/brownian-motion/s5/#s5"');
  });

  test("the introduction and bridge come from the supplied entrance record", () => {
    const revised = {
      ...record,
      question: "A question from the supplied record",
      story: "The supplied story reaches the tour.",
      bridge: {
        ...record.bridge,
        newSkill: "a supplied description of the skill.",
        whyUsefulHere: "The supplied reason for continuing.",
      },
    };
    const html = renderToStaticMarkup(<BrownianTourFirstEncounter record={revised} />);
    for (const text of [
      revised.question,
      revised.story,
      revised.bridge.newSkill,
      revised.bridge.whyUsefulHere,
    ]) expect(html).toContain(text);
  });
});

function find<T extends Element>(container: HTMLElement, selector: string): T {
  const element = container.querySelector<T>(selector);
  expect(element).not.toBeNull();
  return element as T;
}

type Handlers = Record<string, ((event: unknown) => void) | undefined>;

function props(input: HTMLInputElement, target: Element = input): Handlers {
  const key = Object.keys(input).find((candidate) => candidate.startsWith("__reactProps$"));
  expect(key).toBeDefined();
  const handlers = key
    ? (target as unknown as Record<string, Handlers | undefined>)[key]
    : undefined;
  expect(handlers).toBeDefined();
  return handlers ?? {};
}

async function edit(container: HTMLElement, mark: number, value: string) {
  const input = find<HTMLInputElement>(container, 'input[name="mark-' + mark + '"]');
  await act(async () => {
    input.value = value;
    const handler = props(input).onChange;
    expect(handler).toBeDefined();
    handler?.({ target: input, currentTarget: input });
  });
}

async function apply(container: HTMLElement) {
  const input = find<HTMLInputElement>(container, "input");
  const form = find<HTMLFormElement>(container, "form");
  await act(async () => {
    const handler = props(input, form).onSubmit;
    expect(handler).toBeDefined();
    handler?.({ preventDefault() {} });
  });
}

async function click(container: HTMLElement, text: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent === text,
  );
  expect(button).toBeDefined();
  await act(async () => button?.click());
}

function values(container: HTMLElement) {
  return Object.fromEntries(
    [...container.querySelectorAll("[data-brownian-tour-current] [data-output]")].map((cell) => [
      cell.getAttribute("data-output"),
      Number(cell.getAttribute("data-value")),
    ]),
  );
}

function staysEquationFree(container: HTMLElement) {
  expect(container.textContent).not.toMatch(/[²³√∑=]|\\(?:frac|sqrt|Delta)\b/u);
  expect(container.querySelector(".formula, .katex, math, sup, sub")).toBeNull();
}

describe("the Brownian tour's accepted endpoint controls", () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
    await act(async () => root.render(<BrownianTourFirstEncounter record={record} />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  test("drafts leave the shown example alone; applying updates every summary without adding equations", async () => {
    const original = values(container);
    await edit(container, 1, "-2");
    await edit(container, 2, "0");
    await edit(container, 4, "5");
    expect(values(container)).toEqual(original);
    expect(container.textContent).toContain("Draft positions have not been applied");
    await apply(container);
    const actual = values(container);
    expect(actual["mean-signed"]).toBe(1);
    expect(actual["mean-absolute"]).toBe(2);
    expect(actual["mean-square"]).toBe(7.5);
    expect(actual["typical-distance"]).toBeCloseTo(2.7386127875258306, 12);
    expect(find(container, '[data-displacement-row="mark-4"]').textContent).toContain("five steps right");
    expect(find(container, '[role="status"]').textContent).toContain("Positions applied");
    staysEquationFree(container);
  });

  test("doubling follows the accepted edited endpoints instead of restoring a canned doubled example", async () => {
    await edit(container, 1, "-2");
    await edit(container, 2, "0");
    await edit(container, 4, "5");
    await apply(container);
    await click(container, "Double the shown distances");
    expect(values(container)["mean-signed"]).toBe(2);
    expect(values(container)["mean-absolute"]).toBe(4);
    expect(values(container)["mean-square"]).toBe(30);
    expect(
      [...container.querySelectorAll<HTMLInputElement>("input")].map((input) => input.value),
    ).toEqual(["-4", "0", "2", "10"]);
    staysEquationFree(container);
    await click(container, "Restore the authored example");
    expect(values(container)["mean-square"]).toBe(5);
    expect(
      [...container.querySelectorAll<HTMLInputElement>("input")].map((input) => input.value),
    ).toEqual(["-3", "-1", "1", "3"]);
  });

  test("blank, fractional, nonfinite and oversized drafts preserve the accepted example and recover", async () => {
    const original = values(container);
    for (const bad of ["", "0.5", "1e400", "1000001"]) {
      await edit(container, 2, bad);
      await apply(container);
      expect(values(container)).toEqual(original);
      expect(find(container, '[role="alert"]').textContent).toContain("last accepted positions");
      expect(find(container, 'input[name="mark-2"]').getAttribute("aria-invalid")).toBe("true");
      staysEquationFree(container);
    }
    await click(container, "Restore the authored example");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(values(container)).toEqual(original);
  });

  test("a doubling beyond the owner's arithmetic range cannot publish new endpoints", async () => {
    await edit(container, 4, "1000000");
    await apply(container);
    const accepted = values(container);
    await click(container, "Double the shown distances");
    expect(values(container)).toEqual(accepted);
    expect(find<HTMLInputElement>(container, 'input[name="mark-4"]').value).toBe("1000000");
    expect(find(container, '[role="alert"]').textContent).toContain("last accepted positions");
    staysEquationFree(container);
  });
});
