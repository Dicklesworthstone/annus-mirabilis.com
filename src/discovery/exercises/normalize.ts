/**
 * Explicit character normalization for the exercise checker's tiny grammar
 * (am-disc-exercise-checker-i4h2). No Unicode compatibility normalization
 * (NFKC) is applied -- it would turn "10⁻³" into "10-3", which means
 * something else. Superscript digits are rejected with a suggestion, not
 * silently reinterpreted.
 */

export type NormalizeError = Readonly<{
  ok: false;
  position: number;
  message: string;
}>;

export type NormalizeSuccess = Readonly<{ ok: true; text: string }>;

const MINUS_SIGNS = new Set(["−"]);
const MULTIPLY_SIGNS = new Set(["×", "⋅", "·"]);
const NARROW_SPACES = new Set([" ", " "]);
const SUPERSCRIPT_DIGITS: Readonly<Record<string, string>> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};
const ALLOWED = /^[A-Za-z0-9+\-*/^(). ]$/;

/**
 * Normalizes the allow-listed alternate spellings (a Unicode minus, the
 * multiplication signs and dots, narrow spaces) to their ASCII
 * equivalents, and rejects everything else with the position of the first
 * offending character and a suggestion where one applies.
 */
export function normalize(raw: string): NormalizeSuccess | NormalizeError {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i] as string;
    if (MINUS_SIGNS.has(ch)) {
      out += "-";
      continue;
    }
    if (MULTIPLY_SIGNS.has(ch)) {
      out += "*";
      continue;
    }
    if (NARROW_SPACES.has(ch)) {
      out += " ";
      continue;
    }
    if (ch === ",") {
      return { ok: false, position: i, message: "Use a period for decimals, not a comma." };
    }
    if (ch in SUPERSCRIPT_DIGITS) {
      return {
        ok: false,
        position: i,
        message: `Superscript digits are not read as exponents here; write "^${SUPERSCRIPT_DIGITS[ch]}" instead.`,
      };
    }
    if (ALLOWED.test(ch)) {
      out += ch;
      continue;
    }
    return { ok: false, position: i, message: `Unrecognized character '${ch}'.` };
  }
  return { ok: true, text: out };
}
