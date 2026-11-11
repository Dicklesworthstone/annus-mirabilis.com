/** The essays are contemporary readings with explicit source and analogy boundaries. */
export const ESSAY_LABEL = "A contemporary methodological reading, not Einstein's method.";

export const ESSAY_REQUIRED_LIMITS = [
  "This is a contemporary reading of the arguments. It does not reconstruct a checklist that Einstein followed.",
  "These examples do not claim that scientific discovery has one algorithm.",
] as const;

export const ESSAY_SERIES = [
  { slug: "what-a-measurement-means", title: "What does a measurement really mean?" },
  { slug: "change-what-you-hold-fixed", title: "Change what you hold fixed" },
  { slug: "make-two-routes-meet", title: "Make two routes meet" },
  { slug: "the-useful-part-of-an-analogy", title: "The useful part of an analogy" },
  { slug: "subtract-what-you-do-not-know", title: "Subtract what you do not know" },
  { slug: "ask-what-must-stay-unchanged", title: "Ask what must stay unchanged" },
  { slug: "take-a-limit-without-losing-the-claim", title: "Take a limit without losing the claim" },
  { slug: "where-a-model-stops-working", title: "Where a model stops working" },
] as const;

export type EssayAnchorKind = "source" | "argument" | "result" | "instrument" | "foundation" | "essay";
export type EssayAnchor = Readonly<{ anchorId: string; kind: EssayAnchorKind; role: string }>;
export type EssayValueSource = Readonly<{ scenarioId: string; outputId: string }>;
export type EssayQuotedValue = EssayValueSource & Readonly<{
  id: string;
  source: "input" | "output";
  displayedAs: string;
  significantFigures: number;
  notation: "standard" | "scientific" | "auto";
  scale: number;
  unit: string;
  ratioTo?: EssayValueSource;
}>;
export type EssayTransfer = Readonly<{
  id: string;
  domain: string;
  example: string;
  sharedMove: string;
  whereItStops: string;
}>;
export type Essay = Readonly<{
  schemaVersion: 1;
  kind: "essay";
  slug: string;
  number: number;
  title: string;
  label: typeof ESSAY_LABEL;
  r0Summary: string;
  body: string;
  anchors: readonly EssayAnchor[];
  equations: readonly Readonly<{ paper: string; equationId: string }>[];
  quotedValues: readonly EssayQuotedValue[];
  transferExamples: readonly EssayTransfer[];
  limits: readonly string[];
  citations: readonly string[];
  reviewRecordIds: readonly string[];
  related: readonly string[];
}>;

export class EssayError extends Error {
  readonly code: string;
  readonly path: string;
  constructor(code: string, path: string, message: string) {
    super(path + ": " + message);
    this.name = "EssayError";
    this.code = code;
    this.path = path;
  }
}

export function essayFailure(path: string, message: string): never {
  throw new EssayError("essay-invalid", path, message);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return essayFailure(path, "Expected a record.");
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()) || value.length > 12000 ||
      value !== value.normalize("NFC") || /<[!/?a-z]/i.test(value))
    return essayFailure(path, "Expected bounded NFC plain text.");
  return value;
}
function id(value: unknown, path: string): string {
  const result = text(value, path);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(result) || result.length > 160)
    return essayFailure(path, "Expected a stable content ID.");
  return result;
}
function list(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length > 64)
    return essayFailure(path, "Expected a bounded list.");
  return value;
}
function strings(value: unknown, path: string): string[] {
  return list(value, path).map((item, index) => text(item, path + "[" + index + "]"));
}
function unique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) essayFailure(path, "IDs must be unique.");
}
function source(value: unknown, path: string): EssayValueSource {
  const row = object(value, path);
  const outputId = text(row.outputId, path + ".outputId");
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(outputId))
    return essayFailure(path, "Invalid scenario input/output ID.");
  return { scenarioId: id(row.scenarioId, path + ".scenarioId"), outputId };
}

/** Validation is shared by the build, route loader and tests,
  rather than inferred from a filename. */
