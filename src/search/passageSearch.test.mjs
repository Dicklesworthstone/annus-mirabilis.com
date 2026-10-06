import assert from "node:assert/strict";
import test from "node:test";
import { createSearchEngine, SEARCH_LIMITS } from "./core.ts";

// Authored test prose, not a quotation attributed to the edition or historical evidence.
const doc = (id, text, patch = {}) => ({
  id, text, title: "Test passage", type: "argument", paper: "brownian-motion",
  section: "s5", lang: "en", terms: [], route: "/papers/brownian-motion/",
  anchor: id, face: "reading", scopeLabel: "Authored test passage", ...patch,
});
const ids = (engine, query, options) => engine.search(query, options).map((hit) => hit.document.id);

test("quoted passages require adjacent words in order, including stop words", () => {
  const engine = createSearchEngine([
    doc("exact", "The motion of a particle is irregular."),
    doc("reversed", "A particle is in motion."),
    doc("separated", "The motion observed for a particle is irregular."),
    doc("substring", "The motion of a particleswarm is irregular."),
  ]);
  assert.ok(ids(engine, "motion particle").includes("separated"));
  assert.deepEqual(ids(engine, '"motion of a particle"'), ["exact"]);
  assert.deepEqual(ids(engine, '“motion of a particle”'), ["exact"]);
  assert.deepEqual(ids(engine, '"motion a particle"'), []);
});

test("multiple quotations and unquoted terms are all required", () => {
  const engine = createSearchEngine([
    doc("both", "Mean square displacement and independent steps describe diffusion."),
    doc("one", "Mean square displacement. Steps need not be independent. Diffusion."),
    doc("missing", "Mean square displacement and independent steps."),
  ]);
  assert.deepEqual(ids(engine, '"mean square" "independent steps" diffusion'), ["both"]);
  assert.deepEqual(ids(engine, '"independent steps" diffusion', { paper: "light-quanta" }), []);
});

test("a phrase cannot cross fields, separate terms, or be supplied by an alias", () => {
  const engine = createSearchEngine([
    doc("body", "Mean square displacement."),
    doc("title", "Unrelated text.", { title: "Mean square displacement" }),
    doc("cross-field", "square displacement", { title: "Mean" }),
    doc("cross-term", "Unrelated text.", { terms: ["mean", "square"] }),
    doc("alias-only", "An unrelated sentence."),
  ], [{ phrase: "mean square", target: "alias-only", label: "search aid" }]);
  assert.ok(ids(engine, "mean square").includes("alias-only"));
  assert.deepEqual(new Set(ids(engine, '"mean square"')), new Set(["body", "title"]));
});

test("quotes retain spelling and scientific-number normalization without rewriting the source", () => {
  const source = "Daß Wärme; 0,8 Mikron; 6 × 10²³; βν.";
  const engine = createSearchEngine([doc("de", source, { lang: "de" })]);
  for (const query of ['"dass Waerme"', '"0.8 μm"', '"6e23"', '"beta nu"']) {
    const hit = engine.search(query)[0];
    assert.equal(hit?.document.id, "de", query);
    assert.equal(hit.snippet, source);
  }
});

test("quoted words are not silently corrected or expanded to compound words", () => {
  const engine = createSearchEngine([doc("one", "Brownian Lichtgeschwindigkeit")]);
  assert.equal(ids(engine, "Brownain").length, 1);
  assert.equal(ids(engine, "Lichtgeschw").length, 1);
  assert.deepEqual(ids(engine, '"Brownain"'), []);
  assert.deepEqual(ids(engine, '"Lichtgeschw"'), []);
  // Keep interactive typing usable until the closing quote is entered.
  assert.equal(ids(engine, '"Brownain').length, 1);
});

test("snippets find late passages in original spelling rather than showing the introduction", () => {
  const source = `${"Introductory matter. ".repeat(80)}Daß Wärme gives 0,8 Mikron. ${"Afterword. ".repeat(80)}`;
  const engine = createSearchEngine([doc("late", source, { lang: "de" })]);
  for (const query of ["Waerme", '"dass Waerme"', "0.8 μm"]) {
    const hit = engine.search(query)[0];
    assert.ok(hit.snippet.includes("Daß Wärme"), hit.snippet);
    assert.ok(hit.snippet.includes("0,8 Mikron"), hit.snippet);
    assert.ok(hit.snippet.startsWith("…"));
    assert.ok(hit.snippet.length <= 220);
    assert.ok(source.includes(hit.snippet.replace(/^…|…$/gu, "")));
    assert.equal(hit.document.text, source);
  }
});

test("a window covering more query terms beats repeated isolated matches", () => {
  const text = `${"Diffusion. ".repeat(100)}The diffusion of a particle reveals atoms. ${"Appendix. ".repeat(50)}`;
  const hit = createSearchEngine([doc("cluster", text)]).search("diffusion particle atoms")[0];
  for (const word of ["diffusion", "particle", "atoms"]) assert.ok(hit.snippet.includes(word));
});

test("snippets use actual prefix and typo matches, and multi-piece scientific notation", () => {
  const padding = "Unrelated introductory matter. ".repeat(50);
  for (const [query, text, expected] of [
    ["brownain", `${padding}Brownian movement.${padding}`, "Brownian"],
    ["lichtgeschw", `${padding}Lichtgeschwindigkeit.${padding}`, "Lichtgeschwindigkeit"],
    ["6e23", `${padding}The estimate is 6 × 10²³ per mole.${padding}`, "6 × 10²³"],
  ]) {
    const hit = createSearchEngine([doc("one", text)]).search(query)[0];
    assert.ok(hit.snippet.includes(expected), hit.snippet);
    assert.ok(hit.snippet.length <= 220);
  }
});

test("short excerpts, alias-only matches and empty bodies remain honest", () => {
  const engine = createSearchEngine([
    doc("short", "  Daß\nWärme  "),
    doc("empty", "", { title: "Diffusion" }),
  ], [{ phrase: "heat", target: "short", label: "modern term" }]);
  assert.equal(engine.search("heat")[0].snippet, "Daß Wärme");
  assert.equal(engine.search("diffusion")[0].snippet, "");
});

test("long unbroken text remains bounded and does not split surrogate pairs", () => {
  const text = "🧪".repeat(200);
  const hit = createSearchEngine([doc("unicode", text, { title: "Diffusion" })]).search("diffusion")[0];
  assert.ok(hit.snippet.length <= 220);
  assert.equal(hit.snippet.isWellFormed(), true);
});

test("query limits and deterministic result order still hold for passage search", () => {
  const records = [doc("b", "Mean square displacement"), doc("a", "Mean square displacement")];
  const engine = createSearchEngine(records);
  assert.deepEqual(engine.search('"mean square"'), createSearchEngine([...records].reverse()).search('"mean square"'));
  assert.deepEqual(engine.search(`"${"x".repeat(SEARCH_LIMITS.queryCharacters)}"`), []);
  assert.equal(engine.search('"mean square"', { limit: 1 })[0].document.id, "a");
});
