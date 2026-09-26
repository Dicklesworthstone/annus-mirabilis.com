/**
 * AN OPEN NOTE STAYS ON THE SCREEN (dispatch 265).
 *
 * A note opened beside a word is anchored at the word's left edge (reader.css
 * .term-annotation-popover: left 0, 16rem to 24rem wide). A word near the right edge of a phone's
 * column put its note past the screen, and the page scrolled sideways: at 390px, 8 of the 30
 * period-word notes of the four German faces, by up to 121px. This moves an open note back inside
 * the viewport, less a gutter, and narrows it first when the viewport is narrower than the note. A
 * note that fits stays where the stylesheet put it, and each placement starts from the stylesheet,
 * so reopening a note, or opening it after a rotation, never compounds an earlier move.
 */
export function keepNoteInView(panel: HTMLElement, gutter = 8): void {
  panel.style.translate = "";
  panel.style.minWidth = "";
  panel.style.maxWidth = "";
  const root = panel.ownerDocument.documentElement;
  const viewport = root.clientWidth || panel.ownerDocument.defaultView?.innerWidth || 0;
  if (viewport === 0) return;
  const available = viewport - 2 * gutter;
  if (panel.getBoundingClientRect().width > available) {
    panel.style.minWidth = "0";
    panel.style.maxWidth = `${available}px`;
  }
  const { left, right } = panel.getBoundingClientRect();
  const shift =
    right > viewport - gutter ? viewport - gutter - right : left < gutter ? gutter - left : 0;
  if (shift !== 0) panel.style.translate = `${Math.round(shift)}px 0`;
}
