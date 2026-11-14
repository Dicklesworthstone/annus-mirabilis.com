import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { clearAnnouncement, setLiveRegionElement } from "../../a11y/announce.ts";
import EquationPage from "../../app/equations/[paper]/[display]/page.tsx";
import { compilePrintedDisplay } from "../../equations/printed/displayTerms.ts";
import {
  checkPaperDisplays,
  type PrintedDisplayPayload,
  printedDisplays,
} from "../../equations/printed/paperDisplays.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { PrintedDisplayTerms } from "./PrintedDisplayTerms.tsx";

const prepared = await printedDisplays(process.cwd(), ["brownian-motion"], []);
if (prepared.problems.length) throw new Error("The Brownian source must publish cleanly.");
const displays = prepared.displays.filter((entry) => entry.semantics);
if (!displays.length) throw new Error("The Brownian operation fixture must not be empty.");

function display(id: string): PrintedDisplayPayload {
  const found = displays.find((entry) => entry.display === id);
  if (!found?.semantics) throw new Error("Missing Brownian source semantics for " + id);
  return found;
}

function formula(source: PrintedDisplayPayload) {
  return (
    <PrintedDisplayTerms display={source} inline={false}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: checked KaTeX output from the real source compiler is the fidelity test subject. */}
      <div className="equation-body" dangerouslySetInnerHTML={{ __html: source.html }} />
    </PrintedDisplayTerms>
  );
}

let container: HTMLDivElement;
let root: Root | undefined;
beforeEach(async () => {
  await installDom();
  setLiveRegionElement(null);
  clearAnnouncement();
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  clearAnnouncement();
  setLiveRegionElement(null);
  await uninstallDom();
});

function element<T extends Element = HTMLElement>(selector: string): T {
  const found = container.querySelector<T>(selector);
  if (!found) throw new Error("Missing mounted element " + selector);
  return found;
}

function handler(target: Element, name: string): (event: Record<string, unknown>) => void {
  const key =
    Object.keys(target).find((entry) => entry.startsWith("__reactProps$")) ??
    Object.keys(element(".printed-operation-explorer")).find((entry) =>
      entry.startsWith("__reactProps$"),
    );
  if (!key) throw new Error("The mounted element must expose its React props.");
  const action = (target as unknown as Record<string, Record<string, unknown>>)[key]?.[name];
  if (typeof action !== "function") throw new Error("Missing actual mounted handler " + name);
  return action as (event: Record<string, unknown>) => void;
}

async function mount(source: PrintedDisplayPayload) {
  root = createRoot(container);
  await act(async () =>
    root?.render(formula(JSON.parse(JSON.stringify(source)) as PrintedDisplayPayload)),
  );
}

function selectedTerms(): string[] {
  return [...container.querySelectorAll("[data-operation-selected][data-term]")]
    .map((node) => node.getAttribute("data-term") ?? "")
    .sort();
}

