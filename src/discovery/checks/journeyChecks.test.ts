import { describe, expect, test } from "bun:test";
import { validateJourney } from "../../content/schemas/journey.ts";
import { FIXTURE_JOURNEY_BROWNIAN, FIXTURE_PARTIAL_JOURNEY } from "../testing/fixtureJourney.ts";
import { checkJourney } from "./journeyChecks.ts";

describe("checkJourney: complete and partial journeys", () => {
  test("complete fixture journey validates with zero errors", () => {
    const findings = checkJourney(FIXTURE_JOURNEY_BROWNIAN);
    const errors = findings.filter((f) => f.severity === "error");
    expect(errors.length).toBe(0);
  });

  test("partial fixture journey with declared pending elements passes validation", () => {
    const findings = checkJourney(FIXTURE_PARTIAL_JOURNEY);
    const errors = findings.filter((f) => f.severity === "error");
    expect(errors.length).toBe(0);
  });

  test("complete journey missing a required element fails with element named", () => {
    const invalid = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      worldChecks: [],
    };
    const findings = checkJourney(invalid);
    const missingWorld = findings.find(
      (f) => f.rule === "journey-complete-missing-element" && f.element === "worldChecks",
    );
    expect(missingWorld).toBeDefined();
  });

  test("partial journey missing an undeclared required element fails", () => {
    const invalid = {
      ...FIXTURE_PARTIAL_JOURNEY,
      shelf: [], // shelf missing but not listed in pendingElements
    };
    const findings = checkJourney(invalid);
    const undeclared = findings.find(
      (f) => f.rule === "journey-partial-undeclared-pending-element" && f.element === "shelf",
    );
    expect(undeclared).toBeDefined();
  });

  test("partial journey declaring a pending element that is actually present fails", () => {
    const invalid = {
      ...FIXTURE_PARTIAL_JOURNEY,
      pendingElements: [
        ...(FIXTURE_PARTIAL_JOURNEY.pendingElements ?? []),
        {
          element: "stages",
          reason: "Stages in preparation",
          ownerBead: "am-disc-journey-i-chain-n1lh",
        },
      ],
    };
    const findings = checkJourney(invalid);
    const alreadyPresent = findings.find(
      (f) => f.rule === "journey-pending-element-already-present" && f.element === "stages",
    );
    expect(alreadyPresent).toBeDefined();
  });

  test("instrumented exercise count out of bounds (1 or 6) fails", () => {
    const tooFew = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      exercises: [{ id: "ex-1", role: "instrumented" as const }],
    };
    const findingsFew = checkJourney(tooFew);
    expect(findingsFew.some((f) => f.rule === "journey-instrumented-exercise-count")).toBe(true);

    const tooMany = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      exercises: [
        { id: "ex-1", role: "instrumented" as const },
        { id: "ex-2", role: "instrumented" as const },
        { id: "ex-3", role: "instrumented" as const },
        { id: "ex-4", role: "instrumented" as const },
        { id: "ex-5", role: "instrumented" as const },
        { id: "ex-6", role: "instrumented" as const },
      ],
    };
    const findingsMany = checkJourney(tooMany);
    expect(findingsMany.some((f) => f.rule === "journey-instrumented-exercise-count")).toBe(true);
  });

  test("doors arriving at different equation IDs fail validation", () => {
    const mismatchedDoors = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      doors: {
        frontDoor: {
          id: "door-front",
          title: "Front Door",
          arrivesAtEquationId: "eq-target-1",
        },
        sideDoors: [
          {
            id: "door-side",
            title: "Side Door",
            arrivesAtEquationId: "eq-target-2", // mismatch
          },
        ],
      },
    };
    const findings = checkJourney(mismatchedDoors);
    expect(findings.some((f) => f.rule === "doors-arrives-at-mismatch")).toBe(true);
  });
});

