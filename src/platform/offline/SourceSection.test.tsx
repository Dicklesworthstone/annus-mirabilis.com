import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../../content/provenance/yaml.ts";
import {
  plainText,
  type SourceBlock,
  spanTextDigest,
  type TranslationUnit,
} from "../../content/schemas/source.ts";
import { loadSourceAliases } from "../../reader/anchors/sourceAliases.ts";
import { type BilingualEdition, sortBlocksByManifest } from "../../reader/faces/bilingualLoader.ts";
import { chapterFixture, fixtureMath } from "./chapter.test.mjs";
import { type OfflineChapterInput, packageOfflineChapter } from "./chapter.ts";
import { renderOfflineSources } from "./SourceSection.tsx";
import {
  OfflineSourceError,
  offlineMarkupIds,
  offlineSourceIds,
  selectOfflineSources,
} from "./sourceProjection.ts";

function records<T extends { id: string }>(directory: string): T[] {
  return readdirSync(directory)
    .filter((name) => /\.(?:json|ya?ml)$/u.test(name))
    .sort()
    .flatMap((name) => {
      const text = readFileSync(join(directory, name), "utf8");
      const value = name.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
      return value && typeof value === "object" && !Array.isArray(value) && "id" in value
        ? [value as T]
        : [];
    });
}

function edition(paper: string): BilingualEdition {
  const blocks = records<SourceBlock>("content/source-blocks/" + paper);
  const units = records<TranslationUnit>("content/translation-units/" + paper);
  const manifest = parseYaml(
    readFileSync("content/source-blocks/" + paper + "/manifest.yaml", "utf8"),
  ) as {
    units: { id: string }[];
  };
  sortBlocksByManifest(
    blocks,
    manifest.units.map((record) => record.id),
  );
  return {
    paper: { slug: paper } as BilingualEdition["paper"],
    blocks,
    units,
    alignment: parseYaml(
      readFileSync("content/alignments/" + paper + ".yaml", "utf8"),
    ) as BilingualEdition["alignment"],
  };
}

test("every source section keeps its canonical addresses, equations and footnotes without reader controls", () => {
  let sections = 0;
  for (const paper of ["mass-energy", "brownian-motion", "light-quanta", "special-relativity"]) {
    const original = edition(paper);
    for (const section of new Set(original.blocks.map((block) => block.section).filter(Boolean))) {
      const selection = selectOfflineSources(original, section!, "scaffold")!;
      const addresses = new Set(selection.blocks.flatMap(offlineSourceIds));
      const sources = renderOfflineSources(
        selection,
        loadSourceAliases(process.cwd(), paper, addresses),
      );
      const ids = offlineMarkupIds(sources.html);
      for (const id of addresses) expect(ids.has(id)).toBe(true);
      for (const unit of selection.units) expect(ids.has("en-" + unit.id)).toBe(true);
      for (const match of sources.html.matchAll(/\\shref="#([^"]+)"/gu))
        expect(ids.has(match[1]!) || match[1] === "explanation-" + section).toBe(true);
      expect(sources.html).not.toMatch(/<(?:button|script|img|link|input|select)\\b/u);
      expect(sources.html).not.toContain("data-source-draft-notice");
      sections++;
    }
  }
  expect(sections).toBeGreaterThanOrEqual(28);
});

test("the renderer refuses a dropped canonical address (SourceSection.tsx:122)", () => {
  const original = edition("mass-energy");
  const selection = selectOfflineSources(original, "s0", "scaffold")!;
  const changed = {
    ...selection,
    blocks: selection.blocks.map((block) =>
      block.kind === "closing"
        ? {
            ...block,
            sentenceSpans: [
              {
                id: "closing-required-s1",
                span: {
                  start: 0,
                  end: 1,
                  blockRevision: block.revision,
                  textDigest: spanTextDigest(plainText(block.inlines)),
                },
              },
            ],
          }
        : block,
    ),
  };
  let failure: unknown;
  try {
    renderOfflineSources(changed, {});
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(OfflineSourceError);
  expect((failure as OfflineSourceError).code).toBe("offline-source-anchor");
});

test("real mass-energy source and translation survive the same renderers in a standalone chapter", () => {
  const source = edition("mass-energy");
  const { blocks, units } = source;
  const original = JSON.stringify({ blocks, units });
  const selection = selectOfflineSources(source, "s0", "scaffold");
  expect(selection).not.toBeNull();
  if (!selection) throw new Error("The real source fixture must reach its section.");
  const addresses = new Set(selection.blocks.flatMap(offlineSourceIds));
  const aliases = loadSourceAliases(process.cwd(), "mass-energy", addresses);
  const sources = renderOfflineSources(selection, aliases);
  const ids = offlineMarkupIds(sources.html);
  for (const id of addresses) expect(ids.has(id)).toBe(true);
  for (const unit of selection.units) expect(ids.has("en-" + unit.id)).toBe(true);
  expect(sources.html).toContain('data-offline-source-face="german"');
  expect(sources.html).toContain('data-offline-source-face="english"');
  expect(sources.html).toContain("<math");
  expect(sources.html).not.toMatch(/<(?:button|script|img|link)\b/u);
  expect(sources.html).not.toContain("Machine draft, not reviewed");
  expect(sources.html).not.toContain("data-source-draft-notice");
  const fixture = chapterFixture() as unknown as OfflineChapterInput;
  const chapter = packageOfflineChapter(
    {
      ...fixture,
      paper: { ...fixture.paper, id: "mass-energy" },
      section: { ...fixture.section, id: "s0" },
      arguments: fixture.arguments.map((argument) => ({
        ...argument,
        paper: "mass-energy",
        section: "s0",
      })),
      sources,
      identity: { ...fixture.identity, translationRevision: sources.coverage.translationRevision },
    },
    fixtureMath,
  );
  const chapterIds = offlineMarkupIds(chapter.html);
  for (const match of chapter.html.matchAll(/\shref="#([^"]+)"/gu))
    expect(chapterIds.has(match[1]!), `Local chapter link #${match[1]} must resolve`).toBe(true);
  expect(chapter.entry.sources?.germanBlocks).toBe(selection.blocks.length);
  expect(chapter.entry.sources?.englishUnits).toBe(selection.units.length);
  expect(chapter.html).toContain('id="explanation-s0"');
  expect(chapter.html).toContain(sources.coverage.translationRevision!);
  expect(chapter.entry.bytes).toBeLessThanOrEqual(fixture.budget.rawBytes);
  expect(JSON.stringify({ blocks, units })).toBe(original);
});

test("packaging refuses coverage that names a different translation (chapter.ts:191)", () => {
  const input = chapterFixture() as unknown as OfflineChapterInput;
  let failure: unknown;
  try {
    packageOfflineChapter(
      {
        ...input,
        sources: {
          html: '<p id="s4-p1">Source</p>',
          coverage: {
            germanBlocks: 1,
            englishUnits: 1,
            revision: "a".repeat(64),
            translationRevision: "b".repeat(64),
          },
        },
      },
      fixtureMath,
    );
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(OfflineSourceError);
  expect((failure as OfflineSourceError).code).toBe("offline-source-coverage");
});
