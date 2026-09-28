import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type DeclaredDomain,
  declaredDomains,
  insideDeclaredDomain,
} from "../experiments/controls/declaredDomain.ts";
import { refusalSentence } from "../experiments/results/refusalSentence.ts";
import type { RequestRefusal } from "../experiments/results/refusals.ts";

/**
 * A REFUSAL TELLS THE READER WHAT THE LIMIT IS (am-lab-domains-silently-clamped-pzj5, dispatch 323).
 *
 * labDomainSweep proves a value outside a declared domain is REFUSED, and that the sentence carries
 * no raw NaN, Infinity or developer text. That is not the whole of what AGENTS.md asks for: "Out-of
 * -domain inputs are never silently clamped while the label shows the requested value. They explain
 * the problem and offer an admissible boundary or a model change." A refusal can pass that sweep and
 * still tell the reader nothing useful, and one did: SR-08 answered a boost of 1e300 c, which
 * overflows to Infinity once multiplied by c, with "Enter the boost v/c as a number" - telling
 * someone who had typed a number that they had not. It refused, it was not raw, and it was useless.
 * Fixed in 470c605b; this is the gate that would have caught it.
 *
 * WHAT IS REQUIRED, and deliberately no more. The sentence a reader sees, which is
 * refusalSentence(refusal) and not the raw details, must not be one of the UNINFORMATIVE forms
 * below when the value handed over is a well-formed finite number that simply lies outside the
 * domain. It does NOT have to quote the manifest's reason: "An inertial observer must move more
 * slowly than light in this model" names the physics instead of the range and is a better sentence
 * than any range would be. Demanding the range everywhere would push an author to replace that with
 * something worse, so the test asks only that the sentence is about the setting rather than about
 * the reader's typing.
 *
 * The denominator is printed. A sweep that reached no control would pass every assertion here by
 * examining nothing, which reads exactly like a clean result.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Sentences that refuse without saying what is wrong with the VALUE. Each is a real sentence from
 * this repository: the first is SR-08's defect, the others are the completeness refusals every
 * validator opens with, which are correct for a malformed record and wrong for a number out of range.
 */
const UNINFORMATIVE = [
  /as an? numbers?\./i,
  /as numbers\./i,
  /complete known data fields/i,
  /complete parameter record/i,
  /^use /i,
];

/** Controls whose refusal for an out-of-range number is not yet about the value, with the reason. */
const NOT_YET_INFORMATIVE: ReadonlyMap<string, string> = new Map();

/**
 * The shape refusalSentence reads. `message` is required and `details` optional exactly as
 * RequestRefusal declares them, because under exactOptionalPropertyTypes a looser local type is not
 * assignable to it and the sentence would have to be re-derived here, which would let this gate and
 * the page disagree about what a reader sees.
 */
type Refusal = Pick<RequestRefusal, "message" | "details">;
type Result = Readonly<{ kind: string; refusal?: Refusal }>;

/**
 * A value just past each declared bound, inside what a double can represent.
 *
 * Non-finite values are deliberately NOT probed here. An infinite stored value is refused before a
 * validator by every path a reader has: readTypedNumber refuses the field, and a permalink decoder
 * answers with its own sentence. Probing Infinity at this layer reported 101 of 165 controls as
 * uninformative for a state no reader can reach, which is a measurement of the backstop rather than
 * of the reader's experience. The reachable half of that defect is a typed text, and it is tested
 * where the reader meets it, in typedNumber.test.ts.
 */
function justOutside(d: DeclaredDomain): number[] {
  const span = d.min !== undefined && d.max !== undefined ? d.max - d.min : 0;
  const out: number[] = [];
  if (d.min !== undefined)
    out.push(
      d.minInclusive === false
        ? d.min
        : d.min - Math.max(Math.abs(d.min) * 1e-3, span * 1e-3, 1e-15),
    );
  if (d.max !== undefined)
    out.push(
      d.maxInclusive === false
        ? d.max
        : d.max + Math.max(Math.abs(d.max) * 1e-3, span * 1e-3, 1e-15),
    );
  return out;
}

async function labBindings(lab: string) {
  const dir = resolve(root, "src/experiments", lab.replace("-", ""));
  let defaults: Record<string, unknown> | undefined;
  let validate: ((p: unknown) => Result) | undefined;
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return undefined;
  }
  for (const f of entries) {
    if (!f.endsWith(".ts") || f.includes(".test.")) continue;
    const mod = (await import(resolve(dir, f))) as Record<string, unknown>;
    for (const [k, v] of Object.entries(mod)) {
      if (/^[A-Z0-9]+_DEFAULTS$/.test(k) && v && typeof v === "object")
        defaults = v as Record<string, unknown>;
      if (/^validate[A-Za-z0-9]*Parameters$/.test(k) && typeof v === "function")
        validate = v as (p: unknown) => Result;
    }
  }
  return defaults && validate ? { defaults, validate } : undefined;
}

