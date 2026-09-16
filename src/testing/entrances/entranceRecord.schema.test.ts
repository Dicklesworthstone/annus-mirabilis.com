import { afterAll, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EntranceSchemaError,
  validateEntranceRecord,
} from "../../content/entrances/entranceRecord.ts";
import { newRunIdentity, TestLogger } from "../log/logger.ts";

const BEAD_ID = "am-bm-first-encounter-fjvh";

describe("Entrance Record Schema Suite (am-bm-first-encounter-fjvh)", () => {
  const logger = new TestLogger("brownian-first-encounter", newRunIdentity());

  afterAll(async () => {
    await logger.flush();
  });

  const validAuthorship = {
    draftedBy: [{ id: "jemanuel", kind: "human" as const }],
  };

  const validBridge = {
    id: "bridge-brownian-entrance",
    kind: "bridge" as const,
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
      { route: "more-guidance" as const, targetId: "foundation:mean-variance-rms" },
      { route: "less-guidance" as const, targetId: "instrument:bm-01" },
    ],
    authorship: validAuthorship,
    reviewState: "draft",
  };

  const minimalCoreRecord = {
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
    bridge: validBridge,
  };

  it("validates the real authored entrance record from the content directory", () => {
    const start = performance.now();
    const filePath = resolve(
      process.cwd(),
      "content/arguments/brownian-motion/entrance-brownian-motion.json",
    );
    const rawContent = JSON.parse(readFileSync(filePath, "utf-8"));
    const validated = validateEntranceRecord(rawContent, filePath);

    expect(validated.id).toBe("entrance-brownian-motion");
    expect(validated.paper).toBe("brownian-motion");
    expect(validated.authoredEntries).toEqual([-3, -1, 1, 3]);
    expect(validated.bridge.newSkill).toContain("squaring");

    logger.log({
      testId: "entrance-schema-real-record-pass",
      beadId: BEAD_ID,
      expected: "entrance-brownian-motion",
      actual: validated.id,
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "bitwise",
      extra: {
        recordId: validated.id,
        paper: validated.paper,
      },
    });
  });

  it("validates a record with none of the optional parts", () => {
    const validated = validateEntranceRecord(minimalCoreRecord);
    expect(validated.id).toBe("entrance-brownian-motion");
    expect(validated.tableRows).toBeUndefined();
    expect(validated.choices).toBeUndefined();
    expect(validated.authoredEntries).toBeUndefined();
    expect(validated.presetIds).toBeUndefined();
    expect(validated.embedSlots).toBeUndefined();
  });

  it("validates a record with all optional parts present", () => {
    const fullRecord = {
      ...minimalCoreRecord,
      tableRows: [{ label: "Step 1", value: -3, note: "Leftward move" }],
      choices: [
        {
          id: "choice-square",
          text: "Square each displacement",
          explanation: "Eliminates negative signs while tracking magnitude.",
          correct: true,
        },
      ],
      agreement: "Both proposals show non-zero wandering.",
      consistencyCase: "ideal-gaussian",
      authoredEntries: [-3, -1, 1, 3],
      presetIds: ["preset-standard-walk"],
      embedSlots: {
        returnTo: "journey-02-stage-01",
        continueTo: "journey-02-stage-02",
      },
    };

    const validated = validateEntranceRecord(fullRecord);
    expect(validated.tableRows?.length).toBe(1);
    expect(validated.choices?.length).toBe(1);
    expect(validated.agreement).toBe("Both proposals show non-zero wandering.");
    expect(validated.consistencyCase).toBe("ideal-gaussian");
    expect(validated.authoredEntries).toEqual([-3, -1, 1, 3]);
    expect(validated.presetIds).toEqual(["preset-standard-walk"]);
    expect(validated.embedSlots?.returnTo).toBe("journey-02-stage-01");
  });

  it("fails when any required core field is missing, naming the field and record id", () => {
    const coreFields: (keyof typeof minimalCoreRecord)[] = [
      "id",
      "paper",
      "question",
      "story",
      "sourceAnchor",
      "helpEntries",
      "bridge",
    ];

    for (const field of coreFields) {
      const copy: Record<string, unknown> = { ...minimalCoreRecord };
      delete copy[field];

      expect(() => validateEntranceRecord(copy)).toThrowError(EntranceSchemaError);
      try {
        validateEntranceRecord(copy);
      } catch (err) {
        const e = err as EntranceSchemaError;
        expect(e.code).toContain("missing");
        expect(e.path).toContain(field);
      }
    }
  });

  it("rejects unknown fields on EntranceRecord", () => {
    const recordWithUnknown = {
      ...minimalCoreRecord,
      unrecognizedField: "rogue data",
    };

    expect(() => validateEntranceRecord(recordWithUnknown)).toThrowError(EntranceSchemaError);
    try {
      validateEntranceRecord(recordWithUnknown);
    } catch (err) {
      const e = err as EntranceSchemaError;
      expect(e.code).toBe("unknown-field");
      expect(e.message).toContain("unrecognizedField");
    }
  });

  it("static check: asserts that entranceRecord.ts imports bridge validator and defines no bridge shape of its own", () => {
    const code = readFileSync(
      resolve(process.cwd(), "src/content/entrances/entranceRecord.ts"),
      "utf-8",
    );
    expect(code).toContain("import");
    expect(code).toContain("validateFoundationOrBridge");
    expect(code).not.toContain("interface Bridge {");
    expect(code).not.toContain("type Bridge =");
  });
});
