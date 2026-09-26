/**
 * Inline formulas as targets (dispatch 272): on a reading face, pointing at a coloured glyph in an
 * inline formula lights every copy of its quantity on the page, inline and in the displays, and
 * only in its own paper; pressing it pins the quantity, a second press or Escape clears it. The
 * controller is driven with native events on a happy-dom page, as the face's markup is served.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { attachInlineLighting, type InlinePin } from "./InlineTermLighting.tsx";

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
