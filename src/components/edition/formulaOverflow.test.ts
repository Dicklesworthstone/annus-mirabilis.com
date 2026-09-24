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
      // Named for a listener, never by its TeX: an aria-label is read as its text.
      expect(elOverflowing.getAttribute("aria-label")).toBe("Formula, scrolls sideways");

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
      expect(span.getAttribute("aria-label")).toBe("Formula, scrolls sideways");
      expect(span.getAttribute("role")).toBe("group");
      // A section takes a name on its own; it gets no role from the script.
      expect(section.getAttribute("aria-label")).toBe("Formula, scrolls sideways");
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

  test("a source equation that scrolls is named by its printed number, never by its TeX", async () => {
    // TanElk's ruling, 2026-09-24: a wide equation on the German face scrolls inside a region
    // named like "Equation (7), scrolls sideways". It was "Scrollable mathematical formula:
    // \frac{\partial p_\nu}{\partial t} = ...": an aria-label is read as its text, character by character.
    await installDom();
    try {
      const make = (label: string | null) => {
        const el = document.createElement("span");
        el.className = "source-equation";
        el.style.overflowX = "auto";
        el.innerHTML = `<span class="source-equation-math"><annotation encoding="application/x-tex">\\frac{\\partial p_\\nu}{\\partial t}</annotation></span>${label ? `<span class="source-equation-label">${label}</span>` : ""}`;
        Object.defineProperty(el, "scrollWidth", { value: 610, configurable: true });
        Object.defineProperty(el, "clientWidth", { value: 288, configurable: true });
        document.body.appendChild(el);
        return el;
      };
      const numbered = make("(7)");
      const unnumbered = make(null);
      initFormulaOverflow();
      expect(numbered.getAttribute("aria-label")).toBe("Equation (7), scrolls sideways");
      expect(unnumbered.getAttribute("aria-label")).toBe("Formula, scrolls sideways");
      for (const el of [numbered, unnumbered]) {
        expect(el.getAttribute("tabindex")).toBe("0");
        expect(el.getAttribute("aria-label")).not.toContain("\\");
        el.remove();
      }
    } finally {
      await uninstallDom();
    }
  });

  test("started from <head>, before <body> exists, it still marks a region that scrolls later", async () => {
    // The script runs from <head>. Until 2026-09-24 its MutationObserver was attached only when
    // document.body already existed, which from <head> it never does, so no page had one.
    await installDom();
    try {
      document.body.remove();
      expect(document.body).toBeNull();
      initFormulaOverflow();
      // A new body, as the parser would make one. Reusing the old node would let an observer an
      // earlier test attached to it mark the region, and this test would pass without this fix.
      document.documentElement.appendChild(document.createElement("body"));
      document.dispatchEvent(new Event("DOMContentLoaded"));
      // Let the one-shot passes run first (fonts.ready resolves in a microtask), so the region
      // below arrives after them, as a lazily mounted one does.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const late = document.createElement("div");
      late.style.overflowX = "auto";
      late.setAttribute("data-latex", "L/V^2");
      Object.defineProperty(late, "scrollWidth", { value: 738, configurable: true });
      Object.defineProperty(late, "clientWidth", { value: 288, configurable: true });
      document.body.appendChild(late);
      // The observer's 50ms debounce, and well short of the first timed re-check at 300ms, so
      // only the observer can have marked it.
      await new Promise((resolve) => setTimeout(resolve, 120));
      expect(late.getAttribute("tabindex")).toBe("0");
      expect(late.getAttribute("aria-label")).toBe("Formula, scrolls sideways");
      late.remove();
    } finally {
      await uninstallDom();
    }
  });

  test("initFormulaOverflow does not throw in any environment", () => {
    expect(() => initFormulaOverflow()).not.toThrow();
  });
});
