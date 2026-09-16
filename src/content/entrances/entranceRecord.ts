/**
 * Entrance record schema, types, and validation helpers.
 *
 * Each of the four main papers ships an entrance record (first encounter)
 * that assumes no algebra, graph-reading fluency, or physics vocabulary.
 *
 * Spec: am-bm-first-encounter-fjvh and AGENTS.md
 */

import { entranceForEntryAnchor, entryAnchorForEntrance } from "../anchors.ts";
import { type EntranceId, parseEntranceId } from "../ids.ts";
import { type Bridge, validateFoundationOrBridge } from "../schemas/argument.ts";
import { validateSkillNoSymbols } from "./symbolGuard.ts";

export { entranceForEntryAnchor, entryAnchorForEntrance };

export interface HelpEntry {
  readonly obstacle: string;
  readonly clarification: string;
}

export interface EntranceTableRow {
  readonly label: string;
  readonly value: number | string;
  readonly note?: string | undefined;
}

export interface EntranceChoice {
  readonly id: string;
  readonly text: string;
  readonly explanation: string;
  readonly correct?: boolean | undefined;
}

export interface EntranceEmbedSlots {
  readonly returnTo?: string | undefined;
  readonly continueTo?: string | undefined;
}

export interface EntranceRecord {
  readonly id: EntranceId;
  readonly paper: string;
  readonly question: string;
  readonly story: string;
  readonly bridge: Bridge;
  readonly sourceAnchor: string;
  readonly helpEntries: readonly HelpEntry[];
  readonly tableRows?: readonly EntranceTableRow[] | undefined;
  readonly choices?: readonly EntranceChoice[] | undefined;
  readonly agreement?: string | undefined;
  readonly consistencyCase?: string | undefined;
  readonly authoredEntries?: readonly number[] | undefined;
  readonly presetIds?: readonly string[] | undefined;
  readonly embedSlots?: EntranceEmbedSlots | undefined;
}

export class EntranceSchemaError extends Error {
  readonly code: string;
  readonly path: string;
  readonly recordId?: string | undefined;

  constructor(code: string, message: string, path: string, recordId?: string) {
    super(message);
    this.name = "EntranceSchemaError";
    this.code = code;
    this.path = path;
    this.recordId = recordId;
  }
}

/**
 * Derives an entrance ID from a paper slug.
 * Example: 'brownian-motion' -> 'entrance-brownian-motion'
 */
export function paperSlugToEntranceId(slug: string): EntranceId {
  const raw = `entrance-${slug}`;
  const parsed = parseEntranceId(raw);
  if (!parsed.ok) {
    throw new EntranceSchemaError(
      "invalid-entrance-id",
      `Cannot derive entrance ID from slug '${slug}': ${parsed.error}`,
      "id",
    );
  }
  return parsed.value;
}

/**
 * Derives an entry anchor from a paper slug.
 * Example: 'brownian-motion' -> '#entry-brownian-motion'
 */
export function paperSlugToEntryAnchor(slug: string): string {
  const entranceId = paperSlugToEntranceId(slug);
  return entryAnchorForEntrance(entranceId);
}

const ALLOWED_ENTRANCE_FIELDS = new Set([
  "id",
  "paper",
  "question",
  "story",
  "bridge",
  "sourceAnchor",
  "helpEntries",
  "tableRows",
  "choices",
  "agreement",
  "consistencyCase",
  "authoredEntries",
  "presetIds",
  "embedSlots",
]);

/**
 * Validates an EntranceRecord against the required core and optional typed fields.
 * Rejects unknown fields and enforces the bridge contract.
 */
