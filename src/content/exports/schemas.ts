/**
 * JSON Schemas and runtime schema validator for machine-readable exports.
 *
 * Spec: am-cm-machine-readable-exports-xgy (Criteria 1 & 9).
 */

export const PAPER_EXPORT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://annus-mirabilis.com/schemas/exports/v1/paper.json",
  title: "PaperExport",
  type: "object",
  required: [
    "schemaVersion",
    "slug",
    "bibKey",
    "titleGerman",
    "titleEnglishWorking",
    "authorLine",
    "dates",
    "journal",
    "sections",
    "rights",
    "contentRevision",
    "links",
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    slug: { type: "string", pattern: "^[a-z0-9-]+$" },
    bibKey: { type: "string", pattern: "^ap-\\d+-\\d+$" },
    titleGerman: { type: "string", minLength: 1 },
    titleEnglishWorking: { type: "string", minLength: 1 },
    authorLine: { type: "string", minLength: 1 },
    dates: {
      type: "array",
      items: {
        type: "object",
        required: ["type"],
        properties: {
          type: { type: "string" },
          text: { type: "string" },
          earliest: { type: "string" },
          latest: { type: "string" },
          precision: { type: "string" },
          source: { type: "string" },
          verifiedAt: { type: "string" },
        },
      },
    },
    journal: {
      type: "object",
      required: ["name", "series", "volume", "wholeSeriesVolume", "issue", "pages", "doi"],
      properties: {
        name: { type: "string" },
        series: { type: "integer" },
        volume: { type: "integer" },
        wholeSeriesVolume: { type: "integer" },
        issue: { type: ["string", "number"] },
        pages: {
          type: "object",
          required: ["first", "last"],
          properties: {
            first: { type: "integer" },
            last: { type: "integer" },
          },
        },
        doi: { type: "string" },
        doiVerifiedAt: { type: "string" },
      },
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "title", "exportJsonUrl", "exportMarkdownUrl"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          arguments: { type: "array", items: { type: "string" } },
          exportJsonUrl: { type: "string" },
          exportMarkdownUrl: { type: "string" },
        },
      },
    },
    rights: { type: "object" },
    contentRevision: { type: "string" },
    sourceAssetDigest: { type: "string" },
    links: {
      type: "object",
      required: ["self", "jsonld", "tei", "parallelCorpus"],
      properties: {
        self: { type: "string" },
        jsonld: { type: "string" },
        tei: { type: "string" },
        parallelCorpus: { type: "string" },
      },
    },
  },
} as const;

export const SECTION_EXPORT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://annus-mirabilis.com/schemas/exports/v1/section.json",
  title: "SectionExport",
  type: "object",
  required: [
    "schemaVersion",
    "paperSlug",
    "sectionId",
    "title",
    "sentences",
    "blocks",
    "rights",
    "contentRevision",
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    paperSlug: { type: "string" },
    sectionId: { type: "string" },
    title: { type: "string" },
    sentences: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "german", "sourceBlockId"],
        properties: {
          id: { type: "string" },
          german: { type: "string" },
          english: { type: "string" },
          sourceBlockId: { type: "string" },
          translationUnitId: { type: "string" },
          reviewState: { type: "string" },
          draft: { type: "boolean" },
        },
      },
    },
    blocks: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "kind", "order", "diplomaticText", "locators"],
        properties: {
          id: { type: "string" },
          kind: { type: "string" },
          order: { type: "integer" },
          diplomaticText: { type: "string" },
          locators: { type: "array" },
          translation: { type: "string" },
          equationId: { type: "string" },
        },
      },
    },
    readings: { type: "object" },
    footnotes: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "text"],
        properties: {
          id: { type: "string" },
          text: { type: "string" },
        },
      },
    },
    editorialNotes: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "title", "text"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          text: { type: "string" },
        },
      },
    },
    reviewState: { type: "string" },
    draft: { type: "boolean" },
    rights: { type: "object" },
    contentRevision: { type: "string" },
    translationRevision: { type: "number" },
    sourceAssetDigest: { type: "string" },
  },
} as const;

