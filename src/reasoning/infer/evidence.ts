import { parseResult } from "../../experiments/results/codec.ts";
import { parseU64 } from "../../physics/reference/philox.ts";

/** A bounded projection of BUILT-IN observations. Generator truth is not an inverse input. */
export type InferenceEvidence = Readonly<{
  schemaVersion: 1; kind: "ideal" | "camera"; sourceDigest: string; observationDigest: string;
  seed: string; dt: number; d: number; T: number; eta: number; exposure: number; knownDrift: number;
  increments: readonly number[];
}>;
export type EncodedEvidenceSource = Readonly<{
  sourceDigest: string; parameters: Readonly<Record<string, unknown>>; results: readonly string[];
}>;
const keys = ["schemaVersion", "kind", "sourceDigest", "observationDigest", "seed", "dt", "d", "T", "eta", "exposure", "knownDrift", "increments"];
export function parseInferenceEvidence(input: unknown): InferenceEvidence {
  if (!input || typeof input !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(input)))
    throw new TypeError("Expected an inference evidence record.");
  const data = input as Record<string, unknown>;
  if (Reflect.ownKeys(data).length !== keys.length || Reflect.ownKeys(data).some((key) => typeof key !== "string" || !keys.includes(key)) ||
      keys.some((key) => !Object.hasOwn(Object.getOwnPropertyDescriptor(data, key) ?? {}, "value")))
    throw new TypeError("Evidence fields must be known data fields.");
  if (data.schemaVersion !== 1 || !["ideal", "camera"].includes(String(data.kind)) ||
      typeof data.sourceDigest !== "string" || !/^source:sha256:[a-f0-9]{64}$/u.test(data.sourceDigest) ||
      typeof data.observationDigest !== "string" || !/^[a-f0-9]{64}$/u.test(data.observationDigest) || typeof data.seed !== "string")
    throw new TypeError("Evidence has unsupported or missing provenance.");
  parseU64(data.seed);
  for (const key of ["dt", "T", "eta"])
    if (typeof data[key] !== "number" || !Number.isFinite(data[key]) || data[key] <= 0)
      throw new TypeError("Evidence timing and conditions must be positive finite scalars.");
  if (typeof data.d !== "number" || ![1, 2].includes(data.d) ||
      typeof data.knownDrift !== "number" || !Number.isFinite(data.knownDrift) ||
      typeof data.exposure !== "number" || !Number.isFinite(data.exposure) || data.exposure < 0 || data.exposure > (data.dt as number) ||
      !Array.isArray(data.increments) || data.increments.length < 6 * data.d || data.increments.length > 6000 ||
      data.increments.length % (2 * data.d) !== 0 ||
      Array.from(data.increments).some((value) => typeof value !== "number" || !Number.isFinite(value)))
    throw new TypeError("Evidence requires bounded, paired, finite observations on a declared camera grid.");
  if (data.kind === "ideal" && (data.exposure !== 0 || data.knownDrift !== 0))
    throw new TypeError("The ideal inverse case requires unblurred, known-zero-drift increments.");
  return Object.freeze({ ...data, increments: Object.freeze([...data.increments]) }) as InferenceEvidence;
}

/** Build-only projection: explicitly enumerate admitted fields; never spread generator settings. */
export function evidenceFromPrepared(kind: InferenceEvidence["kind"], source: EncodedEvidenceSource,
  observationDigest: string): InferenceEvidence {
  const results = source.results.map(parseResult);
  const matches = results.filter((result) => result.quantityId === (kind === "ideal" ? "observationIncrements" : "increments"));
  const observed = matches[0];
  if (matches.length !== 1 || !observed || observed.status !== "value" || !(observed.value instanceof Float64Array) || observed.unit !== "m")
    throw new TypeError("The prepared example has no unique accepted displacement series in metres.");
  const p = source.parameters;
  return parseInferenceEvidence({
    schemaVersion: 1, kind, sourceDigest: source.sourceDigest, observationDigest, seed: p.seed,
    dt: p.dt, d: p.d, T: kind === "ideal" ? p.T : 1, eta: kind === "ideal" ? p.eta : 1,
    exposure: kind === "ideal" ? 0 : p.exposure,
    knownDrift: kind === "ideal" ? 0 : Number(p.flowDrift) + Number(p.stageDrift),
    increments: Array.from(observed.value),
  });
}
