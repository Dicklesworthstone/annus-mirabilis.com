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

describe("integration is operable through the shared foundation dispatcher", () => {
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
      root.render(<FoundationConstruction foundationId="foundation:integration" />),
    );
  }
  async function type(value: string) {
    const field = container.querySelector<HTMLInputElement>("input[name='strips']");
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
  async function choose(rule: string) {
    const field = container.querySelector<HTMLSelectElement>("select[name='sampling']");
    expect(field?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      if (field) {
        field.value = rule;
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
  function current() {
    const element = container.querySelector("[data-integration-current]");
    expect(element).not.toBeNull();
    return element?.outerHTML;
  }
  function outputs() {
    const elements = [...container.querySelectorAll("[data-integration-output]")];
    expect(elements.length).toBeGreaterThan(0);
    return Object.fromEntries(
      elements.map((element) => [
        element.getAttribute("data-integration-output"),
        element.textContent,
      ]),
    );
  }

  test("draft count applies to the drawing, all sums and the table in one action", async () => {
    await mount();
    expect(outputs()).toEqual({
      left: "0.875",
      midpoint: "1",
      right: "1.125",
      exact: "1",
      gap: "0.25",
    });
    const initial = current();
    await type("16");
    expect(current()).toBe(initial);
    await submit();
    expect(outputs()).toEqual({
      left: "0.9375",
      midpoint: "1",
      right: "1.0625",
      exact: "1",
      gap: "0.125",
    });
    expect(container.querySelectorAll("[data-integration-row]").length).toBe(16);
    expect(
      container.querySelectorAll("[data-integration-current] [data-integration-strip]").length,
    ).toBe(16);
    expect(container.querySelector("[role='status']")?.textContent).toContain("16 strips");
    expect(container.querySelectorAll("[role='status']").length).toBe(1);
    expect(
      container.querySelector("[aria-label='Strip arithmetic']")?.getAttribute("tabindex"),
    ).toBe("0");
  });

  test("sampling changes rectangles and table without changing density", async () => {
    await mount();
    const reference = container.querySelector("svg")?.outerHTML;
    const sums = outputs();
    const first = () =>
      container.querySelector("[data-integration-row='0'] td:last-child")?.textContent;
    expect(first()).toBe("0");
    await choose("right");
    expect(first()).toBe("0.03125");
    expect(outputs()).toEqual(sums);
    expect(
      container.querySelector("[data-integration-current] svg")?.getAttribute("aria-label"),
    ).toContain("right edge");
    expect(container.querySelector("[role='status']")?.textContent).toContain("total 1.125");
    await choose("midpoint");
    expect(first()).toBe("0.015625");
    expect(container.querySelector("[role='status']")?.textContent).toContain("total 1.");
    expect(container.querySelector("svg")?.outerHTML).toBe(reference);
  });

  test("invalid edits preserve accepted results and a valid submission recovers", async () => {
    await mount();
    await type("7");
    await submit();
    const accepted = current();
    for (const invalid of ["", "0", "-1", "1.5", "129", "1e2", "NaN"]) {
      await type(invalid);
      await submit();
      expect(current()).toBe(accepted);
      expect(container.querySelector("[role='alert']")?.textContent).toContain("7 accepted strips");
      expect(container.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
    }
    await type("4");
    await submit();
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(outputs()).toEqual({
      left: "0.75",
      midpoint: "1",
      right: "1.25",
      exact: "1",
      gap: "0.5",
    });
  });

  test("refinement reaches its bound without silently changing the work count", async () => {
    await mount();
    for (const count of [16, 32, 64, 128]) {
      await click("Double the strips");
      expect(container.querySelectorAll("[data-integration-row]").length).toBe(count);
    }
    const button = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === "Double the strips",
    );
    expect(button?.disabled).toBe(true);
    await choose("right");
    await click("Restore eight strips");
    expect(container.querySelector("select")?.value).toBe("left");
    expect(container.querySelectorAll("[data-integration-row]").length).toBe(8);
  });

  test("the no-script page keeps both worked figures, readable sums and unique control ids", () => {
    const html = renderToStaticMarkup(
      <>
        <FoundationConstruction foundationId="integration" />
        <FoundationConstruction foundationId="integration" />
      </>,
    );
    expect(html.match(/JavaScript is off/g)?.length).toBe(2);
    expect(html.match(/<svg /g)?.length).toBe(4);
    expect(html).toContain("0.875");
    expect(html).toContain("1.125");
    expect(html).toContain("What it shows, in words");
    expect(html).toContain("does not hold for a general curved density");
    expect(html.match(/<fieldset[^>]*disabled=""/g)?.length).toBe(2);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
