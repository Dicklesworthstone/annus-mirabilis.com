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

  // Validate figures field: must be 'none' if present
  if ("figures" in o && o.figures !== undefined) {
    if (o.figures !== "none") {
      throw new ManifestSchemaError(
        "invalid-figures-declaration",
        `Figures declaration must be 'none'. The 1905 papers and companion contain no source figures. Got: '${o.figures}'.`,
        `${filePath}.figures`,
      );
    }
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

  let documents: string[] | undefined;
  if (Array.isArray(o.documents)) {
    documents = o.documents.map((d, idx) => {
      if (typeof d !== "string" || !d.trim()) {
        throw new ManifestSchemaError(
          "invalid-document-bib-key",
          `Invalid document bibKey at index ${idx}`,
          `${filePath}.documents[${idx}]`,
        );
      }
      return d;
    });
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

    // Reject draft locator format with start/end
    if ("locator" in u && u.locator && typeof u.locator === "object") {
      const locObj = u.locator as Record<string, unknown>;
      if ("start" in locObj || "end" in locObj) {
        throw new ManifestSchemaError(
          "draft-locator-format",
          "Unit uses draft locator format with 'start' and 'end'; replace with 'locators' list of {page, column?, line?, region?}.",
          `${unitPath}.locator`,
        );
      }
    }

    // Reject draft heading ids ending in -h
    if (
      (u.kind === "heading" || u.kind === "section-heading" || String(u.id).startsWith("s")) &&
      typeof u.id === "string" &&
      u.id.endsWith("-h")
    ) {
      const cleanId = u.id.replace(/-h$/, "");
      throw new ManifestSchemaError(
        "draft-heading-id-format",
        `Heading unit uses draft id '${u.id}' ending in '-h'; heading units carry the section id directly (e.g. '${cleanId}').`,
        `${unitPath}.id`,
      );
    }

    // Reject draft footnote or closing sentence ids (e.g. s1-fn1-s1, closing-ack-s1)
    if (
      typeof u.id === "string" &&
      (u.id.match(/^s\d+-fn\d+-s\d+$/) || u.id.match(/^closing-ack-s\d+$/))
    ) {
      const cleanId = u.id.replace(/-s\d+$/, "");
      throw new ManifestSchemaError(
        "draft-sentence-id-format",
        `Unit '${u.id}' uses draft sentence id format; footnotes and closing sections are block-level units without sentence ids (e.g. '${cleanId}').`,
        `${unitPath}.id`,
      );
    }

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
          if (
            reg.x < 0 ||
            reg.x > 100 ||
            reg.y < 0 ||
            reg.y > 100 ||
            reg.width < 0 ||
            reg.width > 100 ||
            reg.height < 0 ||
            reg.height > 100
          ) {
            throw new ManifestSchemaError(
              "region-out-of-bounds",
              `Region coordinates and dimensions must be percentages between 0 and 100.`,
              `${locPath}.region`,
            );
          }
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
            let target: ManifestUnitReference["target"];
            if (r.target && typeof r.target === "object") {
              const t = r.target as Record<string, unknown>;
              target = {
                citationId: typeof t.citationId === "string" ? t.citationId : undefined,
                id: typeof t.id === "string" ? t.id : undefined,
                paper: typeof t.paper === "string" ? t.paper : undefined,
              };
            }
            references.push({
              id: r.id,
              printedText: typeof r.printedText === "string" ? r.printedText : undefined,
              kind:
                r.kind === "bibliographic" || r.kind === "internal" || r.kind === "cross-paper"
                  ? r.kind
                  : undefined,
              target,
              targetCitationId:
                typeof r.targetCitationId === "string" ? r.targetCitationId : target?.citationId,
              text:
                typeof r.text === "string"
                  ? r.text
                  : typeof r.printedText === "string"
                    ? r.printedText
                    : undefined,
            });
          }
        }
      }
    }

    units.push({
      id: u.id,
      kind: u.kind,
      document: typeof u.document === "string" ? u.document : undefined,
      section: typeof u.section === "string" ? u.section : undefined,
      locators,
      containedIn: typeof u.containedIn === "string" ? u.containedIn : undefined,
      originalLabel: typeof u.originalLabel === "string" ? u.originalLabel : undefined,
      editorialLabel: typeof u.editorialLabel === "string" ? u.editorialLabel : undefined,
      references: references.length > 0 ? references : undefined,
      destination:
        typeof u.destination === "object" && u.destination !== null
          ? (u.destination as ManifestUnit["destination"])
          : typeof u.destination === "string"
            ? u.destination
            : undefined,
      status: typeof u.status === "string" ? u.status : undefined,
      scope: u.scope === "not-in-scope" ? "not-in-scope" : "in-scope",
      notInScopeReason: typeof u.notInScopeReason === "string" ? u.notInScopeReason : undefined,
      footnoteMark: typeof u.footnoteMark === "string" ? u.footnoteMark : undefined,
      unmarked: Boolean(u.unmarked),
      unmarkedReason: typeof u.unmarkedReason === "string" ? u.unmarkedReason : undefined,
      isSplitFootnote: Boolean(u.isSplitFootnote),
      printedForm: typeof u.printedForm === "string" ? u.printedForm : undefined,
    });
  }

  // Validate exports if present
  const exports: SourceManifestExport[] = [];
  const rawExports = o.exportedResults ?? o.exports;
  if (Array.isArray(rawExports)) {
    for (let i = 0; i < rawExports.length; i++) {
      const rawExp = rawExports[i];
      const expPath = `${filePath}.exports[${i}]`;
      if (!rawExp || typeof rawExp !== "object") {
        throw new ManifestSchemaError("invalid-export", "Export must be an object.", expPath);
      }
      const exp = rawExp as Record<string, unknown>;
      const exportId =
        typeof exp.id === "string" ? exp.id : typeof exp.resultId === "string" ? exp.resultId : "";
      if (!exportId.trim()) {
        throw new ManifestSchemaError(
          "missing-export-id",
          "Export requires id or resultId.",
          `${expPath}.id`,
        );
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
        id: exportId,
        resultId: exportId,
        blockIds: Array.isArray(exp.blockIds) ? (exp.blockIds as string[]) : undefined,
        equationIds: Array.isArray(exp.equationIds) ? (exp.equationIds as string[]) : undefined,
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
      const importPaper =
        typeof imp.paper === "string"
          ? imp.paper
          : typeof imp.fromPaper === "string"
            ? imp.fromPaper
            : "";
      if (!importPaper.trim()) {
        throw new ManifestSchemaError(
          "missing-import-paper",
          "Import requires paper or fromPaper.",
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
        paper: importPaper,
        fromPaper: importPaper,
        resultId: imp.resultId,
        use: imp.use as "premise" | "comparison",
      });
    }
  }

  return {
    paper: o.paper,
    document: o.document,
    documents,
    figures: o.figures === "none" ? "none" : undefined,
    status: o.status as "complete" | "in-preparation" | "scoped",
    scope: o.scope === "selected-sections" ? "selected-sections" : "full-document",
    pageCount: o.pageCount,
    pageRange: [startPage, endPage],
    pageMap: Array.isArray(o.pageMap) ? o.pageMap : undefined,
    idsFrozenAt: typeof o.idsFrozenAt === "string" ? o.idsFrozenAt : undefined,
    frozenBy: typeof o.frozenBy === "string" ? o.frozenBy : undefined,
    units,
    exports: exports.length > 0 ? exports : undefined,
    exportedResults: exports.length > 0 ? exports : undefined,
    importedResults: importedResults.length > 0 ? importedResults : undefined,
  };
}
