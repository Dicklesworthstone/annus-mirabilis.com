/**
 * Inline formulas as targets (dispatch 272): on a reading face, pointing at a coloured glyph in an
 * inline formula lights every copy of its quantity on the page, inline and in the displays, and
 * only in its own paper; pressing it pins the quantity, a second press or Escape clears it. The
 * controller is driven with native events on a happy-dom page, as the face's markup is served.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { attachInlineLighting, type InlinePin, InlineTermLighting } from "./InlineTermLighting.tsx";

const PAGE = `
<main>
  <p>Die Energie <span class="inline-math" data-paper="mass-energy" data-inline-terms=""><span class="katex"><span class="katex-html"><span data-term="i1" data-quantity-id="speedOfLight" id="inline-V">V</span> und <span data-term="i2" data-quantity-id="frameSpeed" id="inline-v">v</span></span></span></span> und
  <span class="inline-math" data-paper="mass-energy" data-inline-terms=""><span class="katex"><span data-term="i1" data-quantity-id="speedOfLight" id="inline-V2">V</span></span></span>.</p>
  <span class="printed-display-terms" data-paper="mass-energy"><span class="katex"><span data-term="me.eq.t1" data-quantity-id="speedOfLight" id="display-V">V</span></span></span>
  <span class="printed-display-terms" data-paper="special-relativity"><span class="katex"><span data-quantity-id="speedOfLight" id="other-paper-V">V</span></span></span>
  <p id="elsewhere">Text.</p>
</main>`;

const byId = (id: string) => document.getElementById(id) as HTMLElement;
const lit = () =>
  [...document.querySelectorAll("[data-lit]")].map((e) => e.id).sort((a, b) => (a < b ? -1 : 1));
const over = (id: string) =>
  byId(id).dispatchEvent(new Event("pointerover", { bubbles: true, cancelable: true }));
const click = (id: string) =>
  byId(id).dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

describe("the inline lighting controller", () => {
  let pins: (InlinePin | null)[] = [];
  let detach: () => void = () => {};
  beforeEach(async () => {
    await installDom();
    document.body.innerHTML = PAGE;
    pins = [];
    detach = attachInlineLighting(document.querySelector("main") as Element, "mass-energy", (p) =>
      pins.push(p),
    );
  });
  afterEach(async () => {
    detach();
    await uninstallDom();
  });

  test("pointing at an inline glyph lights every copy of its quantity in its paper, and nothing else", () => {
    over("inline-V");
    expect(lit()).toEqual(["display-V", "inline-V", "inline-V2"]);
    // Moving to another quantity moves the light; moving off a glyph clears it.
    over("inline-v");
    expect(lit()).toEqual(["inline-v"]);
    over("elsewhere");
    expect(lit()).toEqual([]);
  });

  test("a press pins the quantity, which stays lit until a second press or Escape", () => {
    click("inline-V");
    expect(pins.at(-1)?.quantityId).toBe("speedOfLight");
    expect(pins.at(-1)?.formula.classList.contains("inline-math")).toBe(true);
    over("elsewhere");
    expect(lit()).toEqual(["display-V", "inline-V", "inline-V2"]);
    click("inline-V");
    expect(pins.at(-1)).toBeNull();
    expect(lit()).toEqual([]);
    click("inline-v");
    expect(lit()).toEqual(["inline-v"]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(pins.at(-1)).toBeNull();
    expect(lit()).toEqual([]);
  });

  test("a display's own glyphs are left to its block, and a press elsewhere clears a pin", () => {
    over("display-V");
    expect(lit()).toEqual([]);
    click("inline-V");
    click("elsewhere");
    expect(pins.at(-1)).toBeNull();
    expect(lit()).toEqual([]);
  });

  test("detaching stops the listening and clears what it lit", () => {
    over("inline-V");
    detach();
    detach = () => {};
    expect(lit()).toEqual([]);
    over("inline-v");
    expect(lit()).toEqual([]);
  });
});

/**
 * LABELS (dispatch 280, step 1b; the owner: "all must have the nice hover-over effects"). A letter
 * the notation declares no quantity is marked data-label: pointing at it lights every copy of the
 * same label, the same reading in the same section, and nothing else; pressing it pins a note.
 */
