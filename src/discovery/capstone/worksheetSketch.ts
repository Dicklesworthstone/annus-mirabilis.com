/** Private vector marks, not measurements or a physics model. Coordinates use a fixed drawing grid. */
export const SKETCH_LIMITS = Object.freeze({
  width: 1000,
  height: 600,
  strokes: 128,
  pointsPerStroke: 256,
  points: 2048,
  description: 10000,
});

export type SketchPoint = Readonly<{ x: number; y: number }>;
export type WorksheetSketch = Readonly<{
  description: string;
  strokes: readonly (readonly SketchPoint[])[];
}>;

export function emptySketch(): WorksheetSketch {
  return { description: "", strokes: [] };
}

function plain(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === "string" &&
        Object.getOwnPropertyDescriptor(value, key)?.enumerable === true &&
        Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value"),
    )
  );
}

/** Reject sparse arrays, accessors and unrepresented properties rather than losing them on export. */
function list(value: unknown, limit: number): value is unknown[] {
  if (!Array.isArray(value) || value.length > limit) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, String(index)) ?? {}, "value"))
      return false;
  }
  return true;
}

/** Admission is lossless: an unsupported mark or over-budget drawing rejects the whole input. */
export function readSketch(input: unknown): WorksheetSketch | null {
  if (
    !plain(input) ||
    Object.keys(input).length !== 2 ||
    !Object.hasOwn(input, "description") ||
    !Object.hasOwn(input, "strokes") ||
    typeof input.description !== "string" ||
    input.description.length > SKETCH_LIMITS.description ||
    !list(input.strokes, SKETCH_LIMITS.strokes)
  )
    return null;
  for (const character of input.description) {
    const code = character.charCodeAt(0);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)) return null;
  }
  let total = 0;
  const strokes: SketchPoint[][] = [];
  for (const stroke of input.strokes) {
    if (!list(stroke, SKETCH_LIMITS.pointsPerStroke) || stroke.length === 0) return null;
    total += stroke.length;
    if (total > SKETCH_LIMITS.points) return null;
    const points: SketchPoint[] = [];
    for (const point of stroke) {
      if (
        !plain(point) ||
        Object.keys(point).length !== 2 ||
        !Object.hasOwn(point, "x") ||
        !Object.hasOwn(point, "y") ||
        !Number.isSafeInteger(point.x) ||
        !Number.isSafeInteger(point.y) ||
        (point.x as number) < 0 ||
        (point.x as number) > SKETCH_LIMITS.width ||
        (point.y as number) < 0 ||
        (point.y as number) > SKETCH_LIMITS.height
      )
        return null;
      points.push({ x: point.x as number, y: point.y as number });
    }
    strokes.push(points);
  }
  return { description: input.description, strokes };
}

export class WorksheetSketchError extends TypeError {
  readonly code = "capstone-sketch-invalid";
  constructor() {
    super("This drawing is unsupported or too large. Nothing was truncated; keep the original.");
    this.name = "WorksheetSketchError";
  }
}

function admittedSketch(input: WorksheetSketch): WorksheetSketch {
  const sketch = readSketch(input);
  if (!sketch) throw new WorksheetSketchError();
  return sketch;
}

/** One disconnected subpath per stroke. A zero-length round-capped line retains a single dot. */
export function sketchPath(strokes: WorksheetSketch["strokes"]): string {
  const sketch = admittedSketch({ description: "", strokes });
  return sketch.strokes
    .map((stroke) =>
      stroke
        .map(
          (point, index) =>
            `${index === 0 ? "M" : "L"} ${point.x} ${point.y}${stroke.length === 1 ? ` L ${point.x} ${point.y}` : ""}`,
        )
        .join(" "),
    )
    .join(" ");
}

/** A complete text equivalent keeps every coordinate, even when the author gave no description. */
export function sketchText(input: WorksheetSketch): string {
  const sketch = admittedSketch(input);
  if (!sketch.description && !sketch.strokes.length) return "No drawing saved.";
  const lines = [`Description: ${sketch.description || "no description"}`];
  if (!sketch.strokes.length) lines.push("No drawing marks saved.");
  else {
    lines.push(
      `Drawing coordinates: x from 0 to ${SKETCH_LIMITS.width} left to right; y from 0 to ${SKETCH_LIMITS.height} top to bottom. These are drawing positions, not physical quantities.`,
    );
    for (const [index, stroke] of sketch.strokes.entries())
      lines.push(
        `Stroke ${index + 1}: ${stroke.map((point) => `(${point.x}, ${point.y})`).join(" → ")}`,
      );
  }
  return lines.join("\n");
}

function escapeMarkup(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Only admitted numeric geometry becomes markup; private words are escaped text in a static SVG. */
export function sketchSvg(input: WorksheetSketch): string {
  const sketch = admittedSketch(input);
  if (!sketch.strokes.length) return "";
  const description = sketch.description || "no description";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SKETCH_LIMITS.width} ${SKETCH_LIMITS.height}" role="img" aria-label="${escapeMarkup(`Your saved drawing: ${description}`)}" style="display:block;width:100%;height:auto;border:1px solid;break-inside:avoid"><title>Your saved drawing</title><desc>${escapeMarkup(description)}</desc><path d="${sketchPath(sketch.strokes)}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
