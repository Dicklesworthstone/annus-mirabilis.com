/**
 * ONE WAY TO CLOSE ANYTHING THAT OVERLAYS THE PAGE.
 *
 * The owner, 2026-09-22: "any modal should be able to be closed by clicking/tapping anywhere
 * outside of it, and should always have an X button in the upper right corner for good UX".
 * Every overlay on the site (a modal <dialog>, a sheet hanging from the header, a popover beside
 * a word) wires its closing through `makeDismissible`, so the three ways out behave the same
 * everywhere:
 *
 * - **The X**, top right, from `createModalCloseButton` here or `<ModalCloseButton>` in React.
 *   Same markup, same `.modal-close` rule in modal.css: 44 by 44, a visible focus ring, floated so
 *   the heading beside it wraps instead of running underneath.
 * - **A press outside the panel.** A press counts when it starts AND ends outside, so a finger
 *   that scrolls (the browser cancels the pointer) or a text selection dragged out of a field
 *   never closes it, and a tap or click always does. pointerdown arms it. What closes it depends
 *   on whether the panel covers the page:
 *   - a modal <dialog> closes on the `click` its backdrop receives. Closing any earlier, on
 *     pointerup, takes the backdrop away before a touch's compatibility mousedown and click
 *     arrive, and those then land on the page underneath: they steal focus back from the opener
 *     and can follow a link that happened to be under the finger. The listener sits on the dialog
 *     itself, which is also what makes iOS Safari treat the backdrop as clickable.
 *   - a non-modal panel (a sheet, a popover) closes on pointerup. The page under the finger is
 *     live, so the tap is meant to go through to it, and iOS Safari would not deliver a `click`
 *     on plain text to a listener on the document.
 * - **Escape.** A modal <dialog> already turns Escape into `cancel`; its owner usually maps that
 *   itself, so pass `escape: false` there. A non-dialog panel gets a document keydown listener.
 *
 * What this module does NOT do is decide what closing means. The reader's clarification stack
 * closes one frame at a time and rewrites history; the search palette removes itself; a <details>
 * sets `open = false`. `onDismiss` receives the reason and the owner does the rest, including
 * returning focus. A modal <dialog> returns it to the control that opened it on every close,
 * because the page behind was inert and the press outside landed nowhere. A non-modal panel
 * returns it after the X or Escape, and not after a press outside, because that press landed
 * where the reader wants to be.
 */

export type DismissReason = "close-button" | "outside" | "escape";

export interface DismissOptions {
  /** Every reader-initiated close arrives here: the X, a press outside, or Escape. */
  readonly onDismiss: (reason: DismissReason) => void;
  /** Aborting it removes every listener this module added. */
  readonly signal: AbortSignal;
  /** Whether the panel is showing. Default: the `open` property of a <dialog> or <details>. */
  readonly isOpen?: () => boolean;
  /**
   * Elements that belong to the control without being inside the panel, such as a popover's
   * trigger. A press on one of them is not "outside"; the trigger toggles the panel itself.
   */
  readonly inside?: readonly Element[];
  /** Map Escape to onDismiss("escape"). Default true. Pass false where the owner already does. */
  readonly escape?: boolean;
  /** The X to wire to onDismiss("close-button"). */
  readonly closeButton?: HTMLButtonElement | null;
}

const SVG = "http://www.w3.org/2000/svg";

/** The X, for panels built with the DOM. `<ModalCloseButton>` renders the same markup. */
export function createModalCloseButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "modal-close";
  button.setAttribute("aria-label", label);
  button.setAttribute("data-modal-close", "");
  const icon = document.createElementNS(SVG, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", MODAL_CLOSE_ICON_PATH);
  icon.append(path);
  button.append(icon);
  return button;
}

/** Two strokes corner to corner, shared by the DOM and React builders so they cannot drift. */
export const MODAL_CLOSE_ICON_PATH = "M6 6 18 18M18 6 6 18";

function defaultIsOpen(panel: HTMLElement): boolean {
  if (panel instanceof HTMLDialogElement || panel instanceof HTMLDetailsElement) return panel.open;
  return panel.isConnected && !panel.hidden;
}

/** A <dialog> opened with showModal(): it has a backdrop, and the page behind it is inert. */
function isModal(panel: HTMLElement): boolean {
  if (!(panel instanceof HTMLDialogElement) || !panel.open) return false;
  try {
    return panel.matches(":modal");
  } catch {
    return true; // A browser without :modal still opened it with showModal() on this site.
  }
}

/**
 * Whether a pointer event landed outside `panel`. A modal <dialog>'s ::backdrop reports the
 * dialog itself as the target, and so does the dialog's own padding; only the point tells those
 * two apart, so a hit on the element itself is judged by its border box.
 */
export function isPointerOutside(
  panel: Element,
  event: Pick<MouseEvent, "target" | "clientX" | "clientY">,
  inside: readonly Element[] = [],
): boolean {
  const target = event.target;
  if (!(target instanceof Node)) return false;
  if (inside.some((element) => element.contains(target))) return false;
  if (target === panel) {
    const box = panel.getBoundingClientRect();
    return (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    );
  }
  return !panel.contains(target);
}

/** Wire the X, a press outside, and Escape to one `onDismiss`. See the file comment. */
export function makeDismissible(panel: HTMLElement, options: DismissOptions): void {
  const { onDismiss, signal } = options;
  const inside = options.inside ?? [];
  const isOpen = options.isOpen ?? (() => defaultIsOpen(panel));
  const listen = { signal, capture: true } as const;
  // The pointer that pressed outside while the panel was open, or null.
  let armed: number | null = null;

  options.closeButton?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      onDismiss("close-button");
    },
    { signal },
  );

  const doc = panel.ownerDocument;
  doc.addEventListener(
    "pointerdown",
    (event) => {
      armed =
        event.isPrimary && event.button === 0 && isOpen() && isPointerOutside(panel, event, inside)
          ? event.pointerId
          : null;
    },
    listen,
  );
  doc.addEventListener(
    "pointerup",
    (event) => {
      if (armed !== event.pointerId) {
        armed = null;
        return;
      }
      // A modal waits for its backdrop's click; see the file comment.
      if (isModal(panel)) return;
      armed = null;
      if (isOpen() && isPointerOutside(panel, event, inside)) onDismiss("outside");
    },
    listen,
  );
  if (panel instanceof HTMLDialogElement) {
    panel.addEventListener(
      "click",
      (event) => {
        const pressed = armed;
        armed = null;
        if (pressed === null || !isModal(panel)) return;
        if (isPointerOutside(panel, event, inside)) onDismiss("outside");
      },
      { signal },
    );
  }
  // A scroll or a pinch takes the pointer away from the page: that was not a tap.
  doc.addEventListener(
    "pointercancel",
    () => {
      armed = null;
    },
    listen,
  );

  if (options.escape === false) return;
  if (panel instanceof HTMLDialogElement) {
    panel.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        onDismiss("escape");
      },
      { signal },
    );
  } else {
    doc.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape" || event.isComposing || event.defaultPrevented || !isOpen())
          return;
        event.preventDefault();
        onDismiss("escape");
      },
      { signal },
    );
  }
}
