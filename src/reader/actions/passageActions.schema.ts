/**
 * `PassageActions` for am-read-passage-actions-vbe: this bead's own record,
 * defined beside the components that consume it. It imports `OBSTACLE_KIND_IDS`
 * (`src/content/schemas/meanings.ts`) and `validateObstacleResponses`
 * (`src/content/schemas/argument.ts`) rather than restating either, so the
 * six obstacle kinds have exactly one spelling. No field is added to those
 * schemas for this bead's own needs.
 *
 * `tryIt`'s instrument, preset, and mode ids are checked against the real
 * grammar (`src/content/ids.ts`'s `parseInstrumentId`/`parsePresetId`/
 * `parseModeId`), which is the format-validity check; whether a given
 * preset or mode id is actually DECLARED in that instrument's own manifest
 * is a cross-manifest existence check this module does not perform (it
 * would need to load every experiment manifest, which is out of this
 * schema's own scope) -- the "undeclared preset or mode id fails
 * compilation" acceptance criterion is only as strong as this grammar
 * check until that join exists.
 */

import { parseInstrumentId, parseModeId, parsePresetId } from "../../content/ids.ts";
import {
  type ObstacleResponses,
  validateObstacleResponses,
} from "../../content/schemas/argument.ts";
import { OBSTACLE_KIND_IDS, type ObstacleKindId } from "../../content/schemas/meanings.ts";

export class PassageActionsSchemaError extends Error {
  readonly code: string;
  readonly path: string;
  constructor(code: string, message: string, path: string) {
    super(message);
    this.name = "PassageActionsSchemaError";
    this.code = code;
    this.path = path;
  }
}

export type TryItAction =
  | Readonly<{ kind: "instrument"; instrumentId: string; presetOrModeId?: string | undefined }>
  | Readonly<{ kind: "static"; staticExampleId: string }>;

export interface PassageActions {
  readonly why?: string | undefined;
  readonly missingStep?: string | undefined;
  readonly example?: string | undefined;
  readonly tryIt?: TryItAction | undefined;
  readonly original?: readonly string[] | undefined;
  readonly hard: boolean;
  readonly obstacleResponses?: ObstacleResponses | undefined;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new PassageActionsSchemaError(
      "invalid-string",
      `${path} must be a non-empty string.`,
      path,
    );
  }
  return value;
}

function optionalStringArray(value: unknown, path: string): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string" && v.trim())) {
    throw new PassageActionsSchemaError(
      "invalid-string-array",
      `${path} must be an array of non-empty strings.`,
      path,
    );
  }
  return Object.freeze([...value]);
}

function validateTryIt(raw: unknown, path: string): TryItAction {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PassageActionsSchemaError("invalid-try-it", `${path} must be an object.`, path);
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.staticExampleId === "string") {
    if (!o.staticExampleId.trim()) {
      throw new PassageActionsSchemaError(
        "invalid-try-it",
        `${path}.staticExampleId must be a non-empty string.`,
        `${path}.staticExampleId`,
      );
    }
    return { kind: "static", staticExampleId: o.staticExampleId };
  }

  if (typeof o.instrumentId !== "string") {
    throw new PassageActionsSchemaError(
      "invalid-try-it",
      `${path} needs either instrumentId or staticExampleId.`,
      path,
    );
  }
  const instResult = parseInstrumentId(o.instrumentId);
  if (!instResult.ok) {
    throw new PassageActionsSchemaError(
      "undeclared-instrument",
      `${path}.instrumentId '${o.instrumentId}' is not a declared instrument: ${instResult.error}`,
      `${path}.instrumentId`,
    );
  }

  let presetOrModeId: string | undefined;
  if (o.presetOrModeId !== undefined) {
    if (typeof o.presetOrModeId !== "string") {
      throw new PassageActionsSchemaError(
        "invalid-try-it",
        `${path}.presetOrModeId must be a string.`,
        `${path}.presetOrModeId`,
      );
    }
    const isMode = o.presetOrModeId.includes(":");
    const result = isMode ? parseModeId(o.presetOrModeId) : parsePresetId(o.presetOrModeId);
    if (!result.ok) {
      throw new PassageActionsSchemaError(
        "undeclared-preset-or-mode",
        `${path}.presetOrModeId '${o.presetOrModeId}' is not a declared ${isMode ? "mode" : "preset"}: ${result.error}`,
        `${path}.presetOrModeId`,
      );
    }
    presetOrModeId = o.presetOrModeId;
  }

  return {
    kind: "instrument",
    instrumentId: o.instrumentId,
    ...(presetOrModeId !== undefined ? { presetOrModeId } : {}),
  };
}

const OBSTACLE_ALLOWED_KEYS: ReadonlySet<string> = new Set<string>([
  ...OBSTACLE_KIND_IDS,
  "exampleFirst",
]);

function validateObstacleResponsesStrict(raw: unknown, path: string): ObstacleResponses {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PassageActionsSchemaError(
      "invalid-obstacle-responses",
      `${path} must be an object.`,
      path,
    );
  }
  // Delegate first: a kebab-case key gets `validateObstacleResponses`'s own
  // specific "use camelCase" guidance, which a generic unknown-key rejection
  // (below) would otherwise shadow.
  let validated: ObstacleResponses;
  try {
    validated = validateObstacleResponses(raw, path);
  } catch (error) {
    if (error instanceof Error) {
      throw new PassageActionsSchemaError("invalid-obstacle-responses", error.message, path);
    }
    throw error;
  }
  // A camelCase-looking but unrecognized key (a real seventh id) passes
  // `validateObstacleResponses` silently, since that function only copies
  // the keys it recognizes; catch it explicitly here.
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    if (!OBSTACLE_ALLOWED_KEYS.has(key)) {
      throw new PassageActionsSchemaError(
        "invalid-obstacle-key",
        `Unknown obstacle response key "${key}"; must be one of ${[...OBSTACLE_ALLOWED_KEYS].join(", ")}.`,
        `${path}.${key}`,
      );
    }
  }
  return validated;
}

export function validatePassageActions(raw: unknown, path = "PassageActions"): PassageActions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PassageActionsSchemaError("invalid-record", `${path} must be an object.`, path);
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.hard !== "boolean") {
    throw new PassageActionsSchemaError(
      "invalid-hard",
      `${path}.hard must be a boolean.`,
      `${path}.hard`,
    );
  }

  const why = optionalString(o.why, `${path}.why`);
  const missingStep = optionalString(o.missingStep, `${path}.missingStep`);
  const example = optionalString(o.example, `${path}.example`);
  const original = optionalStringArray(o.original, `${path}.original`);
  const tryIt = o.tryIt !== undefined ? validateTryIt(o.tryIt, `${path}.tryIt`) : undefined;
  const obstacleResponses =
    o.obstacleResponses !== undefined
      ? validateObstacleResponsesStrict(o.obstacleResponses, `${path}.obstacleResponses`)
      : undefined;

  return Object.freeze({
    ...(why !== undefined ? { why } : {}),
    ...(missingStep !== undefined ? { missingStep } : {}),
    ...(example !== undefined ? { example } : {}),
    ...(tryIt !== undefined ? { tryIt } : {}),
    ...(original !== undefined ? { original } : {}),
    hard: o.hard,
    ...(obstacleResponses !== undefined ? { obstacleResponses } : {}),
  });
}

export { OBSTACLE_KIND_IDS, type ObstacleKindId, type ObstacleResponses };
