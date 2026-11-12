import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { EquationScope } from "../../equations/EquationScope.tsx";
import { createSelectionStore } from "../../equations/selectionStore.ts";
import { SemanticEquation } from "../../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../../equations/viewTypes.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { ColouredFormula } from "../ColouredFormula.tsx";
import { Companion } from "./Companion.tsx";
import { PinnedEquationDock } from "./PinnedEquationCompanion.tsx";
import { PinnedEquationProvider } from "./PinnedEquationContext.tsx";
import { ReaderLayout } from "./ReaderLayout.tsx";

const payload = JSON.parse(
  readFileSync(
    new URL("../../generated/argument-equations/arg-sr-clock-and-length.json", import.meta.url),
    "utf8",
  ),
) as { equations: CompiledEquation[] };
const printed = payload.equations.find((item) => item.notationForm?.state === "printed");
const length = payload.equations.find((item) => item.id === "eq-model-sr-length-contraction");
if (!printed || !length) throw new Error("The authored clock and length fixtures are missing.");
const equation = printed;
const lengthEquation = length;
const equationCss = readFileSync(new URL("../../equations/equations.css", import.meta.url), "utf8");
const pinCss = readFileSync(new URL("./pinnedEquation.css", import.meta.url), "utf8");
const notationStart = equationCss.indexOf('[data-notation-form="printed"]:not(');
if (notationStart < 0) throw new Error("The production notation visibility rule is missing.");
const notationCss = equationCss.slice(notationStart, equationCss.indexOf("}", notationStart) + 1);

function applyCss(css: string) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
}

function required<T extends Element = HTMLElement>(parent: ParentNode, selector: string): T {
  const found = parent.querySelector<T>(selector);
  expect(found).not.toBeNull();
  return found as T;
}

// The existing happy-dom harness does not consistently dispatch React's delegated events.
// Invoke the mounted control's actual handler, including its awaited lazy payload, rather than
// reconstructing the component state in a test-only owner.
async function press(element: HTMLElement, target: HTMLElement = element) {
  const key = Object.keys(element).find((name) => name.startsWith("__reactProps$")) ?? "";
  const props = (element as unknown as Record<string, { onClick?: (event: unknown) => unknown }>)[
    key
  ];
  if (props?.onClick) await props.onClick({ currentTarget: element, target, preventDefault() {} });
  else element.click();
}

