/** Production export projection. Consumes validated records, never fixture defaults. */
import { createHash } from "node:crypto";
import { walk } from "../../equations/ast.ts";
import { recordLatex } from "../../equations/recordLatex.ts";
import type { BilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { paperDateFromReceipt } from "../../reader/faces/bilingualLoader.ts";
import type { PaperPayload } from "../compiler/compile.ts";
import { canonicalJsonStringify } from "../compiler/emitter.ts";
import type { ReceiptFrontMatter } from "../provenance/receiptSchema.ts";
import type { Experiment } from "../schemas/experiment.ts";
import { READING_IDS } from "../schemas/reading.ts";
import type { EditorialNote } from "../schemas/source.ts";
import { generateSectionMarkdown } from "./markdown.ts";
import { generateParallelCorpusTsv } from "./parallelCorpus.ts";
import { isAssetPublishable, resolveLayerRights } from "./rights.ts";
import {
  ARGUMENT_EXPORT_SCHEMA,
  EQUATION_EXPORT_SCHEMA,
  EXPERIMENT_EXPORT_SCHEMA,
  EXPORT_INDEX_SCHEMA,
  PAPER_EXPORT_SCHEMA,
  SECTION_EXPORT_SCHEMA,
  assertExportSafety,
  validateExportRecord,
} from "./schemas.ts";
import {
  commentary,
  historicalArticle,
  scholarlyGraph,
  validateScholarly,
  type TaggedEntity,
} from "./scholarly.ts";
import {
  exportDigest, LiveExportError, projectEditionSources, type SourceProjection,
} from "./sourceProjection.ts";
import { generateTeiXml } from "./tei.ts";
import type {
  ArgumentExport,
  EquationExport,
  ExperimentExport,
  ExportFormat,
  ExportIndex,
  ExportIndexEntry,
  PaperExport,
  SectionExport,
} from "./types.ts";

export type ExportProfile = "scaffold" | "preview" | "launch";

export interface LivePaperInput {
  readonly payload: PaperPayload;
  readonly receipt: ReceiptFrontMatter;
  readonly edition: BilingualEdition;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
}

export interface LiveExportInput {
  readonly contentRevision: string;
  readonly profile: ExportProfile;
  readonly papers: readonly LivePaperInput[];
  readonly experiments: readonly Experiment[];
}

export interface LiveExportFile {
  /** Public URL, including the /exports/v1/ or /schemas/exports/v1/ prefix. */
  readonly path: string;
  readonly text: string;
}

export interface LiveExportBundle {
  readonly index: ExportIndex;
  readonly files: readonly LiveExportFile[];
}

export const EXPORT_SCHEMAS = {
  paper: PAPER_EXPORT_SCHEMA,
  section: SECTION_EXPORT_SCHEMA,
  argument: ARGUMENT_EXPORT_SCHEMA,
  equation: EQUATION_EXPORT_SCHEMA,
  experiment: EXPERIMENT_EXPORT_SCHEMA,
  index: EXPORT_INDEX_SCHEMA,
} as const;

const proseRights = resolveLayerRights({ explanatoryProse: true });

function safeId(id: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id)) {
    throw new LiveExportError("export-path-identity", `Unsafe export identifier ${id}.`);
  }
  return id;
}

