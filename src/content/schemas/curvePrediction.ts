/** Authored coordinates for comparing a reader's prediction with an accepted result. */
export type CurvePredictionAxis = Readonly<{
  label: string;
  min: number;
  max: number;
  unit?: string;
}>;

export type CurvePredictionValueTarget = Readonly<{
  targetId: string;
  label: string;
  x: number;
  unit?: string;
  min?: number;
  max?: number;
}>;

export type CurvePredictionChoice = Readonly<{ id: string; label: string }>;

export type CurvePredictionMetadata = Readonly<{
  x: CurvePredictionAxis;
  y: CurvePredictionAxis;
  valueTargets: readonly CurvePredictionValueTarget[];
  verbalChoices?: Readonly<{
    directionChoices: readonly CurvePredictionChoice[];
    shapeChoices: readonly CurvePredictionChoice[];
  }>;
}>;

export class CurvePredictionValidationError extends Error {
  readonly code: "invalid-curve-prediction";
  readonly path: string;

  constructor(code: "invalid-curve-prediction", path: string, message: string) {
    super(`[CurvePrediction] ${path}: ${message} (${code})`);
    this.name = "CurvePredictionValidationError";
    this.code = code;
    this.path = path;
  }
}

function refuse(path: string, message: string): never {
  throw new CurvePredictionValidationError("invalid-curve-prediction", path, message);
}

function fields(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    refuse(path, "Expected an object.");
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (!keys.includes(key)) refuse(`${path}.${key}`, "Unknown field.");
  }
  return result;
}

function text(value: unknown, path: string, maximum = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    refuse(path, `Expected nonempty text of at most ${maximum} characters.`);
  return value;
}

function identifier(value: unknown, path: string): string {
  const id = text(value, path, 64);
  if (id !== id.trim()) refuse(path, "An identifier cannot have surrounding whitespace.");
  return id;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    refuse(path, "Expected a finite number.");
  return value;
}

function unit(value: unknown, path: string): Readonly<{ unit?: string }> {
  return value === undefined ? {} : { unit: text(value, path, 80) };
}

function axis(value: unknown, path: string): CurvePredictionAxis {
  const input = fields(value, ["label", "min", "max", "unit"], path);
  const min = finite(input.min, `${path}.min`);
  const max = finite(input.max, `${path}.max`);
  if (min >= max || !Number.isFinite(max - min))
    refuse(path, "The minimum must be below the maximum, with a finite span.");
  return Object.freeze({
    label: text(input.label, `${path}.label`),
    min,
    max,
    ...unit(input.unit, `${path}.unit`),
  });
}

function boundedList(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 16)
    refuse(path, "Expected between 1 and 16 entries.");
  return value;
}

function choices(value: unknown, path: string): readonly CurvePredictionChoice[] {
  const seen = new Set<string>();
  return Object.freeze(
    boundedList(value, path).map((entry, i) => {
      const at = `${path}[${i}]`;
      const input = fields(entry, ["id", "label"], at);
      const id = identifier(input.id, `${at}.id`);
      if (seen.has(id)) refuse(`${at}.id`, `Duplicate choice id "${id}".`);
      seen.add(id);
      return Object.freeze({ id, label: text(input.label, `${at}.label`) });
    }),
  );
}

/** A present but malformed contract is an authoring error, never a silently absent UI. */
export function validateCurvePrediction(
  value: unknown,
  path = "curvePrediction",
): CurvePredictionMetadata {
  const input = fields(value, ["x", "y", "valueTargets", "verbalChoices"], path);
  const x = axis(input.x, `${path}.x`);
  const y = axis(input.y, `${path}.y`);
  const seen = new Set<string>();
  const valueTargets = Object.freeze(
    boundedList(input.valueTargets, `${path}.valueTargets`).map((entry, i) => {
      const at = `${path}.valueTargets[${i}]`;
      const target = fields(entry, ["targetId", "label", "x", "unit", "min", "max"], at);
      const targetId = identifier(target.targetId, `${at}.targetId`);
      if (seen.has(targetId)) refuse(`${at}.targetId`, `Duplicate value target "${targetId}".`);
      seen.add(targetId);
      const position = finite(target.x, `${at}.x`);
      if (position < x.min || position > x.max)
        refuse(`${at}.x`, "The value target must be inside the x axis.");
      const min = target.min === undefined ? undefined : finite(target.min, `${at}.min`);
      const max = target.max === undefined ? undefined : finite(target.max, `${at}.max`);
      const lower = min ?? y.min;
      const upper = max ?? y.max;
      if (lower < y.min || lower > y.max)
        refuse(`${at}.min`, "The minimum must be inside the y axis.");
      if (upper < y.min || upper > y.max)
        refuse(`${at}.max`, "The maximum must be inside the y axis.");
      if (lower > upper) refuse(at, "The minimum cannot exceed the maximum.");
      return Object.freeze({
        targetId,
        label: text(target.label, `${at}.label`),
        x: position,
        ...unit(target.unit, `${at}.unit`),
        ...(min === undefined ? {} : { min }),
        ...(max === undefined ? {} : { max }),
      });
    }),
  );
  let verbalChoices: CurvePredictionMetadata["verbalChoices"];
  if (input.verbalChoices !== undefined) {
    const at = `${path}.verbalChoices`;
    const verbal = fields(input.verbalChoices, ["directionChoices", "shapeChoices"], at);
    verbalChoices = Object.freeze({
      directionChoices: choices(verbal.directionChoices, `${at}.directionChoices`),
      shapeChoices: choices(verbal.shapeChoices, `${at}.shapeChoices`),
    });
  }
  return Object.freeze({
    x,
    y,
    valueTargets,
    ...(verbalChoices === undefined ? {} : { verbalChoices }),
  });
}

/** Existing candidate-only prompts carry no extra field or implied prediction capability. */
export function curvePredictionFields(
  prompt: Readonly<Record<string, unknown>>,
  path: string,
): Readonly<{ curvePrediction?: CurvePredictionMetadata }> {
  return prompt.curvePrediction === undefined
    ? {}
    : {
        curvePrediction: validateCurvePrediction(prompt.curvePrediction, `${path}.curvePrediction`),
      };
}
