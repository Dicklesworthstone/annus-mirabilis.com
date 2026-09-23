import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_EMBED_OPTIONS } from "./contract.ts";
import { installEmbedPresentation } from "./presentation.ts";

function environment(initial = {}, dark = false, reduced = false) {
  const attributes = new Map(Object.entries(initial));
  const root = {
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
  };
  function media(matches) {
    const listeners = new Set();
    return {
      matches,
      listeners,
      addEventListener: (_, callback) => listeners.add(callback),
      removeEventListener: (_, callback) => listeners.delete(callback),
      change(value) {
        this.matches = value;
        for (const callback of listeners) callback();
      },
    };
  }
  const colour = media(dark);
  const motion = media(reduced);
  return {
    root,
    attributes,
    colour,
    motion,
    matchMedia: (query) => (query.includes("color-scheme") ? colour : motion),
  };
}

test("system presentation tracks both device preferences", () => {
  const e = environment();
  const stop = installEmbedPresentation(e.root, DEFAULT_EMBED_OPTIONS, e.matchMedia);
  assert.equal(e.root.getAttribute("data-theme"), "annalen");
  assert.equal(e.root.getAttribute("data-embed-motion"), "system");
  e.colour.change(true);
  e.motion.change(true);
  assert.equal(e.root.getAttribute("data-theme"), "kramgasse-night");
  assert.equal(e.root.getAttribute("data-embed-motion"), "reduce");
  e.colour.change(false);
  e.motion.change(false);
  assert.equal(e.root.getAttribute("data-theme"), "annalen");
  assert.equal(e.root.getAttribute("data-embed-motion"), "system");
  stop();
});
for (const [theme, expected] of [
  ["light", "annalen"],
  ["dark", "kramgasse-night"],
]) {
  test(`explicit ${theme} does not change with the device theme`, () => {
    const e = environment();
    const stop = installEmbedPresentation(
      e.root,
      { ...DEFAULT_EMBED_OPTIONS, theme },
      e.matchMedia,
    );
    e.colour.change(true);
    assert.equal(e.root.getAttribute("data-theme"), expected);
    e.colour.change(false);
    assert.equal(e.root.getAttribute("data-theme"), expected);
    stop();
  });
}
test("explicit reduction remains enabled even if the OS does not request it", () => {
  const e = environment();
  const stop = installEmbedPresentation(
    e.root,
    { ...DEFAULT_EMBED_OPTIONS, motion: "reduce" },
    e.matchMedia,
  );
  e.motion.change(true);
  e.motion.change(false);
  assert.equal(e.root.getAttribute("data-embed-motion"), "reduce");
  stop();
});
test("system mode cannot override the OS reduction preference", () => {
  const e = environment({}, false, true);
  const stop = installEmbedPresentation(e.root, DEFAULT_EMBED_OPTIONS, e.matchMedia);
  assert.equal(e.root.getAttribute("data-embed-motion"), "reduce");
  stop();
});
test("cleanup restores previous attributes and detaches all listeners", () => {
  const before = { "data-theme": "kramgasse-night", "data-reader-detail": "full" };
  const e = environment(before);
  const stop = installEmbedPresentation(
    e.root,
    { ...DEFAULT_EMBED_OPTIONS, theme: "light" },
    e.matchMedia,
  );
  stop();
  assert.deepEqual(Object.fromEntries(e.attributes), before);
  assert.equal(e.colour.listeners.size, 0);
  assert.equal(e.motion.listeners.size, 0);
  e.colour.change(true);
  assert.deepEqual(Object.fromEntries(e.attributes), before);
});
test("cleanup does not clobber a later explicit setting from another owner", () => {
  const e = environment({ "data-theme": "annalen" });
  const stop = installEmbedPresentation(e.root, DEFAULT_EMBED_OPTIONS, e.matchMedia);
  e.root.setAttribute("data-theme", "kramgasse-night");
  stop();
  assert.equal(e.root.getAttribute("data-theme"), "kramgasse-night");
});
test("two frame documents are independent", () => {
  const left = environment();
  const right = environment();
  const stopLeft = installEmbedPresentation(
    left.root,
    { ...DEFAULT_EMBED_OPTIONS, theme: "dark" },
    left.matchMedia,
  );
  const stopRight = installEmbedPresentation(
    right.root,
    { ...DEFAULT_EMBED_OPTIONS, theme: "light" },
    right.matchMedia,
  );
  assert.equal(left.root.getAttribute("data-theme"), "kramgasse-night");
  assert.equal(right.root.getAttribute("data-theme"), "annalen");
  stopLeft();
  assert.equal(right.root.getAttribute("data-theme"), "annalen");
  stopRight();
});
