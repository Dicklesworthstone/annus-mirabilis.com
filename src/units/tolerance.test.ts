import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BITWISE_CASES,
  CLASSIFY_CASES,
  LARGER_MODE_SYMMETRY_PAIRS,
  LARGER_MODE_SYMMETRY_SPEC,
  VALIDATE_ACROSS_CASES,
  VALIDATE_SPEC_CASES,
  WITHIN_TOLERANCE_CASES,
} from "./tolerance.cases.ts";
import {
  classifyWithTolerance,
  compareBitwise,
  ieee754Hex,
  type ToleranceIssueCode,
  validateToleranceSpec,
  validateToleranceSpecAcross,
  withinTolerance,
} from "./tolerance.ts";

describe("validateToleranceSpec", () => {
  for (const c of VALIDATE_SPEC_CASES) {
    test(c.name, () => {
      const codes = validateToleranceSpec(c.spec, c.reference).map((issue) => issue.code);
      expect(codes).toEqual(c.expectedCodes as string[]);
    });
  }
});

describe("validateToleranceSpecAcross", () => {
  for (const c of VALIDATE_ACROSS_CASES) {
    test(c.name, () => {
      const codes = validateToleranceSpecAcross(c.spec, c.references).map((issue) => issue.code);
      expect(codes).toEqual(c.expectedCodes as string[]);
    });
  }
});

describe("validation issue-code coverage", () => {
  test("every issue code has at least one failing and one passing named case", () => {
    const passingCaseByCode: Record<ToleranceIssueCode, string> = {
      "no-positive-tolerance": "no-positive-tolerance-passes-with-positive-absolute",
      "invalid-number": "invalid-number-passes-with-well-formed-spec",
      "relative-only-at-zero": "relative-only-away-from-zero-passes",
      "absolute-below-resolution": "absolute-only-well-resolved-passes",
      "absolute-only-across-magnitudes": "absolute-only-within-1000x-passes",
    };
    const allCases = [...VALIDATE_SPEC_CASES, ...VALIDATE_ACROSS_CASES];
    for (const [code, passingName] of Object.entries(passingCaseByCode) as [
      ToleranceIssueCode,
      string,
    ][]) {
      const failing = allCases.filter((c) => c.expectedCodes.includes(code));
      const passing = allCases.find((c) => c.name === passingName);
      expect(failing.length).toBeGreaterThan(0);
      expect(passing).toBeDefined();
      expect(passing?.expectedCodes).toEqual([]);
    }
  });
});

describe("withinTolerance", () => {
  for (const c of WITHIN_TOLERANCE_CASES) {
    test(c.name, () => {
      const v = withinTolerance(c.actual, c.reference, c.spec);
      if (v.kind !== c.expectedKind || v.ok !== (c.expectedKind === "within")) {
        throw new Error(
          `${c.name}: actual=${c.actual} (${ieee754Hex(c.actual)}) reference=${c.reference} (${ieee754Hex(c.reference)}) spec=${JSON.stringify(c.spec)} verdict=${JSON.stringify(v)}`,
        );
      }
    });
  }

  test("never returns ok:true for a kind other than within", () => {
    for (const c of WITHIN_TOLERANCE_CASES) {
      const v = withinTolerance(c.actual, c.reference, c.spec);
      if (v.kind !== "within") expect(v.ok).toBe(false);
    }
  });

  test("boundary is inclusive in reference mode: diff === allowed passes, just past it fails", () => {
    const spec = { absolute: 0.5 } as const;
    const atBoundary = withinTolerance(2.5, 2, spec);
    expect(atBoundary.ok).toBe(true);
    expect(atBoundary.diff).toBe(atBoundary.allowed);
    const pastBoundary = withinTolerance(2.500000001, 2, spec);
    expect(pastBoundary.ok).toBe(false);
    expect(pastBoundary.kind).toBe("outside");
  });

  test("boundary is inclusive in larger mode: diff === allowed passes, just past it fails", () => {
    const spec = { relative: 0.1, relativeTo: "larger" } as const;
    const atBoundary = withinTolerance(10, 9, spec);
    expect(atBoundary.ok).toBe(true);
    expect(atBoundary.diff).toBe(atBoundary.allowed);
    const pastBoundary = withinTolerance(10.1, 9, spec);
    expect(pastBoundary.ok).toBe(false);
    expect(pastBoundary.kind).toBe("outside");
  });

  test("larger-mode-symmetry: swapping actual and reference yields the identical verdict for ten fixed pairs", () => {
    for (const [a, b] of LARGER_MODE_SYMMETRY_PAIRS) {
      const forward = withinTolerance(a, b, LARGER_MODE_SYMMETRY_SPEC);
      const backward = withinTolerance(b, a, LARGER_MODE_SYMMETRY_SPEC);
      expect(backward).toEqual(forward);
    }
  });

  test("an invalid spec carries the validation issues instead of a fabricated diff", () => {
    const v = withinTolerance(1, 0, { relative: 1e-9 });
    expect(v.kind).toBe("invalid-spec");
    expect(v.issues.map((i) => i.code)).toEqual(["relative-only-at-zero"]);
    expect(Number.isNaN(v.diff)).toBe(true);
  });
});

