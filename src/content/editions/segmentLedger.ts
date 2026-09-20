/**
 * Propose blocks and sentences from a reviewed ledger (am-edn-alignment-tooling-do1).
 * Segmentation is a proposal. Frozen ids never change because a paragraph is inserted.
 * Supports every block kind: masthead, headings, paragraphs, equations, footnotes, closings.
 */

import {
  extractSentenceInlineMathIds,
  findDisplayMathRegions,
  proposeSentences,
} from "./segmentSentences.ts";

export type ProposedBlockKind =
  | "masthead-title"
  | "masthead-author"
  | "heading"
  | "part-heading"
  | "paragraph"
  | "equation"
  | "footnote"
  | "closing-dateline"
  | "closing-ack"
  | "closing-received";

export type ProposedSentence = Readonly<{
  id: string;
  text: string;
  inlineMathIds?: readonly string[] | undefined;
}>;

export type ProposedBlock = Readonly<{
  id: string;
  kind: ProposedBlockKind;
  text: string;
  label?: string | undefined;
  footnoteLabel?: string | undefined;
  sentences: readonly ProposedSentence[];
  displayEquationIds?: readonly string[] | undefined;
  locators?: readonly string[] | undefined;
}>;

export type ReconciliationDifference = Readonly<{
  differenceId: string;
  kind:
    | "boundary-differs"
    | "unit-missing-in-ledger"
    | "unit-extra-in-ledger"
    | "label-differs"
    | "locator-differs"
    | "count-differs";
  unitId: string;
  message: string;
  proposedRepair?:
    | {
        kind: "retired" | "split" | "merged";
        retiredId: string;
        replacementIds: readonly string[];
      }
    | undefined;
}>;

export type SegmentLedgerResult =
  | Readonly<{
      status: "absent";
      code: "ledger-absent";
      message: string;
      blocks: readonly [];
    }>
  | Readonly<{
      status: "proposed";
      blocks: readonly ProposedBlock[];
      differences: readonly ReconciliationDifference[];
    }>;

const PAGE_MARKER = /---\s*REVIEWED\s+TRANSCRIPTION\s+PAGE\s+\d+\s+OF\s+\d+\s*---/g;
const PAGE_ANCHOR = /\[\[ANNALEN-PAGE[^\]]*\]\]/g;
const ARTICLE_NUMBER = /\[\[ARTICLE-NUMBER[^\]]*\]\]/g;
const OTHER_ARTICLE = /\[\[OTHER-ARTICLE-OMITTED\]\]/g;

function stripFurniture(ledger: string): string {
  return ledger
    .replace(PAGE_MARKER, "\n")
    .replace(PAGE_ANCHOR, "\n")
    .replace(ARTICLE_NUMBER, "\n")
    .replace(OTHER_ARTICLE, "\n");
}

function headingId(raw: string): string {
  const part = raw.match(/PART-HEADING\s+(part-[12])/i);
  if (part?.[1]) return part[1];
  const section = raw.match(/HEADING\s+(s\d+)/i);
  return section?.[1] ?? raw.trim();
}

/**
 * Propose blocks from a validated ledger string. If the ledger is missing,
 * this returns `ledger-absent` and never a complete edition.
 */
