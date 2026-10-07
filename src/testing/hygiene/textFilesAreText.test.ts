/**
 * NO AUTHORED TEXT FILE CARRIES A CONTROL BYTE THAT MAKES A TOOL TREAT IT AS BINARY.
 *
 * `src/content/ids.ts` used a NUL as the separator in a composite map key, typed as a raw byte
 * rather than as `\u0000`. That is a sound separator and an unsound spelling, and the consequence
 * was not a parse error anywhere. It was silence, in the direction that reads as success:
 *
 *     bunx biome check src/content/ids.ts   ->  Checked 0 files in 338us.   exit 0
 *     grep -c parseInstrumentId <that file> ->  no output
 *     rg -l 'export type SectionId' src     ->  nothing
 *
 * So the repository's fast-lane linter told every pane a 34 KB module was clean by examining none
 * of it, and any directory sweep with `rg` skipped it. `git grep` and `rg` given the explicit path
 * do read it, which is why it went 20 days unnoticed: half the instruments saw the file.
 *
 * This guard is added while the population is clean, because a floor set at a measured zero is the
 * only kind that cannot become a budget to draw on.
 *
 * It deliberately does not live only in the lane it protects. `binaryBytes` is a pure function over
 * bytes, proved below in both directions against hand-written specimens, so it remains a statement
 * about this repository even if the walk is ever broken: a walk that found nothing fails the
 * population floor rather than passing quietly.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { reportPopulation } from "../../../scripts/gate-census/population.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * The extensions whose files are read as text by a person, a linter or a grep. A file outside this
 * set (a webp, a pdf, a woff2) is binary on purpose and is not the subject here.
 */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonl",
  ".yaml",
  ".yml",
  ".md",
  ".css",
  ".txt",
  ".csv",
  ".html",
  ".svg",
  ".toml",
  ".swift",
  ".rs",
  ".sh",
]);

/**
 * The trees this repository authors. `public/` and `generated/` are left out because they are
 * served and generated output: together they are 42,887 of the 50,444 text files a walk from the
 * root reaches, and a NUL in a build product is a fact about its generator, not about the corpus.
 * `public/papers` is the exception worth keeping, since the ledgers and receipts are authored.
 */
const AUTHORED_TREES: readonly string[] = [
  "src",
  "scripts",
  "content",
  "docs",
  "ios",
  "perf",
  ".beads",
  "public/papers",
];

const SKIP_DIRECTORIES: ReadonlySet<string> = new Set([
  ".git",
  "node_modules",
  ".next",
  "out",
  "artifacts",
  "coverage",
  "dist",
  "build",
]);

/**
 * Every file under the authored trees with a text extension.
 *
 * This walks the filesystem rather than asking git, for a reason measured and recorded in
 * `beadsCommitScope.test.ts`: bun cannot spawn git in this environment at all, and both
 * `execFileSync` and `Bun.spawnSync` fail with `EBADF ... posix_spawn '/usr/bin/git'`. Keeping the
 * walk native keeps this cheap byte scan in the fast lane instead of pushing it into the node lane
 * and changing shared lane membership for one gate.
 */
export function authoredTextFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    let names: readonly string[];
    try {
      names = readdirSync(dir);
    } catch {
      return; // a tree this checkout does not have is not a finding
    }
    for (const name of names) {
      if (SKIP_DIRECTORIES.has(name)) continue;
      const full = join(dir, name);
      let isDirectory: boolean;
      try {
        isDirectory = statSync(full).isDirectory();
      } catch {
        continue; // a dangling symlink is not this gate's subject
      }
      if (isDirectory) walk(full);
      else if (TEXT_EXTENSIONS.has(extname(name))) files.push(relative(root, full));
    }
  };
  for (const tree of AUTHORED_TREES) walk(join(root, tree));
  return files.sort();
}

/**
 * The bytes that make a tool call a file binary. NUL is the one that bit; the other C0 controls
 * outside tab, newline and carriage return are included because they have the same effect on
 * `grep` and the same honest spelling as an escape.
 */
export function binaryBytes(bytes: Uint8Array): readonly { offset: number; byte: number }[] {
  const found: { offset: number; byte: number }[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] as number;
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
    if (byte < 0x20 || byte === 0x7f) found.push({ offset: i, byte });
  }
  return found;
}

