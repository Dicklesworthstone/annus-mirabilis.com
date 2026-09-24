/**
 * The reader's passage stays where it stood while the page changes around it (holdPlace.ts). The
 * test has no layout, so the window, the boxes and the resize observer are given; the real engines
 * were checked on a harness page (the bead comment on am-read-detail-axis-sfc names the numbers).
 */
import { describe, expect, test } from "bun:test";
import { createPlaceHold, HOLD_MS, readingPlace } from "./holdPlace.ts";

const el = (id: string) => ({ id, isConnected: true }) as unknown as Element;

/** A window that scrolls a page of passages: each passage's top is its offset less scrollY. */
function page(offsets: Map<Element, { at: number; height: number }>) {
  const listeners = new Map<string, EventListener>();
  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  let observed: (() => void) | null = null;
  const html = { style: { overflowAnchor: "" } };
  const win = {
    innerHeight: 900,
    scrollY: 0,
    scrollBy(options: ScrollToOptions) {
      win.scrollY += options.top ?? 0;
    },
    setTimeout(callback: () => void) {
      timers.set(nextTimer, callback);
      return nextTimer++;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
    addEventListener(type: string, listener: EventListener) {
      listeners.set(type, listener);
    },
    removeEventListener(type: string) {
      listeners.delete(type);
    },
    document: { documentElement: html },
  };
  class Observer {
    constructor(callback: () => void) {
      observed = callback;
    }
    observe() {}
    disconnect() {}
  }
  const rectOf = (e: Element) => {
    const box = offsets.get(e) ?? { at: 0, height: 0 };
    return { top: box.at - win.scrollY, bottom: box.at + box.height - win.scrollY };
  };
  const hold = createPlaceHold({} as Element, {
    win: win as unknown as Window & typeof globalThis,
    rectOf,
    Observer: Observer as unknown as typeof ResizeObserver,
  });
  return {
    win,
    html,
    hold,
    rectOf,
    listeners,
    /** The page reflowed: the observer is told, as a real ResizeObserver would be. */
    reflow: () => observed?.(),
    runTimers: () => {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
  };
}

describe("readingPlace", () => {
  test("is the passage at the reading line, not a sliver of the one above it", () => {
    const [a11, a12, a13] = [el("a11"), el("a12"), el("a13")];
    const boxes = new Map([
      [a11, { top: -781, bottom: 69 }],
      [a12, { top: 69, bottom: 919 }],
      [a13, { top: 919, bottom: 1769 }],
    ]);
    const place = readingPlace([a11, a12, a13], 900, (e) => boxes.get(e) ?? { top: 0, bottom: 0 });
    expect(place).toEqual({ passage: a12, top: 69 });
  });

  test("is the passage the reader is deep inside when it fills the viewport", () => {
    const [a, b] = [el("a"), el("b")];
    const boxes = new Map([
      [a, { top: -3000, bottom: 1200 }],
      [b, { top: 1200, bottom: 2000 }],
    ]);
    expect(readingPlace([a, b], 900, (e) => boxes.get(e) ?? { top: 0, bottom: 0 })).toEqual({
      passage: a,
      top: -3000,
    });
  });

  test("is nothing when no passage reaches the reading line", () => {
    const a = el("a");
    expect(readingPlace([a], 900, () => ({ top: 500, bottom: 900 }))).toBeNull();
    expect(readingPlace([], 900)).toBeNull();
  });
});

describe("createPlaceHold", () => {
  test("puts the passage back at once and after every reflow, with the browser's anchoring off", () => {
    const passage = el("a12");
    const offsets = new Map([[passage, { at: 10_000, height: 850 }]]);
    const p = page(offsets);
    p.win.scrollY = 10_000 - 69;
    p.hold.hold({ passage, top: 69 });
    expect(p.html.style.overflowAnchor).toBe("none");

    offsets.set(passage, { at: 1_600, height: 150 }); // the readings above it swapped
    p.reflow();
    expect(p.rectOf(passage).top).toBe(69);

    offsets.set(passage, { at: 16_000, height: 1_450 }); // their steps arrived
    p.reflow();
    expect(p.rectOf(passage).top).toBe(69);
  });

  test("lets go when the reader scrolls, presses a key or touches the page", () => {
    for (const move of ["wheel", "keydown", "touchstart", "mousedown"]) {
      const passage = el("a12");
      const offsets = new Map([[passage, { at: 10_000, height: 850 }]]);
      const p = page(offsets);
      p.win.scrollY = 10_000 - 69;
      p.hold.hold({ passage, top: 69 });
      p.listeners.get(move)?.(new Event(move));
      expect(p.hold.active()).toBe(false);
      expect(p.html.style.overflowAnchor).toBe("");

      offsets.set(passage, { at: 16_000, height: 1_450 });
      p.reflow();
      expect(p.rectOf(passage).top).toBe(16_000 - (10_000 - 69));
    }
  });

  test("lets go once the page has been still for HOLD_MS, and restores the anchoring it found", () => {
    const passage = el("a12");
    const p = page(new Map([[passage, { at: 10_000, height: 850 }]]));
    p.html.style.overflowAnchor = "auto";
    p.hold.hold({ passage, top: 69 });
    expect(HOLD_MS).toBeGreaterThan(0);
    p.runTimers();
    expect(p.hold.active()).toBe(false);
    expect(p.html.style.overflowAnchor).toBe("auto");
  });

  test("across takes the place before the change and keeps it after", () => {
    const [above, reading] = [el("above"), el("reading")];
    const offsets = new Map([
      [above, { at: 0, height: 900 }],
      [reading, { at: 900, height: 900 }],
    ]);
    const p = page(offsets);
    p.win.scrollY = 900 - 40;
    p.hold.across(
      () => readingPlace([above, reading], 900, p.rectOf),
      () => {
        offsets.set(above, { at: 0, height: 2_200 });
        offsets.set(reading, { at: 2_200, height: 900 });
      },
    );
    expect(p.rectOf(reading).top).toBe(40);
    expect(p.hold.active()).toBe(true);
  });

  test("across with no passage in view changes the page and holds nothing", () => {
    const p = page(new Map());
    let changed = false;
    p.hold.across(
      () => null,
      () => {
        changed = true;
      },
    );
    expect(changed).toBe(true);
    expect(p.hold.active()).toBe(false);
    expect(p.html.style.overflowAnchor).toBe("");
  });

  test("a passage that left the page ends the hold instead of scrolling to nothing", () => {
    const passage = { id: "gone", isConnected: true } as { id: string; isConnected: boolean };
    const p = page(new Map([[passage as unknown as Element, { at: 500, height: 300 }]]));
    p.hold.hold({ passage: passage as unknown as Element, top: 69 });
    const y = p.win.scrollY;
    passage.isConnected = false;
    p.reflow();
    expect(p.hold.active()).toBe(false);
    expect(p.win.scrollY).toBe(y);
  });
});
