import assert from "node:assert/strict";
import test from "node:test";
import { packageSearchIndex } from "./build.ts";
import { createSearchEngine, SEARCH_LIMITS, searchResultHref } from "./core.ts";
import { createNativeSearchSession, NATIVE_SEARCH_SCHEMA } from "./native.ts";
import { TYPE_LABELS } from "./typeLabels.ts";

const { documents, aliases } = {
  documents: [
    {
      id: "rms",
      title: "Root mean square displacement",
      type: "argument",
      paper: "brownian-motion",
      section: "s4",
      lang: "en",
      text: "How a cloud spreads while its average position stays still.",
      terms: [],
      route: "/papers/brownian-motion/s4/",
      anchor: "rms",
      face: "reading",
      scopeLabel: "Authored explanatory preview",
    },
    {
      id: "clocks",
      title: "Simultaneity and synchronization",
      type: "argument",
      paper: "special-relativity",
      section: "s4",
      lang: "en",
      text: "Simultaneity and synchronization",
      terms: [],
      route: "/papers/special-relativity/s2/",
      anchor: "clocks",
      face: "reading",
      scopeLabel: "Authored explanatory preview",
    },
    {
      id: "quantum",
      title: "Wien constant and quantum energy",
      type: "equation",
      paper: "light-quanta",
      section: "s4",
      lang: "en",
      text: "Wien constant and quantum energy",
      terms: ["βν"],
      route: "/papers/light-quanta/s4/",
      anchor: "quantum",
      face: "reading",
      scopeLabel: "Authored explanatory preview",
    },
    {
      id: "printed",
      title: "The printed result",
      type: "argument",
      paper: "brownian-motion",
      section: "s4",
      lang: "de",
      text: "λ_x = 8·10⁻⁵ cm = 0,8 Mikron; daß Wärme. 😀",
      terms: [],
      route: "/papers/brownian-motion/s4/",
      anchor: "s5-p3",
      face: "german",
      scopeLabel: "Authored explanatory preview",
    },
    {
      id: "besso",
      title: "Acknowledgment",
      type: "argument",
      paper: "special-relativity",
      section: "s4",
      lang: "en",
      text: "Michele Besso",
      terms: [],
      route: "/papers/special-relativity/s10/",
      anchor: "besso",
      face: "reading",
      scopeLabel: "Authored explanatory preview",
    },
  ],
  aliases: [
    {
      phrase: "how far does it wander",
      target: "rms",
      label: "search aid",
    },
    {
      phrase: "clocks disagree",
      target: "clocks",
      label: "search aid",
    },
    {
      phrase: "photon energy",
      target: "quantum",
      label: "modern term",
    },
  ],
};

function bundle() {
  return packageSearchIndex(documents, aliases, "b".repeat(64), "preview");
}
function load(session, packaged = bundle()) {
  return JSON.parse(
    session.load(
      packaged.manifestText,
      packaged.files.map((file) => file.text),
    ),
  );
}
function projected(hit) {
  const document = hit.document;
  return JSON.parse(
    JSON.stringify({
      id: document.id,
      type: document.type,
      paper: document.paper,
      section: document.section,
      lang: document.lang,
      title: document.title,
      route: document.route,
      anchor: document.anchor,
      face: document.face,
      scopeLabel: document.scopeLabel,
      score: hit.score,
      snippet: hit.snippet,
      aliasLabel: hit.aliasLabel,
      href: searchResultHref(document),
    }),
  );
}

