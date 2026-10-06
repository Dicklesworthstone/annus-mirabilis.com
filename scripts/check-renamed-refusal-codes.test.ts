/**
 * THE FIRST TEST THIS GATE HAS EVER HAD (am-rc1001-bridge-plan-pcjk.9, 2026-10-06).
 *
 * `check-renamed-refusal-codes.ts` is required in the preview and launch profiles and in CI, its
 * header says the classification "is the whole value", and nothing exercised it. `findRenameSurvivors`
 * was exported and imported by nothing; its only consumer was the registry entry that runs the script.
 * On 2026-10-06 it was found RED in the chain, reporting 20 surviving code references that were all
 * spelling collisions, and finding that out took running the gate by hand.
 *
 * The seven exclusions added that day are only defensible beside a proof that the gate still bites, so
 * that proof is here: a planted survivor must be reported, and an exclusion must silence exactly the
 * one file and spelling it names and nothing else.
 *
 * WHY THE FIXTURE SPELLINGS ARE BUILT AT RUNTIME. This file is tracked, so the real gate scans it. A
 * fixture containing both `throw new Error("zz-planted-code")` and the token ZZ_PLANTED_CODE in
 * scannable positions would add a kebab code to the gate's set and then find its old form here - a new
 * survivor, created by the test for the gate. Neither literal therefore appears in this source: both
 * are assembled from parts at run time. The gate correctly reading its own test as clean is itself a
 * small demonstration that it reads what is there.
 */

import { describe, expect, test } from "bun:test";
import {
  ACCEPTED_COLLISIONS,
  blankComments,
  findRenameSurvivorsIn,
  type RenameSurvivorReport,
} from "./check-renamed-refusal-codes.ts";

/** Built from parts so neither spelling is a literal in this file. See the docblock. */
const KEBAB = ["zz", "planted", "code"].join("-");
const OLD = KEBAB.toUpperCase().replaceAll("-", "_");
const OTHER_KEBAB = ["zz", "second", "code"].join("-");
const OTHER_OLD = OTHER_KEBAB.toUpperCase().replaceAll("-", "_");

/** A module that THROWS the kebab code, which is how the gate learns the code exists. */
const thrower = `export function refuse(): never {\n  throw new Error(${JSON.stringify(KEBAB)});\n}\n`;

const run = (entries: Record<string, string>): RenameSurvivorReport =>
  findRenameSurvivorsIn(new Map(Object.entries(entries)));

describe("the gate finds a survivor, and says so", () => {
  test("a kebab code thrown in one file and spelled in SCREAMING_SNAKE in another is a survivor", () => {
    const report = run({
      "src/thrower.ts": thrower,
      "src/stale.ts": `export const code = ${OLD};\n`,
    });
    expect(report.thrownCodes).toBe(1);
    expect(report.survivors.length).toBe(1);
    const only = report.survivors[0];
    expect(only?.file).toBe("src/stale.ts");
    expect(only?.oldForm).toBe(OLD);
    expect(only?.kebab).toBe(KEBAB);
    expect(only?.line).toBe(1);
  });

  test("a code that is RETURNED rather than thrown is still collected", () => {
    // The header records that a first version collected only thrown literals and a plant stayed
    // green, because most refusals here are returned. This is that lesson as an assertion.
    const report = run({
      "src/returner.ts": `export const r = { code: ${JSON.stringify(KEBAB)} };\n`,
      "src/stale.ts": `const x = ${OLD};\n`,
    });
    expect(report.thrownCodes).toBe(1);
    expect(report.survivors.length).toBe(1);
  });

  test("a union member of a type whose name ends in Code is collected; one in any other type is not", () => {
    // The scoping the header defends: a blanket union sweep produced 42 survivors, all collisions.
    const scoped = run({
      "src/codes.ts": `export type ThingCode = ${JSON.stringify(KEBAB)} | "zz-other-thing";\n`,
      "src/stale.ts": `const x = ${OLD};\n`,
    });
    expect(scoped.survivors.length).toBe(1);
    const unscoped = run({
      "src/kinds.ts": `export type ThingKind = ${JSON.stringify(KEBAB)} | "zz-other-thing";\n`,
      "src/stale.ts": `const x = ${OLD};\n`,
    });
    expect(unscoped.thrownCodes).toBe(0);
    expect(unscoped.survivors.length).toBe(0);
  });

  test("two codes are judged independently, so one clean code does not cover a dirty one", () => {
    const report = run({
      "src/thrower.ts": `${thrower}export function two(): never {\n  throw new Error(${JSON.stringify(OTHER_KEBAB)});\n}\n`,
      "src/stale.ts": `const x = ${OTHER_OLD};\n`,
    });
    expect(report.thrownCodes).toBe(2);
    expect(report.survivors.map((s) => s.kebab)).toEqual([OTHER_KEBAB]);
  });
});