async function sweep() {
  const labs = readdirSync(resolve(root, "content/experiments"))
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.slice(0, -5))
    .sort();
  const findings: string[] = [];
  const informativeKeys = new Set<string>();
  let controls = 0;
  let labsReached = 0;
  let probes = 0;
  let numericControls = 0;
  for (const lab of labs) {
    const domains = Object.entries(declaredDomains(lab));
    if (domains.length === 0) continue;
    const bound = await labBindings(lab);
    if (!bound) continue;
    labsReached++;
    // Every setting a reader can type a number into, whether or not a domain is declared for it.
    // Without this the sweep's denominator is the population that already declares a domain, and a
    // control with none is not reported as unchecked - it is not reported at all.
    for (const v of Object.values(bound.defaults)) if (typeof v === "number") numericControls++;
    for (const [id, d] of domains) {
      if (typeof bound.defaults[id] !== "number") continue;
      controls++;
      const key = `${lab}.${id}`;
      let informative = true;
      for (const value of justOutside(d)) {
        // Only well-formed finite numbers: a NaN really is "not a number" and its sentence should
        // say so, which is why this sweep probes the boundary rather than 1e300 or "abc".
        if (!Number.isFinite(value) || insideDeclaredDomain(d, value)) continue;
        probes++;
        let r: Result;
        try {
          r = bound.validate({ ...bound.defaults, [id]: value });
        } catch (e) {
          findings.push(`${key} = ${value}: threw ${String(e).slice(0, 50)}`);
          informative = false;
          continue;
        }
        if (r.kind !== "refused" || !r.refusal) continue; // labDomainSweep owns acceptance
        const said = refusalSentence(r.refusal);
        const bad = UNINFORMATIVE.find((p) => p.test(said));
        if (bad) {
          findings.push(`${key} = ${value}: says "${said.slice(0, 70)}"`);
          informative = false;
        }
      }
      if (informative) informativeKeys.add(key);
    }
  }
  return { findings, controls, labsReached, probes, informativeKeys, numericControls };
}

describe("a refusal says what is wrong with the setting, not with the typing", async () => {
  const s = await sweep();

  test("the sweep reports what it examined", () => {
    console.log(
      `[domain sentences] ${s.informativeKeys.size} of ${s.controls} controls across ${s.labsReached} labs ` +
        `answer an out-of-range number by naming the setting; ${s.probes} probes`,
    );
    // The second number is the one that is easy not to print. A reader can type into all of these;
    // this sweep can only speak for the ones whose manifest declares a range.
    console.log(
      `[domain sentences] ${s.controls} of ${s.numericControls} numeric controls declare a domain; ` +
        `${s.numericControls - s.controls} are outside what this sweep can check`,
    );
    // Floors, not a census. A sweep that reached nothing would pass every assertion below by
    // examining nothing, and zero reads exactly like a pass.
    expect(s.labsReached).toBeGreaterThan(25);
    expect(s.controls).toBeGreaterThan(100);
    expect(s.probes).toBeGreaterThan(100);
    // A one-way ratchet on the unchecked population, measured at 56 on 2026-09-28. Declaring a
    // domain for one of them lowers this and the number here can follow it down; a new numeric
    // control that declares none raises it and is refused here rather than passing unseen.
    expect(s.numericControls - s.controls).toBeLessThanOrEqual(56);
  });

  test("no control answers an out-of-range number with a sentence about the reader's typing", () => {
    const unexpected = s.findings.filter(
      (f) => !NOT_YET_INFORMATIVE.has(f.slice(0, f.indexOf(" ="))),
    );
    expect(unexpected).toEqual([]);
  });

  test("the recorded exceptions are still needed", () => {
    // A two-way ratchet, as labDomainSweep has: a control that has been fixed must leave the list,
    // so the list can only shrink and a stale entry cannot hide a later regression.
    const stale = [...NOT_YET_INFORMATIVE.keys()].filter((key) => s.informativeKeys.has(key));
    expect(stale).toEqual([]);
  });

  test("the guard recognises the sentence it was built for", () => {
    // The positive control. Without it every assertion above would pass on a matcher that never
    // fires, which is the failure this file exists to catch in other people's gates.
    const sr08Defect = "Enter the boost v/c as a number.";
    expect(UNINFORMATIVE.some((p) => p.test(sr08Defect))).toBe(true);
    expect(UNINFORMATIVE.some((p) => p.test("Use complete known data fields."))).toBe(true);
    // And it does not fire on the sentences that are good, so it cannot be satisfied by worsening
    // one of them.
    for (const good of [
      "Enter the temperature from 273 to 330 K, the range this model describes: liquid state of water at ordinary laboratory pressure.",
      "Enter a frame speed below the speed of light: no inertial observer moves at or beyond c.",
      "An inertial observer must move more slowly than light in this model.",
      "Enter a proper rod length L_{0} from 10^{−6} to 10^{6} light-seconds.",
    ])
      expect(UNINFORMATIVE.some((p) => p.test(good))).toBe(false);
  });
});
