import assert from "node:assert/strict";
import test from "node:test";
import {
  createSearchEngine, normalizeSearchText, searchResultHref,
  validateSearchDocument, SEARCH_LIMITS,
} from "./core.ts";

const doc = (id, title, patch = {}) => ({
  id, title, type: "argument", paper: "brownian-motion", section: "s5", lang: "en",
  text: title, terms: [], route: "/papers/brownian-motion/", anchor: id, face: "reading",
  scopeLabel: "Authored explanatory preview", ...patch,
});

for (const [name, forms] of [
  ["Greek names and adjacent glyphs", ["βν", "beta nu", String.raw`\beta\nu`]],
  ["coordinate subscripts", ["λ_x", "λx", "λₓ", String.raw`\lambda_{x}`]],
  ["prime spellings", ["x′", "x'", "x’"]],
  ["micro units and decimal comma", ["0,8 Mikron", "0.8 µ", "0.8 μ", "0.8 µm", "0.8 μm", "0.8 um", "0.8 micron"]],
  ["scientific notation", ["6×10²³", "6·10²³", "6*10^23", "6e23", String.raw`6\cdot10^{23}`]],
  ["negative exponent", ["8·10⁻⁵", "8e-5", "0.00008"]],
  ["German case umlauts and sharp s", ["DAẞ WÄRME", "dass Waerme", "dass Warme"]],
  ["instrument ids", ["BM-06", "bm06", "BM 6"]],
]) test(name, () => {
  for (const form of forms) assert.equal(normalizeSearchText(form), normalizeSearchText(forms[0]), form);
});

test("normalization leaves the original document and visible German excerpt intact", () => {
  const source = doc("arg-bm-printed", "Printed distance", { text: "0,8 Mikron; daß Wärme", lang: "de" });
  const hit = createSearchEngine([source]).search("0.8 μ")[0];
  assert.equal(hit.document.id, source.id);
  assert.equal(hit.snippet, source.text);
  assert.equal(source.text, "0,8 Mikron; daß Wärme");
});

test("all five plan queries reach an existing fixture target first", () => {
  const docs = [doc("rms", "Root mean square displacement"),
    doc("clocks", "Simultaneity and synchronization", { paper: "special-relativity" }),
    doc("quantum", "Quantum energy", { type: "equation", terms: ["βν"], paper: "light-quanta" }),
    doc("printed", "The printed result", { text: "λ_x = 8·10⁻⁵ cm = 0,8 Mikron" }),
    doc("besso", "Acknowledgment", { text: "Michele Besso", paper: "special-relativity" })];
  const engine = createSearchEngine(docs, [
    { phrase: "how far does it wander", target: "rms", label: "search aid" },
    { phrase: "clocks disagree", target: "clocks", label: "search aid" },
  ]);
  for (const [query, id] of [["how far does it wander", "rms"], ["clocks disagree", "clocks"],
    ["βν", "quantum"], ["0.8 μ", "printed"], ["Besso", "besso"]]) {
    assert.equal(engine.search(query)[0]?.document.id, id);
  }
});

test("ambiguous symbols preserve scoped meanings instead of joining papers", () => {
  const engine = createSearchEngine([
    doc("wien", "Wien constant", { terms: ["β"], paper: "light-quanta", scopeLabel: "Wien constant" }),
    doc("lorentz", "Lorentz factor", { terms: ["β"], paper: "special-relativity", scopeLabel: "Lorentz factor (printed beta)" }),
    doc("viscosity", "Viscosity", { terms: ["k"], scopeLabel: "Viscosity (Einstein's k), not Boltzmann's constant" }),
  ]);
  assert.deepEqual(new Set(engine.search("beta").map((h) => h.document.scopeLabel)),
    new Set(["Wien constant", "Lorentz factor (printed beta)"]));
  assert.equal(engine.search("k viscosity")[0]?.document.id, "viscosity");
  assert.equal(engine.search("beta", { paper: "mass-energy" }).length, 0);
});

test("prefix matching supports German compounds but not one-letter symbols", () => {
  const engine = createSearchEngine([doc("a", "Elektrodynamik", { text: "Lichtgeschwindigkeit" }), doc("b", "Kinetics")]);
  assert.equal(engine.search("lichtgeschw")[0]?.document.id, "a");
  assert.equal(engine.search("k").length, 0);
});

