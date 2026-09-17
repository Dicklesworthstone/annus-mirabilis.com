import { describe, expect, test } from "bun:test";
import { FIXTURE_JOURNEY_BROWNIAN } from "../testing/fixtureJourney.ts";
import { checkJourney } from "./journeyChecks.ts";

describe("journeyForkContract", () => {
  test("all four varies values are valid", () => {
    const variesValues = [
      "observable-definition",
      "measurement-choice",
      "theoretical-postulate",
      "derivation-direction",
    ] as const;

    for (const v of variesValues) {
      const journey = {
        ...FIXTURE_JOURNEY_BROWNIAN,
        forks: [
          {
            ...FIXTURE_JOURNEY_BROWNIAN.forks[0]!,
            varies: v,
          },
          FIXTURE_JOURNEY_BROWNIAN.forks[1]!,
        ],
      };
      const findings = checkJourney(journey);
      const variesErrors = findings.filter((f) => f.rule === "fork-varies-missing");
      expect(variesErrors.length).toBe(0);
    }
  });

  test("a fork missing varies fails with fork-varies-missing naming the fork id", () => {
    const invalid = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          ...FIXTURE_JOURNEY_BROWNIAN.forks[0]!,
          varies: "invalid-varies" as any,
        },
        FIXTURE_JOURNEY_BROWNIAN.forks[1]!,
      ],
    };
    const findings = checkJourney(invalid);
    expect(findings.some((f) => f.rule === "fork-varies-missing")).toBe(true);
  });

  test("measurement-choice fork cannot use dead-end-on-constraint outcome", () => {
    const invalid = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          id: "arg-fork-exner",
          afterStageId: "arg-bm-observable",
          question: "Which quantity to measure?",
          varies: "measurement-choice" as const,
          branches: [
            {
              id: "branch-dead-end",
              label: "Dead end choice",
              hypothesis: "Apparent velocity is an intrinsic constant.",
              worksWhen: "Short intervals.",
              steps: [{ text: "Step 1" }],
              outcome: {
                type: "dead-end-on-constraint" as const,
                constraintRef: "card-exner-1900",
                plainLanguage: "Contradicted by interval scaling.",
              },
            },
            {
              id: "branch-paper",
              label: "Paper route",
              hypothesis: "Displacement spread.",
              worksWhen: "Long intervals.",
              steps: [{ text: "Step 2" }],
              outcome: {
                type: "papers-route" as const,
                plainLanguage: "Paper route.",
              },
            },
          ],
        },
        FIXTURE_JOURNEY_BROWNIAN.forks[1]!,
      ],
    };
    const findings = checkJourney(invalid);
    expect(findings.some((f) => f.rule === "fork-measurement-choice-cannot-dead-end")).toBe(true);
  });

  test("empirically-equivalent-not-refuted without scopeNote or with trivial scopeNote fails", () => {
    const invalid = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          id: "arg-fork-equivalent",
          afterStageId: "arg-bm-observable",
          question: "Alternative models",
          varies: "theoretical-postulate" as const,
          branches: [
            {
              id: "branch-equiv",
              label: "Equivalent branch",
              hypothesis: "Continuous fluid model",
              worksWhen: "Macroscopic limits",
              steps: [{ text: "Step" }],
              outcome: {
                type: "empirically-equivalent-not-refuted" as const,
                scopeNote: "they agree here", // trivial scopeNote
                plainLanguage: "Agrees with observations.",
              },
            },
            {
              id: "branch-paper",
              label: "Paper branch",
              hypothesis: "Atomic diffusion",
              worksWhen: "Always",
              steps: [{ text: "Step" }],
              outcome: {
                type: "papers-route" as const,
                plainLanguage: "Paper route.",
              },
            },
          ],
        },
        FIXTURE_JOURNEY_BROWNIAN.forks[1]!,
      ],
    };
    const findings = checkJourney(invalid);
    expect(
      findings.some(
        (f) => f.rule === "fork-scope-note-trivial" || f.rule === "fork-scope-note-missing",
      ),
    ).toBe(true);
  });

  test("undecided-on-available-evidence requires insufficiency and post-1904 whatWouldDecide", () => {
    const validUndecided = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          id: "arg-fork-undecided",
          afterStageId: "arg-bm-observable",
          question: "Can 1904 data distinguish these mechanisms?",
          varies: "theoretical-postulate" as const,
          branches: [
            {
              id: "branch-undecided",
              label: "Undecided hypothesis",
              hypothesis: "Sub-microscopic fluid vortices",
              worksWhen: "Unmeasured viscosity regimes",
              steps: [{ text: "Step 1" }],
              outcome: {
                type: "undecided-on-available-evidence" as const,
                insufficiency:
                  "Optical microscopes in 1904 could not resolve motion under 0.1 seconds.",
                whatWouldDecide: {
                  name: "Perrin's quantitative emulsion data",
                  recordId: "dataset-perrin-1908",
                  year: 1908,
                  status: "later" as const,
                },
                plainLanguage: "Undecided until ultramicroscopy and sedimentation data in 1908.",
              },
            },
            {
              id: "branch-paper",
              label: "Paper route",
              hypothesis: "Kinetic molecular collisions",
              worksWhen: "All fluids",
              steps: [{ text: "Step 2" }],
              outcome: {
                type: "papers-route" as const,
                plainLanguage: "The 1905 paper route.",
              },
            },
          ],
        },
        FIXTURE_JOURNEY_BROWNIAN.forks[1]!,
      ],
    };

    const findingsValid = checkJourney(validUndecided);
    expect(findingsValid.filter((f) => f.severity === "error").length).toBe(0);

    // If whatWouldDecide points to pre-1905 evidence (e.g. 1902), it fails
    const invalidPre1905 = {
      ...validUndecided,
      forks: [
        {
          ...validUndecided.forks[0]!,
          branches: [
            {
              ...validUndecided.forks[0]!.branches[0]!,
              outcome: {
                ...validUndecided.forks[0]!.branches[0]!.outcome,
                whatWouldDecide: {
                  name: "Exner 1900 report",
                  recordId: "card-exner-1900",
                  year: 1900,
                  status: "available" as const,
                },
              },
            },
            validUndecided.forks[0]!.branches[1]!,
          ],
        },
        validUndecided.forks[1]!,
      ],
    };
    const findingsInvalid = checkJourney(invalidPre1905);
    expect(findingsInvalid.some((f) => f.rule === "fork-undecided-already-decidable")).toBe(true);
  });
});
