import { afterAll, describe, expect, it } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EntranceSchemaError,
  paperSlugToEntranceId,
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

describe("EntranceRecord Refusal Throw Sites (am-muyh)", () => {
  const validBridgeFixture = {
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
    authorship: {
      draftedBy: [{ id: "jemanuel", kind: "human" as const }],
    },
    reviewState: "draft" as const,
  };

  function getValidEntranceRecord(): Record<string, unknown> {
    return {
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
      bridge: { ...validBridgeFixture },
    };
  }

  // 1. paperSlugToEntranceId
  it("invalid-entrance-id: rejects invalid slug in paperSlugToEntranceId (entranceRecord.ts:79)", () => {
    assert.throws(
      () => paperSlugToEntranceId("invalid slug with spaces"),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-entrance-id",
    );
    assert.throws(
      () => paperSlugToEntranceId(""),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-entrance-id",
    );

    // Accept counterpart
    const accepted = paperSlugToEntranceId("brownian-motion");
    assert.equal(accepted, "entrance-brownian-motion");
  });

  // 2. validateEntranceRecord payload object check
  it("invalid-record: rejects non-object raw payload (entranceRecord.ts:120)", () => {
    assert.throws(
      () => validateEntranceRecord(null),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-record",
    );
    assert.throws(
      () => validateEntranceRecord("not-an-object"),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-record",
    );
    assert.throws(
      () => validateEntranceRecord([]),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-record",
    );

    // Accept counterpart
    const accepted = validateEntranceRecord(getValidEntranceRecord());
    assert.equal(accepted.id, "entrance-brownian-motion");
  });

  // 3. ID validation
  it("missing-id: rejects missing or empty id (entranceRecord.ts:140)", () => {
    const raw = getValidEntranceRecord();
    raw.id = "";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-id",
    );
    raw.id = "   ";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-id",
    );

    // Accept counterpart
    raw.id = "entrance-brownian-motion";
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.id, "entrance-brownian-motion");
  });

  it("invalid-id: rejects malformed entrance id (entranceRecord.ts:149)", () => {
    const raw = getValidEntranceRecord();
    raw.id = "bad-id-format";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-id",
    );

    // Accept counterpart
    raw.id = "entrance-brownian-motion";
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.id, "entrance-brownian-motion");
  });

  // 4. Paper validation
  it("missing-paper: rejects missing or empty paper (entranceRecord.ts:160)", () => {
    const raw = getValidEntranceRecord();
    raw.paper = "";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-paper",
    );
    raw.paper = "   ";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-paper",
    );

    // Accept counterpart
    raw.paper = "brownian-motion";
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.paper, "brownian-motion");
  });

  it("paper-mismatch: rejects paper that does not match entrance id slug (entranceRecord.ts:175)", () => {
    const raw = getValidEntranceRecord();
    raw.paper = "special-relativity";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "paper-mismatch",
    );

    // Accept counterpart (full slug or short code)
    raw.paper = "brownian-motion";
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.paper, "brownian-motion");
    raw.paper = "bm";
    const acceptedShort = validateEntranceRecord(raw);
    assert.equal(acceptedShort.paper, "bm");
  });

  // 5. Question
  it("missing-question: rejects missing or empty question (entranceRecord.ts:186)", () => {
    const raw = getValidEntranceRecord();
    raw.question = "";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-question",
    );
    raw.question = "   ";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-question",
    );

    // Accept counterpart
    raw.question = "Do particles wander?";
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.question, "Do particles wander?");
  });

  // 6. Story
  it("missing-story: rejects missing or empty story (entranceRecord.ts:197)", () => {
    const raw = getValidEntranceRecord();
    raw.story = "";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-story",
    );
    raw.story = "   ";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-story",
    );

    // Accept counterpart
    raw.story = "Particles step randomly.";
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.story, "Particles step randomly.");
  });

  // 7. Source Anchor
  it("missing-source-anchor: rejects missing or empty sourceAnchor (entranceRecord.ts:208)", () => {
    const raw = getValidEntranceRecord();
    raw.sourceAnchor = "";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-source-anchor",
    );
    raw.sourceAnchor = "   ";
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-source-anchor",
    );

    // Accept counterpart
    raw.sourceAnchor = "#entry-brownian-motion";
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.sourceAnchor, "#entry-brownian-motion");
  });

  // 8. Help Entries
  it("missing-help-entries: rejects non-array helpEntries (entranceRecord.ts:219)", () => {
    const raw = getValidEntranceRecord();
    raw.helpEntries = "not-an-array" as any;
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-help-entries",
    );

    // Accept counterpart
    raw.helpEntries = [{ obstacle: "Speed?", clarification: "Trajectory is jagged." }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.helpEntries.length, 1);
  });

  it("invalid-help-entry: rejects non-object helpEntry item (entranceRecord.ts:230)", () => {
    const raw = getValidEntranceRecord();
    raw.helpEntries = [null as any];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-help-entry",
    );

    // Accept counterpart
    raw.helpEntries = [{ obstacle: "Speed?", clarification: "Trajectory is jagged." }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.helpEntries[0]?.obstacle, "Speed?");
  });

  it("invalid-help-entry: rejects helpEntry missing obstacle (entranceRecord.ts:239)", () => {
    const raw = getValidEntranceRecord();
    raw.helpEntries = [{ obstacle: "   ", clarification: "Clarification" }];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-help-entry",
    );

    // Accept counterpart
    raw.helpEntries = [{ obstacle: "Valid obstacle", clarification: "Clarification" }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.helpEntries[0]?.obstacle, "Valid obstacle");
  });

  it("invalid-help-entry: rejects helpEntry missing clarification (entranceRecord.ts:247)", () => {
    const raw = getValidEntranceRecord();
    raw.helpEntries = [{ obstacle: "Obstacle", clarification: "   " }];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-help-entry",
    );

    // Accept counterpart
    raw.helpEntries = [{ obstacle: "Obstacle", clarification: "Valid clarification" }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.helpEntries[0]?.clarification, "Valid clarification");
  });

  // 9. Bridge Validation
  it("missing-bridge: rejects missing or non-object bridge (entranceRecord.ts:259)", () => {
    const raw = getValidEntranceRecord();
    raw.bridge = null as any;
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "missing-bridge",
    );

    // Accept counterpart
    raw.bridge = { ...validBridgeFixture };
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.bridge.kind, "bridge");
  });

  it("invalid-bridge-kind: rejects bridge with kind other than bridge (entranceRecord.ts:271)", () => {
    const raw = getValidEntranceRecord();
    const validAuthorship = {
      draftedBy: [{ id: "jemanuel", name: "Jeffrey Emanuel", kind: "human" as const }],
    };
    raw.bridge = {
      id: "found-calculus-test",
      kind: "foundation",
      title: "Calculus Foundation Test",
      learningObjective: "Test prerequisite typing",
      compactExplanation: "Compact",
      fullExplanation: "Full",
      workedExample: {
        question: "Q",
        given: "G",
        plausibleFirstThought: "P",
        decisiveStep: "D",
        limitation: "L",
      },
      textualEquivalent: "T",
      stoppingPoint: "S",
      returnCaptions: [],
      authorship: validAuthorship,
      reviewState: "reviewed",
    } as any;
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-bridge-kind",
    );

    // Accept counterpart
    raw.bridge = { ...validBridgeFixture };
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.bridge.kind, "bridge");
  });

  it("invalid-bridge: rejects malformed bridge failing argument schema (entranceRecord.ts:282)", () => {
    const raw = getValidEntranceRecord();
    raw.bridge = { kind: "bridge", id: "invalid-bridge" } as any;
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-bridge",
    );

    // Accept counterpart
    raw.bridge = { ...validBridgeFixture };
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.bridge.id, "bridge-brownian-entrance");
  });

  it("invalid-continue-with-count: rejects bridge with fewer than 2 continueWith routes (entranceRecord.ts:324)", () => {
    const raw = getValidEntranceRecord();
    const bridgeNoContinueWith: any = { ...validBridgeFixture };
    delete bridgeNoContinueWith.continueWith;
    raw.bridge = bridgeNoContinueWith;
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) =>
        err instanceof EntranceSchemaError && err.code === "invalid-continue-with-count",
    );

    // Accept counterpart
    raw.bridge = { ...validBridgeFixture };
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.bridge.continueWith?.length, 2);
  });

  // 10. TableRows
  it("invalid-table-rows: rejects non-array tableRows when defined (entranceRecord.ts:347)", () => {
    const raw = getValidEntranceRecord();
    raw.tableRows = "not-an-array" as any;
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-table-rows",
    );

    // Accept counterpart
    raw.tableRows = [{ label: "Step 1", value: -3 }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.tableRows?.length, 1);
  });

  it("invalid-table-row: rejects non-object tableRow item (entranceRecord.ts:358)", () => {
    const raw = getValidEntranceRecord();
    raw.tableRows = [null as any];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-table-row",
    );

    // Accept counterpart
    raw.tableRows = [{ label: "Step 1", value: -3 }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.tableRows?.[0]?.label, "Step 1");
  });

  it("invalid-table-row: rejects tableRow missing label (entranceRecord.ts:367)", () => {
    const raw = getValidEntranceRecord();
    raw.tableRows = [{ label: "   ", value: -3 }];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-table-row",
    );

    // Accept counterpart
    raw.tableRows = [{ label: "Step 1", value: -3 }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.tableRows?.[0]?.label, "Step 1");
  });

  it("invalid-table-row: rejects tableRow with non-number non-string value (entranceRecord.ts:375)", () => {
    const raw = getValidEntranceRecord();
    raw.tableRows = [{ label: "Step 1", value: { obj: true } as any }];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-table-row",
    );

    // Accept counterpart (number or string)
    raw.tableRows = [
      { label: "Step 1", value: -3 },
      { label: "Step 2", value: "spread" },
    ];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.tableRows?.length, 2);
  });

  // 11. Choices
  it("invalid-choices: rejects non-array choices when defined (entranceRecord.ts:393)", () => {
    const raw = getValidEntranceRecord();
    raw.choices = "not-an-array" as any;
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-choices",
    );

    // Accept counterpart
    raw.choices = [{ id: "c1", text: "Choice 1", explanation: "Explanation 1", correct: true }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.choices?.length, 1);
  });

  it("invalid-choice: rejects non-object choice item (entranceRecord.ts:404)", () => {
    const raw = getValidEntranceRecord();
    raw.choices = [null as any];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-choice",
    );

    // Accept counterpart
    raw.choices = [{ id: "c1", text: "Choice 1", explanation: "Explanation 1" }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.choices?.[0]?.id, "c1");
  });

  it("invalid-choice: rejects choice missing id (entranceRecord.ts:413)", () => {
    const raw = getValidEntranceRecord();
    raw.choices = [{ id: "   ", text: "Choice 1", explanation: "Explanation 1" }];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-choice",
    );

    // Accept counterpart
    raw.choices = [{ id: "c1", text: "Choice 1", explanation: "Explanation 1" }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.choices?.[0]?.id, "c1");
  });

  it("invalid-choice: rejects choice missing text (entranceRecord.ts:421)", () => {
    const raw = getValidEntranceRecord();
    raw.choices = [{ id: "c1", text: "   ", explanation: "Explanation 1" }];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-choice",
    );

    // Accept counterpart
    raw.choices = [{ id: "c1", text: "Choice 1", explanation: "Explanation 1" }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.choices?.[0]?.text, "Choice 1");
  });

  it("invalid-choice: rejects choice missing explanation (entranceRecord.ts:429)", () => {
    const raw = getValidEntranceRecord();
    raw.choices = [{ id: "c1", text: "Choice 1", explanation: "   " }];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-choice",
    );

    // Accept counterpart
    raw.choices = [{ id: "c1", text: "Choice 1", explanation: "Valid explanation" }];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.choices?.[0]?.explanation, "Valid explanation");
  });

  // 12. AuthoredEntries
  it("invalid-authored-entries: rejects non-array authoredEntries when defined (entranceRecord.ts:448)", () => {
    const raw = getValidEntranceRecord();
    raw.authoredEntries = "not-an-array" as any;
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) =>
        err instanceof EntranceSchemaError && err.code === "invalid-authored-entries",
    );

    // Accept counterpart
    raw.authoredEntries = [-3, -1, 1, 3];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.authoredEntries?.length, 4);
  });

  it("invalid-authored-entry: rejects non-number or NaN in authoredEntries (entranceRecord.ts:459)", () => {
    const raw = getValidEntranceRecord();
    raw.authoredEntries = [1, "two" as any, 3];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-authored-entry",
    );
    raw.authoredEntries = [1, NaN, 3];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-authored-entry",
    );

    // Accept counterpart
    raw.authoredEntries = [-3, -1, 1, 3];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.authoredEntries?.[1], -1);
  });

  // 13. PresetIds
  it("invalid-preset-ids: rejects non-string array presetIds when defined (entranceRecord.ts:473)", () => {
    const raw = getValidEntranceRecord();
    raw.presetIds = "not-an-array" as any;
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-preset-ids",
    );
    raw.presetIds = ["preset-1", 123 as any];
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-preset-ids",
    );

    // Accept counterpart
    raw.presetIds = ["preset-standard-walk", "preset-fast-walk"];
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.presetIds?.length, 2);
  });

  // 14. EmbedSlots
  it("invalid-embed-slots: rejects non-object embedSlots when defined (entranceRecord.ts:486)", () => {
    const raw = getValidEntranceRecord();
    raw.embedSlots = "not-an-object" as any;
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-embed-slots",
    );
    raw.embedSlots = null as any;
    assert.throws(
      () => validateEntranceRecord(raw),
      (err: unknown) => err instanceof EntranceSchemaError && err.code === "invalid-embed-slots",
    );

    // Accept counterpart
    raw.embedSlots = {
      returnTo: "journey-02-stage-01",
      continueTo: "journey-02-stage-02",
    };
    const accepted = validateEntranceRecord(raw);
    assert.equal(accepted.embedSlots?.returnTo, "journey-02-stage-01");
  });
});
