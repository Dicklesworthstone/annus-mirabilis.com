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
import { OsmoticTable } from "./OsmoticTable.tsx";
import { SinkingSpheres } from "./SinkingSpheres.tsx";

describe("the transport foundations can be investigated using labelled fields", () => {
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
  async function type(name: string, value: string) {
    const field = container.querySelector<HTMLInputElement>(`[name='${name}']`);
    expect(field?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      if (field) {
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }
  async function click(text: string) {
    const button = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === text,
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
  }
  async function submit() {
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () =>
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  }
  function value(prefix: string, key: string) {
    const element = container.querySelector(`[data-${prefix}-value='${key}']`);
    expect(element).not.toBeNull();
    const raw = element?.getAttribute("data-value");
    return raw === null || raw === undefined ? null : Number(raw);
  }

  test("settling changes together after Apply, and the scaling buttons hold the other settings fixed", async () => {
    await act(async () => root.render(<SinkingSpheres />));
    const original = value("settling", "speed") ?? NaN;
    const current = container.querySelector("[data-stokes-current]")?.outerHTML;
    await type("stokes-radius", "1");
    expect(container.querySelector("[data-stokes-current]")?.outerHTML).toBe(current);
    expect(container.textContent).toContain("Changes are waiting");
    await submit();
    expect((value("settling", "speed") ?? 0) / original).toBeCloseTo(4, 12);
    await click("Double viscosity");
    expect((value("settling", "speed") ?? 0) / original).toBeCloseTo(2, 12);
    expect(value("settling", "radius")).toBe(1);
    await click("Match the liquid density");
    expect(value("settling", "speed")).toBe(0);
    expect(value("settling", "time")).toBeNull();
    expect(container.querySelector("[role='status']")?.textContent).toContain(
      "no gravitational drift",
    );
    await type("stokes-grainDensity", "800");
    await submit();
    expect(value("settling", "speed")).toBeLessThan(0);
    expect(container.querySelector("[role='status']")?.textContent).toContain("rises");
    await click("Restore the settling example");
    expect(value("settling", "speed")).toBe(original);
  });

  test("settling preserves accepted results on incomplete drafts and an inadmissible flow", async () => {
    await act(async () => root.render(<SinkingSpheres />));
    const before = container.querySelector("[data-stokes-current]")?.outerHTML;
    for (const text of ["", "NaN", "1e-999", "1+1"]) {
      await type("stokes-radius", text);
      await submit();
      expect(container.querySelector("[data-stokes-current]")?.outerHTML).toBe(before);
      const field = container.querySelector("[name='stokes-radius']");
      expect(field?.getAttribute("aria-invalid")).toBe("true");
      expect(field?.getAttribute("aria-describedby")).toContain(
        container.querySelector("[role='alert']")?.id ?? "missing",
      );
    }
    await type("stokes-radius", "100");
    await type("stokes-viscosity", "0.1");
    await type("stokes-grainDensity", "20000");
    await submit();
    expect(container.querySelector("[role='alert']")?.textContent).toContain("Reynolds");
    expect(container.querySelector("[data-stokes-current]")?.outerHTML).toBe(before);
    await click("Restore the settling example");
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  test("the selective partition changes pressure with volume and count, but not radius", async () => {
    await act(async () => root.render(<OsmoticTable />));
    const pressure = value("osmotic", "pressure") ?? NaN;
    const fraction = value("osmotic", "fraction") ?? NaN;
    await click("Double particle radius");
    expect(value("osmotic", "pressure")).toBe(pressure);
    expect((value("osmotic", "fraction") ?? 0) / fraction).toBeCloseTo(8, 12);
    await click("Halve accessible volume");
    expect((value("osmotic", "pressure") ?? 0) / pressure).toBeCloseTo(2, 12);
    await click("Double particle count");
    expect(value("osmotic", "pressure")).toBeNull();
    expect(container.querySelector("[role='status']")?.textContent).toContain(
      "no pressure is calculated",
    );
    expect(container.textContent).toContain("not been carried over");
    await type("osmotic-count", "0");
    await submit();
    expect(value("osmotic", "pressure")).toBe(0);
    expect(value("osmotic", "fraction")).toBe(0);
    expect(container.querySelector("[data-osmotic-value='pressure']")?.textContent).toBe("0 Pa");
    await click("Restore the partition example");
    expect(value("osmotic", "pressure")).toBe(pressure);
  });

  test("draft edits never alter a partition's accepted result until complete and valid", async () => {
    await act(async () => root.render(<OsmoticTable />));
    const before = container.querySelector("[data-osmotic-current]")?.outerHTML;
    for (const text of ["", "-", "1.5", "1e-999"]) {
      await type("osmotic-count", text);
      await submit();
      expect(container.querySelector("[data-osmotic-current]")?.outerHTML).toBe(before);
      expect(container.querySelector("[name='osmotic-count']")?.getAttribute("aria-invalid")).toBe(
        "true",
      );
    }
    await type("osmotic-count", "2000");
    await type("osmotic-temperature", "315");
    await submit();
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(value("osmotic", "count")).toBe(2000);
    expect(value("osmotic", "temperature")).toBe(315);
  });

  test("multiple lessons retain independent settings and distinct label targets", async () => {
    await act(async () =>
      root.render(
        <>
          <SinkingSpheres />
          <SinkingSpheres />
          <OsmoticTable />
          <OsmoticTable />
        </>,
      ),
    );
    const settling = [...container.querySelectorAll("[data-stokes-current]")];
    const second = settling[1]?.outerHTML;
    await type("stokes-radius", "1");
    await submit();
    expect(settling[1]?.outerHTML).toBe(second);
    const fields = [...container.querySelectorAll<HTMLInputElement>("input")];
    expect(fields.length).toBeGreaterThan(0);
    expect(new Set(fields.map((field) => field.id)).size).toBe(fields.length);
    for (const field of fields) expect(field.labels?.length).toBeGreaterThan(0);
  });
});

test("static HTML keeps the original worked tables and disables controls until they can work", () => {
  for (const component of [<SinkingSpheres key="stokes" />, <OsmoticTable key="osmotic" />]) {
    const html = renderToStaticMarkup(component);
    expect(html).toContain('<fieldset class="construction-controls" disabled="">');
    expect(html).toContain('<table class="data-table">');
    expect(html).toContain("What it shows, in words");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  }
});