const LABELS = `
<main>
  <p>Im Punkte <span class="inline-math" data-paper="special-relativity" data-inline-labels=""><span class="katex"><span class="katex-html"><span data-term="l1" data-label="L1" id="point-A">A</span></span></span></span>
  und <span class="inline-math" data-paper="special-relativity" data-inline-labels=""><span class="katex"><span class="katex-html"><span data-term="l1" data-label="L2" id="point-B">B</span></span></span></span>,
  wieder <span class="inline-math" data-paper="special-relativity" data-inline-labels=""><span class="katex"><span class="katex-html"><span data-term="l1" data-label="L1" id="point-A2">A</span></span></span></span>,
  mit <span class="inline-math" data-paper="special-relativity" data-inline-terms=""><span class="katex"><span class="katex-html"><span data-term="i1" data-quantity-id="speedOfLight" id="speed-V">V</span></span></span></span>.</p>
  <p>Im § 7 <span class="inline-math" data-paper="special-relativity" data-inline-labels=""><span class="katex"><span class="katex-html"><span data-term="l1" data-label="L9" id="other-A">A</span></span></span></span>
  und <span class="inline-math" data-paper="light-quanta" data-inline-labels=""><span class="katex"><span class="katex-html"><span data-term="l1" data-label="L1" id="lq-L1">x</span></span></span></span>.</p>
  <p id="elsewhere">Text.</p>
</main>`;

describe("labels in the inline lighting", () => {
  let pins: (InlinePin | null)[] = [];
  let detach: () => void = () => {};
  beforeEach(async () => {
    await installDom();
    document.body.innerHTML = LABELS;
    pins = [];
    detach = attachInlineLighting(
      document.querySelector("main") as Element,
      "special-relativity",
      (p) => pins.push(p),
    );
  });
  afterEach(async () => {
    detach();
    await uninstallDom();
  });

  test("pointing at a label lights every copy of that label in its paper, and nothing else", () => {
    over("point-A");
    // Not B, not § 7's A (another label), not light quanta's L1, not a quantity.
    expect(lit()).toEqual(["point-A", "point-A2"]);
    over("point-B");
    expect(lit()).toEqual(["point-B"]);
    over("speed-V");
    expect(lit()).toEqual(["speed-V"]);
    over("elsewhere");
    expect(lit()).toEqual([]);
  });

  test("a press pins the label, which stays lit until a second press or Escape", () => {
    click("point-A");
    expect(pins.at(-1)?.labelId).toBe("L1");
    expect(pins.at(-1)?.quantityId).toBeUndefined();
    over("elsewhere");
    expect(lit()).toEqual(["point-A", "point-A2"]);
    click("point-A");
    expect(pins.at(-1)).toBeNull();
    click("point-B");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(pins.at(-1)).toBeNull();
    expect(lit()).toEqual([]);
  });

  test("a label and a quantity never share a pin: pressing the quantity moves it", () => {
    click("point-A");
    click("speed-V");
    expect(pins.at(-1)?.quantityId).toBe("speedOfLight");
    expect(pins.at(-1)?.labelId).toBeUndefined();
    expect(lit()).toEqual(["speed-V"]);
  });
});

describe("the island shows a pinned label's note after its formula", () => {
  beforeEach(async () => {
    await installDom();
    document.body.innerHTML = LABELS;
  });
  afterEach(async () => {
    await uninstallDom();
  });

  test("the note names what the letter names, and closes with the pin", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <InlineTermLighting
          paper="special-relativity"
          quantities={{}}
          labels={{
            L1: "A point of the stationary system where a clock stands, the first of the clocks compared.",
          }}
        />,
      ),
    );
    await act(async () => click("point-A"));
    const note = document.querySelector("[data-inline-inspector] .inline-label-note");
    expect(note?.querySelector("strong")?.textContent).toBe(
      "A point of the stationary system where a clock stands, the first of the clocks compared.",
    );
    // It stands just after the formula pressed, inside the sentence.
    expect(
      byId("point-A")
        .closest(".inline-math")
        ?.nextElementSibling?.hasAttribute("data-inline-inspector"),
    ).toBe(true);
    await act(async () => click("point-A"));
    expect(document.querySelector("[data-inline-inspector]")).toBeNull();
    await act(async () => root.unmount());
  });
});

