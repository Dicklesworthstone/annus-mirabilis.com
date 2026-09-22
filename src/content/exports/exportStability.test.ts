/**
 * "Stable" in this bead's title has two halves, and the suite next door only had one.
 *
 * am-cm-machine-readable-exports-xgy. exports.test.ts already runs the emitter twice into two
 * temp directories and compares index entries, file bytes and index.json text. That arm is real
 * and I checked it rather than assuming: there is no Date, now(), toISOString, Math.random or
 * uuid anywhere in the emitter surface, so it has nothing to be fooled by today. This file adds
 * the two properties that arm cannot establish.
 *
 * ONE. SAMPLING CANNOT SEE A COARSE STAMP. Two emitter calls milliseconds apart agree whenever
 * the varying thing changes more slowly than the gap between them. A build stamp at second or
 * date granularity is the ordinary case: it would pass that test every time it ran and still
 * make two builds on two days differ. So the absence of a time or entropy source is asserted
 * STRUCTURALLY here, over the emitter's own sources, rather than sampled. The two are
 * complementary and neither substitutes for the other: this one cannot prove the output is
 * deterministic, and that one cannot prove it will still be tomorrow.
 *
 * TWO. THE FORMATS MUST CARRY THE SAME UNITS. Markdown, TEI and TSV are today renderers over
 * one extraction - emitter.ts builds sectionExport once and hands the same object to the JSON
 * writer, generateSectionMarkdown, generateTeiXml and generateParallelCorpusTsv - so divergence
 * is currently impossible by construction. That is exactly why this test is cheap now and
 * expensive later. Nothing in the code says the single extraction is load-bearing, and the
 * moment someone adds a second path for one format the golden files would simply be
 * regenerated for both and nothing would report it. A golden pins a format against its own past
 * self; it cannot notice two formats drifting apart together.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { emitMachineReadableExports } from "./emitter.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The section-unit anchor in the Markdown export: a heading of the form `### [<id>]`. */
const MARKDOWN_UNIT_ID = /^### \[([^\]]+)\]$/gm;

function fixturePayload(rootDir: string) {
  return {
    contentRevision: "stability-fixture-rev-1",
    releaseProfile: "preview" as const,
    papers: [
      {
        id: "brownian-motion",
        slug: "brownian-motion",
        title: FIXTURE_BROWNIAN_PAPER.titleEnglishWorking,
        germanTitle: FIXTURE_BROWNIAN_PAPER.titleGerman,
        authorLine: FIXTURE_BROWNIAN_PAPER.authorLine,
        bibKey: FIXTURE_BROWNIAN_PAPER.bibKey,
        dates: FIXTURE_BROWNIAN_PAPER.dates,
        journal: FIXTURE_BROWNIAN_PAPER.journal,
        sections: [{ id: "bm-sec-04", title: "§ 4. On the Irregular Motion" }],
      },
    ],
    sourceBlocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
    translationUnits: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
    rootDir,
  };
}

describe("export stability: the formats carry one unit set, and nothing is stamped", () => {
  test("every section's JSON and Markdown carry exactly the same unit ids", async () => {
    const root = await mkdtemp(resolve(process.env.AM_TEST_TMP ?? tmpdir(), "am-parity-"));
    const index = await emitMachineReadableExports(fixturePayload(root));

    const sectionJsonPaths = index.files
      .map((file) => file.path)
      .filter((path) => path.startsWith("papers/") && path.endsWith(".json") && path.includes("/"))
      .filter((path) => path.split("/").length === 3);

    // Non-vacuity, on purpose and with its reason: a filter that matched nothing would make the
    // comparison below run zero times and report a clean parity it never checked.
    expect(sectionJsonPaths.length).toBeGreaterThan(0);

    const mismatches: string[] = [];
    let unitsCompared = 0;

    for (const jsonPath of sectionJsonPaths) {
      const markdownPath = jsonPath.replace(/\.json$/, ".md");
      const jsonText = await readFile(resolve(root, "exports/v1", jsonPath), "utf8");
      const markdownText = await readFile(resolve(root, "exports/v1", markdownPath), "utf8");

      const jsonIds = ((JSON.parse(jsonText).sentences ?? []) as { id: string }[]).map(
        (sentence) => sentence.id,
      );
      const markdownIds = [...markdownText.matchAll(MARKDOWN_UNIT_ID)].map(
        (match) => match[1] as string,
      );

      // Each format's own ids must also be distinct, or a set comparison would hide a duplicate.
      expect({ path: jsonPath, distinct: new Set(jsonIds).size }).toEqual({
        path: jsonPath,
        distinct: jsonIds.length,
      });

      if (jsonIds.length === 0) mismatches.push(`${jsonPath}: carries no units at all`);
      unitsCompared += jsonIds.length;

      const onlyJson = jsonIds.filter((id) => !markdownIds.includes(id));
      const onlyMarkdown = markdownIds.filter((id) => !jsonIds.includes(id));
      if (onlyJson.length > 0) mismatches.push(`${jsonPath}: in JSON only ${onlyJson.join(", ")}`);
      if (onlyMarkdown.length > 0) {
        mismatches.push(`${markdownPath}: in Markdown only ${onlyMarkdown.join(", ")}`);
      }
    }

    expect({ mismatches, sections: sectionJsonPaths.length, unitsCompared }).toEqual({
      mismatches: [],
      sections: sectionJsonPaths.length,
      unitsCompared,
    });
    expect(unitsCompared).toBeGreaterThan(0);
  });

  test("the emitter surface draws on no clock and no entropy", () => {
    // Anchored, and it prints what it matched. An unanchored search for "Date" hits the type
    // name ExportDateEntry and would report a stamp in a file that has none, which is the
    // direction this repository's measurement errors reliably take.
    const forbidden: readonly [string, RegExp][] = [
      ["new Date", /\bnew\s+Date\b/],
      ["Date.now", /\bDate\s*\.\s*now\b/],
      ["Math.random", /\bMath\s*\.\s*random\b/],
      ["toISOString", /\btoISOString\b/],
      ["randomUUID", /\brandomUUID\b/],
      ["process.hrtime", /\bhrtime\b/],
      ["performance.now", /\bperformance\s*\.\s*now\b/],
    ];
    const surface = [
      "emitter.ts",
      "markdown.ts",
      "tei.ts",
      "jsonld.ts",
      "parallelCorpus.ts",
      "rights.ts",
      "schemas.ts",
      "types.ts",
      "discovery.ts",
    ];

    const found: string[] = [];
    for (const file of surface) {
      const source = readFileSync(resolve(HERE, file), "utf8");
      for (const [token, pattern] of forbidden) {
        const lines = source.split("\n");
        for (let index = 0; index < lines.length; index++) {
          if (pattern.test(lines[index] as string)) {
            found.push(`${file}:${index + 1}: ${token} -- ${(lines[index] as string).trim()}`);
          }
        }
      }
    }

    expect({ found, filesScanned: surface.length, tokens: forbidden.length }).toEqual({
      found: [],
      filesScanned: surface.length,
      tokens: forbidden.length,
    });
  });
});
