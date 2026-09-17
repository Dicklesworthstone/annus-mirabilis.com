import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkExerciseAnswer, type ExpressionExercisePart } from "./answer.ts";
import { globalExerciseCheckerLogger } from "./exerciseCheckerLogger.ts";
import { parse } from "./grammar.ts";

describe("am-disc-exercise-checker-i4h2: security and safety scans", () => {
  test("zero eval, new Function, or with expressions across all exercise checker modules", () => {
    const start = Date.now();
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(dir).filter(
      (f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith("security.test.ts"),
    );

    const forbiddenPatterns = [
      /\beval\s*\(/,
      /\bnew\s+Function\s*\(/,
      /\bFunction\s*\(/,
      /\bwith\s*\(/,
    ];

    for (const file of files) {
      const content = readFileSync(join(dir, file), "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }

    globalExerciseCheckerLogger.log({
      testId: "security-zero-eval-function-with",
      outcome: "pass",
      durationMs: Date.now() - start,
      message:
        "Static code scan confirmed zero dynamic code execution patterns across exercise checker files.",
    });
  });

  test("hostile nested expressions are handled safely within 50ms without stack overflow", () => {
    const start = Date.now();
    // Valid nested parentheses (5 levels deep)
    const validNested = `${"(".repeat(5)}1+2${")".repeat(5)}`;
    const parseStart = performance.now();
    const parsedValid = parse(validNested, new Set());
    const validDuration = performance.now() - parseStart;

    expect(parsedValid.ok).toBe(true);
    expect(validDuration).toBeLessThan(50);

    // Hostile deeply nested parentheses (30 levels deep) safely rejected by depth guard
    const hostileNested = `${"(".repeat(30)}1${")".repeat(30)}`;
    const hostileStart = performance.now();
    const parsedHostile = parse(hostileNested, new Set());
    const hostileDuration = performance.now() - hostileStart;

    expect(parsedHostile.ok).toBe(false);
    if (!parsedHostile.ok) {
      expect(parsedHostile.message).toContain("levels deep");
    }
    expect(hostileDuration).toBeLessThan(50);

    globalExerciseCheckerLogger.log({
      testId: "security-nested-parens-bounded-time",
      outcome: "pass",
      durationMs: Date.now() - start,
      message:
        "Deeply nested expression handled safely within performance budget without stack overflow.",
    });
  });

  test("raw input exceeding 200 characters is rejected as parse error", async () => {
    const start = Date.now();
    const part: ExpressionExercisePart = {
      id: "test-length-limit",
      prompt: "Test prompt.",
      declaredNames: ["x"],
      domains: { x: { min: 1, max: 10 } },
      referenceSource: "x",
      tolerance: { absolute: 1e-9, relative: 1e-9 },
      workedExplanation: "x",
    };

    const longInput = "x + ".repeat(60) + "x"; // > 200 chars
    const verdict = await checkExerciseAnswer(part, longInput);
    expect(verdict.kind).toBe("parse-error");
    if (verdict.kind === "parse-error") {
      expect(verdict.message).toContain("200 characters");
    }

    globalExerciseCheckerLogger.log({
      testId: "security-max-length-limit-enforced",
      exerciseId: part.id,
      status: "parse-error",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Input exceeding 200 characters rejected with helpful parse error.",
    });
  });
});
