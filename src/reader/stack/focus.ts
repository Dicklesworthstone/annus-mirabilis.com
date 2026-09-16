/**
 * am-read-return-stack-oxa. Focus movement and return: on open, focus moves to the opened
 * clarification's heading; on return, focus (and scroll) go back to the originating control, or
 * the passage anchor when there is no origin control (a direct link, or a trigger element that no
 * longer exists). Generalized from src/reader/ReaderController.tsx's proven focusReturn /
 * restoreFocus, taking Document/Window/elements as parameters instead of reaching for globals, so
 * this module is unit-testable with happy-dom with no reader shell mounted.
 */
import type { StackFrame } from "./stackStore.ts";

export type FocusReturnTarget = Readonly<{
  element: HTMLElement;
  relativeYFraction: number;
  isOrigin: boolean;
}>;

/** Finds where focus and scroll should land when returning from `frame`. Prefers the frame's own
 * trigger element if it is still present and visible (getClientRects().length > 0 -- an element
 * removed from the DOM, or hidden, reports none); falls back to the passage anchor otherwise. */
export function resolveFocusReturnTarget(
  doc: Document,
  frame: StackFrame | undefined,
  fallbackAnchorId: string,
): FocusReturnTarget | null {
  const origin = frame?.triggerId ? doc.getElementById(frame.triggerId) : null;
  if (frame && origin && origin.getClientRects().length > 0) {
    return Object.freeze({
      element: origin,
      relativeYFraction: frame.scrollFraction,
      isOrigin: true,
    });
  }
  const fallback = doc.getElementById(fallbackAnchorId);
  return fallback
    ? Object.freeze({ element: fallback, relativeYFraction: 0.15, isOrigin: false })
    : null;
}

/**
 * Moves focus to `target.element` and restores the scroll position it recorded, without the
 * browser's own smooth-scroll animation racing the programmatic jump. `scrollContainer` is passed
 * when the target lives inside an open dialog (the compass/clarification panel), which scrolls
 * its own box rather than the document.
 */
export function applyFocusReturn(
  win: Window,
  target: FocusReturnTarget,
  scrollContainer?: HTMLElement | null,
): void {
  target.element.focus({ preventScroll: true });
  const doc = target.element.ownerDocument;
  const root = doc.documentElement;
  const behavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  const delta =
    target.element.getBoundingClientRect().top - target.relativeYFraction * win.innerHeight;
  if (scrollContainer?.contains(target.element)) scrollContainer.scrollTop += delta;
  else win.scrollBy(0, delta);
  root.style.scrollBehavior = behavior;
}

/** Moves focus to the opened clarification's heading (the Access requirement for a push). A
 * no-op when the heading is not found or not focusable -- callers must not throw over a missing
 * heading, since that would leave a reader mid-navigation with no recovery. */
export function focusOpenedHeading(heading: HTMLElement | null): void {
  heading?.focus();
}
