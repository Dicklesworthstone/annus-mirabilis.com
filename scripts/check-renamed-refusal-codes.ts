/**
 * Refuses a refusal-code rename that moved one side of an equality and left the other behind.
 *
 * am-p465. The owner ruled kebab-case refusal codes everywhere and the conversion of the 107
 * already written in SCREAMING_SNAKE. A migration like that has one characteristic failure: the
 * throw site is updated and a comparison, a union member, an object key, a test expectation or
 * a baseline entry is not. Both sides are typed `string`, so typecheck sees nothing; no unit
 * test drives the path, so the bun lane sees nothing; and it surfaces when a generator runs it
 * during prepare:content, one build at a time.
 *
 * This check runs after each batch. For every kebab code thrown anywhere in the tree it asks
 * whether the old SCREAMING_SNAKE spelling still appears in CODE.
 *
 * WHAT COUNTS AS A SURVIVOR, because the classification is the whole value. The first version of
 * this check reported 24 hits and 23 of them were documentation: a comment explaining a refusal,
 * a doc-comment line in a file header, or a test title naming the case it exercises. None of
 * those breaks when a code is renamed - a stale title is untidy, not wrong - and reporting them
 * buries the one hit that might matter. So comment ranges are computed over the whole file (a
 * per-line test cannot tell that " * 10. Key claims exclusion: LOCK_HELD" sits inside a block
 * comment) and the title strings of test/it/describe are excluded too.
 *
 * KNOWN LIMIT, stated rather than discovered later: an identifier unrelated to any refusal can
 * collide with a code's uppercase form. src/content/kernel/closurePins.test.ts writes
 * `actualHash: "FILE_NOT_FOUND"` as a hash sentinel, which has nothing to do with the
 * `file-not-found` thrown by GeneratedSectionError in another module. Such a collision is
 * recorded in ACCEPTED_COLLISIONS with its reason, and the list is the only way a hit is
 * silenced - there is no pattern that makes one disappear quietly.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/** `file:line` sites where the uppercase form is a different thing that merely spells the same. */
export const ACCEPTED_COLLISIONS: ReadonlyMap<string, string> = new Map([
  [
    "src/content/kernel/closurePins.test.ts:FILE_NOT_FOUND",
    "A hash sentinel in an actualHash field, not a refusal code. The kebab 'file-not-found' " +
      "belongs to GeneratedSectionError in src/content/provenance/writeGeneratedSection.ts.",
  ],
  [
    "src/reader/paperRoutes.ts:BIBLIOGRAPHIC_KEY",
    "A regular-expression constant matching ap-<volume>-<page>, not a refusal code. Line 62 " +
      'holds both spellings at once - `if (BIBLIOGRAPHIC_KEY.test(raw)) return "bibliographic-key";` ' +
      "- the constant and the route kind it returns.",
  ],
]);

/** The only excluded file: the one whose job is to name old forms. See the loop below. */
const SELF = "scripts/check-renamed-refusal-codes.ts";

export interface RenameSurvivor {
  readonly file: string;
  readonly line: number;
  readonly oldForm: string;
  readonly kebab: string;
  readonly text: string;
}