export const EQUATION_EXPORT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://annus-mirabilis.com/schemas/exports/v1/equation.json",
  title: "EquationExport",
  type: "object",
  required: [
    "schemaVersion",
    "id",
    "paper",
    "title",
    "latexModern",
    "spoken",
    "explanation",
    "quantityIds",
    "rights",
    "contentRevision",
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    id: { type: "string" },
    paper: { type: "string" },
    section: { type: "string" },
    argument: { type: "string" },
    title: { type: "string" },
    latexSource: { type: "string" },
    latexModern: { type: "string" },
    spoken: { type: "string" },
    explanation: { type: "string" },
    quantityIds: { type: "array", items: { type: "string" } },
    operationIds: { type: "array", items: { type: "string" } },
    derivations: { type: "array", items: { type: "string" } },
    rights: { type: "object" },
    contentRevision: { type: "string" },
  },
} as const;

export const ARGUMENT_EXPORT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://annus-mirabilis.com/schemas/exports/v1/argument.json",
  title: "ArgumentExport",
  type: "object",
  required: [
    "schemaVersion",
    "id",
    "paper",
    "section",
    "title",
    "question",
    "recap",
    "premises",
    "limitations",
    "meaning",
    "rights",
    "contentRevision",
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    id: { type: "string" },
    paper: { type: "string" },
    section: { type: "string" },
    title: { type: "string" },
    question: { type: "string" },
    recap: { type: "string" },
    premises: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
    evidence: { type: "array", items: { type: "string" } },
    conclusion: { type: "string" },
    meaning: {
      type: "object",
      required: ["logicalRole", "historicalStatus", "modelStatus", "executionStatus"],
      properties: {
        logicalRole: { type: "string" },
        historicalStatus: { type: "string" },
        modelStatus: { type: "string" },
        executionStatus: { type: "string" },
      },
    },
    experiments: { type: "array", items: { type: "string" } },
    citations: { type: "array", items: { type: "string" } },
    rights: { type: "object" },
    contentRevision: { type: "string" },
  },
} as const;

export const EXPERIMENT_EXPORT_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://annus-mirabilis.com/schemas/exports/v1/experiment.json",
  title: "ExperimentExport",
  type: "object",
  required: [
    "schemaVersion",
    "id",
    "paper",
    "title",
    "kind",
    "parameters",
    "rights",
    "contentRevision",
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    id: { type: "string" },
    paper: { type: "string" },
    title: { type: "string" },
    kind: { type: "string" },
    description: { type: "string" },
    parameters: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name", "default"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          unit: { type: "string" },
          default: { type: "number" },
          min: { type: "number" },
          max: { type: "number" },
        },
      },
    },
    measurements: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          unit: { type: "string" },
        },
      },
    },
    historicalBasis: { type: "string" },
    rights: { type: "object" },
    contentRevision: { type: "string" },
  },
} as const;

export const EXPORT_INDEX_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://annus-mirabilis.com/schemas/exports/v1/index.json",
  title: "ExportIndex",
  type: "object",
  required: ["schemaVersion", "contentRevision", "releaseProfile", "files"],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    contentRevision: { type: "string" },
    releaseProfile: { type: "string" },
    files: {
      type: "array",
      items: {
        type: "object",
        required: [
          "path",
          "bytes",
          "sha256",
          "schemaVersion",
          "contentRevision",
          "format",
          "mimeType",
          "description",
        ],
        properties: {
          path: { type: "string" },
          bytes: { type: "integer", minimum: 0 },
          sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
          schemaVersion: { const: 1 },
          contentRevision: { type: "string" },
          format: { enum: ["json", "markdown", "xml", "tsv"] },
          mimeType: { type: "string" },
          description: { type: "string" },
        },
      },
    },
  },
} as const;

export class ExportValidationError extends Error {
  readonly path: string;
  readonly schema: string;
  constructor(schema: string, path: string, message: string) {
    super(`[${schema}] at '${path}': ${message}`);
    this.name = "ExportValidationError";
    this.schema = schema;
    this.path = path;
  }
}

/**
 * Validates that an export record does not contain executable code, functions,
 * or private reader state (notes, predictions, tours, history).
 */
