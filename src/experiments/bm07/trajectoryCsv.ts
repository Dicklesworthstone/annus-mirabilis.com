import { withinTolerance } from "../../units/tolerance.ts";

/** Local trajectory ingestion only: this module does not fit a physical model.
 * Adjacent positions from the same track define non-overlapping increments.
 * Units are explicit; no missing sample, coordinate, or calibration is invented.
 */
export const TRAJECTORY_LIMITS = Object.freeze({
  bytes: 262_144,
  rows: 10_065,
  tracks: 64,
  incrementCoordinates: 10_000,
});

export type TrajectoryUnits = Readonly<{
  time: "s" | "ms";
  position: "m" | "um" | "nm" | "px";
  micrometresPerPixel?: number;
}>;
export type TrajectoryPoint = Readonly<{
  track: string;
  time: number;
  coordinates: readonly number[];
  row: number;
}>;
export type ImportedTrajectory = Readonly<{
  kind: "user-supplied-trajectory";
  dimension: 1 | 2 | 3;
  units: TrajectoryUnits;
  points: readonly TrajectoryPoint[];
  trackCount: number;
  incrementCount: number;
  increments: readonly number[];
  /** Seconds; null means no common, adequately resolved observation interval. */
  dt: number | null;
  timingIssue: string | null;
}>;

export class TrajectoryImportError extends Error {
  readonly row: number | null;
  constructor(message: string, row: number | null = null) {
    super(row === null ? message : `CSV row ${row}: ${message}`);
    this.name = "TrajectoryImportError";
    this.row = row;
  }
}
const fail = (message: string, row: number | null = null): never => {
  throw new TrajectoryImportError(message, row);
};

/** Bounded RFC-4180-style reader. Quoted labels may contain commas/newlines;
 * stray quotes and ragged records fail instead of silently changing columns. */
function records(text: string): { fields: string[]; row: number }[] {
  if (
    text.length > TRAJECTORY_LIMITS.bytes ||
    new TextEncoder().encode(text).byteLength > TRAJECTORY_LIMITS.bytes
  ) {
    return fail(`The CSV must be at most ${TRAJECTORY_LIMITS.bytes} UTF-8 bytes.`);
  }
  const input = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows: { fields: string[]; row: number }[] = [];
  let fields: string[] = [],
    field = "",
    line = 1,
    start = 1;
  let quoted = false,
    closed = false,
    touched = false;
  function cell() {
    fields.push(field);
    if (fields.length > 5) fail("At most time, x, y, z and track columns are supported.", start);
    field = "";
    closed = false;
  }
  function record() {
    cell();
    if (touched || fields.length > 1 || fields[0]!.trim()) {
      rows.push({ fields, row: start });
      if (rows.length > TRAJECTORY_LIMITS.rows) fail("Too many CSV records.", start);
    }
    fields = [];
    touched = false;
  }
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        field += c;
        if (c === "\n") line++;
      }
      continue;
    }
    if (c === ",") {
      cell();
      touched = true;
    } else if (c === "\n") {
      record();
      line++;
      start = line;
    } else if (c === '"') {
      if (field.length || closed) fail("A quote must begin a field.", start);
      quoted = true;
      touched = true;
    } else {
      if (closed) fail("Unexpected text after a closing quote.", start);
      field += c;
      if (c.trim()) touched = true;
    }
  }
  if (quoted) fail("Unclosed quoted field.", start);
  if (field.length || fields.length || touched || closed) record();
  return rows;
}

const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function number(field: string, label: string, row: number): number {
  const text = field.trim();
  if (!decimal.test(text))
    return fail(`${label} must be a finite decimal number, not a blank or formula.`, row);
  const value = Number(text);
  if (!Number.isFinite(value)) return fail(`${label} is outside the finite numeric range.`, row);
  // Number("1e-999") becomes zero. It is not a measured zero.
  if (value === 0 && /[1-9]/.test(text.split(/[eE]/)[0]!)) {
    return fail(`${label} is too small to represent.`, row);
  }
  return value;
}
function scaled(value: number, scale: number, label: string, row: number): number {
  const result = value * scale;
  if (!Number.isFinite(result) || (value !== 0 && result === 0)) {
    return fail(`${label} cannot be represented in SI units.`, row);
  }
  return result === 0 ? 0 : result;
}
function unitScales(units: TrajectoryUnits): { time: number; position: number } {
  if (
    !units ||
    !["s", "ms"].includes(units.time) ||
    !["m", "um", "nm", "px"].includes(units.position)
  ) {
    return fail("Choose explicit time and position units.");
  }
  let position: number;
  switch (units.position) {
    case "m":
      position = 1;
      break;
    case "um":
      position = 1e-6;
      break;
    case "nm":
      position = 1e-9;
      break;
    case "px": {
      const calibration = units.micrometresPerPixel;
      if (typeof calibration !== "number" || !Number.isFinite(calibration) || calibration <= 0) {
        return fail(
          "Pixel coordinates require a positive independent calibration in micrometres per pixel.",
        );
      }
      position = calibration * 1e-6;
      if (!Number.isFinite(position) || position === 0)
        return fail("Pixel calibration cannot be represented in metres.");
    }
  }
  return { time: units.time === "s" ? 1 : 1e-3, position };
}

