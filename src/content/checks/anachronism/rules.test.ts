import { describe, expect, test } from "bun:test";
import { ANACHRONISM_RULES, checkAnachronism } from "./rules.ts";

/**
 * Every rule is planted in both directions, and the file refuses to let a rule go unplanted
 * (am-cm-anachronism-lint-dl2).
 *
 * A denylist is easy to test in one direction and useless in the other: a matcher that fires on
 * everything would pass every positive case here. So each rule with licences carries the licensed
 * sentence AGENTS.md's table actually asks an author to write, and that sentence must produce no
 * finding. "Ehrenfest named this the ultraviolet catastrophe in 1911" is the treatment, not the
 * violation, and a lint that refused it would push authors into avoiding the phrase, which is the
 * opposite of what the table prescribes.
 *
 * The last case is the structural one: the ids exercised below must be exactly the ids in the rule
 * table, so a rule added without a plant fails here rather than shipping unexercised. That is the
 * same hole that left four rule checks in the derivation library blind until 2026-10-16.
 */

/** id -> [a string that must be caught, a licensed string that must not be]. */
const PLANTS: Readonly<Record<string, readonly [string, string | null]>> = {
  "ultraviolet-catastrophe": [
    "The ultraviolet catastrophe is what the classical law predicts.",
    "Ehrenfest named this the ultraviolet catastrophe in 1911, long after the papers.",
  ],
  photon: [
    "Each photon carries an energy proportional to the frequency.",
    "A modern reader would say photon; the paper says light quantum.",
  ],
  wavefunction: [
    "The wavefunction spreads as the particle moves.",
    "Its modern wavefunction description came two decades later.",
  ],
  "bose-statistics": [
    "Counting the states needs Bose statistics.",
    "Bose-Einstein statistics are a later (1924) account of the same counting.",
  ],
  "spacetime-diagram": [
    "The spacetime diagram shows both events at once.",
    "Minkowski's 1908 spacetime diagram is a later geometric aid.",
  ],
  "train-and-embankment": [
    "Picture the train and embankment, and two strokes of lightning.",
    "Einstein's 1917 popular train-and-embankment illustration came much later.",
  ],
  "langevin-equation": [
    "Write the Langevin equation for the particle.",
    "The Langevin equation is a modern lens, dated 1908.",
  ],
  "wiener-process": [
    "The displacement is a Wiener process.",
    "A Wiener process is the modern mathematical lens on the same motion.",
  ],
  // The flags carry no licensed form: no phrase an author adds makes the matcher's judgement right.
  "light-is-not-a-wave": ["The paper showed light is not a wave after all.", null],
  "everyone-rejected-atoms": ["In 1905 everyone rejected atoms as a fiction.", null],
  "michelson-morley-sole-cause": ["Michelson-Morley is why Einstein wrote the paper.", null],
};

describe("the anachronism rules catch the bare phrase and license the prescribed treatment", () => {
  for (const rule of ANACHRONISM_RULES) {
    const plant = PLANTS[rule.id];
    test(`${rule.id}: the bare phrase is reported`, () => {
      expect(plant).toBeDefined();
      const found = checkAnachronism((plant as readonly [string, string | null])[0]);
      expect(found.map((f) => f.ruleId)).toContain(rule.id);
      const hit = found.find((f) => f.ruleId === rule.id);
      // The matched text, not just the count: a pattern that fired on the wrong words would
      // otherwise read exactly like one that fired on the right ones.
      expect(hit?.matched.length ?? 0).toBeGreaterThan(0);
      expect(hit?.severity).toBe(rule.severity);
    });

    const licensed = (plant as readonly [string, string | null] | undefined)?.[1];
    if (licensed !== null && licensed !== undefined) {
      test(`${rule.id}: the treatment AGENTS.md prescribes is not a finding`, () => {
        expect(checkAnachronism(licensed).map((f) => f.ruleId)).not.toContain(rule.id);
      });
    }
  }

  test("an identifier is not prose, and a sentence naming the same thing still is", () => {
    // The first real run over the corpus reported three findings and all three were ids: the
    // shelf card `michelson-morley` and a constraintRef naming it. A slug makes no claim.
    expect(checkAnachronism("michelson-morley")).toEqual([]);
    expect(checkAnachronism("shelf-michelson-morley")).toEqual([]);
    // The positive half, so the exemption cannot be a way to silence the rule: the moment the
    // same words are written as a sentence, the flag is back.
    expect(
      checkAnachronism("Michelson-Morley is why Einstein wrote the paper.").map((f) => f.ruleId),
    ).toContain("michelson-morley-sole-cause");
  });

  test("ordinary 1904 prose produces nothing", () => {
    const honest =
      "A careful reader at the end of 1904 has Planck's radiation law, the gas laws, and no way to " +
      "count molecules directly. The difficulty is that the classical equipartition result diverges " +
      "at short wavelengths.";
    expect(checkAnachronism(honest)).toEqual([]);
  });

  test("every rule is planted, and the table is not empty", () => {
    // The structural guard: a rule added without a plant fails here instead of shipping
    // unexercised, which is how an unused check stays broken.
    const ruleIds = ANACHRONISM_RULES.map((r) => r.id).sort();
    expect(Object.keys(PLANTS).sort()).toEqual(ruleIds);
    expect(ANACHRONISM_RULES.length).toBeGreaterThanOrEqual(11);
    // Each rule says what is wrong and what to do instead, because a finding a reader of the
    // output cannot act on is a complaint rather than a lint.
    for (const rule of ANACHRONISM_RULES) {
      expect(rule.problem.length).toBeGreaterThan(40);
      expect(rule.treatment.length).toBeGreaterThan(40);
    }
  });
});
