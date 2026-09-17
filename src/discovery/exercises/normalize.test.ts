import { describe, expect, test } from "bun:test";
import { normalize } from "./normalize";

describe("normalize: allow-listed alternate spellings become ASCII", () => {
  test("a Unicode minus sign (U+2212) becomes '-'", () => {
    const result = normalize("2−3");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("2-3");
  });

  test("multiplication signs and dots (×, ⋅, ·) become '*'", () => {
    for (const sign of ["×", "⋅", "·"]) {
      const result = normalize(`2${sign}3`);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.text).toBe("2*3");
    }
  });

  test("narrow spaces (U+00A0, U+2009) become an ordinary space", () => {
    const result = normalize("2 + 3");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("2 + 3");
  });
});

describe("normalize: rejections with a position and a suggestion", () => {
  test("a comma is rejected with a suggestion to use a period", () => {
    const result = normalize("1,5");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.position).toBe(1);
      expect(result.message).toContain("period");
    }
  });

  test("a superscript digit is rejected, never silently read via NFKC as '10-3'", () => {
    const result = normalize("10⁻³");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("^");
  });

  test("a Cyrillic lookalike letter is rejected with its position", () => {
    const result = normalize("а+1"); // Cyrillic 'а', looks like Latin 'a'
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.position).toBe(0);
  });

  test("a zero-width joiner is rejected", () => {
    const result = normalize("x‍y");
    expect(result.ok).toBe(false);
  });

  test("a right-to-left override (U+202E) is rejected", () => {
    const result = normalize("1‮+2");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.position).toBe(1);
  });
});
