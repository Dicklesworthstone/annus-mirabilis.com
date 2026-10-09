import { withCapstoneReturn } from "./returnRoute.ts";

/**
 * Enhance real hrefs, not click events: keyboard activation, copied links and opening a new tab
 * all carry the same public return address. Nothing intercepts a laboratory or reader action.
 */
export function mountCapstoneReturnLinks(root: HTMLElement, paper: string): () => void {
  const owned = new Map<HTMLAnchorElement, { original: string; decorated: string }>();
  const update = () => {
    for (const anchor of owned.keys()) {
      if (!root.contains(anchor)) owned.delete(anchor);
    }
    for (const anchor of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      const original = anchor.getAttribute("href");
      if (original === null) continue;
      const previous = owned.get(anchor);
      // Downloads and external/alternate browsing contexts are not continuation links.
      if (
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self" && anchor.target !== "_blank")
      ) {
        if (original === previous?.decorated) anchor.setAttribute("href", previous.original);
        owned.delete(anchor);
        continue;
      }
      if (original === previous?.decorated) continue;
      const decorated = withCapstoneReturn(original, paper);
      if (decorated === original) {
        owned.delete(anchor);
        continue;
      }
      owned.set(anchor, { original, decorated });
      anchor.setAttribute("href", decorated);
    }
  };
  update();
  const Observer = root.ownerDocument.defaultView?.MutationObserver;
  const observer = Observer ? new Observer(update) : null;
  observer?.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href", "download", "target"],
  });
  return () => {
    observer?.disconnect();
    for (const [anchor, entry] of owned) {
      if (anchor.getAttribute("href") === entry.decorated)
        anchor.setAttribute("href", entry.original);
    }
    owned.clear();
  };
}
