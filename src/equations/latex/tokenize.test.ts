/**
 * Unit tests for the brace-aware LaTeX tokenizer (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 7:
 * 1. Control words and control symbols at depth 0 and inside braces, subscripts, superscripts, \text{...}, and aligned body.
 * 2. Environment names from \begin{pmatrix} and \end{pmatrix}, and mismatched \end{cases} as typed error.
 * 3. Unbalanced '{', extra '}', and trailing lone backslash with exact offsets.
 * 4. Offsets that point back to the exact source characters.
 * 5. Import scan of src/ ensuring no second LaTeX tokenizer exists.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import test from "node:test";
import { LatexTokenizerError, tokenizeLatex } from "./tokenize.ts";

test("tokenize.test: control words and control symbols at depth 0 and nested", () => {
  const input = "\\gamma \\, \\left({x_{i} + \\text{ref} + y^{\\alpha}}\\right)";
  const tokens = tokenizeLatex(input);

  const controlWords = tokens.filter((t) => t.kind === "control-word");
  const controlSymbols = tokens.filter((t) => t.kind === "control-symbol");

  assert.ok(controlWords.some((t) => t.value === "\\gamma" && t.depth === 0));
  assert.ok(controlSymbols.some((t) => t.value === "\\," && t.depth === 0));
  assert.ok(controlWords.some((t) => t.value === "\\left" && t.depth === 0));
  assert.ok(controlWords.some((t) => t.value === "\\text" && t.depth === 1));
  assert.ok(controlWords.some((t) => t.value === "\\alpha" && t.depth === 2));

  // Verify offsets point to exact characters in input
  for (const token of tokens) {
    if (token.kind !== "environment-begin" && token.kind !== "environment-end") {
      assert.equal(
        input.slice(token.offset, token.offset + token.value.length),
        token.value,
        `Token ${token.value} at offset ${token.offset} must match input slice`,
      );
    }
  }
});

test("tokenize.test: environments \\begin{pmatrix} ... \\end{pmatrix}", () => {
  const input = "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}";
  const tokens = tokenizeLatex(input);

  const beginToken = tokens.find((t) => t.kind === "environment-begin");
  const endToken = tokens.find((t) => t.kind === "environment-end");

  assert.ok(beginToken);
  assert.equal(beginToken.environmentName, "pmatrix");
  assert.ok(endToken);
  assert.equal(endToken.environmentName, "pmatrix");
});

test("tokenize.test: mismatched environment is a typed error", () => {
  const input = "\\begin{pmatrix} a & b \\end{cases}";
  assert.throws(
    () => tokenizeLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof LatexTokenizerError);
      assert.equal(err.kind, "mismatched-environment");
      assert.match(err.message, /expected \\end\{pmatrix\}, got \\end\{cases\}/);
      return true;
    },
  );
});

test("tokenize.test: unterminated environment is a typed error with offset", () => {
  const input = "\\begin{aligned} x = 1";
  assert.throws(
    () => tokenizeLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof LatexTokenizerError);
      assert.equal(err.kind, "unterminated-environment");
      assert.equal(err.offset, 0);
      assert.match(err.message, /Unterminated environment \\begin\{aligned\}/);
      return true;
    },
  );
});

test("tokenize.test: unbalanced open brace '{' is a typed error with offset", () => {
  const input = "\\frac{a}{b";
  assert.throws(
    () => tokenizeLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof LatexTokenizerError);
      assert.equal(err.kind, "unbalanced-open-brace");
      assert.equal(err.offset, 8); // Offset of the unclosed '{' before 'b'
      return true;
    },
  );
});

test("tokenize.test: extra closing brace '}' is a typed error with offset", () => {
  const input = "\\frac{a}{b}}";
  assert.throws(
    () => tokenizeLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof LatexTokenizerError);
      assert.equal(err.kind, "unbalanced-close-brace");
      assert.equal(err.offset, 11); // Offset of the extra '}'
      return true;
    },
  );
});

test("tokenize.test: trailing lone backslash is a typed error with offset", () => {
  const input = "x + \\";
  assert.throws(
    () => tokenizeLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof LatexTokenizerError);
      assert.equal(err.kind, "trailing-backslash");
      assert.equal(err.offset, 4);
      return true;
    },
  );
});

/**
 * A declaration in src/ that reads LaTeX, with the reason it is allowed to exist.
 *
 * The rule this gate enforces is "tokenizeLatex is the only LaTeX tokenizer in
 * src/". It used to decide that by asking whether a file's text contained one of
 * four literal spellings - "function tokenizeLatex", "class LatexTokenizer",
 * "export function tokenizeTeX", "class TeXTokenizer" - which is a denylist of
 * four names standing in for the category "this declaration tokenises LaTeX".
 *
 * A 168-line second tokenizer sat inside the very directory the rule names and
 * the gate scanned it every run: `function tokenizeTestLatex` at
 * parens.property.test.ts:204-371, which recognises \approx \cos \exp \frac
 * \langle \left \ln \pi \rangle \right \sin \sqrt. It matched none of the four
 * spellings, so the gate was green. It is a legitimate second implementation -
 * see its record below - and that is the point: a gate that passes on a spelling
 * never made anyone say so, and its green could not tell a deliberate
 * differential oracle from an accidental duplicate.
 *
 * An allowlist with reasons is what the rule actually means, and it is the shape
 * scripts/app-router-architecture.ts already uses for the same kind of claim.
 */
