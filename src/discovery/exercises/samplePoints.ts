/**
 * Deterministic Halton sample points for numerical equivalence checking
 * (am-disc-exercise-checker-i4h2). No `Math.random` anywhere.
 *
 * This pass implements the Halton set only. The bead also specifies a
 * second, per-exercise Philox-derived set precisely because the Halton
 * grid, checked in and published, is exploitable: see the "adversarial
 * corpus" section of equivalence.ts's docblock and the sin(32*pi*x)
 * fixture there. That second set needs am-fs-philox-ts-port-7kp's
 * stream-key derivation wired to a registered exercise stream kernel id
 * (am-fs-capability-audit-byc decision (c)), which is a real integration
 * this pass does not do -- disclosed, not hidden, in equivalence.ts.
 */

export type Domain = Readonly<{ min: number; max: number; scale?: "linear" | "log" }>;

/** The base-`base` Halton (van der Corput) value at 1-based `index`. */
export function haltonValue(index: number, base: number): number {
  let result = 0;
  let f = 1 / base;
  let i = index;
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  return result;
}

/** The first small primes used as Halton bases, one per variable, in declaration order. */
export const HALTON_BASES: readonly number[] = [2, 3, 5, 7, 11, 13, 17, 19];

function mapUnitToDomain(u: number, domain: Domain): number {
  if (domain.scale === "log") {
    if (domain.min <= 0 || domain.max <= 0) {
      throw new Error("A log-scaled domain must have a strictly positive min and max.");
    }
    const logMin = Math.log(domain.min);
    const logMax = Math.log(domain.max);
    return Math.exp(logMin + u * (logMax - logMin));
  }
  return domain.min + u * (domain.max - domain.min);
}

/**
 * The first `count` Halton points for each declared variable (in
 * `domains`'s key order), mapped into its domain. A positive domain
 * spanning more than one decade should be declared `scale: "log"`.
 */
export function haltonPoints(
  domains: Readonly<Record<string, Domain>>,
  count: number,
): ReadonlyArray<Readonly<Record<string, number>>> {
  const names = Object.keys(domains);
  const points: Array<Record<string, number>> = [];
  for (let i = 1; i <= count; i++) {
    const point: Record<string, number> = {};
    names.forEach((name, varIndex) => {
      const base = HALTON_BASES[varIndex % HALTON_BASES.length] as number;
      const u = haltonValue(i, base);
      point[name] = mapUnitToDomain(u, domains[name] as Domain);
    });
    points.push(point);
  }
  return points;
}
