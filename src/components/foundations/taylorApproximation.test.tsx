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

describe("the Taylor foundation operates on an accepted speed and truncation", () => {
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
      root.render(<FoundationConstruction foundationId="foundation:taylor-expansion" />),
    );
  }
  async function type(value: string) {
    const input = container.querySelector<HTMLInputElement>("input[name='taylor-speed']");
    expect(input).not.toBeNull();
    expect(input?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }
  async function choose(count: string) {
    const select = container.querySelector<HTMLSelectElement>("select[name='taylor-terms']");
    expect(select?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      if (select) {
        select.value = count;
        select.dispatchEvent(new Event("change", { bubbles: true }));
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
      (item) => item.textContent === label,
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
  }
  function current() {
    const result = container.querySelector("[data-taylor-current]");
    expect(result).not.toBeNull();
    return result?.outerHTML;
  }
  function output(name: string) {
    const value = container.querySelector("[data-taylor-output='" + name + "']");
    expect(value).not.toBeNull();
    return value?.textContent;
  }

  test("speed and order drafts update every result together only when applied", async () => {
    await mount();
    expect(output("exact")).toBe("0.250000");
    expect(output("approximation")).toBe("0.180000");
    expect(output("remainder")).toBe("0.070000");
    expect(output("relative")).toBe("28%");
    const initial = current();
    await type("0.9");
    await choose("4");
    expect(current()).toBe(initial);
    expect(container.textContent).toContain("These entries are not applied");
    await submit();
    expect(current()).not.toBe(initial);
    expect(container.querySelector("[data-taylor-order='4']")?.getAttribute("data-selected")).toBe(
      "true",
    );
    expect(container.querySelector("[role='status']")?.textContent).toContain("0.9c");
    expect(container.querySelectorAll("[data-taylor-sample]").length).toBeGreaterThan(1);
    expect(container.querySelectorAll("[role='status']").length).toBe(1);
    expect(
      container.querySelector("[aria-label='Retained terms and their remainders']")?.getAttribute(
        "tabindex",
      ),
    ).toBe("0");
  });

  test("invalid drafts preserve all accepted calculations and a valid submission recovers", async () => {
    await mount();
    await choose("3");
    await submit();
    const accepted = current();
    for (const invalid of ["", "-1", "1", "1e-31", "1e-500", "NaN", "0x10", "0.6junk", "1/2"]) {
      await type(invalid);
      await submit();
      expect(current(), invalid).toBe(accepted);
      expect(container.querySelector("[role='alert']")?.textContent).toContain(
        "last accepted speed and approximation",
      );
      expect(container.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
    }
    await type("0.3");
    await submit();
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(current()).not.toBe(accepted);
  });

  test("presets expose tiny remainders, the near-light failure of four terms, and rest", async () => {
    await mount();
    const lowReference = container.querySelector(".evaluation-comparison")?.outerHTML;
    await choose("4");
    await click("Tiny speed (10⁻¹⁰c)");
    expect(output("remainder")).not.toBe("0");
    expect(output("relative")).not.toBe("0%");
    expect(container.querySelector("[data-taylor-output='remainder'] sup")?.textContent).toBe(
      "−101",
    );
    await click("Near light speed (0.99c)");
    expect(container.querySelector("[role='status']")?.textContent).toContain("0.99c");
    expect(container.querySelector(".evaluation-comparison")?.outerHTML).toBe(lowReference);
    await type("0");
    await submit();
    expect(output("exact")).toBe("0");
    expect(output("remainder")).toBe("0");
    expect(output("relative")).toBe("Not defined at rest");
    expect(container.textContent).not.toContain("NaN");
    await click("Restore the worked example");
    expect(output("exact")).toBe("0.250000");
    expect(output("approximation")).toBe("0.180000");
    expect(container.querySelector<HTMLSelectElement>("select")?.value).toBe("1");
  });

  test("the plotted curve changes with accepted values and preserves the full expression across truncations", async () => {
    await mount();
    const curve = (kind: string) =>
      container.querySelector("[data-taylor-curve='" + kind + "']")?.getAttribute("d");
    const full = curve("full");
    const partial = curve("partial");
    expect(full).toBeDefined();
    expect(partial).toBeDefined();
    expect(full).not.toBe(partial);
    await choose("4");
    expect(curve("full")).toBe(full);
    expect(curve("partial")).toBe(partial);
    await submit();
    expect(curve("full")).toBe(full);
    expect(curve("partial")).not.toBe(partial);

    await click("Tiny speed (10⁻¹⁰c)");
    const plot = () => container.querySelector("[data-taylor-plot]")?.outerHTML ?? "";
    expect(plot()).toContain("broken curve");
    expect(plot()).not.toMatch(/NaN|Infinity/);
    const tiny = plot();
    await type("1");
    await submit();
    expect(plot()).toBe(tiny);

    await type("0");
    await submit();
    expect(plot()).toContain("0 to 0.6c reference range");
    const dot = container.querySelector("[data-taylor-accepted-point]");
    expect(dot?.getAttribute("cx")).toBe("104");
    expect(dot?.getAttribute("cy")).toBe("160");

    await type(String(1 - Number.EPSILON / 2));
    await submit();
    expect(plot()).not.toMatch(/NaN|Infinity/);
    // The admitted endpoint must not be rounded into the excluded light-speed boundary.
    expect(container.querySelector("[data-taylor-plot]")?.textContent).toContain(
      "0.9999999999999999",
    );
  });

  test("the server page retains both references, disabled controls, useful tables, and unique ids", () => {
    const html = renderToStaticMarkup(
      <>
        <FoundationConstruction foundationId="taylor-expansion" />
        <FoundationConstruction foundationId="taylor-expansion" />
      </>,
    );
    expect(html.match(/JavaScript is off/g)?.length).toBe(2);
    expect(html.match(/<fieldset[^>]*disabled/g)?.length).toBe(2);
    expect(html).toContain("0.180000");
    expect(html).toContain("0.247773");
    expect(html).toContain("0.18L");
    expect(html).toContain("0.25L");
    expect(html).toContain("5.0000000375\u202f×\u202f10<sup>−9</sup>");
    expect(html).toContain("What it shows, in words");
    expect(html).toContain("/papers/mass-energy/#arg-me-small-speed");
    const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const label of html.matchAll(/\bfor="([^"]+)"/gu)) expect(ids).toContain(label[1]);
  });
});