/** The line and column of a byte offset, so a failure names a place a reader can open. */
function locate(bytes: Uint8Array, offset: number): string {
  let line = 1;
  let lastBreak = -1;
  for (let i = 0; i < offset; i++) {
    if (bytes[i] === 0x0a) {
      line++;
      lastBreak = i;
    }
  }
  return `line ${line}, column ${offset - lastBreak}`;
}

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("the detector reaches its predicate in both directions", () => {
  test("a raw NUL is found, and its offset named", () => {
    const planted = `const key = \`\${a}${"\u0000"}\${b}\`;\n`;
    expect(binaryBytes(encode(planted))).toEqual([{ offset: 17, byte: 0 }]);
    expect(locate(encode(planted), 17)).toBe("line 1, column 18");
  });

  test("the escape that replaces it is ordinary text, which is the whole repair", () => {
    // The distinction this gate enforces: the two produce the same string at runtime, and only
    // one of them leaves the file readable by grep and lintable by biome.
    expect(`a${"\u0000"}b`).toBe("a\u0000b");
    expect(binaryBytes(encode('const separator = "\\u0000";\n'))).toEqual([]);
  });

  test("other C0 controls are found; tab, newline and carriage return are not", () => {
    expect(binaryBytes(encode("a\tb\nc\r\n"))).toEqual([]);
    expect(binaryBytes(encode("a\u0001b")).map((f) => f.byte)).toEqual([1]);
    expect(binaryBytes(encode("a\u001bb")).map((f) => f.byte)).toEqual([0x1b]);
    expect(binaryBytes(encode("a\u007fb")).map((f) => f.byte)).toEqual([0x7f]);
  });

  test("a root with none of the authored trees yields nothing, rather than inventing files", () => {
    // The other half of the population floor below: if the walk ever stops finding the trees, it
    // must return an empty list so `examined < minimum` fails, never a plausible-looking subset.
    const empty = mkdtempSync(join(tmpdir(), "am-text-gate-"));
    expect(authoredTextFiles(empty)).toEqual([]);
  });

  test("ordinary source, accented German and mathematical glyphs are not reported", () => {
    // A multi-byte UTF-8 character is not a control byte, and a gate that said so would refuse the
    // German face, the ledgers and every equation record in the corpus.
    expect(binaryBytes(encode("daß ν⁄λ ⁻² ✓ 𝛽\n"))).toEqual([]);
    expect(binaryBytes(encode("export const x = 1;\n"))).toEqual([]);
  });
});

describe("no authored text file in this repository is binary", () => {
  const subjects = authoredTextFiles(ROOT);

  test("the population is this repository's authored text files, not an empty list", () => {
    // Measured 7,516 on 2026-10-07. The floor sits well below that so ordinary growth and pruning
    // do not touch it, and far above zero so a broken walk cannot pass as a clean sweep.
    const vacuous = reportPopulation({
      gate: "text-files-are-text",
      examined: subjects.length,
      noun: "authored text files",
      minimum: 3000,
    });
    expect(vacuous).toBe(false);
    // The walk reaches the trees this gate most exists for, so a skip list that grew too greedy
    // cannot leave it sweeping one corner while reporting a large count.
    expect(subjects).toContain(join("src", "content", "ids.ts"));
    for (const tree of ["content", "docs", "scripts"]) {
      expect(subjects.some((path) => path.startsWith(`${tree}/`))).toBe(true);
    }
  });

  test("none carries a NUL or other C0 control byte", () => {
    const offenders: string[] = [];
    for (const path of subjects) {
      const bytes = readFileSync(join(ROOT, path));
      const found = binaryBytes(bytes);
      if (found.length === 0) continue;
      const first = found[0] as { offset: number; byte: number };
      offenders.push(
        `${path}: ${found.length} control byte(s), first 0x${first.byte
          .toString(16)
          .padStart(2, "0")} at ${locate(bytes, first.offset)}. Write it as an escape ` +
          "(\\u0000) instead: the runtime string is identical and the file stays readable by " +
          "grep and lintable by biome.",
      );
    }
    expect(offenders).toEqual([]);
  });
});
