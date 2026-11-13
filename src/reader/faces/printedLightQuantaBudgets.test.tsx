import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { clearAnnouncement, setLiveRegionElement } from "../../a11y/announce.ts";
import EquationPage from "../../app/equations/[paper]/[display]/page.tsx";
import {
  type PrintedDisplayPayload,
  printedDisplays,
} from "../../equations/printed/paperDisplays.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { PaperPage } from "../PaperPage.tsx";
import { PrintedDisplayTerms } from "./PrintedDisplayTerms.tsx";

// Independent source expectations: leqq/geqq retain their printed double-bar glyphs. The first
// photoelectric display is an expression, so neither the visible source nor its reading gains =.
const SOURCE_RELATIONS = {
  "eq-s7-d1": ["≦"],
  "eq-s7-d2": ["≦"],
  "eq-s8-d1": [],
  "eq-s8-d2": ["="],
  "eq-s8-d3": ["="],
  "eq-s8-d4": ["≦"],
  "eq-s8-d5": ["≧"],
  "eq-s9-d1": ["≧"],
  "eq-s9-d3": ["="],
} as const;
type BudgetId = keyof typeof SOURCE_RELATIONS;
const ids = Object.keys(SOURCE_RELATIONS) as BudgetId[];
const prepared = await printedDisplays(process.cwd(), ["light-quanta"], []);
if (prepared.problems.length) throw new Error("The source budgets must publish cleanly.");
function display(id: BudgetId): PrintedDisplayPayload {
  const found = prepared.displays.find((item) => item.display === id);
  if (!found?.semantics) throw new Error(`Missing authored budget operations for ${id}`);
  return found;
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
  if (!found) throw new Error(`Missing real budget element ${selector}`);
  return found;
}
function handler(target: Element, name: string): (event: unknown) => void {
  const key =
    Object.keys(target).find((item) => item.startsWith("__reactProps$")) ??
    Object.keys(element(".printed-operation-explorer")).find((item) =>
      item.startsWith("__reactProps$"),
    );
  if (!key) throw new Error("The mounted control must expose its React props.");
  const action = (target as unknown as Record<string, Record<string, unknown>>)[key]?.[name];
  if (typeof action !== "function") throw new Error(`Missing mounted control handler ${name}`);
  return action as (event: unknown) => void;
}
async function mount(id: BudgetId) {
  const d = JSON.parse(JSON.stringify(display(id))) as PrintedDisplayPayload;
  root ??= createRoot(container);
  await act(async () =>
    root?.render(
      <PrintedDisplayTerms key={id} display={d} inline={false}>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: real checked source KaTeX is the test subject. */}
        <div className="equation-body" dangerouslySetInnerHTML={{ __html: d.html }} />
      </PrintedDisplayTerms>,
    ),
  );
  return d;
}
function relations(scope: ParentNode): string[] {
  return [...scope.querySelectorAll(".katex-html .mrel")].map((node) => node.textContent ?? "");
}
function selectedQuantities(): string[] {
  return [...container.querySelectorAll("[data-operation-selected][data-term]")]
    .map((node) => node.getAttribute("data-quantity-id") ?? "")
    .sort();
}
async function choose(path: string, d: PrintedDisplayPayload) {
  const operation = d.semantics?.operations.find((item) => item.path === path);
  if (!operation) throw new Error(`Missing authored operation ${path}`);
  await act(async () => element<HTMLAnchorElement>(".printed-operation-toggle").click());
  const select = element<HTMLSelectElement>(".printed-operation-choice select");
  select.focus();
  await act(async () => {
    select.value = operation.id;
    handler(select, "onChange")({ currentTarget: select });
  });
  return { operation, select };
}

