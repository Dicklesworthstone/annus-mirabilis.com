import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  FIXTURE_JOURNEY_BROWNIAN,
  FIXTURE_PARTIAL_JOURNEY,
} from "../../discovery/testing/fixtureJourney.ts";
import {
  type Branch,
  type Fork,
  type Journey,
  JourneySchemaError,
  type Stage,
  validateJourney,
} from "./journey.ts";

type DeepMutable<T> = {
  -readonly [P in keyof T]: T[P] extends readonly (infer U)[]
    ? DeepMutable<U>[]
    : T[P] extends (infer U)[]
      ? DeepMutable<U>[]
      : T[P] extends object
        ? DeepMutable<T[P]>
        : T[P];
};

function clone<T>(val: T): DeepMutable<T> {
  return JSON.parse(JSON.stringify(val));
}

function firstStage(j: DeepMutable<Journey>): DeepMutable<Stage> {
  const s = j.stages[0];
  assert.ok(s);
  return s;
}

function firstFork(j: DeepMutable<Journey>): DeepMutable<Fork> {
  const f = j.forks[0];
  assert.ok(f);
  return f;
}

function secondFork(j: DeepMutable<Journey>): DeepMutable<Fork> {
  const f = j.forks[1];
  assert.ok(f);
  return f;
}

function firstBranch(f: DeepMutable<Fork>): DeepMutable<Branch> {
  const b = f.branches[0];
  assert.ok(b);
  return b;
}

