/**
 * Symbol scanner and validator for first-encounter bridge skills.
 *
 * Enforces the No-Symbol Rule: `newSkill` must describe what the reader can now do
 * in ordinary words without using mathematical symbols, Greek letters, or notation tokens.
 *
 * Spec: am-bm-first-encounter-fjvh and AGENTS.md
 */

export interface SymbolScanResult {
  readonly ok: boolean;
  readonly invalidTokens: readonly string[];
}

/** Known mathematical notation glyphs, operators, and formatting characters */
const FORBIDDEN_NOTATION_PATTERNS: readonly RegExp[] = [
  /⟨[^⟩]*⟩/g, // Angle brackets notation (e.g. ⟨x²⟩, ⟨x⟩)
  /[⟨⟩]/g, // Isolated angle brackets
  /\\(?:langle|rangle)/g,
  /\\(?:sqrt|frac|sum|int|partial|prod|infty|approx|propto|equiv|neq|pm|times|cdot)/g,
  /\\(?:alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega)/gi,
  /\\(?:Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega)/g,
  /[α-ωΑ-Ω]/g, // Unicode Greek letters
  /[xX][²³⁴⁵⁶⁷⁸⁹⁰⁺⁻]/g, // Variable with superscript (e.g. x²)
  /[²³⁴⁵⁶⁷⁸⁹⁰⁺⁻]/g, // Unicode superscripts
  /\^[0-9a-zA-Z{}]/g, // Exponent notation
  /_[0-9a-zA-Z{}]/g, // Subscript notation
  /\\[a-zA-Z]+/g, // Generic LaTeX commands
  /\$[^$]+\$/g, // Inline LaTeX math delimiters
  /\$/g, // Raw dollar sign
  /[′″]/g, // Mathematical primes
];

/**
 * Scans a skill string for forbidden notation symbols and returns whether it passed
 * alongside all offending tokens.
 */
export function scanSkillSymbols(text: string): SymbolScanResult {
  if (!text || typeof text !== "string") {
    return { ok: true, invalidTokens: [] };
  }

  const detectedTokens: string[] = [];

  for (const pattern of FORBIDDEN_NOTATION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null = regex.exec(text);
    while (match !== null) {
      if (match[0] && !detectedTokens.includes(match[0])) {
        detectedTokens.push(match[0]);
      }
      match = regex.exec(text);
    }
  }

  return {
    ok: detectedTokens.length === 0,
    invalidTokens: Object.freeze(detectedTokens),
  };
}

export class SkillSymbolError extends Error {
  readonly code = "symbol-in-skill";
  readonly invalidTokens: readonly string[];
  readonly path: string;

  constructor(invalidTokens: readonly string[], path = "bridge.newSkill") {
    const tokenList = invalidTokens.map((t) => `"${t}"`).join(", ");
    super(
      `newSkill must not contain notation symbols or concordance tokens. Found forbidden token(s): ${tokenList}.`,
    );
    this.name = "SkillSymbolError";
    this.invalidTokens = invalidTokens;
    this.path = path;
  }
}

/**
 * Validates that `newSkill` passes the no-symbol rule, throwing `SkillSymbolError` if violated.
 */
export function validateSkillNoSymbols(text: string, path = "bridge.newSkill"): void {
  const scan = scanSkillSymbols(text);
  if (!scan.ok) {
    throw new SkillSymbolError(scan.invalidTokens, path);
  }
}
