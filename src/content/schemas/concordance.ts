/**
 * Canonical schemas and validators for the Scoped Notation Concordance.
 * Specification: am-not-concordance-model-uag, AGENTS.md (§2.3, §4.5, §4.7, §6.1, §11.4)
 */

import {
  type RationalDimension,
  type RationalScale,
  validateRationalDimension,
  validateRationalScale,
} from "./dimensionBasis.ts";
import type { DimensionStatus, Frame } from "./meanings.ts";

export {
  type RationalDimension,
  type RationalScale,
  validateRationalDimension,
  validateRationalScale,
};

export const CONCORDANCE_SCHEMA_VERSION = 1;

export const GLYPH_VARIANTS = ["plain", "primed", "subscripted", "bold"] as const;
export type GlyphVariant = (typeof GLYPH_VARIANTS)[number];

export type Glyph = Readonly<{
  unicode: string;
  latex: string;
  variant?: GlyphVariant | undefined;
}>;

export const NON_QUANTITY_KINDS = [
  "coordinate-system-label",
  "index",
  "function-label",
  "operator",
  "unit-symbol",
] as const;
export type NonQuantityKind = (typeof NON_QUANTITY_KINDS)[number];

export const CONCORDANCE_UNIT_SYSTEMS = ["si", "cgs", "gaussian-cgs", "emu-cgs"] as const;
export type ConcordanceUnitSystem = (typeof CONCORDANCE_UNIT_SYSTEMS)[number];

export const RENAME_FORMS = ["symbol", "group", "expression", "scaled"] as const;
export type RenameForm = (typeof RENAME_FORMS)[number];

export const COLLISION_SEVERITIES = ["danger", "caution"] as const;
export type CollisionSeverity = (typeof COLLISION_SEVERITIES)[number];

export const COLLISION_KINDS = ["cross-paper", "within-paper", "cross-toggle"] as const;
export type CollisionKind = (typeof COLLISION_KINDS)[number];

export type GroupPattern = Readonly<{
  kind: "multiply" | "divide" | "power" | "term" | "number" | "constant" | string;
  terms?: readonly string[] | undefined;
  factor?: number | RationalScale | undefined;
  left?: unknown | undefined;
  right?: unknown | undefined;
  [key: string]: unknown;
}>;

export type RenameTarget =
  | Readonly<{
      form: "symbol";
      modernGlyph: Glyph | string;
    }>
  | Readonly<{
      form: "group";
      pattern: GroupPattern;
      modernGlyph: Glyph | string;
    }>
  | Readonly<{
      form: "expression";
      modernTree: unknown;
      modernGlyph?: Glyph | string | undefined;
    }>
  | Readonly<{
      form: "scaled";
      modernTree: unknown;
      modernGlyph?: Glyph | string | undefined;
    }>;

export type RenameOperation = Readonly<{
  kind: "rename";
  target: RenameTarget;
}>;

export type UnitConversionOperation = Readonly<{
  kind: "unitConversion";
  fromSystem: ConcordanceUnitSystem;
  toSystem: ConcordanceUnitSystem;
  factor: number | RationalScale;
  exact?: boolean | undefined;
  conversionDerivationRef?: string | undefined;
  modernTree?: unknown | undefined;
}>;

export type ModernizationOperation = Readonly<{
  kind: "modernization";
  modernLensRef: string;
  argumentChangeDescription: string;
}>;

export type ConcordanceOperation =
  | RenameOperation
  | UnitConversionOperation
  | ModernizationOperation;

export type FirstUseSectionAnchor = Readonly<{
  sectionId: string;
  anchor: string;
}>;

export type CollisionRecord = Readonly<{
  severity: CollisionSeverity;
  kind: CollisionKind;
  collidesWith: readonly string[];
  collidesWithModern?: readonly string[] | undefined;
  firstUseAnchor: string;
  firstUseBySection: readonly FirstUseSectionAnchor[];
}>;

export type QuantityBinding = Readonly<{
  quantityId: string;
  scale?: RationalScale | undefined;
  dimensionStatus?: DimensionStatus | undefined;
}>;

