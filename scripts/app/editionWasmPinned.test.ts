/**
 * THE EDITION'S FRANKENSIM WASM, AGAINST THE PINNED MANIFEST (am-rc1001-bridge-plan-pcjk.41).
 *
 * The reasoning is in export-edition.ts. What this file establishes is that the refusal can fire on
 * the real defect and cannot fire on the four pdf.js modules that legitimately ship beside it.
 *
 * THE REAL DEFECT, verbatim from the only exported edition (measured 2026-10-09):
 * `wasm/fs-annus-diffusion/105d7ffc15414de5/fs_annus_diffusion_bg.wasm`, 154 bytes, while
 * `public/wasm/manifest.json` pins `80a1f8fda6f69003` at 92,751. The placeholder sits at a
 * DIFFERENT digest path, so a check that only inspected files found at the pinned path would never
 * have met it and would have passed that edition. Both halves are asserted: the stray path is
 * refused, and the absent pinned file is refused.
 *
 * In the node lane because it reads public/wasm/manifest.json off disk for the positive case, and
 * the pinned manifest is the one input this guard must not be allowed to mock.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  AppExportError,
  assertFrankensimWasmPinned,
  type EditionFile,
  editionWasmPrefix,
  frankensimWasmMismatches,
  type PinnedWasmFile,
} from "./export-edition.ts";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** The pinned manifest, read rather than described. */
function pinnedFromDisk(): { bundleDir: string; pinned: Map<string, PinnedWasmFile> } {
  const raw = JSON.parse(readFileSync(join(ROOT, "public/wasm/manifest.json"), "utf8")) as {
    bundleDir: string;
    files: Record<string, { sha256: string; bytes?: number; size?: number }>;
  };
  const pinned = new Map<string, PinnedWasmFile>();
  // Every file the manifest names. Loading only the .wasm made the bundle's own .js and .d.ts
  // match nothing, which the first end-to-end export reported as 7 problems instead of 4.
  for (const [name, entry] of Object.entries(raw.files)) {
    pinned.set(name, { sha256: entry.sha256, size: entry.bytes ?? entry.size ?? -1 });
  }
  return { bundleDir: raw.bundleDir, pinned };
}

const file = (path: string, sha256: string, size: number): EditionFile => ({
  path,
  sha256,
  size,
  contentType: "application/wasm",
});

test("the pinned prefix drops the public/ root, since the edition does not carry it", () => {
  assert.equal(
    editionWasmPrefix("public/wasm/fs-annus-diffusion/80a1f8fda6f69003"),
    "wasm/fs-annus-diffusion/80a1f8fda6f69003",
  );
  // Idempotent on a path already relative, and tolerant of a trailing slash.
  assert.equal(editionWasmPrefix("wasm/fs-annus-diffusion/abc"), "wasm/fs-annus-diffusion/abc");
  assert.equal(editionWasmPrefix("public/wasm/x/"), "wasm/x");
});

test("THE REAL DEFECT: the 154-byte placeholder at another digest path is refused", () => {
  const { bundleDir, pinned } = pinnedFromDisk();
  assert.ok(pinned.size > 3, "the pinned manifest names the whole bundle, not one file");
  const placeholder = [
    file(
      "wasm/fs-annus-diffusion/105d7ffc15414de5/fs_annus_diffusion_bg.wasm",
      "105d7ffc15414de5eccebcbcae942015b187fed0ea67a26ced5c50949593bb7b",
      154,
    ),
  ];
  const mismatches = frankensimWasmMismatches(placeholder, bundleDir, pinned);
  // BOTH halves, asserted as properties rather than as a frozen list: the stray file is refused,
  // AND every pinned file is reported missing. Without the second, an edition carrying only a
  // placeholder under a different digest would pass by never meeting the pinned path.
  const stray = mismatches.filter((m) => m.reason === "not-in-pinned-manifest");
  const absent = mismatches.filter((m) => m.reason === "pinned-file-missing");
  assert.deepEqual(
    stray.map((m) => m.path),
    ["wasm/fs-annus-diffusion/105d7ffc15414de5/fs_annus_diffusion_bg.wasm"],
  );
  assert.equal(absent.length, pinned.size);
  assert.equal(stray.length + absent.length, mismatches.length);

  const thrown = (() => {
    try {
      assertFrankensimWasmPinned(placeholder, bundleDir, pinned);
      return null;
    } catch (error) {
      return error;
    }
  })();
  assert.ok(thrown instanceof AppExportError);
  assert.equal((thrown as AppExportError).code, "edition-wasm-unpinned");
  assert.match((thrown as AppExportError).message, /105d7ffc15414de5/);
});

