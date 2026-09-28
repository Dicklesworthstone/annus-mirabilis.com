/**
 * THE CAPSTONE RECORD (am-disc-capstones-infra-3352).
 *
 * One capstone per paper: an ordered set of source-linked claims, an instrument preset or two, a few
 * annotated equations, and a statement of assumptions, which a reader rearranges and annotates in a
 * local worksheet in order to explain the result to someone else.
 *
 * TWO SHAPES CARRY THE EDITORIAL POLICY, rather than leaving it to an author's care:
 *
 * - A dependency chain is a PARTIAL order. `buildsOn` is the graph; `paperOrder` is one order
 *   consistent with it, which the worksheet may reveal, and never "the answer"; `startOrder` is
 *   where the worksheet begins and must differ from `paperOrder`, because a start order that is
 *   already the paper's turns reconstruction into copying.
 * - No number is typed into a claim. The worksheet computes no physics: values come from an
 *   instrument the reader opens, or from a scenario shown as a labelled static worked example. A
 *   literal quantity in claim text would be a number nobody can trace, and `capstone-literal-number`
 *   refuses it.
 *
 * This file is shape, graph and text. Resolving ids against the rest of the corpus, the anchors,
 * presets, tapes, scenarios and equations, is `checkCapstoneReferences`, which takes the resolvers
 * so the schema does not import the world; the content beads wire it to the real registries.
 */
import { checkVoice } from "../../content/checks/voice/index.ts";
import { type DependencyEdge, dependencyFeedback } from "../shared/dependencyFeedback.ts";

export const CLAIM_ROLES = [
  "definition",
  "assumption",
  "derivation",
  "heuristic-inference",
  "empirical-observation",
  "qualification",
  "admitted-import",
  "generalization",
] as const;
export type ClaimRole = (typeof CLAIM_ROLES)[number];

export const ASSUMPTION_KINDS = [
  "premise",
  "idealization",
  "convention",
  "approximation",
  "stipulation",
  "boundary-choice",
  "setup",
] as const;
export type AssumptionKind = (typeof ASSUMPTION_KINDS)[number];

export type CapstoneClaim = Readonly<{
  id: string;
  text: string;
  /** The source passage this claim is read from. */
  anchor: string;
  logicalRole: ClaimRole;
  /** Claim ids this one uses or answers. The edges of the chain. */
  buildsOn: readonly string[];
  assumptionIds: readonly string[];
}>;

export type CapstonePreset = Readonly<{
  instrumentId: string;
  tapeId?: string | undefined;
  presetId?: string | undefined;
  purpose: string;
  lookFor: readonly Readonly<{ scenarioId: string; outputId: string; description: string }>[];
}>;

export type CapstoneAssumption = Readonly<{
  id: string;
  statement: string;
  kind: AssumptionKind;
  anchor?: string | undefined;
}>;

export type Capstone = Readonly<{
  id: string;
  paper: string;
  title: string;
  question: string;
  claims: readonly CapstoneClaim[];
  paperOrder: readonly string[];
  startOrder: readonly string[];
  presets: readonly CapstonePreset[];
  equations: readonly Readonly<{ equationId: string; purpose: string }>[];
  assumptions: readonly CapstoneAssumption[];
  explanationPrompt: string;
  /** Why each claim uses the assumptions it uses, by claim id. */
  selfCheckNotes: Readonly<Record<string, string>>;
  /** What this capstone does not claim. */
  limits: string;
  reviewRecordIds: readonly string[];
}>;

export class CapstoneSchemaError extends Error {
  readonly code: string;
  readonly path: string;
  constructor(code: string, message: string, path: string) {
    super(`${code} at ${path}: ${message}`);
    this.name = "CapstoneSchemaError";
    this.code = code;
    this.path = path;
  }
}

const MIN_CLAIMS = 5;
const EQUATION_RANGE = Object.freeze({ min: 2, max: 4 });
const PRESET_RANGE = Object.freeze({ min: 1, max: 4 });