export type NonQuantityBinding = Readonly<{
  nonQuantityKind: NonQuantityKind;
}>;

export type ConcordanceBinding = QuantityBinding | NonQuantityBinding;

export type ConcordanceSource = Readonly<{
  facsimilePage?: number | undefined;
  anchor: string;
}>;

export type ConcordanceVerification = Readonly<{
  printed: boolean;
  checkedAgainst: string;
  by: string;
  date: string;
}>;

export type ConcordanceEntry = Readonly<{
  id: string; // <paperCode>.<glyph>.<meaning>
  paper: string; // Paper slug
  scope: readonly string[]; // Section IDs or block IDs
  glyph: Glyph;
  meaning: string;
  binding: ConcordanceBinding;
  modernSymbol?: string | Glyph | undefined;
  dimension?: RationalDimension | undefined;
  frameOrReference?: Frame | string | undefined;
  operation: ConcordanceOperation;
  collision?: CollisionRecord | undefined;
  notes?: string | undefined;
  sources: ConcordanceSource;
  verification: ConcordanceVerification;
}>;

export type ModernOnlySymbol = Readonly<{
  id: string;
  glyph: Glyph;
  binding: ConcordanceBinding;
  scope: readonly string[];
  introducedBy: string;
  label: string;
}>;

export type PaperConcordance = Readonly<{
  paper: string;
  entries: readonly ConcordanceEntry[];
  modernOnlySymbols?: readonly ModernOnlySymbol[] | undefined;
}>;

export class ConcordanceSchemaError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path = "concordance") {
    super(`[Concordance] ${path}: ${message} (${code})`);
    this.name = "ConcordanceSchemaError";
    this.code = code;
    this.path = path;
  }
}

export function validateGlyph(raw: unknown, path = "glyph"): Glyph {
  if (typeof raw === "string") {
    if (!raw.trim()) {
      throw new ConcordanceSchemaError("missing-glyph", "Glyph string cannot be empty.", path);
    }
    return { unicode: raw, latex: raw, variant: "plain" };
  }
  if (!raw || typeof raw !== "object") {
    throw new ConcordanceSchemaError(
      "invalid-glyph",
      "Glyph must be an object or non-empty string.",
      path,
    );
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.unicode !== "string" || !o.unicode.trim()) {
    throw new ConcordanceSchemaError(
      "missing-glyph-unicode",
      "glyph.unicode is required.",
      `${path}.unicode`,
    );
  }
  if (typeof o.latex !== "string" || !o.latex.trim()) {
    throw new ConcordanceSchemaError(
      "missing-glyph-latex",
      "glyph.latex is required.",
      `${path}.latex`,
    );
  }
  let variant: GlyphVariant | undefined;
  if (o.variant !== undefined) {
    if (typeof o.variant !== "string" || !GLYPH_VARIANTS.includes(o.variant as GlyphVariant)) {
      throw new ConcordanceSchemaError(
        "invalid-glyph-variant",
        `glyph.variant must be one of: ${GLYPH_VARIANTS.join(", ")} (got "${String(o.variant)}").`,
        `${path}.variant`,
      );
    }
    variant = o.variant as GlyphVariant;
  }
  return {
    unicode: o.unicode,
    latex: o.latex,
    variant: variant ?? "plain",
  };
}

export function validateBinding(raw: unknown, path = "binding"): ConcordanceBinding {
  if (typeof raw === "string") {
    if (NON_QUANTITY_KINDS.includes(raw as NonQuantityKind)) {
      return { nonQuantityKind: raw as NonQuantityKind };
    }
    return { quantityId: raw };
  }
  if (!raw || typeof raw !== "object") {
    throw new ConcordanceSchemaError(
      "invalid-binding",
      "binding must be a string or object.",
      path,
    );
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.nonQuantityKind === "string") {
    if (!NON_QUANTITY_KINDS.includes(o.nonQuantityKind as NonQuantityKind)) {
      throw new ConcordanceSchemaError(
        "invalid-non-quantity-kind",
        `nonQuantityKind must be one of: ${NON_QUANTITY_KINDS.join(", ")} (got "${o.nonQuantityKind}").`,
        `${path}.nonQuantityKind`,
      );
    }
    return { nonQuantityKind: o.nonQuantityKind as NonQuantityKind };
  }
  if (typeof o.quantityId !== "string" || !o.quantityId.trim()) {
    throw new ConcordanceSchemaError(
      "missing-quantity-id",
      "binding requires quantityId or nonQuantityKind.",
      `${path}.quantityId`,
    );
  }
  let scale: RationalScale | undefined;
  if (o.scale !== undefined) {
    scale = validateRationalScale(o.scale, `${path}.scale`, false);
  }
  return {
    quantityId: o.quantityId,
    ...(scale ? { scale } : {}),
    ...(typeof o.dimensionStatus === "string"
      ? { dimensionStatus: o.dimensionStatus as DimensionStatus }
      : {}),
  };
}