describe("compareBitwise", () => {
  for (const c of BITWISE_CASES) {
    test(c.name, () => {
      const v = compareBitwise(c.actual, c.expected);
      expect(v.ok).toBe(c.expectedOk);
      expect(v.kind).toBe(c.expectedKind);
    });
  }

  test("reports the first differing index, not just failure", () => {
    const v = compareBitwise(Uint32Array.of(1, 2, 3, 4), Uint32Array.of(1, 2, 999, 4));
    expect(v.detail).toContain("index: 2");
  });

  test("compares array digests exactly instead of coercing them to NaN", () => {
    expect(compareBitwise(["digest-a"], ["digest-a"]).ok).toBe(true);
    const mismatch = compareBitwise(["same", "digest-a"], ["same", "digest-b"]);
    expect(mismatch.ok).toBe(false);
    expect(mismatch.detail).toContain("index: 1");
  });

  test("rejects mixed numeric types and unsupported array elements without coercion", () => {
    expect(compareBitwise([1], ["1"]).ok).toBe(false);
    expect(compareBitwise([1n], [1]).ok).toBe(false);
    const coercible = {
      valueOf: () => {
        throw new Error("must not coerce");
      },
    };
    expect(compareBitwise([coercible], [coercible]).ok).toBe(false);
    expect(compareBitwise([null], [0]).ok).toBe(false);
  });
});

describe("classifyWithTolerance", () => {
  for (const c of CLASSIFY_CASES) {
    test(c.name, () => {
      const v = classifyWithTolerance(c.value, c.band);
      expect(v.sign).toBe(c.expectedSign);
    });
  }

  test("indeterminate is a legitimate typed outcome, never silently coerced to zero", () => {
    const v = classifyWithTolerance(0, { absolute: 1e-6 });
    expect(v.sign).toBe("indeterminate");
    expect(v.sign).not.toBe("zero");
  });

  test("rejects a nonfinite value instead of guessing a sign", () => {
    expect(() => classifyWithTolerance(Number.NaN, { absolute: 1 })).toThrow();
  });
});

describe("module purity", () => {
  test("tolerance.ts performs no I/O, logging, randomness, or global mutation", () => {
    const source = readFileSync(fileURLToPath(new URL("./tolerance.ts", import.meta.url)), "utf8");
    for (const forbidden of [
      "console.",
      "Math.random(",
      "require(",
      "process.",
      "fetch(",
      "readFileSync",
      "writeFileSync",
      "globalThis.",
      "localStorage",
      "XMLHttpRequest",
    ]) {
      expect(source.includes(forbidden)).toBe(false);
    }
  });
});

describe("single tolerance module: no duplicate comparison logic elsewhere", () => {
  test("no other file under src/ or scripts/ combines Math.abs( with EPSILON or a relative-tolerance token, outside a reviewed allowlist", () => {
    // Reviewed allowlist: pre-existing, narrowly scoped uses that are not a duplicate of this
    // module's job of comparing two independently computed scientific results.
    const allowlist = new Map<string, string>([
      [
        "src/physics/reference/special/erf.ts",
        "Continued-fraction convergence threshold internal to erfc's own algorithm, not a comparison between two independently computed scientific results.",
      ],
      [
        "src/experiments/bm07/trajectoryCsv.ts",
        "Floating-point resolution check computing representable precision threshold at absolute epoch magnitude to refuse unresolvable equal-interval interpretations rather than widening tolerance; not a comparison between two independently computed scientific results.",
      ],
    ]);
    const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|mjs|js)$/.test(entry.name)) continue;
        if (entry.name.startsWith("tolerance.")) continue; // this module's own source and its test/case files reference "Math.abs(" as text, not as duplicate logic.
        const lines = readFileSync(full, "utf8").split("\n");
        lines.forEach((line) => {
          if (line.includes("Math.abs(") && (/EPSILON/.test(line) || /rel/i.test(line))) {
            const relPath = full.slice(repoRoot.length + 1);
            if (!allowlist.has(relPath)) offenders.push(`${relPath}: ${line.trim()}`);
          }
        });
      }
    };
    walk(join(repoRoot, "src"));
    walk(join(repoRoot, "scripts"));
    expect(offenders).toEqual([]);
    for (const relPath of allowlist.keys()) {
      expect(() => readFileSync(join(repoRoot, relPath), "utf8")).not.toThrow();
    }
  });
});
