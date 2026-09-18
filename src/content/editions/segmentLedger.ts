/**
 * Propose blocks and sentences from a reviewed ledger (am-edn-alignment-tooling-do1).
 * Segmentation is a proposal. Frozen ids never change because a paragraph is inserted.
 */

import { proposeSentences } from "./segmentSentences.ts";

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
}>;

export type ProposedBlock = Readonly<{
  id: string;
  kind: ProposedBlockKind;
  text: string;
  sentences: readonly ProposedSentence[];
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

function stripFurniture(ledger: string): string {
  return ledger.replace(PAGE_MARKER, "\n").replace(PAGE_ANCHOR, "\n");
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

  const lines = text.split(/\n/);
  let buffer = "";
  let bufferKind: ProposedBlockKind | "paragraph-continue" | null = null;

  const flushParagraph = () => {
    if (!buffer.trim() || (bufferKind !== "paragraph-continue" && bufferKind !== "paragraph")) {
      if (bufferKind === "paragraph" || bufferKind === "paragraph-continue") buffer = "";
      return;
    }
    paragraph += 1;
    const id = `${section}-p${paragraph}`;
    const sentences = proposeSentences(buffer.trim()).map((s, k) => ({
      id: `${id}-s${k + 1}`,
      text: s.text,
    }));
    blocks.push({
      id,
      kind: "paragraph",
      text: buffer.trim(),
      sentences: Object.freeze(sentences),
    });
    buffer = "";
    bufferKind = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (/^\[\[TITLE\]\]/.test(line) || line === "[[TITLE]]") {
      flushParagraph();
      bufferKind = "masthead-title";
      continue;
    }
    if (bufferKind === "masthead-title" && !line.startsWith("[[")) {
      blocks.push({ id: "masthead-title", kind: "masthead-title", text: line, sentences: [] });
      bufferKind = null;
      continue;
    }
    if (/^\[\[AUTHOR\]\]/.test(line) || line === "[[AUTHOR]]") {
      flushParagraph();
      bufferKind = "masthead-author";
      continue;
    }
    if (bufferKind === "masthead-author" && !line.startsWith("[[")) {
      blocks.push({ id: "masthead-author", kind: "masthead-author", text: line, sentences: [] });
      bufferKind = null;
      continue;
    }
    const heading = line.match(/^\[\[(HEADING|PART-HEADING)\s+([^\]]+)\]\]/);
    if (heading) {
      flushParagraph();
      const id = headingId(line);
      if (id.startsWith("s")) section = id;
      const kind: ProposedBlockKind = id.startsWith("part-") ? "part-heading" : "heading";
      const rest = line.replace(/^\[\[.*?\]\]\s*/, "");
      blocks.push({ id, kind, text: rest, sentences: [] });
      paragraph = 0;
      continue;
    }
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
    if (/^\[\[CONTINUES\]\]/.test(line)) {
      bufferKind = "paragraph-continue";
      continue;
    }
    if (bufferKind === "paragraph-continue") {
      buffer = `${buffer} ${line}`.trim();
      continue;
    }
    flushParagraph();
    buffer = line;
    bufferKind = "paragraph";
  }
  flushParagraph();

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

export function germanAlignableIds(blocks: readonly ProposedBlock[]): readonly string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.kind === "paragraph") {
      for (const s of block.sentences) ids.push(s.id);
    } else {
      ids.push(block.id);
    }
  }
  return Object.freeze(ids);
}

export {
  validateSegmentation,
  type SegmentationIssue,
  type SegmentSpan,
} from "./segmentSentences.ts";