describe("prose is not a survivor, in each of the three ways the gate admits", () => {
  test("a line comment naming the old form is prose", () => {
    const report = run({
      "src/thrower.ts": thrower,
      "src/doc.ts": `// renamed from ${OLD} to the kebab form\nexport const x = 1;\n`,
    });
    expect(report.mentions).toBe(1);
    expect(report.prose).toBe(1);
    expect(report.survivors).toEqual([]);
  });

  test("a block comment naming it is prose even when the mention is on an inner line", () => {
    // The header's reason for computing comment ranges over the whole file rather than per line.
    const report = run({
      "src/thrower.ts": thrower,
      "src/doc.ts": `/**\n * 10. Key claims exclusion: ${OLD}\n */\nexport const x = 1;\n`,
    });
    expect(report.prose).toBe(1);
    expect(report.survivors).toEqual([]);
  });

  test("a test title naming it is prose, and the same token outside the title is not", () => {
    const report = run({
      "src/thrower.ts": thrower,
      "src/some.test.ts": `test("refuses with ${OLD}", () => {\n  const x = ${OLD};\n});\n`,
    });
    expect(report.mentions).toBe(2);
    expect(report.prose).toBe(1);
    expect(report.survivors.length).toBe(1);
  });
});

describe("an accepted collision silences exactly what it names", () => {
  // THE PLANT THAT MAKES THE SEVEN NEW ENTRIES HONEST. An exclusion list is the shape a weakened gate
  // hides in, so the property worth asserting is not that the list works but that it is NARROW.
  const key = (file: string) => `${file}:${OLD}`;

  test("the real map's keys are file-scoped and spelling-scoped, not bare spellings", () => {
    // If a key were ever just a spelling, one entry would silence that spelling everywhere, which is
    // the difference between an excuse and a hole. Measured over the real map rather than asserted.
    expect(ACCEPTED_COLLISIONS.size).toBeGreaterThan(10);
    for (const k of ACCEPTED_COLLISIONS.keys()) {
      expect(k).toMatch(/^[\w./-]+\.(?:ts|tsx|mts|mjs|json):[A-Z][A-Z0-9_]*$/);
    }
  });

  test("every reason in the real map is a sentence, not a token", () => {
    // A one-word excuse is unreviewable. The shortest real reason today is about 90 characters.
    for (const [k, reason] of ACCEPTED_COLLISIONS) {
      expect(reason.length, `reason for ${k} is too short to review`).toBeGreaterThan(60);
    }
  });

  test("the seven added on 2026-10-06 are present, and name their files", () => {
    // THE KEYS ARE DERIVED, not typed out, and the reason is a finding this file produced about
    // itself. Writing the seven keys as literals put seven real old forms into a scannable position
    // in this file, and the gate - run over the staged tree - reported them as eight new survivors
    // (the eighth was the BIBLIOGRAPHIC_KEY plant below). The gate was right: nothing distinguishes a
    // spelling in a test's assertion from one in a stale comparison. So the uppercase form is built
    // from the kebab with the same transform the gate itself uses, which also means these assertions
    // would follow a change to that transform instead of silently disagreeing with it.
    for (const [file, kebab] of [
      ["src/content/schemas/source.ts", "agent-review-basis"],
      ["src/content/schemas/agentReview.test.ts", "agent-review-basis"],
      ["src/reader/faces/agentChecked.render.test.tsx", "agent-review-basis"],
      ["scripts/app/identity.ts", "team-id-placeholder"],
      ["scripts/app/association-file.ts", "team-id-placeholder"],
      ["scripts/app/association-file.test.ts", "team-id-placeholder"],
      ["scripts/app/identity.test.ts", "team-id-placeholder"],
    ] as const) {
      const k = `${file}:${kebab.toUpperCase().replaceAll("-", "_")}`;
      expect(ACCEPTED_COLLISIONS.has(k), `${k} is not recorded`).toBe(true);
    }
  });

  test("PLANTED: the same spelling in a file the map does not name is still a survivor", () => {
    // The narrowness, driven rather than read. The gate's own map cannot be used for a synthetic
    // spelling, so this drives the real loop with a real accepted key by borrowing one of the map's
    // own entries: `src/reader/paperRoutes.ts:BIBLIOGRAPHIC_KEY`.
    const accepted = "src/reader/paperRoutes.ts";
    const kebabForAccepted = "bibliographic-key";
    const oldForAccepted = kebabForAccepted.toUpperCase().replaceAll("-", "_");
    expect(ACCEPTED_COLLISIONS.has(`${accepted}:${oldForAccepted}`)).toBe(true);
    const report = run({
      "src/thrower.ts": `export const r = { code: ${JSON.stringify(kebabForAccepted)} };\n`,
      [accepted]: `const a = ${oldForAccepted};\n`,
      "src/elsewhere.ts": `const b = ${oldForAccepted};\n`,
    });
    expect(report.mentions).toBe(2);
    expect(report.prose).toBe(1);
    expect(report.survivors.map((s) => s.file)).toEqual(["src/elsewhere.ts"]);
    // And the control that keeps the line above from being vacuous: with the accepted file alone the
    // report is clean, so the exclusion really is what silenced it.
    const onlyAccepted = run({
      "src/thrower.ts": `export const r = { code: ${JSON.stringify(kebabForAccepted)} };\n`,
      [accepted]: `const a = ${oldForAccepted};\n`,
    });
    expect(onlyAccepted.survivors).toEqual([]);
    expect(onlyAccepted.mentions).toBe(1);
    // Unused here, kept so the helper above reads as what it is.
    expect(key("x.ts")).toBe(`x.ts:${OLD}`);
  });

  test("the gate's own file is the only one excluded wholesale", () => {
    const report = run({
      "src/thrower.ts": thrower,
      "scripts/check-renamed-refusal-codes.ts": `const x = ${OLD};\n`,
    });
    expect(report.mentions).toBe(0);
    expect(report.survivors).toEqual([]);
  });
});

