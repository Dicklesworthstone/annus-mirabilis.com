/**
 * Safe loaders for content files: JSON, YAML, and constrained Markdown.
 * Enforces NFC normalization, 512 KiB budget, no duplicate keys, no custom YAML tags/anchors/merges.
 *
 * Spec: AGENTS.md and am-cm-compiler-core-oa7
 */

import { parseYaml, YamlParseError } from "../provenance/yaml.ts";

export class ContentError extends Error {
  readonly code: string;
  readonly path: string;
  readonly line?: number | undefined;
  readonly column?: number | undefined;

  constructor(code: string, path: string, message: string, line?: number, column?: number) {
    super(message);
    this.name = "ContentError";
    this.code = code;
    this.path = path;
    this.line = line;
    this.column = column;
  }
}

/** Default maximum file size: 512 KiB */
export const DEFAULT_MAX_FILE_BYTES = 512 * 1024;

/**
 * Enforces Unicode NFC normalization.
 * Throws ContentError("non-nfc", path:line, ...) on the first non-NFC line.
 */
export function checkNfc(text: string, path = "content"): void {
  if (text !== text.normalize("NFC")) {
    const lines = text.split(/\r?\n/);
    let lineNum = 1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line !== line.normalize("NFC")) {
        lineNum = i + 1;
        break;
      }
    }
    throw new ContentError(
      "non-nfc",
      `${path}:${lineNum}`,
      `Content must already use Unicode NFC; non-NFC text found at line ${lineNum}.`,
      lineNum,
    );
  }
}

/**
 * Enforces file size budget.
 */
export function checkFileSize(
  byteLength: number,
  path = "content",
  maxBytes = DEFAULT_MAX_FILE_BYTES,
): void {
  if (byteLength > maxBytes) {
    throw new ContentError(
      "file-budget",
      path,
      `Content exceeds ${Math.round(maxBytes / 1024)} KiB budget (${byteLength} bytes).`,
    );
  }
}

/**
 * Strict JSON parser with duplicate key detection, reserved key checks, and depth limit.
 */
export function parseContentJson(text: string, path = "content"): unknown {
  const byteLength = new TextEncoder().encode(text).length;
  checkFileSize(byteLength, path);
  checkNfc(text, path);

  let i = 0;
  const fail = (message: string, code = "invalid-json"): never => {
    const lineNum = text.slice(0, i).split("\n").length;
    throw new ContentError(code, `${path}:${lineNum}`, message, lineNum);
  };

  const space = () => {
    while (/[\x20\t\r\n]/.test(text[i] ?? "!") && i < text.length) i++;
  };

  function string(): string {
    const start = i++;
    while (i < text.length) {
      const c = text[i++];
      if (c === '"') {
        try {
          return JSON.parse(text.slice(start, i)) as string;
        } catch {
          fail("Invalid JSON string.");
        }
      }
      if (c === "\\") i++;
    }
    return fail("Unterminated string.");
  }

  function value(depth: number): unknown {
    if (depth > 40) fail("Content nesting exceeds 40 levels.", "nesting-budget");
    space();
    const c = text[i];
    if (c === '"') return string();
    if (c === "{") {
      i++;
      space();
      const o: Record<string, unknown> = Object.create(null);
      if (text[i] === "}") {
        i++;
        return o;
      }
      for (;;) {
        space();
        if (text[i] !== '"') fail("Expected an object key.");
        const key = string();
        if (Object.hasOwn(o, key)) fail(`Duplicate key: ${key}.`, "duplicate-key");
        if (["__proto__", "constructor", "prototype"].includes(key)) fail(`Reserved key: ${key}.`, "reserved-key");
        space();
        if (text[i++] !== ":") fail("Expected a colon.");
        o[key] = value(depth + 1);
        space();
        if (text[i] === "}") {
          i++;
          return o;
        }
        if (text[i++] !== ",") fail("Expected a comma or closing brace.");
      }
    }
    if (c === "[") {
      i++;
      space();
      const items: unknown[] = [];
      if (text[i] === "]") {
        i++;
        return items;
      }
      for (;;) {
        items.push(value(depth + 1));
        space();
        if (text[i] === "]") {
          i++;
          return items;
        }
        if (text[i++] !== ",") fail("Expected a comma or closing bracket.");
      }
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i))?.[0];
    if (!token) return fail("Expected a JSON value.");
    i += token.length;
    const parsed: unknown = JSON.parse(token);
    if (typeof parsed === "number" && !Number.isFinite(parsed)) {
      fail("Nonfinite numbers are not content values.");
    }
    return parsed;
  }

  const result = value(0);
  space();
  if (i !== text.length) fail("Unexpected trailing content.");
  return result;
}