/**
 * A quantity written into prose: a number carrying a unit, or one in scientific notation. A bare
 * integer is left alone, because a claim may say "the two pulses" or cite a year, and a section
 * number is not a measurement. This is a numeral detector, not a vocabulary: the words a capstone
 * may not use are checkVoice's business and no list of them lives here.
 */
const LITERAL_QUANTITY =
  /\d+(?:[.,]\d+)?\s*(?:[eE][-+]?\d+|×\s*10|\^|·10)|\d+(?:[.,]\d+)?\s*(?:μm|um|nm|mm|cm|km|kg|g\b|s\b|ms|K\b|J\b|eV|keV|MeV|Pa|mPa|N\b|Hz|THz|V\b|A\b|mol|%)/;

/**
 * A required string. The two codes are thrown from two sites with two literals rather than from one
 * site with a variable: a refusal's code has to be readable where it is thrown, both for the reader
 * of this file and for the scanner that checks every refusal is exercised.
 */
function text(value: unknown, path: string, code = "capstone-missing-text"): string {
  if (typeof value === "string" && value.trim()) return value;
  if (code === "capstone-missing-id")
    throw new CapstoneSchemaError("capstone-missing-id", "an id is required.", path);
  throw new CapstoneSchemaError("capstone-missing-text", "a non-empty string is required.", path);
}

function list(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value))
    throw new CapstoneSchemaError("capstone-not-a-list", "a list is required.", path);
  return value;
}

/** The same refusal for a list of ids, under its own code so each site is credited on its own. */
function idList(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value))
    throw new CapstoneSchemaError("capstone-ids-not-a-list", "a list of ids is required.", path);
  return value;
}

function ids(value: unknown, path: string): readonly string[] {
  return idList(value, path).map((entry, index) => text(entry, `${path}[${index}]`));
}

/** Every visitor-facing string, checked in the context the bead assigns it. */
function checkCopy(value: string, context: "prose" | "reader-progress", path: string): void {
  const findings = checkVoice(value, { context }).filter((f) => f.severity === "error");
  if (findings.length > 0)
    throw new CapstoneSchemaError(
      "capstone-voice",
      `${findings.map((f) => `${f.rule}: ${f.matchedText}`).join("; ")}`,
      path,
    );
}

function checkNoLiteralQuantity(value: string, path: string): void {
  const match = LITERAL_QUANTITY.exec(value);
  if (match)
    throw new CapstoneSchemaError(
      "capstone-literal-number",
      `"${match[0].trim()}" is a quantity typed into the text; a capstone's numbers come from an instrument or a scenario, never from a record.`,
      path,
    );
}

