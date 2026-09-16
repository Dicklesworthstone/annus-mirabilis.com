import { KernelExtractionError } from "./extractTypeScript.ts";
import { hashKernelSource } from "./sourceDigest.ts";
import type { ExtractedKernelSource } from "./types.ts";

const RUST_KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "const",
  "continue",
  "crate",
  "dyn",
  "else",
  "enum",
  "extern",
  "false",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "true",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
]);

type Scan = { i: number; src: string };

function peek(s: Scan): string {
  return s.src[s.i] ?? "";
}
function starts(s: Scan, lit: string): boolean {
  return s.src.startsWith(lit, s.i);
}

function skipLineComment(s: Scan): void {
  while (s.i < s.src.length && s.src[s.i] !== "\n") s.i++;
}
function skipBlockComment(s: Scan): void {
  s.i += 2;
  while (s.i < s.src.length && !starts(s, "*/")) s.i++;
  if (starts(s, "*/")) s.i += 2;
}
function skipString(s: Scan, quote: string): void {
  s.i += quote.length;
  while (s.i < s.src.length) {
    if (s.src[s.i] === "\\") {
      s.i += 2;
      continue;
    }
    if (starts(s, quote)) {
      s.i += quote.length;
      return;
    }
    s.i++;
  }
}
function skipRawString(s: Scan): void {
  let hashes = 0;
  let i = s.i;
  if (s.src[i] === "b") i++;
  if (s.src[i] !== "r") return;
  i++;
  while (s.src[i] === "#") {
    hashes++;
    i++;
  }
  if (s.src[i] !== '"') return;
  i++;
  const close = `"${"#".repeat(hashes)}`;
  const end = s.src.indexOf(close, i);
  s.i = end === -1 ? s.src.length : end + close.length;
}

function skipTriviaAndLiterals(s: Scan): boolean {
  if (starts(s, "//")) {
    skipLineComment(s);
    return true;
  }
  if (starts(s, "/*")) {
    skipBlockComment(s);
    return true;
  }
  if (starts(s, "r#") || starts(s, 'r"') || starts(s, "br#") || starts(s, 'br"')) {
    skipRawString(s);
    return true;
  }
  if (peek(s) === "'" || peek(s) === '"') {
    skipString(s, peek(s));
    return true;
  }
  return false;
}

function skipWs(s: Scan): void {
  while (s.i < s.src.length) {
    const c = peek(s);
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      s.i++;
      continue;
    }
    if (skipTriviaAndLiterals(s)) continue;
    return;
  }
}

function skipBalanced(s: Scan, open: string, close: string): void {
  if (!starts(s, open)) return;
  let depth = 0;
  while (s.i < s.src.length) {
    if (skipTriviaAndLiterals(s)) continue;
    if (starts(s, open)) {
      depth++;
      s.i += open.length;
      continue;
    }
    if (starts(s, close)) {
      depth--;
      s.i += close.length;
      if (depth === 0) return;
      continue;
    }
    s.i++;
  }
}

function readIdent(s: Scan): string | null {
  const c = peek(s);
  if (!/[A-Za-z_]/.test(c)) return null;
  const start = s.i;
  s.i++;
  while (/[A-Za-z0-9_]/.test(peek(s))) s.i++;
  return s.src.slice(start, s.i);
}

function skipVisibility(s: Scan): void {
  const mark = s.i;
  if (readIdent(s) !== "pub") {
    s.i = mark;
    return;
  }
  skipWs(s);
  if (peek(s) === "(") skipBalanced(s, "(", ")");
}

function skipQualifiers(s: Scan): void {
  for (;;) {
    skipWs(s);
    const mark = s.i;
    const id = readIdent(s);
    if (id === "async" || id === "const" || id === "unsafe" || id === "extern") {
      skipWs(s);
      if (peek(s) === '"') skipString(s, '"');
      continue;
    }
    s.i = mark;
    return;
  }
}

function skipFnSignatureAndBody(s: Scan): void {
  skipWs(s);
  if (peek(s) === "<") skipBalanced(s, "<", ">");
  skipWs(s);
  if (peek(s) === "(") skipBalanced(s, "(", ")");
  skipWs(s);
  if (starts(s, "->")) {
    s.i += 2;
    while (s.i < s.src.length && peek(s) !== "{" && peek(s) !== ";") {
      if (skipTriviaAndLiterals(s)) continue;
      if (peek(s) === "<") {
        skipBalanced(s, "<", ">");
        continue;
      }
      if (peek(s) === "(") {
        skipBalanced(s, "(", ")");
        continue;
      }
      s.i++;
    }
  }
  skipWs(s);
  if (peek(s) === "{") skipBalanced(s, "{", "}");
  else if (peek(s) === ";") s.i++;
}

function skipAttributes(s: Scan): number | null {
  skipWs(s);
  if (peek(s) !== "#") return null;
  const start = s.i;
  while (peek(s) === "#") {
    const attrStart = s.i;
    s.i++;
    if (peek(s) === "!") s.i++;
    skipWs(s);
    if (peek(s) !== "[") {
      s.i = attrStart;
      return start === attrStart ? null : start;
    }
    skipBalanced(s, "[", "]");
    skipWs(s);
  }
  return start;
}

/**
 * Locate `fn name` with a documented token scan: skip comments and strings,
 * keep attributes (including `#[wasm_bindgen]`), match braces for the body.
 * Does not compile Rust.
 */
export function extractRustFunction(
  source: string,
  fnName: string,
  options: { filePath: string; revision: string },
): ExtractedKernelSource {
  const s: Scan = { i: 0, src: source };
  while (s.i < source.length) {
    const attrStart = skipAttributes(s);
    skipWs(s);
    const fnStart = s.i;
    skipVisibility(s);
    skipQualifiers(s);
    skipWs(s);
    const kw = readIdent(s);
    if (kw !== "fn") {
      if (s.i === fnStart) s.i++;
      continue;
    }
    skipWs(s);
    const name = readIdent(s);
    if (name !== fnName) {
      skipFnSignatureAndBody(s);
      continue;
    }
    skipFnSignatureAndBody(s);
    const start = attrStart ?? fnStart;
    const extracted = source.slice(start, s.i);
    const before = source.slice(0, start);
    const lineStart = before.split("\n").length;
    const lineEnd = lineStart + extracted.split("\n").length - 1;
    return {
      language: "rust",
      exportName: fnName,
      filePath: options.filePath,
      lineStart,
      lineEnd,
      source: extracted,
      sourceHash: hashKernelSource(extracted),
      revision: options.revision,
      identifiers: rustIdentifiers(extracted),
    };
  }
  throw new KernelExtractionError(
    "kernel-export-missing",
    `No Rust function "${fnName}" in ${options.filePath}.`,
  );
}

export function rustIdentifiers(source: string): string[] {
  const names = new Set<string>();
  const s: Scan = { i: 0, src: source };
  while (s.i < source.length) {
    if (skipTriviaAndLiterals(s)) continue;
    const id = readIdent(s);
    if (id && !RUST_KEYWORDS.has(id)) names.add(id);
    else if (!id) s.i++;
  }
  return [...names].sort((a, b) => a.localeCompare(b, "en"));
}
