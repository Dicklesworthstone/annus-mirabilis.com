import assert from "node:assert/strict";
import test from "node:test";
import { createSearchEngine, SEARCH_TYPES } from "./core.ts";
import { EMPTY_SEARCH, readSearchLocation, searchResultsHref } from "./searchLocation.ts";

test("shared searches retain exact query spelling and every filter without an HTTP query", () => {
  for (const query of [
    '"Daß Wärme"',
    "βν = 6 × 10²³",
    "x′ & x' + 100% # ? /",
    "line one\nline two",
    "🧪".repeat(128),
  ]) {
    const state = { query, paper: "brownian-motion", type: "sentence-de" };
    const href = searchResultsHref(state);
    assert.ok(href);
    const url = new URL(href, "https://example.test");
    assert.equal(url.pathname, "/search/results/");
    assert.equal(url.search, "");
    assert.deepEqual(readSearchLocation(url.hash), state);
  }
});

test("empty searches and filter-only links round-trip", () => {
  assert.deepEqual(readSearchLocation(""), EMPTY_SEARCH);
  assert.deepEqual(readSearchLocation("#"), EMPTY_SEARCH);
  assert.equal(searchResultsHref(EMPTY_SEARCH), "/search/results/");
  const state = { query: "", paper: "cross-paper", type: "" };
  assert.deepEqual(
    readSearchLocation(new URL(searchResultsHref(state), "https://example.test").hash),
    state,
  );
});

test("all admitted result kinds survive sharing; a new kind cannot be silently dropped", () => {
  for (const type of SEARCH_TYPES) {
    const state = { query: "light", paper: "", type };
    const href = searchResultsHref(state);
    assert.deepEqual(readSearchLocation(new URL(href, "https://example.test").hash), state);
  }
});

test("duplicate, unknown and invalid filters are refused rather than changed to all results", () => {
  for (const hash of [
    "#q=one&q=two",
    "#type=paper&type=equation",
    "#paper=a&paper=b",
    "#q=light&type=secret",
    "#q=light&next=https://example.test",
    "#paper=../admin",
  ])
    assert.equal(readSearchLocation(hash), null, hash);
  assert.deepEqual(readSearchLocation("#paper="), EMPTY_SEARCH);
});

test("query boundaries, malformed Unicode and control characters have no lossy restore", () => {
  for (const hash of [
    "?q=light",
    "#q=%E0%A4%A",
    "#q=%FF",
    "#q=%00",
    "#q=%7F",
    `#q=${"a".repeat(257)}`,
    `#${"a".repeat(4096)}`,
  ]) {
    assert.equal(readSearchLocation(hash), null, hash.slice(0, 80));
  }
  for (const query of ["\uD800", "\uDC00", "before\uDFFFafter"]) {
    assert.equal(searchResultsHref({ query, paper: "", type: "" }), null);
    assert.equal(readSearchLocation(`#q=${query}`), null);
  }
  assert.equal(searchResultsHref({ query: "a".repeat(257), paper: "", type: "" }), null);
  assert.equal(searchResultsHref({ query: "x", paper: "../admin", type: "" }), null);
  const state = { query: "a".repeat(256), paper: "", type: "" };
  assert.deepEqual(
    readSearchLocation(new URL(searchResultsHref(state), "https://example.test").hash),
    state,
  );
});

test("restoring a link reproduces the actual engine's filtered, quoted results", () => {
  const base = {
    title: "Test passage",
    text: "Mean square displacement",
    type: "argument",
    paper: "brownian-motion",
    section: "s5",
    lang: "en",
    terms: [],
    route: "/papers/brownian-motion/",
    anchor: "",
    face: "reading",
    scopeLabel: "Test prose",
  };
  const engine = createSearchEngine([
    { ...base, id: "target" },
    { ...base, id: "other-paper", paper: "light-quanta" },
    { ...base, id: "other-type", type: "equation" },
    { ...base, id: "other-order", text: "Square of the mean displacement" },
  ]);
  const criteria = { query: '"mean square"', paper: "brownian-motion", type: "argument" };
  const restored = readSearchLocation(
    new URL(searchResultsHref(criteria), "https://example.test").hash,
  );
  const options = { paper: restored.paper, type: restored.type };
  assert.deepEqual(
    engine.search(restored.query, options).map((hit) => hit.document.id),
    ["target"],
  );
});