export function segmentLedger(input: {
  ledgerText?: string | null | undefined;
  frozenIds?: readonly string[] | undefined;
}): SegmentLedgerResult {
  if (
    input.ledgerText === null ||
    input.ledgerText === undefined ||
    input.ledgerText.trim() === ""
  ) {
    return {
      status: "absent",
      code: "ledger-absent",
      message: "No ledger present. Absence is not completeness.",
      blocks: [],
    };
  }

  const text = stripFurniture(input.ledgerText);
  const blocks: ProposedBlock[] = [];
  let section = "s0";
  let paragraph = 0;
  let equationCounter = 0;
  let footnoteCounter = 0;

  const lines = text.split(/\n/);
  let buffer = "";
  let bufferKind: ProposedBlockKind | "paragraph-continue" | null = null;

  const flushParagraph = () => {
    if (!buffer.trim() || (bufferKind !== "paragraph-continue" && bufferKind !== "paragraph")) {
      if (bufferKind === "paragraph" || bufferKind === "paragraph-continue") buffer = "";
      return;
    }

    const rawPara = buffer.trim();
    paragraph += 1;
    const id = `${section}-p${paragraph}`;

    // Extract display equations inside paragraph (rule A.2)
    const displayRegions = findDisplayMathRegions(rawPara);
    const displayEquationIds: string[] = [];

    for (const disp of displayRegions) {
      equationCounter += 1;
      const eqId = `${section}-eq${equationCounter}`;
      displayEquationIds.push(eqId);
      blocks.push({
        id: eqId,
        kind: "equation",
        text: disp.latex.trim(),
        ...(disp.label !== undefined ? { label: disp.label } : {}),
        sentences: [],
      });
    }

    // Propose sentences for paragraph
    const proposals = proposeSentences(rawPara);
    const sentences: ProposedSentence[] = proposals.map((s, k) => {
      const sentenceId = `${id}-s${k + 1}`;
      const mathIds = extractSentenceInlineMathIds(s.text, sentenceId);
      return {
        id: sentenceId,
        text: s.text,
        ...(mathIds.length > 0 ? { inlineMathIds: mathIds } : {}),
      };
    });

    blocks.push({
      id,
      kind: "paragraph",
      text: rawPara,
      sentences: Object.freeze(sentences),
      ...(displayEquationIds.length > 0
        ? { displayEquationIds: Object.freeze(displayEquationIds) }
        : {}),
    });

    buffer = "";
    bufferKind = null;
  };

  let inStandaloneEquation = false;
  let standaloneEqLatex = "";
  let standaloneEqLabel: string | undefined;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx] ?? "";
    const line = rawLine.trim();
    if (!line) {
      if (inStandaloneEquation) {
        // Continue buffering multiline equation
        standaloneEqLatex += "\n";
        continue;
      }
      if (bufferKind === "paragraph-continue") {
        continue;
      }
      flushParagraph();
      continue;
    }

    // 1. Masthead
    if (/^\[\[TITLE\]\]/.test(line) || line === "[[TITLE]]") {
      flushParagraph();
      const rest = line.replace(/^\[\[TITLE\]\]\s*/, "").replace(/\[\[\/TITLE\]\]\s*$/, "");
      if (rest.length > 0) {
        blocks.push({ id: "masthead-title", kind: "masthead-title", text: rest, sentences: [] });
      } else {
        bufferKind = "masthead-title";
      }
      continue;
    }
    if (bufferKind === "masthead-title" && !line.startsWith("[[")) {
      const textVal = line.replace(/\[\[\/TITLE\]\]\s*$/, "");
      blocks.push({ id: "masthead-title", kind: "masthead-title", text: textVal, sentences: [] });
      bufferKind = null;
      continue;
    }

    if (/^\[\[AUTHOR\]\]/.test(line) || line === "[[AUTHOR]]") {
      flushParagraph();
      const rest = line.replace(/^\[\[AUTHOR\]\]\s*/, "").replace(/\[\[\/AUTHOR\]\]\s*$/, "");
      if (rest.length > 0) {
        blocks.push({ id: "masthead-author", kind: "masthead-author", text: rest, sentences: [] });
      } else {
        bufferKind = "masthead-author";
      }
      continue;
    }
    if (bufferKind === "masthead-author" && !line.startsWith("[[")) {
      const textVal = line.replace(/\[\[\/AUTHOR\]\]\s*$/, "");
      blocks.push({ id: "masthead-author", kind: "masthead-author", text: textVal, sentences: [] });
      bufferKind = null;
      continue;
    }

    // 2. Headings
    const heading = line.match(/^\[\[(HEADING|PART-HEADING)\s+([^\]]+)\]\]/);
    if (heading) {
      flushParagraph();
      const id = headingId(line);
      // The section-id SHAPE, not "begins with s" (am-o44v). headingId returns
      // `part-N`, `s<n>`, or the raw line as a fallback, so today only `s<n>`
      // can reach this branch - but that is an invariant held two functions
      // away. Expressed locally, `summary`, `sources` or `sigma` cannot silently
      // become a section and reset the paragraph, equation and footnote
      // counters for everything that follows.
      if (/^s\d+$/.test(id)) {
        section = id;
        paragraph = 0;
        equationCounter = 0;
        footnoteCounter = 0;
      }
      const kind: ProposedBlockKind = id.startsWith("part-") ? "part-heading" : "heading";
      const rest = line.replace(/^\[\[.*?\]\]\s*/, "");
      blocks.push({ id, kind, text: rest, sentences: [] });
      continue;
    }

    // 3. Footnotes
    const fnMatch = line.match(/^\[\[FN\s+([^\]]+)\]\]\s*([\s\S]*)$/);
    if (fnMatch) {
      flushParagraph();
      footnoteCounter += 1;
      const fnId = `${section}-fn${footnoteCounter}`;
      const fnLabel = fnMatch[1]?.trim();
      const fnText = fnMatch[2]?.trim() ?? "";
      blocks.push({
        id: fnId,
        kind: "footnote",
        text: fnText,
        ...(fnLabel !== undefined ? { footnoteLabel: fnLabel } : {}),
        sentences: [],
      });
      continue;
    }

    if (/^\[\[FN-CONTINUES\]\]/.test(line)) {
      continue;
    }

    const fnContMatch = line.match(/^\[\[FN-CONT\s+([^\]]+)\]\]\s*([\s\S]*)$/);
    if (fnContMatch) {
      const contText = fnContMatch[2]?.trim() ?? "";
      // Join to the last footnote block
      const lastFnIndex = [...blocks].reverse().findIndex((b) => b.kind === "footnote");
      if (lastFnIndex !== -1) {
        const actualIndex = blocks.length - 1 - lastFnIndex;
        const prevFn = blocks[actualIndex]!;
        blocks[actualIndex] = {
          ...prevFn,
          text: `${prevFn.text} ${contText}`.trim(),
        };
      }
      continue;
    }

    // 4. Standalone equations (outside paragraph)
    if (!inStandaloneEquation && (line === "$$" || /^(\$\$)[\s\S]*(\$\$)$/.test(line))) {
      // Check if this is a standalone equation
      if (!buffer.trim() || bufferKind === null) {
        flushParagraph();
        if (/^(\$\$)[\s\S]*(\$\$)/.test(line) && line !== "$$") {
          // Single-line display equation
          const eqInner = line.replace(/^\$\$\s*/, "").replace(/\s*\$\$$/, "");
          let labelVal: string | undefined;
          // Check next line for [[EQ-LABEL ...]]
          if (
            idx + 1 < lines.length &&
            /^\[\[EQ-LABEL\s+([^\]]+)\]\]/.test(lines[idx + 1]?.trim() ?? "")
          ) {
            labelVal = lines[idx + 1]!.trim()
              .match(/^\[\[EQ-LABEL\s+([^\]]+)\]\]/)?.[1]
              ?.trim();
            idx += 1;
          }
          equationCounter += 1;
          blocks.push({
            id: `${section}-eq${equationCounter}`,
            kind: "equation",
            text: eqInner.trim(),
            ...(labelVal !== undefined ? { label: labelVal } : {}),
            sentences: [],
          });
          continue;
        } else {
          // Multiline equation start
          inStandaloneEquation = true;
          standaloneEqLatex = "";
          standaloneEqLabel = undefined;
          continue;
        }
      }
    }

    if (inStandaloneEquation) {
      if (line === "$$" || line.endsWith("$$")) {
        inStandaloneEquation = false;
        const latexClean = (standaloneEqLatex + " " + line.replace(/\$\$$/, "")).trim();
        // Check next line for label
        if (
          idx + 1 < lines.length &&
          /^\[\[EQ-LABEL\s+([^\]]+)\]\]/.test(lines[idx + 1]?.trim() ?? "")
        ) {
          standaloneEqLabel = lines[idx + 1]!.trim()
            .match(/^\[\[EQ-LABEL\s+([^\]]+)\]\]/)?.[1]
            ?.trim();
          idx += 1;
        }
        equationCounter += 1;
        blocks.push({
          id: `${section}-eq${equationCounter}`,
          kind: "equation",
          text: latexClean,
          ...(standaloneEqLabel !== undefined ? { label: standaloneEqLabel } : {}),
          sentences: [],
        });
        continue;
      } else {
        standaloneEqLatex = `${standaloneEqLatex} ${line}`.trim();
        continue;
      }
    }

    // 5. Closings
    if (/^\[\[DATELINE\]\]/.test(line)) {
      flushParagraph();
      blocks.push({
        id: "closing-dateline",
        kind: "closing-dateline",
        text: line.replace(/^\[\[DATELINE\]\]\s*/, ""),
        sentences: [],
      });
      continue;
    }
    if (/^\[\[ACK\]\]/.test(line)) {
      flushParagraph();
      blocks.push({
        id: "closing-ack",
        kind: "closing-ack",
        text: line.replace(/^\[\[ACK\]\]\s*/, ""),
        sentences: [],
      });
      continue;
    }
    if (/^\[\[RECEIVED\]\]/.test(line)) {
      flushParagraph();
      blocks.push({
        id: "closing-received",
        kind: "closing-received",
        text: line.replace(/^\[\[RECEIVED\]\]\s*/, ""),
        sentences: [],
      });
      continue;
    }

    // 6. Paragraph continuations across page breaks
    if (/^\[\[CONTINUES\]\]/.test(line)) {
      bufferKind = "paragraph-continue";
      continue;
    }

    if (bufferKind === "paragraph-continue") {
      buffer = `${buffer} ${line}`.trim();
      bufferKind = "paragraph";
      continue;
    }

    // 7. Paragraph body accumulation
    if (bufferKind === "paragraph") {
      buffer = `${buffer} ${line}`.trim();
    } else {
      flushParagraph();
      buffer = line;
      bufferKind = "paragraph";
    }
  }

  flushParagraph();

  // Reconcile differences against frozenIds if provided
  const frozen = new Set(input.frozenIds ?? []);
  const differences: ReconciliationDifference[] = [];
  if (frozen.size > 0) {
    for (const block of blocks) {
      if (!frozen.has(block.id)) {
        differences.push({
          differenceId: `unit-extra-in-ledger:${block.id}`,
          kind: "unit-extra-in-ledger",
          unitId: block.id,
          message: `Proposed block "${block.id}" is not in the frozen manifest.`,
        });
      }
    }
    for (const id of frozen) {
      if (!blocks.some((b) => b.id === id || b.sentences.some((s) => s.id === id))) {
        differences.push({
          differenceId: `unit-missing-in-ledger:${id}`,
          kind: "unit-missing-in-ledger",
          unitId: id,
          message: `Frozen id "${id}" has no proposed ledger unit.`,
        });
      }
    }
  }

  return {
    status: "proposed",
    blocks: Object.freeze(blocks),
    differences: Object.freeze(differences),
  };
}

/**
 * Return permanent German alignable IDs from proposed blocks.
 * Sentences of paragraph blocks align at sentence level; masthead, headings,
 * footnotes, and closings align at block level. Equations align by reference.
 */
export function germanAlignableIds(blocks: readonly ProposedBlock[]): readonly string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.kind === "paragraph") {
      for (const s of block.sentences) ids.push(s.id);
    } else if (block.kind !== "equation") {
      ids.push(block.id);
    }
  }
  return Object.freeze(ids);
}

export {
  type ConfirmAliasOptions,
  type ConfirmAliasResult,
  confirmAlias,
  type ManifestUnit,
  type ReconcileInput,
  reconcileManifest,
  type WriteBlocksOptions,
  type WriteBlocksResult,
  writeProposedBlocks,
} from "./reconciliation.ts";
export {
  type SegmentationIssue,
  type SegmentSpan,
  validateSegmentation,
} from "./segmentSentences.ts";
