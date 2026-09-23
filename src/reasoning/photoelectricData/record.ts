/** Bounded, numeric-only CSV. The header declares units; magnitudes never guess them.
 * Reading files and downloading reports are local browser actions, not data uploads.
 */
export const RECORD_BYTE_LIMIT = 131072;
export const RECORD_ROW_LIMIT = 1000;
export type FrequencyColumn = "frequency_THz" | "frequency_Hz" | "wavelength_nm";
export type VoltageRow = Readonly<{
  row: number;
  frequencyTHz: number;
  stoppingV: number;
  sigmaV?: number;
}>;
export type VoltageRecord = Readonly<{
  column: FrequencyColumn;
  hasSigma: boolean;
  rows: readonly VoltageRow[];
}>;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/u;
/** A refused record or analysis draft. The code is the stable identity, first so the refusal
 * scanner reads it at the throw; the message is what a reader sees, unchanged. */
export class PhotoelectricRecordError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PhotoelectricRecordError";
    this.code = code;
  }
}
function number(token: string, line: number): number {
  if (!NUMBER.test(token))
    throw new PhotoelectricRecordError(
      "record-number-invalid",
      `Line ${line}: expected a finite decimal number, not a blank, formula or non-detection.`,
    );
  const value = Number(token);
  if (!Number.isFinite(value))
    throw new PhotoelectricRecordError(
      "record-number-not-finite",
      `Line ${line}: number is not finite.`,
    );
  return value;
}
function cells(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((token) => {
    const text = token.trim();
    return /^"[^"\r\n]*"$/u.test(text) ? text.slice(1, -1).trim() : text;
  });
}
export function parseVoltageCsv(text: string, speedOfLight: number): VoltageRecord {
  if (
    typeof text !== "string" ||
    text.length > RECORD_BYTE_LIMIT ||
    new TextEncoder().encode(text).byteLength > RECORD_BYTE_LIMIT
  ) {
    throw new PhotoelectricRecordError(
      "record-too-large",
      "The CSV exceeds the 128 KiB local-file limit.",
    );
  }
  if (!Number.isFinite(speedOfLight) || speedOfLight <= 0)
    throw new PhotoelectricRecordError(
      "record-light-speed-invalid",
      "A declared positive light-speed calibration is required.",
    );
  const lines = text.replace(/^\uFEFF/u, "").split(/\r\n|\n|\r/u);
  const first = lines.findIndex((line) => line.trim() !== "");
  if (first < 0)
    throw new PhotoelectricRecordError(
      "record-blank",
      "Paste a header and at least three measured stopping potentials.",
    );
  const delimiter = lines[first]!.includes("\t") ? "\t" : ",";
  const header = cells(lines[first]!, delimiter);
  if (
    !["frequency_THz", "frequency_Hz", "wavelength_nm"].includes(header[0] ?? "") ||
    header[1] !== "stopping_V" ||
    !(header.length === 2 || (header.length === 3 && header[2] === "sigma_V"))
  ) {
    throw new PhotoelectricRecordError(
      "record-header-invalid",
      "Use frequency_THz,stopping_V (or frequency_Hz / wavelength_nm), optionally followed by sigma_V. No other columns are inferred.",
    );
  }
  const column = header[0] as FrequencyColumn;
  const hasSigma = header.length === 3;
  const rows: VoltageRow[] = [];
  for (let i = first + 1; i < lines.length; i++) {
    if (!lines[i]!.trim()) continue;
    if (rows.length >= RECORD_ROW_LIMIT)
      throw new PhotoelectricRecordError("record-too-many-rows", "Use at most 1000 observations.");
    const values = cells(lines[i]!, delimiter);
    if (values.length !== header.length)
      throw new PhotoelectricRecordError(
        "record-field-count",
        `Line ${i + 1}: expected ${header.length} numeric fields.`,
      );
    const x = number(values[0]!, i + 1);
    if (x <= 0)
      throw new PhotoelectricRecordError(
        "record-axis-not-positive",
        `Line ${i + 1}: frequency or wavelength must be positive.`,
      );
    const frequencyTHz =
      column === "frequency_THz"
        ? x
        : column === "frequency_Hz"
          ? x / 1e12
          : speedOfLight / (x * 1e3);
    const stoppingV = number(values[1]!, i + 1);
    if (frequencyTHz < 1e-6 || frequencyTHz > 1e6 || Math.abs(stoppingV) > 1e4) {
      throw new PhotoelectricRecordError(
        "record-out-of-range",
        `Line ${i + 1}: admitted range is 10⁻⁶ to 10⁶ THz and ±10000 V. Check the units.`,
      );
    }
    let sigmaV: number | undefined;
    if (hasSigma) {
      sigmaV = number(values[2]!, i + 1);
      if (sigmaV < 1e-9 || sigmaV > 1e4)
        throw new PhotoelectricRecordError(
          "record-sigma-out-of-range",
          `Line ${i + 1}: sigma_V must be between 10⁻⁹ and 10000 V.`,
        );
    }
    rows.push(
      Object.freeze({
        row: rows.length + 1,
        frequencyTHz,
        stoppingV,
        ...(sigmaV !== undefined ? { sigmaV } : {}),
      }),
    );
  }
  if (rows.length < 3)
    throw new PhotoelectricRecordError(
      "record-too-few-rows",
      "Use at least three observations; two points cannot estimate residual scatter.",
    );
  return Object.freeze({ column, hasSigma, rows: Object.freeze(rows) });
}

export type LocalFile = Readonly<{ size: number; text(): Promise<string> }>;
/** A superseded success OR rejection cannot replace a later selection or edited draft. */
export function createVoltageFileReader() {
  let generation = 0;
  return {
    cancel() {
      generation++;
    },
    async read(
      file: LocalFile,
    ): Promise<
      { kind: "text"; text: string } | { kind: "invalid"; message: string } | { kind: "stale" }
    > {
      const token = ++generation;
      if (!Number.isFinite(file.size) || file.size < 0 || file.size > RECORD_BYTE_LIMIT)
        return { kind: "invalid", message: "The CSV exceeds the 128 KiB local-file limit." };
      try {
        const text = await file.text();
        if (token !== generation) return { kind: "stale" };
        if (
          text.length > RECORD_BYTE_LIMIT ||
          new TextEncoder().encode(text).byteLength > RECORD_BYTE_LIMIT
        )
          return { kind: "invalid", message: "The CSV exceeds the 128 KiB local-file limit." };
        return { kind: "text", text };
      } catch {
        return token !== generation
          ? { kind: "stale" }
          : {
              kind: "invalid",
              message: "The file could not be read. The accepted analysis is unchanged.",
            };
      }
    },
  };
}
