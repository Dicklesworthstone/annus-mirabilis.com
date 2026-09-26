/**
 * AN OPEN NOTE STAYS ON THE SCREEN (dispatch 265).
 *
 * A note opened beside a word is anchored at the word's left edge (reader.css
 * .term-annotation-popover: left 0, 16rem to 24rem wide). At 390px, 8 of the 30 period-word notes
 * of the four German faces opened past the right edge, and the page scrolled sideways by up to
 * 121px (measured by real clicks on a build of 7f464ab8). keepNoteInView moves an open note back
 * inside the viewport, and narrows it first when the viewport is narrower than the note.
 *
 * happy-dom lays nothing out, so each note's box is modelled here: it stands where the stylesheet
 * anchors it, as wide as its content up to the max-width it is given and no narrower than its
 * min-width, moved by any translate it carries. The helper reads only that box and the viewport's
 * width, so the arithmetic under test is the one a browser feeds it; the browser measurement is in
 * the commit that uses it.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { keepNoteInView } from "./keepNoteInView.ts";

/** A note at `left`, `natural` px wide by its content, min 256 (16rem), in a viewport `width` wide. */
function note(width: number, left: number, natural: number) {
  const window = new Window({ width, height: 800 });
  const document = window.document as unknown as Document;
  const panel = document.createElement("span");
  document.body.append(panel);
  panel.getBoundingClientRect = () => {
    const max = panel.style.maxWidth ? Number.parseFloat(panel.style.maxWidth) : 384;
    const min = panel.style.minWidth === "0" ? 0 : 256;
    const w = Math.max(min, Math.min(natural, max));
    // A browser's box includes the note's own translate, as this one does.
    const x = left + (Number.parseFloat(panel.style.translate) || 0);
    return {
      left: x,
      right: x + w,
      width: w,
      top: 0,
      bottom: 100,
      height: 100,
      x,
      y: 0,
    } as DOMRect;
  };
  return panel;
}

describe("keepNoteInView (dispatch 265)", () => {
  test("a note that fits is left where the stylesheet put it", () => {
    const panel = note(1440, 600, 300);
    keepNoteInView(panel);
    expect(panel.style.translate).toBe("");
    expect(panel.style.maxWidth).toBe("");
  });

  test("a note past the right edge moves left until it ends inside the gutter", () => {
    // mass-energy's "Lichtmenge" at 390: the note ran 255..511.
    const panel = note(390, 255, 256);
    keepNoteInView(panel);
    expect(panel.style.translate).toBe("-129px 0");
    // The note's right edge after the move: 511 - 129 = 382, 8px inside 390.
    expect(255 + 256 - 129).toBe(390 - 8);
  });

  test("a note past the left edge moves right", () => {
    const panel = note(390, 2, 256);
    keepNoteInView(panel);
    expect(panel.style.translate).toBe("6px 0");
  });

  test("a note wider than the viewport is narrowed to it, then placed inside the gutters", () => {
    const panel = note(300, 40, 384);
    keepNoteInView(panel);
    expect(panel.style.maxWidth).toBe("284px");
    expect(panel.style.minWidth).toBe("0");
    // 40 + 284 = 324 > 292: moved left by 32, to start at the gutter.
    expect(panel.style.translate).toBe("-32px 0");
  });

  test("placing a note again starts from the stylesheet, not from the last placement", () => {
    const panel = note(390, 255, 256);
    keepNoteInView(panel);
    keepNoteInView(panel);
    expect(panel.style.translate).toBe("-129px 0");
  });
});
