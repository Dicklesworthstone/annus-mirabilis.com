/**
 * HOW MANY CONTROLS HAVE A DOMAIN `validateDomain` CANNOT ENFORCE, as a ceiling that must come
 * down rather than an assertion that the debt exists.
 *
 * AGENTS.md asks that one schema generate "the controls, URL-state validation, unit formatting,
 * and test cases", and that out-of-domain inputs "are never silently clamped while the label shows
 * the requested value". Measured over the 270 declared parameters, 42 of them cannot get that from
 * their declaration, and the two kinds fail in OPPOSITE directions:
 *
 *   enumerated: []        27 controls. domain.ts guards on `enumerated.length > 0`, so an empty
 *                         list falls through to the min/max branch, and where those are absent
 *                         too the control admits everything. bm-08's `noiseMethod` has the real
 *                         domain "known or stationary" written in its `reason` and validates 999
 *                         and -42 as `inside`.
 *   enumerated: [strings] 15 controls. `validateDomain(spec, value: number)` compares members with
 *                         a numeric tolerance, so a string member matches no number and EVERY
 *                         value is refused. me-01's `notation`, whose own declared values are
 *                         "printed" and "modern", rejects 0, 1 and 7 alike.
 *
 * So one class checked nothing and the other refused everything, and both read as a declared domain.
 *
 * THE SECOND CLASS IS REPAIRED AS OF 2026-10-11 and this file's ceiling came down with it, 42 -> 27.
 * `ModelDomain.enumerated` now admits `number | string` -- which the data had already assumed for 15
 * parameters while the type said `readonly number[]`, so the type did not describe the data and
 * nothing rejected the strings -- and `validateDomain` compares like with like: numbers by tolerance,
 * members by equality, and a mixed pair is not a member. me-01's `notation` admits "printed" and
 * "modern" and refuses 0, 1 and 7, where before it refused all four.
 *
 * That was not am-hr4z's schema DECISION, which remains open and is narrower than it looks: the type
 * lying about its own data is a defect, and the open question is what replaces the 27 empty lists
 * whose domain lives in a prose `reason`. Those are the controls that accept anything from a
 * permalink, and deciding each one's real domain is a judgment per control.
 *
 * ONE GAP THIS REPAIR DOES NOT CLOSE, stated so nobody reads the green as more than it is:
 * `parseParameterInput` refuses a non-numeric string before `validateDomain` ever sees it, so a
 * categorical value still cannot arrive through the URL-state parser. The validator is now correct
 * about a categorical domain; the parser in front of it is not yet, and that belongs with the same
 * decision.
 *
 * THE REMAINING COUNT IS A CEILING, NOT AN EQUALITY. A test that asserted 27 would go red the day
 * somebody fixed one, which is the brittleness this repository keeps paying for; it only fails
 * upward. The string count is no longer a ceiling at all, because the kind is legitimate now and may
 * grow: it is replaced by a property asserted over every member of every string domain.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import { validateDomain } from "./domain.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

type Spec = {
  id?: unknown;
  modelDomain?: { enumerated?: unknown; min?: unknown; max?: unknown; reason?: unknown };
  visualRange?: { min?: number; max?: number };
};

type Class =
  | "enumerated-empty"
  | "enumerated-string"
  | "enumerated-number"
  | "bounded"
  | "unbounded";

function classify(spec: Spec): Class {
  const e = spec.modelDomain?.enumerated;
  if (Array.isArray(e) && e.length === 0) return "enumerated-empty";
  if (Array.isArray(e) && e.some((v) => typeof v === "string")) return "enumerated-string";
  if (Array.isArray(e)) return "enumerated-number";
  if (spec.modelDomain?.min !== undefined || spec.modelDomain?.max !== undefined) return "bounded";
  return "unbounded";
}

function parameters(): { lab: string; spec: Spec }[] {
  const dir = join(ROOT, "content/experiments");
  const out: { lab: string; spec: Spec }[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()) {
    const manifest = loadYaml(readFileSync(join(dir, file), "utf8")) as { parameters?: Spec[] };
    for (const spec of manifest.parameters ?? [])
      out.push({ lab: file.replace(/\.yaml$/, ""), spec });
  }
  return out;
}

describe("how many declared domains validateDomain can actually enforce", () => {
  const all = parameters();
  const counts = new Map<Class, string[]>();
  for (const { lab, spec } of all) {
    const c = classify(spec);
    counts.set(c, [...(counts.get(c) ?? []), `${lab}/${String(spec.id)}`]);
  }
  const n = (c: Class) => (counts.get(c) ?? []).length;

  test("the census, with its denominator", () => {
    console.log(
      `[census] parameter-domains examined ${all.length} declared parameters (minimum 250): ` +
        `${n("bounded")} bounded, ${n("enumerated-number")} enumerated by number, ` +
        `${n("enumerated-string")} enumerated by string, ${n("enumerated-empty")} enumerated-empty, ` +
        `${n("unbounded")} unbounded`,
    );
    expect(all.length).toBeGreaterThanOrEqual(250);
    // Non-vacuity: the enforceable majority must exist, or a corpus of nothing but broken domains
    // would satisfy the ceilings below.
    expect(n("bounded")).toBeGreaterThan(100);
  });

  test("CEILING: controls whose domain cannot be enforced only ever goes down", () => {
    // LOWERED 42 -> 27 ON 2026-10-11, because the string half was repaired rather than re-baselined.
    // `validateDomain` now compares like with like, so a categorical domain is enforced and its 15
    // members are no longer part of this debt. The empty lists are, and they are the half that needs
    // am-hr4z's decision: 27 controls whose real domain lives in a prose `reason`.
    //
    // A baseline is the record of a debt, not a budget: this number comes down with the debt and
    // never goes up. The string count is deliberately NOT a ceiling any more -- a legitimate kind
    // may grow -- and is replaced by the property test below.
    const unenforceable = n("enumerated-empty");
    console.log(
      `[census] ${unenforceable} of ${all.length} declared domains are unenforceable ` +
        `(all of them enumerated-empty; the ${n("enumerated-string")} string domains are enforced)`,
    );
    expect(unenforceable).toBeLessThanOrEqual(27);
  });

  test("every declared member is a number or a string, so `item === value` compares what it can", () => {
    /**
     * THE HOLE THE TYPE WIDENING MAKES VISIBLE, closed here rather than left for someone to find.
     *
     * Nothing validates `modelDomain.enumerated`'s member types at runtime -- `src/content` has no
     * check on this field at all -- so the YAML is the only authority on what is in it. That was
     * already true when the type said `readonly number[]` and 15 entries held strings; what changes
     * is that `validateDomain` now branches on `typeof item`, so a member of a THIRD kind would take
     * the equality path and compare a boolean or an object against the reader's value.
     *
     * The trap is one quote mark wide. me-01 declares its cancel toggles as `["true", "false"]`,
     * which YAML reads as strings; written unquoted they are BOOLEANS, and `true === "true"` is
     * false, so the control would refuse its own domain again by exactly the route just repaired.
     */
    const offenders: string[] = [];
    let members = 0;
    for (const { lab, spec } of all) {
      for (const member of (spec.modelDomain?.enumerated ?? []) as readonly unknown[]) {
        members += 1;
        if (typeof member !== "number" && typeof member !== "string") {
          offenders.push(`${lab}/${String(spec.id)}: ${typeof member} ${JSON.stringify(member)}`);
        }
      }
    }
    console.log(
      `[census] parameter-domains examined ${members} enumerated members (minimum 50) across ` +
        `${all.length} parameters; ${offenders.length} of a kind validateDomain cannot compare`,
    );
    // Non-vacuity: a corpus with no members at all would satisfy the emptiness check below.
    expect(members).toBeGreaterThanOrEqual(50);
    expect(offenders).toEqual([]);

    /**
     * THE POSITIVE CONTROL, RUN HERE RATHER THAN PLANTED IN A MANIFEST. A clean sweep and a sweep
     * that cannot fail look identical, so this predicate has to be shown catching something. The
     * usual plant would put a boolean member into `content/experiments/*.yaml` -- and this
     * repository has an automated committer that picks up uncommitted work (it took three of my
     * commits mid-plant earlier today), so a planted manifest can reach the corpus. The predicate
     * is two lines; exercising it on a synthetic list proves the arm without that risk.
     */
    const synthetic: readonly unknown[] = [1, "printed", true, null, { kind: "object" }];
    const caught = synthetic.filter((m) => typeof m !== "number" && typeof m !== "string");
    expect(caught).toEqual([true, null, { kind: "object" }]);
    // And the two kinds that must pass are not caught, so the filter is not simply rejecting
    // everything -- which would also produce an empty `offenders` on a corpus of zero members.
    expect(synthetic.filter((m) => typeof m === "number" || typeof m === "string")).toEqual([
      1,
      "printed",
    ]);
  });

  test("every string-enumerated domain admits each of its own members and refuses a non-member", () => {
    // THE PROPERTY THAT REPLACED A CEILING. A count of string domains said how much debt there was;
    // this says the kind works, at any size, so a 16th declared tomorrow is covered without editing
    // a number. AGENTS.md: report a count, assert a property.
    const strings = all.filter(({ spec }) => classify(spec) === "enumerated-string");
    // Non-vacuity on purpose: with none of them, the loop below would assert nothing and pass.
    expect(strings.length).toBeGreaterThan(0);
    let checked = 0;
    for (const { lab, spec } of strings) {
      const members = (spec.modelDomain?.enumerated ?? []) as readonly (number | string)[];
      expect(members.length, `${lab}/${String(spec.id)} declares no members`).toBeGreaterThan(0);
      for (const member of members) {
        expect(
          validateDomain(spec as never, member as never).valid,
          `${lab}/${String(spec.id)} must admit its own member ${String(member)}`,
        ).toBe(true);
        checked += 1;
      }
      expect(
        validateDomain(spec as never, "\u0000definitely-not-a-member" as never).valid,
        `${lab}/${String(spec.id)} must refuse a non-member`,
      ).toBe(false);
    }
    console.log(
      `[census] parameter-domains examined ${checked} declared members across ` +
        `${strings.length} string domains (minimum 15)`,
    );
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  test("an empty enumerated list admits values its own reason excludes", () => {
    // Documented against the live spec, so the day it is repaired this test says so by failing.
    const noiseMethod = all.find((p) => p.lab === "bm-08" && p.spec.id === "noiseMethod")?.spec;
    expect(noiseMethod).toBeDefined();
    expect(noiseMethod?.modelDomain?.enumerated).toEqual([]);
    expect(String(noiseMethod?.modelDomain?.reason)).toBe("known or stationary");
    // Two admissible methods, and the validator says -42 is inside.
    const verdict = validateDomain(noiseMethod as never, -42);
    expect(verdict.valid).toBe(true);
    expect(verdict.status).toBe("inside");
  });

  test("a string enumerated list admits its own members and refuses everything else", () => {
    const notation = all.find((p) => p.lab === "me-01" && p.spec.id === "notation")?.spec;
    expect(notation).toBeDefined();
    expect(notation?.modelDomain?.enumerated).toEqual(["printed", "modern"]);

    // THE REPAIR: a categorical domain admits its own members. Before this, `validateDomain`
    // compared every member with a NUMERIC tolerance, so no number was ever "printed" and the
    // control's whole declared domain was refused -- me-01's `notation` rejected 0, 1 and 7 alike
    // and would have rejected "printed" too, because the comparison could not reach it.
    for (const member of ["printed", "modern"])
      expect(validateDomain(notation as never, member).valid, `${member} is its own domain`).toBe(
        true,
      );
    expect(validateDomain(notation as never, "sideways").valid).toBe(false);

    // THE OLD BEHAVIOUR KEPT AS AN EXPLICIT NEGATIVE, so the rejected design cannot creep back
    // under a passing suite: a NUMBER is still not a member of a string domain. 0 and 1 look like
    // plausible indices into ["printed", "modern"] and are not members of it, and admitting them
    // would be the positional-index reading this schema does not use.
    for (const value of [0, 1, 7])
      expect(validateDomain(notation as never, value).valid, `${value} is not a member`).toBe(
        false,
      );
  });

  test("a numeric enumerated list is unchanged, and a numeric string is not a member of it", () => {
    // The control for the repair above: widening the comparison must not make a numeric domain
    // accept the string spelling of one of its members, which is what a loose `==` would do.
    const numeric = all.find(
      (p) =>
        classify(p.spec) === "enumerated-number" &&
        (p.spec.modelDomain?.enumerated as never[]).length > 0,
    );
    expect(numeric).toBeDefined();
    const members = numeric?.spec.modelDomain?.enumerated as readonly number[];
    expect(validateDomain(numeric?.spec as never, members[0] as number).valid).toBe(true);
    expect(validateDomain(numeric?.spec as never, String(members[0]) as never).valid).toBe(false);
  });
});