export function validateOperation(raw: unknown, path = "operation"): ConcordanceOperation {
  if (!raw || typeof raw !== "object") {
    throw new ConcordanceSchemaError("missing-operation", "Operation object is required.", path);
  }
  const o = raw as Record<string, unknown>;
  if (o.kind === "rename") {
    const t = (o.target ?? {}) as Record<string, unknown>;
    if (!t || typeof t !== "object") {
      throw new ConcordanceSchemaError(
        "missing-rename-target",
        "rename operation requires target object.",
        `${path}.target`,
      );
    }
    if (!RENAME_FORMS.includes(t.form as RenameForm)) {
      throw new ConcordanceSchemaError(
        "invalid-rename-form",
        `rename target form must be one of: ${RENAME_FORMS.join(", ")} (got "${String(t.form)}").`,
        `${path}.target.form`,
      );
    }
    const form = t.form as RenameForm;
    if (form === "symbol") {
      if (!t.modernGlyph) {
        throw new ConcordanceSchemaError(
          "missing-modern-glyph",
          "symbol rename requires modernGlyph.",
          `${path}.target.modernGlyph`,
        );
      }
      return {
        kind: "rename",
        target: {
          form: "symbol",
          modernGlyph:
            typeof t.modernGlyph === "string"
              ? t.modernGlyph
              : validateGlyph(t.modernGlyph, `${path}.target.modernGlyph`),
        },
      };
    }
    if (form === "group") {
      if (!t.pattern || typeof t.pattern !== "object") {
        throw new ConcordanceSchemaError(
          "missing-group-pattern",
          "group rename requires pattern object.",
          `${path}.target.pattern`,
        );
      }
      if (!t.modernGlyph) {
        throw new ConcordanceSchemaError(
          "missing-group-modern-glyph",
          "group rename requires modernGlyph.",
          `${path}.target.modernGlyph`,
        );
      }
      return {
        kind: "rename",
        target: {
          form: "group",
          pattern: t.pattern as GroupPattern,
          modernGlyph:
            typeof t.modernGlyph === "string"
              ? t.modernGlyph
              : validateGlyph(t.modernGlyph, `${path}.target.modernGlyph`),
        },
      };
    }
    if (form === "expression" || form === "scaled") {
      if (!t.modernTree) {
        throw new ConcordanceSchemaError(
          "missing-modern-tree",
          `${form} rename requires modernTree.`,
          `${path}.target.modernTree`,
        );
      }
      return {
        kind: "rename",
        target: {
          form,
          modernTree: t.modernTree,
          modernGlyph: t.modernGlyph
            ? typeof t.modernGlyph === "string"
              ? t.modernGlyph
              : validateGlyph(t.modernGlyph, `${path}.target.modernGlyph`)
            : undefined,
        },
      };
    }
  }

  if (o.kind === "unitConversion") {
    if (
      typeof o.fromSystem !== "string" ||
      !CONCORDANCE_UNIT_SYSTEMS.includes(o.fromSystem as ConcordanceUnitSystem)
    ) {
      throw new ConcordanceSchemaError(
        "invalid-unit-system",
        `fromSystem must be one of: ${CONCORDANCE_UNIT_SYSTEMS.join(", ")} (got "${String(o.fromSystem)}"). Loose names like 'gaussian' or 'emu' are rejected.`,
        `${path}.fromSystem`,
      );
    }
    if (
      typeof o.toSystem !== "string" ||
      !CONCORDANCE_UNIT_SYSTEMS.includes(o.toSystem as ConcordanceUnitSystem)
    ) {
      throw new ConcordanceSchemaError(
        "invalid-unit-system",
        `toSystem must be one of: ${CONCORDANCE_UNIT_SYSTEMS.join(", ")} (got "${String(o.toSystem)}"). Loose names like 'gaussian' or 'emu' are rejected.`,
        `${path}.toSystem`,
      );
    }
    let factor: number | RationalScale = 1;
    if (o.factor !== undefined) {
      if (typeof o.factor === "number") {
        factor = o.factor;
      } else {
        factor = validateRationalScale(o.factor, `${path}.factor`, false);
      }
    }
    return {
      kind: "unitConversion",
      fromSystem: o.fromSystem as ConcordanceUnitSystem,
      toSystem: o.toSystem as ConcordanceUnitSystem,
      factor,
      exact: typeof o.exact === "boolean" ? o.exact : undefined,
      conversionDerivationRef:
        typeof o.conversionDerivationRef === "string" ? o.conversionDerivationRef : undefined,
      modernTree: o.modernTree,
    };
  }

  if (o.kind === "modernization") {
    if (typeof o.modernLensRef !== "string" || !o.modernLensRef.trim()) {
      throw new ConcordanceSchemaError(
        "missing-modern-lens-ref",
        "modernization requires modernLensRef.",
        `${path}.modernLensRef`,
      );
    }
    if (typeof o.argumentChangeDescription !== "string" || !o.argumentChangeDescription.trim()) {
      throw new ConcordanceSchemaError(
        "missing-argument-change-description",
        "modernization requires argumentChangeDescription stating how the physical argument changes.",
        `${path}.argumentChangeDescription`,
      );
    }
    return {
      kind: "modernization",
      modernLensRef: o.modernLensRef,
      argumentChangeDescription: o.argumentChangeDescription,
    };
  }

  throw new ConcordanceSchemaError(
    "invalid-operation-kind",
    `Operation kind must be "rename", "unitConversion", or "modernization" (got "${String(o.kind)}").`,
    `${path}.kind`,
  );
}