export function validateEntranceRecord(raw: unknown, path = "EntranceRecord"): EntranceRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new EntranceSchemaError("invalid-record", "EntranceRecord must be a plain object.", path);
  }

  const o = raw as Record<string, unknown>;
  const recordId = typeof o.id === "string" ? o.id : undefined;

  // Unknown field rejection
  for (const key of Object.keys(o)) {
    if (!ALLOWED_ENTRANCE_FIELDS.has(key)) {
      throw new EntranceSchemaError(
        "unknown-field",
        `Unknown field '${key}' on EntranceRecord${recordId ? ` '${recordId}'` : ""}.`,
        `${path}.${key}`,
        recordId,
      );
    }
  }

  // 1. ID validation
  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new EntranceSchemaError(
      "missing-id",
      "Field 'id' is required on EntranceRecord.",
      `${path}.id`,
      recordId,
    );
  }
  const parsedId = parseEntranceId(o.id);
  if (!parsedId.ok) {
    throw new EntranceSchemaError(
      "invalid-id",
      `Invalid entrance ID '${o.id}': ${parsedId.error}`,
      `${path}.id`,
      recordId,
    );
  }
  const id = parsedId.value;

  // 2. Paper validation
  if (typeof o.paper !== "string" || !o.paper.trim()) {
    throw new EntranceSchemaError(
      "missing-paper",
      `Field 'paper' is required on EntranceRecord '${id}'.`,
      `${path}.paper`,
      id,
    );
  }
  const expectedSlug = id.slice("entrance-".length);
  if (
    o.paper !== expectedSlug &&
    o.paper !== "bm" &&
    o.paper !== "lq" &&
    o.paper !== "sr" &&
    o.paper !== "me"
  ) {
    throw new EntranceSchemaError(
      "paper-mismatch",
      `Field 'paper' ('${o.paper}') does not match entrance ID slug '${expectedSlug}' on '${id}'.`,
      `${path}.paper`,
      id,
    );
  }
  const paper = o.paper;

  // 3. Question
  if (typeof o.question !== "string" || !o.question.trim()) {
    throw new EntranceSchemaError(
      "missing-question",
      `Field 'question' is required on EntranceRecord '${id}'.`,
      `${path}.question`,
      id,
    );
  }
  const question = o.question;

  // 4. Story
  if (typeof o.story !== "string" || !o.story.trim()) {
    throw new EntranceSchemaError(
      "missing-story",
      `Field 'story' is required on EntranceRecord '${id}'.`,
      `${path}.story`,
      id,
    );
  }
  const story = o.story;

  // 5. Source Anchor
  if (typeof o.sourceAnchor !== "string" || !o.sourceAnchor.trim()) {
    throw new EntranceSchemaError(
      "missing-source-anchor",
      `Field 'sourceAnchor' is required on EntranceRecord '${id}'.`,
      `${path}.sourceAnchor`,
      id,
    );
  }
  const sourceAnchor = o.sourceAnchor;

  // 6. Help Entries
  if (!Array.isArray(o.helpEntries)) {
    throw new EntranceSchemaError(
      "missing-help-entries",
      `Field 'helpEntries' array is required on EntranceRecord '${id}'.`,
      `${path}.helpEntries`,
      id,
    );
  }
  const helpEntries: HelpEntry[] = [];
  for (let i = 0; i < o.helpEntries.length; i++) {
    const item = o.helpEntries[i];
    if (!item || typeof item !== "object") {
      throw new EntranceSchemaError(
        "invalid-help-entry",
        `HelpEntry at index ${i} must be an object.`,
        `${path}.helpEntries[${i}]`,
        id,
      );
    }
    const h = item as Record<string, unknown>;
    if (typeof h.obstacle !== "string" || !h.obstacle.trim()) {
      throw new EntranceSchemaError(
        "invalid-help-entry",
        `HelpEntry at index ${i} is missing 'obstacle'.`,
        `${path}.helpEntries[${i}].obstacle`,
        id,
      );
    }
    if (typeof h.clarification !== "string" || !h.clarification.trim()) {
      throw new EntranceSchemaError(
        "invalid-help-entry",
        `HelpEntry at index ${i} is missing 'clarification'.`,
        `${path}.helpEntries[${i}].clarification`,
        id,
      );
    }
    helpEntries.push({ obstacle: h.obstacle, clarification: h.clarification });
  }

  // 7. Bridge validation (uses argument schema)
  if (!o.bridge || typeof o.bridge !== "object") {
    throw new EntranceSchemaError(
      "missing-bridge",
      `Field 'bridge' is required on EntranceRecord '${id}'.`,
      `${path}.bridge`,
      id,
    );
  }

  let bridge: Bridge;
  try {
    const validated = validateFoundationOrBridge(o.bridge, `${path}.bridge`);
    if (validated.kind !== "bridge") {
      throw new EntranceSchemaError(
        "invalid-bridge-kind",
        `Entrance record bridge must have kind 'bridge', got '${validated.kind}'.`,
        `${path}.bridge.kind`,
        id,
      );
    }
    bridge = validated;
  } catch (err: unknown) {
    if (err instanceof EntranceSchemaError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new EntranceSchemaError(
      "invalid-bridge",
      `Bridge validation failed on EntranceRecord '${id}': ${msg}`,
      `${path}.bridge`,
      id,
    );
  }

  // Enforce the 3 required bridge parts for entrance records
  if (!bridge.newSkill?.trim()) {
    throw new EntranceSchemaError(
      "missing-new-skill",
      `Bridge requires 'newSkill' on EntranceRecord '${id}'.`,
      `${path}.bridge.newSkill`,
      id,
    );
  }
  // Enforce No-Symbol rule on newSkill
  try {
    validateSkillNoSymbols(bridge.newSkill, `${path}.bridge.newSkill`);
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new EntranceSchemaError(
        "symbol-in-skill",
        `newSkill on EntranceRecord '${id}' contains forbidden symbol: ${err.message}`,
        `${path}.bridge.newSkill`,
        id,
      );
    }
    throw err;
  }

  if (!bridge.whyUsefulHere?.trim()) {
    throw new EntranceSchemaError(
      "missing-why-useful-here",
      `Bridge requires 'whyUsefulHere' on EntranceRecord '${id}'.`,
      `${path}.bridge.whyUsefulHere`,
      id,
    );
  }

  if (!bridge.continueWith || bridge.continueWith.length < 2) {
    throw new EntranceSchemaError(
      "invalid-continue-with-count",
      `Bridge must provide at least 2 'continueWith' routes on EntranceRecord '${id}'.`,
      `${path}.bridge.continueWith`,
      id,
    );
  }

  const hasMoreGuidance = bridge.continueWith.some((r) => r.route === "more-guidance");
  const hasLessGuidance = bridge.continueWith.some((r) => r.route === "less-guidance");
  if (!hasMoreGuidance || !hasLessGuidance) {
    throw new EntranceSchemaError(
      "bridge-routes-not-differentiated",
      `Bridge 'continueWith' routes must be differentiated (at least one 'more-guidance' and one 'less-guidance') on EntranceRecord '${id}'.`,
      `${path}.bridge.continueWith`,
      id,
    );
  }

  // 8. Optional typed fields
  let tableRows: EntranceTableRow[] | undefined;
  if (o.tableRows !== undefined) {
    if (!Array.isArray(o.tableRows)) {
      throw new EntranceSchemaError(
        "invalid-table-rows",
        `Field 'tableRows' must be an array on EntranceRecord '${id}'.`,
        `${path}.tableRows`,
        id,
      );
    }
    tableRows = [];
    for (let i = 0; i < o.tableRows.length; i++) {
      const tr = o.tableRows[i];
      if (!tr || typeof tr !== "object") {
        throw new EntranceSchemaError(
          "invalid-table-row",
          `TableRow at index ${i} must be an object.`,
          `${path}.tableRows[${i}]`,
          id,
        );
      }
      const r = tr as Record<string, unknown>;
      if (typeof r.label !== "string" || !r.label.trim()) {
        throw new EntranceSchemaError(
          "invalid-table-row",
          `TableRow at index ${i} requires 'label'.`,
          `${path}.tableRows[${i}].label`,
          id,
        );
      }
      if (typeof r.value !== "number" && typeof r.value !== "string") {
        throw new EntranceSchemaError(
          "invalid-table-row",
          `TableRow at index ${i} requires 'value' to be number or string.`,
          `${path}.tableRows[${i}].value`,
          id,
        );
      }
      tableRows.push({
        label: r.label,
        value: r.value,
        note: typeof r.note === "string" ? r.note : undefined,
      });
    }
  }

  let choices: EntranceChoice[] | undefined;
  if (o.choices !== undefined) {
    if (!Array.isArray(o.choices)) {
      throw new EntranceSchemaError(
        "invalid-choices",
        `Field 'choices' must be an array on EntranceRecord '${id}'.`,
        `${path}.choices`,
        id,
      );
    }
    choices = [];
    for (let i = 0; i < o.choices.length; i++) {
      const ch = o.choices[i];
      if (!ch || typeof ch !== "object") {
        throw new EntranceSchemaError(
          "invalid-choice",
          `Choice at index ${i} must be an object.`,
          `${path}.choices[${i}]`,
          id,
        );
      }
      const c = ch as Record<string, unknown>;
      if (typeof c.id !== "string" || !c.id.trim()) {
        throw new EntranceSchemaError(
          "invalid-choice",
          `Choice at index ${i} requires 'id'.`,
          `${path}.choices[${i}].id`,
          id,
        );
      }
      if (typeof c.text !== "string" || !c.text.trim()) {
        throw new EntranceSchemaError(
          "invalid-choice",
          `Choice at index ${i} requires 'text'.`,
          `${path}.choices[${i}].text`,
          id,
        );
      }
      if (typeof c.explanation !== "string" || !c.explanation.trim()) {
        throw new EntranceSchemaError(
          "invalid-choice",
          `Choice at index ${i} requires 'explanation'.`,
          `${path}.choices[${i}].explanation`,
          id,
        );
      }
      choices.push({
        id: c.id,
        text: c.text,
        explanation: c.explanation,
        correct: typeof c.correct === "boolean" ? c.correct : undefined,
      });
    }
  }

  let authoredEntries: number[] | undefined;
  if (o.authoredEntries !== undefined) {
    if (!Array.isArray(o.authoredEntries)) {
      throw new EntranceSchemaError(
        "invalid-authored-entries",
        `Field 'authoredEntries' must be an array of numbers on EntranceRecord '${id}'.`,
        `${path}.authoredEntries`,
        id,
      );
    }
    authoredEntries = [];
    for (let i = 0; i < o.authoredEntries.length; i++) {
      const val = o.authoredEntries[i];
      if (typeof val !== "number" || Number.isNaN(val)) {
        throw new EntranceSchemaError(
          "invalid-authored-entry",
          `Authored entry at index ${i} must be a number.`,
          `${path}.authoredEntries[${i}]`,
          id,
        );
      }
      authoredEntries.push(val);
    }
  }

  let presetIds: string[] | undefined;
  if (o.presetIds !== undefined) {
    if (!Array.isArray(o.presetIds) || !o.presetIds.every((p) => typeof p === "string")) {
      throw new EntranceSchemaError(
        "invalid-preset-ids",
        `Field 'presetIds' must be an array of strings on EntranceRecord '${id}'.`,
        `${path}.presetIds`,
        id,
      );
    }
    presetIds = [...(o.presetIds as string[])];
  }

  let embedSlots: EntranceEmbedSlots | undefined;
  if (o.embedSlots !== undefined) {
    if (!o.embedSlots || typeof o.embedSlots !== "object") {
      throw new EntranceSchemaError(
        "invalid-embed-slots",
        `Field 'embedSlots' must be an object on EntranceRecord '${id}'.`,
        `${path}.embedSlots`,
        id,
      );
    }
    const es = o.embedSlots as Record<string, unknown>;
    embedSlots = {
      returnTo: typeof es.returnTo === "string" ? es.returnTo : undefined,
      continueTo: typeof es.continueTo === "string" ? es.continueTo : undefined,
    };
  }

  return {
    id,
    paper,
    question,
    story,
    bridge,
    sourceAnchor,
    helpEntries: Object.freeze(helpEntries),
    ...(tableRows ? { tableRows: Object.freeze(tableRows) } : {}),
    ...(choices ? { choices: Object.freeze(choices) } : {}),
    ...(typeof o.agreement === "string" ? { agreement: o.agreement } : {}),
    ...(typeof o.consistencyCase === "string" ? { consistencyCase: o.consistencyCase } : {}),
    ...(authoredEntries ? { authoredEntries: Object.freeze(authoredEntries) } : {}),
    ...(presetIds ? { presetIds: Object.freeze(presetIds) } : {}),
    ...(embedSlots ? { embedSlots: Object.freeze(embedSlots) } : {}),
  };
}
