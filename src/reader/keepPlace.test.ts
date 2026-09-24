/**
 * A face switch keeps the reader's place (keepPlace.ts). The test DOM has no layout, so the
 * boxes are given; the numbers are the ones measured on live 01478983 at 1280x800, where
 * arg-lq-fixed-band-volume is 1,613px tall on the reading face and 899px on Results.
 */
import { describe, expect, test } from "bun:test";
import { placeOf, scrollToKeep } from "./keepPlace.ts";

const VIEWPORT = 800;
const el = (id: string) => ({ id }) as unknown as Element;
const boxes = (map: Map<Element, { top: number; bottom: number }>) => (e: Element) =>
  map.get(e) ?? { top: 0, bottom: 0 };

describe("placeOf", () => {
  test("is the first passage that reaches into the viewport", () => {
    const [a, b, c] = [el("a"), el("b"), el("c")];
    const rects = new Map([
      [a, { top: -3000, bottom: -1200 }],
      [b, { top: -1605, bottom: 8 }],
      [c, { top: 8, bottom: 900 }],
    ]);
    expect(placeOf([a, b, c], VIEWPORT, boxes(rects))).toEqual({ passage: b, top: -1605 });
  });

  test("is nothing when no passage is on screen, and never a passage with no box", () => {
    const [a, b] = [el("a"), el("b")];
    const rects = new Map([
      [a, { top: 900, bottom: 1500 }],
      [b, { top: 100, bottom: 100 }],
    ]);
    expect(placeOf([a, b], VIEWPORT, boxes(rects))).toBeNull();
  });
});

describe("scrollToKeep", () => {
  const passage = el("arg-lq-fixed-band-volume");

  test("puts a passage back where it stood", () => {
    // Reading -> Results moved this passage from -556 to 77; it goes back to -556.
    const moved = new Map([[passage, { top: 77, bottom: 77 + 1613 }]]);
    expect(scrollToKeep({ passage, top: -556 }, VIEWPORT, boxes(moved))).toBe(77 - -556);
  });

  test("a passage that started on screen keeps its exact top", () => {
    const moved = new Map([[passage, { top: 300, bottom: 400 }]]);
    expect(scrollToKeep({ passage, top: 120 }, VIEWPORT, boxes(moved))).toBe(300 - 120);
  });

  test("a reader deep in a passage the new face shortens still sees 30% of a screen of it", () => {
    // 1,605px into a 1,613px passage; on Results it is 899px, so -1605 would leave none on screen.
    const shortened = new Map([[passage, { top: -1605, bottom: -1605 + 899 }]]);
    const delta = scrollToKeep({ passage, top: -1605 }, VIEWPORT, boxes(shortened));
    const topAfter = -1605 - delta;
    expect(topAfter + 899).toBeCloseTo(0.3 * VIEWPORT, 6);
    // And its top never comes below the viewport's top edge for a passage that began above it.
    const tiny = new Map([[passage, { top: -1605, bottom: -1605 + 100 }]]);
    expect(-1605 - scrollToKeep({ passage, top: -1605 }, VIEWPORT, boxes(tiny))).toBe(0);
  });

  test("a passage with no box is not scrolled to", () => {
    const gone = new Map([[passage, { top: 0, bottom: 0 }]]);
    expect(scrollToKeep({ passage, top: -200 }, VIEWPORT, boxes(gone))).toBe(0);
  });
});
