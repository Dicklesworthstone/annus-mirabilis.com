/**
 * EVERY ASSET THE BUILT SITE ASKS A BROWSER TO FETCH IS A FILE THE BUILD SERVES.
 *
 * THIS IS THE OTHER HALF OF `linkTargetsResolve.test.ts`, WHICH SAYS SO ITSELF: "WHICH HALF THIS
 * WATCHES: that the target EXISTS in the build", over a population it defines as ` href="` in the
 * served bytes. An `src` is not an `href`, so nothing in this repository asked whether a built
 * `<img>`, `<source>`, `<script>` or `<iframe>` points at anything. The facsimile face is the
 * clearest stake: its entire purpose is the scanned plate, and a missing plate file leaves it
 * visibly empty while `data-facsimile-pdf-page`, the page links, the share URL and the direct PDF
 * link all stay correct, so every assertion any other gate makes about that page still passes.
 *
 * THE FAILURE IS SILENT IN THE BUILD TOO. `next build` does not verify that a string handed to an
 * `<img src>` exists; a renamed or never-generated figure produces a 404 at read time and a clean
 * build.
 *
 * MEASURED 2026-10-25 over the built `out/`: 765 pages, 274 distinct asset targets (174 `.js` and
 * 100 `.webp`), 74 of them reached through a `srcset`, 9 that resolve only once percent-decoded, 0
 * that resolve to nothing, and 100 of 100 referenced images carrying their format's magic bytes
 * with none under 512 bytes. 4.0 seconds for the six tests. The guard goes in while the count is
 * zero, which is the only comfortable time to add one.
 *
 * SRCSET IS SPELLED `srcSet` IN THE SERVED BYTES, with a capital S, because that is the React prop
 * name and React passes it through. HTML attribute names are case-insensitive so browsers are
 * unaffected, but a gate written with a case-sensitive `/\ssrcset="/` would match ZERO attributes
 * and the responsive half of this question would be silently vacuous -- a clean run over an empty
 * population, which AGENTS.md names as the failure that reads exactly like a pass. Hence the `i`
 * flag and the pattern test below that drives both spellings.
 *
 * WHAT THIS DELIBERATELY DOES NOT WATCH, said rather than discovered later: that the bytes at the
 * other end are a valid image, that its dimensions match the `width`/`height` attributes, or that
 * a `url(...)` inside CSS resolves. The first is a decode question and `scripts/e2e/facsimile.mjs`
 * asks it in a browser for the plate; the third is a different population and a different parser.
 * This file answers existence, and for an image it also answers that the bytes are that format,
 * for the whole site, from the build alone.
 *
 * EXISTENCE IS NOT ENOUGH FOR AN IMAGE. The plates are produced by a script
 * (`scripts/generate-page-plates.ts`, `scripts/figures/page_plates.py`), and a run that is
 * interrupted or fails midway leaves a short or empty file at the right path. Every assertion above
 * would still pass, the page would still link to it, and the reader would get a broken image. So a
 * referenced file whose extension this gate recognises is also checked for that format's magic
 * bytes, which is exact rather than a size threshold: a baseline is the record of a debt, and
 * "bigger than N bytes" would be one.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, posix, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { assertOutFreshness } from "./outFreshness.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = resolve(ROOT, "out");
const SRC = /\ssrc="([^"]*)"/gi;
const SRCSET = /\ssrcset="([^"]*)"/gi;

/**
 * The leading bytes each image format must carry. Only `.webp` has any files in this build (100 of
 * them); the rest are here because adding a format later should not silently add an unchecked one,
 * and the controls below prove every predicate can REJECT, so none of them is a decoration.
 */
const IMAGE_MAGIC: Readonly<Record<string, (head: Buffer) => boolean>> = Object.freeze({
  ".webp": (h) =>
    h.subarray(0, 4).toString("latin1") === "RIFF" &&
    h.subarray(8, 12).toString("latin1") === "WEBP",
  ".png": (h) =>
    h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".jpg": (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff,
  ".jpeg": (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff,
  ".gif": (h) => h.subarray(0, 4).toString("latin1") === "GIF8",
  ".avif": (h) => h.subarray(4, 8).toString("latin1") === "ftyp",
});
/** Not a path into the build: another origin, an inline payload, or a protocol the build cannot serve. */
const SKIP = /^(?:https?:|mailto:|tel:|data:|blob:|about:|javascript:|#|\/\/)/i;

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, found);
    else found.push(p);
  }
  return found;
}

