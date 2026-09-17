/**
 * Machine-Readable Exports Emitter (/exports/v1/).
 *
 * Deterministically generates machine-readable JSON, Markdown, TEI XML,
 * JSON-LD, and parallel corpus exports according to AGENTS.md,
 * am-cm-machine-readable-exports-xgy, and docs/EXPORTS.md.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getLogger } from "../../testing/log/logger.ts";
import { canonicalJsonStringify } from "../compiler/emitter.ts";
import { getPaperExportLinks } from "./discovery.ts";
import { generateJsonLd } from "./jsonld.ts";
import { generateSectionMarkdown } from "./markdown.ts";
import { generateParallelCorpusTsv } from "./parallelCorpus.ts";
import { isAssetPublishable, resolveLayerRights } from "./rights.ts";
import { assertExportSafety, validateExportRecord } from "./schemas.ts";
import { generateTeiXml } from "./tei.ts";
import type {
  ArgumentExport,
  EquationExport,
  ExperimentExport,
  ExportFormat,
  ExportIndex,
  ExportIndexEntry,
  PaperExport,
  SectionBlockExport,
  SectionExport,
  SectionSentenceExport,
} from "./types.ts";

export interface ExportEmitterPaperInput {
  readonly id: string;
  readonly slug?: string;
  readonly title: string;
  readonly germanTitle?: string;
  readonly titleGerman?: string;
  readonly titleEnglishWorking?: string;
  readonly authorLine?: string;
  readonly bibKey?: string;
  readonly citation?: string;
  readonly status?: string;
  readonly sourceStatus?: string;
  readonly sourceNotice?: string;
  readonly dates?: readonly any[];
  readonly journal?: any;
  readonly sections?: readonly {
    readonly id: string;
    readonly title: string;
    readonly arguments?: readonly string[];
  }[];
}

export interface ExportEmitterInput {
  readonly rootDir: string;
  readonly exportSubdir?: string; // defaults to "exports/v1"
  readonly contentRevision: string;
  readonly releaseProfile?: "preview" | "production" | "launch" | string;
  readonly papers: readonly ExportEmitterPaperInput[];
  readonly arguments?: readonly any[];
  readonly equations?: readonly any[];
  readonly experiments?: readonly any[];
  readonly sourceBlocks?: readonly any[];
  readonly translationUnits?: readonly any[];
  readonly alignments?: readonly any[];
  readonly editorialNotes?: readonly any[];
  readonly sourceAssets?: readonly any[];
}

const sha256Hex = (buf: string | Uint8Array): string =>
  createHash("sha256").update(buf).digest("hex");

/**
 * Emits complete machine-readable exports to `/exports/v1/`.
 */
