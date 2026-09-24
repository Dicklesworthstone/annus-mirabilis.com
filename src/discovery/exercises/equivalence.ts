/** Two-set numerical comparison (am-disc-exercise-checker-i4h2).
 * Both sample families must supply enough DISTINCT valid reference points.
 * Reader-only domain failures never disappear by intersecting the domains.
 * Deterministic sampling can still miss differences; success is never a proof.
 */
import { type ToleranceSpec, withinTolerance } from "../../units/tolerance.ts";
import { evaluate } from "./evaluate.ts";
import type { Expr } from "./grammar.ts";
import {
  boundaryPoints,
  type Domain,
  haltonPoints,
  philoxPoints,
  type SamplePoint,
} from "./samplePoints.ts";

export type EquivalenceOutcome =
  | Readonly<{ status: "equivalent"; acceptedPointCount: number; label: string }>
  | Readonly<{
      status: "not-equivalent";
      point: SamplePoint;
      readerValue: number;
      referenceValue: number;
    }>
  | Readonly<{ status: "could-not-compare"; reason: string }>;

const CANDIDATE_POOL = 64;
const TARGET_ACCEPTED = 16;
const MIN_ACCEPTED = 12;
const unable = (reason: string): EquivalenceOutcome => ({ status: "could-not-compare", reason });

export function checkEquivalence(
  reader: Expr,
  reference: Expr,
  domains: Readonly<Record<string, Domain>>,
  tolerance: ToleranceSpec,
  options: Readonly<{ seed?: string | bigint }> = {},
): EquivalenceOutcome {
  try {
    if (
      !tolerance ||
      (tolerance.relativeTo !== undefined &&
        !["reference", "larger"].includes(tolerance.relativeTo))
    )
      return unable("This exercise's settings are invalid: its tolerance cannot be used.");
    const groups = [
      { name: "boundary", points: boundaryPoints(domains), minimum: 0 },
      { name: "Halton", points: haltonPoints(domains, CANDIDATE_POOL), minimum: MIN_ACCEPTED },
      {
        name: "Philox",
        points: philoxPoints(domains, CANDIDATE_POOL, options.seed ?? "0"),
        minimum: MIN_ACCEPTED,
      },
    ];
    const names = Object.keys(domains).sort();
    const allAccepted = new Set<string>();
    for (const group of groups) {
      const accepted = new Set<string>();
      for (const point of group.points) {
        if (group.name !== "boundary" && accepted.size >= TARGET_ACCEPTED) break;
        const key = JSON.stringify(names.map((name) => point[name]));
        if (accepted.has(key)) continue;
        const expected = evaluate(reference, point);
        if (expected.status !== "value") continue;
        const actual = evaluate(reader, point);
        if (actual.status !== "value") {
          const at =
            names.map((name) => `${name} = ${point[name]}`).join(", ") || "the constant input";
          // Not skipped: dropping points where only the reader's expression fails would let x/x
          // pass for 1 on a range containing zero.
          return unable(
            `Your expression cannot be evaluated at ${at}, where the reference has a value, so this point cannot be set aside.`,
          );
        }
        const compared = withinTolerance(actual.value, expected.value, tolerance);
        if (compared.kind === "invalid-spec")
          return unable(
            `This exercise's tolerance cannot compare this point: ${compared.issues.map((i) => i.message).join(" ")}`,
          );
        if (!compared.ok)
          return {
            status: "not-equivalent",
            point,
            readerValue: actual.value,
            referenceValue: expected.value,
          };
        accepted.add(key);
        allAccepted.add(key);
      }
      const minimum = names.length ? group.minimum : 1;
      if (accepted.size < minimum)
        // The family name stays out of reader copy; the count and the need do not.
        return unable(
          `Only ${accepted.size} of the sample points gave the reference a value, and ${minimum} are needed for a comparison.`,
        );
    }
    return {
      status: "equivalent",
      acceptedPointCount: allAccepted.size,
      // Plain words for a reader; how the points are chosen is this module's business. "sample
      // points", not bare "points", which the voice lint reads as a score in feedback copy.
      label: `Numerically equivalent at ${allAccepted.size} sample points in the stated ranges. This is a numerical check, not a proof.`,
    };
  } catch (error) {
    return unable(error instanceof Error ? error.message : "The exercise could not be compared.");
  }
}
