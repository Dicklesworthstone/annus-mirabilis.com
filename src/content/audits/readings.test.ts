import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import { auditReadings, type ReadingsAuditInput } from "./readings.ts";
import { errorCheckCodes } from "./types.ts";

const logger = getLogger("verify-content-tests");
const BEAD = "am-cm-audit-scripts-d34";

describe("auditReadings (am-cm-audit-scripts-d34)", () => {
  const goodTarget = {
    targetId: "s4-p1",
    targetKind: "paragraph" as const,
    paper: "brownian-motion",
    readings: {
      r0: "A suspended particle moves unpredictably in a stationary liquid.",
      r1: "A suspended particle moves unpredictably in a stationary liquid because of thermal agitation.",
      r2: "A suspended particle moves unpredictably in a stationary liquid because of molecular thermal agitation. Over longer observation times the mean displacement averages to zero while the mean square displacement grows proportionally with time.",
      r3: "According to kinetic theory, the particle's mean square displacement obeys Einstein's relation (Einstein, 1905, §4).",
      r3Citations: ["ap-17-549-s4"],
      qualificationsCited: ["dilute-spheres"],
    },
    scopeCritical: ["dilute-spheres"],
  };

  const goodOwner = {
    ownerBeadId: "am-bm-readings-s4-s5-uqbb",
    fileName: "am-bm-readings-s4-s5-uqbb.yaml",
    paper: "brownian-motion",
    targetKinds: [
      "paragraph" as const,
      "equation" as const,
      "derivation-step" as const,
      "instrument-caption" as const,
      "closing" as const,
    ],
    targetIds: ["s4-p1", "s4-eq1", "s4-step1", "caption-bm01", "closing-bm"],
  };

  test("GOOD RECORD: complete target with valid R0-R3, owner, and qualifications passes", () => {
    const input: ReadingsAuditInput = {
      targets: [goodTarget],
      owners: [goodOwner],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).toEqual([]);
    logger.log({
      testId: "readings-good-record",
      beadId: BEAD,
      extra: { family: "audit", check: "readings-complete" },
      outcome: "passed",
      message: "complete target passes readings audit",
    });
  });

  test("PLANTED: owner filename mismatch fails", () => {
    const input: ReadingsAuditInput = {
      targets: [goodTarget],
      owners: [{ ...goodOwner, fileName: "wrong-name.yaml" }],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("owner-filename-mismatch");
  });

  test("PLANTED: unassigned target fails with owner-unassigned", () => {
    const input: ReadingsAuditInput = {
      targets: [goodTarget],
      owners: [],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("owner-unassigned");
  });

  test("PLANTED: conflicting owners for same target yield owner-conflict", () => {
    const input: ReadingsAuditInput = {
      targets: [goodTarget],
      owners: [
        goodOwner,
        {
          ownerBeadId: "am-bm-equations-s4-s5-6r81",
          fileName: "am-bm-equations-s4-s5-6r81.yaml",
          paper: "brownian-motion",
          targetKinds: ["paragraph"],
          targetIds: ["s4-p1"],
        },
      ],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("owner-conflict");
  });

  test("PLANTED: target with missing readings entirely yields readings-missing", () => {
    const input: ReadingsAuditInput = {
      targets: [
        {
          targetId: "closing-bm",
          targetKind: "closing",
          paper: "brownian-motion",
        },
      ],
      owners: [goodOwner],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("readings-missing");
    expect(report.findings.some((f) => f.ownerBeadId === "am-bm-readings-s4-s5-uqbb")).toBe(true);
  });

  test("PLANTED: missing specific reading level (missing-r2, missing-r3) fails", () => {
    const input: ReadingsAuditInput = {
      targets: [
        {
          ...goodTarget,
          targetId: "s4-step1",
          targetKind: "derivation-step",
          readings: {
            ...goodTarget.readings,
            r2: "",
          },
        },
      ],
      owners: [goodOwner],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("missing-r2");
  });

  test("PLANTED: R0 sentence count (< 1 or > 2) fails", () => {
    const input: ReadingsAuditInput = {
      targets: [
        {
          ...goodTarget,
          readings: {
            ...goodTarget.readings,
            r0: "First sentence here. Second sentence here. Third sentence makes this too long for R0.",
          },
        },
      ],
      owners: [goodOwner],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("r0-sentence-count");
  });

  test("GOOD RECORD: a two-sentence R0 containing 'Ann. Phys. 17, p. 549' passes without splitting on abbreviations", () => {
    const input: ReadingsAuditInput = {
      targets: [
        {
          ...goodTarget,
          readings: {
            ...goodTarget.readings,
            r0: "According to Ann. Phys. 17, p. 549, suspended particles move constantly in a liquid. This confirms the kinetic theory, e.g. as predicted by Boltzmann, cf. vol. 4, pp. 12-14, i.e. diffusion.",
          },
        },
      ],
      owners: [goodOwner],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(true);
    expect(errorCheckCodes(report)).not.toContain("r0-sentence-count");
  });

  test("PLANTED: R3 missing citation fails", () => {
    const input: ReadingsAuditInput = {
      targets: [
        {
          ...goodTarget,
          readings: {
            ...goodTarget.readings,
            r3Citations: [],
          },
        },
      ],
      owners: [goodOwner],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("r3-citation-missing");
  });

  test("PLANTED: R2 shorter than R1 * 1.2 without override fails with r2-length", () => {
    const input: ReadingsAuditInput = {
      targets: [
        {
          ...goodTarget,
          readings: {
            ...goodTarget.readings,
            r1: "A long paragraph explaining the concept in thirty distinct detailed words to ensure sufficient length for the test comparison baseline.",
            r2: "A short sentence.",
          },
        },
      ],
      owners: [goodOwner],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("r2-length");
  });

  test("GOOD RECORD: R2 with valid reviewed override passes length check", () => {
    const input: ReadingsAuditInput = {
      targets: [
        {
          ...goodTarget,
          readings: {
            ...goodTarget.readings,
            r1: "A long paragraph explaining the concept in thirty distinct detailed words to ensure sufficient length for the test comparison baseline.",
            r2: "A concise derivation step.",
          },
        },
      ],
      owners: [goodOwner],
      overrides: [
        {
          targetId: "s4-p1",
          rule: "r2-length",
          reason: "Mathematical formula step is naturally concise",
          reviewer: "physicist-1",
          date: "1905-05-11",
        },
      ],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(true);
  });

  test("PLANTED: R2 override missing reason or reviewer fails with r2-override-incomplete", () => {
    const input: ReadingsAuditInput = {
      targets: [
        {
          ...goodTarget,
          readings: {
            ...goodTarget.readings,
            r1: "A long paragraph explaining the concept in thirty distinct detailed words to ensure sufficient length for the test comparison baseline.",
            r2: "A concise derivation step.",
          },
        },
      ],
      owners: [goodOwner],
      overrides: [
        {
          targetId: "s4-p1",
          rule: "r2-length",
          reason: "",
          reviewer: "",
        },
      ],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("r2-override-incomplete");
  });

  test("PLANTED: scopeCritical qualification missing from R0/R1/R2 fails as scope-critical-missing", () => {
    const input: ReadingsAuditInput = {
      targets: [
        {
          ...goodTarget,
          readings: {
            ...goodTarget.readings,
            qualificationsCited: [], // not cited across all
            r0: "Particle moves in liquid.",
            r1: "Particle moves in liquid due to agitation.",
            r2: "Particle moves in liquid with mean square displacement growing.",
            r3: "Einstein's relation holds for dilute-spheres (Einstein, 1905).",
          },
          scopeCritical: ["dilute-spheres"],
        },
      ],
      owners: [goodOwner],
    };
    const report = auditReadings(input);
    expect(report.ok).toBe(false);
    expect(errorCheckCodes(report)).toContain("scope-critical-missing");
    const finding = report.findings.find((f) => f.check === "scope-critical-missing");
    expect(finding?.actual).toContain("r0, r1, r2");
  });
});