describe("the collector reads code, not text", () => {
  // The defect this file found in the gate while being written: the CLASSIFYING half had excluded
  // comments from the start and the COLLECTING half had not, so a comment quoting a code made the gate
  // hunt for that code's uppercase form everywhere. Both directions are asserted, because a blanker
  // that removed everything would report an empty code set for ever and read as a clean tree.

  test("a code quoted only in a block comment is not collected", () => {
    const report = run({
      "src/doc.ts": `/**\n * Refuses with throw new Error("${KEBAB}") when the thing is absent.\n */\nexport const x = 1;\n`,
      "src/stale.ts": `const y = ${OLD};\n`,
    });
    expect(report.thrownCodes).toBe(0);
    expect(report.survivors).toEqual([]);
  });

  test("a code quoted only in a line comment is not collected", () => {
    const report = run({
      "src/doc.ts": `// throw new Error("${KEBAB}") used to live here\nexport const x = 1;\n`,
      "src/stale.ts": `const y = ${OLD};\n`,
    });
    expect(report.thrownCodes).toBe(0);
  });

  test("THE CONTROL: the same code in executable code IS collected and its old form IS found", () => {
    // Without this, the two cases above would also pass against a blanker that destroyed the file.
    const report = run({
      "src/doc.ts": `export function f(): never {\n  throw new Error(${JSON.stringify(KEBAB)});\n}\n`,
      "src/stale.ts": `const y = ${OLD};\n`,
    });
    expect(report.thrownCodes).toBe(1);
    expect(report.survivors.length).toBe(1);
  });

  test("a trailing line comment does not swallow the code before it", () => {
    const line = `  throw new Error(${JSON.stringify(KEBAB)}); // the refusal\n`;
    const report = run({
      "src/doc.ts": `export function f(): never {\n${line}}\n`,
      "src/stale.ts": `const y = ${OLD};\n`,
    });
    expect(report.thrownCodes).toBe(1);
  });

  test("a block comment does not swallow the code after it", () => {
    const report = run({
      "src/doc.ts": `/* a note */ export function f(): never {\n  throw new Error(${JSON.stringify(KEBAB)});\n}\n`,
      "src/stale.ts": `const y = ${OLD};\n`,
    });
    expect(report.thrownCodes).toBe(1);
  });

  test("blanking preserves length and line count, so offsets elsewhere stay valid", () => {
    const source = `const a = 1; // one\n/*\n two\n*/\nconst b = 2;\n`;
    const blanked = blankComments(source);
    expect(blanked.length).toBe(source.length);
    expect(blanked.split("\n").length).toBe(source.split("\n").length);
    expect(blanked).toContain("const a = 1;");
    expect(blanked).toContain("const b = 2;");
    expect(blanked).not.toContain("one");
    expect(blanked).not.toContain("two");
  });
});

describe("the population is reported, so a run over nothing is visible", () => {
  test("an empty source set yields zero codes and zero survivors, which must never read as a pass", () => {
    // AGENTS.md: zero files checked reads as clean. The gate exits 0 on `survivors.length === 0`, so
    // an empty corpus is indistinguishable from a clean one by the exit code alone. This records the
    // shape; the census (pcjk.9) is what refuses it, using the printed population.
    const report = run({});
    expect(report.thrownCodes).toBe(0);
    expect(report.mentions).toBe(0);
    expect(report.survivors).toEqual([]);
  });
});