/**
 * Strict, safe YAML parser.
 * Rejects custom tags, anchors, aliases, merge keys, duplicate keys, and non-NFC text.
 */
export function parseContentYaml(text: string, path = "content"): unknown {
  const byteLength = new TextEncoder().encode(text).length;
  checkFileSize(byteLength, path);
  checkNfc(text, path);

  const lines = text.split(/\r?\n/);
  let blockScalarIndent: number | null = null;

  // Scan line-by-line for forbidden YAML syntax constructs before AST parsing
  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]!;
    const lineNum = idx + 1;
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const currentIndent = rawLine.search(/\S/);

    // Check if we are exiting a block scalar
    if (blockScalarIndent !== null) {
      if (currentIndent > blockScalarIndent) {
        // Still inside block scalar
        continue;
      } else {
        blockScalarIndent = null;
      }
    }

    // Check if this line starts a block scalar: `key: |` or `key: >` or `- |`
    if (/:\s*[|>][+-]?\s*(?:#.*)?$/.test(trimmed) || /^-\s*[|>][+-]?\s*(?:#.*)?$/.test(trimmed)) {
      blockScalarIndent = currentIndent;
    }

    // Strip comments and quoted substrings to only inspect structural YAML tokens
    let structural = rawLine.replace(/#.*$/, "");
    structural = structural.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    structural = structural.replace(/'(?:[^'\\]|\\.)*'/g, "''");

    // 1. Custom tags (e.g. !!js/function, !tag, !<...>)
    if (/(?:^|\s)!(?:![a-zA-Z0-9_\-\/]+|<[^>]+>|[a-zA-Z0-9_\-]+)/.test(structural)) {
      throw new ContentError(
        "yaml-custom-tag",
        `${path}:${lineNum}`,
        `YAML custom tags are prohibited at line ${lineNum}.`,
        lineNum,
      );
    }

    // 2. Anchors (&anchor)
    if (/(?:^|\s)&[a-zA-Z0-9_\-]+/.test(structural)) {
      throw new ContentError(
        "yaml-anchor-forbidden",
        `${path}:${lineNum}`,
        `YAML anchors (&) are prohibited at line ${lineNum}.`,
        lineNum,
      );
    }

    // 3. Merge keys (<<:)
    if (/(?:^|\s)<<\s*:/.test(structural)) {
      throw new ContentError(
        "yaml-merge-key-forbidden",
        `${path}:${lineNum}`,
        `YAML merge keys (<<:) are prohibited at line ${lineNum}.`,
        lineNum,
      );
    }

    // 4. Aliases (*alias)
    if (/(?:^|\s)\*[a-zA-Z0-9_\-]+/.test(structural)) {
      throw new ContentError(
        "yaml-alias-forbidden",
        `${path}:${lineNum}`,
        `YAML aliases (*) are prohibited at line ${lineNum}.`,
        lineNum,
      );
    }
  }

  // Parse YAML with duplicate-key checking
  try {
    return parseYamlStrict(text, path);
  } catch (e) {
    if (e instanceof ContentError) throw e;
    if (e instanceof YamlParseError) {
      throw new ContentError("yaml-parse-error", `${path}:${e.line}`, e.message, e.line, e.column);
    }
    throw new ContentError("yaml-parse-error", path, e instanceof Error ? e.message : String(e));
  }
}

/**
 * Internal helper for strict YAML parsing with duplicate key verification.
 */