export function validateCollision(raw: unknown, path = "collision"): CollisionRecord {
  if (!raw || typeof raw !== "object") {
    throw new ConcordanceSchemaError(
      "invalid-collision",
      "Collision record must be an object.",
      path,
    );
  }
  const o = raw as Record<string, unknown>;

  if (
    typeof o.severity !== "string" ||
    !COLLISION_SEVERITIES.includes(o.severity as CollisionSeverity)
  ) {
    throw new ConcordanceSchemaError(
      "invalid-collision-severity",
      `Collision severity must be "danger" or "caution" (got "${String(o.severity)}").`,
      `${path}.severity`,
    );
  }
  if (typeof o.kind !== "string" || !COLLISION_KINDS.includes(o.kind as CollisionKind)) {
    throw new ConcordanceSchemaError(
      "invalid-collision-kind",
      `Collision kind must be one of: ${COLLISION_KINDS.join(", ")} (got "${String(o.kind)}").`,
      `${path}.kind`,
    );
  }

  const collidesWith = Array.isArray(o.collidesWith) ? o.collidesWith.map((c) => String(c)) : [];
  const collidesWithModern = Array.isArray(o.collidesWithModern)
    ? o.collidesWithModern.map((c) => String(c))
    : undefined;

  if (collidesWith.length === 0 && (!collidesWithModern || collidesWithModern.length === 0)) {
    throw new ConcordanceSchemaError(
      "collision-targets-empty",
      "Collision record requires at least one target in collidesWith or collidesWithModern.",
      path,
    );
  }

  if (typeof o.firstUseAnchor !== "string" || !o.firstUseAnchor.trim()) {
    throw new ConcordanceSchemaError(
      "missing-first-use-anchor",
      "Collision record requires paper-level firstUseAnchor.",
      `${path}.firstUseAnchor`,
    );
  }

  if (!Array.isArray(o.firstUseBySection) || o.firstUseBySection.length === 0) {
    throw new ConcordanceSchemaError(
      "missing-first-use-by-section",
      "Collision record requires non-empty firstUseBySection array.",
      `${path}.firstUseBySection`,
    );
  }

  const firstUseBySection = o.firstUseBySection.map((item, idx) => {
    const iPath = `${path}.firstUseBySection[${idx}]`;
    if (!item || typeof item !== "object") {
      throw new ConcordanceSchemaError(
        "invalid-first-use-section-item",
        "Section first-use item must be an object.",
        iPath,
      );
    }
    const io = item as Record<string, unknown>;
    if (typeof io.sectionId !== "string" || !io.sectionId.trim()) {
      throw new ConcordanceSchemaError(
        "missing-section-id",
        "Section first-use requires sectionId.",
        `${iPath}.sectionId`,
      );
    }
    if (typeof io.anchor !== "string" || !io.anchor.trim()) {
      throw new ConcordanceSchemaError(
        "missing-anchor",
        "Section first-use requires anchor.",
        `${iPath}.anchor`,
      );
    }
    return { sectionId: io.sectionId, anchor: io.anchor };
  });

  return {
    severity: o.severity as CollisionSeverity,
    kind: o.kind as CollisionKind,
    collidesWith,
    collidesWithModern,
    firstUseAnchor: o.firstUseAnchor,
    firstUseBySection,
  };
}

