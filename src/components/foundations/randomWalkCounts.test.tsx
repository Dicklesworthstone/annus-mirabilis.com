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

describe("the random-walk lesson counts and compares accepted walks", () => {
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
      root.render(<FoundationConstruction foundationId="random-walks" />),
    );
  }

  async function type(value: string, region: ParentNode = container) {
    const field = region.querySelector<HTMLInputElement>("input[name='walk-steps']");
    expect(field?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      if (field) {
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }

  async function rule(value: string) {
    const field = container.querySelector<HTMLSelectElement>("select[name='walk-rule']");
    expect(field?.labels?.length).toBeGreaterThan(0);
    await act(async () => {
      if (field) {
        field.value = value;
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  async function submit(region: ParentNode = container) {
    const form = region.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () =>
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  }

  function outputs(region: ParentNode = container) {
    const elements = [...region.querySelectorAll("[data-walk-output]")];
    expect(elements.length).toBeGreaterThan(0);
    return Object.fromEntries(
      elements.map((element) => [element.getAttribute("data-walk-output"), element.textContent]),
    );
  }

  test("applying a draft updates the count, moments and plotted point together", async () => {
    await mount();
    expect(outputs()).toEqual({
      mean: "0 m",
      "mean-square": "2 m²",
      rms: "1.4142 m",
      "mean-distance": "1 m",
      return: "50%",
    });
    const reference = container.querySelector("svg")?.outerHTML;
    const oldPoint = container.querySelector("[data-counted-walk-point]")?.outerHTML;
    const oldValues = outputs();
    await type("8");
    expect(outputs()).toEqual(oldValues);
    await submit();
    expect(outputs()["mean-square"]).toBe("8 m²");
    expect(outputs().rms).toBe("2.8284 m");
    expect(outputs().return).toBe("27.344%");
    expect(container.querySelector("[data-walk-total]")?.textContent).toContain("256");
    expect(container.querySelectorAll("[data-walk-ending]").length).toBe(9);
    expect(container.querySelector("[data-counted-walk-point]")?.outerHTML).not.toBe(oldPoint);
    expect(container.querySelector("svg")?.outerHTML).toBe(reference);
    expect(container.querySelectorAll("[role='status']").length).toBe(1);
    expect(
      container.querySelector("[aria-label='Random-walk end positions']")?.getAttribute("tabindex"),
    ).toBe("0");
  });

  test("repeated directions change the distribution rather than merely its label", async () => {
    await mount();
    await type("8");
    await submit();
    const independent = outputs();
    await rule("same-direction");
    expect(outputs()).toEqual(independent);
    await submit();
    expect(outputs()).toEqual({
      mean: "0 m",
      "mean-square": "64 m²",
      rms: "8 m",
      "mean-distance": "8 m",
      return: "0%",
    });
    expect(container.querySelectorAll("[data-walk-ending]").length).toBe(2);
    expect(container.querySelector("[data-walk-ending='0']")).toBeNull();
    expect(container.querySelector("[role='status']")?.textContent).toContain(
      "Equal chances of left and right do not make steps independent.",
    );
    expect(container.querySelectorAll("svg")[1]?.getAttribute("aria-label")).toContain(
      "distance 8 metres",
    );
  });

  test("invalid drafts preserve the accepted comparison and a valid one recovers", async () => {
    await mount();
    await type("7");
    await submit();
    const accepted = outputs();
    const table = container.querySelector("tbody")?.outerHTML;
    const drawing = container.querySelectorAll("svg")[1]?.outerHTML;
    for (const value of ["", "-1", "1.5", "65", "1e2", "NaN"]) {
      await type(value);
      await submit();
      expect(outputs()).toEqual(accepted);
      expect(container.querySelector("tbody")?.outerHTML).toBe(table);
      expect(container.querySelectorAll("svg")[1]?.outerHTML).toBe(drawing);
      expect(container.querySelector("[role='alert']")?.textContent).toContain(
        "keep the last applied walk",
      );
    }
    await type("0");
    await submit();
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(outputs().rms).toBe("0 m");
    expect(outputs().return).toBe("100%");
    expect(container.querySelectorAll("[data-walk-ending]").length).toBe(1);
    expect(container.querySelector("svg")?.outerHTML).not.toContain("NaN");
  });

  test("quadrupling independent steps doubles RMS and the bounded action stops", async () => {
    await mount();
    const button = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === "Four times the steps",
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
    expect(outputs().rms).toBe("2.8284 m");
    await act(async () => button?.click());
    expect(outputs().rms).toBe("5.6569 m");
    expect(button?.disabled).toBe(true);
    const reset = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === "Restore two steps",
    );
    await act(async () => reset?.click());
    expect(outputs().rms).toBe("1.4142 m");
    expect(button?.disabled).toBe(false);
  });

  test("instances keep their own accepted state", async () => {
    await act(async () =>
      root.render(
        <>
          <FoundationConstruction foundationId="random-walks" />
          <FoundationConstruction foundationId="foundation:random-walks" />
        </>,
      ),
    );
    const regions = container.querySelectorAll<HTMLElement>("[data-foundation-construction]");
    expect(regions.length).toBe(2);
    const first = regions[0] as HTMLElement;
    const second = regions[1] as HTMLElement;
    await type("64", first);
    await submit(first);
    expect(outputs(first).rms).toBe("8 m");
    expect(outputs(second).rms).toBe("1.4142 m");
    expect(first.querySelector("[data-walk-total]")?.textContent).toContain("18446744073709551616");
    expect(first.querySelector("input")?.id).not.toBe(second.querySelector("input")?.id);
  });

  test("server output keeps both named figures, a complete table and disabled controls", () => {
    const html = renderToStaticMarkup(
      <>
        <FoundationConstruction foundationId="random-walks" />
        <FoundationConstruction foundationId="random-walks" />
      </>,
    );
    expect(html.match(/JavaScript is off/g)?.length).toBe(2);
    expect(html.match(/<svg /g)?.length).toBe(4);
    expect(html.match(/<fieldset[^>]*disabled=""/g)?.length).toBe(2);
    expect(html).toContain("What it shows, in words");
    expect(html).toContain("not sampled");
    expect(html).toContain("1.4142");
    expect(html).toContain("50%");
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
