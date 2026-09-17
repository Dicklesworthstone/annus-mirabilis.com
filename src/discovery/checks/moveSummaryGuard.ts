/**
 * Guard for Journey R0 move summary text (move.r0Summary.text).
 * Specification: am-disc-journey-framework-umbg, AGENTS.md (§7.3)
 */

export interface MoveSummaryIssue {
  readonly rule: string;
  readonly message: string;
  readonly repair: string;
  readonly token?: string | undefined;
  readonly position?: number | undefined;
}

export interface MoveSummaryCheckResult {
  readonly valid: boolean;
  readonly issues: readonly MoveSummaryIssue[];
}

const FORBIDDEN_MATH_CHARS = ["=", "√", "∝", "±", "×", "÷", "^", "_", "′", "″", "≈", "≤", "≥", "<", ">", "⁄"];
const GREEK_REGEX = /[\u0370-\u03FF\u1F00-\u1FFF]/;
const SUPERSCRIPT_SUBSCRIPT_REGEX = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]/;
const FORBIDDEN_PHRASES = [
  "what einstein thought",
  "einstein's thought process",
  "einsteins thought process",
  "what einstein was thinking",
];

/**
 * Checks a move summary string against all R0 non-algebra and pedagogical guard rules.
 */
export function checkMoveSummary(text: string): MoveSummaryCheckResult {
  const issues: MoveSummaryIssue[] = [];
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      valid: false,
      issues: [
        {
          rule: "move-summary-empty",
          message: "Move summary cannot be empty.",
          repair: "Provide a plain-language one-sentence summary of the move.",
        },
      ],
    };
  }

  // 1. One sentence rule: must end with terminal punctuation . ? !
  if (!/[.?!]$/.test(trimmed)) {
    issues.push({
      rule: "move-summary-terminal-punctuation",
      message: "Move summary must end with a terminal full stop, question mark, or exclamation mark.",
      repair: "Add a terminal punctuation mark to the end of the sentence.",
      position: text.length,
    });
  }

  // Check for internal sentence boundaries (e.g., "It spreads. It grows.")
  const internalSentenceMatch = trimmed.slice(0, -1).match(/[.?!]\s+[A-Z]/);
  if (internalSentenceMatch && internalSentenceMatch.index !== undefined) {
    issues.push({
      rule: "move-summary-single-sentence",
      message: "Move summary must be exactly one sentence; found internal sentence boundary.",
      repair: "Combine into a single sentence without internal full stops.",
      token: internalSentenceMatch[0],
      position: internalSentenceMatch.index,
    });
  }

  // 2. Word count bound: max 100 words
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 100) {
    issues.push({
      rule: "move-summary-word-count",
      message: `Move summary must be at most 100 words (found ${words.length} words).`,
      repair: "Shorten the summary to 100 words or fewer.",
      token: words[100],
    });
  }

  // 3. No math delimiters or markup
  const mathDelimiters = ["$", "\\(", "\\)", "\\[", "\\]", "\\frac", "\\sqrt", "\\cdot", "\\times"];
  for (const delim of mathDelimiters) {
    const idx = text.indexOf(delim);
    if (idx !== -1) {
      issues.push({
        rule: "move-summary-no-math-delimiters",
        message: `Move summary contains math delimiter or LaTeX command "${delim}".`,
        repair: "Remove mathematical formatting and state the move in plain words.",
        token: delim,
        position: idx,
      });
    }
  }

  if (text.includes("[data-math]") || text.includes("<math") || text.includes("<katex")) {
    issues.push({
      rule: "move-summary-no-math-markup",
      message: "Move summary contains math markup or tags.",
      repair: "Remove HTML/MathML tags from the summary.",
    });
  }

  // 4. Forbidden math characters
  for (const ch of FORBIDDEN_MATH_CHARS) {
    const idx = text.indexOf(ch);
    if (idx !== -1) {
      issues.push({
        rule: "move-summary-forbidden-character",
        message: `Move summary contains forbidden mathematical symbol "${ch}".`,
        repair: "Replace symbol with plain English description.",
        token: ch,
        position: idx,
      });
    }
  }

  // 5. Greek letters
  const greekMatch = text.match(GREEK_REGEX);
  if (greekMatch && greekMatch.index !== undefined) {
    issues.push({
      rule: "move-summary-no-greek-letters",
      message: `Move summary contains Greek letter "${greekMatch[0]}".`,
      repair: "Spell out the concept in plain English without Greek notation.",
      token: greekMatch[0],
      position: greekMatch.index,
    });
  }

  // 6. Superscript / subscript characters
  const superSubMatch = text.match(SUPERSCRIPT_SUBSCRIPT_REGEX);
  if (superSubMatch && superSubMatch.index !== undefined) {
    issues.push({
      rule: "move-summary-no-superscript-subscript",
      message: `Move summary contains superscript or subscript character "${superSubMatch[0]}".`,
      repair: "Remove exponents or subscripts; express the scaling relationship in words.",
      token: superSubMatch[0],
      position: superSubMatch.index,
    });
  }

  // 7. No standalone single-letter tokens other than "a", "A", "I"
  // Match single letters surrounded by non-alphanumeric, non-apostrophe boundaries
  const singleLetterMatches = text.matchAll(/(?:^|[^a-zA-Z0-9'’])([b-hj-zB-HJ-Z])(?![a-zA-Z0-9'’])/g);
  for (const match of singleLetterMatches) {
    if (match.index !== undefined && match[1]) {
      const charIndex = match[0].length > 1 ? match.index + 1 : match.index;
      issues.push({
        rule: "move-summary-no-lone-symbols",
        message: `Move summary contains standalone single-letter variable symbol "${match[1]}".`,
        repair: "Name the quantity in words rather than using a single-letter variable.",
        token: match[1],
        position: charIndex,
      });
    }
  }

  // 8. Copy guards (forbidden phrases)
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    const idx = lower.indexOf(phrase);
    if (idx !== -1) {
      issues.push({
        rule: "move-summary-forbidden-phrase",
        message: `Move summary contains prohibited phrase "${phrase}".`,
        repair: "Describe the argument's structural move, not Einstein's internal psychological state.",
        token: text.slice(idx, idx + phrase.length),
        position: idx,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
