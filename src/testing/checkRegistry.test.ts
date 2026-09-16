import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  registerCheck,
  listRegisteredChecks,
  runAllChecks,
  clearRegisteredChecksForTests,
  DECLARED_CHECK_FAMILIES,
  type ContentCheck,
  type CheckFamily,
} from "../content/compiler/checks/registry.ts";
import { getLogger } from "./log/logger.ts";

describe("Check Plugin Registry & Crash Containment (am-cm-compiler-core-oa7)", () => {
  const logger = getLogger("content-compiler-tests");

  beforeEach(() => {
    clearRegisteredChecksForTests();
  });

  afterEach(() => {
    clearRegisteredChecksForTests();
  });

  function logTest(testId: string, outcome: "passed" | "failed", message: string) {
    logger.log({
      testId,
      beadId: "am-cm-compiler-core-oa7",
      outcome,
      message,
    });
  }

  it("lists all 16 declared check families in error message when registering an invalid family", () => {
    const invalidCheck = {
      id: "invalid-family-check",
      family: "content-structural" as unknown as CheckFamily,
      severity: "error",
      run: () => {},
    };

    expect(() => registerCheck(invalidCheck as ContentCheck)).toThrow();
    try {
      registerCheck(invalidCheck as ContentCheck);
    } catch (e: any) {
      expect(e.message).toContain("content-structural");
      for (const fam of DECLARED_CHECK_FAMILIES) {
        expect(e.message).toContain(fam);
      }
    }
    logTest("check-family-validation", "passed", "Refused invalid check family and named all 16 declared families");
  });

  it("registers checks and returns them via listRegisteredChecks()", () => {
    const check1: ContentCheck = {
      id: "sample-structural-check",
      family: "structural",
      severity: "error",
      run: () => {},
    };
    const check2: ContentCheck = {
      id: "sample-voice-flag",
      family: "voice",
      severity: "flag",
      run: () => {},
    };

    registerCheck(check1);
    registerCheck(check2);

    const list = listRegisteredChecks();
    expect(list.length).toBe(2);
    expect(list.find((c) => c.id === "sample-structural-check")?.family).toBe("structural");
    expect(list.find((c) => c.id === "sample-voice-flag")?.severity).toBe("flag");
    logTest("check-registry-list", "passed", "listRegisteredChecks returns all registered checks with families");
  });

  it("differentiates error checks (fails build) and flag checks (build passes)", async () => {
    const flagCheck: ContentCheck = {
      id: "flag-check",
      family: "readings",
      severity: "flag",
      run: ({ report }) => {
        report({
          recordId: "arg-01",
          rule: "tone-warning",
          message: "Tone may be too informal.",
          repair: "Review wording in paragraph 2.",
          flaggedText: "Obviously this holds.",
        });
      },
    };

    registerCheck(flagCheck);
    const flagResult = await runAllChecks({ records: new Map(), files: [], indexes: {} });
    expect(flagResult.passed).toBe(true);
    expect(flagResult.diagnostics.length).toBe(1);
    expect(flagResult.diagnostics[0]?.severity).toBe("flag");
    expect(flagResult.diagnostics[0]?.repair).toBe("Review wording in paragraph 2.");
    expect(flagResult.diagnostics[0]?.flaggedText).toBe("Obviously this holds.");

    const errorCheck: ContentCheck = {
      id: "error-check",
      family: "semantic",
      severity: "error",
      run: ({ report }) => {
        report({
          recordId: "eq-01",
          rule: "symbol-clash",
          message: "Symbol collision between energy and electric field.",
        });
      },
    };

    registerCheck(errorCheck);
    const mixedResult = await runAllChecks({ records: new Map(), files: [], indexes: {} });
    expect(mixedResult.passed).toBe(false);
    expect(mixedResult.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect(mixedResult.diagnostics.some((d) => d.severity === "flag")).toBe(true);
    logTest("check-severity-handling", "passed", "Correctly distinguished error checks vs flag checks");
  });

  it("contains check crashes: reports check-crashed and executes subsequent checks", async () => {
    let secondCheckRan = false;

    const crashingCheck: ContentCheck = {
      id: "exploding-check",
      family: "epistemic",
      severity: "error",
      run: () => {
        throw new Error("Unexpected null dereference inside check rule.");
      },
    };

    const healthyCheck: ContentCheck = {
      id: "healthy-check",
      family: "coverage",
      severity: "flag",
      run: ({ report }) => {
        secondCheckRan = true;
        report({
          recordId: "rec-02",
          message: "Coverage is 90%.",
        });
      },
    };

    registerCheck(crashingCheck);
    registerCheck(healthyCheck);

    const result = await runAllChecks({ records: new Map(), files: [], indexes: {} });
    expect(result.passed).toBe(false);
    expect(secondCheckRan).toBe(true);

    const crashedDiag = result.diagnostics.find((d) => d.code === "check-crashed");
    expect(crashedDiag).toBeDefined();
    expect(crashedDiag?.checkId).toBe("exploding-check");
    expect(crashedDiag?.message).toContain("exploding-check");
    expect(crashedDiag?.message).toContain("Unexpected null dereference");
    expect(crashedDiag?.stack).toBeDefined();

    const healthyDiag = result.diagnostics.find((d) => d.checkId === "healthy-check");
    expect(healthyDiag).toBeDefined();
    expect(healthyDiag?.severity).toBe("flag");
    logTest("check-crash-containment", "passed", "Contained check crash and ran subsequent checks");
  });
});
