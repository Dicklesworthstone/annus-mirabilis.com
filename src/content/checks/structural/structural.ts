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
import {
  editorialNotePaper,
  isEditorialNoteKey,
  isSourceBlockKey,
  parseRecordKey,
  recordKeyFor,
  sourceBlockPaper,
} from "../../compiler/recordKey.ts";
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
    /** `paper#id` for a printed equation block, whose id is per-paper by design. */
    const paperEquationBlocks = new Set<string>();
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

      // `kind !== "equation"` KEEPS THE ARM BELOW AT :352 IN CHARGE OF EQUATION BLOCKS. That arm
      // was written for them on 2026-09-28, already reads the KEY through `sourceBlockPaper`, and
      // reports "Duplicate equation source-block id ... within paper", which is the wording its
      // test asserts. A blanket source-block arm here would fire first and shadow it, replacing a
      // purpose-built refusal with a generic one -- so this arm takes the kinds nobody else
      // claims: paragraph, heading, footnote, closing, masthead, part-heading
      // (am-rc1001-bridge-plan-pcjk.10).
      if (isSourceBlockKey(key) && kind !== "equation") {
        // THE PAPER COMES FROM THE KEY. A block's id is per-paper by design, and a fixture or a
        // record that omits `paper` would otherwise collapse every paper into the "" bucket and
        // report three duplicates for one id legitimately reused across four papers
        // (recordKey.ts:69 states this, and it is why `sourceBlockPaper` exists).
        const blockPaper = sourceBlockPaper(key) ?? paper;
        let blocks = paperSourceBlocks.get(blockPaper);
        if (!blocks) {
          blocks = new Set();
          paperSourceBlocks.set(blockPaper, blocks);
        }
        if (blocks.has(id)) {
          ctx.report({
            rule: "duplicate-id",
            recordId: id,
            file,
            path: id,
            message: `Duplicate source block id "${id}" in paper "${blockPaper}".`,
            repair: `Assign a unique source block id within paper "${blockPaper}".`,
          });
        }
        blocks.add(id);

        // Check sentence spans inside source-block
        if (Array.isArray(rec.sentenceSpans)) {
          let sIds = paperSentenceIds.get(blockPaper);
          if (!sIds) {
            sIds = new Set();
            paperSentenceIds.set(blockPaper, sIds);
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
                  message: `Duplicate sentence span id "${sId}" in paper "${blockPaper}".`,
                  repair: `Assign a unique sentence span id within paper "${blockPaper}".`,
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
        // TWO FAMILIES CARRY `kind: "equation"`, AND ONLY ONE OF THEM IS GLOBAL (am-as1w follow-on).
        //
        // An equation RECORD, under content/equations/, is addressed by bare id from any paper, so
        // its id must be unique across all of them. Measured 2026-09-28: 154 records, 0 duplicated
        // ids. The rule is right about its own population and is kept unchanged for it.
        //
        // A SOURCE BLOCK whose kind is "equation" is a printed display, and its id is per-paper by
        // design. AGENTS.md qualifies a repeat only "when a printed number repeats within a paper";
        // sentence ids such as s3-p2-s1 carry no paper prefix, which only works in a per-paper
        // namespace; and an editorial note crosses that namespace with an explicit paper#id.
        // Measured: 200 such blocks, 47 ids present in more than one paper, 117 (paper, id) pairs
        // involved, so a global reading reports 117 - 47 = 70 duplicate-id errors about a corpus
        // that is correct. That is exactly what appeared when the blocks were first compiled as
        // records.
        //
        // The families are told apart by the record KEY, not by `rec.kind`, for the same reason
        // editorial notes are: `kind` is the RECORD's own kind and cannot name a family. A source
        // block is keyed source-block:<paper>:<id>; an equation record is keyed by bare id.
        // Within-paper uniqueness is not lost by this, and the mechanism is stronger than a
        // duplicate key: `path-identity` binds a source block's id to its filename stem, so two
        // files in one paper CANNOT declare the same id, and the collision is unconstructible
        // rather than merely caught. Measured 2026-09-28: two files under one paper both declaring
        // `eq-dup-x` produce two path-identity refusals naming each file. The scoped set below is
        // the second half of that guarantee, for any caller that keys blocks differently.
        const blockPaper = sourceBlockPaper(key);
        if (blockPaper === null) {
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
        } else {
          const scoped = `${blockPaper}#${id}`;
          if (paperEquationBlocks.has(scoped)) {
            ctx.report({
              rule: "duplicate-id",
              recordId: id,
              file,
              path: id,
              message: `Duplicate equation source-block id "${id}" within paper "${blockPaper}".`,
              repair: `Ensure a printed equation id is unique within its own paper.`,
            });
          }
          paperEquationBlocks.add(scoped);
        }
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

    // entries(), not values(): a source block is identified by its KEY (recordKey.ts), and this
    // loop previously asked `rec.kind === "source-block"`, which no block carries.
    for (const [key, rawRec] of ctx.records.entries()) {
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

      if (isSourceBlockKey(key)) {
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

    // THE POPULATION HAS TWO SOURCES AND THEY ARE COMPLEMENTARY, not a duplicate authority
    // (am-as1w). Records give it to a unit test, which constructs `kind: "source-block"` entries
    // in a mock context. Production has none, because loadReadingFiles skips every .yaml and the
    // 456 block files never become records; there the caller supplies the index instead, read
    // from content/source-blocks/ by src/content/compiler/sourceBlockIndex.ts. Merging rather
    // than choosing means neither path can silently become the only one.
    if (ctx.sourceBlockIndex) {
      for (const [paper, ids] of ctx.sourceBlockIndex) {
        let blocks = paperBlocks.get(paper);
        if (!blocks) {
          blocks = new Set();
          paperBlocks.set(paper, blocks);
        }
        for (const id of ids.blocks) blocks.add(id);
        let sSet = paperSentences.get(paper);
        if (!sSet) {
          sSet = new Set();
          paperSentences.set(paper, sSet);
        }
        for (const id of ids.sentences) sSet.add(id);
      }
    }

    // Check papers' orderedBlockIds
    let unjudgedAffectedIds = 0;
    for (const [key, rawRec] of ctx.records.entries()) {
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

      // Check EditorialNote.affectedIds. Identified by the record KEY, not by `rec.kind`: an
      // editorial note's own kind is `historian-margin`, `dispute`, `side-note` and so on, so the
      // old `kind === "editorial-note"` matched none of the 8 records on disk (am-as1w). The paper
      // comes from the key too, because a note carries no `paper` field; its directory is its paper.
      if (isEditorialNoteKey(key) && Array.isArray(rec.affectedIds)) {
        const defaultPaper = editorialNotePaper(key) ?? "";
        for (const affId of rec.affectedIds) {
          if (typeof affId === "string") {
            const parts = affId.includes("#") ? affId.split("#") : [defaultPaper, affId];
            const targetPaper = parts[0];
            const targetId = parts[1];
            if (targetPaper && targetId) {
              const blocks = paperBlocks.get(targetPaper) ?? new Set();
              const sentences = paperSentences.get(targetPaper) ?? new Set();
              // A CHECK WITH NOTHING TO RESOLVE AGAINST DECLINES, it does not condemn (am-as1w).
              // Enabling this check while the population was absent reported all 17 affectedIds of
              // the 8 real notes as missing, which were false positives about an absent population
              // rather than findings about the notes. The population is now supplied by the caller
              // (compiler/sourceBlockIndex.ts, 456 blocks in 4 papers), and this stays because a
              // caller that does not supply one must still get silence rather than 17 accusations.
              // Counted rather than passed over in silence, because "0 errors" over a population
              // that could not be loaded reads exactly like "0 errors" over a clean one.
              if (blocks.size === 0 && sentences.size === 0) {
                unjudgedAffectedIds += 1;
                continue;
              }
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
    // The silence is printed rather than left implicit: a run that judged nothing and a run
    // that found nothing are both zero errors, and only this line tells them apart (am-as1w).
    if (unjudgedAffectedIds > 0)
      console.log(
        `[structural] ${unjudgedAffectedIds} editorial-note affectedIds not judged: no source blocks were supplied for their papers, so this check declined rather than reporting them as missing (am-as1w).`,
      );
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

    // entries(), not values(): see the loop above.
    for (const [key, rawRec] of ctx.records.entries()) {
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

      if (isSourceBlockKey(key)) {
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
      // By key, not by `rec.kind`: see the affectedIds check above (am-as1w).
      if (isEditorialNoteKey(key) && Array.isArray(rec.sourceSupport)) {
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
      // THE CONDITION BELOW WAS UNSATISFIABLE. It read `kind === "source-block" && (rec.kind ===
      // "equation" || ...)`, and `kind` IS `rec.kind`, so it asked one field to hold two strings
      // at once. The German side of the equation-identity check could therefore never match a
      // record, which is why planting `, PLANTED` into a translation unit's LaTeX produced 0
      // reports (am-rc1001-bridge-plan-pcjk.10). The key says it is a source block; the record's
      // own kind says it is an equation; both are now asked of the thing that knows.
      if (
        isSourceBlockKey(key) &&
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
        // SCOPED BY PAPER, because an equation block id is per-paper and 47 of the 130 distinct
        // ids are used by two or three papers (measured 2026-10-10: 200 block files, 130 distinct
        // ids, so a bare-id map hides 70 of them behind a last-writer-wins collision). Keyed
        // bare, this map held one survivor per id and the check compared that survivor against
        // itself 200 times while 70 real blocks were never compared at all -- a clean verdict over
        // a population two thirds the size of the one it named (am-rc1001-bridge-plan-pcjk.10).
        germanEquations.set(`${sourceBlockPaper(key) ?? ""}#${id}`, mathContent);
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
        // Scoped for the same reason, from the unit's own key.
        englishEquations.set(`${parseRecordKey(key)?.paper ?? ""}#${id}`, mathContent);
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

    // THE CENSUS, BECAUSE THIS CHECK HAS REPORTED 0 OVER 0 PAIRS (am-rc1001-bridge-plan-pcjk.10).
    // `germanEquations` was filled behind `kind === "source-block" && rec.kind === "equation"`,
    // one field asked to hold two strings at once, so it was ALWAYS EMPTY and every pair below
    // failed the `!== undefined` guard in silence. The guard is right -- an edge whose two ends
    // are not both equations is not this check's business -- which is exactly why the number of
    // pairs it actually compared has to be printed beside the verdict.
    let edgesSeen = 0;
    let pairsCompared = 0;

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
            // The alignment names its own paper, and both ends of an edge are in it.
            const edgePaper =
              typeof rec.paper === "string"
                ? rec.paper
                : typeof rec.paperSlug === "string"
                  ? rec.paperSlug
                  : "";
            const germanMath = germanEquations.get(`${edgePaper}#${src.blockId}`);
            const englishMath = englishEquations.get(`${edgePaper}#${tgt.translationUnitId}`);
            edgesSeen += 1;
            if (germanMath !== undefined && englishMath !== undefined) {
              pairsCompared += 1;
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
    console.log(
      `[census] equation-not-identical collected ${germanEquations.size} German equation block(s) ` +
        `and ${englishEquations.size} English equation unit(s), keyed <paper>#<id>, and compared ` +
        `${pairsCompared} pair(s) over ${edgesSeen} alignment edge(s) carrying both ends.` +
        (pairsCompared === 0 ? " 0 pairs compared, so this verdict is about nothing." : ""),
    );
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

        // entries(), not values(): a source block is identified by its KEY, and the paper is in
        // the key too, so neither question needs the record to carry a field it does not.
        for (const [otherKey, otherRec] of ctx.records.entries()) {
          if (!otherRec || typeof otherRec !== "object") continue;
          const o = otherRec as Record<string, unknown>;
          const blockPaper = sourceBlockPaper(otherKey);
          if (blockPaper === id) {
            paperBlocks.push(o);
            continue;
          }
          if ((o.paper === id || o.paperSlug === id) && o.kind === "translation-unit") {
            paperTus.push(o);
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
    /**
     * THE CENSUS, BECAUSE 0 ERRORS HERE HAS ALWAYS MEANT 0 QUOTES (am-cm-checks-structural-lq0).
     *
     * This check reported clean on every run of verify-content since it was written, and the
     * reason is that NO paper record declares a hero quote, a pull quote, or anything else this
     * reads. `editionContract.ts`'s check 12, which names this check as its owner, says the same
     * in its own comment: "Measured on 2026-09-19, no paper record declares a hero quote, so all
     * four report not-available today; the check goes live the day one is authored." That one is
     * honest about it and reports `not-available`; this one silently reported a pass.
     *
     * TWO NUMBERS, NOT ONE, BECAUSE THE SECOND IS THE WORSE FINDING. `quotesExamined` at 0 means
     * nothing was judged. The anchor count is the population a quote could resolve AGAINST, and
     * measured 2026-10-10 over the whole compiled corpus IT IS ALSO ZERO.
     *
     * That is not a content gap, it is this check reading a layer that cannot carry what it wants.
     * `anchorTextMap` is filled by `extractEntityPlainText`, which looks for `inlines`,
     * `diplomaticText`, `text` or `phrase` on a compiled record -- and the edition text lives in
     * the SOURCE BLOCKS, which `compiler.ts:80` hands to the caller rather than compiling as
     * records, "see src/content/compiler/sourceBlockIndex.ts". The index that does reach this
     * context carries ids only, never text. So the map is empty by construction and always was.
     *
     * The consequence runs the dangerous way. Authoring the first hero quote would not make this
     * check pass; it would make verify-content RED with "no edition text at anchor", for a reason
     * that is about the plumbing and reads like a reason about the quote. The fix is not a line
     * here: it means deciding what a hero quote may anchor to -- a block id is in reach, a
     * sentence id like `s0-p7-s3` is a span inside a block and is not -- and then giving this
     * check a text source. Both are this check's owner's call, so this records the state rather
     * than guessing at it.
     */
    let quotesExamined = 0;
    let recordsWithQuotes = 0;

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

      quotesExamined += heroQuotes.length;
      if (heroQuotes.length > 0) recordsWithQuotes += 1;
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
    console.log(
      `[census] hero-quote-unresolved examined ${quotesExamined} hero/pull quote(s) on ` +
        `${recordsWithQuotes} record(s), against ${anchorTextMap.size} anchor(s) carrying edition text.` +
        (quotesExamined === 0
          ? " 0 quotes, so this verdict is about nothing: no paper record declares one."
          : "") +
        (anchorTextMap.size === 0
          ? " 0 anchors, so no quote COULD resolve here: the edition text is in the source blocks," +
            " which the compiler hands to the caller rather than compiling as records, and the index" +
            " that reaches this check carries ids only (am-cm-checks-structural-lq0)."
          : ""),
    );
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
        isSourceBlockKey(key) ||
        kind === "translation-unit" ||
        isEditorialNoteKey(key) ||
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
    /**
     * TWO HALVES WITH VERY DIFFERENT POPULATIONS, AND ONLY ONE OF THEM HAS DATA
     * (am-rc1001-bridge-plan-pcjk.10).
     *
     * Half one reads `span.textDigest` on a source block's sentence spans. Measured 2026-10-10:
     * 453 blocks declare `sentenceSpans` and 542 spans carry a digest, so this half has a real
     * population -- and it only reached it at 89f7e3b9, when the blocks began being compiled.
     * Before that it examined nothing and reported clean.
     *
     * Half two reads `range.textDigest` on an alignment edge, and ZERO of the 821 committed edges
     * carry a range at all: `grep -c textDigest content/alignments/*.yaml` is 0 across all four
     * papers. So that half is correctly vacuous, and a plant into a translation unit's text
     * produces no report NOT because the check is broken but because the data it would compare
     * against does not exist. A reader of "0 mismatches" has to be able to tell those two cases
     * apart, which is what the census below is for.
     */
    let spansWithDigest = 0;
    let blocksWithSpans = 0;
    const edgeRangesWithDigest = 0;

    // 1. Check SourceBlock.sentenceSpans
    for (const [key, rawRec] of ctx.records.entries()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      const kind = typeof rec.kind === "string" ? rec.kind : "";
      const id = typeof rec.id === "string" ? rec.id : key;

      if (isSourceBlockKey(key)) {
        const blockText = extractEntityPlainText(rec);
        const computedDigest = spanTextDigest(blockText);

        if (Array.isArray(rec.sentenceSpans)) {
          blocksWithSpans += 1;
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
              if (storedDigest) spansWithDigest += 1;
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
        // BOTH ENDS OF AN EDGE ARE KEYED `<kind>:<paper>:<id>`, so a bare-id lookup finds neither
        // (recordKey.ts). Both halves below read `ctx.records.get(...)` by bare id, which could
        // only ever have found a record in a corpus keyed that way -- that is, in a fixture. The
        // alignment names its own paper, so the production key is constructible for both; the
        // bare id stays as a fallback because `indexes.byId` holds both spellings. This matters
        // from the moment the edition layer began being compiled at 89f7e3b9, because the records
        // are there now (am-rc1001-bridge-plan-pcjk.10).
        const alignmentPaper =
          typeof rec.paper === "string"
            ? rec.paper
            : typeof rec.paperSlug === "string"
              ? rec.paperSlug
              : "";
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
              (blockId && alignmentPaper
                ? ctx.records.get(recordKeyFor("source-block", alignmentPaper, blockId))
                : undefined) ||
              (blockId ? ctx.records.get(blockId) : undefined) ||
              (blockId ? indexes?.byId?.get(blockId) : undefined);
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
            // A TRANSLATION UNIT IS KEYED `translation-unit:<paper>:<id>` TOO, so the bare-id
            // lookup here could only ever find one in a fixture -- the same defect the block
            // lookup above had. It mattered from the moment the units started being compiled
            // (89f7e3b9): the records are present now, and without this the target half of every
            // span-digest comparison would silently find nothing
            // (am-rc1001-bridge-plan-pcjk.10).
            const tuRec =
              (translationUnitId && alignmentPaper
                ? ctx.records.get(
                    recordKeyFor("translation-unit", alignmentPaper, translationUnitId),
                  )
                : undefined) ||
              (translationUnitId ? ctx.records.get(translationUnitId) : undefined) ||
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
    console.log(
      `[census] span-digest-mismatch examined ${spansWithDigest} sentence span digest(s) on ` +
        `${blocksWithSpans} block(s), and ${edgeRangesWithDigest} alignment edge range digest(s).` +
        (spansWithDigest === 0 ? " 0 span digests, so the source-block half judged nothing." : "") +
        (edgeRangesWithDigest === 0
          ? " 0 edge range digests: the committed alignments carry no `range` on any edge, so the" +
            " alignment half is vacuous BY THE DATA rather than broken, and a plant into a" +
            " translation unit's text correctly produces nothing."
          : ""),
    );
  },
};

// ============================================================================
// 11. inline-math-not-identical Check
// ============================================================================
/**
 * NOTATION IS NOT TRANSLATED, AND THAT RULE COVERS THE INLINE MATH TOO
 * (am-rc1001-bridge-plan-pcjk.10 step 5).
 *
 * `checkEquationNotIdentical` compares the 200 printed DISPLAYS. The 714 substantive inline
 * expressions were compared by nothing at all, and AGENTS.md's rule is the same for both: "Keep
 * every symbol as printed on both faces."
 *
 * THREE DECISIONS, each measured over the real corpus on 2026-10-10 before it was taken, because
 * the first two readings of this question both produce a number that looks like a finding and is
 * not:
 *
 *  1. GROUPED BY BLOCK, not per edge. The alignment is many-to-many: one German paragraph aligns
 *     to several English sentence units. Per edge, a paragraph is compared against ONE of its
 *     sentences and 430 of 669 pairs "differ" by construction. Grouped, 453 blocks resolve and
 *     the question is the one the rule asks.
 *  2. DISPLAY MATH EXCLUDED. A printed display sits inside the German paragraph's inline flow, and
 *     on the English face it is its own translation unit aligned to the display BLOCK. Counting
 *     it compares a paragraph against a paragraph-minus-its-display: 86 of 336 differ. Excluding
 *     it -- which is also what `plainText` does -- gives 7 of 329. The displays are not lost: they
 *     are exactly what check 6 compares.
 *  3. A MULTISET, not a sequence. English word order moves, so a symbol legitimately appears
 *     earlier or later in the sentence; what must not change is WHICH symbols appear and how
 *     often.
 *
 * SEVERITY IS FLAG, as the bead asks ("not an error until reviewed"). The seven it finds today are
 * real and reviewable -- an English face carrying `\Pi \cdot 10^7 = 4{,}3` the German does not,
 * another carrying `(X', Y' Z')` where the German has no such inline and the English spelling is
 * itself missing a comma -- but whether each is a translator's clarification to keep or a
 * notation drift to repair is an editorial judgement, not a compiler's.
 */
export const checkInlineMathNotIdentical: ContentCheck = {
  id: "structural-inline-math-not-identical",
  family: "structural",
  severity: "flag",
  beadId: STRUCTURAL_BEAD_ID,
  description:
    "Reports where a German block's inline mathematics differs from the inline mathematics of the English units aligned to it.",
  run: (ctx: CheckContext) => {
    /** Every non-display inline math latex in a record, in order, descending into nested inlines. */
    const inlineMathOf = (rec: Record<string, unknown>): string[] => {
      const out: string[] = [];
      const walk = (nodes: unknown): void => {
        if (!Array.isArray(nodes)) return;
        for (const node of nodes) {
          if (!node || typeof node !== "object") continue;
          const n = node as Record<string, unknown>;
          if (n.kind === "math" && typeof n.latex === "string" && n.display !== true) {
            out.push(n.latex);
          }
          if (Array.isArray(n.inlines)) walk(n.inlines);
          if (Array.isArray(n.children)) walk(n.children);
        }
      };
      walk(rec.inlines);
      return out;
    };

    // blockKey -> the translation units aligned to it, from the alignment records.
    const grouped = new Map<string, Set<string>>();
    for (const [, rawRec] of ctx.records.entries()) {
      if (!rawRec || typeof rawRec !== "object") continue;
      const rec = rawRec as Record<string, unknown>;
      if (rec.kind !== "alignment" || !Array.isArray(rec.edges)) continue;
      const paper =
        typeof rec.paper === "string"
          ? rec.paper
          : typeof rec.paperSlug === "string"
            ? rec.paperSlug
            : "";
      for (const edge of rec.edges) {
        if (!edge || typeof edge !== "object") continue;
        const src = (edge as Record<string, unknown>).source as Record<string, unknown> | undefined;
        const tgt = (edge as Record<string, unknown>).target as Record<string, unknown> | undefined;
        const blockId = typeof src?.blockId === "string" ? src.blockId : "";
        const unitId = typeof tgt?.translationUnitId === "string" ? tgt.translationUnitId : "";
        if (!blockId || !unitId) continue;
        const key = recordKeyFor("source-block", paper, blockId);
        let set = grouped.get(key);
        if (!set) {
          set = new Set();
          grouped.set(key, set);
        }
        set.add(recordKeyFor("translation-unit", paper, unitId));
      }
    }

    let resolved = 0;
    let carryingMath = 0;
    let differing = 0;
    for (const [blockKey, unitKeys] of grouped) {
      const block = ctx.records.get(blockKey);
      if (!block || typeof block !== "object") continue;
      const english: string[] = [];
      let anyUnitMissing = false;
      for (const unitKey of unitKeys) {
        const unit = ctx.records.get(unitKey);
        if (!unit || typeof unit !== "object") {
          anyUnitMissing = true;
          break;
        }
        english.push(...inlineMathOf(unit as Record<string, unknown>));
      }
      // A block whose units are not all present is not comparable, and guessing from the ones that
      // are would report a difference that is an absence.
      if (anyUnitMissing) continue;
      resolved += 1;
      const german = inlineMathOf(block as Record<string, unknown>);
      if (german.length === 0 && english.length === 0) continue;
      carryingMath += 1;
      const asMultiset = (items: readonly string[]): string => [...items].sort().join("\u0001");
      if (asMultiset(german) === asMultiset(english)) continue;
      differing += 1;
      const germanOnly = german.filter((x) => !english.includes(x));
      const englishOnly = english.filter((x) => !german.includes(x));
      const blockId = blockKey.split(":").slice(2).join(":");
      ctx.report({
        rule: "inline-math-not-identical",
        recordId: blockId,
        path: `source-blocks.${blockId}.inlines`,
        message:
          `Inline mathematics differs between the German block "${blockId}" and the ` +
          `${unitKeys.size} English unit(s) aligned to it: ` +
          `${germanOnly.length} only in the German (${JSON.stringify(germanOnly.slice(0, 3))}), ` +
          `${englishOnly.length} only in the English (${JSON.stringify(englishOnly.slice(0, 3))}).`,
        repair:
          "Notation is not translated: keep every symbol as printed on both faces, or record the " +
          "difference as an editorial note if the English deliberately adds a clarifying form.",
      });
    }
    console.log(
      `[census] inline-math-not-identical examined ${resolved} block(s) with all their aligned ` +
        `units present, ${carryingMath} carrying inline math; ${differing} differ.` +
        (carryingMath === 0 ? " 0 carrying inline math, so this verdict is about nothing." : ""),
    );
  },
};

/**
 * All 11 structural content checks.
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
  checkInlineMathNotIdentical,
];

/**
 * Registers all 11 structural compiler checks into the central check registry.
 */
export function registerStructuralChecks(): void {
  for (const check of ALL_STRUCTURAL_CHECKS) {
    registerCheck(check);
  }
}

// Auto-register upon import
registerStructuralChecks();
