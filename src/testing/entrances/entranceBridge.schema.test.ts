import { afterAll, describe, expect, it } from "bun:test";
import {
  EntranceSchemaError,
  validateEntranceRecord,
} from "../../content/entrances/entranceRecord.ts";
import {
  SkillSymbolError,
  scanSkillSymbols,
  validateSkillNoSymbols,
} from "../../content/entrances/symbolGuard.ts";
import { loadRegistry } from "../../content/foundations/registry.ts";
import { CATALOGUE_STATUS } from "../../experiments/catalogue.ts";
import { newRunIdentity, TestLogger } from "../log/logger.ts";

const BEAD_ID = "am-bm-first-encounter-fjvh";

describe("Entrance Bridge Schema & Contract Tests (am-bm-first-encounter-fjvh)", () => {
  const logger = new TestLogger("brownian-first-encounter", newRunIdentity());

  afterAll(async () => {
    await logger.flush();
  });

  const validAuthorship = {
    draftedBy: [{ id: "jemanuel", kind: "human" as const }],
  };

  const validBridge = {
    id: "bridge-brownian-entrance",
    kind: "bridge",
    title: "From Random Steps to the Diffusion Law",
    concreteOperation: "Track signed displacements and compare absolute sum with sum of squares.",
    compactExplanation: "Squaring keeps opposite displacements from cancelling.",
    textualEquivalent: "Tracking net spread over time by squaring displacement.",
    stoppingPoint: "Transition to the mean-square displacement formula in Section 5.",
    readinessSign: "Can explain why squaring retains movement.",
    returnCaptions: [
      { callingAnchor: "entry-brownian-motion", caption: "Back to Brownian entrance" },
    ],
    newSkill:
      "keeping track of how far things went by squaring, so opposite directions stop cancelling.",
    whyUsefulHere:
      "Section 5 says how far a particle typically wanders after a given time, and that statement is about the squared spread, not about a speed.",
    continueWith: [
      { route: "more-guidance", targetId: "foundation:mean-variance-rms" },
      { route: "less-guidance", targetId: "instrument:bm-01" },
    ],
    authorship: validAuthorship,
    reviewState: "draft",
  };

  const validEntranceRecord = {
    id: "entrance-brownian-motion",
    paper: "brownian-motion",
    question: "Do particles that wander in all directions ever get anywhere?",
    story: "Four trial particles wander three steps left, one left, one right, and three right.",
    sourceAnchor: "#entry-brownian-motion",
    helpEntries: [
      {
        obstacle: "Why not calculate speed directly?",
        clarification: "Because the trajectory is jagged and changes direction constantly.",
      },
    ],
    authoredEntries: [-3, -1, 1, 3],
    bridge: validBridge,
  };

  it("validates a complete entrance record with all three bridge parts", () => {
    const start = performance.now();
    const validated = validateEntranceRecord(validEntranceRecord);
    expect(validated.id).toBe("entrance-brownian-motion");
    expect(validated.bridge.newSkill).toBe(validBridge.newSkill);
    expect(validated.bridge.whyUsefulHere).toBe(validBridge.whyUsefulHere);
    expect(validated.bridge.continueWith?.length).toBe(2);

    logger.log({
      testId: "bridge-schema-valid-entrance",
      beadId: BEAD_ID,
      expected: "entrance-brownian-motion",
      actual: validated.id,
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "bitwise",
      extra: {
        bridgePartsPresent: true,
        newSkillSymbolScan: "clean",
        continueWithCount: 2,
        continueWithKinds: ["more-guidance", "less-guidance"],
        continueWithTargets: ["foundation:mean-variance-rms", "instrument:bm-01"],
      },
    });
  });

  it("fails when newSkill is absent", () => {
    const record = {
      ...validEntranceRecord,
      bridge: { ...validBridge, newSkill: undefined },
    };
    expect(() => validateEntranceRecord(record)).toThrowError(EntranceSchemaError);
    try {
      validateEntranceRecord(record);
    } catch (err) {
      const e = err as EntranceSchemaError;
      expect(e.code).toBe("missing-new-skill");
      expect(e.path).toContain("bridge.newSkill");
    }
  });

  it("fails when whyUsefulHere is absent", () => {
    const record = {
      ...validEntranceRecord,
      bridge: { ...validBridge, whyUsefulHere: "" },
    };
    expect(() => validateEntranceRecord(record)).toThrowError(EntranceSchemaError);
    try {
      validateEntranceRecord(record);
    } catch (err) {
      const e = err as EntranceSchemaError;
      expect(e.code).toBe("missing-why-useful-here");
      expect(e.path).toContain("bridge.whyUsefulHere");
    }
  });

  it("fails when fewer than two continueWith routes are provided", () => {
    const record = {
      ...validEntranceRecord,
      bridge: {
        ...validBridge,
        continueWith: [{ route: "more-guidance", targetId: "foundation:mean-variance-rms" }],
      },
    };
    expect(() => validateEntranceRecord(record)).toThrow();
  });

  it("fails with 'bridge-routes-not-differentiated' when both routes have the same guidance kind", () => {
    const record = {
      ...validEntranceRecord,
      bridge: {
        ...validBridge,
        continueWith: [
          { route: "more-guidance", targetId: "foundation:mean-variance-rms" },
          { route: "more-guidance", targetId: "foundation:random-walks" },
        ],
      },
    };
    expect(() => validateEntranceRecord(record)).toThrow();
  });

  it("compiles a route naming a planned foundation and reports its status", () => {
    const start = performance.now();
    const plannedRecord = {
      ...validEntranceRecord,
      bridge: {
        ...validBridge,
        continueWith: [
          { route: "more-guidance", targetId: "foundation:quantities-units" },
          { route: "less-guidance", targetId: "instrument:bm-01" },
        ],
      },
    };

    const validated = validateEntranceRecord(plannedRecord);
    expect(validated.bridge.continueWith?.[0]?.targetId).toBe("foundation:quantities-units");

    // Prerequisite audit check: foundation:quantities-units is registered with status 'planned'
    const registry = loadRegistry();
    const entry = registry.entries.find((e) => e.id === "foundation:quantities-units");
    expect(entry).toBeDefined();
    expect(entry?.status).toBe("planned");

    logger.log({
      testId: "bridge-route-planned-foundation-reported",
      beadId: BEAD_ID,
      expected: "planned",
      actual: entry?.status,
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "bitwise",
      extra: {
        targetResolution: "planned",
        rule: "am-found-prereq-audit-71ot",
      },
    });
  });

  it("compiles a route naming an in-preparation catalogue id and resolves to in-preparation state", () => {
    const start = performance.now();
    const inPrepRecord = {
      ...validEntranceRecord,
      bridge: {
        ...validBridge,
        continueWith: [
          { route: "more-guidance", targetId: "foundation:mean-variance-rms" },
          { route: "less-guidance", targetId: "instrument:shelf-michelson-morley" },
        ],
      },
    };

    const validated = validateEntranceRecord(inPrepRecord);
    expect(validated.bridge.continueWith?.[1]?.targetId).toBe("instrument:shelf-michelson-morley");

    // Registry dispatcher check: shelf-michelson-morley resolves to 'in-preparation'
    const status = CATALOGUE_STATUS["shelf-michelson-morley"];
    expect(status).toBe("in-preparation");

    logger.log({
      testId: "bridge-route-inprep-instrument-resolved",
      beadId: BEAD_ID,
      expected: "in-preparation",
      actual: status,
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "bitwise",
      extra: {
        targetResolution: "in-preparation",
        rule: "am-inst-registry-dispatcher-66l0",
      },
    });
  });

  it("enforces the No-Symbol rule on newSkill", () => {
    // Valid prose passes
    expect(
      scanSkillSymbols(
        "keeping track of how far things went by squaring, so opposite directions stop cancelling.",
      ).ok,
    ).toBe(true);

    // Seeded symbols fail
    const seededNegativeCases: readonly [string, string][] = [
      ["Tracking ⟨x²⟩ over time", "⟨x²⟩"],
      ["Using \\sqrt{2Dt} to find spread", "\\sqrt"],
      ["Understanding why x² grows with time", "x²"],
      ["Calculating \\Delta x for each step", "\\Delta"],
      ["Using the viscosity \\eta in Stokes law", "\\eta"],
      ["Finding the mean of $x^2$", "$x^2$"],
    ];

    for (const [text, expectedToken] of seededNegativeCases) {
      const scan = scanSkillSymbols(text);
      expect(scan.ok).toBe(false);
      expect(scan.invalidTokens.some((t) => t.includes(expectedToken))).toBe(true);

      expect(() => validateSkillNoSymbols(text)).toThrowError(SkillSymbolError);
    }
  });

  it("rejects an entrance record with seeded symbol in newSkill", () => {
    const record = {
      ...validEntranceRecord,
      bridge: {
        ...validBridge,
        newSkill: "Calculating ⟨x²⟩ to measure wandering spread",
      },
    };

    expect(() => validateEntranceRecord(record)).toThrowError(EntranceSchemaError);
    try {
      validateEntranceRecord(record);
    } catch (err) {
      const e = err as EntranceSchemaError;
      expect(e.code).toBe("symbol-in-skill");
      expect(e.message).toContain("⟨x²⟩");
    }
  });
});