interface LatexTokenizerRecord {
  readonly path: string;
  readonly declaration: string;
  readonly reason: string;
}

export const DECLARED_LATEX_TOKENIZERS: readonly LatexTokenizerRecord[] = [
  {
    path: "src/equations/latex/tokenize.ts",
    declaration: "tokenizeLatex",
    reason:
      "The owner. Every other declaration that reads LaTeX in src/ has to be argued for in this list.",
  },
  {
    path: "src/equations/latex/tokenize.ts",
    declaration: "LatexTokenizerError",
    reason:
      "The owner's typed error, not an implementation. It is named like a tokenizer and lives beside one, so the detector reaches it; recorded rather than special-cased by name.",
  },
  {
    path: "src/equations/latex/tokenize.test.ts",
    declaration: "findLatexTokenizerDeclarations",
    reason:
      "This gate's own detector. It is named for what it looks for, so it looks like what it looks for; recorded here rather than excused by a path skip, because a path skip is how the previous version let a whole file past.",
  },
  {
    path: "src/equations/latex/parens.property.test.ts",
    declaration: "tokenizeTestLatex",
    reason:
      "A deliberately independent reader of rendered LaTeX, used by parseTestLatex to re-parse the renderer's own output and check that precedence survived. Sharing the owner's tokenizer would make that comparison vacuous: a defect in both would agree with itself. Its independence is the test, so it may not be deduplicated away.",
  },
];

