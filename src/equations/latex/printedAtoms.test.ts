/**
 * Reading a printed display into atoms (printedAtoms.ts, dispatch 224). The failure this guards
 * against is the donor's: binding a glyph by finding its letter in the LaTeX, which colours the v
 * of \varphi, the E inside E_0, or a word inside \text{...}.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../../content/provenance/yaml.ts";
import {
  glyphSignature,
  markPrintedLatex,
  PrintedAtomError,
  printedAtoms,
} from "./printedAtoms.ts";

const texts = (latex: string) => printedAtoms(latex).map((a) => a.text);

test("a letter inside a command name, or inside \\text, is not an atom", () => {
  assert.deepEqual(texts("\\cos \\varphi"), ["\\varphi"]);
  assert.deepEqual(texts("\\text{const.} + \\mathrm{d}x"), ["x"]);
  // The naive reading this replaces finds a v in \varphi and a c, o, s in \cos.
  assert.equal(texts("\\cos \\varphi").includes("v"), false);
});

test("a name runs through its subscripts and decorations and stops at an exponent", () => {
  assert.deepEqual(texts("E_0 = E_1 + L"), ["E_0", "E_1", "L"]);
  assert.deepEqual(texts("l^* = l"), ["l^*", "l"]);
  assert.deepEqual(texts("x' + x^{\\prime\\prime}"), ["x'", "x^{\\prime\\prime}"]);
  assert.deepEqual(texts("\\overline{E}_\\nu = \\varrho_\\nu"), [
    "\\overline{E}_\\nu",
    "\\varrho_\\nu",
  ]);
  // V^2: the exponent is not part of V's name, and is mathematics in its own right.
  assert.deepEqual(texts("\\frac{L}{V^2}"), ["L", "V"]);
  assert.deepEqual(texts("e^{\\beta \\nu}"), ["e", "\\beta", "\\nu"]);
});

test("a big operator's limits are mathematics; its subscript is not a name", () => {
  assert.deepEqual(texts("\\int_0^\\infty \\varrho_\\nu d \\nu"), ["\\varrho_\\nu", "d", "\\nu"]);
  assert.deepEqual(texts("\\sum_{\\nu = 1}^{\\nu = \\infty} A_\\nu"), ["\\nu", "\\nu", "A_\\nu"]);
});

test("a text run is one atom per letter: dx is d and x", () => {
  assert.deepEqual(texts("dx"), ["d", "x"]);
});

test("the atom's offsets are its exact bytes in the display", () => {
  const latex = "K_0 - K_1 = \\frac{L}{V^2} \\frac{v^2}{2}.";
  for (const atom of printedAtoms(latex))
    assert.equal(latex.slice(atom.start, atom.end), atom.text);
});

test("two spellings of one name share a signature only where a script's braces differ", () => {
  assert.equal(glyphSignature("E_{0}"), glyphSignature("E_0"));
  assert.notEqual(glyphSignature("E_0"), glyphSignature("E_1"));
  assert.notEqual(glyphSignature("\\overline{E}"), glyphSignature("E"));
});

test("glyph-not-one-atom: a binding names one printed name, never an expression", () => {
  for (const glyph of ["E_0 - E_1", "V^2", "dx", "\\cos", ""])
    assert.throws(
      () => glyphSignature(glyph),
      (e: unknown) => e instanceof PrintedAtomError && e.kind === "glyph-not-one-atom",
      glyph,
    );
});

test("latex-unreadable: a display that does not tokenize is refused, not read around", () => {
  assert.throws(
    () => printedAtoms("\\frac{L}{V"),
    (e: unknown) => e instanceof PrintedAtomError && e.kind === "latex-unreadable",
  );
});

test("marking wraps each atom and copies every other byte through", () => {
  const latex = "E_0 = E_1 + \\left[ \\frac{L}{2} + \\frac{L}{2} \\right],";
  const atoms = printedAtoms(latex);
  const marks = atoms.map((a, i) => ({ start: a.start, end: a.end, termId: `t${i}` }));
  const marked = markPrintedLatex(latex, marks);
  // Removing exactly what was inserted gives the transcription back, byte for byte.
  let restored = marked;
  for (const { termId } of marks) {
    const open = `\\htmlData{term=${termId}}{`;
    const at = restored.indexOf(open);
    assert.ok(at >= 0, termId);
    const close = restored.indexOf("}", at + open.length + 1);
    restored =
      restored.slice(0, at) + restored.slice(at + open.length, close) + restored.slice(close + 1);
  }
  assert.equal(restored, latex);
  assert.equal(marked.includes("\\htmlData{term=t0}{E_0}"), true);
});

test("marks-overlap: overlapping marks are refused", () => {
  assert.throws(
    () =>
      markPrintedLatex("E_0 = E_1", [
        { start: 0, end: 3, termId: "a" },
        { start: 2, end: 5, termId: "b" },
      ]),
    (e: unknown) => e instanceof PrintedAtomError && e.kind === "marks-overlap",
  );
});

test("every Greek variant a paper prints in a display is a glyph, so it is bound and coloured", () => {
  // \varkappa was not in GREEK, so relativity's U = V(2V - ϰ - λ)/... (eq-s5-d7) and Brownian's
  // eq-s2-d2 printed a ϰ that no binding could name and no check asked for: an unknown command is
  // read around silently. Kept to the \var... spellings, the class this came from.
  assert.deepEqual(texts("2 V - \\varkappa - \\lambda"), ["V", "\\varkappa", "\\lambda"]);
  assert.equal(glyphSignature("\\varkappa") === glyphSignature("\\kappa"), false);
  const root = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "content",
    "source-blocks",
  );
  const unread: string[] = [];
  let displays = 0;
  for (const paper of readdirSync(root)) {
    const dir = join(root, paper);
    for (const file of readdirSync(dir).filter((f) => f.startsWith("eq-") && f.endsWith(".yaml"))) {
      displays += 1;
      const latex = (
        parseYaml(readFileSync(join(dir, file), "utf8")) as { diplomaticText?: string }
      ).diplomaticText;
      if (typeof latex !== "string") continue;
      // Read means inside some atom: as its base (\varphi), or as its script label (the \varrho
      // of E_{\varrho}), where the atom's text is the whole name, not the command alone.
      const atoms = printedAtoms(latex);
      for (const match of latex.matchAll(/\\var[a-zA-Z]+/g)) {
        const at = match.index ?? 0;
        if (!atoms.some((a) => a.start <= at && at + match[0].length <= a.end))
          unread.push(`${paper}/${file}: ${match[0]}`);
      }
    }
  }
  // Non-vacuity, on purpose: the scan read the papers' displays.
  assert.ok(displays > 100, `read ${displays} display blocks`);
  assert.deepEqual(unread, []);
});
