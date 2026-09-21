/**
 * Structural Compiler Rejections.
 *
 * Implements the 10 structural compiler checks:
 * 1. duplicate-id
 * 2. missing-source-block
 * 3. broken-alignment
 * 4. dangling-citation
 * 5. impossible-date-order
 * 6. equation-not-identical
 * 7. complete-while-missing
 * 8. hero-quote-unresolved
 * 9. ledger-marker-in-edition
 * 10. span-digest-mismatch
 *
 * Spec: AGENTS.md, COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md §11.7, and am-cm-checks-structural-lq0
 */

import {
  type CheckContext,
  type ContentCheck,
  registerCheck,
} from "../../compiler/checks/registry.ts";
import type { PaperDate } from "../../schemas/dates.ts";
import { type Inline, plainText } from "../../schemas/inlines.ts";
import { type SpanAnchor, spanTextDigest } from "../../schemas/spans.ts";
import { compareDateIntervals, type DateInterval } from "./dateIntervals.ts";

export const STRUCTURAL_BEAD_ID = "am-cm-checks-structural-lq0";

// Ledger scan page marker patterns. STATUS-AGNOSTIC on purpose, and the asymmetry with
// ledgerTokenizer's grammar is deliberate: the tokenizer decides what IS a legal header and so
// must be fail-closed, enumerating the statuses it accepts; this one DETECTS a marker that leaked
// into the edition, so it must survive the next status word nobody has invented yet. Enumerating
// here would make the detector go blind at the same instant a new token starts leaking.
export const LEDGER_PAGE_MARKER_REGEX =
  /---\s*[A-Z][A-Z\s]*\s+TRANSCRIPTION\s+PAGE\s+\d+\s+OF\s+\d+\s*---|---\s*[A-Z][A-Z\s]*\s+TRANSCRIPTION\s+PAGE/i;

/**
 * Parses a split translation unit ID into base and suffix.
 * Matches:
 * 1. s3-p2-s1a -> base: s3-p2-s1, suffix: a
 * 2. s3-fn1a -> base: s3-fn1, suffix: a
 * 3. closing-ack-a -> base: closing-ack, suffix: a
 */
export function parseSplitTranslationUnitId(id: string): { base: string; suffix: string } | null {
  const digitMatch = id.match(/^(s\d+-p\d+-s\d+|s[1-9]\d*|s\d+-fn\d+|part-[12])([a-z])$/);
  if (digitMatch?.[1] && digitMatch?.[2]) {
    return { base: digitMatch[1], suffix: digitMatch[2] };
  }
  const letterMatch = id.match(
    /^(closing-dateline|closing-ack|closing-received|masthead-title|masthead-author)-([a-z])$/,
  );
  if (letterMatch?.[1] && letterMatch?.[2]) {
    return { base: letterMatch[1], suffix: letterMatch[2] };
  }
  return null;
}

/**
 * Extracts plain text from an entity (supports string, inlines array, or diplomaticText).
 */
function extractEntityPlainText(record: unknown): string {
  if (typeof record === "string") return record;
  if (!record || typeof record !== "object") return "";
  const r = record as Record<string, unknown>;

  if (Array.isArray(r.inlines)) {
    return plainText(r.inlines as Inline[]);
  }
  if (typeof r.diplomaticText === "string") {
    return r.diplomaticText;
  }
  if (typeof r.text === "string") {
    return r.text;
  }
  if (typeof r.phrase === "string") {
    return r.phrase;
  }
  return "";
}

/**
 * Recursively scans inlines for citation references.
 */
function extractInlineCitationIds(inlines: unknown): string[] {
  if (!Array.isArray(inlines)) return [];
  const citations: string[] = [];

  for (const inl of inlines) {
    if (!inl || typeof inl !== "object") continue;
    const item = inl as Record<string, unknown>;
    if (item.kind === "reference" || item.type === "reference") {
      if (typeof item.citationId === "string") citations.push(item.citationId);
      else if (typeof item.target === "string" && !item.target.includes("#")) {
        citations.push(item.target);
      }
    }
    if (Array.isArray(item.children)) {
      citations.push(...extractInlineCitationIds(item.children));
    }
  }

  return citations;
}

