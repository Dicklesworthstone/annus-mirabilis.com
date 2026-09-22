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

    /*
      HYDRATION STRIPS WHAT THIS SCRIPT SETS, and the observer below cannot see it happen.

      Measured on /lab/sr-03/ at 320px, timestamps from performance.now():

        DOMContentLoaded  t=61    31 formulas, 2 overflowing, 2 with tabindex="0"
        load              t=108   3 overflowing, 2 marked
        t+100             t=121   3 overflowing, 3 marked      <- correct
        t+200             t=215   3 overflowing, 0 marked      <- React hydrated
        t+1200                    3 overflowing, 0 marked      <- never restored

      So the logic was never wrong and the timing was only half the story: update() reaches the
      right answer by t=121, and React then reconciles the DOM against markup that carries no
      tabindex and removes it. The MutationObserver is registered for childList/subtree, and
      removing an attribute is neither, so nothing re-runs.

      That is also why /lab/bm-05/ and /lab/bm-08/ looked fine: their labs render plots and tables
      after hydrating, those are childList mutations, and the observer re-ran update for them by
      luck rather than by design.

      Re-checking after hydration is what fixes it. Attribute observation would be the tidier
      mechanism and is not used on purpose: this script's own writes are attribute changes, so
      watching attributes makes it observe itself.
    */
    const afterHydration = (): void => {
      update();
    };
    setTimeout(afterHydration, 300);
    setTimeout(afterHydration, 1200);

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
