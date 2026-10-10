/**
 * NO PRODUCTION MODULE IMPORTS A WRONG COMPUTATION (am-ver-adversarial-audit-1ef).
 *
 * The bead's own words for why: "Keep wrong computations obviously named and isolated so they never
 * become fallbacks." The naming is what a reader enforces; this is the half a machine can.
 *
 * TWO THINGS THIS GETS RIGHT THAT A GREP WOULD NOT, both learned the hard way in this repository:
 *
 *   A MULTI-LINE IMPORT HEAD IS STILL AN IMPORT. A pattern of the form
 *   `import[^;\n]*?from "..."` cannot match the shape biome formats to, so every
 *   `import {\n  a,\n} from "./x.ts"` is invisible to it. A sweep built that way reported 183
 *   orphan modules in this repository and the true figure was 80.
 *
 *   A SPECIFIER IS RESOLVED, NOT MATCHED. `./wrongComputations.ts` resolves differently from every
 *   directory, so a basename comparison would credit or accuse the wrong file. Each specifier is
 *   joined to the importing file's own directory and compared with this module's real path.
 *
 * The population includes `scripts/` as well as `src/`, because scripts import into src with
 * ordinary relative specifiers and a src-only walk would call a script-side import invisible.
 */

import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ADVERSARIAL_ROWS } from "./wrongComputations.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
/** The modules no production file may import. */
const FORBIDDEN = [resolve(HERE, "wrongComputations.ts")];

/** Allows a newline between `import` and `from`, which is the formatted shape. */
const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*["']([^"']+)["']|(?:^|[^\w.])import\s*\(\s*["']([^"']+)["']/gm;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mts|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const isTestFile = (path: string) =>
  /\.(test|spec)\.(ts|tsx|mts|mjs)$/.test(path) ||
  path.startsWith(resolve(ROOT, "src/testing/adversarial"));

test("no production module imports a wrong computation, and the population is real", () => {
  const files = [...walk(resolve(ROOT, "src")), ...walk(resolve(ROOT, "scripts"))];
  const production = files.filter((f) => !isTestFile(f));
  console.log(
    `[adversarial imports] ${files.length} source files, ${production.length} of them production, checked against ${FORBIDDEN.length} test-only module(s)`,
  );
  // A walk that found nothing would make the assertion below vacuous.
  expect(production.length).toBeGreaterThan(1000);

  const offenders: string[] = [];
  for (const file of production) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(IMPORT_RE)) {
      const specifier = match[1] ?? match[2];
      if (!specifier?.startsWith(".")) continue;
      const target = resolve(dirname(file), specifier);
      if (FORBIDDEN.includes(target)) offenders.push(relative(ROOT, file));
    }
  }
  expect(offenders).toEqual([]);
});

test("PLANTED: the scan can see a multi-line import of a forbidden module", () => {
  // The instrument's own positive control. Without it, a regex that matched nothing would report
  // zero offenders for ever, and the formatted multi-line shape is exactly the one a naive pattern
  // misses. Both shapes are planted, because only the second is the one that went wrong before.
  const oneLine = 'import { wrongSeedTransport } from "./wrongComputations.ts";';
  const multiLine =
    'import {\n  wrongSeedTransport,\n  wrongDiffusivityScaling,\n} from "./wrongComputations.ts";';
  for (const text of [oneLine, multiLine]) {
    const specifiers = [...text.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);
    expect(specifiers).toContain("./wrongComputations.ts");
    const target = resolve(HERE, "./wrongComputations.ts");
    expect(FORBIDDEN.includes(target)).toBe(true);
  }
});

test("a specifier that merely shares a basename elsewhere is NOT an offence", () => {
  // Resolution, not matching: the same text from another directory points at another file.
  const fromElsewhere = resolve(ROOT, "src/physics/reference", "./wrongComputations.ts");
  expect(FORBIDDEN.includes(fromElsewhere)).toBe(false);
});

/**
 * THE ROW REGISTRY AGREES WITH THE FILES ON DISK (am-ver-adversarial-audit-1ef).
 *
 * Without this the registry is decoration: a row could be marked `implemented` with no test behind
 * it, or a row test could land while the registry still called it outstanding, and the audit's own
 * statement of progress would drift from the audit. Both directions are asserted.
 *
 * It also pins that all fifteen rows are present exactly once. Counting them with `grep -c
 * 'state: "implemented"'` gave 9 of 15 when the truth was 8, because the type declaration
 * `state: "implemented" | "not-yet"` contains both strings; the registry is counted by importing it.
 */
test("every row marked implemented has a test file, and every row test is marked implemented", () => {
  const files = readdirSync(HERE).filter((f) => /^row\d{2}\..*\.test\.ts$/.test(f));
  const onDisk = new Set(files.map((f) => Number(f.slice(3, 5))));
  const marked = new Set(
    ADVERSARIAL_ROWS.filter((r) => r.state === "implemented").map((r) => r.row),
  );
  console.log(
    `[adversarial rows] ${ADVERSARIAL_ROWS.length} rows, ${marked.size} marked implemented, ${onDisk.size} row test files on disk`,
  );
  expect(onDisk.size).toBeGreaterThan(0);
  expect([...onDisk].sort((a, b) => a - b)).toEqual([...marked].sort((a, b) => a - b));
});

test("all fifteen rows are declared exactly once, with an owner named for each", () => {
  const rows = ADVERSARIAL_ROWS.map((r) => r.row);
  expect(rows.length).toBe(15);
  expect(new Set(rows).size).toBe(15);
  expect(Math.min(...rows)).toBe(1);
  expect(Math.max(...rows)).toBe(15);
  for (const row of ADVERSARIAL_ROWS) {
    expect(row.owner.length, `row ${row.row} must name its owner module`).toBeGreaterThan(10);
    expect(row.claim.length).toBeGreaterThan(20);
  }
});
