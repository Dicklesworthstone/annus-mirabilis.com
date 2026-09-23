import { describe, expect, test } from "bun:test";
import {
  hasInlineMath,
  InlineMathError,
  inlineMathPlain,
  inlineMathToMarkdown,
  splitInlineMath,
} from "./inlineMath.ts";

function refusalCode(text: string): string | undefined {
  try {
    splitInlineMath(text);
  } catch (cause) {
    if (cause instanceof InlineMathError) return cause.code;
    throw cause;
  }
  return undefined;
}

describe("splitInlineMath", () => {
  test("words and mathematics come apart in order, each with its offset", () => {
    const text = String.raw`the classical mean energy \(k_B T\) gives \(\rho_\nu\).`;
    expect(splitInlineMath(text)).toEqual([
      { kind: "text", value: "the classical mean energy ", start: 0 },
      { kind: "math", value: "k_B T", start: 26 },
      { kind: "text", value: " gives ", start: 35 },
      { kind: "math", value: String.raw`\rho_\nu`, start: 42 },
      { kind: "text", value: ".", start: 54 },
    ]);
  });

  test("text with no delimiters is one text segment, and says it has no mathematics", () => {
    expect(hasInlineMath("energy per unit volume")).toBe(false);
    expect(splitInlineMath("energy per unit volume")).toEqual([
      { kind: "text", value: "energy per unit volume", start: 0 },
    ]);
  });

  test("each malformed delimiter is refused by its own code", () => {
    expect(refusalCode(String.raw`energy \(k_B T and more`)).toBe("inline-math-unclosed");
    expect(refusalCode(String.raw`energy k_B T\) and more`)).toBe("inline-math-stray-close");
    expect(refusalCode(String.raw`energy \( \) and more`)).toBe("inline-math-empty");
    expect(refusalCode(String.raw`energy \(k \(B\) T\) and more`)).toBe("inline-math-nested");
    // A well-formed text is not refused at all.
    expect(refusalCode(String.raw`energy \(k_B T\) and more`)).toBeUndefined();
  });
});

describe("the two plain readings", () => {
  test("Markdown gets $ … $ and search gets the symbols without their markup", () => {
    const text = String.raw`If an event receives \(h\nu_\text{in}\), then \(\frac{E}{B\nu}\) holds.`;
    expect(inlineMathToMarkdown(text)).toBe(
      String.raw`If an event receives $h\nu_\text{in}$, then $\frac{E}{B\nu}$ holds.`,
    );
    expect(inlineMathPlain(text)).toBe("If an event receives hν_in, then E/Bν holds.");
  });
});
