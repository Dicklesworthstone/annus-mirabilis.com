/**
 * A LESSON IN THE CLARIFICATION DIALOG LOADS WHEN IT OPENS (TanElk's dispatch 106).
 *
 * The dialog used to carry every lesson the paper can open, in full: on the Brownian reading
 * 22 lessons were 358,025 bytes of the HTML's 2.39 MB, and the RSC flight payload carried them
 * a second time. Gzipped the page was 263,485 bytes against a 256,000 budget, and cutting the
 * lessons' HTML alone brought it to 215,119. So the dialog now ships each lesson's heading and
 * a loading line, and the body arrives when the reader opens that lesson.
 *
 * The body comes from the lesson's own page, /foundations/<id>/, which the export already
 * builds with the same FoundationBody (11 to 21 KB brotli per lesson measured on live), so there
 * is no second renderer and no second copy to keep in step. Two things change on the way in:
 * the page sets the lesson's parts one level under its h1, and in the dialog they sit under
 * the lesson's h2, so every heading moves down one level; and the prerequisites landmark gains
 * the dialog's context, as FoundationBody gives it when it renders in a panel. A lesson's
 * interactive construction is not live in a copied page, so it is mounted afresh with React.
 *
 * Without JavaScript the dialog never opens: every lesson link is a real link to its page.
 */

export const LESSON_BODY_ATTRIBUTE = "data-lesson-body";
/** The root of a lesson's construction or extension, FoundationConstruction's six cases. */
export const CONSTRUCTION_SELECTOR = ".foundation-construction, .foundation-extension";

export function lessonPageHref(id: string): string {
  return `/foundations/${encodeURIComponent(id)}/`;
}

/**
 * The lesson body of a standalone lesson page, ready for the dialog, or null when the page has
 * none. Pure apart from the DOMParser it is given, so it is tested on real built pages.
 */
export function extractLesson(
  html: string,
  target: Document,
  contextLabel = "clarification panel",
): HTMLElement | null {
  const Parser = target.defaultView?.DOMParser;
  if (!Parser) return null;
  const parsed = new Parser().parseFromString(html, "text/html");
  const lesson = parsed.querySelector("main .foundation-lesson");
  if (!lesson) return null;
  const body = target.importNode(lesson, true) as HTMLElement;
  for (const heading of [...body.querySelectorAll("h1, h2, h3, h4, h5")]) {
    const level = Number(heading.tagName.slice(1));
    const moved = target.createElement(`h${level + 1}`);
    for (const attribute of [...heading.attributes])
      moved.setAttribute(attribute.name, attribute.value);
    moved.append(...heading.childNodes);
    heading.replaceWith(moved);
  }
  for (const nav of body.querySelectorAll<HTMLElement>('nav[aria-label^="Prerequisites for "]')) {
    const label = nav.getAttribute("aria-label") ?? "";
    if (!label.endsWith(")")) nav.setAttribute("aria-label", `${label} (${contextLabel})`);
  }
  return body;
}

export type MountedConstruction = Readonly<{ unmount: () => void }>;

const mounted = new Set<MountedConstruction>();

async function defaultMount(slot: HTMLElement, foundationId: string): Promise<MountedConstruction> {
  const { mountConstruction } = await import("./mountConstruction.tsx");
  return mountConstruction(slot, foundationId);
}

function failure(target: Document, id: string): HTMLElement {
  const note = target.createElement("p");
  note.className = "fine";
  note.append("This lesson did not load here. ");
  const link = target.createElement("a");
  link.href = lessonPageHref(id);
  link.textContent = "Open it as its own page";
  note.append(link, ".");
  return note;
}

/**
 * Fill one lesson slot. Idempotent while loading or loaded; a failed slot tries again the next
 * time its lesson opens. Resolves to what happened, for tests and for the caller's log.
 */
export async function loadLessonBody(
  slot: HTMLElement,
  options: Readonly<{
    fetch?: typeof fetch;
    mount?: (slot: HTMLElement, id: string) => MountedConstruction | Promise<MountedConstruction>;
  }> = {},
): Promise<"loaded" | "failed" | "skipped"> {
  const id = slot.getAttribute(LESSON_BODY_ATTRIBUTE);
  const state = slot.dataset.lessonState;
  if (!id || state === "loading" || state === "loaded") return "skipped";
  const target = slot.ownerDocument;
  slot.dataset.lessonState = "loading";
  slot.setAttribute("aria-busy", "true");
  let lesson: HTMLElement | null = null;
  try {
    const response = await (options.fetch ?? fetch)(lessonPageHref(id));
    if (response.ok) lesson = extractLesson(await response.text(), target);
  } catch {
    // Offline, blocked or aborted: the same as a page with no lesson, handled just below.
  }
  if (!lesson) {
    slot.replaceChildren(failure(target, id));
    slot.dataset.lessonState = "failed";
    slot.removeAttribute("aria-busy");
    return "failed";
  }
  const construction = lesson.querySelector(CONSTRUCTION_SELECTOR);
  let constructionSlot: HTMLElement | null = null;
  if (construction) {
    constructionSlot = target.createElement("div");
    constructionSlot.setAttribute("data-construction-slot", id);
    construction.replaceWith(constructionSlot);
  }
  slot.replaceChildren(lesson);
  slot.dataset.lessonState = "loaded";
  slot.removeAttribute("aria-busy");
  if (constructionSlot) {
    // The lesson has loaded; a construction that cannot mount leaves it in place and points
    // to the lesson's page, where the construction runs.
    try {
      mounted.add(await (options.mount ?? defaultMount)(constructionSlot, id));
    } catch {
      constructionSlot.replaceChildren(failure(target, id));
    }
  }
  return "loaded";
}

/** Unmount every construction this module mounted; the reader calls it when it unmounts. */
export function unmountLessonConstructions(): void {
  for (const root of mounted) root.unmount();
  mounted.clear();
}