describe("Journey schema validation throw sites (am-muyh)", () => {
  // ==========================================================================
  // Group 1: Journey root & completeness (Sites 1–9)
  // ==========================================================================

  test("site (journey.ts:277) invalid-journey-record: accepts valid object, rejects null or array", () => {
    assert.ok(validateJourney(FIXTURE_JOURNEY_BROWNIAN));
    assert.throws(
      () => validateJourney(null),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-journey-record");
        return true;
      },
    );
    assert.throws(
      () => validateJourney([1, 2, 3]),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-journey-record");
        return true;
      },
    );
  });

  test("site (journey.ts:282) missing-id: accepts valid id, rejects missing or empty id", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.id = "valid-journey-id";
    assert.equal(validateJourney(valid).id, "valid-journey-id");

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.id = "   ";
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-id");
        return true;
      },
    );
  });

  test("site (journey.ts:285) missing-paper: accepts valid paper, rejects missing or empty paper", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.paper = "special-relativity";
    assert.equal(validateJourney(valid).paper, "special-relativity");

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.paper = "";
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-paper");
        return true;
      },
    );
  });

  test("site (journey.ts:288) invalid-completeness: accepts complete or partial, rejects other values", () => {
    const validComplete = clone(FIXTURE_JOURNEY_BROWNIAN);
    validComplete.completeness = "complete";
    assert.equal(validateJourney(validComplete).completeness, "complete");

    const validPartial = clone(FIXTURE_PARTIAL_JOURNEY);
    assert.equal(validateJourney(validPartial).completeness, "partial");

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.completeness = "draft";
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-completeness");
        return true;
      },
    );
  });

  test("site (journey.ts:299) missing-pending-elements: accepts non-empty pendingElements for partial journey, rejects empty array", () => {
    const valid = clone(FIXTURE_PARTIAL_JOURNEY);
    assert.ok(validateJourney(valid).pendingElements?.length);

    const invalid = clone(FIXTURE_PARTIAL_JOURNEY) as Record<string, unknown>;
    invalid.pendingElements = [];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-pending-elements");
        return true;
      },
    );
  });

  test("site (journey.ts:308) invalid-pending-element: accepts valid pending element object, rejects non-object entry", () => {
    const valid = clone(FIXTURE_PARTIAL_JOURNEY);
    valid.pendingElements = [{ element: "elem", reason: "reason", ownerBead: "bead-123" }];
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_PARTIAL_JOURNEY) as Record<string, unknown>;
    invalid.pendingElements = [null];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-pending-element");
        return true;
      },
    );
  });

  test("site (journey.ts:316) missing-pending-element-name: accepts valid element name, rejects empty element name", () => {
    const valid = clone(FIXTURE_PARTIAL_JOURNEY);
    valid.pendingElements = [{ element: "valid-name", reason: "reason", ownerBead: "bead-123" }];
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_PARTIAL_JOURNEY) as Record<string, unknown>;
    invalid.pendingElements = [{ element: "   ", reason: "reason", ownerBead: "bead-123" }];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-pending-element-name");
        return true;
      },
    );
  });

  test("site (journey.ts:323) missing-pending-element-reason: accepts valid element reason, rejects empty element reason", () => {
    const valid = clone(FIXTURE_PARTIAL_JOURNEY);
    valid.pendingElements = [{ element: "elem", reason: "valid reason", ownerBead: "bead-123" }];
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_PARTIAL_JOURNEY) as Record<string, unknown>;
    invalid.pendingElements = [{ element: "elem", reason: "", ownerBead: "bead-123" }];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-pending-element-reason");
        return true;
      },
    );
  });

  test("site (journey.ts:330) missing-pending-element-owner: accepts valid ownerBead, rejects empty ownerBead", () => {
    const valid = clone(FIXTURE_PARTIAL_JOURNEY);
    valid.pendingElements = [
      { element: "elem", reason: "reason", ownerBead: "am-ref-kinematics-tjq" },
    ];
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_PARTIAL_JOURNEY) as Record<string, unknown>;
    invalid.pendingElements = [{ element: "elem", reason: "reason", ownerBead: "   " }];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-pending-element-owner");
        return true;
      },
    );
  });

  // ==========================================================================
  // Group 2: Admitted imports, shelf, nagging fact, question (Sites 10–18)
  // ==========================================================================

  test("site (journey.ts:350) invalid-admitted-import: accepts valid admitted import object, rejects non-object entry", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    valid.admittedImports = [{ importId: "imp-1", provenance: "paper", sourceAnchor: "anchor-1" }];
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.admittedImports = [null];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-admitted-import");
        return true;
      },
    );
  });

  test("site (journey.ts:358) missing-import-id: accepts valid importId, rejects empty importId", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    valid.admittedImports = [
      { importId: "imp-valid", provenance: "paper", sourceAnchor: "anchor-1" },
    ];
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.admittedImports = [{ importId: "  ", provenance: "paper", sourceAnchor: "anchor-1" }];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-import-id");
        return true;
      },
    );
  });

  test("site (journey.ts:365) missing-import-provenance: accepts valid import provenance, rejects empty provenance", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    valid.admittedImports = [
      { importId: "imp-1", provenance: "paper provenance", sourceAnchor: "anchor-1" },
    ];
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.admittedImports = [{ importId: "imp-1", provenance: "", sourceAnchor: "anchor-1" }];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-import-provenance");
        return true;
      },
    );
  });

  test("site (journey.ts:372) missing-import-anchor: accepts valid sourceAnchor, rejects empty sourceAnchor", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    valid.admittedImports = [{ importId: "imp-1", provenance: "paper", sourceAnchor: "p-anchor" }];
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.admittedImports = [{ importId: "imp-1", provenance: "paper", sourceAnchor: "   " }];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-import-anchor");
        return true;
      },
    );
  });

  test("site (journey.ts:388) missing-shelf: accepts shelf array, rejects non-array shelf", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.shelf = ["card-1", "card-2"];
    assert.equal(validateJourney(valid).shelf.length, 2);

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.shelf = "not-an-array";
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-shelf");
        return true;
      },
    );
  });

  test("site (journey.ts:396) invalid-shelf-card-id: accepts valid card ID strings, rejects non-string or whitespace card ID", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.shelf = ["card-stokes-law"];
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.shelf = ["card-1", "   "];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-shelf-card-id");
        return true;
      },
    );
  });

  test("site (journey.ts:407) missing-nagging-fact: accepts valid naggingFact, rejects empty naggingFact", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.naggingFact = "Suspended particles never stop jiggling.";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.naggingFact = "   ";
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-nagging-fact");
        return true;
      },
    );
  });

  test("site (journey.ts:416) missing-first-honest-question: accepts valid question, rejects empty question", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.firstHonestQuestion = "What drives the motion?";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.firstHonestQuestion = "";
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-first-honest-question");
        return true;
      },
    );
  });

  test("site (journey.ts:423) first-honest-question-must-be-question: accepts question ending with '?', rejects question without '?'", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.firstHonestQuestion = "Why do particles diffuse?";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.firstHonestQuestion = "Why do particles diffuse.";
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "first-honest-question-must-be-question");
        return true;
      },
    );
  });

  // ==========================================================================
  // Group 3: Stages & premise refs (Sites 19–25)
  // ==========================================================================

  test("site (journey.ts:432) missing-stages: accepts stages array, rejects non-array stages", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    assert.ok(validateJourney(valid).stages.length);

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.stages = null;
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-stages");
        return true;
      },
    );
  });

  test("site (journey.ts:437) invalid-stage: accepts stage object, rejects non-object stage entry", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.stages = [null];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-stage");
        return true;
      },
    );
  });

  test("site (journey.ts:441) missing-stage-id: accepts valid stage id, rejects empty stage id", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstStage(valid).id = "stage-osmotic-pressure";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidStages = invalid.stages as Array<Record<string, unknown>>;
    invalidStages[0] = { ...invalidStages[0], id: "  " };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-stage-id");
        return true;
      },
    );
  });

  test("site (journey.ts:444) missing-stage-title: accepts valid stage title, rejects empty stage title", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstStage(valid).title = "Stage Title";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidStages = invalid.stages as Array<Record<string, unknown>>;
    invalidStages[0] = { ...invalidStages[0], title: "" };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-stage-title");
        return true;
      },
    );
  });

  test("site (journey.ts:451) missing-stage-question: accepts valid stage question, rejects empty stage question", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstStage(valid).question = "Why does pressure balance drag?";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidStages = invalid.stages as Array<Record<string, unknown>>;
    invalidStages[0] = { ...invalidStages[0], question: "   " };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-stage-question");
        return true;
      },
    );
  });

  test("site (journey.ts:458) missing-compute-from-shelf: accepts valid computeFromShelf, rejects empty computeFromShelf", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstStage(valid).computeFromShelf = "Compute D from Stokes and osmotic pressure.";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidStages = invalid.stages as Array<Record<string, unknown>>;
    invalidStages[0] = { ...invalidStages[0], computeFromShelf: "" };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-compute-from-shelf");
        return true;
      },
    );
  });

  test("site (journey.ts:478) invalid-premise-ref: accepts string or object premiseRef, rejects invalid premiseRef types", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstStage(valid).premiseRefs = [
      { cardId: "card-osmotic-pressure" },
      { cardId: "card-stokes-law" },
    ];
    assert.ok(validateJourney(valid));

    const rawWithString = {
      ...clone(FIXTURE_JOURNEY_BROWNIAN),
      stages: [
        {
          ...firstStage(clone(FIXTURE_JOURNEY_BROWNIAN)),
          premiseRefs: ["card-osmotic-pressure", { cardId: "card-stokes-law" }],
        },
      ],
    };
    assert.ok(validateJourney(rawWithString));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidStages = invalid.stages as Array<Record<string, unknown>>;
    invalidStages[0] = {
      ...invalidStages[0],
      premiseRefs: [123],
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-premise-ref");
        return true;
      },
    );
  });

  // ==========================================================================
  // Group 4: Forks & branches structure (Sites 26–39)
  // ==========================================================================

  test("site (journey.ts:577) missing-forks: accepts forks array, rejects non-array forks", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    assert.ok(validateJourney(valid).forks.length);

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.forks = "not-an-array";
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-forks");
        return true;
      },
    );
  });

  test("site (journey.ts:582) invalid-fork: accepts fork object, rejects non-object fork entry", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.forks = [null];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-fork");
        return true;
      },
    );
  });

  test("site (journey.ts:586) missing-fork-id: accepts valid fork id, rejects empty fork id", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstFork(valid).id = "fork-bm-choice";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    invalidForks[0] = { ...invalidForks[0], id: "  " };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-fork-id");
        return true;
      },
    );
  });

  test("site (journey.ts:589) missing-after-stage-id: accepts valid afterStageId, rejects empty afterStageId", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstFork(valid).afterStageId = "arg-bm-observable";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    invalidForks[0] = { ...invalidForks[0], afterStageId: "" };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-after-stage-id");
        return true;
      },
    );
  });

  test("site (journey.ts:596) missing-fork-question: accepts valid fork question, rejects empty fork question", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstFork(valid).question = "Which path leads forward?";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    invalidForks[0] = { ...invalidForks[0], question: "   " };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-fork-question");
        return true;
      },
    );
  });

  test("site (journey.ts:609) fork-varies-missing: accepts allowed varies kind, rejects missing or invalid varies", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstFork(valid).varies = "derivation-direction";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    invalidForks[0] = { ...invalidForks[0], varies: "invalid-varies-kind" };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "fork-varies-missing");
        return true;
      },
    );
  });

  test("site (journey.ts:618) fork-too-few-branches: accepts >= 2 branches, rejects < 2 branches", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    assert.ok(firstFork(valid).branches.length >= 2);
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as unknown[];
    fork0.branches = [branches[0]];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "fork-too-few-branches");
        return true;
      },
    );
  });

  test("site (journey.ts:628) invalid-branch: accepts branch object, rejects non-object branch entry", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as unknown[];
    fork0.branches = [null, branches[1]];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-branch");
        return true;
      },
    );
  });

  test("site (journey.ts:632) missing-branch-id: accepts valid branch id, rejects empty branch id", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).id = "branch-valid-id";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      id: "  ",
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-branch-id");
        return true;
      },
    );
  });

  test("site (journey.ts:635) missing-branch-label: accepts valid branch label, rejects empty branch label", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).label = "Alternative Approach";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      label: "",
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-branch-label");
        return true;
      },
    );
  });

  test("site (journey.ts:642) missing-branch-hypothesis: accepts valid hypothesis, rejects empty hypothesis", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).hypothesis = "Particle velocity is interval-dependent.";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      hypothesis: "   ",
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-branch-hypothesis");
        return true;
      },
    );
  });

  test("site (journey.ts:649) missing-branch-works-when: accepts valid worksWhen, rejects empty worksWhen", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).worksWhen = "Works under long observation intervals.";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      worksWhen: "",
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-branch-works-when");
        return true;
      },
    );
  });

  test("site (journey.ts:660) missing-proponent-name: accepts valid proponent name, rejects empty proponent name", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).proponent = { name: "Exner", cardId: "card-exner-1900" };
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      proponent: { name: "   ", cardId: "card-exner-1900" },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-proponent-name");
        return true;
      },
    );
  });

  test("site (journey.ts:667) missing-proponent-card-id: accepts valid proponent cardId, rejects empty proponent cardId", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).proponent = { name: "Exner", cardId: "card-exner-1900" };
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      proponent: { name: "Exner", cardId: "" },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-proponent-card-id");
        return true;
      },
    );
  });

  // ==========================================================================
  // Group 5: Outcomes, constraints, and routes (Sites 40–48)
  // ==========================================================================

  test("site (journey.ts:695) invalid-outcome-type: accepts valid outcome type, rejects invalid outcome type", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).outcome = {
      type: "correct-but-weaker",
      plainLanguage: "Less general.",
    };
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      outcome: { type: "unsupported-outcome-type" },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-outcome-type");
        return true;
      },
    );
  });

  test("site (journey.ts:706) missing-constraint-ref: accepts constraintRef for dead-end-on-constraint, rejects missing constraintRef", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(secondFork(valid)).outcome = {
      type: "dead-end-on-constraint",
      constraintRef: "card-gouy-1888",
      plainLanguage: "Excluded by observation.",
    };
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork1 = invalidForks[1] as Record<string, unknown>;
    const branches = fork1.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      outcome: { type: "dead-end-on-constraint", constraintRef: "  " },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-constraint-ref");
        return true;
      },
    );
  });

  test("site (journey.ts:713) fork-measurement-choice-cannot-dead-end: accepts correct-but-weaker for measurement-choice, rejects dead-end-on-constraint", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstFork(valid).varies = "measurement-choice";
    firstBranch(firstFork(valid)).outcome = {
      type: "correct-but-weaker",
      plainLanguage: "Interval-dependent speed.",
    };
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    fork0.varies = "measurement-choice";
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      outcome: {
        type: "dead-end-on-constraint",
        constraintRef: "card-gouy-1888",
      },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "fork-measurement-choice-cannot-dead-end");
        return true;
      },
    );
  });

  test("site (journey.ts:723) missing-scope-note: accepts scopeNote for empirically-equivalent-not-refuted, rejects missing scopeNote", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).outcome = {
      type: "empirically-equivalent-not-refuted",
      scopeNote: "First-order optical interference observables.",
      plainLanguage: "Empirically equivalent description.",
    };
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      outcome: {
        type: "empirically-equivalent-not-refuted",
        scopeNote: "",
      },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-scope-note");
        return true;
      },
    );
  });

  test("site (journey.ts:734) missing-insufficiency: accepts insufficiency for undecided-on-available-evidence, rejects empty insufficiency", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).outcome = {
      type: "undecided-on-available-evidence",
      insufficiency: "Apparatus resolution was insufficient in 1905.",
      whatWouldDecide: { name: "Perrin", recordId: "perrin-1908" },
      plainLanguage: "Undecided outcome.",
    };
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      outcome: {
        type: "undecided-on-available-evidence",
        insufficiency: "   ",
        whatWouldDecide: { name: "Perrin", recordId: "perrin-1908" },
      },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-insufficiency");
        return true;
      },
    );
  });

  test("site (journey.ts:741) missing-what-would-decide: accepts whatWouldDecide object, rejects non-object whatWouldDecide", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).outcome = {
      type: "undecided-on-available-evidence",
      insufficiency: "Need higher resolution.",
      whatWouldDecide: { name: "Ultramicroscopy", recordId: "zsigmondy-1903" },
      plainLanguage: "Undecided outcome.",
    };
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      outcome: {
        type: "undecided-on-available-evidence",
        insufficiency: "Need higher resolution.",
        whatWouldDecide: null,
      },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-what-would-decide");
        return true;
      },
    );
  });

  test("site (journey.ts:749) missing-what-would-decide-name: accepts whatWouldDecide name, rejects empty name", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).outcome = {
      type: "undecided-on-available-evidence",
      insufficiency: "Need higher resolution.",
      whatWouldDecide: { name: "Valid Experiment", recordId: "record-1" },
      plainLanguage: "Undecided outcome.",
    };
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      outcome: {
        type: "undecided-on-available-evidence",
        insufficiency: "Need higher resolution.",
        whatWouldDecide: { name: "", recordId: "record-1" },
      },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-what-would-decide-name");
        return true;
      },
    );
  });

  test("site (journey.ts:756) missing-what-would-decide-record: accepts whatWouldDecide recordId, rejects empty recordId", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    firstBranch(firstFork(valid)).outcome = {
      type: "undecided-on-available-evidence",
      insufficiency: "Need higher resolution.",
      whatWouldDecide: { name: "Perrin Experiment", recordId: "record-valid" },
      plainLanguage: "Undecided outcome.",
    };
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForks = invalid.forks as Array<Record<string, unknown>>;
    const fork0 = invalidForks[0] as Record<string, unknown>;
    const branches = fork0.branches as Array<Record<string, unknown>>;
    branches[0] = {
      ...branches[0],
      outcome: {
        type: "undecided-on-available-evidence",
        insufficiency: "Need higher resolution.",
        whatWouldDecide: { name: "Perrin", recordId: "   " },
      },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-what-would-decide-record");
        return true;
      },
    );
  });

  test("site (journey.ts:794) fork-papers-route-count: accepts exactly one papers-route branch, rejects zero or multiple", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    assert.equal(
      firstFork(valid).branches.filter((b) => b.outcome.type === "papers-route").length,
      1,
    );
    assert.ok(validateJourney(valid));

    // Zero papers-route branches
    const invalidZero = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForksZero = invalidZero.forks as Array<Record<string, unknown>>;
    const fork0Zero = invalidForksZero[0] as Record<string, unknown>;
    const branchesZero = fork0Zero.branches as Array<Record<string, unknown>>;
    fork0Zero.branches = [
      {
        ...branchesZero[0],
        outcome: { type: "correct-but-weaker" },
      },
      {
        ...branchesZero[1],
        outcome: { type: "correct-but-weaker" },
      },
    ];
    assert.throws(
      () => validateJourney(invalidZero),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "fork-papers-route-count");
        return true;
      },
    );

    // Two papers-route branches
    const invalidTwo = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const invalidForksTwo = invalidTwo.forks as Array<Record<string, unknown>>;
    const fork0Two = invalidForksTwo[0] as Record<string, unknown>;
    const branchesTwo = fork0Two.branches as Array<Record<string, unknown>>;
    fork0Two.branches = [
      {
        ...branchesTwo[0],
        outcome: { type: "papers-route" },
      },
      {
        ...branchesTwo[1],
        outcome: { type: "papers-route" },
      },
    ];
    assert.throws(
      () => validateJourney(invalidTwo),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "fork-papers-route-count");
        return true;
      },
    );
  });

  // ==========================================================================
  // Group 6: Move, world checks, source jumps, exercises (Sites 49–58)
  // ==========================================================================

  test("site (journey.ts:812) missing-move: accepts move object, rejects null or missing move", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    assert.ok(validateJourney(valid).move);

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.move = null;
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-move");
        return true;
      },
    );
  });

  test("site (journey.ts:816) missing-move-label: accepts valid move label, rejects empty move label", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.move.label = "Valid Move Label";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const move = invalid.move as Record<string, unknown>;
    invalid.move = { ...move, label: "   " };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-move-label");
        return true;
      },
    );
  });

  test("site (journey.ts:823) missing-move-chain-id: accepts valid move chainId, rejects empty move chainId", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.move.chainId = "chain-bm-diffusion";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const move = invalid.move as Record<string, unknown>;
    invalid.move = { ...move, chainId: "" };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-move-chain-id");
        return true;
      },
    );
  });

  test("site (journey.ts:830) missing-move-step-id: accepts valid move stepId, rejects empty move stepId", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.move.stepId = "step-move-osmotic";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const move = invalid.move as Record<string, unknown>;
    invalid.move = { ...move, stepId: "  " };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-move-step-id");
        return true;
      },
    );
  });

  test("site (journey.ts:837) missing-r0-summary: accepts r0Summary object, rejects null r0Summary", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.move.r0Summary = { text: "summary text", reviewState: "draft" };
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const move = invalid.move as Record<string, unknown>;
    invalid.move = { ...move, r0Summary: null };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-r0-summary");
        return true;
      },
    );
  });

  test("site (journey.ts:845) missing-r0-summary-text: accepts string r0Summary text, rejects non-string text", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    valid.move.r0Summary.text = "Summary explanation.";
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const move = invalid.move as Record<string, unknown>;
    invalid.move = {
      ...move,
      r0Summary: { text: 123, reviewState: "draft" },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "missing-r0-summary-text");
        return true;
      },
    );
  });

  test("site (journey.ts:852) invalid-review-state: accepts draft or reviewed, rejects other values", () => {
    const validDraft = clone(FIXTURE_JOURNEY_BROWNIAN);
    validDraft.move.r0Summary.reviewState = "draft";
    assert.ok(validateJourney(validDraft));

    const validReviewed = clone(FIXTURE_JOURNEY_BROWNIAN);
    validReviewed.move.r0Summary.reviewState = "reviewed";
    assert.ok(validateJourney(validReviewed));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    const move = invalid.move as Record<string, unknown>;
    invalid.move = {
      ...move,
      r0Summary: { text: "text", reviewState: "unreviewed" },
    };
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-review-state");
        return true;
      },
    );
  });

  test("site (journey.ts:873) invalid-world-check: accepts worldCheck object, rejects non-object entry", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.worldChecks = [null];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-world-check");
        return true;
      },
    );
  });

  test("site (journey.ts:928) invalid-source-jump: accepts sourceJump object, rejects non-object entry", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.sourceJumps = [null];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-source-jump");
        return true;
      },
    );
  });

  test("site (journey.ts:952) invalid-exercise: accepts exercise object, rejects non-object entry", () => {
    const valid = clone(FIXTURE_JOURNEY_BROWNIAN);
    assert.ok(validateJourney(valid));

    const invalid = clone(FIXTURE_JOURNEY_BROWNIAN) as Record<string, unknown>;
    invalid.exercises = [null];
    assert.throws(
      () => validateJourney(invalid),
      (err: unknown) => {
        assert.ok(err instanceof JourneySchemaError);
        assert.equal(err.code, "invalid-exercise");
        return true;
      },
    );
  });
});