function commentRanges(source: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of source.matchAll(/\/\*[\s\S]*?\*\//g)) out.push([m.index, m.index + m[0].length]);
  for (const m of source.matchAll(/\/\/.*/g)) out.push([m.index, m.index + m[0].length]);
  return out;
}

/** The title string of test()/it()/describe(), which documents a case rather than referring to one. */
function titleRanges(source: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of source.matchAll(/\b(?:test|it|describe)\s*\(\s*(["'`])/g)) {
    const quote = m[1];
    const start = m.index + m[0].length;
    let i = start;
    while (i < source.length) {
      if (source[i] === "\\") {
        i += 2;
        continue;
      }
      if (source[i] === quote) break;
      i += 1;
    }
    out.push([start, i]);
  }
  return out;
}

const within = (ranges: readonly [number, number][], offset: number): boolean =>
  ranges.some(([a, b]) => offset >= a && offset < b);

export function findRenameSurvivors(root: string): {
  readonly thrownCodes: number;
  readonly mentions: number;
  readonly prose: number;
  readonly survivors: readonly RenameSurvivor[];
} {
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(ts|tsx|mts|mjs|json)$/.test(f));
  const sources = new Map<string, string>();
  for (const f of files) sources.set(f, readFileSync(path.join(root, f), "utf8"));

  // The code set is NOT just throw sites. Most refusals in this codebase are RETURNED - a
  // validator hands back { refusalCode } or { code } rather than throwing - and a first version
  // of this check collected only the thrown form with a literal code. Planting the old form back into
  // verify-facsimile-pins.ts left it GREEN, because "missing-verified-anchor" is returned and
  // never thrown, so the check was not looking for MISSING_VERIFIED_ANCHOR at all. A rename
  // check that covers a minority of the codes is worse than none: it reports a clean tree.
  const KEBAB = String.raw`([a-z0-9]+(?:-[a-z0-9]+)+)`;
  const SOURCES: readonly RegExp[] = [
    new RegExp(String.raw`throw new [A-Za-z0-9_]*Error\(\s*"${KEBAB}"`, "g"),
    new RegExp(String.raw`\b(?:code|refusalCode|errorCode)\s*:\s*"${KEBAB}"`, "g"),
  ];
  const thrown = new Set<string>();
  for (const source of sources.values()) {
    for (const re of SOURCES) for (const m of source.matchAll(re)) thrown.add(m[1] as string);
    // Union members, but ONLY from a type whose name ends in Code. A blanket `| "kebab"` sweep
    // took the code set from 956 to 2166 and produced 42 survivors, every one a collision:
    // BM01_COMPARISON (30), TS_FALLBACK (8), MODERN_SI_2019, BIBLIOGRAPHIC_KEY - constants whose
    // kebab spelling happens to exist somewhere as an unrelated string. A check whose hits are
    // all false is one nobody reads, so the union source is scoped to declared code types.
    for (const decl of source.matchAll(/type\s+\w*Code\s*=\s*([\s\S]*?);/g))
      for (const m of (decl[1] as string).matchAll(new RegExp(String.raw`"${KEBAB}"`, "g")))
        thrown.add(m[1] as string);
  }

  let mentions = 0;
  let prose = 0;
  const survivors: RenameSurvivor[] = [];
  for (const kebab of [...thrown].sort()) {
    const oldForm = kebab.toUpperCase().replace(/-/g, "_");
    const pattern = new RegExp(`\\b${oldForm}\\b`, "g");
    for (const [file, source] of sources) {
      // This file names old forms for a living: ACCEPTED_COLLISIONS keys are
      // "<path>:<OLD_FORM>" and the reasons quote the code they excuse. Scanning it reports
      // the check's own allowlist as three survivors, which is how this exclusion was found.
      // It is the only file excluded, and it is excluded because naming old forms is its
      // purpose rather than because its hits were inconvenient.
      if (file === SELF) continue;
      if (!source.includes(oldForm)) continue;
      const comments = commentRanges(source);
      const titles = titleRanges(source);
      for (const m of source.matchAll(pattern)) {
        mentions += 1;
        if (within(comments, m.index) || within(titles, m.index)) {
          prose += 1;
          continue;
        }
        if (ACCEPTED_COLLISIONS.has(`${file}:${oldForm}`)) {
          prose += 1;
          continue;
        }
        const line = source.slice(0, m.index).split("\n").length;
        survivors.push({
          file,
          line,
          oldForm,
          kebab,
          text: (source.split("\n")[line - 1] ?? "").trim().slice(0, 100),
        });
      }
    }
  }
  return { thrownCodes: thrown.size, mentions, prose, survivors };
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("check-renamed-refusal-codes.ts")) {
  const root = process.cwd();
  const result = findRenameSurvivors(root);
  console.log("=== Renamed refusal codes: both-sides check (am-p465) ===");
  console.log(`kebab codes thrown in the tree:   ${result.thrownCodes}`);
  console.log(`old-form mentions:                ${result.mentions}`);
  console.log(`  documentation or accepted:      ${result.prose}`);
  console.log(`  SURVIVING code references:      ${result.survivors.length}`);
  for (const s of result.survivors) {
    console.log(`\n  ${s.file}:${s.line}  ${s.oldForm}  (thrown elsewhere as "${s.kebab}")`);
    console.log(`      ${s.text}`);
  }
  if (result.survivors.length === 0) {
    console.log("\nNo renamed code has a surviving old-form reference in code.");
  }
  process.exit(result.survivors.length === 0 ? 0 : 1);
}