describe("Brownian source operations on the actual reading path", () => {
  test("operation wrappers retain every visible glyph, operator, space and MathML expression", async () => {
    const checked = await checkPaperDisplays(process.cwd(), "brownian-motion");
    if (!checked) throw new Error("The Brownian source must have checked display bindings.");
    for (const published of displays) {
      const source = checked.displays.find(
        (entry) => entry.display === published.display && entry.latex === published.latex,
      );
      if (!source) throw new Error("Every published source form must have a checked original.");
      const original = document.createElement("div");
      original.innerHTML = compilePrintedDisplay(source).html;
      const enhanced = document.createElement("div");
      enhanced.innerHTML = published.html;
      expect(enhanced.querySelector(".katex-html")?.textContent).toBe(
        original.querySelector(".katex-html")?.textContent,
      );
      expect(enhanced.querySelector(".katex-mathml")?.outerHTML).toBe(
        original.querySelector(".katex-mathml")?.outerHTML,
      );
      for (const selector of [".mbin", ".mrel", ".mop", ".mspace", "[data-term]"])
        expect(enhanced.querySelectorAll(".katex-html " + selector).length).toBe(
          original.querySelectorAll(".katex-html " + selector).length,
        );
    }
  });

  test("permanent equation pages expose every explanation and its prerequisite without JavaScript", async () => {
    for (const source of displays) {
      container.innerHTML = renderToStaticMarkup(
        await EquationPage({
          params: Promise.resolve({ paper: "brownian-motion", display: source.display }),
        }),
      );
      const reference = element("#operations");
      expect(reference.textContent).toContain(source.spoken);
      expect(reference.textContent).toContain(source.semantics?.premise ?? "missing premise");
      for (const operation of source.semantics?.operations ?? []) {
        const note = reference.querySelector('[data-operation-note="' + operation.id + '"]');
        expect(note?.textContent).toContain(operation.title);
        expect(note?.textContent).toContain(operation.foundationTitle);
        expect(note?.querySelector("a")?.getAttribute("href")).toBe(
          `/foundations/${operation.foundation}/`,
        );
      }
      expect(
        reference.querySelector('a[href="' + source.semantics?.next.href + '"]'),
      ).not.toBeNull();
      expect(reference.querySelector("select")).toBeNull();
    }
  });

  test("both language faces carry the operations while the historical rounded fixture stays unchanged", async () => {
    const { PaperPage } = await import("../PaperPage.tsx");
    for (const face of ["german", "english"] as const) {
      container.innerHTML = await exportMarkup(
        await PaperPage({ paperId: "brownian-motion", face }),
      );
      for (const source of displays) {
        const shown = element('[data-display-terms="' + source.display + '"]');
        expect(shown.querySelector(".printed-operation-toggle")?.getAttribute("href")).toBe(
          `/equations/brownian-motion/${source.display}/#operations`,
        );
        for (const operation of source.semantics?.operations ?? [])
          expect(shown.querySelector('[data-op="' + operation.id + '"]')).not.toBeNull();
      }
      expect(
        element('[data-display-terms="eq-s5-d4"]').querySelector(".printed-operation-toggle"),
      ).toBeNull();
    }
  });

  test("keyboard selection explains the RMS root and highlights only its diffusivity and time", async () => {
    const source = display("eq-s5-d2");
    const operation = source.semantics?.operations.find((entry) => entry.path === "row1.right");
    if (!operation) throw new Error("The RMS square root must be selectable.");
    await mount(source);
    const link = element(".printed-operation-toggle");
    await act(async () => handler(link, "onClick")({ preventDefault() {} }));
    const select = element<HTMLSelectElement>(".printed-operation-choice select");
    await act(async () => {
      select.value = operation.id;
      handler(select, "onChange")({ currentTarget: select });
    });
    expect(element("[data-operation-note]").textContent).toContain(
      "Four times the observation interval gives twice the RMS spread",
    );
    expect(selectedTerms()).toEqual([...operation.termIds].sort());
    expect(
      operation.termIds
        .map((id) =>
          element('.katex-html [data-term="' + id + '"]').getAttribute("data-quantity-id"),
        )
        .sort(),
    ).toEqual(["diffusionCoefficient", "observationInterval"]);
    expect(container.querySelectorAll(".katex [tabindex]")).toHaveLength(0);
  });

  test("the inference denominator keeps viscosity distinct, explains identifiability, and restores focus on Escape", async () => {
    const source = display("eq-s5-d5");
    const operation = source.semantics?.operations.find(
      (entry) => entry.path === "row1.right.args.1",
    );
    if (!operation) throw new Error("The physical inputs to inference must be selectable.");
    await mount(source);
    const originalMathml = element(".katex-mathml").outerHTML;
    const span = element('[data-op="' + operation.id + '"]');
    await act(async () =>
      handler(
        element(".printed-operation-explorer"),
        "onClick",
      )({ target: span, preventDefault() {} }),
    );
    const select = element<HTMLSelectElement>("select");
    expect(select.value).toBe(operation.id);
    expect(document.activeElement).toBe(select);
    expect(selectedTerms()).toEqual([...operation.termIds].sort());
    expect(element("[data-operation-note]").textContent).toContain(
      "product of radius and molecular number",
    );
    const viscosity = element('.katex [data-quantity-id="viscosity"]');
    await act(async () => {
      viscosity.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(element("[data-term-highlight]").getAttribute("data-pinned-quantity-id")).toBe(
      "viscosity",
    );
    expect(select.value).toBe(operation.id);
    select.focus();
    await act(async () => {
      select.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    expect(container.querySelectorAll("[data-operation-selected]")).toHaveLength(0);
    expect(document.activeElement).toBe(element(".printed-operation-toggle"));
    expect(element(".katex-mathml").outerHTML).toBe(originalMathml);
  });
});
