import {
  KITCHEN_COLUMNS,
  KITCHEN_FRAME_COLUMNS,
  KITCHEN_LIMITS,
  KITCHEN_METADATA_KEYS,
  KITCHEN_SCHEMA_VERSION,
  type KitchenDocument,
  type KitchenFrameStamp,
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
    if (cells.length > KITCHEN_COLUMNS.length + KITCHEN_FRAME_COLUMNS.length)
      throw new KitchenInputError("csv-shape-invalid", start, "columns", "too many columns.");
  }
  function endRow() {
    endCell();
    if (!(cells.length === 1 && cells[0] === "")) result.push({ cells, line: start });
    if (result.length > KITCHEN_LIMITS.rows + 1)
      throw new KitchenInputError("kitchen-input-invalid", 
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
        throw new KitchenInputError("kitchen-input-invalid", 
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
        throw new KitchenInputError("csv-shape-invalid", line, "CSV", "unexpected characters after a closing quote.");
      cell += c;
    }
    if (cell.length > KITCHEN_LIMITS.cell)
      throw new KitchenInputError("csv-shape-invalid", line, "cell", "this cell exceeds the text limit.");
  }
  if (quoted) throw new KitchenInputError("csv-shape-invalid", start, "CSV", "the quoted field is not closed.");
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
    throw new KitchenInputError("kitchen-input-invalid", 
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
    throw new KitchenInputError("csv-shape-invalid", 0, "file", "the CSV must be at most 2 MiB.");
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
    if (equal < 0) throw new KitchenInputError("metadata-invalid", firstLine, "metadata", "use # key=value.");
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
      throw new KitchenInputError("metadata-invalid", firstLine, key, "unknown metadata key.");
    if (Object.hasOwn(metadata, key))
      throw new KitchenInputError("metadata-invalid", firstLine, key, "duplicate metadata declaration.");
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
      throw new KitchenInputError("observations-inconsistent", 0, "calibration", "do not mix deprecated and per-axis scales.");
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
    throw new KitchenInputError("kitchen-input-invalid", 
      0,
      "pixels_per_um_uncertainty",
      "a deprecated uncertainty needs its deprecated scale.",
    );
  const parsed = rows(text.slice(offset), firstLine);
  const header = parsed.shift();
  const withFrames =
    header?.cells.join(",") === [...KITCHEN_COLUMNS, ...KITCHEN_FRAME_COLUMNS].join(",");
  if (!header || (!withFrames && header.cells.join(",") !== KITCHEN_COLUMNS.join(",")))
    throw new KitchenInputError("kitchen-input-invalid", 
      header?.line ?? firstLine,
      "columns",
      `use these columns in order: ${KITCHEN_COLUMNS.join(", ")}.`,
    );
  if (!parsed.length)
    throw new KitchenInputError("observation-incomplete", firstLine, "observations", "include at least one observation.");
  const admittedMetadata = validateKitchenMetadata(metadata);
  const frames = new Map<number, string>();
  const points: KitchenPoint[] = [],
    last = new Map<string, { time: number; lost: boolean }>();
  const choice = <T extends string>(
    s: string,
    choices: readonly T[],
    field: string,
    line: number,
  ): T => {
    if (!choices.includes(s as T))
      throw new KitchenInputError("kitchen-input-invalid", line, field, `choose ${choices.join(", ")}.`);
    return s as T;
  };
  for (const { cells: c, line } of parsed) {
    if (c.length !== KITCHEN_COLUMNS.length + (withFrames ? KITCHEN_FRAME_COLUMNS.length : 0))
      throw new KitchenInputError("csv-shape-invalid", 
        line,
        "columns",
        "each row must have exactly the columns declared in its header.",
      );
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
      throw new KitchenInputError("kitchen-input-invalid", 
        line,
        "schema_version",
        `this importer reads schema ${KITCHEN_SCHEMA_VERSION}.`,
      );
    const kind = choice(c1, ["particle", "stationary", "calibration"] as const, "kind", line);
    const objectId = safeText(c2, "object_id", line, 80),
      calibrationId = safeText(c10, "calibration_id", line, 80);
    if (!objectId.trim() || !calibrationId.trim())
      throw new KitchenInputError("kitchen-input-invalid", 
        line,
        "identity",
        "object_id and calibration_id must not be empty.",
      );
    const time = kitchenNumber(c3, "frame_time_s", line);
    if (time < 0 || time > KITCHEN_LIMITS.duration)
      throw new KitchenInputError("observation-incomplete", line, "frame_time_s", "use actual times from 0 to 600 seconds.");
    const status = choice<PointStatus>(
      c8,
      ["measured", "interpolated", "excluded", "lost"],
      "point_status",
      line,
    );
    const lossReason = choice(c7, ["", "edge", "focus", "occluded"] as const, "loss_reason", line);
    const exclusionReason = safeText(c9, "exclusion_reason", line);
    if (c6 !== (status === "lost" ? "1" : "0") || (status === "lost") !== (lossReason !== ""))
      throw new KitchenInputError("observations-inconsistent", line, "lost", "lost, point_status and loss_reason must agree.");
    if ((status === "excluded") !== !!exclusionReason.trim())
      throw new KitchenInputError("kitchen-input-invalid", 
        line,
        "exclusion_reason",
        "give a reason for an excluded point only; keep its coordinates.",
      );
    const coordinate = (s: string, axis: string) => {
      if (!s && status === "lost") return null;
      const n = kitchenNumber(s, axis, line);
      if (Math.abs(n) > KITCHEN_LIMITS.coordinates)
        throw new KitchenInputError("kitchen-input-invalid", 
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
    // Repeated clicks on one paused stationary feature or calibration mark share
    // its real frame time. Never manufacture later times to fit the CSV contract.
    if (previous && (time < previous.time || (kind === "particle" && time === previous.time)))
      throw new KitchenInputError("kitchen-input-invalid", 
        line,
        "frame_time_s",
        "particle times must strictly increase; stationary/calibration times may repeat but not go backwards.",
      );
    if (previous?.lost && status !== "lost" && !identityDecision)
      throw new KitchenInputError("kitchen-input-invalid", 
        line,
        "identity_decision",
        "choose reacquired-same or new-object after losing this label.",
      );
    if (identityDecision && (!previous?.lost || status === "lost"))
      throw new KitchenInputError("kitchen-input-invalid", 
        line,
        "identity_decision",
        "an identity decision belongs on the first point after a loss.",
      );
    if (kind !== "particle" && (status !== "measured" || identityDecision))
      throw new KitchenInputError("kitchen-input-invalid", 
        line,
        "point_status",
        "stationary and calibration rows must be measured, independent clicks.",
      );
    let capture: KitchenFrameStamp | undefined;
    if (withFrames && c.slice(12).some((value) => value !== "")) {
      if (c.slice(12).length !== 4)
        throw new KitchenInputError("observation-incomplete", line, "capture", "incomplete frame stamp.");
      const requestedTime = kitchenNumber(c[12] ?? "", "requested_time_s", line);
      const timingSource = choice(
        c[13] ?? "",
        ["frame-callback", "frame-callback-adjusted", "declared-rate"] as const,
        "timing_source",
        line,
      );
      const presentedFrames =
        c[14] === "" ? null : kitchenNumber(c[14] ?? "", "presented_frames", line);
      const frameId = kitchenNumber(c[15] ?? "", "frame_id", line);
      if (
        requestedTime < 0 ||
        requestedTime > KITCHEN_LIMITS.duration ||
        !Number.isSafeInteger(frameId) ||
        frameId < 1 ||
        frameId > 2000 ||
        (presentedFrames !== null &&
          (!Number.isSafeInteger(presentedFrames) || presentedFrames < 1)) ||
        (timingSource === "declared-rate") !== (presentedFrames === null)
      )
        throw new KitchenInputError("kitchen-input-invalid", 
          line,
          "capture",
          "invalid frame identity, time or timing provenance.",
        );
      const adjusted =
        Math.abs(time - requestedTime) > 0.5 / Number(admittedMetadata.frame_rate_hz);
      if (
        (timingSource === "frame-callback" && adjusted) ||
        (timingSource === "frame-callback-adjusted" && !adjusted) ||
        (timingSource === "declared-rate" && admittedMetadata.timing_source !== "declared-rate")
      )
        throw new KitchenInputError("kitchen-input-invalid", 
          line,
          "capture",
          "timing provenance disagrees with the actual/requested times or the file declaration.",
        );
      const signature = JSON.stringify([time, requestedTime, timingSource, presentedFrames]);
      if (frames.has(frameId) && frames.get(frameId) !== signature)
        throw new KitchenInputError("kitchen-input-invalid", 
          line,
          "frame_id",
          "one acquired frame cannot have conflicting times or provenance.",
        );
      frames.set(frameId, signature);
      capture = Object.freeze({ requestedTime, timingSource, presentedFrames, frameId });
    }
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
        ...(capture ? { capture } : {}),
      }),
    );
  }
  return Object.freeze({
    schemaVersion: 2,
    metadata: admittedMetadata,
    points: Object.freeze(points),
    notes: Object.freeze(notes),
  });
}
const cell = (s: string) => (/[,"\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
export function exportKitchenCsv(document: KitchenDocument): string {
  const lines = KITCHEN_METADATA_KEYS.map((k) => `# ${k}=${protect(document.metadata[k])}`);
  if (lines.some((line) => /[\r\n]/.test(line)))
    throw new KitchenInputError("metadata-invalid", 0, "metadata", "metadata values cannot contain newlines.");
  const withFrames = document.points.some((point) => point.capture);
  lines.push([...KITCHEN_COLUMNS, ...(withFrames ? KITCHEN_FRAME_COLUMNS : [])].join(","));
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
        ...(withFrames
          ? p.capture
            ? [
                String(p.capture.requestedTime),
                p.capture.timingSource,
                p.capture.presentedFrames === null ? "" : String(p.capture.presentedFrames),
                String(p.capture.frameId),
              ]
            : ["", "", "", ""]
          : []),
      ]
        .map(cell)
        .join(","),
    );
  const csv = `${lines.join("\n")}\n`;
  // Exports are admitted by exactly the same closed schema as classroom imports.
  parseKitchenCsv(csv);
  return csv;
}
