import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { validateReadingRecord } from "./reading.ts";

describe("the reading-record validator", () => {
  // A real record with one field changed, so a refusal can only come from that field.
  const source = JSON.parse(
    readFileSync(
      new URL(
        "../../../content/arguments/light-quanta/arg-lq-classical-allocation.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  function withFull(text: string, steps?: string[]): unknown {
    const record = structuredClone(source);
    record.readings.full = [{ kind: "paragraph", text }];
    if (steps) record.readings.steps = [{ kind: "steps", items: steps }];
    return record;
  }
  function refusal(input: unknown): string {
    try {
      validateReadingRecord(input, "fixture");
    } catch (cause) {
      return String((cause as Error).message);
    }
    return "accepted";
  }

  test("the unchanged record is accepted, and so is well-formed inline mathematics", () => {
    expect(refusal(structuredClone(source))).toBe("accepted");
    expect(refusal(withFull(String.raw`the classical mean energy \(k_B T\) per mode`))).toBe(
      "accepted",
    );
  });

  test("inline mathematics is held to the formula blocks' command allowlist", () => {
    expect(refusal(withFull(String.raw`a quantity \(\hbar\omega\) here`))).toContain(
      "Unsupported math command: hbar",
    );
  });

  test("a malformed delimiter in a paragraph or a step fails with its code", () => {
    expect(refusal(withFull(String.raw`energy \(k_B T and more`))).toContain(
      "inline-math-unclosed",
    );
    expect(refusal(withFull("Fine.", [String.raw`Multiply by k_B T\).`]))).toContain(
      "inline-math-stray-close",
    );
  });
});
