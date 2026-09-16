/**
 * Source Manifest Schema Validation.
 *
 * Spec: AGENTS.md and am-cm-source-manifest-6qa
 */

import { parseBibKey } from "../ids.ts";
import type {
  ManifestLocator,
  ManifestUnit,
  ManifestUnitReference,
  SourceManifest,
  SourceManifestExport,
  SourceManifestImport,
} from "./types.ts";

export class ManifestSchemaError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path = "SourceManifest") {
    super(`[SourceManifest] ${path}: ${message} (${code})`);
    this.name = "ManifestSchemaError";
    this.code = code;
    this.path = path;
  }
}

/**
 * Validates a raw JavaScript object or parsed YAML as a SourceManifest.
 * Rejects legacy / draft header forms with actionable diagnostics naming the modern form.
 */
export function validateSourceManifest(raw: unknown, filePath = "manifest"): SourceManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ManifestSchemaError(
      "invalid-manifest-object",
      "SourceManifest must be a non-null object.",
      filePath,
    );
  }

  const o = raw as Record<string, unknown>;

  // Check for rejected draft header structures
  if ("frozen" in o && o.frozen && typeof o.frozen === "object") {
    throw new ManifestSchemaError(
      "draft-header-frozen",
      "Header uses draft 'frozen' object; replace with top-level 'idsFrozenAt' and 'frozenBy'.",
      `${filePath}.frozen`,
    );
  }

  // Validate paper slug and document bibKey
  if (typeof o.paper !== "string" || !o.paper.trim()) {
    throw new ManifestSchemaError("missing-paper", "paper slug is required.", `${filePath}.paper`);
  }

  if (typeof o.document !== "string" || !o.document.trim()) {
    throw new ManifestSchemaError(
      "missing-document",
      "document bibKey is required.",
      `${filePath}.document`,
    );
  }

  const bibKeyRes = parseBibKey(o.document);
  if (!bibKeyRes.ok) {
    throw new ManifestSchemaError("invalid-bib-key", bibKeyRes.error, `${filePath}.document`);
  }

  // Validate status
  const validStatuses = ["complete", "in-preparation", "scoped"];
  if (typeof o.status !== "string" || !validStatuses.includes(o.status)) {
    throw new ManifestSchemaError(
      "invalid-status",
      `status must be one of: ${validStatuses.join(", ")}. Got: '${o.status}'.`,
      `${filePath}.status`,
    );
  }

  // Validate pageCount and pageRange
  if (typeof o.pageCount !== "number" || !Number.isInteger(o.pageCount) || o.pageCount <= 0) {
    throw new ManifestSchemaError(
      "invalid-page-count",
      "pageCount must be a positive integer.",
      `${filePath}.pageCount`,
    );
  }

  if (
    !Array.isArray(o.pageRange) ||
    o.pageRange.length !== 2 ||
    typeof o.pageRange[0] !== "number" ||
    typeof o.pageRange[1] !== "number" ||
    o.pageRange[0] > o.pageRange[1]
  ) {
    throw new ManifestSchemaError(
      "invalid-page-range",
      "pageRange must be a 2-element tuple [firstPage, lastPage] with firstPage <= lastPage.",
      `${filePath}.pageRange`,
    );
  }

  const startPage = o.pageRange[0];
  const endPage = o.pageRange[1];
  const expectedCount = endPage - startPage + 1;
  if (o.pageCount !== expectedCount) {
    throw new ManifestSchemaError(
      "page-count-mismatch",
      `pageCount ${o.pageCount} does not match pageRange [${startPage}, ${endPage}] (expected ${expectedCount}).`,
      `${filePath}.pageCount`,
    );
  }

  // Validate units array
  if (!Array.isArray(o.units)) {
    throw new ManifestSchemaError("missing-units", "units must be an array.", `${filePath}.units`);
  }

  const units: ManifestUnit[] = [];
  const seenUnitIds = new Set<string>();

  for (let i = 0; i < o.units.length; i++) {
    const rawUnit = o.units[i];
    const unitPath = `${filePath}.units[${i}]`;

    if (!rawUnit || typeof rawUnit !== "object") {
      throw new ManifestSchemaError("invalid-unit", "Unit must be an object.", unitPath);
    }

    const u = rawUnit as Record<string, unknown>;

    // Reject direct assertions of reviewed status inside manifest
    if (u.status === "reviewed" && ("translation" in u || "review" in u)) {
      throw new ManifestSchemaError(
        "status-asserted",
        "Manifest asserts 'reviewed' status directly; status must be derived from translation and review records.",
        `${unitPath}.status`,
      );
    }

    if (typeof u.id !== "string" || !u.id.trim()) {
      throw new ManifestSchemaError(
        "missing-unit-id",
        "Unit requires a non-empty string id.",
        `${unitPath}.id`,
      );
    }

    if (seenUnitIds.has(u.id)) {
      throw new ManifestSchemaError(
        "duplicate-unit-id",
        `Duplicate unit id '${u.id}' in manifest.`,
        `${unitPath}.id`,
      );
    }
    seenUnitIds.add(u.id);

    if (typeof u.kind !== "string" || !u.kind.trim()) {
      throw new ManifestSchemaError(
        "missing-unit-kind",
        `Unit '${u.id}' requires a kind.`,
        `${unitPath}.kind`,
      );
    }

    // Validate locators
    if (!Array.isArray(u.locators) || u.locators.length === 0) {
      throw new ManifestSchemaError(
        "missing-unit-locators",
        `Unit '${u.id}' must have at least one locator in 'locators'.`,
        `${unitPath}.locators`,
      );
    }

    const locators: ManifestLocator[] = [];
    for (let j = 0; j < u.locators.length; j++) {
      const rawLoc = u.locators[j];
      const locPath = `${unitPath}.locators[${j}]`;

      if (!rawLoc || typeof rawLoc !== "object") {
        throw new ManifestSchemaError(
          "invalid-locator",
          `Locator must be an object with a numeric page.`,
          locPath,
        );
      }

      const l = rawLoc as Record<string, unknown>;
      if (typeof l.page !== "number" || !Number.isInteger(l.page) || l.page <= 0) {
        throw new ManifestSchemaError(
          "invalid-locator-page",
          `Locator page must be a positive integer.`,
          `${locPath}.page`,
        );
      }

      let region: ManifestLocator["region"];
      if (l.region && typeof l.region === "object") {
        const reg = l.region as Record<string, unknown>;
        if (
          typeof reg.x === "number" &&
          typeof reg.y === "number" &&
          typeof reg.width === "number" &&
          typeof reg.height === "number"
        ) {
          region = {
            x: reg.x,
            y: reg.y,
            width: reg.width,
            height: reg.height,
          };
        }
      }

      locators.push({
        page: l.page,
        column: typeof l.column === "number" ? l.column : undefined,
        line: typeof l.line === "number" ? l.line : undefined,
        region,
        splitPage: Boolean(l.splitPage),
      });
    }

    // Validate references if present
    const references: ManifestUnitReference[] = [];
    if (Array.isArray(u.references)) {
      for (let k = 0; k < u.references.length; k++) {
        const rawRef = u.references[k];
        if (rawRef && typeof rawRef === "object") {
          const r = rawRef as Record<string, unknown>;
          if (typeof r.id === "string") {
            references.push({
              id: r.id,
              targetCitationId:
                typeof r.targetCitationId === "string" ? r.targetCitationId : undefined,
              text: typeof r.text === "string" ? r.text : undefined,
            });
          }
        }
      }
    }

    units.push({
      id: u.id,
      kind: u.kind,
      section: typeof u.section === "string" ? u.section : undefined,
      locators,
      containedIn: typeof u.containedIn === "string" ? u.containedIn : undefined,
      originalLabel: typeof u.originalLabel === "string" ? u.originalLabel : undefined,
      editorialLabel: typeof u.editorialLabel === "string" ? u.editorialLabel : undefined,
      references: references.length > 0 ? references : undefined,
      destination: typeof u.destination === "string" ? u.destination : undefined,
      status: typeof u.status === "string" ? u.status : undefined,
      scope: u.scope === "not-in-scope" ? "not-in-scope" : "in-scope",
      footnoteMark: typeof u.footnoteMark === "string" ? u.footnoteMark : undefined,
      isSplitFootnote: Boolean(u.isSplitFootnote),
      printedForm: typeof u.printedForm === "string" ? u.printedForm : undefined,
    });
  }

  // Validate exports if present
  const exports: SourceManifestExport[] = [];
  if (Array.isArray(o.exports)) {
    for (let i = 0; i < o.exports.length; i++) {
      const rawExp = o.exports[i];
      const expPath = `${filePath}.exports[${i}]`;
      if (!rawExp || typeof rawExp !== "object") {
        throw new ManifestSchemaError("invalid-export", "Export must be an object.", expPath);
      }
      const exp = rawExp as Record<string, unknown>;
      if (typeof exp.id !== "string" || !exp.id.trim()) {
        throw new ManifestSchemaError("missing-export-id", "Export requires id.", `${expPath}.id`);
      }
      if (typeof exp.statement !== "string" || !exp.statement.trim()) {
        throw new ManifestSchemaError(
          "missing-export-statement",
          "Export requires statement.",
          `${expPath}.statement`,
        );
      }
      if (typeof exp.printedForm !== "string" || !exp.printedForm.trim()) {
        throw new ManifestSchemaError(
          "missing-export-printedform",
          "Export requires printedForm.",
          `${expPath}.printedForm`,
        );
      }
      exports.push({
        id: exp.id,
        statement: exp.statement,
        printedForm: exp.printedForm,
        section: typeof exp.section === "string" ? exp.section : undefined,
      });
    }
  }

  // Validate importedResults if present
  const importedResults: SourceManifestImport[] = [];
  if (Array.isArray(o.importedResults)) {
    for (let i = 0; i < o.importedResults.length; i++) {
      const rawImp = o.importedResults[i];
      const impPath = `${filePath}.importedResults[${i}]`;
      if (!rawImp || typeof rawImp !== "object") {
        throw new ManifestSchemaError("invalid-import", "Import must be an object.", impPath);
      }
      const imp = rawImp as Record<string, unknown>;
      if (typeof imp.paper !== "string" || !imp.paper.trim()) {
        throw new ManifestSchemaError(
          "missing-import-paper",
          "Import requires paper.",
          `${impPath}.paper`,
        );
      }
      if (typeof imp.resultId !== "string" || !imp.resultId.trim()) {
        throw new ManifestSchemaError(
          "missing-import-resultid",
          "Import requires resultId.",
          `${impPath}.resultId`,
        );
      }
      if (imp.use !== "premise" && imp.use !== "comparison") {
        throw new ManifestSchemaError(
          "import-use-missing",
          `Import requires 'use' with value 'premise' or 'comparison'. Got: '${imp.use}'.`,
          `${impPath}.use`,
        );
      }
      importedResults.push({
        paper: imp.paper,
        resultId: imp.resultId,
        use: imp.use as "premise" | "comparison",
      });
    }
  }

  return {
    paper: o.paper,
    document: o.document,
    status: o.status as "complete" | "in-preparation" | "scoped",
    scope: o.scope === "selected-sections" ? "selected-sections" : "full-document",
    pageCount: o.pageCount,
    pageRange: [startPage, endPage],
    pageMap: Array.isArray(o.pageMap) ? o.pageMap : undefined,
    idsFrozenAt: typeof o.idsFrozenAt === "string" ? o.idsFrozenAt : undefined,
    frozenBy: typeof o.frozenBy === "string" ? o.frozenBy : undefined,
    units,
    exports: exports.length > 0 ? exports : undefined,
    importedResults: importedResults.length > 0 ? importedResults : undefined,
  };
}
