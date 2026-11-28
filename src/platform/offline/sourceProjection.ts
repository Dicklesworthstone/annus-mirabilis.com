import type { Inline, SourceBlock, TranslationUnit } from "../../content/schemas/source.ts";
import type { BilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { sectionOfSourceId, unitSection } from "../../reader/faces/unitSections.ts";
import type { OfflineProfile } from "./server.ts";

export const OFFLINE_ENGLISH_PREFIX = "en-";

export class OfflineSourceError extends TypeError {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OfflineSourceError";
    this.code = code;
  }
}

export type OfflineSourceSelection = Readonly<{
  paper: string;
  section: string;
  blocks: readonly SourceBlock[];
  units: readonly TranslationUnit[];
  alignment: BilingualEdition["alignment"];
}>;

/** Source addresses, including displays embedded in a paragraph, remain the edition's own. */
export function offlineSourceIds(block: SourceBlock): readonly string[] {
  const ids = new Set([block.id, ...block.sentenceSpans.map((span) => span.id)]);
  function visit(inlines: readonly Inline[]) {
    for (const node of inlines) {
      if (node.kind === "emphasis") visit(node.inlines);
      if (node.kind === "math" && node.display && node.equationId) ids.add(node.equationId);
    }
  }
  visit(block.inlines);
  return [...ids];
}

function footnotes(inlines: readonly Inline[]): readonly string[] {
  return inlines.flatMap((node) =>
    node.kind === "footnote-mark"
      ? [node.footnoteId]
      : node.kind === "emphasis"
        ? footnotes(node.inlines)
        : [],
  );
}

/**
 * Carry the actual section and the source dependencies of its translation and footnotes.
 * This keeps the existing offline profile boundary: current source projections are scaffold-only,
 * just as the live source search projections are. Nothing is promoted to a reviewed release.
 */
export function selectOfflineSources(
  edition: BilingualEdition | null,
  section: string,
  profile: OfflineProfile,
  citedBlocks: readonly string[] = [],
): OfflineSourceSelection | null {
  if (!["scaffold", "preview", "launch"].includes(profile))
    throw new OfflineSourceError(
      "offline-source-profile",
      "Unknown source publication profile.",
    );
  if (profile !== "scaffold" || !edition || edition.blocks.length === 0) return null;
  const paper = edition.paper.slug;
  if (!/^[a-z][a-z0-9-]*$/u.test(paper) || !/^s\d+$/u.test(section))
    throw new OfflineSourceError(
      "offline-source-identity",
      "Invalid offline paper or section.",
    );
  const byId = new Map<string, SourceBlock>();
  const byAddress = new Map<string, SourceBlock>();
  for (const block of edition.blocks) {
    if (block.paper !== paper || byId.has(block.id))
      throw new OfflineSourceError(
        "offline-source-identity",
        "Source blocks must belong to one paper and have unique ids.",
      );
    byId.set(block.id, block);
    // An embedded display and its own record name the same address. Its own record owns it.
    for (const address of offlineSourceIds(block))
      if (!byAddress.has(address) || address === block.id) byAddress.set(address, block);
  }
  if (!edition.blocks.some((block) => block.section === section)) return null;
  const selectedBlocks = new Set(
    edition.blocks
      .filter((block) => block.section === section || !block.section)
      .map((block) => block.id),
  );
  if (selectedBlocks.size === 0) return null;
  const selectedUnits = new Set<string>();
  const sections = sectionOfSourceId(edition.blocks);
  const unitIds = new Set<string>();
  for (const unit of edition.units) {
    if (unitIds.has(unit.id))
      throw new OfflineSourceError(
        "offline-source-identity",
        "Translation ids must be unique.",
      );
    unitIds.add(unit.id);
    const unitScope = unitSection(unit, sections);
    if (unitScope === section || unitScope === undefined) selectedUnits.add(unit.id);
  }
  function includeReference(id: string, kind: "source" | "footnote") {
    const block = byAddress.get(id);
    if (!block || (kind === "footnote" && block.kind !== "footnote"))
      throw new OfflineSourceError(
        "offline-source-reference",
        "An included source or footnote reference has no canonical block: " + id,
      );
    selectedBlocks.add(block.id);
    if (block.containedIn) {
      const container = byId.get(block.containedIn);
      if (!container)
        throw new OfflineSourceError(
          "offline-source-reference",
          "A display's containing paragraph is absent: " + block.containedIn,
        );
      selectedBlocks.add(container.id);
    }
  }
  for (const anchor of citedBlocks) includeReference(anchor, "source");
  let previous = -1;
  while (previous !== selectedBlocks.size + selectedUnits.size) {
    previous = selectedBlocks.size + selectedUnits.size;
    for (const block of edition.blocks) {
      if (!selectedBlocks.has(block.id)) continue;
      for (const note of footnotes(block.inlines)) includeReference(note, "footnote");
    }
    for (const unit of edition.units) {
      const reachesSelection = unit.sourceRefs.some((ref) => {
        const block = byAddress.get(ref.id);
        return ref.paper === paper && block !== undefined && selectedBlocks.has(block.id);
      });
      if (!selectedUnits.has(unit.id) && !reachesSelection) continue;
      selectedUnits.add(unit.id);
      for (const ref of unit.sourceRefs) {
        if (ref.paper !== paper)
          throw new OfflineSourceError(
            "offline-source-reference",
            "A source translation cannot silently import another paper.",
          );
        includeReference(ref.id, "source");
      }
      for (const note of footnotes(unit.inlines)) includeReference(note, "footnote");
    }
  }
  return Object.freeze({
    paper,
    section,
    blocks: Object.freeze(edition.blocks.filter((block) => selectedBlocks.has(block.id))),
    units: Object.freeze(edition.units.filter((unit) => selectedUnits.has(unit.id))),
    alignment: edition.alignment,
  });
}