// ============================================================================
// 1. duplicate-id Check
// ============================================================================
export const checkDuplicateId: ContentCheck = {
  id: "structural-duplicate-id",
  family: "structural",
  severity: "error",
  beadId: STRUCTURAL_BEAD_ID,
  description: "Rejects duplicate ids within documents, entity namespaces, and globally.",
  run: (ctx: CheckContext) => {
    // 1. Source ids within one document of one paper
    const paperSourceBlocks = new Map<string, Set<string>>(); // paper -> Set<blockId>
    const paperSentenceIds = new Map<string, Set<string>>(); // paper -> Set<sentenceId>
    const paperTranslationUnits = new Map<string, Set<string>>(); // paper -> Set<tuId>

    // 2. Generic namespaces
    const citations = new Set<string>();
    const foundations = new Set<string>();
    const quantities = new Set<string>();
    const experiments = new Set<string>();
    const scenarios = new Set<string>();
    const datasets = new Set<string>();
    const tours = new Set<string>();
    const constantSets = new Set<string>();
    const misconceptions = new Set<string>();

    // 3. Global equation and argument ids
    const globalEquations = new Set<string>();
    const globalArguments = new Set<string>();

    for (const [key, rawRec] of ctx.records.entries()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const id = typeof rec.id === "string" ? rec.id : "";
      const paper =
        typeof rec.paper === "string"
          ? rec.paper
          : typeof rec.paperSlug === "string"
            ? rec.paperSlug
            : "";
      const file = typeof rec.file === "string" ? rec.file : key;

      if (!id) continue;

      if (kind === "source-block") {
        let blocks = paperSourceBlocks.get(paper);
        if (!blocks) {
          blocks = new Set();
          paperSourceBlocks.set(paper, blocks);
        }
        if (blocks.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate source block id "${id}" in paper "${paper}".`,
            repair: `Assign a unique source block id within paper "${paper}".`,
          });
        }
        blocks.add(id);

        // Check sentence spans inside source-block
        if (Array.isArray(rec.sentenceSpans)) {
          let sIds = paperSentenceIds.get(paper);
          if (!sIds) {
            sIds = new Set();
            paperSentenceIds.set(paper, sIds);
          }
          for (const sp of rec.sentenceSpans) {
            if (sp && typeof sp === "object" && "id" in sp && typeof sp.id === "string") {
              const sId = sp.id;
              if (sIds.has(sId)) {
                ctx.report({
                  rule: "duplicate-id",
                  recordId: sId,
                  file,
                  path: `${id}.sentenceSpans.${sId}`,
                  message: `Duplicate sentence span id "${sId}" in paper "${paper}".`,
                  repair: `Assign a unique sentence span id within paper "${paper}".`,
                });
              }
              sIds.add(sId);
            }
          }
        }
      } else if (kind === "translation-unit") {
        let tus = paperTranslationUnits.get(paper);
        if (!tus) {
          tus = new Set();
          paperTranslationUnits.set(paper, tus);
        }
        if (tus.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate translation unit id "${id}" in paper "${paper}".`,
            repair: `Assign a unique translation unit id within paper "${paper}".`,
          });
        }
        tus.add(id);
      } else if (kind === "citation") {
        if (citations.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate citation id "${id}" in bibliography namespace.`,
            repair: `Ensure citation ids in content/bibliography/ are unique.`,
          });
        }
        citations.add(id);
      } else if (kind === "foundation") {
        if (foundations.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate foundation id "${id}" in foundations namespace.`,
            repair: `Ensure foundation ids in content/foundations/ are unique.`,
          });
        }
        foundations.add(id);
      } else if (kind === "quantity") {
        if (quantities.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate quantity id "${id}" in quantities namespace.`,
            repair: `Ensure quantity ids in content/quantities/ are unique.`,
          });
        }
        quantities.add(id);
      } else if (kind === "experiment") {
        if (experiments.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate experiment id "${id}".`,
            repair: `Ensure experiment ids are unique.`,
          });
        }
        experiments.add(id);
      } else if (kind === "scenario") {
        if (scenarios.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate scenario id "${id}".`,
            repair: `Ensure scenario ids are unique.`,
          });
        }
        scenarios.add(id);
      } else if (kind === "dataset" || kind === "historical-dataset") {
        if (datasets.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate dataset id "${id}".`,
            repair: `Ensure dataset ids are unique.`,
          });
        }
        datasets.add(id);
      } else if (kind === "tour") {
        if (tours.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate tour id "${id}".`,
            repair: `Ensure tour ids are unique.`,
          });
        }
        tours.add(id);
      } else if (kind === "constant-set") {
        if (constantSets.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate constant set id "${id}".`,
            repair: `Ensure constant-set ids are unique.`,
          });
        }
        constantSets.add(id);
      } else if (kind === "misconception") {
        if (misconceptions.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate misconception id "${id}".`,
            repair: `Ensure misconception ids are unique.`,
          });
        }
        misconceptions.add(id);
      } else if (kind === "equation") {
        if (globalEquations.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate equation id "${id}" globally.`,
            repair: `Ensure equation record ids are globally unique across all papers.`,
          });
        }
        globalEquations.add(id);
      } else if (kind === "argument") {
        if (globalArguments.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate argument id "${id}" globally.`,
            repair: `Ensure argument ids are globally unique across all papers.`,
          });
        }
        globalArguments.add(id);
      }
    }
  },
};

// ============================================================================
// 2. missing-source-block Check
// ============================================================================
export const checkMissingSourceBlock: ContentCheck = {
  id: "structural-missing-source-block",
  family: "structural",
  severity: "error",
  beadId: STRUCTURAL_BEAD_ID,
  description:
    "Rejects missing source blocks or sentences in paper outlines, translations, alignments, and notes.",
  run: (ctx: CheckContext) => {
    // Collect all existing source blocks and sentence IDs per paper
    const paperBlocks = new Map<string, Set<string>>();
    const paperSentences = new Map<string, Set<string>>();

    for (const rawRec of ctx.records.values()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const paper =
        typeof rec.paper === "string"
          ? rec.paper
          : typeof rec.paperSlug === "string"
            ? rec.paperSlug
            : "";
      const id = typeof rec.id === "string" ? rec.id : "";

      if (kind === "source-block") {
        let blocks = paperBlocks.get(paper);
        if (!blocks) {
          blocks = new Set();
          paperBlocks.set(paper, blocks);
        }
        blocks.add(id);

        if (Array.isArray(rec.sentenceSpans)) {
          let sSet = paperSentences.get(paper);
          if (!sSet) {
            sSet = new Set();
            paperSentences.set(paper, sSet);
          }
          for (const sp of rec.sentenceSpans) {
            if (sp && typeof sp === "object" && "id" in sp && typeof sp.id === "string") {
              sSet.add(sp.id);
            }
          }
        }
      }
    }

    // Check papers' orderedBlockIds
    for (const rawRec of ctx.records.values()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const id = typeof rec.id === "string" ? rec.id : "";

      if (kind === "paper" && Array.isArray(rec.orderedBlockIds)) {
        const blocks = paperBlocks.get(id) ?? new Set();
        for (const bId of rec.orderedBlockIds) {
          if (typeof bId === "string" && !blocks.has(bId)) {
            ctx.report({
              rule: "missing-source-block",
              recordId: id,
              path: `papers.${id}.orderedBlockIds.${bId}`,
              message: `Paper "${id}" orderedBlockIds references non-existent source block "${bId}".`,
              repair: `Add source block "${bId}" to content/source-blocks/${id}/ or remove it from orderedBlockIds.`,
            });
          }
        }
      }

      // Check TranslationUnit.sourceRefs
      if (kind === "translation-unit" && Array.isArray(rec.sourceRefs)) {
        const defaultPaper = typeof rec.paper === "string" ? rec.paper : "";
        for (const sRef of rec.sourceRefs) {
          let refPaper = defaultPaper;
          let refId = "";
          if (typeof sRef === "string") {
            refId = sRef;
          } else if (sRef && typeof sRef === "object") {
            if ("paper" in sRef && typeof sRef.paper === "string" && sRef.paper) {
              refPaper = sRef.paper;
            }
            if ("id" in sRef && typeof sRef.id === "string") {
              refId = sRef.id;
            }
          }
          if (refId) {
            const blocks = paperBlocks.get(refPaper) ?? new Set();
            const sentences = paperSentences.get(refPaper) ?? new Set();
            if (!blocks.has(refId) && !sentences.has(refId)) {
              ctx.report({
                rule: "missing-source-block",
                recordId: id,
                path: `translation-units.${id}.sourceRefs`,
                message: `Translation unit "${id}" references missing source block or sentence "${refId}" in paper "${refPaper}".`,
                repair: `Ensure source block or sentence "${refId}" exists in paper "${refPaper}".`,
              });
            }
          }
        }
      }

      // Check Alignment.edges source block/sentence
      if (kind === "alignment" && Array.isArray(rec.edges)) {
        const defaultPaper = typeof rec.paper === "string" ? rec.paper : "";
        for (let i = 0; i < rec.edges.length; i++) {
          const edge = rec.edges[i];
          if (!edge || typeof edge !== "object" || !("source" in edge)) continue;
          const src = edge.source;
          if (src && typeof src === "object") {
            const srcPaper =
              "paper" in src && typeof src.paper === "string" && src.paper
                ? src.paper
                : defaultPaper;
            const srcBlockId =
              "blockId" in src && typeof src.blockId === "string" ? src.blockId : undefined;
            const srcSentenceId =
              "sentenceId" in src && typeof src.sentenceId === "string"
                ? src.sentenceId
                : undefined;

            const blocks = paperBlocks.get(srcPaper) ?? new Set();
            const sentences = paperSentences.get(srcPaper) ?? new Set();

            if (srcBlockId && !blocks.has(srcBlockId)) {
              ctx.report({
                rule: "missing-source-block",
                recordId: id,
                path: `alignments.${id}.edges[${i}].source.blockId`,
                message: `Alignment edge references missing source block "${srcBlockId}" in paper "${srcPaper}".`,
                repair: `Add source block "${srcBlockId}" to paper "${srcPaper}" or update alignment edge.`,
              });
            }

            if (srcSentenceId && !sentences.has(srcSentenceId)) {
              ctx.report({
                rule: "missing-source-block",
                recordId: id,
                path: `alignments.${id}.edges[${i}].source.sentenceId`,
                message: `Alignment edge references missing sentence span "${srcSentenceId}" in paper "${srcPaper}".`,
                repair: `Add sentence span "${srcSentenceId}" to source block or update alignment edge.`,
              });
            }
          }
        }
      }

      // Check EditorialNote.affectedIds
      if (kind === "editorial-note" && Array.isArray(rec.affectedIds)) {
        const defaultPaper = typeof rec.paper === "string" ? rec.paper : "";
        for (const affId of rec.affectedIds) {
          if (typeof affId === "string") {
            const parts = affId.includes("#") ? affId.split("#") : [defaultPaper, affId];
            const targetPaper = parts[0];
            const targetId = parts[1];
            if (targetPaper && targetId) {
              const blocks = paperBlocks.get(targetPaper) ?? new Set();
              const sentences = paperSentences.get(targetPaper) ?? new Set();
              // Only check if targetId matches source block/sentence pattern (e.g. s<n>-p<m>)
              if (/^s\d+(-p\d+|-fn\d+|-s\d+|)/.test(targetId)) {
                if (!blocks.has(targetId) && !sentences.has(targetId)) {
                  ctx.report({
                    rule: "missing-source-block",
                    recordId: id,
                    path: `editorial-notes.${id}.affectedIds`,
                    message: `Editorial note "${id}" references missing source unit "${targetId}" in paper "${targetPaper}".`,
                    repair: `Ensure affected source block or sentence exists.`,
                  });
                }
              }
            }
          }
        }
      }

      // Check Argument cross-paper references e.g. special-relativity#eq-s8-d9
      if (kind === "argument") {
        const crossRefs: string[] = [];
        if (Array.isArray(rec.prerequisites)) {
          for (const p of rec.prerequisites) {
            if (typeof p === "string" && p.includes("#")) {
              crossRefs.push(p);
            } else if (
              p &&
              typeof p === "object" &&
              "id" in p &&
              typeof p.id === "string" &&
              p.id.includes("#")
            ) {
              crossRefs.push(p.id);
            }
          }
        }
        if (Array.isArray(rec.sourceSupport)) {
          for (const ss of rec.sourceSupport) {
            if (typeof ss === "string" && ss.includes("#")) {
              crossRefs.push(ss);
            } else if (
              ss &&
              typeof ss === "object" &&
              "id" in ss &&
              typeof ss.id === "string" &&
              ss.id.includes("#")
            ) {
              crossRefs.push(ss.id);
            }
          }
        }
        for (const cref of crossRefs) {
          const parts = cref.split("#");
          const cPaper = parts[0] ?? "";
          const cId = parts[1] ?? "";
          const indexes = ctx.indexes as { byId?: Map<string, unknown> } | undefined;
          const targetRec =
            (cId ? indexes?.byId?.get(cId) : undefined) || (cId ? ctx.records.get(cId) : undefined);
          if (!targetRec) {
            ctx.report({
              rule: "missing-source-block",
              recordId: id,
              path: `arguments.${id}`,
              message: `Cross-paper reference "${cref}" to paper "${cPaper}" does not exist.`,
              repair: `Correct the cross-paper reference "${cref}".`,
            });
          }
        }
      }
    }
  },
};

// ============================================================================
// 3. broken-alignment Check
// ============================================================================
export const checkBrokenAlignment: ContentCheck = {
  id: "structural-broken-alignment",
  family: "structural",
  severity: "error",
  beadId: STRUCTURAL_BEAD_ID,
  description:
    "Validates alignment edges, coverage of German alignables, English translation units, and split suffixes.",
  run: (ctx: CheckContext) => {
    // Group records by paper
    const paperSourceBlocks = new Map<string, Map<string, Record<string, unknown>>>();
    const paperTranslationUnits = new Map<string, Map<string, Record<string, unknown>>>();
    const paperAlignments = new Map<string, Record<string, unknown>[]>();

    for (const rawRec of ctx.records.values()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const paper =
        typeof rec.paper === "string"
          ? rec.paper
          : typeof rec.paperSlug === "string"
            ? rec.paperSlug
            : "";
      const id = typeof rec.id === "string" ? rec.id : "";

      if (!paper) continue;

      if (kind === "source-block") {
        let blocks = paperSourceBlocks.get(paper);
        if (!blocks) {
          blocks = new Map();
          paperSourceBlocks.set(paper, blocks);
        }
        blocks.set(id, rec);
      } else if (kind === "translation-unit") {
        let tus = paperTranslationUnits.get(paper);
        if (!tus) {
          tus = new Map();
          paperTranslationUnits.set(paper, tus);
        }
        tus.set(id, rec);
      } else if (kind === "alignment") {
        let aligns = paperAlignments.get(paper);
        if (!aligns) {
          aligns = [];
          paperAlignments.set(paper, aligns);
        }
        aligns.push(rec);
      }
    }

    // Evaluate each paper
    for (const [paper, sourceBlocks] of paperSourceBlocks.entries()) {
      const tus = paperTranslationUnits.get(paper) ?? new Map<string, Record<string, unknown>>();
      const alignments = paperAlignments.get(paper) ?? [];

      const coveredGermanUnits = new Set<string>();
      const targetedTranslationUnits = new Set<string>();

      for (const alignment of alignments) {
        const alignId = typeof alignment.id === "string" ? alignment.id : paper;
        const edges = Array.isArray(alignment.edges)
          ? (alignment.edges as Record<string, unknown>[])
          : [];

        for (let i = 0; i < edges.length; i++) {
          const edge = edges[i];
          if (!edge || typeof edge !== "object") continue;
          const src = edge.source as Record<string, unknown> | undefined;
          const tgt = edge.target as Record<string, unknown> | undefined;

          if (!src || !tgt) continue;

          const blockId = typeof src.blockId === "string" ? src.blockId : "";
          const sentenceId = typeof src.sentenceId === "string" ? src.sentenceId : undefined;
          const tuId = typeof tgt.translationUnitId === "string" ? tgt.translationUnitId : "";

          // 1. Source sentence inside block check
          const block = sourceBlocks.get(blockId);
          if (block) {
            if (sentenceId) {
              const spans = Array.isArray(block.sentenceSpans) ? block.sentenceSpans : [];
              const hasSentence = spans.some(
                (sp) => sp && typeof sp === "object" && "id" in sp && sp.id === sentenceId,
              );
              if (!hasSentence) {
                ctx.report({
                  rule: "broken-alignment",
                  recordId: alignId,
                  path: `alignments.${alignId}.edges[${i}].source.sentenceId`,
                  message: `Alignment edge source sentence "${sentenceId}" is not inside block "${blockId}".`,
                  repair: `Ensure sentence span "${sentenceId}" is defined on block "${blockId}".`,
                });
              } else {
                coveredGermanUnits.add(sentenceId);
              }
            } else {
              coveredGermanUnits.add(blockId);
            }

            // Character range out of bounds check for source
            if (src.range && typeof src.range === "object") {
              const range = src.range as SpanAnchor;
              const text = extractEntityPlainText(block);
              if (range.end > text.length || range.start < 0 || range.start >= range.end) {
                ctx.report({
                  rule: "broken-alignment",
                  recordId: alignId,
                  path: `alignments.${alignId}.edges[${i}].source.range`,
                  message: `Alignment edge source range [${range.start}, ${range.end}] is out of bounds for block "${blockId}" (text length ${text.length}).`,
                  repair: `Re-measure source span range to match block text length.`,
                });
              }
            }
          }

          // 2. Target translation unit missing check
          const tu = tus.get(tuId);
          if (!tu) {
            ctx.report({
              rule: "broken-alignment",
              recordId: alignId,
              path: `alignments.${alignId}.edges[${i}].target.translationUnitId`,
              message: `Alignment edge target translation unit "${tuId}" is missing in paper "${paper}".`,
              repair: `Create translation unit "${tuId}" or update alignment target.`,
            });
          } else {
            targetedTranslationUnits.add(tuId);

            // Character range out of bounds check for target
            if (tgt.range && typeof tgt.range === "object") {
              const range = tgt.range as SpanAnchor;
              const text = extractEntityPlainText(tu);
              if (range.end > text.length || range.start < 0 || range.start >= range.end) {
                ctx.report({
                  rule: "broken-alignment",
                  recordId: alignId,
                  path: `alignments.${alignId}.edges[${i}].target.range`,
                  message: `Alignment edge target range [${range.start}, ${range.end}] is out of bounds for translation unit "${tuId}" (text length ${text.length}).`,
                  repair: `Re-measure translation span range to match translation unit text length.`,
                });
              }
            }
          }
        }
      }

      // 3. German alignable unit has no alignment edge
      for (const [bId, block] of sourceBlocks.entries()) {
        const blockKind = typeof block.kind === "string" ? block.kind : "";

        // If block has sentenceSpans (e.g. paragraph), each sentence span must be covered
        if (Array.isArray(block.sentenceSpans) && block.sentenceSpans.length > 0) {
          for (const sp of block.sentenceSpans) {
            if (sp && typeof sp === "object" && "id" in sp && typeof sp.id === "string") {
              const sId = sp.id;
              if (!coveredGermanUnits.has(sId) && !coveredGermanUnits.has(bId)) {
                ctx.report({
                  rule: "broken-alignment",
                  recordId: bId,
                  path: `source-blocks.${bId}.sentenceSpans.${sId}`,
                  message: `German sentence "${sId}" in block "${bId}" has no alignment edge.`,
                  repair: `Add an alignment edge covering sentence "${sId}" to content/alignments/${paper}.yaml.`,
                });
              }
            }
          }
        } else {
          // Block-level alignable units: heading, part-heading, masthead, footnote, closing
          const isAlignableBlock =
            blockKind === "heading" ||
            blockKind === "part-heading" ||
            blockKind === "masthead" ||
            blockKind === "footnote" ||
            blockKind === "closing" ||
            // The section-id shape rather than "begins with s" (am-o44v).
            // The four kind comparisons above are the category test; this arm
            // catches a block whose kind is missing while its id shows it is a
            // sectioned unit. `sources`, `summary` and `sigma` all begin with
            // s and are not sectioned units.
            /^s\d/.test(bId) ||
            bId.startsWith("closing-");

          if (isAlignableBlock && !coveredGermanUnits.has(bId)) {
            ctx.report({
              rule: "broken-alignment",
              recordId: bId,
              path: `source-blocks.${bId}`,
              message: `German block-level alignable unit "${bId}" (kind: ${blockKind}) has no alignment edge.`,
              repair: `Add an alignment edge covering block "${bId}" to content/alignments/${paper}.yaml.`,
            });
          }
        }
      }

      // 4. English translation unit has no alignment edge
      for (const tuId of tus.keys()) {
        if (!targetedTranslationUnits.has(tuId)) {
          ctx.report({
            rule: "broken-alignment",
            recordId: tuId,
            path: `translation-units.${tuId}`,
            message: `English translation unit "${tuId}" has no incoming alignment edge.`,
            repair: `Add an alignment edge targeting translation unit "${tuId}" in content/alignments/${paper}.yaml.`,
          });
        }
      }

      // 5. Suffixed translation units sibling & collision rules
      // e.g. s3-p2-s1a requires at least s3-p2-s1b, and s3-p2-s1 must not exist beside them
      const baseToSuffixes = new Map<string, string[]>();
      for (const tuId of tus.keys()) {
        const split = parseSplitTranslationUnitId(tuId);
        if (split) {
          let suffixes = baseToSuffixes.get(split.base);
          if (!suffixes) {
            suffixes = [];
            baseToSuffixes.set(split.base, suffixes);
          }
          suffixes.push(split.suffix);
        }
      }

      for (const [base, suffixes] of baseToSuffixes.entries()) {
        if (suffixes.length < 2) {
          ctx.report({
            rule: "broken-alignment",
            recordId: `${base}${suffixes[0]}`,
            path: `translation-units.${base}${suffixes[0]}`,
            message: `Suffixed translation unit "${base}${suffixes[0]}" has no sibling split unit (split needs at least two parts).`,
            repair: `Add sibling translation unit (e.g. "${base}b") or remove suffix "${suffixes[0]}".`,
          });
        }
        if (tus.has(base)) {
          ctx.report({
            rule: "broken-alignment",
            recordId: base,
            path: `translation-units.${base}`,
            message: `Unsuffixed translation unit "${base}" exists beside suffixed units (${suffixes.map((s) => `"${base}${s}"`).join(", ")}).`,
            repair: `Remove the unsuffixed translation unit "${base}" or remove the suffixed splits.`,
          });
        }
      }
    }
  },
};

// ============================================================================
// 4. dangling-citation Check
// ============================================================================
export const checkDanglingCitation: ContentCheck = {
  id: "structural-dangling-citation",
  family: "structural",
  severity: "error",
  beadId: STRUCTURAL_BEAD_ID,
  description:
    "Rejects citations referenced in inlines, notes, cards, arguments, or datasets that are not defined.",
  run: (ctx: CheckContext) => {
    // Collect all defined citation IDs
    const definedCitations = new Set<string>();
    for (const rawRec of ctx.records.values()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const id = typeof rec.id === "string" ? rec.id : "";
      if (kind === "citation" && id) {
        definedCitations.add(id);
      }
    }

    // Also include citations from ctx.indexes if present
    const indexes = ctx.indexes as { citations?: Map<string, unknown> } | undefined;
    if (indexes?.citations) {
      for (const cId of indexes.citations.keys()) {
        definedCitations.add(cId);
      }
    }

    const checkCitationRef = (citId: string, sourceId: string, path: string) => {
      if (!definedCitations.has(citId)) {
        ctx.report({
          rule: "dangling-citation",
          recordId: sourceId,
          path,
          message: `Citation "${citId}" is referenced by "${sourceId}" but is not defined in bibliography.`,
          repair: `Add citation "${citId}" to content/bibliography/ or correct the reference.`,
        });
      }
    };

    for (const [key, rawRec] of ctx.records.entries()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const id = typeof rec.id === "string" ? rec.id : key;

      // 1. Inlines in source blocks, translation units, foundations, arguments
      if (Array.isArray(rec.inlines)) {
        const inlineCits = extractInlineCitationIds(rec.inlines);
        for (const citId of inlineCits) {
          checkCitationRef(citId, id, `${id}.inlines`);
        }
      }

      // 2. EditorialNote.sourceSupport[].citationId
      if (kind === "editorial-note" && Array.isArray(rec.sourceSupport)) {
        for (let i = 0; i < rec.sourceSupport.length; i++) {
          const ss = rec.sourceSupport[i];
          if (
            ss &&
            typeof ss === "object" &&
            "citationId" in ss &&
            typeof ss.citationId === "string"
          ) {
            checkCitationRef(
              ss.citationId,
              id,
              `editorial-notes.${id}.sourceSupport[${i}].citationId`,
            );
          }
        }
      }

      // 3. ArgumentNode evidence & citations
      if (kind === "argument") {
        if (Array.isArray(rec.citations)) {
          for (const cit of rec.citations) {
            if (typeof cit === "string") checkCitationRef(cit, id, `arguments.${id}.citations`);
          }
        }
        if (Array.isArray(rec.evidence)) {
          for (let i = 0; i < rec.evidence.length; i++) {
            const ev = rec.evidence[i];
            if (
              ev &&
              typeof ev === "object" &&
              "citationId" in ev &&
              typeof ev.citationId === "string"
            ) {
              checkCitationRef(ev.citationId, id, `arguments.${id}.evidence[${i}].citationId`);
            }
          }
        }
      }

      // 4. HistoricalPremise / Card citations
      if (kind === "historical-premise" || kind === "card") {
        const cits = Array.isArray(rec.citations)
          ? rec.citations
          : Array.isArray(rec.sources)
            ? rec.sources
            : [];
        for (const cit of cits) {
          if (typeof cit === "string") checkCitationRef(cit, id, `${id}.citations`);
        }
      }

      // 5. Dataset citation
      if (kind === "dataset" || kind === "historical-dataset") {
        const cit =
          typeof rec.citationId === "string"
            ? rec.citationId
            : typeof rec.citation === "string"
              ? rec.citation
              : undefined;
        if (cit) checkCitationRef(cit, id, `datasets.${id}.citation`);
      }

      // 6. Foundation citations
      if (kind === "foundation" && Array.isArray(rec.citations)) {
        for (const cit of rec.citations) {
          if (typeof cit === "string") checkCitationRef(cit, id, `foundations.${id}.citations`);
        }
      }

      // 7. Paper citation
      if (kind === "paper" && typeof rec.citation === "string" && rec.citation) {
        checkCitationRef(rec.citation, id, `papers.${id}.citation`);
      }
    }
  },
};

function isDateOfType(d: unknown, type: string): d is PaperDate | DateInterval {
  return (
    typeof d === "object" &&
    d !== null &&
    "type" in d &&
    d.type === type &&
    "earliest" in d &&
    typeof d.earliest === "string" &&
    "latest" in d &&
    typeof d.latest === "string"
  );
}

// ============================================================================
// 5. impossible-date-order Check
// ============================================================================
export const checkImpossibleDateOrder: ContentCheck = {
  id: "structural-impossible-date-order",
  family: "structural",
  severity: "error",
  beadId: STRUCTURAL_BEAD_ID,
  description:
    "Enforces precision-aware chronological ordering across date-line, received, published, and submitted dates.",
  run: (ctx: CheckContext) => {
    for (const [key, rawRec] of ctx.records.entries()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const id = typeof rec.id === "string" ? rec.id : key;

      if (kind === "paper" && Array.isArray(rec.dates)) {
        const dates = rec.dates;
        const dateLine = dates.find((d): d is PaperDate | DateInterval =>
          isDateOfType(d, "date-line"),
        );
        const received = dates.find((d): d is PaperDate | DateInterval =>
          isDateOfType(d, "received"),
        );
        const published = dates.find((d): d is PaperDate | DateInterval =>
          isDateOfType(d, "issue-publication"),
        );
        const submitted = dates.find((d): d is PaperDate | DateInterval =>
          isDateOfType(d, "submitted"),
        );
        const laterEditions = dates.filter((d): d is PaperDate | DateInterval =>
          isDateOfType(d, "later-edition"),
        );

        // 1. date-line not after received
        if (dateLine && received) {
          const comp = compareDateIntervals(dateLine, received);
          if (!comp.notAfter) {
            ctx.report({
              rule: "impossible-date-order",
              recordId: id,
              path: `papers.${id}.dates`,
              message: `Paper date-line (${comp.earliestX}..${comp.latestX}) is strictly after received date (${comp.earliestY}..${comp.latestY}).`,
              repair: `Correct the date-line or received date in content/papers/${id}.json.`,
            });
          }
        }

        // 2. received not after issue-publication
        if (received && published) {
          const comp = compareDateIntervals(received, published);
          if (!comp.notAfter) {
            ctx.report({
              rule: "impossible-date-order",
              recordId: id,
              path: `papers.${id}.dates`,
              message: `Paper received date (${comp.earliestX}..${comp.latestX}) is strictly after issue publication date (${comp.earliestY}..${comp.latestY}).`,
              repair: `Correct received or issue publication date.`,
            });
          }
        }

        // 3. issue-publication not after later edition
        if (published) {
          for (let i = 0; i < laterEditions.length; i++) {
            const le = laterEditions[i];
            if (!le) continue;
            const comp = compareDateIntervals(published, le);
            if (!comp.notAfter) {
              ctx.report({
                rule: "impossible-date-order",
                recordId: id,
                path: `papers.${id}.dates.laterEdition[${i}]`,
                message: `Issue publication date (${comp.earliestX}..${comp.latestX}) is strictly after later-edition date (${comp.earliestY}..${comp.latestY}).`,
                repair: `Correct publication or later-edition date.`,
              });
            }
          }
        }

        // 4. date-line not after submitted (e.g. dissertation)
        if (dateLine && submitted) {
          const comp = compareDateIntervals(dateLine, submitted);
          if (!comp.notAfter) {
            ctx.report({
              rule: "impossible-date-order",
              recordId: id,
              path: `papers.${id}.dates`,
              message: `Date-line (${comp.earliestX}..${comp.latestX}) is strictly after submission date (${comp.earliestY}..${comp.latestY}).`,
              repair: `Correct date-line or submission date.`,
            });
          }
        }
      }
    }
  },
};

// ============================================================================
// 6. equation-not-identical Check
// ============================================================================
export const checkEquationNotIdentical: ContentCheck = {
  id: "structural-equation-not-identical",
  family: "structural",
  severity: "error",
  beadId: STRUCTURAL_BEAD_ID,
  description:
    "Enforces that English equation mathematical content is byte-identical to aligned German equation content.",
  run: (ctx: CheckContext) => {
    // Map paper -> equation block / record content
    const germanEquations = new Map<string, string>(); // equationId -> serialized math
    const englishEquations = new Map<string, string>(); // equationId -> serialized math

    for (const [key, rawRec] of ctx.records.entries()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const id = typeof rec.id === "string" ? rec.id : key;

      // Source equation block (German)
      if (
        kind === "source-block" &&
        (rec.kind === "equation" ||
          typeof rec.latex === "string" ||
          typeof rec.math === "string" ||
          /(?:^|-)eq(?:\d+|-|$)/i.test(id))
      ) {
        const mathContent =
          typeof rec.latex === "string"
            ? rec.latex
            : typeof rec.math === "string"
              ? rec.math
              : extractEntityPlainText(rec);
        germanEquations.set(id, mathContent);
      }

      // Translation equation unit (English)
      if (
        kind === "translation-unit" &&
        (rec.kind === "equation" ||
          typeof rec.latex === "string" ||
          typeof rec.math === "string" ||
          /(?:^|-)eq(?:\d+|-|$)/i.test(id) ||
          (Array.isArray(rec.sourceRefs) &&
            rec.sourceRefs.some(
              (r) =>
                typeof r === "object" &&
                r &&
                "id" in r &&
                typeof r.id === "string" &&
                /(?:^|-)eq(?:\d+|-|$)/i.test(r.id),
            )))
      ) {
        const mathContent =
          typeof rec.latex === "string"
            ? rec.latex
            : typeof rec.math === "string"
              ? rec.math
              : extractEntityPlainText(rec);
        englishEquations.set(id, mathContent);
      }

      // Explicit equation comparison if record carries both germanLatex and englishLatex
      if (typeof rec.germanLatex === "string" && typeof rec.englishLatex === "string") {
        if (rec.germanLatex !== rec.englishLatex) {
          ctx.report({
            rule: "equation-not-identical",
            recordId: id,
            path: `equations.${id}`,
            message: `English equation mathematical content differs byte-for-byte from German equation content ("${rec.englishLatex}" vs "${rec.germanLatex}").`,
            repair: `Ensure mathematical notation is byte-identical across German and English representations.`,
          });
        }
      }
    }

    // Check alignment edges connecting German equation blocks to English translation equation units
    for (const rawRec of ctx.records.values()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      if (rec.kind === "alignment" && Array.isArray(rec.edges)) {
        for (let i = 0; i < rec.edges.length; i++) {
          const edge = rec.edges[i];
          if (!edge || typeof edge !== "object" || !("source" in edge) || !("target" in edge)) {
            continue;
          }
          const src = edge.source;
          const tgt = edge.target;
          if (
            src &&
            typeof src === "object" &&
            tgt &&
            typeof tgt === "object" &&
            "blockId" in src &&
            typeof src.blockId === "string" &&
            "translationUnitId" in tgt &&
            typeof tgt.translationUnitId === "string"
          ) {
            const germanMath = germanEquations.get(src.blockId);
            const englishMath = englishEquations.get(tgt.translationUnitId);
            if (germanMath !== undefined && englishMath !== undefined) {
              if (germanMath !== englishMath) {
                ctx.report({
                  rule: "equation-not-identical",
                  recordId: tgt.translationUnitId,
                  path: `alignments.${rec.id}.edges[${i}]`,
                  message: `English translation equation block "${tgt.translationUnitId}" differs by bytes from aligned German block "${src.blockId}".`,
                  repair: `Ensure mathematical notation is byte-identical across German and English representations.`,
                });
              }
            }
          }
        }
      }
    }
  },
};

// ============================================================================
// 7. complete-while-missing Check
// ============================================================================
export const checkCompleteWhileMissing: ContentCheck = {
  id: "structural-complete-while-missing",
  family: "structural",
  severity: "error",
  beadId: STRUCTURAL_BEAD_ID,
  description:
    "Rejects papers or sections marked complete while units lack reviewed status or lack coverage obligations.",
  run: (ctx: CheckContext) => {
    for (const [key, rawRec] of ctx.records.entries()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const id = typeof rec.id === "string" ? rec.id : key;
      const status = typeof rec.status === "string" ? rec.status : "";

      if (
        kind === "paper" &&
        (status === "complete" || status === "reviewed" || status === "published")
      ) {
        // Check if any source blocks for this paper have non-reviewed status
        const paperBlocks: Record<string, unknown>[] = [];
        const paperTus: Record<string, unknown>[] = [];

        for (const otherRec of ctx.records.values()) {
          if (!otherRec || typeof otherRec !== "object") continue;
          const o = otherRec as Record<string, unknown>;
          if (o.paper === id || o.paperSlug === id) {
            if (o.kind === "source-block") paperBlocks.push(o);
            if (o.kind === "translation-unit") paperTus.push(o);
          }
        }

        // Check source blocks review statuses
        for (const sb of paperBlocks) {
          const sbId = typeof sb.id === "string" ? sb.id : "block";
          const st = sb.status as Record<string, unknown> | undefined;
          if (st) {
            if (st.transcription === "draft" || st.transcription === "not-started") {
              ctx.report({
                rule: "complete-while-missing",
                recordId: id,
                path: `papers.${id}`,
                message: `Paper "${id}" is marked complete while source block "${sbId}" transcription status is "${st.transcription}".`,
                repair: `Review and proof transcription for "${sbId}" before marking paper as complete.`,
              });
            }
          }
        }

        // Check translation units review statuses (machine-draft / draft)
        for (const tu of paperTus) {
          const tuId = typeof tu.id === "string" ? tu.id : "tu";
          const rState = typeof tu.reviewState === "string" ? tu.reviewState : "";
          if (rState === "draft" || rState === "machine-draft" || rState === "not-started") {
            ctx.report({
              rule: "complete-while-missing",
              recordId: id,
              path: `papers.${id}`,
              message: `Paper "${id}" is marked complete while translation unit "${tuId}" is unreviewed (reviewState: "${rState}").`,
              repair: `Complete human review for translation unit "${tuId}".`,
            });
          }
        }
      }
    }
  },
};

// ============================================================================
// 8. hero-quote-unresolved Check
// ============================================================================
export const checkHeroQuoteUnresolved: ContentCheck = {
  id: "structural-hero-quote-unresolved",
  family: "structural",
  severity: "error",
  beadId: STRUCTURAL_BEAD_ID,
  description:
    "Verifies hero quotes and pull quotes against edition text at anchor, preserving case and punctuation while collapsing whitespace.",
  run: (ctx: CheckContext) => {
    // Collect edition text at anchors
    const anchorTextMap = new Map<string, string>(); // anchorId -> plainText (with collapsed whitespace)

    for (const [key, rawRec] of ctx.records.entries()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const id = typeof rec.id === "string" ? rec.id : key;
      const text = extractEntityPlainText(rec).replace(/\s+/g, " ").trim();
      if (text) {
        anchorTextMap.set(id, text);
      }
    }

    // Check records containing hero quotes / pull quotes
    for (const [key, rawRec] of ctx.records.entries()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const id = typeof rec.id === "string" ? rec.id : key;

      const heroQuotes: Record<string, unknown>[] = [];
      if (rec.heroQuote && typeof rec.heroQuote === "object") {
        heroQuotes.push(rec.heroQuote as Record<string, unknown>);
      }
      if (Array.isArray(rec.heroQuotes)) {
        for (const hq of rec.heroQuotes) {
          if (hq && typeof hq === "object") heroQuotes.push(hq as Record<string, unknown>);
        }
      }
      if (Array.isArray(rec.pullQuotes)) {
        for (const pq of rec.pullQuotes) {
          if (pq && typeof pq === "object") heroQuotes.push(pq as Record<string, unknown>);
        }
      }

      for (let i = 0; i < heroQuotes.length; i++) {
        const hq = heroQuotes[i];
        if (!hq) continue;
        const anchor = typeof hq.anchor === "string" ? hq.anchor : "";
        const quoteText =
          typeof hq.text === "string" ? hq.text : typeof hq.quote === "string" ? hq.quote : "";
        const segments = Array.isArray(hq.segments) ? (hq.segments as string[]) : [];

        const editionText = anchorTextMap.get(anchor);
        if (!editionText) {
          ctx.report({
            rule: "hero-quote-unresolved",
            recordId: id,
            path: `${id}.heroQuote[${i}].anchor`,
            message: `Hero quote anchor "${anchor}" does not resolve to any edition text record.`,
            repair: `Ensure hero quote anchor points to a valid source block or translation unit.`,
          });
          continue;
        }

        // Check single quote or segments
        if (segments.length > 0) {
          // Ordered segments verification
          let lastIndex = 0;
          let failed = false;
          for (const seg of segments) {
            const normalizedSeg = seg.replace(/\s+/g, " ").trim();
            const foundIdx = editionText.indexOf(normalizedSeg, lastIndex);
            if (foundIdx === -1) {
              failed = true;
              break;
            }
            lastIndex = foundIdx + normalizedSeg.length;
          }

          if (failed) {
            ctx.report({
              rule: "hero-quote-unresolved",
              recordId: id,
              path: `${id}.heroQuote[${i}].segments`,
              message: `Hero quote ellipsis segments not found in exact order at anchor "${anchor}".`,
              repair: `Ensure all quote segments appear in order in edition text at anchor "${anchor}".`,
            });
          }
        } else if (quoteText) {
          const normalizedQuote = quoteText.replace(/\s+/g, " ").trim();
          if (!editionText.includes(normalizedQuote)) {
            ctx.report({
              rule: "hero-quote-unresolved",
              recordId: id,
              path: `${id}.heroQuote[${i}].text`,
              message: `Hero quote text does not resolve exactly at anchor "${anchor}".`,
              repair: `Match hero quote text verbatim to edition text at anchor "${anchor}".`,
            });
          }
        }
      }
    }
  },
};

// ============================================================================
// 9. ledger-marker-in-edition Check
// ============================================================================
export const checkLedgerMarkerInEdition: ContentCheck = {
  id: "structural-ledger-marker-in-edition",
  family: "structural",
  severity: "error",
  beadId: STRUCTURAL_BEAD_ID,
  description:
    "Rejects edition text containing ledger transcription page markers or scan furniture.",
  run: (ctx: CheckContext) => {
    for (const [key, rawRec] of ctx.records.entries()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const id = typeof rec.id === "string" ? rec.id : key;

      // Only check edition entities (source blocks, translation units, editorial notes, arguments)
      if (
        kind === "source-block" ||
        kind === "translation-unit" ||
        kind === "editorial-note" ||
        kind === "argument" ||
        kind === "foundation"
      ) {
        const text = extractEntityPlainText(rec);
        const match = LEDGER_PAGE_MARKER_REGEX.exec(text);
        if (match) {
          ctx.report({
            rule: "ledger-marker-in-edition",
            recordId: id,
            path: `${id}`,
            message: `Edition text contains ledger scan marker: "${match[0]}". Page locators belong in the ledger and receipt.`,
            repair: `Remove scan page furniture from edition text and record locators in block locators or provenance receipt.`,
          });
        }
      }
    }
  },
};

// ============================================================================
// 10. span-digest-mismatch Check
// ============================================================================
export const checkSpanDigestMismatch: ContentCheck = {
  id: "structural-span-digest-mismatch",
  family: "structural",
  severity: "error",
  beadId: STRUCTURAL_BEAD_ID,
  description: "Detects edited text whose sentence spans or alignment ranges were not re-measured.",
  run: (ctx: CheckContext) => {
    // 1. Check SourceBlock.sentenceSpans
    for (const [key, rawRec] of ctx.records.entries()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const id = typeof rec.id === "string" ? rec.id : key;

      if (kind === "source-block") {
        const blockText = extractEntityPlainText(rec);
        const computedDigest = spanTextDigest(blockText);

        if (Array.isArray(rec.sentenceSpans)) {
          for (let i = 0; i < rec.sentenceSpans.length; i++) {
            const sp = rec.sentenceSpans[i];
            if (!sp || typeof sp !== "object") continue;
            const sId = "id" in sp && typeof sp.id === "string" ? sp.id : `span-${i}`;
            const spanAnchor =
              "span" in sp && sp.span && typeof sp.span === "object" ? sp.span : undefined;

            if (spanAnchor) {
              const storedDigest =
                "textDigest" in spanAnchor && typeof spanAnchor.textDigest === "string"
                  ? spanAnchor.textDigest
                  : "normalizedTextDigest" in spanAnchor &&
                      typeof spanAnchor.normalizedTextDigest === "string"
                    ? spanAnchor.normalizedTextDigest
                    : "";
              if (storedDigest && storedDigest !== computedDigest) {
                ctx.report({
                  rule: "span-digest-mismatch",
                  recordId: id,
                  path: `source-blocks.${id}.sentenceSpans[${i}].span.textDigest`,
                  message: `Span digest mismatch on block "${id}" sentence "${sId}": stored digest "${storedDigest}" differs from computed digest "${computedDigest}".`,
                  repair: `Re-measure the spans of this block and bump blockRevision.`,
                });
              }
            }
          }
        }
      }

      // 2. Check Alignment ranges
      if (kind === "alignment" && Array.isArray(rec.edges)) {
        for (let i = 0; i < rec.edges.length; i++) {
          const edge = rec.edges[i];
          if (!edge || typeof edge !== "object") continue;
          const src =
            "source" in edge && edge.source && typeof edge.source === "object"
              ? edge.source
              : undefined;
          const tgt =
            "target" in edge && edge.target && typeof edge.target === "object"
              ? edge.target
              : undefined;

          const indexes = ctx.indexes as { byId?: Map<string, unknown> } | undefined;
          // Check source range
          const srcRange =
            src && "range" in src && src.range && typeof src.range === "object"
              ? src.range
              : undefined;
          if (src && srcRange) {
            const blockId = "blockId" in src && typeof src.blockId === "string" ? src.blockId : "";
            const blockRec =
              ctx.records.get(blockId) || (blockId ? indexes?.byId?.get(blockId) : undefined);
            if (blockRec) {
              const blockText = extractEntityPlainText(blockRec);
              const computedDigest = spanTextDigest(blockText);
              const storedDigest =
                "textDigest" in srcRange && typeof srcRange.textDigest === "string"
                  ? srcRange.textDigest
                  : "normalizedTextDigest" in srcRange &&
                      typeof srcRange.normalizedTextDigest === "string"
                    ? srcRange.normalizedTextDigest
                    : "";
              if (storedDigest && storedDigest !== computedDigest) {
                ctx.report({
                  rule: "span-digest-mismatch",
                  recordId: id,
                  path: `alignments.${id}.edges[${i}].source.range`,
                  message: `Span digest mismatch on alignment edge source block "${blockId}": stored digest "${storedDigest}" differs from computed digest "${computedDigest}".`,
                  repair: `Re-measure the spans of this block and bump blockRevision.`,
                });
              }
            }
          }

          // Check target range
          const tgtRange =
            tgt && "range" in tgt && tgt.range && typeof tgt.range === "object"
              ? tgt.range
              : undefined;
          if (tgt && tgtRange) {
            const translationUnitId =
              "translationUnitId" in tgt && typeof tgt.translationUnitId === "string"
                ? tgt.translationUnitId
                : "";
            const tuRec =
              ctx.records.get(translationUnitId) ||
              (translationUnitId ? indexes?.byId?.get(translationUnitId) : undefined);
            if (tuRec) {
              const tuText = extractEntityPlainText(tuRec);
              const computedDigest = spanTextDigest(tuText);
              const storedDigest =
                "textDigest" in tgtRange && typeof tgtRange.textDigest === "string"
                  ? tgtRange.textDigest
                  : "normalizedTextDigest" in tgtRange &&
                      typeof tgtRange.normalizedTextDigest === "string"
                    ? tgtRange.normalizedTextDigest
                    : "";
              if (storedDigest && storedDigest !== computedDigest) {
                ctx.report({
                  rule: "span-digest-mismatch",
                  recordId: id,
                  path: `alignments.${id}.edges[${i}].target.range`,
                  message: `Span digest mismatch on alignment edge target translation unit "${translationUnitId}": stored digest "${storedDigest}" differs from computed digest "${computedDigest}".`,
                  repair: `Re-measure the spans of this translation unit and bump blockRevision.`,
                });
              }
            }
          }
        }
      }
    }
  },
};

/**
 * All 10 structural content checks.
 */
export const ALL_STRUCTURAL_CHECKS: readonly ContentCheck[] = [
  checkDuplicateId,
  checkMissingSourceBlock,
  checkBrokenAlignment,
  checkDanglingCitation,
  checkImpossibleDateOrder,
  checkEquationNotIdentical,
  checkCompleteWhileMissing,
  checkHeroQuoteUnresolved,
  checkLedgerMarkerInEdition,
  checkSpanDigestMismatch,
];

/**
 * Registers all 10 structural compiler checks into the central check registry.
 */
export function registerStructuralChecks(): void {
  for (const check of ALL_STRUCTURAL_CHECKS) {
    registerCheck(check);
  }
}

// Auto-register upon import
registerStructuralChecks();
