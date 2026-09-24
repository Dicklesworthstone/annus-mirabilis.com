/**
 * "SHOW EVERY STEP" LOADS WHEN IT OPENS, ON A WHOLE-PAPER PAGE (TanElk's dispatch 114).
 *
 * Every passage's steps reading (R2) was in the whole-paper page, closed, embedded lessons and
 * all, and the RSC flight payload carried it a second time. Measured on live
 * /papers/special-relativity/ (16 passages): the page gzipped to 201,257 bytes against the
 * 250,000 budget and climbing; cutting R2 from its HTML saves 21,604 and from its flight data
 * 28,470 (reachability from the root rows; a control run with nothing cut saves 60).
 *
 * AGENTS.md names the remedy for a page over budget: R2 loads on first expansion, with real links
 * for no-script readers. The steps come from the passage's section page, /papers/<paper>/<s>/,
 * which the export already builds with the same ReadingBlocks, so there is no second renderer and
 * no copy to keep in step (the lesson dialog does the same with a lesson's page, lessonBody.ts).
 * The lifted nodes go straight into the disclosure after its summary, so the disclosure has the
 * section page's structure and child selectors match. An embedded lesson's construction is not
 * live in a copied page, so it is mounted afresh with React at the heading level it had there.
 *
 * Each section page is fetched once however many of its passages open. At "Show every step"
 * every passage opens, so every section loads: 20 to 70 KB brotli each on live, about 430 KB for
 * the whole of special relativity. That is the cost of that reading of the longest paper, paid
 * by the readers who choose it; the page no longer makes every reader pay 50 KB for it. All load
 * rather than only those in view, because browser find must reach every section (AGENTS.md).
 *
 * Without JavaScript nothing loads: the disclosure opens natively and holds the link.
 */
import type { HeadingLevel } from "../components/foundations/headingLevel.ts";
import { CONSTRUCTION_SELECTOR, type MountedConstruction } from "./lessonBody.ts";

export const STEPS_BODY_ATTRIBUTE = "data-steps-body";
const ARGUMENT_ID = /^arg-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SECTION_PAGE = /^\/papers\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/;

type Mount = (
  slot: HTMLElement,
  id: string,
  headingLevel: HeadingLevel,
) => MountedConstruction | Promise<MountedConstruction>;

/**
 * The steps of one passage on its section page, as nodes ready for the whole-paper disclosure:
 * everything in that passage's steps disclosure after its summary. Null when the page has none.
 */
export function extractSteps(html: string, argumentId: string, target: Document): Node[] | null {
  const Parser = target.defaultView?.DOMParser;
  if (!Parser || !ARGUMENT_ID.test(argumentId)) return null;
  const parsed = new Parser().parseFromString(html, "text/html");
  const steps = parsed
    .getElementById(argumentId)
    ?.querySelector<HTMLDetailsElement>('details.local-steps[data-reading="2"]');
  if (!steps) return null;
  // A parsed document has no window, so no HTMLElement to test against: element by nodeType.
  const nodes = [...steps.childNodes].filter(
    (node) => !(node.nodeType === 1 && (node as Element).tagName === "SUMMARY"),
  );
  if (nodes.length === 0) return null;
  return nodes.map((node) => target.importNode(node, true));
}

const pages = new Map<string, Promise<string | null>>();

function page(src: string, fetcher: typeof fetch): Promise<string | null> {
  let pending = pages.get(src);
  if (!pending) {
    pending = fetcher(src)
      .then((response) => (response.ok ? response.text() : null))
      .catch(() => null);
    pages.set(src, pending);
    // A failure is not cached: the next opening asks again.
    void pending.then((html) => {
      if (html === null) pages.delete(src);
    });
  }
  return pending;
}

const mounted = new Set<MountedConstruction>();

async function defaultMount(
  slot: HTMLElement,
  foundationId: string,
  headingLevel: HeadingLevel,
): Promise<MountedConstruction> {
  const { mountConstruction } = await import("./mountConstruction.tsx");
  return mountConstruction(slot, foundationId, headingLevel);
}

/** A construction's title is its first heading, at the level it was given (headingLevel.ts). */
function headingLevelOf(construction: Element): HeadingLevel {
  const tag = construction.querySelector("h2, h3, h4, h5")?.tagName;
  return tag ? (Number(tag.slice(1)) as HeadingLevel) : 5;
}

/**
 * Fill one passage's steps disclosure from its placeholder. Idempotent while loading or loaded; a
 * failed load keeps the placeholder's link and tries again the next time the passage opens.
 */
export async function loadStepsBody(
  placeholder: HTMLElement,
  options: Readonly<{
    fetch?: typeof fetch;
    mount?: Mount;
    /** Runs the insertion; the reader passes one that keeps the reader's place (holdPlace.ts). */
    insert?: (change: () => void) => void;
  }> = {},
): Promise<"loaded" | "failed" | "skipped"> {
  const argumentId = placeholder.getAttribute(STEPS_BODY_ATTRIBUTE) ?? "";
  const src = placeholder.dataset.stepsSrc ?? "";
  const details = placeholder.closest("details");
  const state = details?.dataset.stepsState;
  if (!details || !placeholder.isConnected || state === "loading" || state === "loaded")
    return "skipped";
  if (!ARGUMENT_ID.test(argumentId) || !SECTION_PAGE.test(src)) return "failed";
  const target = placeholder.ownerDocument;
  details.dataset.stepsState = "loading";
  details.setAttribute("aria-busy", "true");
  const html = await page(src, options.fetch ?? fetch);
  const nodes = html === null ? null : extractSteps(html, argumentId, target);
  details.removeAttribute("aria-busy");
  if (!nodes) {
    details.dataset.stepsState = "failed";
    if (!placeholder.querySelector("[data-steps-failed]")) {
      const note = target.createElement("span");
      note.setAttribute("data-steps-failed", "");
      note.textContent = "The steps did not load here. ";
      placeholder.prepend(note);
    }
    return "failed";
  }
  const slots: { slot: HTMLElement; id: string; level: HeadingLevel }[] = [];
  for (const node of nodes) {
    if (node.nodeType !== 1) continue;
    const element = node as HTMLElement;
    const found = element.matches(CONSTRUCTION_SELECTOR)
      ? [element]
      : [...element.querySelectorAll<HTMLElement>(CONSTRUCTION_SELECTOR)];
    for (const construction of found) {
      const id = construction.getAttribute("data-foundation-construction");
      if (!id) continue;
      const slot = target.createElement("div");
      slot.setAttribute("data-construction-slot", id);
      slots.push({ slot, id, level: headingLevelOf(construction) });
      construction.replaceWith(slot);
    }
  }
  (options.insert ?? ((change) => change()))(() => placeholder.replaceWith(...nodes));
  details.dataset.stepsState = "loaded";
  for (const { slot, id, level } of slots) {
    try {
      mounted.add(await (options.mount ?? defaultMount)(slot, id, level));
    } catch {
      const note = target.createElement("p");
      note.className = "fine";
      const link = target.createElement("a");
      link.href = `/foundations/${encodeURIComponent(id)}/`;
      link.textContent = "Open its lesson page";
      note.append("This construction did not load here. ", link, ".");
      slot.replaceChildren(note);
    }
  }
  return "loaded";
}

/** Unmount every construction this module mounted; the reader calls it when it unmounts. */
export function unmountStepsConstructions(): void {
  for (const root of mounted) root.unmount();
  mounted.clear();
}

/** For tests: forget the fetched section pages. */
export function forgetStepsPages(): void {
  pages.clear();
}