test("native uses exactly the web ranking, snippets, aliases and reader destinations", () => {
  const session = createNativeSearchSession();
  const metadata = load(session);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.schemaVersion, NATIVE_SEARCH_SCHEMA);
  assert.equal(metadata.documentCount, documents.length);
  assert.equal(metadata.buildDigest, "b".repeat(64));
  assert.deepEqual(metadata.typeLabels, TYPE_LABELS);
  assert.deepEqual(metadata.papers, ["brownian-motion", "light-quanta", "special-relativity"]);
  const web = createSearchEngine(documents, aliases);
  const queries = [
    "how far does it wander",
    "clocks",
    "βν",
    "beta nu",
    "0.8 μ",
    "0,8 Mikron",
    "Besso",
    "photon energy",
    '"Michele Besso"',
    "simultaneity",
    "no matching phrase",
    '");globalThis.nativeQueryExecuted=true;//',
  ];
  for (const query of queries) {
    for (const options of [{}, { paper: "special-relativity" }, { type: "equation", limit: 2 }]) {
      const result = JSON.parse(session.search(query, JSON.stringify(options)));
      assert.equal(result.ok, true);
      assert.deepEqual(result.hits, web.search(query, options).map(projected), query);
      assert.ok(result.hits.every((hit) => !("text" in hit) && !("terms" in hit)));
    }
  }
  assert.equal(globalThis.nativeQueryExecuted, undefined);
  // Positive controls: parity must compare actual results as well as empty sets.
  assert.equal(JSON.parse(session.search("Besso")).hits[0].id, "besso");
  assert.ok(JSON.parse(session.search("0.8 μ")).hits[0].snippet.includes("0,8 Mikron"));
  assert.ok(JSON.parse(session.search("how far does it wander")).hits[0].aliasLabel);
});

test("UTF-8 byte budgets accept umlauts, Greek and supplementary characters", () => {
  const packaged = bundle();
  assert.ok(packaged.files.some((file) => Buffer.byteLength(file.text) > file.text.length));
  const session = createNativeSearchSession();
  assert.equal(load(session, packaged).ok, true);
  for (const file of packaged.files)
    assert.equal(Buffer.byteLength(file.text), file.descriptor.bytes);
  const texts = packaged.files.map((file) => file.text);
  texts[0] += " ";
  assert.equal(JSON.parse(session.load(packaged.manifestText, texts)).error.code, "invalid-index");
  assert.equal(JSON.parse(session.search("Besso")).error.code, "not-loaded");
});

test("missing or corrupt replacements discard the old edition atomically", () => {
  const packaged = bundle();
  const session = createNativeSearchSession();
  const validTexts = packaged.files.map((file) => file.text);
  const corruptions = [
    ["{", validTexts],
    [JSON.stringify({ ...packaged.manifest, schemaVersion: 99 }), validTexts],
    [packaged.manifestText, validTexts.slice(1)],
    [packaged.manifestText, [...validTexts, "{}"]],
    [
      packaged.manifestText,
      validTexts.map((text, index) => (index === 0 ? " ".repeat(text.length) : text)),
    ],
    [" ".repeat(SEARCH_LIMITS.manifestBytes + 1), validTexts],
  ];
  for (const [manifest, texts] of corruptions) {
    assert.equal(load(session).ok, true);
    assert.equal(JSON.parse(session.load(manifest, texts)).error.code, "invalid-index");
    assert.equal(JSON.parse(session.search("Besso")).error.code, "not-loaded");
  }
  assert.equal(load(session).ok, true);
  session.clear();
  assert.equal(JSON.parse(session.search("Besso")).error.code, "not-loaded");
});

test("query and option limits are enforced without changing the loaded edition", () => {
  const session = createNativeSearchSession();
  assert.equal(JSON.parse(session.search("Besso")).error.code, "not-loaded");
  assert.equal(load(session).ok, true);
  assert.equal(
    JSON.parse(session.search("x".repeat(SEARCH_LIMITS.queryCharacters + 1))).error.code,
    "invalid-query",
  );
  // JavaScriptCore and the web owner share UTF-16 length, including two-unit emoji.
  assert.equal(JSON.parse(session.search("🔬".repeat(129))).error.code, "invalid-query");
  for (const options of [
    null,
    [],
    { type: "unknown" },
    { paper: 1 },
    { limit: 2.5 },
    { extra: true },
  ]) {
    assert.equal(
      JSON.parse(session.search("Besso", JSON.stringify(options))).error.code,
      "invalid-query",
    );
  }
  assert.equal(JSON.parse(session.search("Besso", " ".repeat(1025))).error.code, "invalid-query");
  assert.equal(JSON.parse(session.search("Besso", "{")).ok, false);
  assert.equal(JSON.parse(session.search("Besso")).hits[0].id, "besso");
});