test("all query terms must match and symbols receive exact-term weighting", () => {
  const engine = createSearchEngine([
    doc("long", "Commentary", { text: "diffusion ".repeat(200) }),
    doc("short", "Diffusion", { type: "equation", terms: ["diffusion"] }),
    doc("unrelated", "Clock synchronization"),
  ]);
  assert.equal(engine.search("diffusion")[0].document.id, "short");
  assert.equal(engine.search("diffusion clock").length, 0);
});

test("modern aliases are labeled, resolve only admitted ids and do not mutate results", () => {
  const engine = createSearchEngine([doc("quanta", "Light quanta")], [
    { phrase: "photon", target: "quanta", label: "modern term" },
  ]);
  assert.equal(engine.search("photon")[0].aliasLabel, "modern term");
  assert.equal(engine.search("light")[0].aliasLabel, null);
  assert.throws(() => createSearchEngine([], [{ phrase: "photon", target: "missing", label: "modern term" }]));
});

test("the query is bounded and never treated as executable code or regular expression", () => {
  const engine = createSearchEngine([doc("ordinary", "A particle wanders")]);
  assert.deepEqual(engine.search("x".repeat(SEARCH_LIMITS.queryCharacters + 1)), []);
  assert.deepEqual(engine.search("(a+)+$"), engine.search("a"));
  assert.deepEqual(engine.search("<script>alert(1)</script>"), []);
  assert.deepEqual(engine.search(" "), []);
});

test("input ordering cannot change tie-breaking and result limits are bounded", () => {
  const records = Array.from({ length: 40 }, (_, i) => doc(`id-${String(i).padStart(2, "0")}`, "Diffusion"));
  const first = createSearchEngine(records).search("diffusion", { limit: 1000 });
  const second = createSearchEngine([...records].reverse()).search("diffusion", { limit: 1000 });
  assert.deepEqual(first, second);
  assert.equal(first.length, SEARCH_LIMITS.results);
});

test("reserved object property names are ordinary query terms", () => {
  const engine = createSearchEngine([doc("constructor", "constructor prototype")]);
  assert.equal(engine.search("constructor")[0].document.id, "constructor");
});

test("types filter without searching hidden documents", () => {
  const engine = createSearchEngine([doc("eq", "Diffusion", { type: "equation" }), doc("arg", "Diffusion")]);
  assert.deepEqual(engine.search("diffusion", { type: "equation" }).map((h) => h.document.id), ["eq"]);
});

test("local result URLs preserve the actual anchor and face", () => {
  assert.equal(searchResultHref(doc("arg-bm-observable", "Observable")),
    "/papers/brownian-motion/?view=reading#arg-bm-observable");
  assert.equal(searchResultHref(doc("beta", "Beta", { route: "/notation/", anchor: "lq.beta.wien", face: "" })),
    "/notation/#lq.beta.wien");
});

test("external, executable, escaped or traversal routes cannot become search links", () => {
  for (const route of ["https://evil.test/", "//evil.test/", "javascript:alert(1)", "/lab/../admin",
    "/papers/%2e%2e/", "/papers/\\evil", "/papers/?next=evil", "/papers/\n"]) {
    assert.throws(() => validateSearchDocument(doc("id", "title", { route })), route);
  }
  assert.throws(() => validateSearchDocument(doc("id", "title", { anchor: 'x\" onfocus=alert(1)' })));
});

test("duplicate ids, malformed records, and oversized content fail loudly", () => {
  assert.throws(() => createSearchEngine([doc("same", "A"), doc("same", "B")]));
  assert.throws(() => validateSearchDocument(doc("id", "title", { type: "secret" })));
  assert.throws(() => validateSearchDocument(doc("id", "title", { text: "x".repeat(SEARCH_LIMITS.documentCharacters + 1) })));
});

test("documents are detached and frozen before building the index", () => {
  const original = doc("id", "Diffusion", { terms: ["wander"] });
  const engine = createSearchEngine([original]);
  original.terms.push("tampered");
  original.title = "Changed";
  assert.equal(engine.search("diffusion")[0].document.title, "Diffusion");
  assert.equal(engine.search("tampered").length, 0);
  assert.ok(Object.isFrozen(engine.search("diffusion")[0].document));
});