describe("journeyChecks refusal throw sites (am-muyh)", () => {
  test("journey-explanation-exercise-count (journeyChecks.ts:352): accept <= 4 explanation exercises, reject > 4", () => {
    const baseExercises = FIXTURE_JOURNEY_BROWNIAN.exercises.filter(
      (e) => e.role === "instrumented",
    );
    const acceptJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      exercises: [
        ...baseExercises,
        { id: "ex-exp-1", role: "explanation" as const, prompt: "Prompt 1" },
        { id: "ex-exp-2", role: "explanation" as const, prompt: "Prompt 2" },
        { id: "ex-exp-3", role: "explanation" as const, prompt: "Prompt 3" },
        { id: "ex-exp-4", role: "explanation" as const, prompt: "Prompt 4" },
      ],
    };
    const acceptFindings = checkJourney(acceptJourney);
    expect(acceptFindings.some((f) => f.rule === "journey-explanation-exercise-count")).toBe(false);

    const rejectJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      exercises: [
        ...baseExercises,
        { id: "ex-exp-1", role: "explanation" as const, prompt: "Prompt 1" },
        { id: "ex-exp-2", role: "explanation" as const, prompt: "Prompt 2" },
        { id: "ex-exp-3", role: "explanation" as const, prompt: "Prompt 3" },
        { id: "ex-exp-4", role: "explanation" as const, prompt: "Prompt 4" },
        { id: "ex-exp-5", role: "explanation" as const, prompt: "Prompt 5" },
      ],
    };
    const rejectFindings = checkJourney(rejectJourney);
    const rejectFinding = rejectFindings.find(
      (f) => f.rule === "journey-explanation-exercise-count",
    );
    expect(rejectFinding).toBeDefined();
    expect(rejectFinding?.severity).toBe("error");
  });

  test("fork-undecided-already-decidable (journeyChecks.ts:522): accept post-1904 evidence, reject pre-1905 evidence", () => {
    const fork0 = FIXTURE_JOURNEY_BROWNIAN.forks[0];
    if (!fork0) throw new Error("Fixture missing fork 0");
    const branch0 = fork0.branches[0];
    const branch1 = fork0.branches[1];
    if (!branch0 || !branch1) throw new Error("Fixture missing branches");

    const acceptJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          ...fork0,
          branches: [
            {
              ...branch0,
              outcome: {
                type: "undecided-on-available-evidence" as const,
                plainLanguage: "Cannot be decided with existing 1904 instruments.",
                insufficiency: "Microscopes lack sufficient temporal resolution.",
                whatWouldDecide: {
                  name: "Post-1904 Evidence",
                  recordId: "ev-post-1904",
                  year: 1908,
                },
              },
            },
            branch1,
          ],
        },
        ...FIXTURE_JOURNEY_BROWNIAN.forks.slice(1),
      ],
    };
    const acceptFindings = checkJourney(acceptJourney);
    expect(acceptFindings.some((f) => f.rule === "fork-undecided-already-decidable")).toBe(false);

    const rejectJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          ...fork0,
          branches: [
            {
              ...branch0,
              outcome: {
                type: "undecided-on-available-evidence" as const,
                plainLanguage: "Cannot be decided with existing 1904 instruments.",
                insufficiency: "Microscopes lack sufficient temporal resolution.",
                whatWouldDecide: {
                  name: "Pre-1905 Evidence",
                  recordId: "ev-pre-1905",
                  year: 1902,
                },
              },
            },
            branch1,
          ],
        },
        ...FIXTURE_JOURNEY_BROWNIAN.forks.slice(1),
      ],
    };
    const rejectFindings = checkJourney(rejectJourney);
    const rejectFinding = rejectFindings.find((f) => f.rule === "fork-undecided-already-decidable");
    expect(rejectFinding).toBeDefined();
    expect(rejectFinding?.severity).toBe("error");
  });

  /**
   * THE CITATION NAMED THE WRONG FILE, and a plant is what found it (am-4k0m).
   *
   * This test's heading used to name journeyChecks.ts line 434. Renaming the rule at journeyChecks's
   * own fork-papers-route-count site turned NOTHING red: validateJourney throws that code FIRST, at
   * journey.ts line 794, and checkJourney returns the schema error as a finding without ever reaching
   * its own site. Renaming the schema's line turns exactly this test red, so that is where the rule
   * this test drives lives, and the heading now says so.
   *
   * The journeyChecks site is therefore unreachable through the public entry point, like the
   * fork-undecided-missing-what-would-decide branch beside it. Both are left in place and recorded on
   * am-4k0m rather than removed.
   *
   * Two notes on the citation itself, each a rule this repair walked into:
   *
   * - validateJourney is imported and asserted on directly, not for decoration. The scanner resolves a
   *   cited basename against the files the test IMPORTS, so a citation naming a file this test did not
   *   import would be silently dropped rather than checked, which is a citation nobody verifies.
   * - Every line number above is written in words rather than in the parenthesised citation form,
   *   because the scanner matches that form anywhere in the file. Prose ABOUT a stale citation would
   *   otherwise BE one, which is the same rule as a gate reading text where it meant to read code.
   */
  test("fork-papers-route-count (journey.ts:794): accept exactly one papers-route branch, reject zero or multiple", () => {
    const fork0 = FIXTURE_JOURNEY_BROWNIAN.forks[0];
    if (!fork0) throw new Error("Fixture missing fork 0");
    // Default FIXTURE_JOURNEY_BROWNIAN has exactly 1 papers-route branch per fork
    const acceptFindings = checkJourney(FIXTURE_JOURNEY_BROWNIAN);
    expect(acceptFindings.some((f) => f.rule === "fork-papers-route-count")).toBe(false);

    // Reject 0 papers-route branches
    const rejectZeroJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          ...fork0,
          branches: fork0.branches.map((b) => ({
            ...b,
            outcome: {
              type: "correct-but-weaker" as const,
              plainLanguage: "Valid consequence but not the route taken in the paper.",
            },
          })),
        },
        ...FIXTURE_JOURNEY_BROWNIAN.forks.slice(1),
      ],
    };
    const rejectFindings = checkJourney(rejectZeroJourney);
    const rejectFinding = rejectFindings.find((f) => f.rule === "fork-papers-route-count");
    expect(rejectFinding).toBeDefined();
    expect(rejectFinding?.severity).toBe("error");
    // And the refusal comes from the SCHEMA, which is the claim the heading now makes. Without this the
    // citation would name a file this test only reaches by accident.
    expect(() => validateJourney(rejectZeroJourney)).toThrow(/fork-papers-route-count/);
    expect(() => validateJourney(FIXTURE_JOURNEY_BROWNIAN)).not.toThrow();
  });

  test("prediction-numeric-literal-forbidden (journeyChecks.ts:666): accept non-numeric choices, reject raw numeric literal", () => {
    const stage0 = FIXTURE_JOURNEY_BROWNIAN.stages[0];
    if (!stage0) throw new Error("Fixture missing stage 0");
    // Accept case: choices are conceptual strings
    const acceptJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      stages: [
        {
          ...stage0,
          support: {
            ...stage0.support,
            prediction: {
              prompt: "What happens to the spread when the observation time quadruples?",
              choices: ["No change", "It doubles", "It quadruples"],
              explanation: "The displacement scale grows with the square root of time.",
            },
          },
        },
        ...FIXTURE_JOURNEY_BROWNIAN.stages.slice(1),
      ],
    };
    const acceptFindings = checkJourney(acceptJourney);
    expect(acceptFindings.some((f) => f.rule === "prediction-numeric-literal-forbidden")).toBe(
      false,
    );

    // Reject case: choices contains raw numeric literal "42"
    const rejectJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      stages: [
        {
          ...stage0,
          support: {
            ...stage0.support,
            prediction: {
              prompt: "What happens to the spread when the observation time quadruples?",
              choices: ["42", "It doubles"],
              explanation: "Numeric literals forbidden.",
            },
          },
        },
        ...FIXTURE_JOURNEY_BROWNIAN.stages.slice(1),
      ],
    };
    const rejectFindings = checkJourney(rejectJourney);
    const rejectFinding = rejectFindings.find(
      (f) => f.rule === "prediction-numeric-literal-forbidden",
    );
    expect(rejectFinding).toBeDefined();
    expect(rejectFinding?.severity).toBe("error");
  });

  test("world-check-later-evidence-year-invalid (journeyChecks.ts:709): accept post-1904 year, reject <= 1904", () => {
    const wc0 = FIXTURE_JOURNEY_BROWNIAN.worldChecks[0];
    if (!wc0?.laterEvidence) {
      throw new Error("Fixture missing world check 0 with laterEvidence");
    }
    const laterEvidence = wc0.laterEvidence;
    // Accept case: year 1908
    const acceptJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      worldChecks: [
        {
          ...wc0,
          laterEvidence: {
            ...laterEvidence,
            year: 1908,
          },
        },
      ],
    };
    const acceptFindings = checkJourney(acceptJourney);
    expect(acceptFindings.some((f) => f.rule === "world-check-later-evidence-year-invalid")).toBe(
      false,
    );

    // Reject case: year 1904
    const rejectJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      worldChecks: [
        {
          ...wc0,
          laterEvidence: {
            ...laterEvidence,
            year: 1904,
          },
        },
      ],
    };
    const rejectFindings = checkJourney(rejectJourney);
    const rejectFinding = rejectFindings.find(
      (f) => f.rule === "world-check-later-evidence-year-invalid",
    );
    expect(rejectFinding).toBeDefined();
    expect(rejectFinding?.severity).toBe("error");
  });

  test("rejects when non-JourneySchemaError is thrown during journey validation (journeyChecks.ts:135)", () => {
    const corruptJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      get paper() {
        throw new TypeError("Corrupt paper getter thrown");
      },
    };
    const findings = checkJourney(corruptJourney as any);
    const schemaError = findings.find((f) => f.rule === "journey-schema-error");
    expect(schemaError).toBeDefined();
    expect(schemaError?.severity).toBe("error");
    expect(schemaError?.message).toContain("Corrupt paper getter thrown");

    // Accept case: valid journey validates without unexpected schema error
    const validFindings = checkJourney(FIXTURE_JOURNEY_BROWNIAN);
    expect(validFindings.some((f) => f.rule === "journey-schema-error")).toBe(false);
  });

  test("a schema error says that the rest of the checks did NOT run, on both throw paths", () => {
    // The defect this guards: a journey that fails the schema is reported as one finding and every
    // epistemic gate is skipped, so the output reads as a small problem. brownian-motion sat that
    // way with a three-sentence move summary nobody had ever been told about (am-4k0m).
    const SAYS_UNMEASURED = /UNMEASURED on this journey rather than passed/;

    // Path 1: a JourneySchemaError, raised by an invalid outcome rather than by a contrived object.
    const badOutcome = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          ...FIXTURE_JOURNEY_BROWNIAN.forks[0],
          branches: (FIXTURE_JOURNEY_BROWNIAN.forks[0]?.branches ?? []).map((b, i) =>
            i === 0 ? { ...b, outcome: { ...b.outcome, type: "not-a-real-outcome-type" } } : b,
          ),
        },
        ...FIXTURE_JOURNEY_BROWNIAN.forks.slice(1),
      ],
    };
    const schemaFindings = checkJourney(badOutcome as never);
    expect(schemaFindings).toHaveLength(1);
    expect(schemaFindings[0]?.severity).toBe("error");
    expect(schemaFindings[0]?.message).toMatch(SAYS_UNMEASURED);
    // The original reason survives beside the notice rather than being replaced by it.
    expect(schemaFindings[0]?.message).toContain("not-a-real-outcome-type");

    // Path 2: a non-JourneySchemaError, which takes the other arm of the same catch.
    const corrupt = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      get paper(): string {
        throw new TypeError("Corrupt paper getter thrown");
      },
    };
    const corruptFindings = checkJourney(corrupt as never);
    expect(corruptFindings).toHaveLength(1);
    expect(corruptFindings[0]?.message).toMatch(SAYS_UNMEASURED);
    expect(corruptFindings[0]?.message).toContain("Corrupt paper getter thrown");

    // THE NEGATIVE, so the notice is not simply appended to everything: a journey that validates
    // carries it on no finding, and the fixture really does produce findings to check.
    const valid = checkJourney(FIXTURE_JOURNEY_BROWNIAN);
    // Non-vacuity FIRST: the negative below needs a message to be false about. The fixture produces
    // one voice warning, and if a later change made it findings-free, `some` over an empty list
    // would report "the notice is absent" while checking nothing.
    expect(valid.length).toBeGreaterThan(0);
    expect(valid.some((f) => SAYS_UNMEASURED.test(f.message))).toBe(false);
    expect(checkJourney(FIXTURE_PARTIAL_JOURNEY).length).toBeGreaterThan(0);
  });

  test("rejects when undecided branch is missing insufficiency statement (journeyChecks.ts:484)", () => {
    let calls = 0;
    const branch0 = FIXTURE_JOURNEY_BROWNIAN.forks[0]?.branches[0];
    const branch1 = FIXTURE_JOURNEY_BROWNIAN.forks[0]?.branches[1];
    if (!branch0 || !branch1) throw new Error("Missing branches");
    const undecidedBranch = {
      ...branch0,
      outcome: {
        type: "undecided-on-available-evidence",
        get insufficiency() {
          return calls++ < 2 ? "Valid 1904 insufficiency statement" : "";
        },
        whatWouldDecide: {
          name: "Future experiment",
          recordId: "future-rec",
        },
      },
    };
    const testJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          ...FIXTURE_JOURNEY_BROWNIAN.forks[0],
          branches: [undecidedBranch, branch1],
        },
      ],
    };

    const rejectFindings = checkJourney(testJourney as any);
    const finding = rejectFindings.find((f) => f.rule === "fork-undecided-missing-insufficiency");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("error");
    expect(finding?.message).toContain("missing insufficiency statement");

    // Accept case: valid insufficiency
    const acceptJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          ...FIXTURE_JOURNEY_BROWNIAN.forks[0],
          branches: [
            {
              ...branch0,
              outcome: {
                type: "undecided-on-available-evidence",
                insufficiency: "Historical records show evidence was inconclusive in 1904.",
                whatWouldDecide: {
                  name: "Perrin 1908 measurements",
                  recordId: "future-perrin-1908",
                },
              },
            },
            branch1,
          ],
        },
      ],
    };
    const acceptFindings = checkJourney(acceptJourney as any);
    expect(acceptFindings.some((f) => f.rule === "fork-undecided-missing-insufficiency")).toBe(
      false,
    );
  });

  test("rejects when an undecided branch is missing whatWouldDecide", () => {
    // REWRITTEN 2026-10-05 (am-4k0m), and the reason is a finding rather than a tidy-up.
    //
    // This test used to build the branch with a GETTER that returned a value for the first three reads
    // and `undefined` afterwards, so that `validateJourney` would accept the object and `checkJourney`
    // would then see the field missing. That only worked while the two functions read the property a
    // specific number of times, and it stopped working the moment `checkJourney` began reading the
    // NORMALISED record the schema returns instead of the raw object -- a repair that fixed a TypeError
    // crash on input the schema calls valid. A test tuned to a read count is coupled to the
    // implementation rather than to the behaviour, and it broke on a correct change.
    //
    // WHAT THE OLD TEST WAS REACHING, measured: `checkJourney`'s own
    // `fork-undecided-missing-what-would-decide` branch is UNREACHABLE through any input the schema
    // accepts. Omitting the field plainly makes `validateJourney` throw `missing-what-would-decide`
    // first, and `checkJourney` reports that instead. The duplicate branch is dead code behind the
    // schema; it is left in place rather than removed, and recorded on am-4k0m.
    //
    // So this asserts the PROPERTY -- an undecided branch with no whatWouldDecide is refused through
    // the public entry point -- on an input a record could actually hold.
    const branch0 = FIXTURE_JOURNEY_BROWNIAN.forks[0]?.branches[0];
    const branch1 = FIXTURE_JOURNEY_BROWNIAN.forks[0]?.branches[1];
    if (!branch0 || !branch1) throw new Error("Missing branches");
    const undecidedBranch = {
      ...branch0,
      outcome: {
        type: "undecided-on-available-evidence",
        insufficiency: "Evidence was insufficient in 1904.",
      },
    };
    const testJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          ...FIXTURE_JOURNEY_BROWNIAN.forks[0],
          branches: [undecidedBranch, branch1],
        },
      ],
    };

    const rejectFindings = checkJourney(testJourney as any);
    const finding = rejectFindings.find((f) => /what-would-decide/.test(f.rule));
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("error");
    expect(finding?.message).toContain("whatWouldDecide");
    // The outcome type is named, so the refusal says which rule it belongs to.
    expect(finding?.message).toContain("undecided-on-available-evidence");

    // Accept case: valid whatWouldDecide
    const acceptJourney = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          ...FIXTURE_JOURNEY_BROWNIAN.forks[0],
          branches: [
            {
              ...branch0,
              outcome: {
                type: "undecided-on-available-evidence",
                insufficiency: "Historical records show evidence was inconclusive in 1904.",
                whatWouldDecide: {
                  name: "Perrin 1908 measurements",
                  recordId: "future-perrin-1908",
                },
              },
            },
            branch1,
          ],
        },
      ],
    };
    const acceptFindings = checkJourney(acceptJourney as any);
    expect(acceptFindings.some((f) => f.rule === "fork-undecided-missing-what-would-decide")).toBe(
      false,
    );
  });
});
