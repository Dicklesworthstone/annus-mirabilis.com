import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseReceipt } from "../provenance/parseReceipt.ts";
import { receiptToSourceAsset } from "../provenance/receiptToSourceAsset.ts";
import { AuthorshipGovernanceError, authorshipOf } from "./authorship.ts";
import {
  SchemaValidationError,
  validateAlignment,
  validateCitation,
  validateEditorialNote,
  validateGlossUnit,
  validatePaper,
  validateSourceAsset,
  validateSourceBlock,
  validateTranslationUnit,
  verifyEquationTranslation,
} from "./source.ts";
import { SpanValidationError, spanTextDigest, validateSpanAnchor } from "./spans.ts";
import { strictParse } from "./strictParse.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, "../../testing/fixtures/source-schemas");
const PROVENANCE_FIXTURES_DIR = path.resolve(__dirname, "../../testing/fixtures/provenance");

test("Integration: receiptToSourceAsset for ap-99-001.md conforms to validateSourceAsset schema", () => {
  const receiptPath = path.join(PROVENANCE_FIXTURES_DIR, "ap-99-001.md");
  const markdown = fs.readFileSync(receiptPath, "utf8");
  const parsed = parseReceipt(markdown, receiptPath);
  assert.ok(parsed.ok && parsed.receipt, "Failed to parse receipt");

  const asset = receiptToSourceAsset(parsed.receipt);
  const validated = validateSourceAsset(asset);

  assert.equal(validated.originUrl, "https://example.org/details/annalen-der-physik-99-001");
  assert.equal(
    validated.sha256,
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  );
  assert.equal(validated.mimeType, "application/pdf");
  assert.equal(validated.pageCount, 4);
  assert.equal(validated.rights.status, "scan-open-terms");
  assert.equal(validated.rights.reuseTerms, "source-terms");
  assert.equal(validated.publicationDecision, "publish");
  assert.equal(validated.cloudProcessing, "permitted");
});

test("Integration: Valid YAML fixtures parsed via strictParse pass all 8 schema validators", () => {
  // 1. Paper
  const paperYaml = fs.readFileSync(path.join(FIXTURES_DIR, "paper-valid.yaml"), "utf8");
  const rawPaper = strictParse(paperYaml, "yaml");
  const paper = validatePaper(rawPaper);
  assert.equal(paper.slug, "brownian-motion");
  assert.equal(paper.bibKey, "ap-17-549");
  assert.equal(paper.journal.pages.first, 549);
  assert.equal(paper.journal.pages.last, 560);
  assert.equal(paper.dates.length, 2);

  // 2. SourceBlock
  const blockYaml = fs.readFileSync(path.join(FIXTURES_DIR, "source-block-valid.yaml"), "utf8");
  const rawBlock = strictParse(blockYaml, "yaml");
  const block = validateSourceBlock(rawBlock);
  assert.equal(block.id, "ap-17-549-p01");
  assert.equal(block.kind, "paragraph");
  assert.equal(block.status.transcription, "reviewed");
  assert.equal(block.sentenceSpans.length, 1);

  // 3. TranslationUnit
  const trYaml = fs.readFileSync(path.join(FIXTURES_DIR, "translation-unit-valid.yaml"), "utf8");
  const rawTr = strictParse(trYaml, "yaml");
  const tr = validateTranslationUnit(rawTr);
  assert.equal(tr.id, "tr-bm-01-01");
  assert.equal(tr.reviewState, "reviewed");
  assert.equal(tr.editor?.id, "jemanuel");

  // 4. Alignment
  const alignYaml = fs.readFileSync(path.join(FIXTURES_DIR, "alignment-valid.yaml"), "utf8");
  const rawAlign = strictParse(alignYaml, "yaml");
  const align = validateAlignment(rawAlign);
  assert.equal(align.id, "align-bm-01");
  assert.equal(align.edges.length, 1);
  assert.equal(align.edges[0]?.source.blockId, block.id);
  assert.equal(align.edges[0]?.target.translationUnitId, tr.id);

  // 5. GlossUnit
  const glossYaml = fs.readFileSync(path.join(FIXTURES_DIR, "gloss-unit-valid.yaml"), "utf8");
  const rawGloss = strictParse(glossYaml, "yaml");
  const gloss = validateGlossUnit(rawGloss);
  assert.equal(gloss.sentenceId, "ap-17-549-p01-s01");
  assert.equal(gloss.tokens.length, 6);
  assert.equal(gloss.multiwordUnits.length, 1);

  // 6. EditorialNote
  const noteYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "editorial-note-dispute-valid.yaml"),
    "utf8",
  );
  const rawNote = strictParse(noteYaml, "yaml");
  const note = validateEditorialNote(rawNote);
  assert.equal(note.id, "ed-bm-01-dispute");
  assert.equal(note.kind, "dispute");
  assert.equal(note.sourceSupport[0]?.role, "primary");

  // 7. Citation
  const citYaml = fs.readFileSync(path.join(FIXTURES_DIR, "citation-valid.yaml"), "utf8");
  const rawCit = strictParse(citYaml, "yaml");
  const cit = validateCitation(rawCit);
  assert.equal(cit.id, "cit-einstein-1905-bm");
  assert.equal(cit.role, "primary");

  // Verify full entity linkage
  assert.equal(note.sourceSupport[0]?.citationId, cit.id);
  assert.equal(note.affectedIds[0], block.id);
  assert.equal(paper.orderedBlockIds[1], block.id);
});

