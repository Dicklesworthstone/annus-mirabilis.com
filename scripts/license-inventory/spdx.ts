/**
 * SPDX Expression Parser and Evaluator.
 * Bead: am-gov-license-inventory-w6yz
 *
 * Evaluates SPDX license expressions according to SPDX 2.x/3.0 rules:
 * - Identifiers matching allowlist (case-normalized)
 * - OR expressions pass if any branch is allowed
 * - AND expressions require all branches to be allowed
 * - WITH expressions validate both base license and exception identifier
 * - Parentheses group expressions
 * - Rejects malformed expressions with readable syntax error details
 */

export interface SpdxNode {
  readonly type: "license" | "or" | "and" | "with";
  readonly value?: string;
  readonly left?: SpdxNode;
  readonly right?: SpdxNode;
  readonly exception?: string;
}

export type Token =
  | { type: "IDENT"; value: string; start: number }
  | { type: "OR"; start: number }
  | { type: "AND"; start: number }
  | { type: "WITH"; start: number }
  | { type: "LPAREN"; start: number }
  | { type: "RPAREN"; start: number }
  | { type: "EOF"; start: number };

export function tokenizeSpdx(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input.trim();

  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", start: i });
      i++;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "RPAREN", start: i });
      i++;
      continue;
    }

    // Read word or quoted string
    let word = "";
    const start = i;

    // Special check for phrases like "MIT with OpenAI/Anthropic Rider" or "MIT License (with OpenAI/Anthropic Rider)"
    const remaining = s.slice(i);
    const riderMatch = remaining.match(
      /^(?:MIT\s+(?:License\s+)?\(?with\s+OpenAI\/Anthropic\s+Rider\)?|MIT\+Rider)/i,
    );
    if (riderMatch) {
      tokens.push({ type: "IDENT", value: "MIT with OpenAI/Anthropic Rider", start });
      i += riderMatch[0].length;
      continue;
    }

    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "(" || c === ")") {
        break;
      }
      word += c;
      i++;
    }

    if (word === "OR") {
      tokens.push({ type: "OR", start });
    } else if (word === "AND") {
      tokens.push({ type: "AND", start });
    } else if (word === "WITH") {
      tokens.push({ type: "WITH", start });
    } else if (word.length > 0) {
      tokens.push({ type: "IDENT", value: word, start });
    }
  }

  tokens.push({ type: "EOF", start: i });
  return tokens;
}

export function parseSpdx(input: string): SpdxNode {
  if (!input || input.trim().length === 0) {
    throw new Error("Empty SPDX license expression");
  }

  const tokens = tokenizeSpdx(input);
  let pos = 0;

  function current(): Token {
    return tokens[pos] || { type: "EOF", start: input.length };
  }

  function advance(): Token {
    const t = current();
    pos++;
    return t;
  }

  function parsePrimary(): SpdxNode {
    const tok = current();
    if (tok.type === "IDENT") {
      advance();
      return { type: "license", value: tok.value };
    }

    if (tok.type === "LPAREN") {
      advance();
      const node = parseOr();
      const closing = current();
      if (closing.type !== "RPAREN") {
        throw new Error(
          `Unbalanced parentheses in SPDX expression '${input}' (expected ')' at pos ${closing.start})`,
        );
      }
      advance();
      return node;
    }

    throw new Error(
      `Unexpected token '${tok.type}' in SPDX expression '${input}' at pos ${tok.start}`,
    );
  }

  function parseWith(): SpdxNode {
    const left = parsePrimary();
    if (current().type === "WITH") {
      advance();
      const next = current();
      if (next.type !== "IDENT") {
        throw new Error(
          `Expected exception identifier after WITH in SPDX expression '${input}' at pos ${next.start}`,
        );
      }
      advance();
      return { type: "with", left, exception: next.value };
    }
    return left;
  }

  function parseAnd(): SpdxNode {
    let left = parseWith();
    while (current().type === "AND") {
      advance();
      const right = parseWith();
      left = { type: "and", left, right };
    }
    return left;
  }

  function parseOr(): SpdxNode {
    let left = parseAnd();
    while (current().type === "OR") {
      advance();
      const right = parseAnd();
      left = { type: "or", left, right };
    }
    return left;
  }

  const root = parseOr();
  if (current().type !== "EOF") {
    throw new Error(
      `Trailing token '${current().type}' in SPDX expression '${input}' at pos ${current().start}`,
    );
  }

  return root;
}