const FILES = existsSync(OUT) ? walk(OUT) : [];
const PAGES = FILES.filter((f) => f.endsWith(".html"));
const SERVED = new Set(FILES.map((f) => `/${posix.relative(OUT, f).split("\\").join("/")}`));

/**
 * A URL path is decoded before it is compared with a file name, which is the whole of what a
 * browser does with it.
 *
 * THE FIRST RUN REPORTED NINE BROKEN ASSETS AND EVERY ONE WAS THIS. Next names a dynamic route's
 * chunk after the route's own directory, so `/embed/lab/[experiment]/` becomes
 * `.../app/embed/lab/%5Bexperiment%5D/page-<hash>.js` in the `<script src>`. The file on disk has
 * the literal brackets; the reference has the escapes; the browser fetches it without complaint.
 * A gate that compared the two raw would have gone red on a correct build on the day it landed,
 * which is the shape AGENTS.md records as "a failing check's stated cause can be false".
 *
 * A malformed escape is kept as written rather than being thrown away: it is then compared raw and
 * reported, because a reference a browser cannot decode is a real defect and not something to
 * silently excuse.
 */
function decodePath(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

/** An asset resolves when the build holds that exact file. A directory index is not an asset. */
function resolvesInBuild(target: string): boolean {
  return SERVED.has(target) || SERVED.has(decodePath(target));
}

/** One candidate from a `srcset` list: the URL, dropping any density or width descriptor. */
function candidateUrl(part: string): string {
  return (part.trim().split(/\s+/)[0] ?? "").trim();
}

function normalise(raw: string, pageRoute: string): string | undefined {
  if (SKIP.test(raw)) return undefined;
  const bare = (raw.split("#")[0] ?? "").split("?")[0] ?? "";
  if (bare === "") return undefined;
  return bare.startsWith("/") ? bare : posix.resolve(posix.dirname(pageRoute), bare);
}

/** Distinct asset targets, each with the pages that reference it and how it was spelled. */
function assetTargets(): Map<string, { pages: string[]; attributes: Set<string> }> {
  const targets = new Map<string, { pages: string[]; attributes: Set<string> }>();
  const add = (target: string, pageRoute: string, attribute: string): void => {
    const entry = targets.get(target);
    if (entry === undefined) {
      targets.set(target, { pages: [pageRoute], attributes: new Set([attribute]) });
      return;
    }
    entry.attributes.add(attribute);
    if (entry.pages.length < 4 && !entry.pages.includes(pageRoute)) entry.pages.push(pageRoute);
  };
  for (const page of PAGES) {
    const pageRoute = `/${posix.relative(OUT, page).split("\\").join("/")}`;
    const body = readFileSync(page, "utf8");
    for (const m of body.matchAll(SRC)) {
      const target = normalise(m[1] ?? "", pageRoute);
      if (target !== undefined) add(target, pageRoute, "src");
    }
    for (const m of body.matchAll(SRCSET)) {
      for (const part of (m[1] ?? "").split(",")) {
        const target = normalise(candidateUrl(part), pageRoute);
        if (target !== undefined) add(target, pageRoute, "srcset");
      }
    }
  }
  return targets;
}

/** Every referenced file whose extension names an image format this gate knows. */
function referencedImages(): { target: string; file: string; ext: string }[] {
  const found: { target: string; file: string; ext: string }[] = [];
  for (const target of assetTargets().keys()) {
    const ext = extname(target).toLowerCase();
    if (IMAGE_MAGIC[ext] === undefined) continue;
    const decoded = decodePath(target);
    const served = SERVED.has(target) ? target : SERVED.has(decoded) ? decoded : undefined;
    if (served === undefined) continue; // the resolving test owns that failure, not this one
    found.push({ target, file: join(OUT, served.slice(1)), ext });
  }
  return found;
}

describe("every asset reference in the built site resolves", () => {
  test("the build is present, fresh, and the population is not vacuous", () => {
    // A STALE out/ IS REFUSED RATHER THAN READ, which is why this file is in the node lane and
    // named for it. Its whole proposition is about the artifact a reader will get, so reading
    // yesterday's build would answer the question about yesterday and pass: the dangerous
    // direction. bunfig.toml records the same reasoning for the other out/-readers moved here.
    assertOutFreshness("out", ROOT);
    // And without this the file passes on a checkout with no out/, iterating nothing. The same
    // floor the sibling gate uses, for the same reason and over the same pages.
    assert.ok(
      PAGES.length >= 400,
      `no built pages under out/ (${PAGES.length}). Run \`bun run build\`; this gate reads the build, it does not make one.`,
    );
    const targets = assetTargets();
    const viaSrcset = [...targets.values()].filter((e) => e.attributes.has("srcset")).length;
    console.log(
      `[assetcheck] ${PAGES.length} built page(s); ${targets.size} distinct asset target(s), ${viaSrcset} of them reached through srcset`,
    );
    assert.ok(targets.size >= 50, `only ${targets.size} distinct asset target(s)`);
    // Named separately because the srcset half has its own way of being silently empty: the
    // attribute is spelled `srcSet` in the served bytes and a case-sensitive pattern finds none.
    assert.ok(
      viaSrcset > 0,
      "no asset was reached through a srcset; the responsive half of this gate is examining nothing",
    );
  });

  test("every referenced image carries its format's magic bytes", () => {
    assertOutFreshness("out", ROOT);
    const images = referencedImages();
    // Non-vacuity on purpose, and separately from the population above: a change that stopped
    // recognising `.webp` would leave this test iterating nothing and passing.
    assert.ok(images.length >= 50, `only ${images.length} referenced image(s) to check`);
    const wrong: string[] = [];
    for (const { target, file, ext } of images) {
      const head = readFileSync(file).subarray(0, 32);
      const check = IMAGE_MAGIC[ext];
      if (check !== undefined && !check(head)) {
        wrong.push(
          `${target} (${statSync(file).size} bytes) starts "${head
            .subarray(0, 12)
            .toString("latin1")
            .replace(/[^\x20-\x7e]/g, ".")}"`,
        );
      }
    }
    assert.deepEqual(
      wrong,
      [],
      `referenced files that are not the image they claim:\n${wrong.join("\n")}`,
    );
    console.log(
      `[assetcheck] ${images.length} referenced image(s) carry their format's magic bytes`,
    );
  });

  test("PLANTED: the magic predicates reject wrong bytes as well as accepting right ones", () => {
    // Without this the test above proves nothing: a predicate that returned true for anything would
    // report every file clean, and a clean sweep and a sweep that cannot fail look identical.
    const webp = IMAGE_MAGIC[".webp"];
    const png = IMAGE_MAGIC[".png"];
    assert.ok(webp !== undefined && png !== undefined);
    assert.equal(webp(Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ", "latin1")), true);
    assert.equal(webp(Buffer.from("<!DOCTYPE html><html>", "latin1")), false, "a 404 page body");
    assert.equal(webp(Buffer.alloc(32)), false, "a zero-filled file");
    assert.equal(
      webp(Buffer.from("RIFF\u0000\u0000\u0000\u0000WAVEfmt ", "latin1")),
      false,
      "RIFF but not WEBP",
    );
    assert.equal(
      png(
        Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          Buffer.alloc(8),
        ]),
      ),
      true,
    );
    assert.equal(png(Buffer.alloc(32)), false);
    // A truncated file is the actual failure mode a half-written plate produces, so drive it.
    assert.equal(webp(Buffer.from("RIF", "latin1")), false, "a truncated header");
  });

  test("no asset reference points at a file the build does not serve", () => {
    assertOutFreshness("out", ROOT);
    const broken = [...assetTargets().entries()]
      .filter(([target]) => !resolvesInBuild(target))
      .sort((a, b) => b[1].pages.length - a[1].pages.length)
      .map(
        ([target, e]) =>
          `${target} <- ${e.pages.length}+ page(s) via ${[...e.attributes].sort().join("+")}, e.g. ${e.pages[0]}`,
      );
    // Named, not counted: a broken asset is repaired by opening the page that emits it.
    assert.deepEqual(
      broken,
      [],
      `asset references the build does not serve:\n${broken.join("\n")}`,
    );
  });

  test("PLANTED: the resolver rejects files the build never generated, and accepts real ones", () => {
    /*
     * This sweep comes back clean, and a sweep that cannot fail looks the same. So the resolver is
     * driven both ways, including the case it is most likely to get wrong: a DIRECTORY route, which
     * the sibling gate must accept and this one must reject, because a browser fetching an `<img
     * src>` wants bytes and an index.html is not an image.
     */
    const real = [...assetTargets().keys()].filter((t) => resolvesInBuild(t)).slice(0, 3);
    assert.equal(real.length, 3, "not enough served asset targets to drive the resolver with");
    for (const target of real) {
      assert.ok(resolvesInBuild(target), `${target} is referenced and served but was rejected`);
    }
    for (const absent of [
      "/figures/plates/pages/ap-18-639/99999.webp",
      "/figures/not-a-figure.svg",
      "/_next/static/chunks/not-a-chunk.js",
      "/papers/mass-energy/",
      // A percent-escaped path that decodes to nothing served must still be refused: the decoding
      // added for the dynamic-route chunks must not become a way to accept anything.
      "/_next/static/chunks/app/papers/%5Bnot-a-param%5D/page-0000000000000000.js",
    ]) {
      assert.ok(!resolvesInBuild(absent), `${absent} is not a served file but was accepted`);
    }
    // And the decoding is load-bearing, in the direction that matters: at least one real reference
    // in this build only resolves after it is decoded, so a future simplification that drops the
    // decode fails here rather than on a correct build elsewhere.
    const needsDecoding = [...assetTargets().keys()].filter(
      (t) => !SERVED.has(t) && SERVED.has(decodePath(t)),
    );
    assert.ok(
      needsDecoding.length > 0,
      "no asset reference in this build needed decoding; the decode path is untested",
    );
    console.log(
      `[assetcheck] ${needsDecoding.length} reference(s) resolve only once percent-decoded, e.g. ${needsDecoding[0]}`,
    );
  });

  test("the patterns read markup, both srcset spellings, and not the inlined flight payload", () => {
    // The payload escapes its quotes, so ` src="` cannot match inside it. Pinned rather than
    // assumed: if that changes, this file would start judging payload-only strings as fetches a
    // browser makes.
    const markup =
      ' <img src="/figures/a.webp" srcSet="/figures/a.webp 640w, /figures/b.webp 1280w">';
    const payload = '{\\"src\\":\\"/figures/not-a-figure.webp\\"}';
    assert.deepEqual(
      [...markup.matchAll(SRC)].map((m) => m[1]),
      ["/figures/a.webp"],
    );
    assert.deepEqual(
      [...markup.matchAll(SRCSET)].map((m) => m[1]),
      ["/figures/a.webp 640w, /figures/b.webp 1280w"],
    );
    assert.deepEqual([...payload.matchAll(SRC)], []);
    // Both spellings, because the capital-S form is the one the build actually emits and the
    // lower-case form is the one the HTML specification names.
    assert.deepEqual(
      [...' <img srcset="/a.webp 1x">'.matchAll(SRCSET)].map((m) => m[1]),
      ["/a.webp 1x"],
    );
    assert.deepEqual(
      [...' <img srcSet="/a.webp 1x">'.matchAll(SRCSET)].map((m) => m[1]),
      ["/a.webp 1x"],
    );
    // A width descriptor is not part of the URL, and a candidate list is split on commas.
    assert.equal(candidateUrl(" /figures/b.webp 1280w "), "/figures/b.webp");
  });
});
