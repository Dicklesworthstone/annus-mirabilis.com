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
import { blankComments } from "../src/testing/source/comments.ts";
import { reportPopulation } from "./gate-census/population.ts";

/** `file:line` sites where the uppercase form is a different thing that merely spells the same. */
export const ACCEPTED_COLLISIONS: ReadonlyMap<string, string> = new Map([
  [
    "src/content/kernel/closurePins.test.ts:FILE_NOT_FOUND",
    "A hash sentinel in an actualHash field, not a refusal code. The kebab 'file-not-found' " +
      "belongs to GeneratedSectionError in src/content/provenance/writeGeneratedSection.ts.",
  ],
  [
    "src/testing/outFreshness.test.ts:UNADMITTED_DIGEST",
    "A hex digest string used as test data, not a refusal code. Line 40 reads " +
      '`const UNADMITTED_DIGEST = "ffffffffffffeeeeeeeeeeee0000000011111111deadbeef"`, sitting ' +
      "beside DIGEST and HEAD_SHA, and line 125 passes it as makeFixture({ manifestDigest: ... }). " +
      "The kebab 'unadmitted-digest' is a worker-protocol refusal in src/workers/protocol/provenance.ts " +
      "and has never been spelled this way anywhere.",
  ],
  [
    "scripts/ocr-adapters/types.ts:FACSIMILE_DIGEST_MISMATCH",
    "A member of OcrRefusalCode, the cloud-OCR dispatch subsystem's own 16-code union, not a " +
      "survivor of the kebab rename. Proven rather than argued: `git log -S FACSIMILE_DIGEST_MISMATCH " +
      "-- src/reader/facsimile/` is EMPTY, so the reader's 'facsimile-digest-mismatch' never wore " +
      "this spelling. The two were authored independently - the OCR union in b2225181 (2026-09-16), " +
      "the reader's code born kebab in 855ae33d (2026-09-20) - and describe different refusals that " +
      "happen to share a name: an OCR plan failing digest validation, and a served scan failing its " +
      "pinned digest. See the note below this map about the 16 unconverted OCR codes.",
  ],
  [
    "scripts/ocr-ledgers.test.ts:FACSIMILE_DIGEST_MISMATCH",
    "Asserts the OcrRefusalCode member above, in the subsystem's own spelling. Same evidence.",
  ],
  [
    "scripts/sources/ocrPlanSchema.ts:FACSIMILE_DIGEST_MISMATCH",
    "Emits the OcrRefusalCode member above, in the subsystem's own spelling. Same evidence.",
  ],
  [
    "src/reader/paperRoutes.ts:BIBLIOGRAPHIC_KEY",
    "A regular-expression constant matching ap-<volume>-<page>, not a refusal code. Line 62 " +
      'holds both spellings at once - `if (BIBLIOGRAPHIC_KEY.test(raw)) return "bibliographic-key";` ' +
      "- the constant and the route kind it returns.",
  ],
  // THE SEVEN ADDED ON 2026-10-06, when this gate was found RED in the chain it is required in.
  // It reported 20 surviving code references across seven files and two spellings. Both spellings
  // are proven never to have been a refusal code, by the same test the entries above use, and the
  // proof is the strongest form available: a search of the WHOLE history for the spelling as a
  // string literal returns nothing.
  //
  //   git log --oneline -S'"AGENT_REVIEW_BASIS"'  --all   ->  0 commits
  //   git log --oneline -S'"TEAM_ID_PLACEHOLDER"' --all   ->  0 commits
  //
  // So neither kebab code has ever been written in the old form anywhere, ever, and these are
  // collisions of the kind the header's KNOWN LIMIT describes rather than survivors of the rename.
  //
  // Each is also a collision with a VALUE that is not a code, which is what distinguishes it:
  // AGENT_REVIEW_BASIS holds a decision id and TEAM_ID_PLACEHOLDER holds an Apple placeholder
  // string. That observation is general - FILE_NOT_FOUND above is a hash sentinel, UNADMITTED_DIGEST
  // a hex digest, BIBLIOGRAPHIC_KEY a regular expression - and a value-aware rule would make this
  // map much shorter. Changing the classifier is a larger decision than unblocking the chain, and is
  // recorded on am-p465 rather than taken here.
  [
    "src/content/schemas/source.ts:AGENT_REVIEW_BASIS",
    "A constant holding a DECISION ID, `export const AGENT_REVIEW_BASIS = " +
      '"D-2026-09-25-agent-reviewed-translations"` at line 2032, arrived with the agent-review work ' +
      "in 661d6534. The kebab 'agent-review-basis' is the refusal this same file returns two lines " +
      "below a USE of that constant: `if (o.basis !== AGENT_REVIEW_BASIS)` refuses with " +
      '"agent-review-basis". The constant names the value a unit must carry and the code names the ' +
      "failure to carry it, so both spellings legitimately coexist within six lines.",
  ],
  [
    "src/content/schemas/agentReview.test.ts:AGENT_REVIEW_BASIS",
    "Imports and passes the decision-id constant above as a default argument. Same evidence.",
  ],
  [
    "src/reader/faces/agentChecked.render.test.tsx:AGENT_REVIEW_BASIS",
    "Imports the decision-id constant above to build a reviewed TranslationUnit. Same evidence.",
  ],
  [
    "scripts/app/identity.ts:TEAM_ID_PLACEHOLDER",
    "A constant holding an Apple placeholder VALUE, `export const TEAM_ID_PLACEHOLDER = " +
      '"OWNER_SUPPLIES_APPLE_TEAM_ID"` at line 12, moved out of its test by 66b37210. The kebab ' +
      "'team-id-placeholder' is a member of AssociationErrorCode in scripts/app/association-file.ts, " +
      "the code returned when the association file still carries that placeholder. Neither spelling " +
      "is the other: one is the string being looked for, the other is the refusal for finding it.",
  ],
  [
    "scripts/app/association-file.ts:TEAM_ID_PLACEHOLDER",
    "Compares the parsed team id against the placeholder constant above and returns the kebab code " +
      "when they are equal, so this file holds both spellings at once for the same reason " +
      "paperRoutes.ts does. Same evidence.",
  ],
  [
    "scripts/app/association-file.test.ts:TEAM_ID_PLACEHOLDER",
    "Builds a fixture carrying the placeholder value and asserts the kebab refusal. Same evidence.",
  ],
  [
    "scripts/app/identity.test.ts:TEAM_ID_PLACEHOLDER",
    "Asserts the parser's handling of the placeholder constant above. Same evidence.",
  ],
]);

