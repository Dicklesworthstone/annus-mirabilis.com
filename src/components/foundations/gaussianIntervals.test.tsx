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

describe("the Gaussian foundation offers interval reasoning without operating the drawing", () => {
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
      root.render(<FoundationConstruction foundationId="foundation:gaussian-distributions" />),
    );
  }
  async function type(name: "width" | "lower" | "upper", value: string) {
    const field = container.querySelector<HTMLInputElement>("[name='gaussian-" + name + "']");
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
    const element = container.querySelector("[data-gaussian-current]");
    expect(element).not.toBeNull();
    return element?.outerHTML;
  }
  function output(name: string) {
    const element = container.querySelector("[data-gaussian-output='" + name + "']");
    expect(element).not.toBeNull();
    return element?.textContent;
  }

  test("one accepted update changes the curve, area, densities and spoken summary together", async () => {
    await mount();
    expect(container.querySelector("fieldset")?.disabled).toBe(false);
    expect(output("inside")).toBe("68.269");
    expect(output("peak")).toBe("0.39894");
    expect(output("total")).toBe("100");
    const before = current();
    const reference = container.querySelector("[data-gaussian-reference]")?.getAttribute("d");
    const curve = container.querySelector("[data-gaussian-curve]")?.getAttribute("d");
    expect(reference?.length).toBeGreaterThan(0);
    await type("width", "2");
    expect(current()).toBe(before);
    await submit();
    expect(output("inside")).toBe("38.292");
    expect(output("peak")).toBe("0.19947");
    expect(output("total")).toBe("100");
    expect(container.querySelector("[data-gaussian-curve]")?.getAttribute("d")).not.toBe(curve);
    expect(container.querySelector("[data-gaussian-reference]")?.getAttribute("d")).toBe(reference);
    expect(container.querySelector("[role='status']")?.textContent).toContain("width 2 micrometres");
    expect(container.querySelectorAll("[role='status']").length).toBe(1);
    expect(container.querySelector("svg[role='img']")?.getAttribute("aria-label")).toContain(
      "38.292 per cent",
    );
  });

  test("symmetric-width buttons use the entered width and apply all bounds together", async () => {
    await mount();
    await type("width", "2");
    await click("Within 1 width");
    expect(output("inside")).toBe("68.269");
    expect(container.querySelector<HTMLInputElement>("[name='gaussian-lower']")?.value).toBe("-2");
    expect(container.querySelector<HTMLInputElement>("[name='gaussian-upper']")?.value).toBe("2");
    await click("Within 2 widths");
    expect(output("inside")).toBe("95.45");
    expect(container.querySelector<HTMLInputElement>("[name='gaussian-lower']")?.value).toBe("-4");
    expect(container.querySelector<HTMLInputElement>("[name='gaussian-upper']")?.value).toBe("4");
    await click("Restore one-width example");
    expect(output("inside")).toBe("68.269");
    expect(output("peak")).toBe("0.39894");
    expect(container.querySelector<HTMLInputElement>("[name='gaussian-width']")?.value).toBe("1");
  });

  test("invalid and partial drafts keep the complete accepted state and recover", async () => {
    await mount();
    await type("width", "1.5");
    await submit();
    const before = current();
    for (const value of ["", "0", "3", "NaN", "1+1"]) {
      await type("width", value);
      await submit();
      expect(current()).toBe(before);
      expect(container.querySelector("[role='alert']")?.textContent).toContain("still use width 1.5");
      expect(
        container.querySelector("[name='gaussian-width']")?.getAttribute("aria-invalid"),
      ).toBe("true");
    }
    await type("width", "1");
    await type("lower", "2");
    await type("upper", "-2");
    await submit();
    expect(current()).toBe(before);
    expect(container.querySelector("[role='alert']")?.textContent).toContain("lower bound");
    expect(container.querySelector("[name='gaussian-lower']")?.getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(container.querySelector("[name='gaussian-upper']")?.getAttribute("aria-invalid")).toBe(
      "true",
    );
    await click("Within 1 width");
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(output("inside")).toBe("68.269");
  });

  test("a point and a remote tail remain distinguishable from finite-interval probability", async () => {
    await mount();
    await type("lower", "0");
    await type("upper", "0");
    await submit();
    expect(output("inside")).toBe("0");
    expect(output("below")).toBe("50");
    expect(output("above")).toBe("50");
    expect(output("peak")).toBe("0.39894");
    expect(container.textContent).toContain("no width, so its probability is zero");
    await type("width", "0.5");
    await type("lower", "5");
    await type("upper", "6");
    await submit();
    expect(output("inside")).not.toBe("0");
    expect(output("above")).not.toBe("0");
    expect(container.querySelector("[data-gaussian-output='inside'] sup")).not.toBeNull();
    expect(container.querySelector("[data-gaussian-output='inside'] [aria-label]")?.getAttribute(
      "aria-label",
    )).toContain("power minus");
    expect(current()).not.toContain("NaN");
    expect(current()).not.toContain("Infinity");
  });

  test("distinct close bounds stay distinct in the accepted interval and spoken description", async () => {
    await mount();
    await type("lower", "1");
    await type("upper", "1.000001");
    await submit();
    expect(container.querySelector("[role='status']")?.textContent).toContain(
      "From 1 to 1.000001 micrometres",
    );
    expect(container.querySelector("[data-gaussian-current] table")?.textContent).toContain(
      "From 1 to 1.000001",
    );
    expect(output("inside")).not.toBe("0");
    expect(container.textContent).not.toContain("no width, so its probability is zero");
  });

  test("two constructions keep separate accepted values and unique labels", async () => {
    await act(async () =>
      root.render(
        <>
          <FoundationConstruction foundationId="gaussian-distributions" />
          <FoundationConstruction foundationId="gaussian-distributions" />
        </>,
      ),
    );
    const panels = () => [...container.querySelectorAll("[data-gaussian-current]")];
    expect(panels().length).toBe(2);
    const other = panels()[1]?.outerHTML;
    await type("width", "2");
    await submit();
    expect(output("inside")).toBe("38.292");
    expect(panels()[1]?.outerHTML).toBe(other);
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const field of container.querySelectorAll("input"))
      expect(field.labels?.length).toBeGreaterThan(0);
  });

  test("static HTML retains the worked example, one named plot, its swatches and disabled controls", () => {
    const html = renderToStaticMarkup(
      <FoundationConstruction foundationId="gaussian-distributions" headingLevel={4} />,
    );
    expect(html).toContain("JavaScript is off");
    expect(html).toContain("68.269");
    expect(html).toContain("What it shows, in words");
    expect(html).toContain("Width: 0.5 to 2");
    expect(html).toContain("not measured");
    expect(html.match(/<svg\b[^>]*role="img"/g)?.length).toBe(1);
    expect(html.match(/<svg\b[^>]*aria-hidden="true"/g)?.length).toBe(3);
    expect(html.match(/<fieldset[^>]*disabled=""/g)?.length).toBe(1);
    expect(html).toContain("<h4");
    expect(html).toContain("<h5");
  });
});
