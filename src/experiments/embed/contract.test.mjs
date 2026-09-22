import assert from "node:assert/strict";
import { test } from "node:test";
import { EMBED_INSTRUMENTS, embedInstrument, isEmbeddableId } from "./catalogue.ts";
import {
  DEFAULT_EMBED_OPTIONS,
  decodeEmbedOptions,
  EMBED_QUERY_LIMIT,
  embedMarkup,
  embedPath,
  embedUrl,
} from "./contract.ts";

test("admission list has unique instruments, real local sources, and all explanation depths", () => {
  assert.equal(new Set(EMBED_INSTRUMENTS.map((item) => item.id)).size, EMBED_INSTRUMENTS.length);
  for (const item of EMBED_INSTRUMENTS) {
    assert.ok(item.source.startsWith("/papers/") || item.source.startsWith("/discover/"));
    for (const key of ["title", "overview", "full", "steps"]) assert.ok(item[key].length > 15);
  }
});
for (const item of EMBED_INSTRUMENTS) {
  test(`${item.id}: generated link and escaped markup name the SAME adapter`, () => {
    assert.equal(embedInstrument(item.id), item);
    assert.equal(isEmbeddableId(item.id), true);
    const options = { theme: "dark", detail: "steps", motion: "reduce" };
    const url = new URL(embedUrl(item.id, options));
    assert.equal(url.origin, "https://annus-mirabilis.com");
    assert.equal(url.pathname, `/embed/lab/${item.id}/`);
    assert.deepEqual(decodeEmbedOptions(url.search), { kind: "options", options });
    const markup = embedMarkup(item.id, options, 700);
    assert.ok(markup.includes('height="700"'));
    assert.ok(markup.includes(`src="${url.href.replaceAll("&", "&amp;")}"`));
    assert.ok(markup.includes(`https://annus-mirabilis.com/lab/${item.id}/`));
    assert.ok(markup.includes('referrerpolicy="no-referrer"'));
    assert.ok(!markup.includes("<script"));
  });
}
test("every theme, detail and motion combination round-trips", () => {
  for (const theme of ["system", "light", "dark"])
    for (const detail of ["overview", "full", "steps"])
      for (const motion of ["system", "reduce"]) {
        const options = { theme, detail, motion };
        assert.deepEqual(decodeEmbedOptions(new URL(embedUrl("sr-04", options)).search), {
          kind: "options",
          options,
        });
      }
});
test("a plain visit uses defaults and individual overrides retain other defaults", () => {
  assert.deepEqual(decodeEmbedOptions(""), { kind: "options", options: DEFAULT_EMBED_OPTIONS });
  assert.deepEqual(decodeEmbedOptions("?detail=full"), {
    kind: "options",
    options: { ...DEFAULT_EMBED_OPTIONS, detail: "full" },
  });
});
for (const search of [
  "?embed=2",
  "?embed=",
  "?theme=dark&theme=light",
  "?embed=1&embed=1",
  "?detail=secret",
  "?motion=play",
  "?theme=%3Cscript%3E",
  "?theme=dark&note=private",
  "?tape=opaque",
  "?seed=123",
  "?params={}",
  "?__proto__=dark",
  "?constructor=x",
  "?Theme=dark",
  "?detail=full&detail=full",
  "?motion=reduce&motion=system",
  "?theme=%ZZ",
]) {
  test(`refuse configuration atomically: ${search}`, () =>
    assert.equal(decodeEmbedOptions(search).kind, "invalid"));
}
test("overlong query fails before interpretation", () =>
  assert.equal(decodeEmbedOptions("x".repeat(EMBED_QUERY_LIMIT + 1)).kind, "invalid"));
for (const id of [
  "bm-99",
  "sr-04:1904",
  "avogadro-lab",
  "__proto__",
  "constructor",
  "../sr-04",
  "//evil.test",
  "sr-04/?note=x",
  "<img src=x>",
]) {
  test(`unknown adapter cannot fall back to a different experiment: ${id}`, () => {
    assert.equal(isEmbeddableId(id), false);
    // Each refusal says which rule it applied, not only that something threw.
    assert.throws(() => embedPath(id), { code: "embed-not-admitted" });
    assert.throws(() => embedMarkup(id), { code: "embed-unknown-instrument" });
  });
}
test("public markup whitelists fields instead of serializing private state", () => {
  const markup = embedMarkup("bm-03", {
    ...DEFAULT_EMBED_OPTIONS,
    note: "secret",
    predictions: "private",
    src: "https://evil.test",
  });
  assert.ok(!/secret|private|evil/.test(markup));
});
for (const height of [NaN, Infinity, -1, 399, 2001, 900.5, '900" onload="alert(1)']) {
  test(`invalid dimensions cannot produce markup: ${height}`, () =>
    assert.throws(() => embedMarkup("me-01", DEFAULT_EMBED_OPTIONS, height), {
      code: "embed-height-out-of-range",
    }));
}
test("both inclusive height boundaries work", () => {
  assert.ok(embedMarkup("me-01", DEFAULT_EMBED_OPTIONS, 400).includes('height="400"'));
  assert.ok(embedMarkup("me-01", DEFAULT_EMBED_OPTIONS, 2000).includes('height="2000"'));
});
test("runtime invalid presentation cannot bypass the decoder through encoding", () => {
  assert.throws(() => embedPath("sr-04", { ...DEFAULT_EMBED_OPTIONS, theme: 'dark" onload="x' }), {
    code: "embed-invalid-options",
  });
});
