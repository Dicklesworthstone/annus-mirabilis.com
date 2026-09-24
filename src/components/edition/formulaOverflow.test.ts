import { describe, expect, test } from "bun:test";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import {
  FORMULA_OVERFLOW_SOURCE,
  initFormulaOverflow,
  syncFormulaOverflow,
} from "./formulaOverflow.inline.ts";

describe("formulaOverflow (am-bc6s)", () => {
  test("FORMULA_OVERFLOW_SOURCE is a self-contained executable IIFE string", () => {
    expect(FORMULA_OVERFLOW_SOURCE).toMatch(/^\(function/);
    expect(FORMULA_OVERFLOW_SOURCE).toMatch(/\)\(\);$/);
    expect(FORMULA_OVERFLOW_SOURCE).toContain("scrollWidth");
    expect(FORMULA_OVERFLOW_SOURCE).toContain("clientWidth");
  });

  test("syncFormulaOverflow conditionally sets tabindex=0 and distinct aria-label only when scrollWidth > clientWidth", async () => {
    await installDom();
    try {
      const container = document.createElement("div");
      document.body.appendChild(container);

      const elOverflowing = document.createElement("div");
      elOverflowing.className = "formula";
      elOverflowing.setAttribute("data-latex", "p_{\\text{locked}}=\\frac{k_B T}{V}");
      Object.defineProperty(elOverflowing, "scrollWidth", { value: 738, configurable: true });
      Object.defineProperty(elOverflowing, "clientWidth", { value: 288, configurable: true });
      container.appendChild(elOverflowing);

      const elFitting = document.createElement("div");
      elFitting.className = "formula";
      elFitting.setAttribute("data-latex", "E = mc^2");
      Object.defineProperty(elFitting, "scrollWidth", { value: 120, configurable: true });
      Object.defineProperty(elFitting, "clientWidth", { value: 288, configurable: true });
      container.appendChild(elFitting);

      syncFormulaOverflow();

      // The overflowing element must become focusable with a distinct name
      expect(elOverflowing.getAttribute("tabindex")).toBe("0");
      expect(elOverflowing.getAttribute("aria-label")).toBe(
        "Scrollable mathematical formula: p_{\\text{locked}}=\\frac{k_B T}{V}",
      );

      // The fitting element must NOT have tabindex (preventing useless tab stops)
      expect(elFitting.hasAttribute("tabindex")).toBe(false);
      expect(elFitting.hasAttribute("aria-label")).toBe(false);

      // If the overflowing element later expands or its container becomes wider (scrollWidth <= clientWidth):
      Object.defineProperty(elOverflowing, "clientWidth", { value: 800, configurable: true });
      syncFormulaOverflow();
      expect(elOverflowing.hasAttribute("tabindex")).toBe(false);

      container.remove();
    } finally {
      await uninstallDom();
    }
  });

  test("a named scroll region that is a span or div gets a role that takes the name", async () => {
    // axe aria-prohibited-attr: aria-label on a span or div with no role. On live
    // /papers/mass-energy/view/german/ seven overflowing source equations (spans) were named
    // this way and flagged serious; light-quanta's German face had 46.
    await installDom();
    try {
      const make = (tag: string, attrs: Record<string, string> = {}) => {
        const el = document.createElement(tag);
        el.style.overflowX = "auto";
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        Object.defineProperty(el, "scrollWidth", { value: 738, configurable: true });
        Object.defineProperty(el, "clientWidth", { value: 288, configurable: true });
        document.body.appendChild(el);
        return el;
      };
      const span = make("span", { "data-latex": "E_0 = E_1 + L" });
      const section = make("section", { "data-latex": "x' = x - vt" });
      const figure = make("div", { role: "figure", "data-latex": "a = b" });
      // Labelled by an earlier pass, its role since stripped (hydration removes what the script set).
      const stripped = make("span", {
        "data-scroll-focus": "",
        "aria-label": "Scrollable mathematical formula: y",
      });

      initFormulaOverflow();

      expect(span.getAttribute("tabindex")).toBe("0");
      expect(span.getAttribute("aria-label")).toBe(
        "Scrollable mathematical formula: E_0 = E_1 + L",
      );
      expect(span.getAttribute("role")).toBe("group");
      // A section takes a name on its own; it gets no role from the script.
      expect(section.getAttribute("aria-label")).toBe(
        "Scrollable mathematical formula: x' = x - vt",
      );
      expect(section.hasAttribute("role")).toBe(false);
      // An author's own role is kept.
      expect(figure.getAttribute("role")).toBe("figure");
      // A role lost to hydration comes back with the tab stop.
      expect(stripped.getAttribute("role")).toBe("group");

      for (const el of [span, section, figure, stripped]) el.remove();
    } finally {
      await uninstallDom();
    }
  });

  test("initFormulaOverflow does not throw in any environment", () => {
    expect(() => initFormulaOverflow()).not.toThrow();
  });
});
