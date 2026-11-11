/** Server-only essay compiler used by static routes, search and course composition. */
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEquationRecord } from "../../equations/record.ts";
import { compileEquation } from "../../equations/render.ts";
import type { CompiledEquation } from "../../equations/viewTypes.ts";
import { catalogueLabel, isCatalogueId, REGISTERED_IDS } from "../../experiments/catalogue.ts";
import { checkVoice } from "../checks/voice/index.ts";
import { loadResultCards } from "../results/resultCards.ts";
import { type Essay, type EssayAnchor, essayFailure, validateEssay } from "../schemas/essay.ts";
import { type Citation, validateReadingRecord } from "../schemas/reading.ts";
import { type SourceBlock, validateSourceBlock } from "../schemas/source.ts";
import { strictParse } from "../schemas/strictParse.ts";
import { type EssayBlock, type EssayInline, essayInlineText,
  parseEssayMarkdown } from "./markdown.ts";
import { type CheckedEssayValue, resolveEssayValues } from "./values.ts";

export type EssayLink = EssayAnchor & Readonly<{
  href: string;
  title: string;
  source?: SourceBlock;
  usedAt: readonly string[];
}>;
export type CompiledEssay = Essay & Readonly<{
  blocks: readonly EssayBlock[];
  links: ReadonlyMap<string, EssayLink>;
  values: ReadonlyMap<string, CheckedEssayValue>;
  renderedEquations: ReadonlyMap<string, CompiledEquation>;
  bibliography: readonly Citation[];
  searchText: string;
}>;

function readText(path: string): string {
  if (!existsSync(path)) return essayFailure(path, "Referenced content does not exist.");
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512 * 1024)
    return essayFailure(path, "Expected a bounded regular content file.");
  return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path));
}
function record(root: string, path: string): unknown {
  return strictParse(readText(join(root, path)), path.endsWith(".json") ? "json" : "yaml", path);
}

/** Both metadata and bodies participate in the content build digest; missing pairs cannot disappear. */
export function essaySourceFiles(root = process.cwd(),
  corpusDir = "content"): readonly Readonly<{ path: string; text: string }>[] {
  const directory = join(root, corpusDir, "essays");
  if (!existsSync(directory)) return [];
  const names = readdirSync(directory).sort();
  if (names.length > 16) return essayFailure(directory,
    "The series contains at most eight metadata/body pairs.");
  for (const name of names) {
    if (!/^[a-z][a-z0-9-]*\.(yaml|md)$/.test(name))
      essayFailure(directory, "Unexpected essay source file: " + name);
    const partner = name.endsWith(".md") ? name.slice(0, -3) + ".yaml" : name.slice(0, -5) + ".md";
    if (!names.includes(partner)) essayFailure(directory,
      "Missing metadata/body partner for " + name);
  }
  return names.map((name) => ({ path: "essays/" + name, text: readText(join(directory, name)) }));
}

