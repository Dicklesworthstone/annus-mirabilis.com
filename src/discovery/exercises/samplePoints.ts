/** Bounded exercise samples. Halton coverage and a separate Philox stream;
 * deterministic numerical checks, not symbolic proofs or secret exam points.
 * Owner: am-disc-exercise-checker-i4h2. RNG: the existing reference Philox owner.
 */
import { createPhiloxStream } from "../../physics/reference/philox.ts";

export type Domain = Readonly<{ min: number; max: number; scale?: "linear" | "log" }>;
export type SamplePoint = Readonly<Record<string, number>>;
export const HALTON_BASES: readonly number[] = Object.freeze([2, 3, 5, 7, 11, 13, 17, 19]);
export const SAMPLE_LIMIT = 256;
/** ASCII EXRC. Local, stateless exercise streams never consume a simulation stream. */
export const EXERCISE_STREAM = Object.freeze({
  kernel: 0x45585243,
  version: 1,
  ownerBeadId: "am-disc-exercise-checker-i4h2",
});

export function validateDomains(domains: Readonly<Record<string, Domain>>): readonly string[] {
  if (!domains || ![Object.prototype, null].includes(Object.getPrototypeOf(domains)))
    throw new TypeError("Exercise domains must be a plain record.");
  const names = Object.keys(domains);
  if (Reflect.ownKeys(domains).length !== names.length || names.length > HALTON_BASES.length)
    throw new RangeError("At most eight named variable domains are supported.");
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(domains, name)!;
    if (
      !Object.hasOwn(descriptor, "value") ||
      !/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name) ||
      ["__proto__", "constructor", "prototype", "pi"].includes(name)
    )
      throw new TypeError("Use a named variable, not an accessor or reserved constant.");
    const domain: unknown = descriptor.value;
    if (!domain || ![Object.prototype, null].includes(Object.getPrototypeOf(domain)))
      throw new TypeError(`Invalid domain for ${name}.`);
    const d = Object.getOwnPropertyDescriptors(domain);
    if (
      Reflect.ownKeys(domain).some(
        (k) =>
          typeof k !== "string" ||
          !["min", "max", "scale"].includes(k) ||
          !d[k]?.enumerable ||
          !Object.hasOwn(d[k]!, "value"),
      )
    )
      throw new TypeError(`Unexpected field or accessor in ${name}'s domain.`);
    const min: unknown = d.min?.value,
      max: unknown = d.max?.value,
      scale: unknown = d.scale?.value;
    if (
      typeof min !== "number" ||
      typeof max !== "number" ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min >= max ||
      (scale !== undefined && scale !== "linear" && scale !== "log") ||
      (scale === "log" && min <= 0)
    )
      throw new RangeError(
        `${name} needs finite increasing bounds; logarithmic bounds must be positive.`,
      );
  }
  return names;
}

function checkCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0 || count > SAMPLE_LIMIT)
    throw new RangeError(`Sample count must be an integer from zero through ${SAMPLE_LIMIT}.`);
}

export function haltonValue(index: number, base: number): number {
  if (!Number.isSafeInteger(index) || index < 0 || !Number.isSafeInteger(base) || base < 2)
    throw new RangeError("Halton indices are nonnegative integers and bases are integers >= 2.");
  let result = 0,
    f = 1 / base,
    i = index;
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  return result;
}

export function mapUnitToDomain(u: number, domain: Domain): number {
  if (!Number.isFinite(u) || u < 0 || u > 1)
    throw new RangeError("Expected a unit-interval sample.");
  if (u === 0) return domain.min;
  if (u === 1) return domain.max;
  // Convex combinations avoid max-min overflowing on e.g. [-1e308, 1e308].
  const value =
    domain.scale === "log"
      ? Math.exp((1 - u) * Math.log(domain.min) + u * Math.log(domain.max))
      : (1 - u) * domain.min + u * domain.max;
  if (!Number.isFinite(value))
    throw new RangeError("The domain cannot be sampled at this numeric scale.");
  // Only contain floating-point endpoint rounding; never repair an invalid domain.
  return Math.max(domain.min, Math.min(domain.max, value));
}

export function haltonPoints(
  domains: Readonly<Record<string, Domain>>,
  count: number,
): readonly SamplePoint[] {
  const names = validateDomains(domains);
  checkCount(count);
  return Object.freeze(
    Array.from({ length: count }, (_, i) =>
      Object.freeze(
        Object.fromEntries(
          names.map((name, j) => [
            name,
            mapUnitToDomain(haltonValue(i + 1, HALTON_BASES[j]!), domains[name]!),
          ]),
        ),
      ),
    ),
  );
}

export function philoxPoints(
  domains: Readonly<Record<string, Domain>>,
  count: number,
  seed: string | bigint = "0",
): readonly SamplePoint[] {
  const names = [...validateDomains(domains)].sort();
  checkCount(count);
  const streams = names.map((_, tile) =>
    createPhiloxStream({ seed, kernel: EXERCISE_STREAM.kernel, tile }),
  );
  // Validate seed even when there are no variables.
  if (!names.length) createPhiloxStream({ seed, kernel: EXERCISE_STREAM.kernel, tile: 0 });
  return Object.freeze(
    Array.from({ length: count }, () =>
      Object.freeze(
        Object.fromEntries(
          names.map((name, j) => [name, mapUnitToDomain(streams[j]!.nextF64(), domains[name]!)]),
        ),
      ),
    ),
  );
}

/** Midpoint and axis-boundary probes expose x/x at zero and lost sign branches. */
export function boundaryPoints(domains: Readonly<Record<string, Domain>>): readonly SamplePoint[] {
  const names = validateDomains(domains);
  const middle = Object.fromEntries(
    names.map((name) => [name, mapUnitToDomain(0.5, domains[name]!)]),
  );
  return Object.freeze([
    Object.freeze(middle),
    ...names.flatMap((name) => [
      Object.freeze({ ...middle, [name]: domains[name]!.min }),
      Object.freeze({ ...middle, [name]: domains[name]!.max }),
    ]),
  ]);
}
