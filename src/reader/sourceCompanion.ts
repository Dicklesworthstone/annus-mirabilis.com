/** The companion uses the canonical source page, never a second transcription or math renderer. */
export const BROWNIAN_GERMAN_SOURCE_HREF = "/papers/brownian-motion/view/german/";

export type SourceCompanionTarget = Readonly<{
  id: string;
  label: string;
  germanHref: string;
  english: readonly Readonly<{ href: string; label: string }>[];
}>;

export type SourceCompanionPassage = Readonly<{
  id: string;
  title: string;
  targets: readonly SourceCompanionTarget[];
}>;

export type SourceCompanionDocument = Document | DocumentFragment;

const SOURCE_ROOT = '[data-reader-root][data-face="german"]';
const ID_REFERENCES = [
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-activedescendant",
  "aria-details",
  "aria-errormessage",
  "aria-flowto",
  "aria-owns",
  "for",
  "headers",
];
const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "action", "formaction", "poster"]);
const SOURCE_BASE = new URL(BROWNIAN_GERMAN_SOURCE_HREF, "https://annus-mirabilis.com");

/** Parsing is lazy and shared by the two responsive companion slots. */
export function parseSourceCompanion(html: string, target: Document): DocumentFragment | null {
  // A template's contents are inert, including frames and images. DOMParser's detached HTML
  // document can begin loading their URLs before the selected fragment has been sanitized.
  const template = target.createElement("template");
  template.innerHTML = html;
  const source = template.content;
  return source.querySelector(SOURCE_ROOT) ? source : null;
}

function byAttribute(root: Element, attribute: string, value: string): Element | undefined {
  return [...root.querySelectorAll(`[${attribute}]`)].find(
    (element) => element.getAttribute(attribute) === value,
  );
}

function localFragment(href: string): string | null {
  try {
    const url = new URL(href, SOURCE_BASE);
    if (url.origin !== SOURCE_BASE.origin || url.pathname !== SOURCE_BASE.pathname || url.search)
      return null;
    return url.hash ? decodeURIComponent(url.hash.slice(1)) : null;
  } catch {
    return null;
  }
}