/** Build all bytes before publication so a failure never leaves a partly rewritten public set. */
export function createLiveExportBundle(input: LiveExportInput): LiveExportBundle {
  if (!["scaffold", "preview", "launch"].includes(input.profile)) {
    throw new LiveExportError("export-profile-unknown", `Unknown export profile ${input.profile}.`);
  }
  const files = new Map<string, LiveExportFile>();
  const entries: ExportIndexEntry[] = [];
  const add = (
    path: string,
    text: string,
    format: ExportFormat,
    mimeType: string,
    description: string,
  ) => {
    if (files.has(path)) {
      throw new LiveExportError("export-path-duplicate", `Two records publish ${path}.`);
    }
    files.set(path, { path, text });
    entries.push({
      path,
      bytes: Buffer.byteLength(text),
      sha256: createHash("sha256").update(text).digest("hex"),
      schemaVersion: 1,
      contentRevision: input.contentRevision,
      format,
      mimeType,
      description,
    });
  };
  const json = (
    kind: keyof typeof EXPORT_SCHEMAS,
    path: string,
    value: unknown,
    description: string,
  ) => {
    validateExportRecord(kind, value);
    add(path, canonicalJsonStringify(value), "json", "application/json", description);
  };
  for (const [kind, schema] of Object.entries(EXPORT_SCHEMAS)) {
    add(
      `/schemas/exports/v1/${kind}.json`,
      canonicalJsonStringify(schema),
      "json",
      "application/schema+json",
      `${kind} export JSON Schema`,
    );
  }

  // Current reading records are explanatory drafts. Search and offline chapters admit these
  // only in scaffold. Strict profiles expose schemas and an empty content inventory until a
  // reviewed-content adapter exists; no stale draft may survive a profile change.
  if (input.profile === "scaffold") {
    const papers = [...input.papers].sort((a, b) =>
      a.payload.paper.id.localeCompare(b.payload.paper.id, "en"),
    );
    for (const { payload, receipt, edition, editorialNotes = [] } of papers) {
      const slug = safeId(payload.paper.id);
      if (receipt.slug !== slug || receipt.key !== payload.paper.citation) {
        throw new LiveExportError("export-receipt-identity", `Receipt does not identify ${slug}.`);
      }
      const source = projectEditionSources(
        slug,
        payload.paper.sections.map((section) => section.id),
        edition,
      );
      const sourceAssetDigest = isAssetPublishable(receipt.scan.publicationDecision)
        ? receipt.scan.sha256
        : undefined;
      const sections: SectionExport[] = payload.paper.sections.map((section) => {
        // projectEditionSources builds exactly the section ids supplied above.
        const projection = source.get(section.id) as SourceProjection;
        const argumentsInOrder = section.arguments.map((id) => {
          const argument = payload.arguments.find((item) => item.id === id);
          if (!argument) {
            throw new LiveExportError(
              "export-argument-missing",
              `Section ${slug}/${section.id} names absent argument ${id}.`,
            );
          }
          return argument;
        });
        const affectedIds = new Set([
          section.id,
          ...section.arguments,
          ...projection.blocks.map((block) => block.id),
          ...projection.sentences.map((sentence) => sentence.id),
          ...(projection.translationUnits ?? []).map((unit) => unit.id),
        ]);
        return {
          schemaVersion: 1,
          paperSlug: slug,
          sectionId: safeId(section.id),
          title: section.title,
          ...projection,
          arguments: argumentsInOrder,
          readings: Object.fromEntries(
            READING_IDS.map((level) => [
              level,
              argumentsInOrder.flatMap((argument) => argument.readings[level]),
            ]),
          ),
          footnotes: projection.blocks
            .filter((block) => block.kind === "footnote")
            .map((block) => ({ id: block.id, text: block.diplomaticText })),
          editorialNotes: editorialNotes
            .filter((note) => note.affectedIds.some((id) => affectedIds.has(id)))
            .map((note) => ({ id: note.id, title: note.kind, text: note.claim, record: note })),
          reviewState: "explanation-preview",
          draft: true,
          rights: resolveLayerRights({
            germanText: projection.blocks.length > 0,
            translation: (projection.translationUnits?.length ?? 0) > 0,
            explanatoryProse: true,
          }),
          contentRevision: input.contentRevision,
          ...(sourceAssetDigest ? { sourceAssetDigest } : {}),
        };
      });
      const identity = receipt.paper;
      const paper: PaperExport = {
        schemaVersion: 1,
        slug,
        bibKey: receipt.key,
        titleGerman: identity.titleGerman,
        titleEnglishWorking: identity.titleEnglishWorking,
        authorLine: identity.authorLine,
        dates: identity.dates.map(paperDateFromReceipt),
        journal: identity.journal,
        sections: payload.paper.sections.map((section) => ({
          ...section,
          exportJsonUrl: `/exports/v1/papers/${slug}/${section.id}.json`,
          exportMarkdownUrl: `/exports/v1/papers/${slug}/${section.id}.md`,
        })),
        rights: resolveLayerRights({
          germanText: true,
          translation: edition.units.length > 0,
          explanatoryProse: true,
        }),
        contentRevision: input.contentRevision,
        sourceRevision: exportDigest(sections.map((section) => section.sourceRevision)),
        translationDigest: exportDigest(sections.map((section) => section.translationDigest)),
        ...(sourceAssetDigest ? { sourceAssetDigest } : {}),
        status: payload.paper.status,
        sourceStatus: payload.paper.sourceStatus,
        sourceNotice: payload.paper.sourceNotice,
        editorialNotes,
        links: {
          self: `/exports/v1/papers/${slug}.json`,
          jsonld: `/exports/v1/jsonld/${slug}.json`,
          tei: `/exports/v1/tei/${slug}.xml`,
          parallelCorpus: `/exports/v1/corpus/${slug}.tsv`,
        },
      };
      json("paper", paper.links.self, paper, `Bibliographic record and outline: ${slug}`);
      for (const section of sections) {
        const base = `/exports/v1/papers/${slug}/${section.sectionId}`;
        json(
          "section",
          `${base}.json`,
          section,
          `Bilingual source and four readings: ${slug}/${section.sectionId}`,
        );
        add(
          `${base}.md`,
          generateSectionMarkdown(section),
          "markdown",
          "text/markdown; charset=utf-8",
          `Section Markdown: ${slug}/${section.sectionId}`,
        );
      }
      const graph: TaggedEntity[] = [
        { role: "historical-article", entity: historicalArticle(receipt) },
        {
          role: "commentary",
          entity: commentary(receipt, payload.paper.title, input.contentRevision),
        },
      ];
      validateScholarly(graph);
      add(
        paper.links.jsonld,
        canonicalJsonStringify(scholarlyGraph(graph)),
        "json",
        "application/ld+json",
        `Historical article and separate modern commentary: ${slug}`,
      );
      add(
        paper.links.tei,
        generateTeiXml(paper, sections),
        "xml",
        "application/tei+xml",
        `Bilingual source in TEI: ${slug}`,
      );
      add(
        paper.links.parallelCorpus,
        generateParallelCorpusTsv(paper, sections),
        "tsv",
        "text/tab-separated-values; charset=utf-8",
        `Aligned German and English: ${slug}`,
      );

      for (const argument of payload.arguments) {
        const record: ArgumentExport = {
          schemaVersion: 1,
          id: argument.id,
          paper: slug,
          section: argument.section,
          title: argument.title,
          question: argument.question,
          recap: argument.recap,
          premises: argument.premises,
          limitations: argument.limitations,
          meaning: argument.meaning,
          experiments: argument.experiments,
          citations: argument.citations,
          prerequisites: argument.prerequisites,
          readings: argument.readings,
          reviewState: argument.review,
          rights: proseRights,
          contentRevision: input.contentRevision,
        };
        json(
          "argument",
          `/exports/v1/arguments/${safeId(record.id)}.json`,
          record,
          `Argument with typed prerequisite edges: ${record.id}`,
        );
      }
      for (const equation of payload.equations) {
        const latexModern = recordLatex(equation);
        if (!latexModern) {
          throw new LiveExportError(
            "export-equation-notation",
            `No notation table for ${equation.id}.`,
          );
        }
        const nodes = walk(equation.tree);
        const argument = payload.arguments.find((item) => item.id === equation.argument);
        const record: EquationExport = {
          schemaVersion: 1,
          id: equation.id,
          paper: slug,
          ...(argument ? { section: argument.section } : {}),
          argument: equation.argument,
          title: equation.title,
          latexModern,
          spoken: equation.spoken,
          explanation: equation.explanation,
          quantityIds: [
            ...new Set(nodes.flatMap((node) => node.kind === "symbol" ? [node.quantityId] : [])),
          ].sort(),
          operationIds: nodes.flatMap((node) =>
            "opId" in node && typeof node.opId === "string" ? [node.opId] : [],
          ),
          reviewState: equation.review,
          notation: equation.notation,
          assumptions: equation.assumptions,
          tree: equation.tree,
          rights: proseRights,
          contentRevision: input.contentRevision,
        };
        json(
          "equation",
          `/exports/v1/equations/${safeId(record.id)}.json`,
          record,
          `Modern teaching equation, exact semantic tree: ${record.id}`,
        );
      }
    }
    const experiments = [...input.experiments].sort((a, b) => a.id.localeCompare(b.id, "en"));
    for (const manifest of experiments) {
      const papers = [...new Set(manifest.sourceRefs.map((ref) => ref.paper))];
      const record: ExperimentExport = {
        schemaVersion: 1,
        id: manifest.id,
        paper: papers.join(","),
        title: manifest.title,
        kind: "declarative-experiment-manifest",
        description: manifest.explanatoryQuestion,
        // v1's numeric summary stays compatible. The complete typed manifest retains every
        // string/boolean default, parameter range, refusal status, assumption and historical mode.
        parameters: manifest.parameters.flatMap((parameter) =>
          typeof parameter.default === "number" ? [{
            id: parameter.id,
            name: parameter.label,
            unit: parameter.displayUnit,
            default: parameter.default,
            ...(parameter.modelDomain.min === undefined ? {} : { min: parameter.modelDomain.min }),
            ...(parameter.modelDomain.max === undefined ? {} : { max: parameter.modelDomain.max }),
          }] : [],
        ),
        manifest,
        rights: resolveLayerRights({ explanatoryProse: true, code: true }),
        contentRevision: input.contentRevision,
      };
      json(
        "experiment",
        `/exports/v1/experiments/${safeId(record.id)}.json`,
        record,
        `Complete declarative experiment manifest: ${record.id}`,
      );
    }
  }
  entries.sort((a, b) => a.path.localeCompare(b.path, "en"));
  const index: ExportIndex = {
    schemaVersion: 1,
    contentRevision: input.contentRevision,
    releaseProfile: input.profile,
    files: entries,
  };
  validateExportRecord("index", index);
  assertExportSafety(index);
  files.set("/exports/v1/index.json", {
    path: "/exports/v1/index.json",
    text: canonicalJsonStringify(index),
  });
  return {
    index,
    files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path, "en")),
  };
}
