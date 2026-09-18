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

  test("reject: (tolerance.ts:72) invalid-number reported when relative tolerance is outside [0, 1) or not finite", () => {
    const issues = validateToleranceSpec({ relative: -0.05 }, 10.0);
    expect(issues.some((i) => i.code === "invalid-number")).toBe(true);
    const issuesInf = validateToleranceSpec({ relative: Number.POSITIVE_INFINITY }, 10.0);
    expect(issuesInf.some((i) => i.code === "invalid-number")).toBe(true);
  });
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

  test("distinguishes +0 from -0 by IEEE-754 bit pattern, paired with +0 vs +0 matching so the assertion discriminates", () => {
    const negativeVsPositive = compareBitwise(0, -0);
    expect(negativeVsPositive.ok).toBe(false);
    expect(negativeVsPositive.kind).toBe("mismatch");
    expect(negativeVsPositive.detail).toContain("bit patterns differ");
    expect(negativeVsPositive.detail).toContain("0x0");
    expect(negativeVsPositive.detail).toContain("0x8000000000000000");

    const positiveVsPositive = compareBitwise(0, 0);
    expect(positiveVsPositive.ok).toBe(true);
    expect(positiveVsPositive.kind).toBe("match");
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

  test("reports unsupported element types without invoking conversion hooks", () => {
    let conversions = 0;
    const unsupported = {
      [Symbol.toPrimitive]() {
        conversions += 1;
        throw new Error("comparison must not convert unsupported elements");
      },
    };
    const verdict = compareBitwise(["same", unsupported], ["same", 0]);
    expect(verdict.ok).toBe(false);
    expect(verdict.kind).toBe("mismatch");
    expect(verdict.detail).toContain("index: 1");
    expect(conversions).toBe(0);
    expect(compareBitwise([Object.create(null)], [0]).ok).toBe(false);
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

function hasMathAbsDivision(line: string): boolean {
  let idx = line.indexOf("Math.abs(");
  while (idx !== -1) {
    let depth = 0;
    let endIdx = -1;
    for (let i = idx + 8; i < line.length; i++) {
      if (line[i] === "(") depth++;
      else if (line[i] === ")") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx !== -1) {
      const after = line.slice(endIdx + 1).trimStart();
      if (after.startsWith("/") && !after.startsWith("//")) {
        return true;
      }
    }
    idx = line.indexOf("Math.abs(", idx + 8);
  }
  return false;
}

function isDuplicateToleranceComparison(line: string): boolean {
  if (line.includes("Math.abs(") && /EPSILON/.test(line)) return true;
  return hasMathAbsDivision(line);
}

describe("single tolerance module: no duplicate comparison logic elsewhere", () => {
  test("negative for false-positive direction: identifier with 'rel' and no division does not trip the gate", () => {
    expect(isDuplicateToleranceComparison("const betaRel = Math.abs(v);")).toBe(false);
    expect(isDuplicateToleranceComparison("const betaRel = Math.abs(vRelRes.value);")).toBe(false);
    expect(
      isDuplicateToleranceComparison(
        "expect(withinTolerance(Math.abs(B_eq.z), 8.0e-4, { relative: 1e-6 }).ok).toBe(true);",
      ),
    ).toBe(false);
  });

  test("shape detection catches unnamed hand-rolled relative comparisons", () => {
    expect(isDuplicateToleranceComparison("const err = Math.abs(a - b) / b;")).toBe(true);
    expect(
      isDuplicateToleranceComparison("const naiveError = Math.abs(val(naive) - 5e-17) / 5e-17;"),
    ).toBe(true);
    expect(
      isDuplicateToleranceComparison(
        "expect(Math.abs(pi - expected) / expected).toBeLessThan(1e-6);",
      ),
    ).toBe(true);
  });

  test("no file under src/ or scripts/ exceeds its baseline of hand-rolled relative comparisons, outside allowlist", () => {
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

    /**
     * Ratchet baseline of existing hand-rolled relative comparisons (am-w0nt).
     * Measured on 2026-09-17: 43 occurrences across 23 files.
     *
     * Ordered migration plan:
     * - Genuine duplicates to migrate to withinTolerance (16 test/scenario files):
     *   src/experiments/bm02/session.test.ts (8)
     *   src/experiments/lq04/session.test.ts (1)
     *   src/physics/reference/fields.sr02.test.ts (1)
     *   src/physics/reference/fields.ts (3)
     *   src/physics/reference/massEnergy.coefficient.test.ts (2)
     *   src/physics/reference/massEnergy.pulses.test.ts (2)
     *   src/testing/bm04.reference.test.ts (2)
     *   src/testing/diffusion.driftDiffusion.test.ts (2)
     *   src/testing/events.clocks.test.ts (1)
     *   src/testing/fields.dipole.test.ts (2)
     *   src/testing/fields.sr12.test.ts (2)
     *   src/testing/kinematics/kinematics.composition.test.ts (2)
     *   src/testing/kinematics/kinematics.factors.test.ts (1)
     *   src/testing/kinematics/kinematics.velocity.test.ts (1)
     *   src/testing/scenarios/discrimination.test.ts (1)
     *
     * - Legitimate mathematical formulas / UI plotting / quadrature estimates (7 files):
     *   src/components/lab/CoefficientLab.tsx (1): SVG curve normalization (Math.abs(val) / peak) * 200
     *   src/components/lab/DriftDiffusionPlots.tsx (2): UI canvas bar width scaling
     *   src/physics/energyLedger.ts (1): ratio of ledger differences
     *   src/physics/reference/electron.ts (3): speed beta normalization Math.abs(vx) / C_SI
     *   src/physics/reference/events.ts (1): Simpson rule Richardson quadrature error estimate |fine - coarse| / 15
     *   src/physics/reference/photoelectric.ts (1): linear potential fraction 1 - Math.abs(V) / vs
     *   src/physics/reference/waves.phase.test.ts (2): dimensionless 4-vector norm invariant verification
     *   src/reasoning/countermodel/render.ts (1): residual display ordering ratio
     *
     * RULES:
     * 1. This baseline may ONLY shrink, never grow.
     * 2. When a file is migrated to withinTolerance or allowlisted, lower its count.
     * 3. Delete an entry when its count reaches 0.
     * 4. Any newly introduced Math.abs(...) / ... in an unlisted file or exceeding its count fails.
     */
    const BASELINE = new Map<string, number>([
      ["src/components/lab/CoefficientLab.tsx", 1],
      ["src/components/lab/DriftDiffusionPlots.tsx", 2],
      ["src/experiments/bm02/session.test.ts", 8],
      ["src/experiments/lq04/session.test.ts", 1],
      ["src/physics/energyLedger.ts", 1],
      ["src/physics/reference/electron.ts", 3],
      ["src/physics/reference/events.ts", 1],
      ["src/physics/reference/fields.sr02.test.ts", 1],
      ["src/physics/reference/fields.ts", 3],
      ["src/physics/reference/massEnergy.coefficient.test.ts", 2],
      ["src/physics/reference/massEnergy.pulses.test.ts", 2],
      ["src/physics/reference/photoelectric.ts", 1],
      ["src/physics/reference/waves.phase.test.ts", 2],
      ["src/reasoning/countermodel/render.ts", 1],
      ["src/testing/bm04.reference.test.ts", 2],
      ["src/testing/diffusion.driftDiffusion.test.ts", 2],
      ["src/testing/events.clocks.test.ts", 1],
      ["src/testing/fields.dipole.test.ts", 2],
      ["src/testing/fields.sr12.test.ts", 2],
      ["src/testing/kinematics/kinematics.composition.test.ts", 2],
      ["src/testing/kinematics/kinematics.factors.test.ts", 1],
      ["src/testing/kinematics/kinematics.velocity.test.ts", 1],
      ["src/testing/scenarios/discrimination.test.ts", 1],
    ]);

    const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
    const fileHits = new Map<string, string[]>();
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
        const relPath = full.slice(repoRoot.length + 1);
        if (allowlist.has(relPath)) continue;
        const lines = readFileSync(full, "utf8").split("\n");
        lines.forEach((line) => {
          if (isDuplicateToleranceComparison(line)) {
            if (!fileHits.has(relPath)) fileHits.set(relPath, []);
            fileHits.get(relPath)?.push(line.trim());
          }
        });
      }
    };
    walk(join(repoRoot, "src"));
    walk(join(repoRoot, "scripts"));

    const offenders: string[] = [];
    for (const [file, hits] of fileHits) {
      const allowed = BASELINE.get(file) ?? 0;
      if (hits.length > allowed) {
        offenders.push(
          `${file} (${hits.length} occurrences, baseline ${allowed}):\n  ${hits.join("\n  ")}`,
        );
      }
    }

    expect(offenders).toEqual([]);
    for (const relPath of allowlist.keys()) {
      expect(() => readFileSync(join(repoRoot, relPath), "utf8")).not.toThrow();
    }
  });
});