function normalizeLicenseId(id: string): string {
  const trimmed = id.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "mit") return "MIT";
  if (lower === "isc") return "ISC";
  if (lower === "apache-2.0" || lower === "apache 2.0") return "Apache-2.0";
  if (lower === "bsd-2-clause" || lower === "bsd 2-clause") return "BSD-2-Clause";
  if (lower === "bsd-3-clause" || lower === "bsd 3-clause") return "BSD-3-Clause";
  if (lower === "0bsd") return "0BSD";
  if (lower === "blueoak-1.0.0") return "BlueOak-1.0.0";
  if (lower === "cc0-1.0" || lower === "cc0") return "CC0-1.0";
  if (lower === "ofl-1.1" || lower === "sil ofl 1.1") return "OFL-1.1";
  if (
    lower === "mit with openai/anthropic rider" ||
    lower === "mit+rider" ||
    lower.includes("openai/anthropic rider")
  ) {
    return "MIT with OpenAI/Anthropic Rider";
  }

  return trimmed;
}

export function evaluateSpdxNode(
  node: SpdxNode,
  allowlistSet: Set<string>,
): { allowed: boolean; failingLicenses: string[] } {
  if (node.type === "license") {
    const raw = node.value || "";
    const norm = normalizeLicenseId(raw);
    const isAllowed = allowlistSet.has(norm) || allowlistSet.has(raw);
    return {
      allowed: isAllowed,
      failingLicenses: isAllowed ? [] : [raw],
    };
  }

  if (node.type === "or") {
    if (!node.left || !node.right) {
      return { allowed: false, failingLicenses: ["<malformed-or>"] };
    }
    const leftRes = evaluateSpdxNode(node.left, allowlistSet);
    if (leftRes.allowed) {
      return { allowed: true, failingLicenses: [] };
    }
    const rightRes = evaluateSpdxNode(node.right, allowlistSet);
    if (rightRes.allowed) {
      return { allowed: true, failingLicenses: [] };
    }
    return {
      allowed: false,
      failingLicenses: [...leftRes.failingLicenses, ...rightRes.failingLicenses],
    };
  }

  if (node.type === "and") {
    if (!node.left || !node.right) {
      return { allowed: false, failingLicenses: ["<malformed-and>"] };
    }
    const leftRes = evaluateSpdxNode(node.left, allowlistSet);
    const rightRes = evaluateSpdxNode(node.right, allowlistSet);
    const allowed = leftRes.allowed && rightRes.allowed;
    return {
      allowed,
      failingLicenses: [...leftRes.failingLicenses, ...rightRes.failingLicenses],
    };
  }

  if (node.type === "with") {
    if (!node.left) {
      return { allowed: false, failingLicenses: ["<malformed-with>"] };
    }
    const leftRes = evaluateSpdxNode(node.left, allowlistSet);
    // Base license must be allowed
    if (!leftRes.allowed) {
      return leftRes;
    }
    // Check if combined license with exception is explicitly in allowlist or base license is allowed
    const combined = `${node.left?.value} WITH ${node.exception}`;
    if (allowlistSet.has(combined) || leftRes.allowed) {
      return { allowed: true, failingLicenses: [] };
    }
    return {
      allowed: false,
      failingLicenses: [combined],
    };
  }

  return { allowed: false, failingLicenses: ["unknown-node-type"] };
}

export function checkSpdxExpression(
  expression: string,
  allowlist: readonly string[],
): { allowed: boolean; failingLicenses: string[] } {
  const normAllowlist = new Set<string>();
  for (const item of allowlist) {
    normAllowlist.add(item);
    normAllowlist.add(normalizeLicenseId(item));
    normAllowlist.add(item.toLowerCase());
  }

  try {
    const ast = parseSpdx(expression);
    return evaluateSpdxNode(ast, normAllowlist);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      allowed: false,
      failingLicenses: [`Malformed SPDX '${expression}': ${msg}`],
    };
  }
}