test("the pinned module itself passes, read from public/wasm/manifest.json", () => {
  const { bundleDir, pinned } = pinnedFromDisk();
  const prefix = editionWasmPrefix(bundleDir);
  const good = [...pinned].map(([name, entry]) =>
    file(`${prefix}/${name}`, entry.sha256, entry.size),
  );
  assert.deepEqual(frankensimWasmMismatches(good, bundleDir, pinned), []);
  assertFrankensimWasmPinned(good, bundleDir, pinned);
});

test("a wrong digest and a wrong size are distinct refusals", () => {
  const { bundleDir, pinned } = pinnedFromDisk();
  const prefix = editionWasmPrefix(bundleDir);
  const [name, entry] = [...pinned][0] as [string, PinnedWasmFile];

  const wrongDigest = frankensimWasmMismatches(
    [...pinned].map(([n, e]) =>
      file(`${prefix}/${n}`, n === name ? "0".repeat(64) : e.sha256, e.size),
    ),
    bundleDir,
    pinned,
  );
  assert.deepEqual(
    wrongDigest.map((m) => m.reason),
    ["digest-mismatch"],
  );

  const wrongSize = frankensimWasmMismatches(
    [...pinned].map(([n, e]) => file(`${prefix}/${n}`, e.sha256, n === name ? e.size + 1 : e.size)),
    bundleDir,
    pinned,
  );
  assert.deepEqual(
    wrongSize.map((m) => m.reason),
    ["size-mismatch"],
  );
  assert.ok(wrongSize[0]?.detail.includes(String(entry.size)));
});

test("the four pdf.js modules are NOT the subject, and must not be refused", () => {
  // The edition legitimately ships jbig2, openjpeg, qcms_bg and quickjs-eval, 104,852 to 469,105
  // bytes, under pdfjs/wasm/. They are in no pinned manifest; a check over "every .wasm" refuses
  // all four, which is why this guard is scoped to the pinned bundle's own family.
  const { bundleDir, pinned } = pinnedFromDisk();
  const prefix = editionWasmPrefix(bundleDir);
  const files = [
    ...[...pinned].map(([n, e]) => file(`${prefix}/${n}`, e.sha256, e.size)),
    file("pdfjs/wasm/jbig2.wasm", "e6bee67724a7b543".padEnd(64, "0"), 104852),
    file("pdfjs/wasm/openjpeg.wasm", "004a0e62db930ba9".padEnd(64, "0"), 252032),
    file("pdfjs/wasm/qcms_bg.wasm", "663d86126d5f5fcb".padEnd(64, "0"), 96589),
    file("pdfjs/wasm/quickjs-eval.wasm", "7bcacc9f22cacf7e".padEnd(64, "0"), 469105),
  ];
  assert.deepEqual(frankensimWasmMismatches(files, bundleDir, pinned), []);
});

test("an edition with no FrankenSim wasm at all is refused, not silently accepted", () => {
  // The vacuous case: a check that only compared files it FOUND would pass an edition carrying
  // none, which is how a placeholder-shipping export stayed green.
  const { bundleDir, pinned } = pinnedFromDisk();
  const mismatches = frankensimWasmMismatches(
    [file("index.html", "a".repeat(64), 10)],
    bundleDir,
    pinned,
  );
  assert.equal(mismatches.length, pinned.size);
  assert.ok(mismatches.every((m) => m.reason === "pinned-file-missing"));
});