function safeUrl(value: string): boolean {
  try {
    const url = new URL(value, SOURCE_BASE);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function unsafeStyle(value: string): boolean {
  return (
    /url\s*\(|expression\s*\(|@import|behavior|\\/iu.test(value) ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  );
}

/** Keep the source's words and static legends; imported page controls have no mounted owner. */
function makeStatic(body: HTMLElement): void {
  for (const element of body.querySelectorAll(
    "script, style, iframe, object, embed, base, link, meta, template, noscript, form, input, select, textarea, audio, video, source, track, animate, animateMotion, animateTransform, set, foreignObject, annotation-xml",
  ))
    element.remove();
  for (const control of body.querySelectorAll(
    '[data-align-sentences-control], [data-action="show-aligned-target"], .notebook-passage-actions',
  ))
    control.remove();
  for (const button of body.querySelectorAll("button")) {
    const legend = body.ownerDocument.createElement("span");
    for (const attribute of button.attributes)
      if (
        ![
          "type",
          "disabled",
          "role",
          "tabindex",
          "aria-pressed",
          "aria-expanded",
          "aria-haspopup",
        ].includes(attribute.name)
      )
        legend.setAttribute(attribute.name, attribute.value);
    legend.append(...button.childNodes);
    button.replaceWith(legend);
  }
  for (const element of [body, ...body.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (
        name.startsWith("on") ||
        [
          "srcdoc",
          "srcset",
          "autofocus",
          "contenteditable",
          "form",
          "target",
          "download",
          "ping",
        ].includes(name) ||
        (URL_ATTRIBUTES.has(name) && !safeUrl(attribute.value)) ||
        (name === "style" && unsafeStyle(attribute.value))
      )
        element.removeAttribute(attribute.name);
    }
    // A sentence or a coloured glyph stays readable, but is not a dead alignment/inspector action.
    element.removeAttribute("tabindex");
    if (["button", "menuitem", "option"].includes(element.getAttribute("role") ?? ""))
      element.removeAttribute("role");
  }
}

/**
 * Copy exactly one bound source block and the notes it cites. Every DOM id belongs to this slot;
 * source data ids, the printed TeX, MathML, corrections and page links retain their identity.
 * Missing source is a refusal, never a nearby paragraph substituted for the requested one.
 */
export function extractSourceCompanion(
  html: string | SourceCompanionDocument,
  blockId: string,
  target: Document,
  namespace: string,
): HTMLElement | null {
  if (!/^[a-z][a-z0-9_-]*$/iu.test(namespace)) return null;
  const source = typeof html === "string" ? parseSourceCompanion(html, target) : html;
  const root = source?.querySelector(SOURCE_ROOT);
  if (!root) return null;
  const wrapper = byAttribute(root, "data-block-wrapper", blockId);
  const footnote = byAttribute(root, "data-footnote-id", blockId);
  const original = wrapper ?? footnote;
  if (!original) return null;

  const body = target.createElement("div");
  body.className = "brownian-original-fragment";
  body.lang = "de";
  body.setAttribute("data-original-source", blockId);
  const notes = target.createElement("ol");
  notes.className = "footnotes-list";
  const copiedNotes = new Set<string>();
  if (footnote && !wrapper) {
    notes.append(target.importNode(footnote, true));
    copiedNotes.add(blockId);
    body.append(notes);
  } else body.append(target.importNode(original, true));

  // Footnotes can cite another note. The set both preserves their first-use order and ends cycles.
  for (;;) {
    const needed = [...body.querySelectorAll("[data-footnote-ref]")]
      .map((mark) => mark.getAttribute("data-footnote-ref") ?? "")
      .filter((id) => id && !copiedNotes.has(id));
    if (!needed.length) break;
    for (const id of needed) {
      if (copiedNotes.has(id)) continue;
      copiedNotes.add(id);
      const note = byAttribute(root, "data-footnote-id", id);
      if (!note) return null;
      notes.append(target.importNode(note, true));
    }
    if (!body.contains(notes)) body.append(notes);
  }
  makeStatic(body);

  const ids = new Map<string, string>();
  for (const element of body.querySelectorAll("[id]")) {
    const id = element.id;
    if (!id || ids.has(id)) return null;
    const local = `${namespace}-${id}`;
    ids.set(id, local);
    element.id = local;
  }
  for (const element of body.querySelectorAll("*")) {
    for (const attribute of ID_REFERENCES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const references = value.split(/\s+/u).flatMap((id) => ids.get(id) ?? []);
      if (references.length) element.setAttribute(attribute, references.join(" "));
      else element.removeAttribute(attribute);
    }
    for (const attribute of ["href", "xlink:href"]) {
      const href = element.getAttribute(attribute);
      if (!href) continue;
      const sourceId = localFragment(href);
      const local = sourceId ? ids.get(sourceId) : undefined;
      if (local) {
        element.setAttribute(attribute, `#${local}`);
        if (element.localName === "a") element.setAttribute("data-original-local-target", local);
      } else if (element.localName === "a") {
        // A source backlink outside this excerpt still opens the exact canonical German anchor.
        const url = new URL(href, SOURCE_BASE);
        element.setAttribute(
          "href",
          url.origin === SOURCE_BASE.origin ? `${url.pathname}${url.search}${url.hash}` : url.href,
        );
      } else {
        // SVG use references cannot import an external document into the excerpt.
        element.removeAttribute(attribute);
      }
    }
  }
  return body;
}

/** A footnote round trip scrolls only this companion; it never changes the reading's hash. */
export function followSourceCompanionLink(event: MouseEvent, body: HTMLElement): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return false;
  const element = event.target instanceof Element ? event.target : null;
  const link = element?.closest<HTMLAnchorElement>("a[data-original-local-target]");
  if (!link || !body.contains(link)) return false;
  const id = link.getAttribute("data-original-local-target");
  const destination = [...body.querySelectorAll<HTMLElement>("[id]")].find(
    (item) => item.id === id,
  );
  if (!destination) return false;
  event.preventDefault();
  destination.tabIndex = -1;
  destination.focus({ preventScroll: true });
  // scrollIntoView can also scroll the main document. Confine this jump to the existing
  // scrollable companion surface, preserving the passage's viewport and URL.
  const surface =
    body.closest<HTMLElement>("[data-bottom-sheet], [data-reader-companion-column]") ?? body;
  surface.scrollTop +=
    destination.getBoundingClientRect().top - surface.getBoundingClientRect().top;
  return true;
}