/** Comment text is prose, not a declaration; stripping it first is what keeps this a code gate. */
export function stripCommentsForScan(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Blanks the CONTENTS of single-line string literals, keeping every offset.
 *
 * Only used for brace matching, so a `}` inside a string cannot end a body
 * early. It never spans a newline: pairing quotes across lines lets one stray
 * quote - and this file is full of regex literals containing quote characters -
 * blank out real declarations, which is exactly what happened when it did.
 * Bounded to a line, a mispairing can only damage that line.
 */
export function blankStringLiterals(code: string): string {
  return code.replace(
    /(["'`])(?:\\.|(?!\1)[^\\])*\1/gs,
    (literal, quote: string) => quote + " ".repeat(Math.max(0, literal.length - 2)) + quote,
  );
}

/**
 * Identifier segments, lowercased: "tokenizeTestLatex" -> ["tokenize","test","latex"].
 *
 * Segment membership rather than substring containment, because "lexer" occurs
 * inside "globa|lExer|ciseCheckerLogger" and an unanchored test flags it. That is
 * the same defect this gate is being repaired for, one level down.
 */
export function identifierSegments(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_$]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
}

const TOKENIZER_SEGMENTS = new Set([
  "tokenize",
  "tokenizer",
  "tokenise",
  "tokeniser",
  "tokenizing",
  "lex",
  "lexer",
  "lexing",
]);

/**
 * A declaration that BEGINS a line. The previous gate searched raw text and so
 * flagged its own source, where the four spellings it looked for appear as
 * string literals; a declaration quoted inside a string starts after the quote,
 * not at the start of a line.
 */
const DECLARATION =
  /^[ \t]*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
/** `\\frac` as it appears in TypeScript source: an escaped backslash then a control word. */
const LATEX_CONTROL_WORD = /\\\\[a-zA-Z]{2,}/g;
/** A string holding one backslash - how a generic LaTeX scanner spots a control sequence. */
const LONE_BACKSLASH_LITERAL = /["'`]\\\\["'`]/;

/**
 * The declaration's body as an offset range, by brace matching on the blanked
 * skeleton so braces inside strings do not confuse it, and so a nested `const`
 * does not truncate it the way "up to the next declaration" would.
 */
function declarationBodyRange(
  skeleton: string,
  from: number,
): { start: number; end: number } | null {
  const open = skeleton.indexOf("{", from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < skeleton.length; i++) {
    if (skeleton[i] === "{") depth++;
    else if (skeleton[i] === "}") {
      depth--;
      if (depth === 0) return { start: open, end: i + 1 };
    }
  }
  return { start: open, end: skeleton.length };
}

/**
 * Declarations in one file that read LaTeX, decided by category rather than spelling.
 *
 * A declaration counts when its name is tokenizer-shaped by SEGMENT and either its
 * name mentions TeX or its body carries LaTeX control-sequence literals. The arrow
 * form, `export const tokenizeLatex = (s) => ...`, and the capitalisations
 * `tokenizeLaTeX`, `class MathTokenizer`, `class KatexLexer` and `lexLatex` are all
 * reached, and none of them matched the four spellings this replaced.
 *
 * A name like `contextTokenizer` will be reached too. That costs one allowlist entry
 * with a reason, which is the gate working rather than failing.
 */
export function findLatexTokenizerDeclarations(source: string): string[] {
  const code = stripCommentsForScan(source);
  const skeleton = blankStringLiterals(code);
  const found: string[] = [];
  for (const match of code.matchAll(DECLARATION)) {
    const name = match[1] as string;
    if (!identifierSegments(name).some((segment) => TOKENIZER_SEGMENTS.has(segment))) continue;
    const from = (match.index as number) + match[0].length;
    const span = declarationBodyRange(skeleton, from);
    const body = span === null ? "" : code.slice(span.start, span.end);
    const controlWords = new Set([...body.matchAll(LATEX_CONTROL_WORD)].map((m) => m[0]));
    const readsLatex =
      name.toLowerCase().includes("tex") ||
      controlWords.size >= 1 ||
      LONE_BACKSLASH_LITERAL.test(body);
    if (readsLatex) found.push(name);
  }
  return found;
}

test("tokenize.test: every LaTeX tokenizer in src/ is recorded with a reason", () => {
  const rootSrc = join(process.cwd(), "src");

  function scanDir(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) {
        files.push(...scanDir(full));
      } else if (extname(full) === ".ts" || extname(full) === ".tsx" || extname(full) === ".mjs") {
        files.push(full);
      }
    }
    return files;
  }

  const found: { path: string; declaration: string }[] = [];
  for (const filePath of scanDir(rootSrc)) {
    const rel = relative(process.cwd(), filePath).split("\\").join("/");
    for (const declaration of findLatexTokenizerDeclarations(readFileSync(filePath, "utf8"))) {
      found.push({ path: rel, declaration });
    }
  }

  const isRecorded = (f: { path: string; declaration: string }): boolean =>
    DECLARED_LATEX_TOKENIZERS.some((r) => r.path === f.path && r.declaration === f.declaration);

  const unrecorded = found.filter((f) => !isRecorded(f)).map((f) => `${f.path}: ${f.declaration}`);
  assert.deepEqual(
    unrecorded,
    [],
    "tokenizeLatex must be the only LaTeX tokenizer in src/. These declarations read LaTeX " +
      "and are not recorded in DECLARED_LATEX_TOKENIZERS:\n" +
      `${unrecorded.join("\n")}\n` +
      "Remove the duplicate, or add a record saying why a second implementation is needed. " +
      "A second implementation may be right - a differential oracle needs one - but it has to be said.",
  );

  const stale = DECLARED_LATEX_TOKENIZERS.filter(
    (r) => !found.some((f) => f.path === r.path && f.declaration === r.declaration),
  ).map((r) => `${r.path}: ${r.declaration}`);
  assert.deepEqual(
    stale,
    [],
    `These records no longer describe anything in src/:\n${stale.join("\n")}\n` +
      "Delete them in the same commit. A record left behind is standing permission for a " +
      "future duplicate to reuse that name and path.",
  );

  for (const record of DECLARED_LATEX_TOKENIZERS) {
    assert.ok(
      record.reason.length >= 40,
      `${record.path}: ${record.declaration} needs a reason, not a label`,
    );
  }
});

test("tokenize.test: the detector catches the spellings the four literals missed", () => {
  // Each of these passed the old gate. The arrow form is the bead's planted negative.
  const escapes = [
    "export const tokenizeLatex = (s: string) => scan(s);",
    'function tokenizeLaTeX(input: string) { return input.split("\\\\"); }',
    'class MathTokenizer { next() { return "\\\\frac"; } }',
    "class KatexLexer { read() { return 0; } }",
    'function lexLatex(src: string) { if (src.startsWith("\\\\left")) return "\\\\right"; return ""; }',
  ];
  for (const source of escapes) {
    assert.notDeepEqual(
      findLatexTokenizerDeclarations(source),
      [],
      `not detected, so a second tokenizer written this way is invisible: ${source}`,
    );
  }
});

test("tokenize.test: the detector is a code gate, not a prose matcher", () => {
  // The direction that would get this switched off. This file, the bead and the
  // owner's own comments all contain the words below.
  const notTokenizers = [
    "// function tokenizeLatex is the only LaTeX tokenizer in src/",
    "/* class LatexTokenizer would be a duplicate of tokenizeLatex */",
    'const note = "do not write a second tokenizeLatex";',
    "function tokenizeGerman(text: string) { return text.split(/\\s+/); }",
    'function tokenize(src: string) { return src.split("@"); }',
  ];
  for (const source of notTokenizers) {
    assert.deepEqual(
      findLatexTokenizerDeclarations(source),
      [],
      `flagged, but this declares no LaTeX tokenizer: ${source}`,
    );
  }
});