export function validateConcordanceEntry(raw: unknown, path = "entry"): ConcordanceEntry {
  if (!raw || typeof raw !== "object") {
    throw new ConcordanceSchemaError("invalid-entry", "Concordance entry must be an object.", path);
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ConcordanceSchemaError("missing-id", "Concordance entry requires id.", `${path}.id`);
  }
  // Validate ID grammar <paperCode>.<glyph>.<meaning>
  const parts = o.id.split(".");
  if (parts.length < 3) {
    throw new ConcordanceSchemaError(
      "invalid-concordance-id-grammar",
      `Concordance ID "${o.id}" must follow <paperCode>.<glyph>.<meaning> grammar.`,
      `${path}.id`,
    );
  }

  if (typeof o.paper !== "string" || !o.paper.trim()) {
    throw new ConcordanceSchemaError(
      "missing-paper",
      "Concordance entry requires paper slug.",
      `${path}.paper`,
    );
  }

  if (!Array.isArray(o.scope) || o.scope.length === 0) {
    throw new ConcordanceSchemaError(
      "missing-scope",
      "Concordance entry requires non-empty scope array.",
      `${path}.scope`,
    );
  }
  const scope = o.scope.map((s, idx) => {
    if (typeof s !== "string" || !s.trim()) {
      throw new ConcordanceSchemaError(
        "invalid-scope-id",
        "Scope entry must be a non-empty string.",
        `${path}.scope[${idx}]`,
      );
    }
    return s;
  });

  const glyph = validateGlyph(o.glyph, `${path}.glyph`);

  if (typeof o.meaning !== "string" || !o.meaning.trim()) {
    throw new ConcordanceSchemaError(
      "missing-meaning",
      "Concordance entry requires meaning in plain words.",
      `${path}.meaning`,
    );
  }

  const binding = validateBinding(o.binding, `${path}.binding`);
  const operation = validateOperation(o.operation, `${path}.operation`);

  let collision: CollisionRecord | undefined;
  if (o.collision !== undefined && o.collision !== null) {
    collision = validateCollision(o.collision, `${path}.collision`);
  }

  // Sources
  const src = (o.sources ?? {}) as Record<string, unknown>;
  if (!src || typeof src !== "object" || typeof src.anchor !== "string" || !src.anchor.trim()) {
    throw new ConcordanceSchemaError(
      "missing-sources-anchor",
      "Concordance entry requires sources.anchor.",
      `${path}.sources.anchor`,
    );
  }
  const sources: ConcordanceSource = {
    anchor: src.anchor,
    facsimilePage: typeof src.facsimilePage === "number" ? src.facsimilePage : undefined,
  };

  // Verification
  const ver = (o.verification ?? {}) as Record<string, unknown>;
  if (!ver || typeof ver !== "object") {
    throw new ConcordanceSchemaError(
      "missing-verification",
      "Concordance entry requires verification object.",
      `${path}.verification`,
    );
  }
  if (typeof ver.checkedAgainst !== "string" || !ver.checkedAgainst.trim()) {
    throw new ConcordanceSchemaError(
      "missing-verification-checked-against",
      "verification.checkedAgainst is required.",
      `${path}.verification.checkedAgainst`,
    );
  }
  if (typeof ver.by !== "string" || !ver.by.trim()) {
    throw new ConcordanceSchemaError(
      "missing-verification-by",
      "verification.by is required.",
      `${path}.verification.by`,
    );
  }
  if (typeof ver.date !== "string" || !ver.date.trim()) {
    throw new ConcordanceSchemaError(
      "missing-verification-date",
      "verification.date is required.",
      `${path}.verification.date`,
    );
  }
  const verification: ConcordanceVerification = {
    printed: Boolean(ver.printed),
    checkedAgainst: ver.checkedAgainst,
    by: ver.by,
    date: ver.date,
  };

  let dimension: RationalDimension | undefined;
  if (o.dimension !== undefined) {
    dimension = validateRationalDimension(o.dimension, `${path}.dimension`);
  }

  let modernSymbol: string | Glyph | undefined;
  if (o.modernSymbol !== undefined) {
    modernSymbol =
      typeof o.modernSymbol === "string"
        ? o.modernSymbol
        : validateGlyph(o.modernSymbol, `${path}.modernSymbol`);
  }

  return {
    id: o.id,
    paper: o.paper,
    scope,
    glyph,
    meaning: o.meaning,
    binding,
    modernSymbol,
    dimension,
    frameOrReference: typeof o.frameOrReference === "string" ? o.frameOrReference : undefined,
    operation,
    collision,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    sources,
    verification,
  };
}