describe("the printed light-quanta budgets on their real reader paths", () => {
  test("all nine permanent pages and both source faces retain the exact relations and working fallbacks", async () => {
    for (const id of ids) {
      container.innerHTML = renderToStaticMarkup(
        await EquationPage({
          params: Promise.resolve({ paper: "light-quanta", display: id }),
        }),
      );
      expect(relations(element(".equation-explanation-formula"))).toEqual(SOURCE_RELATIONS[id]);
      const reference = element("#operations");
      expect(reference.textContent).toContain("Dimensional check:");
      expect(reference.textContent).toContain(
        "In a relation, this is the dimension on both sides.",
      );
      expect(reference.textContent).not.toContain("Both sides have dimension");
      expect(reference.querySelector("select")).toBeNull();
      if (id === "eq-s8-d1") {
        expect(reference.textContent).toContain("standalone expression");
        expect(display(id).spoken).not.toMatch(/equals|at most|at least/i);
      }
    }
    for (const face of ["german", "english"] as const) {
      container.innerHTML = await exportMarkup(await PaperPage({ paperId: "light-quanta", face }));
      for (const id of ids) {
        const source = element(`[data-display-terms="${id}"]`);
        expect(relations(source)).toEqual(SOURCE_RELATIONS[id]);
        expect(source.querySelector(".printed-operation-toggle")?.getAttribute("href")).toBe(
          `/equations/light-quanta/${id}/#operations`,
        );
        expect(source.querySelector("select")).toBeNull();
      }
      expect(
        element('[data-display-terms="eq-s9-d2"]').querySelector(".printed-operation-toggle"),
      ).toBeNull();
      if (face === "english") {
        expect(display("eq-s8-d5").semantics?.next.href).toBe(
          "/papers/light-quanta/view/english/#s8-p10-s1",
        );
        expect(element('[id="s8-p10-s1"]').textContent?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("keyboard selection explains standalone escape work without inventing a relation or changing MathML", async () => {
    const d = await mount("eq-s8-d1");
    const originalMathml = element(".katex-mathml").outerHTML;
    expect(relations(container)).toEqual([]);
    const { select } = await choose("row1.args.1", d);
    expect(element("[data-operation-note]").textContent).toContain("Subtract the escape work");
    expect(element("[data-operation-note]").textContent).toContain("energy deficit");
    expect(selectedQuantities()).toEqual(["workFunction"]);
    expect(element(".printed-operation-body").textContent).toContain(
      "Dimensional check: length² × mass × time⁻².",
    );
    expect(element(".printed-operation-body").textContent).toContain(
      "In a relation, this is the dimension on both sides.",
    );
    expect(element(".printed-operation-body").textContent).not.toContain(
      "Both sides have dimension",
    );
    expect(relations(container)).toEqual([]);
    expect(container.querySelectorAll(".katex [tabindex]")).toHaveLength(0);
    await act(async () => {
      select.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    expect(container.querySelectorAll("[data-operation-selected]")).toHaveLength(0);
    expect(document.activeElement).toBe(element(".printed-operation-toggle"));
    expect(element(".katex-mathml").outerHTML).toBe(originalMathml);
  });

  test("pointer selection distinguishes the forward upper budget from the separate inverse lower budget", async () => {
    for (const [id, phrase] of [
      ["eq-s8-d4", "at most"],
      ["eq-s8-d5", "at least"],
    ] as const) {
      const d = await mount(id);
      const operation = d.semantics?.operations.find((item) => item.path === "row1");
      if (!operation) throw new Error("The complete budget must be selectable.");
      const originalMathml = element(".katex-mathml").outerHTML;
      const relation = element(".katex-html .mrel");
      await act(async () => {
        relation.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      const select = element<HTMLSelectElement>(".printed-operation-choice select");
      expect(select.value).toBe(operation.id);
      expect(document.activeElement).toBe(select);
      expect(element("[data-operation-note]").textContent).toContain(phrase);
      expect(selectedQuantities()).toEqual(
        [
          "frequency",
          "gramEquivalentCharge",
          "molarGasConstant",
          "stoppingPotentialMagnitude",
          "wienConstantBeta",
          "workFunctionPerGramEquivalent",
        ].sort(),
      );
      expect(relations(container)).toEqual(SOURCE_RELATIONS[id]);
      if (id === "eq-s8-d5") {
        expect(element("[data-operation-note]").textContent).toContain(
          "cannot be combined to force equality",
        );
        expect(
          element('.printed-operation-body a[href="/papers/light-quanta/view/english/#s8-p10-s1"]'),
        ).not.toBeNull();
      }
      expect(element(".katex-mathml").outerHTML).toBe(originalMathml);
    }
  });

  test("the ionization quotient highlights energy divided by energy per amount and retains its conversion premise", async () => {
    const d = await mount("eq-s9-d3");
    const originalMathml = element(".katex-mathml").outerHTML;
    await choose("row1.right", d);
    expect(selectedQuantities()).toEqual(
      ["absorbedLightEnergy", "frequency", "molarGasConstant", "wienConstantBeta"].sort(),
    );
    expect(element("[data-operation-note]").textContent).toContain("Dimension: amount.");
    expect(element(".printed-operation-body").textContent).toContain("not an ionization rate");
    expect(element(".printed-operation-body").textContent).toContain(
      "Each absorbed quantum ionizes exactly one molecule",
    );
    expect(relations(container)).toEqual(["="]);
    expect(element(".katex-mathml").outerHTML).toBe(originalMathml);
  });
});
