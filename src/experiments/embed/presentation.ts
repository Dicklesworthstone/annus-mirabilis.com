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
  const applied = new Map<string, string>();
  function set(name: string, value: string) {
    if (!previous.has(name)) previous.set(name, root.getAttribute(name));
    applied.set(name, value);
    root.setAttribute(name, value);
  }
  function update() {
    const dark = options.theme === "dark" || (options.theme === "system" && colour.matches);
    set("data-theme", dark ? "kramgasse-night" : "annalen");
    set("data-embed-motion", options.motion === "reduce" || motion.matches ? "reduce" : "system");
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
