/**
 * The German face publishes the frozen manifest's ids (am-german-face-anchors-not-frozen-ids-jtv6):
 * every content anchor on the rendered face is a manifest id or a declared alias to the block that
 * absorbed it, no retired id names anything else, and the concordance's first-use anchors resolve.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { PaperPage } from "../../reader/PaperPage.tsx";
import { loadConcordanceForPaper } from "../notation/loader.ts";
import { parseYaml } from "../provenance/yaml.ts";
import { loadGermanSourceFace, printedUnits } from "./germanSourceFace.ts";
import { ManifestAnchorError, manifestAnchors } from "./manifestAnchors.ts";

const ROOT = process.cwd();
const PAPERS = ["light-quanta", "brownian-motion", "mass-energy"] as const;
/** An id shaped like a content id: sN, sN-..., eq-..., the masthead and the closing lines. */
const CONTENT_ID = /^(?:s\d+(?:-.*)?|eq-.+|masthead-.+|closing-.+)$/;

const retiredIds = (paper: string) =>
  new Set(
    (
      (
        parseYaml(readFileSync(join(ROOT, "content/aliases", `${paper}.yaml`), "utf8")) as {
          aliases?: { retiredId: string }[];
        }
      ).aliases ?? []
    ).map((a) => a.retiredId),
  );

async function faceIds(paper: string) {
  const html = renderToStaticMarkup(await PaperPage({ paperId: paper, face: "german" } as never));
  const ids = [...html.matchAll(/<(\w+)[^>]*?\sid="([^"]+)"([^>]*)>/g)].map((m) => ({
    id: m[2] as string,
    aliasOf: /data-alias-of="([^"]+)"/.exec(m[0])?.[1],
  }));
  return ids.filter((x) => CONTENT_ID.test(x.id));
}

describe("the German face's anchors are the frozen manifest's ids", () => {
  for (const paper of PAPERS)
    test(`${paper}: every content anchor is a manifest id, or a declared alias to its block`, async () => {
      // A frozen sentence id is an anchor too: since dispatch 255 every German face renders its
      // source blocks, whose sentence spans carry their manifest's sentence ids (relativity's
      // always did), where the ledger draft's face had none.
      const edition = await loadBilingualEdition(paper);
      const manifest = new Set([
        ...printedUnits(ROOT, paper).map((u) => u.id),
        ...(edition?.blocks ?? []).flatMap((b) => b.sentenceSpans.map((span) => span.id)),
      ]);
      const retired = retiredIds(paper);
      const ids = await faceIds(paper);
      // Not vacuous: the face has its paragraphs, displays and footnotes.
      expect(ids.length).toBeGreaterThan(20);
      for (const { id, aliasOf } of ids) {
        if (aliasOf !== undefined) {
          // A retired id appears only here, and points at a published manifest block.
          expect(retired.has(id)).toBe(true);
          expect(manifest.has(aliasOf)).toBe(true);
        } else {
          expect({ id, isManifestId: manifest.has(id) }).toEqual({ id, isManifestId: true });
          expect({ id, isRetired: retired.has(id) }).toEqual({ id, isRetired: false });
        }
      }
      // One element per anchor.
      const plain = ids.map((x) => x.id);
      expect(new Set(plain).size).toBe(plain.length);
    });

  test("mass-energy: s0-p11 to s0-p15 are published, and s0-p8 to s0-p10 only as aliases of s0-p7", async () => {
    const ids = await faceIds("mass-energy");
    const plain = new Set(ids.filter((x) => !x.aliasOf).map((x) => x.id));
    for (const id of ["s0-p11", "s0-p12", "s0-p13", "s0-p14", "s0-p15", "eq-s0-d1", "eq-s0-d7"])
      expect(plain.has(id)).toBe(true);
    expect(ids.filter((x) => x.aliasOf).map((x) => `${x.id}->${x.aliasOf}`)).toEqual([
      "s0-p8->s0-p7",
      "s0-p9->s0-p7",
      "s0-p10->s0-p7",
    ]);
  });

  test("every first-use anchor the concordances record resolves on the German face", async () => {
    let checked = 0;
    for (const paper of PAPERS) {
      const published = new Set((await faceIds(paper)).map((x) => x.id));
      for (const entry of loadConcordanceForPaper(paper).entries) {
        const anchors = [
          entry.collision?.firstUseAnchor,
          ...(entry.collision?.firstUseBySection ?? []).map((f) => f.anchor),
        ].filter((a): a is string => typeof a === "string");
        for (const anchor of anchors) {
          checked++;
          const bare = anchor.replace(/^[a-z]{2}-/, "");
          expect({ paper, anchor, onFace: published.has(bare) }).toEqual({
            paper,
            anchor,
            onFace: true,
          });
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("a face the manifest cannot pair is refused, never guessed", () => {
  test("(manifestAnchors.ts:111) manifest-anchors-unpaired when the manifest lacks one paragraph", () => {
    const face = loadGermanSourceFace("mass-energy", ROOT);
    if (!face) throw new Error("mass-energy has no German face");
    const units = printedUnits(ROOT, "mass-energy");
    const lastParagraph = units.map((u) => u.kind).lastIndexOf("paragraph");
    const short = units.filter((_, i) => i !== lastParagraph);
    let code = "";
    try {
      manifestAnchors("mass-energy", face.blocks, short, face.printedPages.pages);
    } catch (error) {
      expect(error).toBeInstanceOf(ManifestAnchorError);
      code = (error as ManifestAnchorError).code;
    }
    expect(code).toBe("manifest-anchors-unpaired");
    // And the real manifest pairs.
    expect(() =>
      manifestAnchors("mass-energy", face.blocks, units, face.printedPages.pages),
    ).not.toThrow();
  });
});