/**
 * WHAT THIS CHECK STRUCTURALLY CANNOT SEE, recorded here because four of the entries above would
 * otherwise read as the debt being handled.
 *
 * The check starts from kebab codes THROWN somewhere and looks for their uppercase form. So an
 * unconverted code is only visible when some other subsystem happens to have coined its kebab
 * twin. `OcrRefusalCode` in scripts/ocr-adapters/types.ts holds SIXTEEN SCREAMING_SNAKE codes,
 * and exactly one of them - FACSIMILE_DIGEST_MISMATCH - has a kebab twin elsewhere in the tree.
 * The other fifteen (CHUNK_TOO_LARGE, CONCURRENCY_TOO_HIGH, PAGE_RANGE_OUT_OF_BOUNDS,
 * MULTI_SOURCE_PLAN, CLOUD_PROCESSING_NOT_PERMITTED, NO_ADAPTER, FORBIDDEN_ADAPTER_NAME,
 * FIXTURE_ADAPTER_OUTSIDE_TEST, RENDERER_UNAVAILABLE, WORKER_IDENTITY_MISMATCH,
 * ADAPTER_UNAVAILABLE, ADAPTER_AUTH, ADAPTER_QUOTA, ADAPTER_BAD_RESPONSE, ADAPTER_TIMEOUT) are
 * invisible to it and always were.
 *
 * So silencing the one visible member loses nothing this check was measuring: it never measured
 * the other fifteen. The owner's kebab ruling still applies to that union, and converting it is a
 * separate batch against a subsystem whose dispatch interface does not exist yet
 * (am-src-ocr-dispatch-interface-m1ur). That debt belongs on a bead, not in this map.
 */

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