/** One capstone record: shape, the chain's graph, and the text rules. */
export function validateCapstone(raw: unknown, path = "Capstone"): Capstone {
  if (!raw || typeof raw !== "object")
    throw new CapstoneSchemaError("capstone-invalid-record", "a capstone must be an object.", path);
  const o = raw as Record<string, unknown>;

  const id = text(o.id, `${path}.id`, "capstone-missing-id");
  const paper = text(o.paper, `${path}.paper`);
  const title = text(o.title, `${path}.title`);
  const question = text(o.question, `${path}.question`);
  const explanationPrompt = text(o.explanationPrompt, `${path}.explanationPrompt`);
  const limits = text(o.limits, `${path}.limits`);

  const rawClaims = list(o.claims, `${path}.claims`);
  if (rawClaims.length < MIN_CLAIMS)
    throw new CapstoneSchemaError(
      "capstone-too-few-claims",
      `a capstone needs at least ${MIN_CLAIMS} claims; this one has ${rawClaims.length}.`,
      `${path}.claims`,
    );

  const claims: CapstoneClaim[] = rawClaims.map((entry, index) => {
    const where = `${path}.claims[${index}]`;
    const c = (entry ?? {}) as Record<string, unknown>;
    const claimId = text(c.id, `${where}.id`, "capstone-missing-id");
    const claimText = text(c.text, `${where}.text`);
    checkNoLiteralQuantity(claimText, `${where}.text`);
    checkCopy(claimText, "prose", `${where}.text`);
    if (!CLAIM_ROLES.includes(c.logicalRole as ClaimRole))
      throw new CapstoneSchemaError(
        "capstone-invalid-role",
        `"${String(c.logicalRole)}" is not one of: ${CLAIM_ROLES.join(", ")}.`,
        `${where}.logicalRole`,
      );
    return {
      id: claimId,
      text: claimText,
      anchor: text(c.anchor, `${where}.anchor`),
      logicalRole: c.logicalRole as ClaimRole,
      buildsOn: ids(c.buildsOn ?? [], `${where}.buildsOn`),
      assumptionIds: ids(c.assumptionIds ?? [], `${where}.assumptionIds`),
    };
  });

  const claimIds = claims.map((c) => c.id);
  const seen = new Set<string>();
  for (const claimId of claimIds) {
    if (seen.has(claimId))
      throw new CapstoneSchemaError(
        "capstone-duplicate-claim",
        `claim id "${claimId}" appears twice.`,
        `${path}.claims`,
      );
    seen.add(claimId);
  }

  const rawAssumptions = list(o.assumptions, `${path}.assumptions`);
  const assumptions: CapstoneAssumption[] = rawAssumptions.map((entry, index) => {
    const where = `${path}.assumptions[${index}]`;
    const a = (entry ?? {}) as Record<string, unknown>;
    const statement = text(a.statement, `${where}.statement`);
    checkCopy(statement, "prose", `${where}.statement`);
    if (!ASSUMPTION_KINDS.includes(a.kind as AssumptionKind))
      throw new CapstoneSchemaError(
        "capstone-invalid-assumption-kind",
        `"${String(a.kind)}" is not one of: ${ASSUMPTION_KINDS.join(", ")}.`,
        `${where}.kind`,
      );
    return {
      id: text(a.id, `${where}.id`, "capstone-missing-id"),
      statement,
      kind: a.kind as AssumptionKind,
      ...(typeof a.anchor === "string" && a.anchor.trim() ? { anchor: a.anchor } : {}),
    };
  });

  const assumptionIds = new Set(assumptions.map((a) => a.id));
  for (const [index, claim] of claims.entries()) {
    for (const used of claim.assumptionIds) {
      if (!assumptionIds.has(used))
        throw new CapstoneSchemaError(
          "capstone-unknown-assumption",
          `claim "${claim.id}" names assumption "${used}", which this capstone does not state.`,
          `${path}.claims[${index}].assumptionIds`,
        );
    }
    // A heuristic step is the one place a reader most needs to see what is being granted.
    if (claim.logicalRole === "heuristic-inference" && claim.assumptionIds.length === 0)
      throw new CapstoneSchemaError(
        "capstone-heuristic-without-assumption",
        `claim "${claim.id}" is a heuristic inference and names no assumption.`,
        `${path}.claims[${index}].assumptionIds`,
      );
  }
  const used = new Set(claims.flatMap((c) => c.assumptionIds));
  for (const [index, assumption] of assumptions.entries()) {
    if (!used.has(assumption.id))
      throw new CapstoneSchemaError(
        "capstone-unused-assumption",
        `assumption "${assumption.id}" is stated and no claim uses it.`,
        `${path}.assumptions[${index}]`,
      );
  }

  const edges: DependencyEdge[] = claims.flatMap((claim) =>
    claim.buildsOn.map((from) => ({ from, to: claim.id })),
  );
  const paperOrder = ids(o.paperOrder, `${path}.paperOrder`);
  const startOrder = ids(o.startOrder, `${path}.startOrder`);

  // dependencyFeedback owns the graph: it refuses a cycle before any order is read, refuses an order
  // that is not a permutation, and names the edges an order breaks. The rules below are its verdicts
  // translated into this record's vocabulary, so there is one implementation of the partial order.
  for (const [order, field] of [
    [paperOrder, "paperOrder"],
    [startOrder, "startOrder"],
  ] as const) {
    try {
      const feedback = dependencyFeedback(claimIds, edges, order);
      if (field === "paperOrder" && !feedback.consistent)
        throw new CapstoneSchemaError(
          "capstone-paper-order-inconsistent",
          `the paper's order breaks ${feedback.violated.map((e) => `${e.from} before ${e.to}`).join(", ")}.`,
          `${path}.paperOrder`,
        );
    } catch (error) {
      if (error instanceof CapstoneSchemaError) throw error;
      // Two literal codes rather than one assembled from a variable: a refusal's code is readable at
      // its throw site, which is what lets the ratchet see it and a reader of this file trust it.
      if ((error as { code?: string }).code === "dependency-graph-cycle")
        throw new CapstoneSchemaError(
          "capstone-chain-cycle",
          (error as Error).message,
          `${path}.${field}`,
        );
      throw new CapstoneSchemaError(
        "capstone-order-invalid",
        (error as Error).message,
        `${path}.${field}`,
      );
    }
  }
  if (paperOrder.join("\u0000") === startOrder.join("\u0000"))
    throw new CapstoneSchemaError(
      "capstone-start-order-is-paper-order",
      "the worksheet would start in the paper's own order, which is copying rather than reconstruction.",
      `${path}.startOrder`,
    );

  const rawEquations = list(o.equations, `${path}.equations`);
  if (rawEquations.length < EQUATION_RANGE.min || rawEquations.length > EQUATION_RANGE.max)
    throw new CapstoneSchemaError(
      "capstone-equation-count",
      `a capstone annotates ${EQUATION_RANGE.min} to ${EQUATION_RANGE.max} equations; this one has ${rawEquations.length}.`,
      `${path}.equations`,
    );
  const equations = rawEquations.map((entry, index) => {
    const where = `${path}.equations[${index}]`;
    const e = (entry ?? {}) as Record<string, unknown>;
    const purpose = text(e.purpose, `${where}.purpose`);
    checkCopy(purpose, "reader-progress", `${where}.purpose`);
    return { equationId: text(e.equationId, `${where}.equationId`), purpose };
  });

  const rawPresets = list(o.presets, `${path}.presets`);
  if (rawPresets.length < PRESET_RANGE.min || rawPresets.length > PRESET_RANGE.max)
    throw new CapstoneSchemaError(
      "capstone-preset-count",
      `a capstone offers ${PRESET_RANGE.min} to ${PRESET_RANGE.max} instrument settings; this one offers ${rawPresets.length}.`,
      `${path}.presets`,
    );
  const presets: CapstonePreset[] = rawPresets.map((entry, index) => {
    const where = `${path}.presets[${index}]`;
    const p = (entry ?? {}) as Record<string, unknown>;
    const purpose = text(p.purpose, `${where}.purpose`);
    checkCopy(purpose, "reader-progress", `${where}.purpose`);
    if (typeof p.tapeId !== "string" && typeof p.presetId !== "string")
      throw new CapstoneSchemaError(
        "capstone-preset-address",
        "a setting names either a tape or a preset a reader can open.",
        where,
      );
    return {
      instrumentId: text(p.instrumentId, `${where}.instrumentId`),
      ...(typeof p.tapeId === "string" ? { tapeId: p.tapeId } : {}),
      ...(typeof p.presetId === "string" ? { presetId: p.presetId } : {}),
      purpose,
      lookFor: list(p.lookFor ?? [], `${where}.lookFor`).map((look, n) => {
        const item = (look ?? {}) as Record<string, unknown>;
        const description = text(item.description, `${where}.lookFor[${n}].description`);
        checkNoLiteralQuantity(description, `${where}.lookFor[${n}].description`);
        return {
          scenarioId: text(item.scenarioId, `${where}.lookFor[${n}].scenarioId`),
          outputId: text(item.outputId, `${where}.lookFor[${n}].outputId`),
          description,
        };
      }),
    };
  });

  const notesRaw = (o.selfCheckNotes ?? {}) as Record<string, unknown>;
  const selfCheckNotes: Record<string, string> = {};
  for (const claim of claims) {
    const note = notesRaw[claim.id];
    if (note !== undefined) {
      const where = `${path}.selfCheckNotes.${claim.id}`;
      const value = text(note, where);
      checkCopy(value, "reader-progress", where);
      selfCheckNotes[claim.id] = value;
    }
  }

  checkNoLiteralQuantity(explanationPrompt, `${path}.explanationPrompt`);
  checkCopy(explanationPrompt, "reader-progress", `${path}.explanationPrompt`);
  checkCopy(limits, "prose", `${path}.limits`);

  return {
    id,
    paper,
    title,
    question,
    claims,
    paperOrder,
    startOrder,
    presets,
    equations,
    assumptions,
    explanationPrompt,
    selfCheckNotes,
    limits,
    reviewRecordIds: ids(o.reviewRecordIds ?? [], `${path}.reviewRecordIds`),
  };
}

