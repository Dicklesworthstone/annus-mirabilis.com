import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import {
  buildContent,
  CONTENT_COMPILER_FILES,
  loadReadingFiles,
} from "../../scripts/build-content.ts";
import { compileReadingContent } from "../content/compiler/compile.ts";

const files = await loadReadingFiles();
const replace = (id, change) =>
  files.map((f) => {
    const r = JSON.parse(f.text);
    return r.id === id ? { ...f, text: JSON.stringify(change(r)) } : f;
  });
test("the authored Brownian chapter joins six arguments and thirteen finite prerequisite lessons", () => {
  const x = compileReadingContent(files);
  assert.equal(x.ok, true);
  const p = x.papers[0];
  assert.equal(p.arguments.length, 6);
  assert.equal(p.foundations.length, 13);
  assert.ok(p.arguments.every((a) => Object.keys(a.readings).length === 4));
  assert.equal(p.paper.sourceStatus, "in-preparation");
  assert.equal(compileReadingContent([...files].reverse()).papers[0].paper.id, p.paper.id);
});
test("missing readings, invented experiments and misplaced arguments fail closed", () => {
  for (const change of [
    (r) => {
      delete r.readings.steps;
      return r;
    },
    (r) => ({ ...r, experiments: ["sr-99"] }),
    (r) => ({ ...r, section: "s9" }),
  ])
    assert.equal(compileReadingContent(replace("arg-bm-observable", change)).ok, false);
});
test("logical premise cycles fail while navigation cross-references may be cyclic", () => {
  const cycle = replace("arg-bm-observable", (r) => ({
    ...r,
    prerequisites: [{ id: "arg-bm-inference", edge: "premise" }],
  }));
  assert.ok(compileReadingContent(cycle).diagnostics.some((d) => d.code === "prerequisite-cycle"));
  const links = replace("arg-bm-observable", (r) => ({
    ...r,
    prerequisites: [{ id: "arg-bm-inference", edge: "cross-reference" }],
  }));
  assert.equal(compileReadingContent(links).ok, true);
});
test("duplicate outline entries and unavailable citations are compiler errors", () => {
  assert.equal(
    compileReadingContent(
      replace("brownian-motion", (r) => {
        r.sections[0].arguments.push(r.sections[0].arguments[0]);
        return r;
      }),
    ).ok,
    false,
  );
  assert.equal(
    compileReadingContent(replace("arg-bm-observable", (r) => ({ ...r, citations: ["missing"] })))
      .ok,
    false,
  );
});
test("build outputs are reproducible, independently hashed and contain no fake source face", async () => {
  const first = await buildContent(),
    second = await buildContent();
  assert.deepEqual(first.index, second.index);
  for (const payload of first.index.payloads) {
    const bytes = await readFile("generated/content/" + payload.file);
    assert.equal(bytes.length, payload.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), payload.sha256);
  }
  const paper = first.papers[0];
  assert.equal(paper.paper.status, "explanation-preview");
  assert.equal(first.index.payloads.length, first.papers.length + first.foundations.length);
});

test("compiler revision changes produce new public URLs without changing the authored-input identity", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "annus-reader-compiler-"));
  await cp("content", resolve(root, "content"), { recursive: true });
  for (const p of CONTENT_COMPILER_FILES) {
    await mkdir(dirname(resolve(root, p)), { recursive: true });
    await cp(p, resolve(root, p));
  }
  const first = await buildContent(root);
  await appendFile(
    resolve(root, "src/content/compiler/compile.ts"),
    "\n// A subsequent compiler revision.\n",
  );
  const second = await buildContent(root);
  assert.equal(first.index.inputDigest, second.index.inputDigest);
  assert.notEqual(first.index.compilerDigest, second.index.compilerDigest);
  assert.notEqual(first.index.payloads[0].jsonUrl, second.index.payloads[0].jsonUrl);
  // A failed future compile leaves the last complete manifest untouched.
  await appendFile(resolve(root, "content/papers/brownian-motion.json"), "invalid trailing data");
  const failed = await buildContent(root);
  assert.equal(failed.ok, false);
  assert.deepEqual(
    JSON.parse(await readFile(resolve(root, "generated/content/index.json"), "utf8")),
    second.index,
  );
});

test("content symlinks are strictly refused regardless of filename prefix (including dot-named and AppleDouble symlinks)", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "annus-symlink-test-"));
  await mkdir(resolve(root, "content/papers"), { recursive: true });
  const realFile = resolve(root, "content/papers/real.json");
  await writeFile(realFile, JSON.stringify({ id: "real" }));

  // Dot-named symlink
  const dotSymlink = resolve(root, "content/papers/.dot-symlink.json");
  await symlink(realFile, dotSymlink);
  await assert.rejects(
    async () => loadReadingFiles(root, "content"),
    /Content symlinks are not admitted/,
  );
  await unlink(dotSymlink);

  // AppleDouble-prefixed symlink
  const adSymlink = resolve(root, "content/papers/._ad-symlink.json");
  await symlink(realFile, adSymlink);
  await assert.rejects(
    async () => loadReadingFiles(root, "content"),
    /Content symlinks are not admitted/,
  );
  await unlink(adSymlink);

  // Regular symlink
  const regularSymlink = resolve(root, "content/papers/symlinked.json");
  await symlink(realFile, regularSymlink);
  await assert.rejects(
    async () => loadReadingFiles(root, "content"),
    /Content symlinks are not admitted/,
  );
  await unlink(regularSymlink);
});