const escapeAttribute = (text: string) => text
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

export function offlineMarkupIds(html: string): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const match of html.matchAll(/\sid="([^"]+)"/gu)) {
    const id = match[1]!;
    if (ids.has(id))
      throw new OfflineSourceError(
        "offline-source-anchor",
        "An offline source address appears twice: " + id,
      );
    ids.add(id);
  }
  return ids;
}

/**
 * Adapt trusted, server-rendered source components to a file with no reader controller.
 * Known alignment controls disappear; disabled formula chips remain readable as plain legends.
 * Every surviving link is local or an explicit HTTPS navigation. Nothing loads from the network.
 */
export function prepareOfflineSourceMarkup(
  html: string,
  paper: string,
  externalLocalIds: ReadonlySet<string> = new Set(),
): string {
  if (
    /<(?:script|link|meta|iframe|object|embed|img|image|video|audio|form|input|select|textarea)\b|\s(?:on[a-z]+|src|srcset|xlink:href)\s*=/iu.test(html) ||
    /katex-error|math-fallback/iu.test(html)
  )
    throw new OfflineSourceError(
      "offline-source-markup",
      "Offline source text must contain static, successfully rendered mathematics and no active resources.",
    );
  let result = html.replace(/<button\b([^>]*)>([\s\S]*?)<\/button>/giu, (_whole, attributes: string, body: string) => {
    if (/\b(?:align-sentences-btn|show-aligned-action)\b/u.test(attributes)) return "";
    if (!/\sdisabled(?:[\s=>]|$)/u.test(attributes))
      throw new OfflineSourceError(
        "offline-source-control",
        "An enabled source control needs an explicit offline presentation.",
      );
    // Legends retain their words and coloured glyphs, without pretending to be controls.
    return '<span class="offline-source-legend">' + body + "</span>";
  });
  if (/<\/?button\b/iu.test(result))
    throw new OfflineSourceError(
      "offline-source-control",
      "A source button was not adapted.",
    );
  const ids = offlineMarkupIds(result);
  const root = "https://annus-mirabilis.com";
  result = result.replace(/\shref="([^"]*)"/gu, (_whole, encoded: string) => {
    let href = encoded.replaceAll("&amp;", "&");
    const source = /^\/papers\/([^/]+)\/(?:s\d+\/)?view\/(german|english)\/#([^?]+)$/u.exec(href);
    if (source && source[1] === paper) {
      const target = (source[2] === "english" ? OFFLINE_ENGLISH_PREFIX : "") + decodeURIComponent(source[3]!);
      if (ids.has(target)) href = "#" + target;
    }
    if (href.startsWith("#")) {
      const target = href.slice(1);
      if (!ids.has(target) && !externalLocalIds.has(target)) {
        const english = target.startsWith(OFFLINE_ENGLISH_PREFIX);
        const anchor = english ? target.slice(OFFLINE_ENGLISH_PREFIX.length) : target;
        href = root + "/papers/" + paper + "/view/" + (english ? "english" : "german") + "/#" + encodeURIComponent(anchor);
      }
    } else if (href.startsWith("/") && !href.startsWith("//")) {
      href = root + href;
    } else if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s<>"]*)?$/iu.test(href)) {
      throw new OfflineSourceError(
        "offline-source-markup",
        "An offline source link must be a content address or an explicit HTTPS destination.",
      );
    }
    return ' href="' + escapeAttribute(href) + '"';
  });
  return result;
}
