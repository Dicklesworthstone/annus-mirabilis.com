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
        // The same rule as initFormulaOverflow's: a named span or div needs a role that takes a name.
        if (!el.hasAttribute("role") && /^(SPAN|DIV)$/.test(el.tagName)) {
          el.setAttribute("role", "group");
        }
      }
    } else if (el.hasAttribute("tabindex")) {
      el.removeAttribute("tabindex");
    }
  }
}

export function initFormulaOverflow(): void {
  try {
    function update(): void {
      // Every region that can scroll, not only formulas. A scrollable box a keyboard cannot focus
      // is unreachable content, and the mechanism that fixes it does not care what is inside.
      // EVERY element, not a list of classes. A hand-kept selector drifts away from the CSS the
      // moment someone adds a scrolling rule, which is the failure this whole session keeps
      // finding; and measured ancestry shows why a narrow list cannot work - the offenders on
      // /lab/countermodels/ are a bare `pre` inside a `details`, and on /papers/mass-energy/ an
      // unclassed `div` inside `.linear-formula`. Neither carries a class to select.
      //
      // Scanning wide is safe because nothing is marked on the strength of matching: an element
      // is only touched when its COMPUTED overflow permits scrolling and its content actually
      // exceeds its box, which is the same predicate the ratchet and %30's sweep use.
      const regions = document.querySelectorAll<HTMLElement>("*");
      for (let i = 0; i < regions.length; i++) {
        const el = regions[i];
        if (!el) continue;
        // Natively focusable elements reach themselves; a tab stop on them is a duplicate.
        if (
          /^(INPUT|TEXTAREA|SELECT|BUTTON|A|IFRAME|AUDIO|VIDEO|DETAILS|SUMMARY)$/.test(el.tagName)
        ) {
          continue;
        }
        const style = window.getComputedStyle(el);
        const scrollsX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth;
        const scrollsY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
        // axe's scrollable-region-focusable exempts a container whose content is already
        // reachable: if a focusable descendant exists, a keyboard can scroll the box by tabbing
        // into it, and adding a stop here is the useless one the ratchet's docblock warns about.
        const reachableWithin = el.querySelector(
          'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])',
        );
        if ((scrollsX || scrollsY) && reachableWithin) {
          if (el.hasAttribute("data-scroll-focus")) el.removeAttribute("tabindex");
          continue;
        }
        if (scrollsX || scrollsY) {
          // Marks only what this script added, so it never removes an author's own tabindex.
          el.setAttribute("data-scroll-focus", "");
          el.setAttribute("tabindex", "0");
          if (!el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) {
            // Named from what the page already says, never invented. A caption IS a table's name
            // in HTML; a formula carries its own TeX; otherwise the nearest preceding heading.
            const tex =
              el.getAttribute("data-latex") ||
              el.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
            const caption = el.querySelector("caption")?.textContent?.trim();
            let heading: string | undefined;
            let node: HTMLElement | null = el;
            for (let hop = 0; hop < 6 && node && !heading; hop++) {
              let sib = node.previousElementSibling;
              while (sib && !heading) {
                if (/^H[1-6]$/.test(sib.tagName)) heading = sib.textContent?.trim();
                sib = sib.previousElementSibling;
              }
              node = node.parentElement;
            }
            const label = tex
              ? `Scrollable mathematical formula: ${tex}`
              : caption
                ? `Scrollable table: ${caption}`
                : heading
                  ? `Scrollable region: ${heading}`
                  : `Scrollable region ${i + 1}`;
            el.setAttribute("aria-label", label);
          }
          // A NAME ON A SPAN OR DIV IS PROHIBITED (axe aria-prohibited-attr): neither has a role
          // that takes one, so the label is ignored or misread. Measured on live
          // /papers/mass-energy/view/german/: seven overflowing source equations, spans named
          // "Scrollable mathematical formula: ...", each flagged serious. A group takes a name and
          // is not a landmark, so seven formulas do not become seven regions. Checked on every
          // pass, not only when the label is set, so a role lost to hydration comes back with the
          // tab stop. An element with a role of its own keeps it.
          if (
            el.hasAttribute("aria-label") &&
            !el.hasAttribute("role") &&
            /^(SPAN|DIV)$/.test(el.tagName)
          ) {
            el.setAttribute("role", "group");
          }
        } else if (el.hasAttribute("data-scroll-focus")) {
          el.removeAttribute("tabindex");
          el.removeAttribute("data-scroll-focus");
        }
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", update);
    } else {
      update();
    }
    window.addEventListener("load", update);
    // Debounced, because the scan is now over every element. Measured on this build: ~2.2ms on
    // /lab/countermodels/ (3,033 elements), ~3.3ms on /lab/bm-01/ (4,789) and ~8.8ms on
    // /papers/mass-energy/ (8,210). Fine occasionally and not fine once per resize event during a
    // drag, which is the only trigger that fires in a stream. The MutationObserver below was
    // already debounced; this brings resize into line rather than leaving one uneven edge.
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    window.addEventListener(
      "resize",
      () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(update, 100);
      },
      { passive: true },
    );

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
      luck rather than by design. (Corrected 2026-09-24: the observer was never attached, see
      below, so whatever re-ran update for those two labs, it was not this.)

      Re-checking after hydration is what fixes it. Attribute observation would be the tidier
      mechanism and is not used on purpose: this script's own writes are attribute changes, so
      watching attributes makes it observe itself.
    */
    const afterHydration = (): void => {
      update();
    };
    setTimeout(afterHydration, 300);
    setTimeout(afterHydration, 1200);

    if (typeof MutationObserver !== "undefined") {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const observer = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(update, 50);
      });
      // This script runs from <head> (app/layout.tsx), where document.body does not exist yet.
      // Until 2026-09-24 the guard above read `&& document.body`, so the observer was attached on
      // no page at all: a region that began to scroll after the timed re-checks got no tab stop
      // until the window was resized. Measured on live /papers/mass-energy/ at 320px: four
      // scrolling boxes a probe added to the DOM after hydration stayed unmarked for 1.5s, then
      // were marked at once by a resize.
      const watch = (): void => {
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
      };
      if (document.body) watch();
      else document.addEventListener("DOMContentLoaded", watch);
    }
  } catch {
    /* Degrades gracefully in non-DOM environments */
  }
}

export const FORMULA_OVERFLOW_SOURCE = `(${initFormulaOverflow.toString()})();`;