export type CapstoneResolvers = Readonly<{
  anchorExists: (paper: string, anchor: string) => boolean;
  instrumentExists: (instrumentId: string) => boolean;
  equationExists: (equationId: string) => boolean;
  equationHasSpokenForm: (equationId: string) => boolean;
  tapeExists?: ((tapeId: string) => boolean) | undefined;
  presetExists?: ((instrumentId: string, presetId: string) => boolean) | undefined;
  scenarioExists?: ((scenarioId: string) => boolean) | undefined;
}>;

/**
 * Every id a capstone names, resolved against the corpus. Separate from the shape check because the
 * schema should not import the registries: the caller supplies them, which is also what lets a
 * fixture be checked without the four papers' content.
 */
export function checkCapstoneReferences(
  capstone: Capstone,
  resolvers: CapstoneResolvers,
  path = "Capstone",
): void {
  for (const [index, claim] of capstone.claims.entries()) {
    if (!resolvers.anchorExists(capstone.paper, claim.anchor))
      throw new CapstoneSchemaError(
        "capstone-unresolved-anchor",
        `claim "${claim.id}" cites "${claim.anchor}", which is not a passage of ${capstone.paper}.`,
        `${path}.claims[${index}].anchor`,
      );
  }
  for (const [index, preset] of capstone.presets.entries()) {
    const where = `${path}.presets[${index}]`;
    if (!resolvers.instrumentExists(preset.instrumentId))
      throw new CapstoneSchemaError(
        "capstone-unresolved-instrument",
        `"${preset.instrumentId}" is not a registered instrument.`,
        `${where}.instrumentId`,
      );
    if (preset.tapeId !== undefined && resolvers.tapeExists && !resolvers.tapeExists(preset.tapeId))
      throw new CapstoneSchemaError(
        "capstone-unresolved-tape",
        `"${preset.tapeId}" is not a teaching tape.`,
        `${where}.tapeId`,
      );
    if (
      preset.presetId !== undefined &&
      resolvers.presetExists &&
      !resolvers.presetExists(preset.instrumentId, preset.presetId)
    )
      throw new CapstoneSchemaError(
        "capstone-unresolved-preset",
        `"${preset.presetId}" is not a preset of ${preset.instrumentId}.`,
        `${where}.presetId`,
      );
    for (const [n, look] of preset.lookFor.entries()) {
      if (resolvers.scenarioExists && !resolvers.scenarioExists(look.scenarioId))
        throw new CapstoneSchemaError(
          "capstone-unresolved-scenario",
          `"${look.scenarioId}" is not a scenario.`,
          `${where}.lookFor[${n}].scenarioId`,
        );
    }
  }
  for (const [index, equation] of capstone.equations.entries()) {
    const where = `${path}.equations[${index}].equationId`;
    if (!resolvers.equationExists(equation.equationId))
      throw new CapstoneSchemaError(
        "capstone-unresolved-equation",
        `"${equation.equationId}" is not an equation record.`,
        where,
      );
    if (!resolvers.equationHasSpokenForm(equation.equationId))
      throw new CapstoneSchemaError(
        "capstone-equation-without-spoken-form",
        `"${equation.equationId}" has no authored spoken form, so it cannot be read aloud beside its annotation.`,
        where,
      );
  }
}