function qualified(anchorId: string, path: string): readonly [string, string] {
  const parts = anchorId.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1])
    return essayFailure(path, "Paper-local anchors use paper/id.");
  return [parts[0], parts[1]];
}
export function resolveEssayAnchor(root: string, anchor: EssayAnchor, essays: ReadonlyMap<string,
  Essay>, path: string): Omit<EssayLink, "usedAt"> {
  const key = anchor.anchorId;
  if (anchor.kind === "instrument") {
    if (!isCatalogueId(key) || !REGISTERED_IDS.includes(key))
      return essayFailure(path, "Instrument is not available: " + key);
    return { ...anchor, href: "/lab/" + key + "/", title: catalogueLabel(key) };
  }
  if (anchor.kind === "essay") {
    const target = essays.get(key);
    if (!target) return essayFailure(path, "Essay is not published: " + key);
    return { ...anchor, href: "/essays/" + key + "/", title: target.title };
  }
  if (anchor.kind === "source") {
    const [paper, id] = qualified(key, path);
    const source = validateSourceBlock(record(root,
      "content/source-blocks/" + paper + "/" + id + ".yaml"), path);
    if (source.id !== id || source.paper !== paper) return essayFailure(path,
      "Source identity differs from its anchor.");
    const pages = [...new Set(source.locators.map((locator) => locator.printedPage))].join(", ");
    return {
      ...anchor, source,
      href: "/papers/" + paper + "/view/german/#" + id,
      title: paper.replaceAll("-", " ") + ", " + (source.section ?? "source").replace(/^s/,
        "§") + ", p. " + pages,
    };
  }
  if (anchor.kind === "foundation") {
    const target = validateReadingRecord(record(root, "content/foundations/" + key + ".json"),
      path);
    if (target.kind !== "foundation" || target.id !== key) return essayFailure(path,
      "Foundation identity differs from its anchor.");
    return { ...anchor, href: "/foundations/" + key + "/", title: target.title };
  }
  const [paper, id] = qualified(key, path);
  if (anchor.kind === "result") {
    const deck = loadResultCards(root, paper);
    if (!deck || deck.problems.length)
      return essayFailure(path, "Result deck is unavailable or invalid: " + paper);
    const result = deck.cards.find((card) => card.id === id);
    if (!result) return essayFailure(path, "Unresolved result " + key);
    return { ...anchor, title: result.title,
      href: "/papers/" + paper + "/view/results/#result-" + id };
  }
  const target = record(root, "content/arguments/" + paper + "/" + id + ".json") as Record<string,
    unknown>;
  if (!target || target.id !== id || target.paper !== paper || typeof target.title !== "string")
    return essayFailure(path, "Paper content identity differs from its anchor.");
  return {
    ...anchor, title: target.title,
    href: "/papers/" + paper + "/#" + id,
  };
}

function prose(essay: Essay, blocks: readonly EssayBlock[], values: ReadonlyMap<string,
  string>): string[] {
  return [
    essay.title, essay.label, essay.r0Summary, ...essay.limits,
    ...essay.anchors.map((anchor) => anchor.role),
    ...essay.transferExamples.flatMap((example) => [example.domain, example.example,
      example.sharedMove, example.whereItStops]),
    ...blocks.flatMap((block) => block.kind === "heading" ? [block.text]
      : block.kind === "paragraph" ? [essayInlineText(block.inlines, values)]
      : block.kind === "list" ? block.items.map((inlines) => essayInlineText(inlines,
        values)) : []),
  ];
}

/** Informational vocabulary remains visible to its owner without blocking publication. */
export function validateEssayProse(passages: readonly string[], path: string): void {
  for (const [index, passage] of passages.entries()) {
    const findings = checkVoice(passage, { context: "prose" }).filter(
      (finding) => finding.severity !== "info",
    );
    if (findings.length) {
      essayFailure(
        path + ":prose-" + index,
        "Shared voice check: " + findings.map((finding) => finding.rule).join(", "),
      );
    }
  }
}