test("Integration: Planted Negative - Stale span revision triggers rejection", () => {
  const blockYaml = fs.readFileSync(path.join(FIXTURES_DIR, "source-block-valid.yaml"), "utf8");
  const rawBlock = strictParse(blockYaml, "yaml") as any;

  // Bump block revision to 2 without updating sentence span sourceRevision (still 1)
  rawBlock.revision = 2;

  assert.throws(
    () => validateSourceBlock(rawBlock),
    (err: any) => {
      assert.ok(err instanceof SpanValidationError);
      assert.equal(err.code, "span-revision-stale");
      return true;
    },
  );
});

test("Integration: Planted Negative - Span digest mismatch triggers rejection", () => {
  const blockYaml = fs.readFileSync(path.join(FIXTURES_DIR, "source-block-valid.yaml"), "utf8");
  const rawBlock = strictParse(blockYaml, "yaml") as any;

  // Modify the text content of the inline node
  rawBlock.inlines = [{ kind: "text", text: "In dieser veränderten Arbeit soll gezeigt werden." }];
  rawBlock.diplomaticText = "In dieser veränderten Arbeit soll gezeigt werden.";

  assert.throws(
    () => validateSourceBlock(rawBlock),
    (err: any) => {
      assert.ok(err instanceof SpanValidationError);
      assert.equal(err.code, "span-digest-mismatch");
      return true;
    },
  );
});

test("Integration: Planted Negative - YAML merge keys (<<:) are rejected by strictParse", () => {
  const yamlMerge = `
base: &base
  author:
    userId: jemanuel
    role: author
custom:
  <<: *base
  claim: "Inherited claim"
`;
  assert.throws(
    () => strictParse(yamlMerge, "yaml"),
    (err: any) => {
      assert.equal(err.code, "yaml-merge-key-forbidden");
      return true;
    },
  );
});

test("Integration: Planted Negative - Equation LaTeX translation rejection", () => {
  const originalLatex = "\\lambda = \\frac{R T}{6 \\pi k P}";
  const translatedLatex = "\\lambda = \\frac{R T}{6 \\pi \\eta r}"; // Translated notation (P -> r, k -> \eta)

  assert.throws(
    () => verifyEquationTranslation(originalLatex, translatedLatex, "bm-eq-01"),
    (err: any) => {
      assert.ok(err instanceof SchemaValidationError);
      assert.equal(err.code, "equation-notation-translated");
      return true;
    },
  );
});

test("Integration: Planted Negative - Agent as reviewer rejected in TranslationUnit and GlossUnit", () => {
  const trYaml = fs.readFileSync(path.join(FIXTURES_DIR, "translation-unit-valid.yaml"), "utf8");
  const rawTr = strictParse(trYaml, "yaml") as any;

  // Set editor to an AI agent
  rawTr.editor = {
    agent: "agent:claude-3-5-sonnet",
    modelId: "claude-3-5-sonnet-20241022",
    role: "editor",
    reviewedAt: "2026-09-15",
  };

  assert.throws(
    () => validateTranslationUnit(rawTr),
    (err: any) => {
      assert.ok(err instanceof AuthorshipGovernanceError);
      assert.equal(err.code, "agent-as-reviewer");
      return true;
    },
  );
});

test("Integration: Planted Negative - Dispute note without primary source support is rejected", () => {
  const noteYaml = fs.readFileSync(
    path.join(FIXTURES_DIR, "editorial-note-dispute-valid.yaml"),
    "utf8",
  );
  const rawNote = strictParse(noteYaml, "yaml") as any;

  // Change source support role to secondary
  rawNote.sourceSupport[0].role = "secondary";

  assert.throws(
    () => validateEditorialNote(rawNote),
    (err: any) => {
      assert.ok(err instanceof SchemaValidationError);
      assert.equal(err.code, "dispute-requires-primary-source");
      return true;
    },
  );
});