function parseYamlStrict(text: string, path: string): unknown {
  // We use parseYaml but add a duplicate-key validator pass on lines
  const lines = text.split(/\r?\n/);
  // Track keys at indentation levels
  const indentKeyStacks = new Map<number, Set<string>>();

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;
    const lineNum = idx + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = line.search(/\S/);
    // Clear deeper indent levels
    for (const lvl of Array.from(indentKeyStacks.keys())) {
      if (lvl > indent) indentKeyStacks.delete(lvl);
    }

    // Check if line is a mapping key: `key:` or `"key":` or `'key':`
    const match = line.match(/^(\s*)([a-zA-Z0-9_\-"']+)\s*:/);
    if (match && !trimmed.startsWith("- ")) {
      const rawKey = match[2]!.replace(/^["']|["']$/g, "");
      let set = indentKeyStacks.get(indent);
      if (!set) {
        set = new Set<string>();
        indentKeyStacks.set(indent, set);
      }
      if (set.has(rawKey)) {
        throw new ContentError(
          "duplicate-key",
          `${path}:${lineNum}`,
          `Duplicate key in YAML: "${rawKey}" at line ${lineNum}.`,
          lineNum,
        );
      }
      set.add(rawKey);
    }
  }

  return parseYaml(text);
}

/**
 * Universal content file parser: automatically handles JSON or YAML.
 */
export function parseContentFile(file: { path: string; text: string }): unknown {
  const p = file.path.toLowerCase();
  if (p.endsWith(".json")) {
    return parseContentJson(file.text, file.path);
  }
  if (p.endsWith(".yaml") || p.endsWith(".yml")) {
    return parseContentYaml(file.text, file.path);
  }
  // Try JSON first if starts with { or [
  const trimmed = file.text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseContentJson(file.text, file.path);
  }
  return parseContentYaml(file.text, file.path);
}

export interface MarkdownValidationIssue {
  readonly code: string;
  readonly line: number;
  readonly message: string;
}

export interface MarkdownValidationResult {
  readonly ok: boolean;
  readonly issues: readonly MarkdownValidationIssue[];
}

/**
 * Validates constrained Markdown against the closed node allowlist.
 * Rejects raw HTML, <script>, MDX/JSX components, unadmitted images.
 */
export function validateConstrainedMarkdown(
  text: string,
  path = "markdown",
  options?: { admittedFigureIds?: Set<string>; throwOnError?: boolean },
): MarkdownValidationResult {
  checkNfc(text, path);
  const issues: MarkdownValidationIssue[] = [];
  const lines = text.split(/\r?\n/);
  const admittedFigures = options?.admittedFigureIds ?? new Set<string>();

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;
    const lineNum = idx + 1;

    // 1. Check for <script>
    if (/<script\b[^>]*>/i.test(line)) {
      issues.push({
        code: "script-tag-forbidden",
        line: lineNum,
        message: `<script> tag is strictly forbidden at line ${lineNum}.`,
      });
      continue;
    }

    // 2. Check for MDX import / export statements
    if (/^\s*(?:import|export)\s+(?:\{|\*|[a-zA-Z0-9_]+)/.test(line)) {
      issues.push({
        code: "mdx-syntax-forbidden",
        line: lineNum,
        message: `MDX import/export syntax is forbidden at line ${lineNum}.`,
      });
      continue;
    }

    // 3. Check for JSX components: <CapitalizedTag ...> or <Component ... />
    if (/<[A-Z][a-zA-Z0-9_]*(\s+[^>]*)?(?:\/>|>)/.test(line)) {
      issues.push({
        code: "mdx-syntax-forbidden",
        line: lineNum,
        message: `JSX / MDX component syntax is forbidden at line ${lineNum}.`,
      });
      continue;
    }

    // 4. Check for raw HTML tags: <tag>, </div>, <p>, <span>, <b>, <i>, etc.
    // Exclude HTML comments <!-- ... -->
    const sanitizedLine = line.replace(/<!--[\s\S]*?-->/g, "");
    if (/<[a-zA-Z\/][^>]*>/.test(sanitizedLine)) {
      issues.push({
        code: "markdown-raw-html",
        line: lineNum,
        message: `Raw HTML tags are forbidden in constrained markdown at line ${lineNum}.`,
      });
      continue;
    }

    // 5. Check for Markdown image syntax: ![alt](url)
    const imgMatches = line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
    for (const match of imgMatches) {
      const url = match[2]!;
      // An admitted image must have an id in admittedFigures or be a recognized internal figure path
      const figureIdMatch = url.match(/^(?:(?:figure|fig)\/|\/figures\/)?([a-zA-Z0-9_\-]+)$/);
      const figureId = figureIdMatch ? figureIdMatch[1]! : url;
      if (!admittedFigures.has(figureId) && !admittedFigures.has(url)) {
        issues.push({
          code: "image-forbidden",
          line: lineNum,
          message: `Image '${url}' is outside admitted figure IDs at line ${lineNum}.`,
        });
      }
    }
  }

  if (options?.throwOnError && issues.length > 0) {
    const first = issues[0]!;
    throw new ContentError(first.code, `${path}:${first.line}`, first.message, first.line);
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
