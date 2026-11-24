import assert from "node:assert/strict";
import test from "node:test";
import { createSearchEngine, SEARCH_LIMITS, SearchPageError } from "./core.ts";

const document = (id, patch = {}) => ({
  id,
  title: "Diffusion",
  text: "Mean square displacement reveals diffusion.",
  type: "argument",
  paper: "brownian-motion",
  section: "s5",
  lang: "en",
  terms: [],
  route: "/papers/brownian-motion/",
  anchor: id,
  face: "reading",
  scopeLabel: "Authored test passage",
  ...patch,
});
const identities = (hits) => hits.map((hit) => hit.document.id);
const corpus = Array.from({ length: SEARCH_LIMITS.results * 2 + 7 }, (_, index) =>
  document("result-" + String(index).padStart(3, "0")),
);

function collect(engine, query, options = {}) {
  const pages = [];
  let offset = 0;
  for (let guard = 0; guard <= SEARCH_LIMITS.documents; guard++) {
    const page = engine.searchPage(query, { ...options, offset });
    pages.push(page);
    if (page.nextOffset === null) return pages;
    assert.ok(page.nextOffset > offset, "Pagination must make forward progress.");
    assert.ok(page.hits.length > 0, "An unfinished page cannot be empty.");
    offset = page.nextOffset;
  }
  assert.fail("Pagination exceeded the document budget without finishing.");
}

test("successive bounded pages cover every match once in the original deterministic order", () => {
  const engine = createSearchEngine([...corpus].reverse());
  const pages = collect(engine, "diffusion", { limit: SEARCH_LIMITS.results });
  const all = pages.flatMap((page) => identities(page.hits));
  assert.deepEqual(all, corpus.map((entry) => entry.id));
  assert.equal(new Set(all).size, corpus.length);
  for (const page of pages) {
    assert.equal(page.total, corpus.length);
    assert.ok(page.hits.length <= SEARCH_LIMITS.results);
    assert.deepEqual(
      identities(page.hits),
      corpus.slice(page.offset, page.offset + page.hits.length).map((entry) => entry.id),
    );
  }
  assert.equal(pages.at(-1).nextOffset, null);
  assert.deepEqual(
    engine.search("diffusion", { limit: SEARCH_LIMITS.results }),
    pages[0].hits,
  );
  assert.deepEqual(
    engine.search("diffusion", { limit: SEARCH_LIMITS.results, offset: SEARCH_LIMITS.results }),
    pages[0].hits,
    "The command-palette API remains a first-page search.",
  );
});

test("paper and type filters are applied before the page boundary and total are computed", () => {
  const records = corpus.map((entry, index) => ({
    ...entry,
    paper: index % 3 === 0 ? "light-quanta" : "brownian-motion",
    type: index % 2 === 0 ? "equation" : "argument",
  }));
  const expected = records.filter(
    (entry) => entry.paper === "brownian-motion" && entry.type === "equation",
  );
  assert.ok(expected.length > 7, "The filtered population must cross a page boundary.");
  const pages = collect(createSearchEngine(records), "diffusion", {
    paper: "brownian-motion",
    type: "equation",
    limit: 7,
  });
  assert.deepEqual(pages.flatMap((page) => identities(page.hits)), expected.map((entry) => entry.id));
  for (const page of pages) assert.equal(page.total, expected.length);
});

test("alias ranking and quoted-passage constraints survive pagination", () => {
  const alias = document("z-alias", { title: "An indirect reference", text: "An authored search aid." });
  const separated = document("a-separated", {
    title: "A changed mean",
    text: "A square is discussed in a different sentence.",
  });
  const engine = createSearchEngine([...corpus, alias, separated], [
    { phrase: "diffusion", target: alias.id, label: "search aid" },
    { phrase: "mean square", target: separated.id, label: "search aid" },
  ]);
  const byAlias = collect(engine, "diffusion", { limit: 11 });
  assert.equal(byAlias[0].hits[0].document.id, alias.id);
  assert.equal(byAlias[0].hits[0].aliasLabel, "search aid");
  assert.deepEqual(
    byAlias.flatMap((page) => identities(page.hits)),
    [alias.id, ...corpus.map((entry) => entry.id)],
  );
  const quoted = collect(engine, '"mean square"', { limit: 11 });
  assert.deepEqual(
    quoted.flatMap((page) => identities(page.hits)),
    corpus.map((entry) => entry.id),
    "An alias or separated words must not turn a non-quotation into a quoted result.",
  );
  for (const page of quoted) {
    assert.equal(page.total, corpus.length);
    for (const hit of page.hits) assert.equal(hit.snippet, hit.document.text);
  }
});

test("invalid offsets fail explicitly rather than silently repeating the first page", () => {
  const engine = createSearchEngine(corpus);
  for (const offset of [-1, 0.5, NaN, Infinity, -Infinity, "30", null, SEARCH_LIMITS.documents + 1])
    assert.throws(
      () => engine.searchPage("diffusion", { offset }),
      (error) => {
        assert.ok(error instanceof RangeError);
        assert.ok(error instanceof SearchPageError);
        assert.equal(error.code, "search-page-offset-invalid");
        return true;
      },
    );
  const afterLast = engine.searchPage("diffusion", { offset: corpus.length });
  assert.deepEqual(afterLast.hits, []);
  assert.equal(afterLast.total, corpus.length);
  assert.equal(afterLast.nextOffset, null);
  assert.equal(engine.searchPage("diffusion", { offset: SEARCH_LIMITS.documents }).nextOffset, null);
});

test("page sizes preserve the existing default and cap without exposing an unbounded result array", () => {
  const engine = createSearchEngine(corpus);
  assert.equal(engine.search("diffusion").length, 20);
  assert.equal(engine.searchPage("diffusion").hits.length, 20);
  assert.equal(engine.searchPage("diffusion", { limit: 10000 }).hits.length, SEARCH_LIMITS.results);
  assert.equal(engine.searchPage("diffusion", { limit: 0 }).hits.length, 1);
  for (const limit of [NaN, Infinity, 0.5])
    assert.equal(engine.searchPage("diffusion", { limit }).hits.length, 20);
});

test("empty, refused and unmatched searches cannot advertise another page", () => {
  const engine = createSearchEngine(corpus);
  for (const query of ["", " ", "x".repeat(SEARCH_LIMITS.queryCharacters + 1), "unfindablezzzz"]) {
    const page = engine.searchPage(query);
    assert.deepEqual(page, { hits: [], total: 0, offset: 0, nextOffset: null });
  }
  const filtered = engine.searchPage("diffusion", { paper: "missing-collection", offset: 30 });
  assert.deepEqual(filtered, { hits: [], total: 0, offset: 30, nextOffset: null });
});
