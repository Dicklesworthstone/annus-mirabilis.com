import {
  KITCHEN_COLUMNS,
  KITCHEN_LIMITS,
  KITCHEN_METADATA_KEYS,
  KITCHEN_SCHEMA_VERSION,
  type KitchenDocument,
  KitchenInputError,
  type KitchenPoint,
  kitchenNumber,
  type PointStatus,
  validateKitchenMetadata,
} from "./schema.ts";

/** Bounded RFC-4180 cells with physical line numbers, no eval and no permissive repair. */
function rows(text: string, firstLine: number): { cells: string[]; line: number }[] {
  const result: { cells: string[]; line: number }[] = [];
  let cells: string[] = [],
    cell = "",
    quoted = false,
    closed = false,
    line = firstLine,
    start = line;
  function endCell() {
    cells.push(cell);
    cell = "";
    closed = false;
    if (cells.length > KITCHEN_COLUMNS.length)
      throw new KitchenInputError(start, "columns", "too many columns.");
  }
  function endRow() {
    endCell();
    if (!(cells.length === 1 && cells[0] === "")) result.push({ cells, line: start });
    if (result.length > KITCHEN_LIMITS.rows + 1)
      throw new KitchenInputError(
        start,
        "rows",
        `at most ${KITCHEN_LIMITS.rows} observations are supported.`,
      );
    cells = [];
    start = line + 1;
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === undefined) break;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        cell += c;
        if (c === "\n") line++;
      }
    } else if (c === '"') {
      if (cell || closed)
        throw new KitchenInputError(
          line,
          "CSV",
          "a quote must begin a field or be doubled inside a quoted field.",
        );
      quoted = true;
    } else if (c === ",") endCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
    } else {
      if (closed)
        throw new KitchenInputError(line, "CSV", "unexpected characters after a closing quote.");
      cell += c;
    }
    if (cell.length > KITCHEN_LIMITS.cell)
      throw new KitchenInputError(line, "cell", "this cell exceeds the text limit.");
  }
  if (quoted) throw new KitchenInputError(start, "CSV", "the quoted field is not closed.");
  if (cell || closed || cells.length) endRow();
  return result;
}
const unprotect = (s: string) => (/^'[=+\-@'\t\r]/.test(s) ? s.slice(1) : s);
const protect = (s: string) => (/^[=+\-@'\t\r]/.test(s) ? `'${s}` : s);
function hasForbiddenControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      return true;
    }
  }
  return false;
}

function safeText(raw: string, field: string, line: number, max = 200): string {
  const s = unprotect(raw);
  if (s.length > max || hasForbiddenControlChar(s))
    throw new KitchenInputError(
      line,
      field,
      `use at most ${max} text characters and no control codes.`,
    );
  return s;
}
export function parseKitchenCsv(text: string): KitchenDocument {
  if (
    typeof text !== "string" ||
    text.length > KITCHEN_LIMITS.bytes ||
    new TextEncoder().encode(text).length > KITCHEN_LIMITS.bytes
  )
    throw new KitchenInputError(0, "file", "the CSV must be at most 2 MiB.");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const metadata: Record<string, string> = Object.create(null),
    notes: string[] = [];
  let offset = 0,
    firstLine = 1;
  while (offset < text.length) {
    const end = text.indexOf("\n", offset),
      next = end < 0 ? text.length : end + 1;
    const line = text.slice(offset, end < 0 ? undefined : end).replace(/\r$/, "");
    if (!line.trim()) {
      offset = next;
      firstLine++;
      continue;
    }
    if (!line.startsWith("# ")) break;
    const equal = line.indexOf("=", 2);
    if (equal < 0) throw new KitchenInputError(firstLine, "metadata", "use # key=value.");
    const key = line.slice(2, equal);
    if (
      !(
        [
          ...KITCHEN_METADATA_KEYS,
          "pixels_per_um",
          "pixels_per_um_uncertainty",
        ] as readonly string[]
      ).includes(key)
    )
      throw new KitchenInputError(firstLine, key, "unknown metadata key.");
    if (Object.hasOwn(metadata, key))
      throw new KitchenInputError(firstLine, key, "duplicate metadata declaration.");
    metadata[key] = safeText(line.slice(equal + 1), key, firstLine, 512);
    offset = next;
    firstLine++;
  }
  if (Object.hasOwn(metadata, "pixels_per_um")) {
    if (
      [
        "pixels_per_um_x",
        "pixels_per_um_y",
        "pixels_per_um_x_uncertainty",
        "pixels_per_um_y_uncertainty",
      ].some((k) => Object.hasOwn(metadata, k))
    )
      throw new KitchenInputError(0, "calibration", "do not mix deprecated and per-axis scales.");
    const deprecatedScale = metadata.pixels_per_um ?? "";
    metadata.pixels_per_um_x = metadata.pixels_per_um_y = deprecatedScale;
    metadata.pixels_per_um_x_uncertainty = metadata.pixels_per_um_y_uncertainty =
      metadata.pixels_per_um_uncertainty ?? "";
    metadata.calibration_axes = "both";
    delete metadata.pixels_per_um;
    delete metadata.pixels_per_um_uncertainty;
    notes.push(
      "Imported the deprecated single scale as equal scales on both axes. Verify that this matches the recording.",
    );
  } else if (Object.hasOwn(metadata, "pixels_per_um_uncertainty"))
    throw new KitchenInputError(
      0,
      "pixels_per_um_uncertainty",
      "a deprecated uncertainty needs its deprecated scale.",
    );
  const parsed = rows(text.slice(offset), firstLine);
  const header = parsed.shift();
  if (!header || header.cells.join(",") !== KITCHEN_COLUMNS.join(","))
    throw new KitchenInputError(
      header?.line ?? firstLine,
      "columns",
      `use these columns in order: ${KITCHEN_COLUMNS.join(", ")}.`,
    );
  if (!parsed.length)
    throw new KitchenInputError(firstLine, "observations", "include at least one observation.");
  const points: KitchenPoint[] = [],
    last = new Map<string, { time: number; lost: boolean }>();
  const choice = <T extends string>(
    s: string,
    choices: readonly T[],
    field: string,
    line: number,
  ): T => {
    if (!choices.includes(s as T))
      throw new KitchenInputError(line, field, `choose ${choices.join(", ")}.`);
    return s as T;
  };
  for (const { cells: c, line } of parsed) {
    if (c.length !== KITCHEN_COLUMNS.length)
      throw new KitchenInputError(line, "columns", "every row must have exactly twelve cells.");
    const [
      c0 = "",
      c1 = "",
      c2 = "",
      c3 = "",
      c4 = "",
      c5 = "",
      c6 = "",
      c7 = "",
      c8 = "",
      c9 = "",
      c10 = "",
      c11 = "",
    ] = c;
    if (c0 !== KITCHEN_SCHEMA_VERSION)
      throw new KitchenInputError(
        line,
        "schema_version",
        `this importer reads schema ${KITCHEN_SCHEMA_VERSION}.`,
      );
    const kind = choice(c1, ["particle", "stationary", "calibration"] as const, "kind", line);
    const objectId = safeText(c2, "object_id", line, 80),
      calibrationId = safeText(c10, "calibration_id", line, 80);
    if (!objectId.trim() || !calibrationId.trim())
      throw new KitchenInputError(
        line,
        "identity",
        "object_id and calibration_id must not be empty.",
      );
    const time = kitchenNumber(c3, "frame_time_s", line);
    if (time < 0 || time > KITCHEN_LIMITS.duration)
      throw new KitchenInputError(line, "frame_time_s", "use actual times from 0 to 600 seconds.");
    const status = choice<PointStatus>(
      c8,
      ["measured", "interpolated", "excluded", "lost"],
      "point_status",
      line,
    );
    const lossReason = choice(c7, ["", "edge", "focus", "occluded"] as const, "loss_reason", line);
    const exclusionReason = safeText(c9, "exclusion_reason", line);
    if (c6 !== (status === "lost" ? "1" : "0") || (status === "lost") !== (lossReason !== ""))
      throw new KitchenInputError(line, "lost", "lost, point_status and loss_reason must agree.");
    if ((status === "excluded") !== !!exclusionReason.trim())
      throw new KitchenInputError(
        line,
        "exclusion_reason",
        "give a reason for an excluded point only; keep its coordinates.",
      );
    const coordinate = (s: string, axis: string) => {
      if (!s && status === "lost") return null;
      const n = kitchenNumber(s, axis, line);
      if (Math.abs(n) > KITCHEN_LIMITS.coordinates)
        throw new KitchenInputError(
          line,
          axis,
          "coordinates must be within ±100000 source pixels.",
        );
      return n;
    };
    const x = coordinate(c4, "x_px"),
      y = coordinate(c5, "y_px");
    const identityDecision = choice(
      c11,
      ["", "reacquired-same", "new-object"] as const,
      "identity_decision",
      line,
    );
    const key = JSON.stringify([kind, objectId]),
      previous = last.get(key);
    if (previous && time <= previous.time)
      throw new KitchenInputError(
        line,
        "frame_time_s",
        "times must strictly increase within each object; duplicates are not allowed.",
      );
    if (previous?.lost && status !== "lost" && !identityDecision)
      throw new KitchenInputError(
        line,
        "identity_decision",
        "choose reacquired-same or new-object after losing this label.",
      );
    if (identityDecision && (!previous?.lost || status === "lost"))
      throw new KitchenInputError(
        line,
        "identity_decision",
        "an identity decision belongs on the first point after a loss.",
      );
    if (kind !== "particle" && (status !== "measured" || identityDecision))
      throw new KitchenInputError(
        line,
        "point_status",
        "stationary and calibration rows must be measured, independent clicks.",
      );
    last.set(key, { time, lost: status === "lost" });
    points.push(
      Object.freeze({
        kind,
        objectId,
        time,
        x,
        y,
        status,
        lossReason,
        exclusionReason,
        calibrationId,
        identityDecision,
      }),
    );
  }
  return Object.freeze({
    schemaVersion: 2,
    metadata: validateKitchenMetadata(metadata),
    points: Object.freeze(points),
    notes: Object.freeze(notes),
  });
}
const cell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
export function exportKitchenCsv(document: KitchenDocument): string {
  const lines = KITCHEN_METADATA_KEYS.map((k) => `# ${k}=${protect(document.metadata[k])}`);
  if (lines.some((line) => /[\r\n]/.test(line)))
    throw new KitchenInputError(0, "metadata", "metadata values cannot contain newlines.");
  lines.push(KITCHEN_COLUMNS.join(","));
  for (const p of document.points)
    lines.push(
      [
        KITCHEN_SCHEMA_VERSION,
        p.kind,
        protect(p.objectId),
        String(p.time),
        p.x === null ? "" : String(p.x),
        p.y === null ? "" : String(p.y),
        p.status === "lost" ? "1" : "0",
        p.lossReason,
        p.status,
        protect(p.exclusionReason),
        protect(p.calibrationId),
        p.identityDecision,
      ]
        .map(cell)
        .join(","),
    );
  const csv = `${lines.join("\n")}\n`;
  // Exports are admitted by exactly the same closed schema as classroom imports.
  parseKitchenCsv(csv);
  return csv;
}
