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
import { PaperPage } from "../PaperPage.tsx";
import { PrintedDisplayTerms } from "./PrintedDisplayTerms.tsx";

const prepared = await printedDisplays(process.cwd(), ["light-quanta"], []);
if (prepared.problems.length) throw new Error("The light-quanta source must publish cleanly.");
const displays = prepared.displays.filter((d) => d.semantics);
if (!displays.length) throw new Error("The source-operation fixture must not be empty.");
function display(id: string): PrintedDisplayPayload {
  const d = displays.find((entry) => entry.display === id);
  if (!d?.semantics) throw new Error("Missing light-quanta source semantics for " + id);
  return d;
}
function formula(d: PrintedDisplayPayload) {
  return (
    <PrintedDisplayTerms display={d} inline={false}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the real checked KaTeX output is the source-fidelity test subject. */}
      <div className="equation-body" dangerouslySetInnerHTML={{ __html: d.html }} />
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
function handler(target: Element, name: string): (event: any) => void {
  const key =
    Object.keys(target).find((k) => k.startsWith("__reactProps$")) ??
    Object.keys(element(".printed-operation-explorer")).find((k) => k.startsWith("__reactProps$"));
  if (!key) throw new Error("The mounted element must expose its React props.");
  const action = (target as unknown as Record<string, Record<string, unknown>>)[key]?.[name];
  if (typeof action !== "function") throw new Error("Missing actual mounted handler " + name);
  return action as (event: any) => void;
}
async function mount(d: PrintedDisplayPayload) {
  root = createRoot(container);
  // Exercise the serialized payload consumed by the reader, including the compound source exponent.
  await act(async () =>
    root?.render(formula(JSON.parse(JSON.stringify(d)) as PrintedDisplayPayload)),
  );
}
function selectedTerms(): string[] {
  return [...container.querySelectorAll("[data-operation-selected][data-term]")]
    .map((n) => n.getAttribute("data-term") ?? "")
    .sort();
}

describe("light-quanta source operations on the actual reading path", () => {
  test("all new wrappers preserve visible text, mathematical operators, spacing and physical term counts", async () => {
    const checked = await checkPaperDisplays(process.cwd(), "light-quanta");
    if (!checked) throw new Error("The source displays must exist.");
    for (const current of displays) {
      const d = checked.displays.find(
        (entry) => entry.display === current.display && entry.latex === current.latex,
      );
      if (!d) throw new Error("Every published source form must have checked bindings.");
      const old = document.createElement("div");
      old.innerHTML = compilePrintedDisplay(d).html;
      const next = document.createElement("div");
      next.innerHTML = current.html;
      expect(next.querySelector(".katex-html")?.textContent).toBe(
        old.querySelector(".katex-html")?.textContent,
      );
      for (const selector of [".mbin", ".mrel", ".mop", ".mspace", "[data-term]"])
        expect(next.querySelectorAll(".katex-html " + selector).length).toBe(
          old.querySelectorAll(".katex-html " + selector).length,
        );
      expect(next.querySelector(".katex-mathml")?.outerHTML).toBe(
        old.querySelector(".katex-mathml")?.outerHTML,
      );
    }
  });

  test("the real permanent pages expose every authored operation and prerequisite without JavaScript", async () => {
    for (const d of displays) {
      const html = renderToStaticMarkup(
        await EquationPage({
          params: Promise.resolve({ paper: "light-quanta", display: d.display }),
        }),
      );
      container.innerHTML = html;
      const reference = element("#operations");
      expect(reference.textContent).toContain(d.spoken);
      expect(reference.textContent).toContain(d.semantics?.premise ?? "missing premise");
      for (const operation of d.semantics?.operations ?? []) {
        const note = reference.querySelector('[data-operation-note="' + operation.id + '"]');
        expect(note?.textContent).toContain(operation.title);
        expect(note?.textContent).toContain(operation.foundationTitle);
        expect(note?.querySelector("a")?.getAttribute("href")).toBe(
          `/foundations/${operation.foundation}/`,
        );
        expect(note?.closest("details")?.querySelector("summary")).not.toBeNull();
      }
      expect(reference.querySelector('a[href="' + d.semantics?.next.href + '"]')).not.toBeNull();
      expect(reference.querySelector("select")).toBeNull();
    }
  });

  test("German and English source faces carry the selected operations and real fallback links", async () => {
    for (const face of ["german", "english"] as const) {
      const html = await exportMarkup(await PaperPage({ paperId: "light-quanta", face }));
      container.innerHTML = html;
      for (const d of displays) {
        const source = element('[data-display-terms="' + d.display + '"]');
        expect(source.querySelector(".printed-operation-toggle")?.getAttribute("href")).toBe(
          `/equations/light-quanta/${d.display}/#operations`,
        );
        expect(source.querySelector("select")).toBeNull();
        for (const operation of d.semantics?.operations ?? [])
          expect(source.querySelector('[data-op="' + operation.id + '"]')).not.toBeNull();
      }
      expect(
        element('[data-display-terms="eq-s1-d1"]').querySelector(".printed-operation-toggle"),
      ).toBeNull();
    }
  });

  test("keyboard selection explains the source logarithm and highlights only its volume terms", async () => {
    const d = display("eq-s4-d5");
    const log = d.semantics?.operations.find((o) => o.path === "row1.right.args.1");
    if (!log) throw new Error("The volume logarithm must be selectable.");
    await mount(d);
    const link = element(".printed-operation-toggle");
    await act(async () => handler(link, "onClick")({ preventDefault() {} }));
    const select = element<HTMLSelectElement>(".printed-operation-choice select");
    await act(async () => {
      select.value = log.id;
      handler(select, "onChange")({ currentTarget: select });
    });
    expect(element("[data-operation-note]").textContent).toContain("natural logarithm of v/v0");
    expect(element("[data-operation-note]").textContent).toContain("dimensionless");
    expect(selectedTerms()).toEqual([...log.termIds].sort());
    expect(
      log.termIds
        .map((id) =>
          element('.katex-html [data-term="' + id + '"]').textContent?.replace(/[\s\u200b]/g, ""),
        )
        .sort(),
    ).toEqual(["v", "v0"]);
    expect(container.querySelectorAll(".katex [tabindex]")).toHaveLength(0);
  });

  test("the nested radiation exponent selects all its factors, preserves quantity pins, and exits with Escape", async () => {
    const d = display("eq-s6-d4");
    const exponent = d.semantics?.operations.find((o) => o.path === "row1.right.exponent");
    if (!exponent) throw new Error("The complete radiation exponent must be selectable.");
    await mount(d);
    const originalMathml = element(".katex-mathml").outerHTML;
    const span = element('[data-op="' + exponent.id + '"]');
    await act(async () =>
      handler(
        element(".printed-operation-explorer"),
        "onClick",
      )({ target: span, preventDefault() {} }),
    );
    const select = element<HTMLSelectElement>("select");
    expect(select.value).toBe(exponent.id);
    expect(document.activeElement).toBe(select);
    expect(selectedTerms()).toEqual([...exponent.termIds].sort());
    expect(element("[data-operation-note]").textContent).toContain("dimensionless effective count");
    expect(element("[data-operation-note]").textContent).toContain(
      "do not divide by the zero logarithm",
    );
    expect(element("[data-operation-note]").textContent).toContain(
      "does not count observed objects",
    );
    const quantity = element('.katex [data-quantity-id="radiationEnergy"]');
    await act(async () => {
      quantity.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(element("[data-term-highlight]").getAttribute("data-pinned-quantity-id")).toBe(
      "radiationEnergy",
    );
    expect(select.value).toBe(exponent.id);
    select.focus();
    await act(async () => {
      select.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    expect(container.querySelectorAll("[data-operation-selected]")).toHaveLength(0);
    expect(element("[data-term-highlight]").hasAttribute("data-pinned-quantity-id")).toBe(false);
    expect(document.activeElement).toBe(element(".printed-operation-toggle"));
    expect(element(".katex-mathml").outerHTML).toBe(originalMathml);
  });
});