export async function emitMachineReadableExports(
  options: ExportEmitterInput,
): Promise<ExportIndex> {
  const profile = options.releaseProfile ?? "preview";
  const isPreview = profile === "preview";
  const exportDir = resolve(options.rootDir, options.exportSubdir ?? "exports/v1");
  const logger = getLogger("exports");

  await mkdir(exportDir, { recursive: true });

  const indexEntries: ExportIndexEntry[] = [];

  // Helper to write a file, validate it, log it, and add to index
  async function emitFile(
    relativePath: string,
    content: string,
    format: ExportFormat,
    mimeType: string,
    description: string,
    schemaKind?: "paper" | "section" | "equation" | "argument" | "experiment" | "index",
    parsedForValidation?: unknown,
  ): Promise<void> {
    if (parsedForValidation !== undefined && schemaKind) {
      validateExportRecord(schemaKind, parsedForValidation);
    }

    const fullPath = resolve(exportDir, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");

    const bytes = Buffer.byteLength(content, "utf8");
    const sha = sha256Hex(content);

    indexEntries.push({
      path: relativePath,
      bytes,
      sha256: sha,
      schemaVersion: 1,
      contentRevision: options.contentRevision,
      format,
      mimeType,
      description,
    });

    // Structured logging: AGENTS.md / am-cm-machine-readable-exports-xgy spec
    try {
      logger.log({
        testId: `emit-${relativePath}`,
        beadId: "am-cm-machine-readable-exports-xgy",
        message: `Emitted export file ${relativePath} (${bytes} bytes)`,
        outcome: "passed",
        extra: {
          file: relativePath,
          schemaVersion: 1,
          bytes,
          sha256: sha,
          profile,
        },
      });
    } catch {
      // logger may fail in non-test contexts, continue safely
    }
  }

  // 1. Process Source Assets: strictly omit pin-local-only and reference-only
  const publishableAssets = (options.sourceAssets ?? []).filter((sa) =>
    isAssetPublishable(sa.publicationDecision),
  );
  const assetDigest = publishableAssets.length > 0 ? publishableAssets[0].sha256 : undefined;

  // 2. Maps for quick lookups
  const blocksBySection = new Map<string, any[]>();
  for (const block of options.sourceBlocks ?? []) {
    const secId = block.section ?? "s1";
    if (!blocksBySection.has(secId)) blocksBySection.set(secId, []);
    blocksBySection.get(secId)!.push(block);
  }

  const translationsById = new Map<string, any>();
  for (const tu of options.translationUnits ?? []) {
    translationsById.set(tu.id, tu);
  }

  const notesBySection = new Map<string, any[]>();
  for (const note of options.editorialNotes ?? []) {
    const secId = note.section ?? "s1";
    if (!notesBySection.has(secId)) notesBySection.set(secId, []);
    notesBySection.get(secId)!.push(note);
  }

  const argsByPaper = new Map<string, any[]>();
  const argsById = new Map<string, any>();
  for (const arg of options.arguments ?? []) {
    const p = arg.paper ?? "paper";
    if (!argsByPaper.has(p)) argsByPaper.set(p, []);
    argsByPaper.get(p)!.push(arg);
    argsById.set(arg.id, arg);
  }

  const eqByPaper = new Map<string, any[]>();
  for (const eq of options.equations ?? []) {
    const p = eq.paper ?? "paper";
    if (!eqByPaper.has(p)) eqByPaper.set(p, []);
    eqByPaper.get(p)!.push(eq);
  }

  // 3. Process Papers
  for (const rawPaper of options.papers) {
    const slug = rawPaper.slug ?? rawPaper.id;
    const paperArgs = argsByPaper.get(rawPaper.id) ?? [];
    const paperEqs = eqByPaper.get(rawPaper.id) ?? [];

    const defaultJournal = {
      name: "Annalen der Physik",
      series: 4,
      volume: 17,
      wholeSeriesVolume: 322,
      issue: 8,
      pages: { first: 549, last: 560 },
      doi: "10.1002/andp.19053220806",
      doiVerifiedAt: "2026-09-14",
    };

    const paperJournal = rawPaper.journal
      ? {
          name: rawPaper.journal.name ?? defaultJournal.name,
          series: rawPaper.journal.series ?? defaultJournal.series,
          volume: rawPaper.journal.volume ?? defaultJournal.volume,
          wholeSeriesVolume: rawPaper.journal.wholeSeriesVolume ?? defaultJournal.wholeSeriesVolume,
          issue: rawPaper.journal.issue ?? defaultJournal.issue,
          pages: rawPaper.journal.pages ?? defaultJournal.pages,
          doi: rawPaper.journal.doi ?? defaultJournal.doi,
          doiVerifiedAt: rawPaper.journal.doiVerifiedAt ?? defaultJournal.doiVerifiedAt,
        }
      : defaultJournal;

    const paperDates =
      rawPaper.dates && rawPaper.dates.length > 0
        ? rawPaper.dates
        : [
            {
              type: "received",
              earliest: "1905-05-11",
              latest: "1905-05-11",
              precision: "day",
              source: "Annalen der Physik (4) 17, p. 549",
              verifiedAt: "2026-09-14",
            },
          ];

    const paperSections = (
      rawPaper.sections ?? [{ id: "s1", title: "Section 1", arguments: [] }]
    ).map((s) => ({
      id: s.id,
      title: s.title,
      arguments: s.arguments ?? [],
      exportJsonUrl: `/exports/v1/papers/${slug}/${s.id}.json`,
      exportMarkdownUrl: `/exports/v1/papers/${slug}/${s.id}.md`,
    }));

    const paperRights = resolveLayerRights({
      germanText: true,
      translation: true,
      explanatoryProse: true,
      code: true,
    });

    const paperExport: PaperExport = {
      schemaVersion: 1,
      slug,
      bibKey: rawPaper.bibKey ?? "ap-17-549",
      titleGerman: rawPaper.titleGerman ?? rawPaper.germanTitle ?? rawPaper.title,
      titleEnglishWorking: rawPaper.titleEnglishWorking ?? rawPaper.title,
      authorLine: rawPaper.authorLine ?? "A. Einstein",
      dates: paperDates,
      journal: paperJournal,
      sections: paperSections,
      rights: paperRights,
      contentRevision: options.contentRevision,
      ...(assetDigest ? { sourceAssetDigest: assetDigest } : {}),
      links: {
        self: `/exports/v1/papers/${slug}.json`,
        jsonld: `/exports/v1/jsonld/${slug}.json`,
        tei: `/exports/v1/tei/${slug}.xml`,
        parallelCorpus: `/exports/v1/corpus/${slug}.tsv`,
      },
    };

    // Emit paper JSON
    const paperJsonStr = canonicalJsonStringify(paperExport, 2);
    await emitFile(
      `papers/${slug}.json`,
      paperJsonStr,
      "json",
      "application/json",
      `Machine-readable paper export for ${slug}`,
      "paper",
      paperExport,
    );

    // 4. Process Sections for this Paper
    const sectionExports: SectionExport[] = [];

    for (const sec of paperSections) {
      const secBlocks = blocksBySection.get(sec.id) ?? [];
      const secNotes = notesBySection.get(sec.id) ?? [];

      // Sentences
      const sentences: SectionSentenceExport[] = [];
      const blocks: SectionBlockExport[] = [];

      for (const b of secBlocks) {
        let isBlockDraft = false;
        let blockReviewState: string | undefined;

        if (b.status) {
          blockReviewState = b.status.review ?? b.status.translation;
          isBlockDraft = blockReviewState === "draft" || blockReviewState === "in-progress";
        }

        // Profile filter: in launch/production, exclude draft blocks
        if (!isPreview && isBlockDraft) {
          continue;
        }

        const blockExport: SectionBlockExport = {
          id: b.id,
          kind: b.kind ?? "paragraph",
          order: b.order ?? 0,
          diplomaticText: b.diplomaticText ?? "",
          locators: (b.locators ?? []).map((loc: any) => ({
            pdfPageIndex: loc.pdfPageIndex ?? 1,
            printedPage: loc.printedPage ?? 1,
          })),
          ...(b.translation ? { translation: b.translation } : {}),
          ...(b.equationId ? { equationId: b.equationId } : {}),
        };
        blocks.push(blockExport);

        // Check sentence spans
        for (const span of b.sentenceSpans ?? []) {
          const sentId = span.id;
          let englishText: string | undefined;
          let tuDraft = false;
          let tuReviewState: string | undefined;

          // Find corresponding translation unit
          for (const tu of options.translationUnits ?? []) {
            if (tu.sourceRefs?.some((sr: any) => sr.id === sentId || sr.id === b.id)) {
              englishText =
                typeof tu.inlines === "string" ? tu.inlines : (tu.diplomaticText ?? tu.text);
              tuReviewState = tu.reviewState;
              tuDraft = tuReviewState === "draft" || tuReviewState === "machine-draft";
              break;
            }
          }

          if (!isPreview && tuDraft) {
            // Under strict release profile, skip draft translation
            englishText = undefined;
          }

          sentences.push({
            id: sentId,
            german: span.span?.exactText ?? b.diplomaticText ?? "",
            ...(englishText ? { english: englishText } : {}),
            sourceBlockId: b.id,
            ...(tuReviewState ? { reviewState: tuReviewState } : {}),
            ...(tuDraft ? { draft: true } : {}),
          });
        }
      }

      // If no sentence spans were explicit, fall back to block-level sentences if available
      if (sentences.length === 0 && blocks.length > 0) {
        for (const b of blocks) {
          sentences.push({
            id: `${b.id}-s1`,
            german: b.diplomaticText,
            ...(b.translation ? { english: b.translation } : {}),
            sourceBlockId: b.id,
          });
        }
      }

      // Readings from arguments associated with this section
      const secArgs = (sec.arguments ?? []).map((argId) => argsById.get(argId)).filter(Boolean);

      let readingsObj: any;
      if (secArgs.length > 0 && secArgs[0].readings) {
        readingsObj = secArgs[0].readings;
      }

      // Check section draft state
      let secDraft = false;
      let secReviewState: string | undefined;
      for (const sent of sentences) {
        if (sent.draft) {
          secDraft = true;
          secReviewState = sent.reviewState ?? "machine-draft";
        }
      }

      const sectionExport: SectionExport = {
        schemaVersion: 1,
        paperSlug: slug,
        sectionId: sec.id,
        title: sec.title,
        sentences,
        blocks,
        ...(readingsObj ? { readings: readingsObj } : {}),
        ...(secNotes.length > 0
          ? {
              editorialNotes: secNotes.map((n) => ({
                id: n.id,
                title: n.title ?? "Note",
                text: n.text ?? n.plainText ?? "",
              })),
            }
          : {}),
        ...(secDraft
          ? { draft: true, ...(secReviewState ? { reviewState: secReviewState } : {}) }
          : {}),
        rights: paperRights,
        contentRevision: options.contentRevision,
        ...(assetDigest ? { sourceAssetDigest: assetDigest } : {}),
      };

      sectionExports.push(sectionExport);

      // Emit Section JSON
      const secJsonStr = canonicalJsonStringify(sectionExport, 2);
      await emitFile(
        `papers/${slug}/${sec.id}.json`,
        secJsonStr,
        "json",
        "application/json",
        `Section export (JSON) for ${slug} / ${sec.id}`,
        "section",
        sectionExport,
      );

      // Emit Section Markdown
      const secMarkdown = generateSectionMarkdown(sectionExport);
      await emitFile(
        `papers/${slug}/${sec.id}.md`,
        secMarkdown,
        "markdown",
        "text/markdown",
        `Section export (Markdown) for ${slug} / ${sec.id}`,
      );
    }

    // 5. Emit TEI XML for this Paper
    const teiXml = generateTeiXml(paperExport, sectionExports);
    await emitFile(
      `tei/${slug}.xml`,
      teiXml,
      "xml",
      "application/tei+xml",
      `TEI P5 XML critical edition for ${slug}`,
    );

    // 6. Emit JSON-LD for this Paper
    const jsonLd = generateJsonLd(paperExport);
    const jsonLdStr = canonicalJsonStringify(jsonLd, 2);
    await emitFile(
      `jsonld/${slug}.json`,
      jsonLdStr,
      "json",
      "application/ld+json",
      `Schema.org ScholarlyArticle JSON-LD for ${slug}`,
    );

    // 7. Emit Parallel Corpus TSV for this Paper
    const parallelTsv = generateParallelCorpusTsv(paperExport, sectionExports);
    await emitFile(
      `corpus/${slug}.tsv`,
      parallelTsv,
      "tsv",
      "text/tab-separated-values",
      `Sentence-aligned bilingual parallel corpus (TSV) for ${slug}`,
    );
  }

  // 8. Process Equations
  for (const eq of options.equations ?? []) {
    const eqExport: EquationExport = {
      schemaVersion: 1,
      id: eq.id,
      paper: eq.paper ?? "brownian-motion",
      ...(eq.section ? { section: eq.section } : {}),
      ...(eq.argument ? { argument: eq.argument } : {}),
      title: eq.title ?? "Equation",
      ...(eq.latexSource ? { latexSource: eq.latexSource } : {}),
      latexModern: eq.latexModern ?? eq.latex ?? "E = mc^2",
      spoken: eq.spoken ?? "",
      explanation: eq.explanation ?? "",
      quantityIds: eq.quantityIds ?? [],
      ...(eq.operationIds ? { operationIds: eq.operationIds } : {}),
      ...(eq.derivations ? { derivations: eq.derivations } : {}),
      rights: resolveLayerRights({ germanText: true, explanatoryProse: true, code: true }),
      contentRevision: options.contentRevision,
    };

    const eqJsonStr = canonicalJsonStringify(eqExport, 2);
    await emitFile(
      `equations/${eq.id}.json`,
      eqJsonStr,
      "json",
      "application/json",
      `Machine-readable equation export for ${eq.id}`,
      "equation",
      eqExport,
    );
  }

  // 9. Process Arguments
  for (const arg of options.arguments ?? []) {
    const argExport: ArgumentExport = {
      schemaVersion: 1,
      id: arg.id,
      paper: arg.paper ?? "brownian-motion",
      section: arg.section ?? "s1",
      title: arg.title ?? "Argument",
      question: arg.question ?? "",
      recap: arg.recap ?? "",
      premises: arg.premises ?? [],
      limitations: arg.limitations ?? [],
      ...(arg.evidence ? { evidence: arg.evidence } : {}),
      ...(arg.conclusion ? { conclusion: arg.conclusion } : {}),
      meaning: {
        logicalRole: arg.meaning?.logicalRole ?? "derivation",
        historicalStatus: arg.meaning?.historicalStatus ?? "pedagogical-reconstruction",
        modelStatus: arg.meaning?.modelStatus ?? "exact-within-model",
        executionStatus: arg.meaning?.executionStatus ?? "static-illustration",
      },
      ...(arg.experiments ? { experiments: arg.experiments } : {}),
      ...(arg.citations ? { citations: arg.citations } : {}),
      rights: resolveLayerRights({ explanatoryProse: true, code: true }),
      contentRevision: options.contentRevision,
    };

    const argJsonStr = canonicalJsonStringify(argExport, 2);
    await emitFile(
      `arguments/${arg.id}.json`,
      argJsonStr,
      "json",
      "application/json",
      `Machine-readable argument export for ${arg.id}`,
      "argument",
      argExport,
    );
  }

  // 10. Process Experiments (Manifest metadata without executable code)
  for (const exp of options.experiments ?? []) {
    // Strictly strip any executable functions or solver code
    const expExport: ExperimentExport = {
      schemaVersion: 1,
      id: exp.id,
      paper: exp.paper ?? "brownian-motion",
      title: exp.title ?? "Experiment",
      kind: exp.kind ?? "simulation",
      ...(exp.description ? { description: exp.description } : {}),
      parameters: (exp.parameters ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        ...(p.unit ? { unit: p.unit } : {}),
        default: p.default ?? 0,
        ...(p.min !== undefined ? { min: p.min } : {}),
        ...(p.max !== undefined ? { max: p.max } : {}),
      })),
      ...(exp.measurements
        ? {
            measurements: exp.measurements.map((m: any) => ({
              id: m.id,
              name: m.name,
              ...(m.unit ? { unit: m.unit } : {}),
            })),
          }
        : {}),
      ...(exp.historicalBasis ? { historicalBasis: exp.historicalBasis } : {}),
      rights: resolveLayerRights({ explanatoryProse: true, code: true }),
      contentRevision: options.contentRevision,
    };

    const expJsonStr = canonicalJsonStringify(expExport, 2);
    await emitFile(
      `experiments/${exp.id}.json`,
      expJsonStr,
      "json",
      "application/json",
      `Machine-readable experiment manifest export for ${exp.id}`,
      "experiment",
      expExport,
    );
  }

  // 11. Sort Index Entries alphabetically by path for strict determinism
  indexEntries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // 12. Build and Emit index.json
  const exportIndex: ExportIndex = {
    schemaVersion: 1,
    contentRevision: options.contentRevision,
    releaseProfile: profile,
    files: indexEntries,
  };

  validateExportRecord("index", exportIndex);

  const indexJsonStr = canonicalJsonStringify(exportIndex, 2);
  const indexFullPath = resolve(exportDir, "index.json");
  await writeFile(indexFullPath, indexJsonStr, "utf8");

  // Log index emission
  try {
    const indexBytes = Buffer.byteLength(indexJsonStr, "utf8");
    const indexSha = sha256Hex(indexJsonStr);
    logger.log({
      testId: "emit-index.json",
      beadId: "am-cm-machine-readable-exports-xgy",
      message: `Emitted export index with ${indexEntries.length} files (${indexBytes} bytes)`,
      outcome: "passed",
      extra: {
        file: "index.json",
        schemaVersion: 1,
        bytes: indexBytes,
        sha256: indexSha,
        profile,
      },
    });
  } catch {
    // continue safely
  }

  return exportIndex;
}
