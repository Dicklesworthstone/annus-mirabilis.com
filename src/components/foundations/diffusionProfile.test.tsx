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

describe("the diffusion foundation can be operated without manipulating a drawing", () => {
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

  async function mount() {
    await act(async () =>
      root.render(<FoundationConstruction foundationId="diffusion-equation" />),
    );
  }
  async function type(name: "diffusivity" | "minutes", value: string) {
    const field = container.querySelector<HTMLInputElement>(`[name='diffusion-${name}']`);
    expect(field).not.toBeNull();
    expect(field?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      if (field) {
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }
  async function choose(shape: string) {
    const field = container.querySelector<HTMLSelectElement>("[name='diffusion-shape']");
    expect(field).not.toBeNull();
    await act(async () => {
      if (field) {
        field.value = shape;
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }
  async function submit() {
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () =>
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  }
  async function click(label: string) {
    const button = [...container.querySelectorAll("button")].find(
      (element) => element.textContent === label,
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
  }
  function current() {
    const element = container.querySelector("[data-diffusion-current]");
    expect(element).not.toBeNull();
    return element?.outerHTML;
  }
  function output(name: string) {
    const element = container.querySelector(`[data-diffusion-output='${name}']`);
    expect(element).not.toBeNull();
    return element?.textContent;
  }
  function curve() {
    return container.querySelector("[data-diffusion-evolved]")?.getAttribute("d");
  }

  test("one accepted update changes the curve, cell table and spoken summary together", async () => {
    await mount();
    expect(container.querySelector("fieldset")?.disabled).toBe(false);
    const before = current();
    const initialCurve = curve();
    const reference = container.querySelector("[data-diffusion-start]")?.getAttribute("d");
    const maximum = Number(output("maximum"));
    const minimum = Number(output("minimum"));
    const cell = container.querySelector(
      "[data-diffusion-cell='4.5'] [data-diffusion-density]",
    )?.textContent;
    await type("diffusivity", "2");
    expect(current()).toBe(before);
    expect(container.textContent).toContain("Changes are waiting");
    await submit();
    expect(curve()).not.toBe(initialCurve);
    expect(container.querySelector("[data-diffusion-start]")?.getAttribute("d")).toBe(reference);
    expect(Number(output("maximum"))).toBeLessThan(maximum);
    expect(Number(output("minimum"))).toBeGreaterThan(minimum);
    expect(output("total")).toBe("18");
    expect(output("retained")).toBe("100%");
    expect(
      container.querySelector("[data-diffusion-cell='4.5'] [data-diffusion-density]")?.textContent,
    ).not.toBe(cell);
    expect(container.querySelector("[role='status']")?.textContent).toContain(
      "diffusivity of 2 square millimetres per minute",
    );
    expect(container.querySelectorAll("[role='status']").length).toBe(1);
    expect(
      container.querySelector(".diffusion-profile svg[role='img']")?.getAttribute("aria-label"),
    ).toContain(`highest density is ${output("maximum")}`);
  });

  test("doubling D and doubling time give the same profile and discard unfinished drafts coherently", async () => {
    await mount();
    await click("Double the diffusion coefficient");
    const faster = curve();
    const fasterCells = [...container.querySelectorAll("[data-diffusion-density]")].map(
      (cell) => cell.textContent,
    );
    await click("Restore the peak and dip");
    await type("diffusivity", "unfinished");
    await choose("step");
    await click("Double the time");
    expect(curve()).toBe(faster);
    expect(
      [...container.querySelectorAll("[data-diffusion-density]")].map((cell) => cell.textContent),
    ).toEqual(fasterCells);
    expect(container.querySelector<HTMLInputElement>("[name='diffusion-diffusivity']")?.value).toBe(
      "1",
    );
    expect(container.querySelector<HTMLInputElement>("[name='diffusion-minutes']")?.value).toBe(
      "8",
    );
    expect(container.querySelector<HTMLSelectElement>("[name='diffusion-shape']")?.value).toBe(
      "peak-dip",
    );
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  test("invalid and partial input keeps the accepted state and associates a readable error with the field", async () => {
    await mount();
    await type("diffusivity", "1.5");
    await submit();
    const before = current();
    for (const value of ["", "-", "5", "NaN", "1+1", "1e-999"]) {
      await type("diffusivity", value);
      await submit();
      expect(current()).toBe(before);
      const field = container.querySelector("[name='diffusion-diffusivity']");
      expect(field?.getAttribute("aria-invalid")).toBe("true");
      const error = container.querySelector("[role='alert']");
      expect(error?.textContent).toContain("still use 1.5 mm²/min and 4 minutes");
      expect(field?.getAttribute("aria-describedby")?.split(" ")).toContain(error?.id);
    }
    await type("diffusivity", "1.5");
    await type("minutes", "61");
    await submit();
    expect(current()).toBe(before);
    expect(
      container.querySelector("[name='diffusion-minutes']")?.getAttribute("aria-invalid"),
    ).toBe("true");
    await type("minutes", "10");
    await submit();
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(current()).not.toBe(before);
    expect(container.querySelector("[role='status']")?.textContent).toContain("After 10 minutes");
  });

  test("a flat shape and zero time retain their values, and controls stop at the declared limits", async () => {
    await mount();
    await choose("uniform");
    await type("diffusivity", "4");
    await type("minutes", "60");
    await submit();
    expect(output("minimum")).toBe("1");
    expect(output("maximum")).toBe("1");
    expect(
      [...container.querySelectorAll("[data-diffusion-density]")].every(
        (cell) => cell.textContent === "1",
      ),
    ).toBe(true);
    for (const button of container.querySelectorAll<HTMLButtonElement>("button")) {
      if (button.textContent?.startsWith("Double")) expect(button.disabled).toBe(true);
    }
    await choose("step");
    await type("minutes", "0");
    await submit();
    expect(output("minimum")).toBe("0.4");
    expect(output("maximum")).toBe("1.6");
    expect(curve()).toBe(container.querySelector("[data-diffusion-start]")?.getAttribute("d"));
    expect(container.querySelector("[role='status']")?.textContent).toContain("Thick on the left");
  });

  test("two constructions have separate accepted states and unique labelled controls", async () => {
    await act(async () =>
      root.render(
        <>
          <FoundationConstruction foundationId="diffusion-equation" />
          <FoundationConstruction foundationId="diffusion-equation" />
        </>,
      ),
    );
    const panels = () => [...container.querySelectorAll("[data-diffusion-current]")];
    expect(panels().length).toBe(2);
    const other = panels()[1]?.outerHTML;
    await type("minutes", "20");
    await submit();
    expect(panels()[1]?.outerHTML).toBe(other);
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const field of container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input, select",
    )) {
      expect(field.labels?.length).toBeGreaterThan(0);
    }
  });

  test("static HTML keeps both earlier figures, the new numerical example, full table and inactive controls", () => {
    const html = renderToStaticMarkup(
      <FoundationConstruction foundationId="foundation:diffusion-equation" headingLevel={4} />,
    );
    expect(html).toContain("JavaScript is off");
    expect(html).toContain("A peak empties, a dip fills");
    expect(html).toContain("What it shows, in words");
    expect(html).toContain("Try the rule in a closed tube");
    expect(html).toContain("100%");
    expect(html).toContain("not measured dye data");
    expect(html).toContain("grid approximates continuous space");
    expect(html.match(/<svg\b[^>]*role="img"/g)?.length).toBe(3);
    expect(html.match(/data-diffusion-cell=/g)?.length).toBe(18);
    expect(html.match(/<fieldset[^>]*disabled=""/g)?.length).toBe(1);
    expect(html).toContain("<h4");
    expect(html).toContain("<h5");
  });
});
