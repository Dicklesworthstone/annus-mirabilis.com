#!/usr/bin/env bun
/**
 * UNLABELLED ANACHRONISM IN THE DISCOVERY WORKSPACE (am-cm-anachronism-lint-dl2).
 *
 * The rules and their licences live in src/content/checks/anachronism/rules.ts, which states why
 * each one is a licence rather than a ban. This script is the population: which reader-facing
 * strings of the 1904 workspace are put to them.
 *
 * THE POPULATION IS THREE PLACES, and the third is why this script exists at all:
 *
 *   content/journeys/*.yaml               the four journeys' authored prose
 *   content/journey-explanations/*.yaml   the formulas' words and margins
 *   src/discovery/**\/*.ts and *.tsx      the stages, cards and first encounters
 *
 * Measured 2026-10-16 before the script was written: src/discovery holds about 412,800 characters
 * of long string literals in `.ts` modules against about 145,000 in `.tsx`. The voice linter's
 * extractor reads `.tsx` only (findTsxFiles), so a lint scoped to what that extractor returns
 * would have missed nearly three quarters of the prose it exists to check while reporting a clean
 * run. That is the vacuity AGENTS.md describes, and it is the reason for the extraction below
 * rather than a reuse.
 *
 * COMMENTS ARE BLANKED BEFORE STRINGS ARE READ, through the shared blankComments, because the
 * densest prose about an anachronism is the note explaining why it is one. Measured on this same
 * corpus: the only two occurrences of "photon" outside a test are a code comment describing "the
 * owner's photon-in-a-box evaluation" and a test asserting the word is banned. A scanner over raw
 * file text reports both; a scanner over string literals in comment-blanked source reports
 * neither, which is the difference between reading code and reading text.
 *
 * ERRORS FAIL, FLAGS DO NOT. A flag is a judgement a matcher cannot make, so it is printed with
 * the table's prescribed treatment for a reviewer and never fails a build.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type AnachronismFinding,
  checkAnachronism,
} from "../src/content/checks/anachronism/rules.ts";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import { blankComments } from "../src/testing/source/comments.ts";
import { reportPopulation } from "./gate-census/population.ts";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/*
  `--root <dir>` points the same populations at another tree, which is how this lint gets a
  positive control. A clean sweep and a sweep that cannot fail are the same output, so the control
  copies the real discovery content into a scratch root, plants one unlabelled phrase, and
  requires a non-zero exit. Without the flag the only way to run that control is to edit the
  shared checkout, which AGENTS.md is right to discourage.
*/
const rootFlag = process.argv.indexOf("--root");
const ROOT = rootFlag === -1 ? REPO : path.resolve(process.argv[rootFlag + 1] ?? REPO);

type Where = Readonly<{ file: string; hint: string }>;
type Reported = AnachronismFinding & Where;

/** Every string value in a parsed YAML or JSON document, with the key path that reached it. */
function* stringsOf(value: unknown, at = ""): Generator<readonly [string, string]> {
  if (typeof value === "string") {
    yield [value, at] as const;
    return;
  }
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) yield* stringsOf(item, `${at}[${i}]`);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      yield* stringsOf(item, at ? `${at}.${key}` : key);
    }
  }
}

function filesUnder(dir: string, endings: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (at: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(at);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(at, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === "__fixtures__" || entry.startsWith(".")) continue;
        walk(full);
      } else if (
        endings.some((e) => entry.endsWith(e)) &&
        !entry.includes(".test.") &&
        !entry.includes(".spec.")
      ) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * The string literals of a TypeScript module, read after its comments are blanked.
 *
 * Deliberately a regex over comment-blanked source rather than a parse: the blanking is what
 * makes it safe, since a quote inside a comment can no longer open a literal. Template literals
 * are read for their text and their `${...}` holes are left in, which can only ever add context
 * to a match, never remove it.
 */
function stringLiteralsOf(code: string): readonly string[] {
  const blanked = blankComments(code);
  const out: string[] = [];
  for (const m of blanked.matchAll(
    /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g,
  )) {
    const text = m[1] ?? m[2] ?? m[3] ?? "";
    if (text.trim()) out.push(text);
  }
  return out;
}

const findings: Reported[] = [];
let examined = 0;

for (const dir of ["content/journeys", "content/journey-explanations"]) {
  for (const file of filesUnder(path.join(ROOT, dir), [".yaml", ".json"])) {
    const raw = readFileSync(file, "utf8");
    const parsed = file.endsWith(".json") ? JSON.parse(raw) : parseYaml(raw);
    for (const [text, at] of stringsOf(parsed)) {
      examined += 1;
      for (const f of checkAnachronism(text)) {
        findings.push({ ...f, file: path.relative(ROOT, file), hint: at });
      }
    }
  }
}

for (const file of filesUnder(path.join(ROOT, "src/discovery"), [".ts", ".tsx"])) {
  for (const text of stringLiteralsOf(readFileSync(file, "utf8"))) {
    examined += 1;
    for (const f of checkAnachronism(text)) {
      findings.push({ ...f, file: path.relative(ROOT, file), hint: "string literal" });
    }
  }
}

const errors = findings.filter((f) => f.severity === "error");
const flags = findings.filter((f) => f.severity === "flag");

for (const group of [errors, flags]) {
  for (const f of group) {
    console.log(
      `${f.severity === "error" ? "ERROR" : "flag "} ${f.ruleId}  ${f.file} (${f.hint})\n` +
        `        matched: ${JSON.stringify(f.matched)}\n` +
        `        ${f.problem}\n` +
        `        repair:  ${f.treatment}`,
    );
  }
}

// The floor is 2000 because the three populations held far more than that when this was written,
// and a run that reads a few hundred has lost a directory rather than found a clean corpus.
const vacuous = reportPopulation({
  gate: "anachronism-lint",
  examined,
  noun: "discovery strings",
  minimum: 2000,
});
console.log(
  `[anachronism] ${examined} strings examined: ${errors.length} unlabelled anachronism(s), ` +
    `${flags.length} judgement call(s) for a reviewer`,
);

if (vacuous) {
  console.error(
    "[anachronism] REFUSED: fewer strings than the declared floor, so a clean result here would " +
      "be a statement about nothing.",
  );
  process.exit(1);
}
process.exit(errors.length > 0 ? 1 : 0);