export function assertExportSafety(data: unknown, path = "root"): void {
  if (data === null || typeof data !== "object") {
    if (typeof data === "function") {
      throw new ExportValidationError("SafetyCheck", path, "Functions are forbidden in exports.");
    }
    return;
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      assertExportSafety(data[i], `${path}[${i}]`);
    }
    return;
  }

  const obj = data as Record<string, unknown>;
  const forbiddenKeys = new Set([
    "notes",
    "predictions",
    "tours",
    "bookmarks",
    "history",
    "userState",
    "execute",
    "eval",
    "fn",
    "function",
    "script",
  ]);

  for (const [key, value] of Object.entries(obj)) {
    // Only check forbidden reader-state keys at root or top-level objects,
    // (unless it's an editorial note or footnote object, which has "notes" / "text")
    if (forbiddenKeys.has(key)) {
      // Allow 'notes' only if it is an array of equation/section notes
      if (key === "notes" && (path.includes("Equation") || path.includes("Section"))) {
        // ok
      } else {
        throw new ExportValidationError(
          "SafetyCheck",
          `${path}.${key}`,
          `Forbidden private or executable key '${key}'.`,
        );
      }
    }
    if (typeof value === "function") {
      throw new ExportValidationError(
        "SafetyCheck",
        `${path}.${key}`,
        "Functions are forbidden in exports.",
      );
    }
    assertExportSafety(value, `${path}.${key}`);
  }
}

/**
 * Validates data against a known schema structure.
 */
export function validateExportRecord(
  kind: "paper" | "section" | "equation" | "argument" | "experiment" | "index",
  data: unknown,
): void {
  assertExportSafety(data, kind);

  if (!data || typeof data !== "object") {
    throw new ExportValidationError(kind, "root", "Export data must be an object.");
  }

  const rec = data as Record<string, any>;
  if (rec.schemaVersion !== 1) {
    throw new ExportValidationError(kind, "schemaVersion", "Expected schemaVersion === 1.");
  }

  switch (kind) {
    case "paper": {
      for (const req of PAPER_EXPORT_SCHEMA.required) {
        if (rec[req] === undefined) {
          throw new ExportValidationError(kind, req, `Missing required field '${req}'.`);
        }
      }
      if (!Array.isArray(rec.sections)) {
        throw new ExportValidationError(kind, "sections", "'sections' must be an array.");
      }
      break;
    }
    case "section": {
      for (const req of SECTION_EXPORT_SCHEMA.required) {
        if (rec[req] === undefined) {
          throw new ExportValidationError(kind, req, `Missing required field '${req}'.`);
        }
      }
      if (!Array.isArray(rec.sentences)) {
        throw new ExportValidationError(kind, "sentences", "'sentences' must be an array.");
      }
      if (!Array.isArray(rec.blocks)) {
        throw new ExportValidationError(kind, "blocks", "'blocks' must be an array.");
      }
      break;
    }
    case "equation": {
      for (const req of EQUATION_EXPORT_SCHEMA.required) {
        if (rec[req] === undefined) {
          throw new ExportValidationError(kind, req, `Missing required field '${req}'.`);
        }
      }
      if (typeof rec.latexModern !== "string" || !rec.latexModern) {
        throw new ExportValidationError(
          kind,
          "latexModern",
          "latexModern must be non-empty string.",
        );
      }
      break;
    }
    case "argument": {
      for (const req of ARGUMENT_EXPORT_SCHEMA.required) {
        if (rec[req] === undefined) {
          throw new ExportValidationError(kind, req, `Missing required field '${req}'.`);
        }
      }
      if (!rec.meaning || typeof rec.meaning !== "object") {
        throw new ExportValidationError(kind, "meaning", "meaning must be an object.");
      }
      break;
    }
    case "experiment": {
      for (const req of EXPERIMENT_EXPORT_SCHEMA.required) {
        if (rec[req] === undefined) {
          throw new ExportValidationError(kind, req, `Missing required field '${req}'.`);
        }
      }
      if (!Array.isArray(rec.parameters)) {
        throw new ExportValidationError(kind, "parameters", "parameters must be an array.");
      }
      break;
    }
    case "index": {
      for (const req of EXPORT_INDEX_SCHEMA.required) {
        if (rec[req] === undefined) {
          throw new ExportValidationError(kind, req, `Missing required field '${req}'.`);
        }
      }
      if (!Array.isArray(rec.files)) {
        throw new ExportValidationError(kind, "files", "files must be an array.");
      }
      for (let i = 0; i < rec.files.length; i++) {
        const f = rec.files[i];
        if (!f.path || typeof f.bytes !== "number" || !f.sha256 || f.schemaVersion !== 1) {
          throw new ExportValidationError(kind, `files[${i}]`, "Invalid file index entry.");
        }
        if (!/^[a-f0-9]{64}$/.test(f.sha256)) {
          throw new ExportValidationError(
            kind,
            `files[${i}].sha256`,
            "Invalid SHA-256 digest format.",
          );
        }
      }
      break;
    }
  }
}
