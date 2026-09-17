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

  test("initFormulaOverflow does not throw in any environment", () => {
    expect(() => initFormulaOverflow()).not.toThrow();
  });
});