/**
 * A CHIP IS A TARGET TOO (dispatch 290). Pointing at a glyph already lit every copy of its
 * quantity, chips included; pointing at a chip lit only its own block. The island now lights the
 * copies outside that block and leaves the ones inside it to the block's own controller, so no
 * element has two owners.
 */
const CHIPS = `
<main>
  <p>Die Energie <span class="inline-math" data-paper="mass-energy" data-inline-terms=""><span class="katex"><span class="katex-html"><span data-term="i1" data-quantity-id="speedOfLight" id="page-V">V</span></span></span></span>.</p>
  <span class="printed-display-terms" data-paper="mass-energy" data-display-terms="eq-s0-d1">
    <span class="katex"><span data-term="t1" data-quantity-id="speedOfLight" id="own-display-V">V</span></span>
    <span class="term-chips"><button class="term-chip" data-quantity-id="speedOfLight" id="own-chip" style="--qc: var(--q-0)"><span class="equation-legend-glyph" id="own-chip-glyph">V</span></button></span>
  </span>
  <span class="printed-display-terms" data-paper="mass-energy" data-display-terms="eq-s0-d2">
    <span class="katex"><span data-term="t1" data-quantity-id="speedOfLight" id="other-display-V">V</span></span>
    <span class="term-chips"><button class="term-chip" data-quantity-id="speedOfLight" id="other-chip" style="--qc: var(--q-0)">V</button></span>
  </span>
  <span class="printed-display-terms" data-paper="special-relativity" data-display-terms="eq-s3-d1">
    <span class="term-chips"><button class="term-chip" data-quantity-id="speedOfLight" id="other-paper-chip">V</button></span>
  </span>
  <p id="away">Text.</p>
</main>`;

describe("a chip lights the page, and leaves its own block to its own controller", () => {
  let detach: () => void = () => {};
  beforeEach(async () => {
    await installDom();
    document.body.innerHTML = CHIPS;
    detach = attachInlineLighting(
      document.querySelector("main") as Element,
      "mass-energy",
      () => {},
    );
  });
  afterEach(async () => {
    detach();
    await uninstallDom();
  });

  test("pointing at a chip lights every copy outside its block, in its paper only", () => {
    over("own-chip");
    // Not own-chip or own-display-V: the block that holds them lights those itself. Not the
    // other paper's chip.
    expect(lit()).toEqual(["other-chip", "other-display-V", "page-V"]);
  });

  test("pointing at the glyph inside a chip counts as the chip", () => {
    over("own-chip-glyph");
    expect(lit()).toEqual(["other-chip", "other-display-V", "page-V"]);
  });

  test("pointing at a formula glyph still lights every copy, chips included", () => {
    over("page-V");
    // Nothing is held back here: no block owns the pointer, so the island lights them all.
    expect(lit()).toEqual(["other-chip", "other-display-V", "own-chip", "own-display-V", "page-V"]);
  });

  test("moving off clears what the island lit, and a chip press is left to the block", () => {
    over("own-chip");
    expect(lit().length).toBe(3);
    over("away");
    expect(lit()).toEqual([]);
    // The island pins formulas, not chips: a chip has its own inspector under its own formula.
    let pinned: unknown = "unset";
    detach();
    detach = attachInlineLighting(document.querySelector("main") as Element, "mass-energy", (p) => {
      pinned = p;
    });
    click("own-chip");
    expect(pinned).toBe("unset");
  });
});