function namedButton(parent: ParentNode, text: string): HTMLButtonElement {
  const button = [...parent.querySelectorAll("button")].find((item) => item.textContent === text);
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

function nodeButton(parent: ParentNode, id: string): HTMLButtonElement {
  const button = [...parent.querySelectorAll<HTMLButtonElement>("[data-node-id]")].find(
    (item) => item.dataset.nodeId === id,
  );
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

function plainText(html: string): string {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent ?? "";
}

describe("whole-equation companion (am-read-page-anatomy-l0b)", () => {
  let container: HTMLElement;
  let root: Root;
  let tier: "column" | "sheet" | "dock";
  let rects: HTMLElement["getClientRects"];
  let scroll: HTMLElement["scrollIntoView"];
  let scrolled: HTMLElement | null;

  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
    tier = "column";
    scrolled = null;
    rects = HTMLElement.prototype.getClientRects;
    scroll = HTMLElement.prototype.scrollIntoView;
    // happy-dom has no layout engine. Supply only the responsive surface measurement used to
    // choose the focus destination; notation and dock display are checked with real CSS below.
    HTMLElement.prototype.getClientRects = function () {
      if (this.matches("[data-reader-companion-column], [data-bottom-sheet]")) {
        const visible = this.matches("[data-reader-companion-column]")
          ? tier === "column"
          : tier !== "column";
        return (visible ? [new DOMRect(0, 0, 320, 240)] : []) as unknown as DOMRectList;
      }
      return rects.call(this);
    };
    HTMLElement.prototype.scrollIntoView = function () {
      scrolled = this;
    };
    document.documentElement.dataset.notation = "modern";
    window.history.replaceState(null, "", `/#${equation.argument}`);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    HTMLElement.prototype.getClientRects = rects;
    HTMLElement.prototype.scrollIntoView = scroll;
    await uninstallDom();
  });

  function cardReader(selection = createSelectionStore()) {
    return (
      <div data-reader-root className="reader-root">
        <ReaderLayout
          outline={<nav>Argument outline</nav>}
          companion={
            <Companion kind="explanation">
              <p>Section notes remain available.</p>
            </Companion>
          }
        >
          <article id={equation.argument} tabIndex={-1}>
            <details data-source-disclosure open>
              <summary>Explore this step</summary>
              <EquationScope selectionStore={selection} scope="source">
                <SemanticEquation equation={equation} />
              </EquationScope>
            </details>
          </article>
        </ReaderLayout>
      </div>
    );
  }

  test("pin shares the source selection, switches back to notes, and unpins to the exact control", async () => {
    const selection = createSelectionStore();
    await act(async () => root.render(cardReader(selection)));
    const main = required(container, "[data-reader-main]");
    const column = required(container, "[data-reader-companion-column]");
    const source = required<HTMLButtonElement>(main, "[data-pin-equation]");
    const first = equation.navigation.find((node) => node.kind === "term");
    const second = equation.navigation.find(
      (node) => node.kind === "term" && node.id !== first?.id,
    );
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    await act(async () => {
      await press(nodeButton(main, first?.id ?? ""));
      await press(source);
    });
    let card = required(column, "[data-pinned-equation]");
    expect(nodeButton(card, first?.id ?? "").getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement === namedButton(card, "Unpin equation")).toBe(true);
    await act(async () => press(nodeButton(card, second?.id ?? "")));
    expect(selection.getSnapshot()?.nodeId).toBe(`${equation.paper}/${second?.id}`);
    expect(nodeButton(main, second?.id ?? "").getAttribute("aria-pressed")).toBe("true");
    const ids = [...container.querySelectorAll("[id]")].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    await act(async () => press(namedButton(column, "Section notes")));
    expect(column.textContent).toContain("Section notes remain available.");
    expect(column.querySelector("[data-pinned-equation]")).toBeNull();
    await act(async () => press(namedButton(column, "Pinned equation")));
    card = required(column, "[data-pinned-equation]");
    expect(nodeButton(card, second?.id ?? "").getAttribute("aria-pressed")).toBe("true");
    required<HTMLDetailsElement>(main, "[data-source-disclosure]").open = false;
    await act(async () => press(namedButton(card, "Unpin equation")));
    expect(container.querySelector("[data-pinned-equation]")).toBeNull();
    expect(required<HTMLDetailsElement>(main, "[data-source-disclosure]").open).toBe(true);
    expect(document.activeElement === source).toBe(true);
    expect(scrolled === source).toBe(true);
    expect(window.location.hash).toBe(`#${equation.argument}`);
  });

  for (const captured of ["printed", "modern"] as const) {
    test(`the captured ${captured} formula remains visible when the page changes notation`, async () => {
      document.documentElement.dataset.notation = captured;
      await act(async () => root.render(cardReader()));
      const main = required(container, "[data-reader-main]");
      await act(async () => press(required(main, "[data-pin-equation]")));
      const pinned = required(container, "[data-reader-companion-column] [data-pinned-equation]");
      const visual = required(pinned, ".equation-visual");
      const owner =
        captured === "printed" && equation.notationForm?.state === "printed"
          ? equation.notationForm
          : equation;
      expect(visual.textContent).toBe(plainText(owner.html));
      expect(pinned.querySelectorAll(".equation-visual").length).toBe(1);
      // Apply the exact production notation rule after mounting. Other equation CSS is not
      // relevant here and makes happy-dom's synthetic focus/style walk disproportionately slow.
      applyCss(notationCss);
      expect(window.getComputedStyle(visual).display).not.toBe("none");
      const markup = visual.innerHTML;
      document.documentElement.dataset.notation = captured === "modern" ? "printed" : "modern";
      // Positive control: the original captured variant really is hidden by production CSS.
      const original = required(main, `.equation-visual[data-notation-form="${captured}"]`);
      expect(window.getComputedStyle(original).display).toBe("none");
      expect(window.getComputedStyle(visual).display).not.toBe("none");
      expect(visual.innerHTML).toBe(markup);
      expect(pinned.querySelector("[data-notation-note]")).toBeNull();
    });
  }

  test("the phone sheet opens only its visible copy and Escape collapses it without losing the pin", async () => {
    tier = "sheet";
    await act(async () => root.render(cardReader()));
    const source = required<HTMLButtonElement>(container, "[data-reader-main] [data-pin-equation]");
    await act(async () => press(source));
    const sheet = required<HTMLDetailsElement>(container, "[data-bottom-sheet]");
    expect(sheet.open).toBe(true);
    expect(document.activeElement === namedButton(sheet, "Unpin equation")).toBe(true);
    expect(sheet.getAttribute("aria-modal")).toBeNull();
    const sourceDisclosure = required<HTMLDetailsElement>(container, "[data-source-disclosure]");
    sourceDisclosure.open = false;
    await act(async () => {
      document.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    expect(sheet.open).toBe(false);
    expect(sourceDisclosure.open).toBe(true);
    expect(document.activeElement === source).toBe(true);
    expect(sheet.querySelector("[data-pinned-equation]")).not.toBeNull();
    await act(async () => press(source));
    expect(sheet.open).toBe(true);
    await act(async () => press(required(sheet, "[data-modal-close]")));
    expect(sheet.open).toBe(false);
    expect(document.activeElement === source).toBe(true);
  });

  test("primary formulas load their exact owner, respect a held modern row, and only the active pin bridges selection", async () => {
    tier = "dock";
    document.documentElement.dataset.notation = "printed";
    await act(async () =>
      root.render(
        <PinnedEquationProvider>
          <div data-reader-root className="reader-root">
            <article id={equation.argument}>
              <ColouredFormula equations={[lengthEquation, equation]} />
            </article>
            <PinnedEquationDock />
          </div>
        </PinnedEquationProvider>,
      ),
    );
    const row = required(container, ".reading-formula");
    const pins = [...row.querySelectorAll<HTMLButtonElement>("[data-pin-formula]")];
    expect(pins.length).toBe(2);
    expect(container.querySelector("[data-pinned-equation]")).toBeNull();
    await act(async () => press(pins[0] as HTMLButtonElement));
    expect(required(container, "[data-pinned-equation]").getAttribute("data-pinned-equation")).toBe(
      lengthEquation.id,
    );
    await act(async () => press(pins[1] as HTMLButtonElement));
    const card = required(container, "[data-pinned-equation]");
    expect(card.getAttribute("data-pinned-equation")).toBe(equation.id);
    expect(card.getAttribute("data-pinned-form")).toBe("modern");
    expect(required(card, ".equation-visual").textContent).toBe(plainText(equation.html));
    const speed = equation.navigation.find((node) => node.quantityId === "frameSpeed");
    expect(speed).toBeDefined();
    await act(async () => press(nodeButton(card, speed?.id ?? "")));
    expect(row.getAttribute("data-pinned-quantity-id")).toBe("frameSpeed");
    expect(nodeButton(card, speed?.id ?? "").getAttribute("aria-pressed")).toBe("true");
    // A source-row quantity absent from the pinned relation clears that relation's selection,
    // while retaining the reader's choice in the source. It must not write null back to the row.
    const lengthTerm = required(row, '[data-quantity-id="lengthProper"]');
    await act(async () => press(row, lengthTerm));
    expect(row.getAttribute("data-pinned-quantity-id")).toBe("lengthProper");
    expect(nodeButton(card, speed?.id ?? "").getAttribute("aria-pressed")).toBe("false");

    // Model the existing wide-sheet rule at the same specificity as layout.css. This fixture
    // cannot lay out container queries, but the actual dock stylesheet must still win the cascade.
    applyCss(pinCss);
    applyCss(".reader-bottom-sheet { display: none; }");
    const dock = required<HTMLDetailsElement>(container, ".reader-equation-dock");
    expect(window.getComputedStyle(dock).display).toBe("block");
    expect(window.getComputedStyle(dock).position).toBe("sticky");
    expect(dock.open).toBe(true);
    const source = pins[1] as HTMLButtonElement;
    await act(async () => press(required(card, ".pinned-equation-actions a")));
    expect(dock.open).toBe(false);
    expect(document.activeElement === source).toBe(true);
    expect(window.location.hash).toBe(`#${equation.argument}`);
    expect(container.querySelector("[data-pinned-equation]")).not.toBeNull();
  });

  test("without script the complete formulas and notes remain, with no unusable pin controls", () => {
    const html = renderToStaticMarkup(cardReader());
    expect(html).toContain(equation.title);
    expect(html).toContain("Section notes remain available.");
    expect(html).toContain("equation-mathml");
    expect(html).not.toContain("data-pin-equation");
    expect(html).not.toContain("data-pinned-equation");
    const formula = renderToStaticMarkup(
      <PinnedEquationProvider>
        <ColouredFormula equations={[equation]} />
        <PinnedEquationDock />
      </PinnedEquationProvider>,
    );
    expect(formula).toContain("equation-mathml");
    expect(formula).not.toContain("data-pin-formula");
  });
});
