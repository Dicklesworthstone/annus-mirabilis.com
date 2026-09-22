/** The live shelf previews use modern SI calibration, not a verified 1904 dataset.
 * Bounds describe the instrument's supported range, not universal physical limits.
 * Bead: am-disc-shelf-michelson-fizeau-dauq.
 */
export const SHELF_IDS = [
  "shelf-michelson-morley",
  "shelf-fizeau",
  "shelf-maxwell-galilean",
] as const;
export type ShelfId = (typeof SHELF_IDS)[number];
export type ShelfParameters =
  | Readonly<{ instrumentId: "shelf-michelson-morley"; armLength: number; wavelength: number; beta: number }>
  | Readonly<{ instrumentId: "shelf-fizeau"; waterPathPerBeam: number; waterSpeed: number; refractiveIndex: number; wavelength: number; reversal: boolean; showLater: boolean }>
  | Readonly<{ instrumentId: "shelf-maxwell-galilean"; beta: number; wavenumber: number }>;
export type ShelfField = Readonly<{ key: string; label: string; unit: string; min: number; max: number }>;
export type ShelfDefinition = Readonly<{
  title: string;
  question: string;
  fields: readonly ShelfField[];
  switches: readonly Readonly<{ key: string; label: string }>[];
  defaults: ShelfParameters;
}>;

export const SHELF_DEFINITIONS: Readonly<Record<ShelfId, ShelfDefinition>> = {
  "shelf-michelson-morley": {
    title: "Michelson–Morley: what does a null result decide?",
    question: "Hold the apparatus fixed and compare the predicted rotation shift with and without longitudinal contraction.",
    fields: [
      { key: "armLength", label: "Equal one-way arm length", unit: "m", min: 0.001, max: 100 },
      { key: "wavelength", label: "Vacuum wavelength", unit: "m", min: 1e-9, max: 0.001 },
      { key: "beta", label: "Signed ether-wind speed divided by c", unit: "1", min: -0.95, max: 0.95 },
    ],
    switches: [],
    defaults: { instrumentId: "shelf-michelson-morley", armLength: 11, wavelength: 5.5e-7, beta: 1e-4 },
  },
  "shelf-fizeau": {
    title: "Fizeau: compare three drag hypotheses",
    question: "Which predictions change when the flow reverses, and how do no drag, full drag and Fresnel drag differ?",
    fields: [
      { key: "waterPathPerBeam", label: "Total moving-water path per beam", unit: "m", min: 0.001, max: 100 },
      { key: "waterSpeed", label: "Signed water speed", unit: "m/s", min: -100, max: 100 },
      { key: "refractiveIndex", label: "Assumed refractive index", unit: "1", min: 1, max: 2 },
      { key: "wavelength", label: "Vacuum wavelength", unit: "m", min: 1e-9, max: 0.001 },
    ],
    switches: [
      { key: "reversal", label: "Compare opposite flow directions (flow reversal)" },
      { key: "showLater", label: "Show the separately labeled later relativistic speed comparison" },
    ],
    defaults: { instrumentId: "shelf-fizeau", waterPathPerBeam: 3, waterSpeed: 7, refractiveIndex: 1.333, wavelength: 5.5e-7, reversal: false, showLater: false },
  },
  "shelf-maxwell-galilean": {
    title: "Does the wave equation keep its form?",
    question: "Apply two coordinate substitutions to the same forward-travelling plane wave and compare the analytic residuals.",
    fields: [
      { key: "beta", label: "Signed frame speed divided by c", unit: "1", min: -0.95, max: 0.95 },
      { key: "wavenumber", label: "Angular wavenumber k", unit: "rad/m", min: 0.001, max: 1e6 },
    ],
    switches: [],
    defaults: { instrumentId: "shelf-maxwell-galilean", beta: 0.1, wavenumber: 1 },
  },
};

export type ShelfDraft = Readonly<Record<string, string | boolean>>;
export type ShelfParse =
  | Readonly<{ kind: "parameters"; parameters: ShelfParameters }>
  | Readonly<{ kind: "refused"; message: string }>;

export function isShelfId(value: unknown): value is ShelfId {
  return typeof value === "string" && SHELF_IDS.some((id) => id === value);
}

export function shelfDraft(parameters: ShelfParameters): ShelfDraft {
  return Object.fromEntries(Object.entries(parameters).filter(([key]) => key !== "instrumentId")
    .map(([key, value]) => [key, typeof value === "boolean" ? value : String(value)]));
}

/** Accept decimal/scientific notation, not blank strings, hex, coercible objects or infinities. */
function decimal(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.length > 80) return null;
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function parseShelfParameters(id: ShelfId, raw: unknown): ShelfParse {
  if (!isShelfId(id) || !raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: "refused", message: "Choose a known shelf instrument and a settings object." };
  }
  const data = raw as Record<string, unknown>;
  const definition = SHELF_DEFINITIONS[id];
  const allowed = ["instrumentId", ...definition.fields.map((field) => field.key), ...definition.switches.map((field) => field.key)];
  if (Object.keys(data).some((key) => !allowed.includes(key)) ||
      (Object.hasOwn(data, "instrumentId") && data.instrumentId !== id)) {
    return { kind: "refused", message: "These settings include unknown fields or belong to a different instrument." };
  }
  const values: Record<string, number> = {};
  for (const field of definition.fields) {
    const value = Object.hasOwn(data, field.key) ? decimal(data[field.key]) : null;
    if (value === null || value < field.min || value > field.max) {
      return { kind: "refused", message: `${field.label} must be a finite decimal between ${field.min} and ${field.max} ${field.unit}. The previous calculation is unchanged.` };
    }
    values[field.key] = value;
  }
  for (const field of definition.switches) {
    if (!Object.hasOwn(data, field.key) || typeof data[field.key] !== "boolean") {
      return { kind: "refused", message: `${field.label} must be explicitly on or off.` };
    }
  }
  // The field loop proved every numeric value is present; no extra input keys survive.
  const number = (key: string): number => {
    const value = values[key];
    if (value === undefined) throw new Error(`Missing declared shelf field: ${key}`);
    return value;
  };
  let parameters: ShelfParameters;
  switch (id) {
    case "shelf-michelson-morley":
      parameters = { instrumentId: id, armLength: number("armLength"), wavelength: number("wavelength"), beta: number("beta") };
      break;
    case "shelf-fizeau":
      parameters = { instrumentId: id, waterPathPerBeam: number("waterPathPerBeam"), waterSpeed: number("waterSpeed"), refractiveIndex: number("refractiveIndex"), wavelength: number("wavelength"), reversal: data.reversal === true, showLater: data.showLater === true };
      break;
    case "shelf-maxwell-galilean":
      parameters = { instrumentId: id, beta: number("beta"), wavenumber: number("wavenumber") };
      break;
  }
  return { kind: "parameters", parameters: Object.freeze(parameters) };
}
