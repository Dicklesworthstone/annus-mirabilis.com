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
      // MEASURED: fonts.ready alone is too early. `document.fonts.ready` resolves when the faces
      // have LOADED, not when the browser has finished re-laying-out with them, so update() runs
      // against pre-webfont widths, finds no overflow, and leaves the formula unreachable.
      //
      // On /lab/sr-03/ and /lab/lq-06/ at 320px, three and two formulas overflow horizontally
      // (311/288, 315/288, 520/288 and 435/288, 360/288) and carried tabindex=null after load,
      // fonts.ready and 800ms. Dispatching a single resize event - which calls this same update -
      // set tabindex="0" on every one of them. The logic was already right; only its timing was
      // wrong.
      //
      // /lab/bm-05/ and /lab/bm-08/ were unaffected and that is the tell: their React labs mutate
      // the DOM after the fonts settle, so the MutationObserver below re-ran update for them. A
      // page with no post-font mutation got one pass at the wrong moment and never another.
      //
      // Two frames, because one is not enough: the first lands in the same frame the font swap is
      // committed in, and layout is read back stale.
      document.fonts.ready.then(() => {
        update();
        requestAnimationFrame(() => requestAnimationFrame(update));
      });
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
