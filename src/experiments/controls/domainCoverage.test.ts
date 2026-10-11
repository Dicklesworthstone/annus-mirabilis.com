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
    // 27 -> 14 on 2026-10-11, the same day as 42 -> 27 and for the same reason: paid, not
    // re-baselined. 13 parameters had their domain FILLED from the lab's own guard, which the
    // manifest's prose `reason` already named -- transcription from the implementation rather than
    // a judgment, which is what the remaining 14 would need. Of those: 7 are SEEDS, whose domain is
    // the u64 range and not an enumeration at all; 2 are bm-06's lower/upper, a relational
    // constraint between two parameters that this schema cannot express; and 5 are categoricals
    // whose guard I could not locate in code, so filling them would have been invention.
    // 14 -> 10 the same day, after four more were filled from their TypeScript UNION types
    // (bm-03 model/step/notation, lq-07 regime) -- the guards my array search missed because a
    // union is not an array literal. What remains is three representation questions and no residue:
    // 7 seeds (a u64 range, not an enumeration), 2 relational constraints between parameter pairs
    // (bm-06 lower/upper), and lq-05 `locked`, whose lab type is a real `boolean` -- filling it
    // ["true","false"] would recreate exactly the incoherence me-01's three toggles already have.
    expect(unenforceable).toBeLessThanOrEqual(10);
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

  test("an empty enumerated list with no bounds admits anything, for every one that remains", () => {
    /**
     * A PROPERTY OVER THE REMAINING SET, BECAUSE NAMING AN INSTANCE MOVED TWICE IN ONE DAY.
     *
     * This test named bm-08's `noiseMethod` as the live example; that was filled, so it named
     * bm-03's `notation`; that was filled an hour later. Each time the test went red on CORRECT
     * work, which is the brittleness AGENTS.md records under "A Count Is For Reporting, Not For
     * Asserting" wearing different clothes: a named instance is a census of one.
     *
     * So the subject is now whichever parameters still carry an empty list, found rather than
     * written down. The property holds of every one of them by construction -- an empty
     * `enumerated` falls through to min/max, and where those are absent too the final return admits
     * the value -- so it needs no maintenance as the set shrinks, and it reports the set by name.
     *
     * It goes red when the last one is filled, which is the right failure: at that point the debt is
     * gone and this test should be retired rather than edited.
     */
    // NARROWED, NOT CAST. I wrote `(spec.modelDomain?.enumerated as T[]).length` three times in
    // this file on 2026-10-11 and Biome refused it three times; `tsc` accepts it every time, because
    // the cast is exactly the assertion that silences the check. The shape to reach for is a local
    // binding plus `Array.isArray`, never a cast over an optional chain.
    const empty = all.filter(({ spec }) => {
      const members = spec.modelDomain?.enumerated;
      return Array.isArray(members) && members.length === 0;
    });
    const unbounded = empty.filter(
      ({ spec }) => spec.modelDomain?.min === undefined && spec.modelDomain?.max === undefined,
    );
    console.log(
      `[census] parameter-domains examined ${empty.length} empty enumerated list(s) (minimum 1), ` +
        `${unbounded.length} of them with no min or max either: ` +
        unbounded.map(({ lab, spec }) => `${lab}/${String(spec.id)}`).join(", "),
    );
    // Non-vacuity: with none left, the loop below would assert nothing and read as a clean pass.
    expect(unbounded.length).toBeGreaterThan(0);
    for (const { lab, spec } of unbounded) {
      for (const value of [-42, 999]) {
        const verdict = validateDomain(spec as never, value);
        expect(
          verdict.valid,
          `${lab}/${String(spec.id)} admits ${value}, which its own reason excludes`,
        ).toBe(true);
        expect(verdict.status).toBe("inside");
      }
    }

    // THE REPAIRED CASE, kept as the negative: bm-08's noiseMethod now declares its members, so the
    // same probe that passed above is refused here. If this arm starts passing, a fill was reverted.
    const noiseMethod = all.find((p) => p.lab === "bm-08" && p.spec.id === "noiseMethod")?.spec;
    expect(noiseMethod?.modelDomain?.enumerated).toEqual(["known", "stationary"]);
    expect(validateDomain(noiseMethod as never, -42).valid).toBe(false);
    for (const member of ["known", "stationary"]) {
      expect(validateDomain(noiseMethod as never, member as never).valid).toBe(true);
    }
  });

  test("a declared default is a member of its own declared domain, and 9 are not", () => {
    /**
     * THE SAFETY NET FOR EVERY FILL, AND IT FOUND NINE PRE-EXISTING INCOHERENCES (am-hr4z).
     *
     * Filling an `enumerated` list turns a control that admitted everything into one that admits
     * only members, so a list omitting the parameter's own default would refuse the value the
     * laboratory starts with. That is the one way the fill could break a reader, so it is checked
     * over the whole corpus rather than trusted per fill. The 13 filled on 2026-10-11 all pass.
     *
     * NINE OTHERS DO NOT, in two kinds, and both were invisible before `validateDomain` compared
     * like with like -- the old numeric-tolerance comparison refused every categorical value, so
     * nothing was coherent and no mismatch stood out:
     *
     *   me-01, 3 toggles   `default: true` (a YAML BOOLEAN) against members `["true", "false"]`
     *                      (strings). One quote mark: `true !== "true"`. And the lab's own type is
     *                      `cancelAngleFactors: boolean` (me01/definition.ts), so the manifest
     *                      disagrees with itself AND with the laboratory, which is why quoting the
     *                      default is not obviously the repair.
     *   me-03, 6 controls  members declared as POSITIONAL INDICES -- `[0,1,2]`, `[0,1]`,
     *                      `[0..6]` -- against semantic defaults `"body-alone"`, `"escapes"`,
     *                      `"me-03-card-radium"`, `"1905"`, `"two-opposite"`, `"printed"`. The
     *                      domain names no value the parameter actually takes, so it refuses all of
     *                      them and admits three integers that are not values at all. This is the
     *                      positional reading of a categorical domain that
     *                      `domain.ts` now asserts against in code, present in the data.
     *
     * A CEILING, NOT AN EXACT SET: these shrink as they are repaired, and an equality would go red
     * on the repair. The names are printed so a new one is identifiable rather than merely counted.
     * Repairing them needs the representation decided, which is am-hr4z's open schema question.
     */
    const withMembers = all.filter(({ spec }) => {
      // Narrowed, not asserted: a cast over the optional chain would hide a TypeError from the
      // typechecker, which is the defect 0127643c1 fixed two commits ago in this same file.
      const members = spec.modelDomain?.enumerated;
      return Array.isArray(members) && members.length > 0;
    });
    // Non-vacuity: an empty population would satisfy every assertion below while proving nothing.
    expect(withMembers.length).toBeGreaterThanOrEqual(30);
    const offenders: string[] = [];
    let checked = 0;
    for (const { lab, spec } of withMembers) {
      const dflt = (spec as { default?: unknown }).default;
      if (dflt === undefined) continue;
      checked += 1;
      if (!validateDomain(spec as never, dflt as never).valid) {
        offenders.push(
          `${lab}/${String(spec.id)} default=${JSON.stringify(dflt)} (${typeof dflt}) members=${JSON.stringify(spec.modelDomain?.enumerated)}`,
        );
      }
    }
    console.log(
      `[census] parameter-domains examined ${checked} defaults against their declared domains ` +
        `(minimum 30); ${checked - offenders.length} are members, ${offenders.length} are not:\n   ` +
        offenders.join("\n   "),
    );
    expect(checked).toBeGreaterThanOrEqual(30);
    // The majority must be coherent, or a corpus of nothing but mismatches would satisfy the
    // ceiling below.
    expect(checked - offenders.length).toBeGreaterThanOrEqual(28);
    expect(offenders.length).toBeLessThanOrEqual(9);
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
    // NO CAST OVER AN OPTIONAL CHAIN. This read
    // `(p.spec.modelDomain?.enumerated as never[]).length > 0`, which throws a TypeError on any
    // parameter declaring no `modelDomain` at all: the cast told TypeScript the chain could not
    // short-circuit, so only Biome's noUnsafeOptionalChaining saw it. Narrow instead of asserting.
    const numeric = all.find(({ spec }) => {
      if (classify(spec) !== "enumerated-number") return false;
      const members = spec.modelDomain?.enumerated;
      return Array.isArray(members) && members.length > 0;
    });
    expect(numeric).toBeDefined();
    const members = (numeric?.spec.modelDomain?.enumerated ?? []) as readonly number[];
    const first = members[0];
    expect(typeof first).toBe("number");
    expect(validateDomain(numeric?.spec as never, first as number).valid).toBe(true);
    expect(validateDomain(numeric?.spec as never, String(first) as never).valid).toBe(false);
  });
});
