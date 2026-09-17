/**
 * Dynamic keyboard accessibility for scrollable formula regions (WCAG 2.1.1, axe scrollable-region-focusable, am-bc6s).
 *
 * Formulas that actually overflow their container (scrollWidth > clientWidth)
 * must be keyboard-reachable via tabIndex="0" and carry a distinct accessible name.
 * Formulas that do NOT overflow must NOT carry tabIndex to prevent useless tab stops
 * for keyboard users and avoid landmark-unique issues.
 */

export function syncFormulaOverflow(): void {
  if (typeof document === "undefined") return;
  const formulas = document.querySelectorAll<HTMLElement>(".formula");
  for (let i = 0; i < formulas.length; i++) {
    const el = formulas[i];
    if (!el) continue;
    if (el.scrollWidth > el.clientWidth) {
      el.setAttribute("tabindex", "0");
      if (!el.getAttribute("aria-label")) {
        const tex =
          el.getAttribute("data-latex") ||
          el.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
        const label = tex
          ? `Scrollable mathematical formula: ${tex}`
          : `Scrollable mathematical formula ${i + 1}`;
        el.setAttribute("aria-label", label);
      }
    } else if (el.hasAttribute("tabindex")) {
      el.removeAttribute("tabindex");
    }
  }
}

export function initFormulaOverflow(): void {
  try {
    function update(): void {
      const formulas = document.querySelectorAll<HTMLElement>(".formula");
      for (let i = 0; i < formulas.length; i++) {
        const el = formulas[i];
        if (!el) continue;
        if (el.scrollWidth > el.clientWidth) {
          el.setAttribute("tabindex", "0");
          if (!el.getAttribute("aria-label")) {
            const tex =
              el.getAttribute("data-latex") ||
              el.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
            const label = tex
              ? `Scrollable mathematical formula: ${tex}`
              : `Scrollable mathematical formula ${i + 1}`;
            el.setAttribute("aria-label", label);
          }
        } else if (el.hasAttribute("tabindex")) {
          el.removeAttribute("tabindex");
        }
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", update);
    } else {
      update();
    }
    window.addEventListener("load", update);
    window.addEventListener("resize", update, { passive: true });

    if (document.fonts?.ready) {
      document.fonts.ready.then(update);
    }

    if (typeof MutationObserver !== "undefined" && document.body) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const observer = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(update, 50);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  } catch {
    /* Degrades gracefully in non-DOM environments */
  }
}

export const FORMULA_OVERFLOW_SOURCE = `(${initFormulaOverflow.toString()})();`;
