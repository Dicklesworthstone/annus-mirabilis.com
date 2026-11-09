import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { packageSearchIndex } from "../../src/search/build.ts";
import { createSearchEngine, searchResultHref } from "../../src/search/core.ts";
import {
  buildNativeSearchScript,
  inspectNativeSearch,
  NATIVE_SEARCH_MANIFEST_PATH,
  NATIVE_SEARCH_SCRIPT_FILE,
  NATIVE_SEARCH_SCRIPT_LIMIT,
} from "./native-search.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const documents = [
  {
    id: "printed",
    type: "argument",
    paper: "brownian-motion",
    section: "s5",
    lang: "de",
    title: "The printed result",
    text: "λ_x = 0,8 Mikron; daß Wärme. 🔬",
    terms: ["λ_x"],
    route: "/papers/brownian-motion/s5/",
    anchor: "s5-p3",
    face: "german",
    scopeLabel: "Source transcription",
  },
];
const aliases = [{ phrase: "how far does it wander", target: "printed", label: "search aid" }];
function packaged() {
  return packageSearchIndex(documents, aliases, "c".repeat(64), "preview");
}
function pin(path, text) {
  return {
    path,
    sha256: createHash("sha256").update(text).digest("hex"),
    size: Buffer.byteLength(text),
  };
}
function filesFor(directory, script = "globalThis.fixtureSearch = true;") {
  const bundle = packaged();
  const files = [
    [NATIVE_SEARCH_SCRIPT_FILE, script],
    [NATIVE_SEARCH_MANIFEST_PATH, bundle.manifestText],
    ...bundle.files.map((file) => [file.descriptor.path.slice(1), file.text]),
  ];
  for (const [path, text] of files) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), text);
  }
  return { bundle, pins: files.map(([path, text]) => pin(path, text)) };
}

test("edition search descriptor uses the shipped query asset and exact web shards", () => {
  const directory = mkdtempSync(join(tmpdir(), "native-search-pins-"));
  const { bundle, pins } = filesFor(directory);
  const result = inspectNativeSearch(directory, pins);
  assert.equal(result.ok, true);
  assert.deepEqual(result.descriptor, {
    schemaVersion: "annus-mirabilis-native-search.v1",
    queryScript: {
      file: NATIVE_SEARCH_SCRIPT_FILE,
      sha256: pins[0].sha256,
      bytes: pins[0].size,
    },
    manifestPath: NATIVE_SEARCH_MANIFEST_PATH,
    buildDigest: bundle.manifest.buildDigest,
    totalDocuments: documents.length,
  });
  assert.deepEqual(inspectNativeSearch(directory, []), { ok: true, descriptor: null });
  assert.equal(
    inspectNativeSearch(
      directory,
      pins.filter((file) => file.path !== NATIVE_SEARCH_SCRIPT_FILE),
    ).ok,
    false,
  );
  assert.equal(
    inspectNativeSearch(
      directory,
      pins.filter((file) => file.path !== NATIVE_SEARCH_MANIFEST_PATH),
    ).ok,
    false,
  );
});

test("changed script, manifest or shard bytes cannot acquire a native descriptor", () => {
  const directory = mkdtempSync(join(tmpdir(), "native-search-corruption-"));
  const { pins } = filesFor(directory);
  for (const file of pins) {
    const path = join(directory, file.path);
    const original = readFileSync(path);
    const altered = Buffer.from(original);
    altered[0] ^= 1; // Same length: hashing must catch it.
    writeFileSync(path, altered);
    assert.equal(inspectNativeSearch(directory, pins).ok, false, file.path);
    writeFileSync(path, original);
  }
  const shard = pins.find((file) => file.path.startsWith("search/s-"));
  assert.ok(shard);
  assert.equal(
    inspectNativeSearch(
      directory,
      pins.filter((file) => file !== shard),
    ).ok,
    false,
  );
  assert.equal(
    inspectNativeSearch(
      directory,
      pins.map((file) => (file === shard ? { ...file, sha256: "f".repeat(64) } : file)),
    ).ok,
    false,
  );
  const tooLarge = " ".repeat(NATIVE_SEARCH_SCRIPT_LIMIT + 1);
  writeFileSync(join(directory, NATIVE_SEARCH_SCRIPT_FILE), tooLarge);
  assert.equal(
    inspectNativeSearch(
      directory,
      pins.map((file) =>
        file.path === NATIVE_SEARCH_SCRIPT_FILE ? pin(file.path, tooLarge) : file,
      ),
    ).ok,
    false,
  );
});

test("the real bundled query module runs without browser or Node globals", {
  timeout: 45_000,
}, () => {
  const directory = mkdtempSync(join(tmpdir(), "native-search-bundle-"));
  // Compile the production entry and its actual imports into an isolated output directory.
  cpSync(join(root, "src/search"), join(directory, "src/search"), { recursive: true });
  buildNativeSearchScript(directory);
  const script = readFileSync(join(directory, "public", NATIVE_SEARCH_SCRIPT_FILE), "utf8");
  assert.ok(Buffer.byteLength(script) < NATIVE_SEARCH_SCRIPT_LIMIT);
  const context = createContext({});
  runInContext(script, context, { timeout: 5_000 });
  assert.equal(
    runInContext(
      "typeof window + ',' + typeof fetch + ',' + typeof process + ',' + typeof require",
      context,
    ),
    "undefined,undefined,undefined,undefined",
  );
  const native = context.AnnusMirabilisSearch;
  assert.ok(native);
  const bundle = packaged();
  assert.equal(
    JSON.parse(
      native.load(
        bundle.manifestText,
        bundle.files.map((file) => file.text),
      ),
    ).ok,
    true,
  );
  const web = createSearchEngine(documents, aliases);
  for (const query of ["0.8 μ", "lambda x", "how far does it wander"]) {
    const response = JSON.parse(native.search(query));
    const expected = web.search(query);
    assert.equal(response.ok, true);
    assert.ok(expected.length > 0);
    assert.deepEqual(
      response.hits.map((hit) => ({
        id: hit.id,
        score: hit.score,
        snippet: hit.snippet,
        aliasLabel: hit.aliasLabel,
        href: hit.href,
      })),
      expected.map((hit) => ({
        id: hit.document.id,
        score: hit.score,
        snippet: hit.snippet,
        aliasLabel: hit.aliasLabel,
        href: searchResultHref(hit.document),
      })),
    );
  }
  native.search('");globalThis.injected=true;//');
  assert.equal(context.injected, undefined);
  native.clear();
  assert.equal(JSON.parse(native.search("0.8 μ")).error.code, "not-loaded");
});
