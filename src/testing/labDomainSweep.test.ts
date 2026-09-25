import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type DeclaredDomain,
  declaredDomains,
  insideDeclaredDomain,
} from "../experiments/controls/declaredDomain.ts";

/**
 * Every numeric setting of every laboratory keeps to the modelDomain its manifest declares
 * (am-lab-domains-silently-clamped-pzj5, dispatch 165).
 *
 * For each numeric modelDomain in content/experiments/*.yaml whose lab stores the setting as a
 * number, each probe value goes through the lab's own exported validator, from the lab's defaults.
 * Two results are allowed:
 * - a value inside the domain is accepted, or refused by a stricter check of the lab's own;
 * - anything else is refused, with an ordinary-language requirement that carries no raw NaN,
 *   Infinity, [object ...] or developer sentence.
 * A text value ("abc", "") is not a number and must be refused, never swapped for a default.
 *
 * UNFINISHED names the labs not yet fixed. It is a ratchet in both directions: a lab outside it that
 * lets a value through fails, and a lab inside it that no longer does fails too, so the list only
 * ever shrinks, one lab's fix at a time. NO_VALIDATOR names the labs whose checks live in their
 * component and cannot be reached here; the same two-way rule holds for it.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const UNFINISHED: readonly string[] = [
  "bm-03",
  "bm-04",
  "bm-05",
  "bm-06",
  "bm-07",
  "lq-01",
  "lq-03",
  "lq-07",
  "lq-08",
  "lq-09",
  "sr-11",
];
const NO_VALIDATOR: readonly string[] = ["bm-02", "lq-02"];

const NUMBERS = [
  1e300,
  -1e300,
  0,
  -1,
  1e-300,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
];
const TEXT = ["abc", ""];
const RAW =
  /\bNaN\b|\bInfinity\b|\[object |must be a finite number between|\bundefined\b(?! [a-z])/;

/** A value just past each declared bound: the bound itself when it is open. */
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

type Result = Readonly<{
  kind: string;
  refusal?: Readonly<{ message?: string; details?: Readonly<{ requirements?: unknown }> }>;
}>;

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
  const unreached: string[] = [];
  const badLabs = new Set<string>();
  const findings: string[] = [];
  let controls = 0;
  let enforcing = 0;
  let probes = 0;
  let labsReached = 0;
  for (const lab of labs) {
    const domains = Object.entries(declaredDomains(lab));
    if (domains.length === 0) continue;
    const bound = await labBindings(lab);
    if (!bound) {
      unreached.push(lab);
      continue;
    }
    labsReached++;
    for (const [id, d] of domains) {
      if (typeof bound.defaults[id] !== "number") continue;
      controls++;
      let good = true;
      for (const value of [...NUMBERS, ...justOutside(d), ...TEXT]) {
        probes++;
        const inside =
          typeof value === "number" && Number.isFinite(value) && insideDeclaredDomain(d, value);
        let r: Result;
        try {
          r = bound.validate({ ...bound.defaults, [id]: value });
        } catch (e) {
          findings.push(`${lab}.${id} = ${String(value)}: threw ${String(e).slice(0, 60)}`);
          good = false;
          continue;
        }
        if (r.kind === "accepted") {
          if (!inside) {
            findings.push(`${lab}.${id} = ${JSON.stringify(value)}: accepted outside`);
            good = false;
          }
          continue;
        }
        const req = r.refusal?.details?.requirements;
        const text = typeof req === "string" && req ? req : (r.refusal?.message ?? "");
        if (!text || RAW.test(text)) {
          findings.push(
            `${lab}.${id} = ${JSON.stringify(value)}: refusal text "${text.slice(0, 60)}"`,
          );
          good = false;
        }
      }
      if (good) enforcing++;
      else badLabs.add(lab);
    }
  }
  return {
    unreached,
    badLabs: [...badLabs].sort(),
    findings,
    controls,
    enforcing,
    probes,
    labsReached,
  };
}

describe("every laboratory keeps each numeric setting to its declared domain", async () => {
  const s = await sweep();

  test("the sweep reaches the labs and reports its denominator", () => {
    console.log(
      `[domains] ${s.enforcing} of ${s.controls} controls enforce their declared domain; ${s.labsReached} labs, ${s.probes} probes`,
    );
    // Floors, not a census: a sweep that reached nothing would pass everything below.
    expect(s.labsReached).toBeGreaterThan(25);
    expect(s.controls).toBeGreaterThan(140);
    expect(s.probes).toBeGreaterThan(1500);
  });

  test("no lab outside UNFINISHED lets a value through, and no fixed lab stays listed", () => {
    const leaks = s.findings.filter((f) => !UNFINISHED.some((lab) => f.startsWith(`${lab}.`)));
    expect(leaks).toEqual([]);
    expect(UNFINISHED.filter((lab) => !s.badLabs.includes(lab))).toEqual([]);
  });

  test("the labs whose checks the sweep cannot reach are exactly NO_VALIDATOR", () => {
    expect(s.unreached).toEqual([...NO_VALIDATOR]);
  });
});