export function validateEssay(value: unknown, path = "essay"): Essay {
  const row = object(value, path);
  const slug = id(row.slug, path + ".slug");
  const seriesIndex = ESSAY_SERIES.findIndex((entry) => entry.slug === slug);
  const title = text(row.title, path + ".title");
  if (row.schemaVersion !== 1 || row.kind !== "essay" || seriesIndex < 0 ||
      row.number !== seriesIndex + 1 || title !== ESSAY_SERIES[seriesIndex]?.title)
    return essayFailure(path,
      "The version, slug, number and title must identify an essay in the series.");
  if (row.label !== ESSAY_LABEL)
    return essayFailure(path + ".label",
      "The contemporary methodological reading label is required.");
  const summary = text(row.r0Summary, path + ".r0Summary");
  const sentences = summary.trim().split(/(?<=[.!?])\s+(?=[A-Z])/);
  if (sentences.length < 2 || sentences.length > 3 || !/[.!?]$/.test(summary))
    return essayFailure(path + ".r0Summary", "The overview must contain two or three sentences.");
  if (row.body !== slug + ".md")
    return essayFailure(path + ".body", "The body must be the Markdown file beside this record.");
  const kinds: readonly string[] = ["source", "argument", "result", "instrument", "foundation",
    "essay"];
  const anchors = list(row.anchors, path + ".anchors").map((value, index): EssayAnchor => {
    const at = path + ".anchors[" + index + "]";
    const anchor = object(value, at);
    const anchorId = text(anchor.anchorId, at + ".anchorId");
    if (!/^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)?$/.test(anchorId) ||
        !kinds.includes(String(anchor.kind)))
      return essayFailure(at, "Invalid anchor kind or stable target.");
    return { anchorId, kind: anchor.kind as EssayAnchorKind, role: text(anchor.role,
      at + ".role") };
  });
  unique(anchors.map((anchor) => anchor.anchorId), path + ".anchors");
  if (!anchors.some((anchor) => anchor.kind === "source") ||
      !anchors.some((anchor) => anchor.kind === "instrument"))
    return essayFailure(path + ".anchors", "Each essay needs source and instrument anchors.");
  const equations = list(row.equations, path + ".equations").map((value, index) => {
    const at = path + ".equations[" + index + "]";
    const equation = object(value, at);
    return { paper: id(equation.paper, at + ".paper"), equationId: id(equation.equationId,
      at + ".equationId") };
  });
  unique(equations.map((equation) => equation.equationId), path + ".equations");
  const quotedValues = list(row.quotedValues, path + ".quotedValues").map((value,
    index): EssayQuotedValue => {
    const at = path + ".quotedValues[" + index + "]";
    const quote = object(value, at);
    const figures = Number(quote.significantFigures);
    if (!Number.isInteger(figures) || figures < 1 || figures > 12 ||
        typeof quote.scale !== "number" || !Number.isFinite(quote.scale) || quote.scale <= 0 ||
        !["standard", "scientific", "auto"].includes(String(quote.notation)) ||
        !["input", "output"].includes(String(quote.source)))
      return essayFailure(at,
        "Declare a finite positive display scale, precision, notation and input/output source.");
    if (quote.ratioTo !== undefined && quote.source !== "output")
      return essayFailure(at, "Ratios compare scenario outputs.");
    return {
      ...source(quote, at),
      id: id(quote.id, at + ".id"),
      source: quote.source as "input" | "output",
      displayedAs: text(quote.displayedAs, at + ".displayedAs"),
      significantFigures: figures,
      notation: quote.notation as EssayQuotedValue["notation"],
      scale: quote.scale,
      unit: text(quote.unit, at + ".unit", true),
      ...(quote.ratioTo === undefined ? {} : { ratioTo: source(quote.ratioTo, at + ".ratioTo") }),
    };
  });
  unique(quotedValues.map((quote) => quote.id), path + ".quotedValues");
  const transferExamples = list(row.transferExamples, path + ".transferExamples").map((value,
    index) => {
    const at = path + ".transferExamples[" + index + "]";
    const transfer = object(value, at);
    const transferId = id(transfer.id, at + ".id");
    if (!transferId.startsWith(slug + "-"))
      return essayFailure(at,
        "A transfer ID starts with its essay slug and remains stable when reordered.");
    return {
      id: transferId,
      domain: text(transfer.domain, at + ".domain"),
      example: text(transfer.example, at + ".example"),
      sharedMove: text(transfer.sharedMove, at + ".sharedMove"),
      whereItStops: text(transfer.whereItStops, at + ".whereItStops"),
    };
  });
  unique(transferExamples.map((transfer) => transfer.id), path + ".transferExamples");
  if (transferExamples.length < 1) return essayFailure(path,
    "At least one bounded transfer is required.");
  const limits = strings(row.limits, path + ".limits");
  if (ESSAY_REQUIRED_LIMITS.some((limit) => !limits.includes(limit)))
    return essayFailure(path + ".limits",
      "State the required historical and methodological limits.");
  const citations = strings(row.citations, path + ".citations").map((value) => id(value,
    path + ".citations"));
  if (!citations.length) return essayFailure(path + ".citations",
    "At least one citation is required.");
  unique(citations, path + ".citations");
  const reviewRecordIds = strings(row.reviewRecordIds, path + ".reviewRecordIds")
    .map((value) => id(value, path));
  const related = strings(row.related, path + ".related").map((value) => id(value, path));
  unique(related, path + ".related");
  return {
    schemaVersion: 1, kind: "essay", slug, number: seriesIndex + 1, title, label: ESSAY_LABEL,
    r0Summary: summary, body: slug + ".md", anchors, equations, quotedValues,
    transferExamples, limits, citations, reviewRecordIds, related,
  };
}