export function validateModernOnlySymbol(
  raw: unknown,
  path = "modernOnlySymbol",
): ModernOnlySymbol {
  if (!raw || typeof raw !== "object") {
    throw new ConcordanceSchemaError(
      "invalid-modern-only-symbol",
      "modernOnlySymbol must be an object.",
      path,
    );
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new ConcordanceSchemaError(
      "missing-modern-only-id",
      "modernOnlySymbol requires id.",
      `${path}.id`,
    );
  }
  const glyph = validateGlyph(o.glyph, `${path}.glyph`);
  const binding = validateBinding(o.binding ?? o.id, `${path}.binding`);
  const scope = Array.isArray(o.scope) ? o.scope.map((s) => String(s)) : [];
  const introducedBy = typeof o.introducedBy === "string" ? o.introducedBy : "modern-lens";
  const label = typeof o.label === "string" ? o.label : o.id;

  return {
    id: o.id,
    glyph,
    binding,
    scope,
    introducedBy,
    label,
  };
}

export function validatePaperConcordance(raw: unknown, path = "concordance"): PaperConcordance {
  if (!raw || typeof raw !== "object") {
    throw new ConcordanceSchemaError(
      "invalid-paper-concordance",
      "Paper concordance must be an object.",
      path,
    );
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.paper !== "string" || !o.paper.trim()) {
    throw new ConcordanceSchemaError(
      "missing-paper",
      "Paper concordance requires paper slug.",
      `${path}.paper`,
    );
  }
  const entries: ConcordanceEntry[] = [];
  if (Array.isArray(o.entries)) {
    for (let i = 0; i < o.entries.length; i++) {
      entries.push(validateConcordanceEntry(o.entries[i], `${path}.entries[${i}]`));
    }
  }
  const modernOnlySymbols: ModernOnlySymbol[] = [];
  if (Array.isArray(o.modernOnlySymbols)) {
    for (let i = 0; i < o.modernOnlySymbols.length; i++) {
      modernOnlySymbols.push(
        validateModernOnlySymbol(o.modernOnlySymbols[i], `${path}.modernOnlySymbols[${i}]`),
      );
    }
  }

  return {
    paper: o.paper,
    entries,
    modernOnlySymbols,
  };
}
