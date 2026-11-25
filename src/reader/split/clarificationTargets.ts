import { parseInstrumentViewId } from "../stack/portableTargets.ts";

export type SplitFoundation = Readonly<{ id: string; title: string }>;
export const SPLIT_CLARIFICATIONS_DISPOSE = "annus:split-clarifications-dispose";

/** Only lessons in this paper's compiled prerequisite closure may open in its split reading. */
export function splitFoundation(root: HTMLElement, id: string): SplitFoundation | null {
  if (root.dataset.view !== "split" || !/^[a-z][a-z0-9-]{0,179}$/.test(id)) return null;
  try {
    const titles: unknown = JSON.parse(root.dataset.splitFoundations ?? "{}");
    if (!titles || typeof titles !== "object" || !Object.hasOwn(titles, id)) return null;
    const title = (titles as Record<string, unknown>)[id];
    return typeof title === "string" && title.length > 0 ? { id, title } : null;
  } catch {
    return null;
  }
}

/** These links come from the shared passage projection; their standalone href stays intact. */
export function splitInstrumentTarget(href: string): string | undefined {
  const match = /^\/lab\/([^/?#]+)\/?$/.exec(href);
  if (!match?.[1]) return undefined;
  try {
    const id = decodeURIComponent(match[1]);
    return parseInstrumentViewId(id) ? `instrument-view:${id}` : undefined;
  } catch {
    return undefined;
  }
}
