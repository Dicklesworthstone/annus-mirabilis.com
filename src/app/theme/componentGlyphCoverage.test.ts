/**
 * The component half of the glyph gate. contentGlyphCoverage.test.ts proves that every character the
 * content/ corpus uses is drawn by a self-hosted face; nothing proved the same for text written in
 * the laboratories' source. On 2026-09-23 a scan of that source found 32 characters that none of
 * Newsreader, Plus Jakarta Sans or JetBrains Mono has (ⁿ, ₘ, ₓ, ₛ, ₐ, ᵦ, ₖ, ∇, ∮, ∝, ∓, ⟹), each
 * drawn from a system face in the middle of a line. They were fixed in c5ac3b9c, cb0b3ca3 and
 * c2538674; this keeps them fixed.
 *
 * IT READS CODE, NOT TEXT. The TypeScript AST yields string literals, template pieces and JSX text
 * and never a comment, so a comment quoting a forbidden glyph (including the ones in this header)
 * cannot fail it. Two kinds of string are skipped because KaTeX draws them in its own fonts:
 * String.raw templates, and values given to a property or attribute named latex or tex. The
 * tests below prove each of those decisions in both directions.
 *
 * Not counted: whitespace (a narrow no-break space falls back invisibly) and invisible format
 * characters (bidi isolates). Scope: the laboratories, embeds and the catalogue, and the physics
 * reference owners, whose refusal reasons and notes reach readers.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { loadCmap } from "./fontGlyphs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCOPE = [
  "src/components/lab",
  "src/components/embed",
  "src/reasoning",
  "src/app/lab",
  "src/app/embed",
  "src/app/instruments",
  "src/experiments",
  "src/physics/reference",
  // The foundation lessons, the Discover routes and the equation explorer, added 2026-09-23 after
  // RepeatedProportionalTable shipped ⁿ from a system face: this scope did not reach them.
  "src/components/foundations",
  "src/components/discover",
  "src/discovery",
  "src/app/discover",
  "src/app/foundations",
  "src/equations",
];

/**
 * Characters a file needs as data, never shown to a reader: a validator's list of characters to
 * reject in a reader's input. Keyed by file AND character, not by line, so a new glyph elsewhere in
 * the same file is still caught.
 */
const NOT_READER_FACING: ReadonlyArray<Readonly<{ file: string; char: string; why: string }>> = [
  {
    file: "src/discovery/checks/moveSummaryGuard.ts",
    char: "∝",
    why: "FORBIDDEN_MATH_CHARS: symbols a plain-language move summary may not contain",
  },
  {
    file: "src/discovery/exercises/normalize.ts",
    char: "⋅",
    why: "MULTIPLY_SIGNS: a dot operator a reader may type, normalized to *",
  },
];
const exempt = (h: Hit) =>
  NOT_READER_FACING.some((e) => h.where.startsWith(`${e.file}:`) && h.char === e.char);

function loadFont(relativePath: string) {
  const buffer = readFileSync(join(REPO_ROOT, "public/fonts", relativePath));
  return loadCmap(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  );
}
const FONTS = [
  loadFont("newsreader/Newsreader-Variable.ttf"),
  loadFont("plus-jakarta-sans/PlusJakartaSans-Variable.ttf"),
  loadFont("jetbrains-mono/JetBrainsMono-Variable.ttf"),
];

function drawn(char: string): boolean {
  if (/^[\p{Zs}\p{Cf}\s]$/u.test(char)) return true;
  const codePoint = char.codePointAt(0) ?? 0;
  return codePoint < 0x80 || FONTS.some((font) => font.hasGlyph(codePoint));
}

const KATEX_NAMES = /^(latex|tex)$/i;

type Hit = Readonly<{ char: string; where: string }>;

/** Every undrawn character in the reader-facing strings of one source file. */
function scanSource(fileName: string, source: string): { hits: Hit[]; strings: number } {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits: Hit[] = [];
  let strings = 0;
  const skipped = (node: ts.Node): boolean => {
    for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
      if (ts.isTaggedTemplateExpression(p) && p.tag.getText(file) === "String.raw") return true;
      if (ts.isJsxAttribute(p) && KATEX_NAMES.test(p.name.getText(file))) return true;
      if (ts.isPropertyAssignment(p) && KATEX_NAMES.test(p.name.getText(file))) return true;
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    }
    return false;
  };
  const visit = (node: ts.Node): void => {
    const text =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
        ? node.text
        : undefined;
    if (text !== undefined && !skipped(node)) {
      strings++;
      for (const char of text) {
        if (drawn(char)) continue;
        const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
        hits.push({ char, where: `${fileName}:${line + 1}` });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { hits, strings };
}

function sourceFiles(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(entry) && !/\.(test|fixture)\.|\.d\.ts$/.test(entry)) out.push(path);
  }
  return out;
}

describe("componentGlyphCoverage: laboratory text is drawn by a self-hosted face", () => {
  const files = SCOPE.flatMap((dir) => sourceFiles(join(REPO_ROOT, dir), []));
  const results = files.map((path) =>
    scanSource(relative(REPO_ROOT, path), readFileSync(path, "utf8")),
  );

  test("the scan reads real source: hundreds of files and thousands of strings", () => {
    // Floors, not a census: 464 files and far more strings on 2026-09-23. An empty scope or a
    // parser that returned nothing would pass the next test vacuously.
    expect(files.length).toBeGreaterThan(200);
    expect(results.reduce((sum, r) => sum + r.strings, 0)).toBeGreaterThan(5000);
  });

  test("no reader-facing string uses a character that none of the three faces draws", () => {
    const hits = results.flatMap((r) => r.hits).filter((h) => !exempt(h));
    expect(
      hits.map(
        (h) => `U+${(h.char.codePointAt(0) ?? 0).toString(16).toUpperCase()} ${h.char} ${h.where}`,
      ),
    ).toEqual([]);
  });

  test("a glyph in a string literal or JSX text is found; in a comment it is not", () => {
    const code = [
      "// ∝ quoted in a line comment",
      "/* ∝ quoted in a block comment */",
      'const label = "I ∝ 1/r"; // a trailing comment must not hide the literal before it',
      "/* a block comment must not swallow the code after it */ const s = `W = fⁿ`;",
      "export const V = () => <p>A<sub>m</sub> or Aₘ</p>;",
    ].join("\n");
    const found = scanSource("fixture.tsx", code).hits.map((h) => h.char);
    expect(found).toEqual(["∝", "ⁿ", "ₘ"]);
  });

  test("TeX handed to KaTeX is skipped, and the same glyph outside it is not", () => {
    const code = [
      "const a = String.raw`u_{\\mathrm{rel}} ∝ v`;",
      'const b = { latex: "⟹", caption: "⟹" };',
      'export const F = () => <Formula latex="∮" title="∮" />;',
    ].join("\n");
    const found = scanSource("fixture.tsx", code).hits.map((h) => h.char);
    expect(found).toEqual(["⟹", "∮"]);
  });

  test("whitespace and invisible format characters are not counted, a missing letter is", () => {
    // U+202F narrow no-break space and U+2066 left-to-right isolate are in no face and draw
    // nothing visible; U+207F ⁿ is in no face and draws a letter.
    const [nnbsp, isolate, n] = [0x202f, 0x2066, 0x207f].map((c) => String.fromCodePoint(c));
    const found = scanSource("fixture.ts", `const t = "a${nnbsp}b${isolate}c${n}";`).hits;
    expect(found.map((h) => h.char)).toEqual([n]);
  });
});