export function parseTrajectoryCsv(text: string, units: TrajectoryUnits): ImportedTrajectory {
  if (typeof text !== "string") return fail("Supply CSV text.");
  const scale = unitScales(units),
    rows = records(text);
  if (rows.length < 3) return fail("Provide a header and at least two positions.");
  let header = rows[0]!.fields.map((field) => field.trim().toLowerCase());
  const siLabels: Readonly<Record<string, string>> = {
    time_s: "time",
    x_m: "x",
    y_m: "y",
    z_m: "z",
    track_id: "track",
  };
  if (header.some((column) => Object.hasOwn(siLabels, column))) {
    if (units.time !== "s" || units.position !== "m") {
      return fail(
        "SI-labelled CSV requires seconds and metres; the declared units conflict with the header.",
        rows[0]!.row,
      );
    }
    if (header.some((column) => !Object.hasOwn(siLabels, column))) {
      return fail("Do not mix SI-labelled and unlabelled column names.", rows[0]!.row);
    }
    header = header.map((column) => siLabels[column]!);
  }
  if (new Set(header).size !== header.length) return fail("Duplicate column names.", rows[0]!.row);
  if (
    header.some((column) => !["time", "x", "y", "z", "track"].includes(column)) ||
    !header.includes("time") ||
    !header.includes("x") ||
    (header.includes("z") && !header.includes("y"))
  ) {
    return fail(
      "Use time,x with optional y, z and track columns. z requires y; no extra columns are silently discarded.",
      rows[0]!.row,
    );
  }
  const axes = [
    "x",
    ...(header.includes("y") ? ["y"] : []),
    ...(header.includes("z") ? ["z"] : []),
  ];
  const dimension = axes.length as 1 | 2 | 3;
  const timeColumn = header.indexOf("time"),
    trackColumn = header.indexOf("track");
  const points: TrajectoryPoint[] = [],
    increments: number[] = [];
  const previous = new Map<string, TrajectoryPoint>(),
    counts = new Map<string, number>();
  let firstDt: number | null = null,
    timingIssue: string | null = null;
  for (const { fields, row } of rows.slice(1)) {
    if (fields.length !== header.length)
      return fail(`Expected ${header.length} fields; found ${fields.length}.`, row);
    const track = trackColumn === -1 ? "1" : fields[trackColumn]!.trim();
    if (!track || track.length > 80 || /[\u0000-\u001F\u007F]/.test(track)) {
      return fail("Track IDs must contain 1–80 printable characters.", row);
    }
    if (!previous.has(track) && previous.size >= TRAJECTORY_LIMITS.tracks)
      return fail("At most 64 distinct tracks are supported.", row);
    const time = scaled(number(fields[timeColumn]!, "time", row), scale.time, "time", row);
    const coordinates = Object.freeze(
      axes.map((axis) =>
        scaled(number(fields[header.indexOf(axis)]!, axis, row), scale.position, axis, row),
      ),
    );
    const point = Object.freeze({ track, time, coordinates, row });
    const last = previous.get(track);
    if (last) {
      const dt = time - last.time;
      if (!Number.isFinite(dt) || dt <= 0)
        return fail(
          "Times must strictly increase within each track; timestamps are never sorted or deduplicated.",
          row,
        );
      // A large absolute epoch can make nominally equal intervals unresolvable.
      // Refuse an exact-interval interpretation rather than widening tolerance.
      const resolution = 8 * Number.EPSILON * Math.max(Math.abs(time), Math.abs(last.time));
      if (resolution > dt * 1e-7)
        timingIssue ??=
          "Timestamps are not sufficiently resolved. Use elapsed times relative to the recording start, not a large absolute epoch.";
      firstDt ??= dt;
      if (!withinTolerance(dt, firstDt, { relative: 1e-7, relativeTo: "larger" }).ok) {
        timingIssue ??=
          "The sampling interval differs within or between tracks. This equal-spacing inference model cannot analyze it; no samples were resampled or discarded.";
      }
      for (let c = 0; c < dimension; c++) {
        const displacement = coordinates[c]! - last.coordinates[c]!;
        if (!Number.isFinite(displacement))
          return fail("A displacement exceeds the finite numeric range.", row);
        increments.push(displacement);
      }
      if (increments.length > TRAJECTORY_LIMITS.incrementCoordinates)
        return fail(
          "At most 10000 displacement coordinates are supported. Import a smaller, explicitly selected recording.",
          row,
        );
    }
    previous.set(track, point);
    counts.set(track, (counts.get(track) ?? 0) + 1);
    points.push(point);
  }
  for (const [track, count] of counts) {
    if (count < 2)
      return fail(
        `Track ${JSON.stringify(track)} has only one position; no track is silently dropped.`,
      );
  }
  return Object.freeze({
    kind: "user-supplied-trajectory",
    dimension,
    units: Object.freeze({ ...units }),
    points: Object.freeze(points),
    trackCount: previous.size,
    incrementCount: increments.length / dimension,
    increments: Object.freeze(increments),
    dt: timingIssue ? null : firstDt,
    timingIssue,
  });
}

/** Numeric SI data only: omit untrusted labels so spreadsheets cannot execute
 * formula-like track IDs. Export IDs are deterministic 1-based integers. */
export function trajectorySiCsv(trajectory: ImportedTrajectory): string {
  const ids = new Map<string, number>();
  const axes = ["x_m", "y_m", "z_m"].slice(0, trajectory.dimension);
  const lines = [`track_id,time_s,${axes.join(",")}`];
  for (const point of trajectory.points) {
    if (!ids.has(point.track)) ids.set(point.track, ids.size + 1);
    lines.push([ids.get(point.track)!, point.time, ...point.coordinates].join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
