import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { FoundationConstruction } from "./FoundationConstruction.tsx";

describe("observation workbenches operate through the shared foundation dispatcher", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  async function mount(foundationId: string) {
    await act(async () => root.render(<FoundationConstruction foundationId={foundationId} />));
  }
  async function type(name: string, value: string) {
    const field = container.querySelector<HTMLTextAreaElement>(`textarea[name="${name}"]`);
    expect(field).not.toBeNull();
    expect(field?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      if (field) {
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }
  async function submit() {
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }
  async function click(label: string) {
    const button = [...container.querySelectorAll("button")].find(
      (entry) => entry.textContent === label,
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
  }
  async function choose(name: string, value: string) {
    const field = container.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
    expect(field).not.toBeNull();
    expect(field?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      if (field) {
        field.value = value;
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }
  function readouts(attribute: string) {
    const entries = [...container.querySelectorAll(`[${attribute}]`)];
    expect(entries.length).toBeGreaterThan(0);
    return Object.fromEntries(
      entries.map((entry) => [
        entry.getAttribute(attribute),
        entry.textContent?.replace(/\s+/gu, " ").trim(),
      ]),
    );
  }
  function outputs() {
    return [
      ...container.querySelectorAll("svg, table, .observation-readouts, [role='status']"),
    ].map((entry) => entry.outerHTML);
  }

  test("custom nonzero observations update all averages, points, and table together", async () => {
    await mount("foundation:mean-variance-rms");
    expect(readouts("data-observation-output")).toMatchObject({
      mean: "0 µm",
      variance: "5 µm²",
      "mean-square": "5 µm²",
    });
    const before = outputs();
    await type("observations", "0, 2, 4, 6");
    expect(outputs()).toEqual(before);
    expect(container.textContent).toContain("Apply the edited observations");
    await submit();
    expect(readouts("data-observation-output")).toEqual({
      mean: "3 µm",
      "mean-absolute": "3 µm",
      rms: "3.742 µm",
      "standard-deviation": "2.236 µm",
      "mean-square": "14 µm²",
      variance: "5 µm²",
    });
    expect(outputs()).not.toEqual(before);
    expect(container.querySelectorAll("[data-observation-row]").length).toBe(4);
    expect(container.querySelector("[data-observation-row='0']")?.textContent).toContain("−3");
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain(
      "signed mean is 3",
    );
    expect(container.querySelectorAll("[role='status']").length).toBe(1);
    expect(container.querySelector(".construction-table-wrap")?.getAttribute("tabindex")).toBe("0");
  });

  test("invalid edits retain every accepted output and recover on the next valid submission", async () => {
    await mount("mean-variance-rms");
    await type("observations", "1, 5, 9");
    await submit();
    const accepted = outputs();
    for (const invalid of ["", "1, NaN, 2", "1001", "1,,2"]) {
      await type("observations", invalid);
      await submit();
      expect(outputs()).toEqual(accepted);
      expect(container.querySelector("[role='alert']")?.textContent).toContain(
        "last accepted sample",
      );
      expect(container.querySelector("textarea")?.getAttribute("aria-invalid")).toBe("true");
    }
    await type("observations", "-2, -2");
    await submit();
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(readouts("data-observation-output")).toMatchObject({
      mean: "−2 µm",
      rms: "2 µm",
      variance: "0 µm²",
      "standard-deviation": "0 µm",
    });
    expect(container.querySelectorAll("[data-observation-row]").length).toBe(2);
  });

  test("examples expose zero spread at nonzero displacement and return to the balanced case", async () => {
    await mount("mean-variance-rms");
    await click("All at 3 µm");
    expect(readouts("data-observation-output")).toMatchObject({
      mean: "3 µm",
      rms: "3 µm",
      variance: "0 µm²",
    });
    await click("Shifted example (+3 µm)");
    expect(readouts("data-observation-output")).toMatchObject({
      mean: "3 µm",
      variance: "5 µm²",
      "mean-square": "14 µm²",
    });
    await click("Balanced sample");
    expect(readouts("data-observation-output")).toMatchObject({
      mean: "0 µm",
      variance: "5 µm²",
      "mean-square": "5 µm²",
    });
  });

  test("unequal bins separate height from probability and ruler changes preserve the counts and areas", async () => {
    await mount("distributions");
    expect(readouts("data-histogram-output")).toMatchObject({
      count: "3 of 10",
      width: "2 µm",
      density: "0.15 per micrometre",
      probability: "0.3",
      area: "0.3",
    });
    await click("Unequal-width example");
    expect(container.querySelectorAll("[data-histogram-row]").length).toBe(3);
    expect(container.textContent).toContain(
      "the tallest bar does not contain the most observations",
    );
    await choose("histogram-bin", "2");
    expect(readouts("data-histogram-output")).toMatchObject({
      selected: "3",
      count: "6 of 10",
      width: "5 µm",
      density: "0.12 per micrometre",
      probability: "0.6",
      area: "0.6",
    });
    const bars = [...container.querySelectorAll("svg:first-of-type rect")].map((entry) => [
      entry.getAttribute("x"),
      entry.getAttribute("width"),
      entry.getAttribute("height"),
    ]);
    await choose("histogram-unit", "metre");
    const changed = readouts("data-histogram-output");
    expect(changed).toMatchObject({
      selected: "3",
      count: "6 of 10",
      probability: "0.6",
      area: "0.6",
    });
    expect(changed.density).toContain("per metre");
    expect(changed.width).toContain("10−6 m");
    const changedBars = [...container.querySelectorAll("svg:first-of-type rect")].map((entry) => [
      entry.getAttribute("x"),
      entry.getAttribute("width"),
      entry.getAttribute("height"),
    ]);
    expect(changedBars.length).toBe(bars.length);
    for (let i = 0; i < bars.length; i += 1)
      for (let j = 0; j < 3; j += 1)
        expect(Number(changedBars[i]?.[j])).toBeCloseTo(Number(bars[i]?.[j]), 8);
    expect(container.querySelectorAll("svg").length).toBe(2);
  });

  test("histogram edits apply atomically, refuse uncovered points, and count boundary points once", async () => {
    await mount("distributions");
    const initial = outputs();
    await type("observations", "0, 1, 2, 3");
    await type("boundaries", "0, 1, 2");
    expect(outputs()).toEqual(initial);
    await submit();
    expect(container.querySelector("[role='alert']")?.textContent).toContain(
      "include every observation",
    );
    expect(
      container.querySelector("textarea[name='boundaries']")?.getAttribute("aria-invalid"),
    ).toBe("true");
    expect(outputs()).toEqual(initial);
    await type("boundaries", "0, 1, 2, 3");
    await submit();
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(readouts("data-histogram-output")).toMatchObject({
      count: "1 of 4",
      probability: "0.25",
    });
    const rows = [...container.querySelectorAll("[data-histogram-row]")];
    expect(rows.map((row) => row.querySelectorAll("td")[1]?.textContent)).toEqual(["1", "1", "2"]);
    await choose("histogram-bin", "2");
    expect(readouts("data-histogram-output")).toMatchObject({
      count: "2 of 4",
      probability: "0.5",
    });
    expect(container.querySelectorAll("[role='status']").length).toBe(1);
    expect(container.textContent).not.toMatch(/NaN|Infinity/u);
  });

  test("both constructions remain useful without scripts and have independent accessible ids", () => {
    const html = renderToStaticMarkup(
      <>
        <FoundationConstruction foundationId="mean-variance-rms" />
        <FoundationConstruction foundationId="distributions" />
        <FoundationConstruction foundationId="mean-variance-rms" />
      </>,
    );
    expect(html.match(/JavaScript is off/g)?.length).toBe(3);
    expect(html.match(/<h[1-6]>What it shows, in words<\/h[1-6]>/g)?.length).toBe(3);
    expect(html.match(/<table>/g)?.length).toBe(3);
    expect(html.match(/<svg /g)?.length).toBe(6);
    const ids = [...html.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(html).toContain("5 µm²");
    expect(html).toContain("variance stays 5 µm²");
    expect(html).toContain("The bars do not reveal where within a bin");
  });
});
