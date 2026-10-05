import type { WeaveMeaning } from "../../experiments/weave/types.ts";

/** Content variants come from faceLookup/contentIds, not from a second anchor grammar here. */
export type SourceWeavePointer = Readonly<{
  contentId: string;
  meaning: WeaveMeaning;
  descriptionId: string;
}>;

const SOURCE_SENTENCES = ".source-sentence[data-sentence-id], .translation-unit[data-translation-unit-id]";
const OWNER = "data-live-weave-owner";
const MEANING = "data-live-weave-meaning";

/**
 * Annotate existing source nodes, without replacing their text, ids, alignment state or event
 * handlers. The reader chooses a root and one laboratory owns these annotations. Late-rendered
 * faces are handled by the same content-id lookup. Disposal removes only this owner's additions.
 */
export function connectSourceHighlights(
  root: Element,
  owner: string,
  initial: readonly SourceWeavePointer[] = [],
) {
  let pointers = new Map(initial.map((pointer) => [pointer.contentId, pointer]));
  const owned = new Map<Element, { descriptionId: string; addedDescription: boolean }>();
  let disposed = false;

  function clear() {
    for (const [element, record] of owned) {
      if (element.getAttribute(OWNER) !== owner) continue;
      element.removeAttribute(OWNER);
      element.removeAttribute(MEANING);
      if (record.addedDescription) {
        const descriptions = (element.getAttribute("aria-describedby") ?? "").split(/\s+/)
          .filter((id) => id && id !== record.descriptionId);
        if (descriptions.length) element.setAttribute("aria-describedby", descriptions.join(" "));
        else element.removeAttribute("aria-describedby");
      }
    }
    owned.clear();
  }

  function refresh() {
    if (disposed) return;
    clear();
    for (const element of root.querySelectorAll(SOURCE_SENTENCES)) {
      const contentId = element.getAttribute("data-sentence-id") ?? element.getAttribute("data-translation-unit-id");
      const pointer = contentId === null ? undefined : pointers.get(contentId);
      if (!pointer || element.hasAttribute(OWNER)) continue;
      const descriptions = (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
      const addedDescription = !descriptions.includes(pointer.descriptionId);
      if (addedDescription) descriptions.push(pointer.descriptionId);
      element.setAttribute("aria-describedby", descriptions.join(" "));
      element.setAttribute(OWNER, owner);
      element.setAttribute(MEANING, pointer.meaning);
      owned.set(element, { descriptionId: pointer.descriptionId, addedDescription });
    }
  }

  const Observer = root.ownerDocument.defaultView?.MutationObserver;
  const observer = Observer ? new Observer(refresh) : undefined;
  // Attribute changes are deliberately excluded: our own annotations cannot trigger a loop.
  observer?.observe(root, { childList: true, subtree: true });
  refresh();
  return Object.freeze({
    update(next: readonly SourceWeavePointer[]) {
      if (disposed) return;
      pointers = new Map(next.map((pointer) => [pointer.contentId, pointer]));
      refresh();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      clear();
    },
  });
}