/**
 * Blank every comment BODY, keeping the file's length and its newlines (am-rc1001-bridge-plan-pcjk.9).
 *
 * The classifying half below has excluded comments since the beginning. The COLLECTING half did not,
 * and read a comment that quotes a refusal code as a site that throws one, which is AGENTS.md's "a
 * gate that forbids a construct must read code, not text" in the half that builds the denominator
 * rather than the half that judges. A comment quoting a code made the gate hunt for that code's
 * uppercase form across the whole tree, which inflates the reported population and could in principle
 * manufacture a survivor out of two unrelated comments.
 *
 * Found by this gate's own new test: a docblock explaining the test's fixture quoted
 * `throw new Error("zz-planted-code")`, and that invented code entered the real code set.
 *
 * MEASURED BEFORE CHANGING IT, because stripping could in principle lose a real code. Over every
 * tracked source at 441ac4d6: 1695 codes raw, 1694 with comments blanked, exactly one lost, and the
 * one lost is `zz-planted-code` from that docblock. Nothing is gained, so no comment was hiding a code
 * the collector needed. A code that appears ONLY in a comment is not a code this check can be about.
 *
 * Bodies are blanked rather than deleted so that offsets and line numbers are unchanged, which keeps
 * this usable beside the offset-based classification below.
 */
/**
 * Blanking moved to src/testing/source/comments.ts (a SCANNER, not two regexes).
 *
 * The pair that used to live here read a double slash inside a string - `"https://example.com"` - as the start
 * of a line comment and blanked the rest of the line, code included: a silent miss. Three gates had written
 * the same pair separately. Re-exported so this module's existing importers and its own test keep working.
 */
export { blankComments } from "../src/testing/source/comments.ts";

export interface RenameSurvivorReport {
  /** How many tracked sources were read. The denominator every count below rests on. */
  readonly filesExamined: number;
  readonly thrownCodes: number;
  readonly mentions: number;
  readonly prose: number;
  readonly survivors: readonly RenameSurvivor[];
}

/**
 * Read every tracked source this check examines. Separated from the judging half below so that half
 * can be tested at all (am-rc1001-bridge-plan-pcjk.9, 2026-10-06).
 *
 * This gate had NO test. `findRenameSurvivors` was exported and imported by nothing, its only
 * consumer was the registry entry, and its classification - which the header rightly calls "the whole
 * value" - was unproven in both directions. It was also RED in the chain it is required in, and
 * finding that took running it by hand. A gate that cannot be driven with a known input cannot be
 * shown to bite, and an exclusion list that grows without such a proof is indistinguishable from a
 * weakened gate.
 */
export function readTrackedSources(root: string): Map<string, string> {
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(ts|tsx|mts|mjs|json)$/.test(f));
  const sources = new Map<string, string>();
  for (const f of files) sources.set(f, readFileSync(path.join(root, f), "utf8"));
  return sources;
}

export function findRenameSurvivors(root: string): RenameSurvivorReport {
  return findRenameSurvivorsIn(readTrackedSources(root));
}

/** The judging half: given the sources, which old-form mentions are survivors and which are prose. */
export function findRenameSurvivorsIn(sources: ReadonlyMap<string, string>): RenameSurvivorReport {
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
  for (const raw of sources.values()) {
    // Comments blanked: see blankComments above. A comment that QUOTES a code is not a site.
    const source = blankComments(raw);
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
  return { filesExamined: sources.size, thrownCodes: thrown.size, mentions, prose, survivors };
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("check-renamed-refusal-codes.ts")) {
  const root = process.cwd();
  const result = findRenameSurvivors(root);
  console.log("=== Renamed refusal codes: both-sides check (am-p465) ===");
  // The population this check rests on is the FILES, not the codes: a run that read ten sources would
  // report few codes and no survivors and read exactly like a clean tree (am-rc1001-bridge-plan-pcjk.9).
  // 4344 tracked .ts/.tsx/.mts/.mjs/.json sources were measured on 2026-10-06 - a different filter
  // from ocr-guard's 4083, which is why the number is printed rather than shared. The floor is a
  // quarter of that.
  const censusVacuous = reportPopulation({
    gate: "renamed-refusal-codes",
    examined: result.filesExamined,
    noun: "tracked sources",
    minimum: 1000,
  });
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
  process.exit(result.survivors.length === 0 && !censusVacuous ? 0 : 1);
}
