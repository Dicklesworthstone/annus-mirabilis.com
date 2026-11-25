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

describe("the continuity lesson can be operated through labelled controls", () => {
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
    await act(async () => root.render(<FoundationConstruction foundationId="flux-continuity" />));
  }
  async function type(name: string, value: string) {
    const field = container.querySelector<HTMLInputElement>(`[name='flux-${name}']`);
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
    await act(async () =>
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  }
  async function select(region: string) {
    const field = container.querySelector<HTMLSelectElement>("[name='flux-region']");
    expect(field?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      if (field) {
        field.value = region;
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }
  async function click(label: string) {
    const button = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === label,
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
  }
  function output(name: string) {
    const cell = container.querySelector(`[data-flux-value='${name}']`);
    expect(cell).not.toBeNull();
    return cell?.textContent;
  }
  function current() {
    const element = container.querySelector("[data-flux-current]");
    expect(element).not.toBeNull();
    return element?.outerHTML;
  }

  test("applying complete inputs changes the account, diagram and accessible summary together", async () => {
    await mount();
    expect(container.querySelector("fieldset")?.disabled).toBe(false);
    expect(output("end")).toBe("22");
    const first = current();
    await type("entering", "9");
    await type("seconds", "2");
    await type("area", "2");
    expect(current()).toBe(first);
    expect(container.textContent).toContain("Changes are waiting");
    await submit();
    expect(output("end")).toBe("24");
    expect(output("density-end")).toBe("6");
    expect(output("density-rate")).toBe("0.5");
    expect(output("flux-left")).toBe("2.25");
    expect(output("flux-right")).toBe("1.25");
    expect(output("flux-balance")).toBe("0.5");
    const summary = container.querySelector("[role='status']")?.textContent;
    expect(summary).toContain("20 becomes 24");
    expect(container.querySelector("[data-flux-diagram]")?.getAttribute("aria-label")).toContain(
      summary ?? "missing summary",
    );
    expect(container.querySelectorAll("[role='status']").length).toBe(1);
  });

  test("choosing either half counts the same crossings while the whole cancels the middle", async () => {
    await mount();
    const whole = current();
    await select("left");
    expect(output("start")).toBe("10");
    expect(output("enter")).toBe("7");
    expect(output("leave")).toBe("4");
    expect(output("end")).toBe("13");
    await select("right");
    expect(output("enter")).toBe("4");
    expect(output("leave")).toBe("5");
    expect(output("change")).toBe("−1");
    expect(output("end")).toBe("9");
    await select("whole");
    expect(current()).toBe(whole);
    await type("between", "7");
    await submit();
    expect(output("end")).toBe("22");
    expect(container.textContent).toContain("The 7 middle crossings");
    await select("left");
    expect(output("end")).toBe("10");
    await select("right");
    expect(output("end")).toBe("12");
  });

  test("steady flow and no flow have the same count but different fluxes, and presets preserve accepted dimensions", async () => {
    await mount();
    await type("area", "2");
    await type("seconds", "2");
    await submit();
    await type("area", "unfinished");
    await click("A steady stream");
    expect(output("end")).toBe("20");
    expect(output("density-rate")).toBe("0");
    expect(output("flux-left")).toBe("1.25");
    expect(container.querySelector<HTMLInputElement>("[name='flux-area']")?.value).toBe("2");
    expect(container.querySelector<HTMLInputElement>("[name='flux-seconds']")?.value).toBe("2");
    await click("No crossings");
    expect(output("end")).toBe("20");
    expect(output("density-rate")).toBe("0");
    expect(output("flux-left")).toBe("0");
    await click("More leave than enter");
    expect(output("end")).toBe("16");
    expect(output("density-rate")).toBe("−0.5");
    await select("left");
    await click("Restore the first example");
    expect(output("end")).toBe("22");
    expect(container.querySelector<HTMLSelectElement>("[name='flux-region']")?.value).toBe("whole");
    expect(container.querySelector<HTMLInputElement>("[name='flux-area']")?.value).toBe("1");
  });

  test("partial inputs and impossible local counts retain the previous accepted example with a linked refusal", async () => {
    await mount();
    const first = current();
    for (const value of ["", "-", "NaN", "1+1", "1.5", "101", "18", "1e-999"]) {
      await type("between", value);
      await submit();
      expect(current()).toBe(first);
      const field = container.querySelector("[name='flux-between']");
      expect(field?.getAttribute("aria-invalid")).toBe("true");
      const alert = container.querySelector("[role='alert']");
      expect(alert?.textContent).toContain("last accepted crossings, time and area");
      expect(field?.getAttribute("aria-describedby")?.split(" ")).toContain(alert?.id);
    }
    await type("between", "4");
    await type("area", "0");
    await submit();
    expect(current()).toBe(first);
    expect(container.querySelector("[name='flux-area']")?.getAttribute("aria-invalid")).toBe(
      "true",
    );
    await type("area", "2");
    await submit();
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(output("density-end")).toBe("5.5");
  });

  test("separate lesson instances own separate accounts and unique labelled controls", async () => {
    await act(async () =>
      root.render(
        <>
          <FoundationConstruction foundationId="flux-continuity" />
          <FoundationConstruction foundationId="flux-continuity" />
        </>,
      ),
    );
    const panels = [...container.querySelectorAll("[data-flux-current]")];
    expect(panels.length).toBe(2);
    const second = panels[1]?.outerHTML;
    await type("entering", "9");
    await submit();
    expect(panels[1]?.outerHTML).toBe(second);
    const fields = [
      ...container.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"),
    ];
    expect(new Set(fields.map((field) => field.id)).size).toBe(fields.length);
    for (const field of fields) expect(field.labels?.length).toBeGreaterThan(0);
  });
});

test("static HTML preserves both worked figures, a complete default account, and disabled controls", () => {
  const html = renderToStaticMarkup(<FoundationConstruction foundationId="flux-continuity" />);
  expect(html).toContain("In one second, 7 particles cross the left boundary");
  expect(html).toContain("In the next second, 5 particles cross the left boundary");
  expect(html).toContain("JavaScript is off");
  expect(html).toContain("20 becomes 22");
  expect(html).toContain('<fieldset class="construction-controls" disabled="">');
  expect(html).toContain("What it shows, in words");
  expect(html).not.toContain("NaN");
  expect(html).not.toContain("Infinity");
});