/** A fresh load reflects edited source; no generated or module-level cache becomes a second truth. */
export function loadEssays(root = process.cwd()): readonly CompiledEssay[] {
  const files = essaySourceFiles(root);
  const bodies = new Map(files.map((file) => [file.path, file.text]));
  const metadata = files.filter((file) => file.path.endsWith(".yaml")).map((file) => {
    const essay = validateEssay(strictParse(file.text, "yaml", file.path), file.path);
    if (file.path !== "essays/" + essay.slug + ".yaml")
      return essayFailure(file.path, "The slug must match the metadata filename.");
    return essay;
  }).sort((a, b) => a.number - b.number);
  const bySlug = new Map(metadata.map((essay) => [essay.slug, essay]));
  if (bySlug.size !== metadata.length) return essayFailure("essays", "Repeated essay slug.");
  return metadata.map((essay): CompiledEssay => {
    const path = "content/essays/" + essay.slug;
    const body = bodies.get("essays/" + essay.body);
    if (body === undefined) return essayFailure(path, "Missing body.");
    const blocks = parseEssayMarkdown(body, path + ".md");
    const transferIds = new Set(essay.transferExamples.flatMap((entry) => [
      "transfer-" + entry.id, entry.id + "-title",
    ]));
    if (blocks.some((block) => transferIds.has(block.id)))
      essayFailure(path, "A body block collides with a rendered transfer ID.");
    const links = new Map<string, EssayLink>();
    for (const anchor of essay.anchors)
      links.set(anchor.anchorId, { ...resolveEssayAnchor(root, anchor, bySlug, path), usedAt: [] });
    const values = new Map(resolveEssayValues(root, essay.quotedValues, path)
      .map((value) => [value.id, value]));
    const renderedEquations = new Map(essay.equations.map(({ paper, equationId }) => {
      const equationPath = "content/equations/" + paper + "/" + equationId + ".json";
      const equation = parseEquationRecord(record(root, equationPath), equationPath);
      if (equation.id !== equationId || equation.paper !== paper)
        return essayFailure(path, "Equation identity differs from its declared target.");
      return [equationId, compileEquation(equation)] as const;
    }));
    const usedValues = new Set<string>();
    const usedEquations = new Set<string>();
    function linkUse(anchorId: string, blockId: string): void {
      const link = links.get(anchorId);
      if (!link) return essayFailure(path + "#" + blockId, "Undeclared anchor " + anchorId);
      links.set(anchorId, { ...link, usedAt: [...new Set([...link.usedAt, blockId])] });
    }
    function inlineUse(inlines: readonly EssayInline[], blockId: string): void {
      for (const inline of inlines) {
        if (inline.kind === "link") linkUse(inline.anchorId, blockId);
        if (inline.kind === "value") {
          if (!values.has(inline.id)) essayFailure(path + "#" + blockId,
            "Undeclared quoted value " + inline.id);
          usedValues.add(inline.id);
        }
      }
    }
    for (const block of blocks) {
      if (block.kind === "paragraph") inlineUse(block.inlines, block.id);
      if (block.kind === "list") for (const item of block.items) inlineUse(item, block.id);
      if (block.kind === "equation") {
        if (!renderedEquations.has(block.equationId))
          essayFailure(path + "#" + block.id, "Undeclared equation " + block.equationId);
        usedEquations.add(block.equationId);
      }
      if (block.kind === "quotation") {
        linkUse(block.anchorId, block.id);
        if (!links.get(block.anchorId)?.source)
          essayFailure(path + "#" + block.id, "A quotation must resolve source text.");
      }
    }
    for (const id of values.keys()) if (!usedValues.has(id)) essayFailure(path,
      "Unused quoted value " + id);
    for (const id of renderedEquations.keys()) if (!usedEquations.has(id)) essayFailure(path,
      "Unused equation " + id);
    for (const related of essay.related)
      if (related === essay.slug || !bySlug.has(related)) essayFailure(path,
        "Unresolved related essay " + related);
    for (const reviewId of essay.reviewRecordIds)
      if (!existsSync(join(root, "content/reviews", reviewId + ".yaml")))
        essayFailure(path, "Unresolved review record " + reviewId);
    const bibliography = essay.citations.map((id) => {
      const citation = validateReadingRecord(record(root, "content/bibliography/" + id + ".json"),
        path);
      if (citation.kind !== "citation" || citation.id !== id) return essayFailure(path,
        "Unresolved citation " + id);
      return citation;
    });
    const text = prose(essay, blocks, new Map([...values].map(([id, value]) => [id, value.text])));
    validateEssayProse(text, path);
    return { ...essay, blocks, links, values, renderedEquations, bibliography,
      searchText: text.join(" ") };
  });
}

export function loadEssay(slug: string, root = process.cwd()): CompiledEssay | null {
  return loadEssays(root).find((essay) => essay.slug === slug) ?? null;
}
