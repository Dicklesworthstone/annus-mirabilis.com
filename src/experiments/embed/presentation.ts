import type { EmbedOptions } from "./contract.ts";

/** Reversible document-local presentation. This never reads or writes persistent storage,
 * never changes a laboratory's input parameters, and never messages the parent frame.
 */
export function installEmbedPresentation(
  root: HTMLElement,
  options: EmbedOptions,
  matchMedia: (query: string) => MediaQueryList,
): () => void {
  const colour = matchMedia("(prefers-color-scheme: dark)");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const previous = new Map<string, string | null>();
  const applied = new Map<string, string | null>();
  /** `null` removes the attribute, which is how an absent reduced-motion setting is written. */
  function set(name: string, value: string | null) {
    if (!previous.has(name)) previous.set(name, root.getAttribute(name));
    applied.set(name, value);
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
  function update() {
    const dark = options.theme === "dark" || (options.theme === "system" && colour.matches);
    set("data-theme", dark ? "kramgasse-night" : "annalen");
    const reduce = options.motion === "reduce" || motion.matches;
    set("data-embed-motion", reduce ? "reduce" : "system");
    /*
      THE PARAMETER HAS TO REACH THE GATE THE LABORATORIES READ (dispatch 430).

      `data-embed-motion` is consumed by one place, src/components/embed/embed.css, which kills CSS
      animation, transition and scroll-behaviour inside `.embedded-laboratory`. That is the whole of
      what it did, and a laboratory's motion is not a CSS animation: a random walk or a boost is a
      JavaScript loop, and `animation: none` does not touch one.

      Those loops ask `isReducedMotionPreferred()` (src/a11y/reducedMotion.ts), which reads
      `data-reduced-motion` on the document element and then the device's media query. It never read
      `data-embed-motion`. Measured before this change, with a device asking for nothing:
      `?motion=reduce` set `data-embed-motion=reduce` and `isReducedMotionPreferred()` still returned
      false, so an embedded laboratory animated in someone else's page for a reader who had asked it
      not to through the URL. The device path already worked; it was the PARAMETER path, which is the
      clause AGENTS.md states, that reached nothing.

      So the same decision is written where the laboratories look for it. "true" or absent is the
      established shape of this attribute (src/a11y/descriptions/provider.tsx writes `"true"` or
      `undefined`, and nothing anywhere reads "false"), which is why the else branch removes it
      rather than writing a word no reader understands. It stays reversible with everything else
      here: the cleanup below restores what was there, including absence.
    */
    set("data-reduced-motion", reduce ? "true" : null);
  }
  update();
  colour.addEventListener("change", update);
  motion.addEventListener("change", update);
  return () => {
    colour.removeEventListener("change", update);
    motion.removeEventListener("change", update);
    for (const [name, value] of previous) {
      // Do not undo a subsequent explicit setting made by another owner.
      if (root.getAttribute(name) !== applied.get(name)) continue;
      if (value === null) root.removeAttribute(name);
      else root.setAttribute(name, value);
    }
  };
}
