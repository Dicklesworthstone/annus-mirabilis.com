import { describe, expect, test } from "bun:test";
import { FIXTURE_JOURNEY_BROWNIAN } from "../testing/fixtureJourney.ts";
import { type CardLookupContext, checkJourney } from "./journeyChecks.ts";

const MOCK_CARD_CONTEXT: CardLookupContext = {
  "card-osmotic-pressure": {
    id: "card-osmotic-pressure",
    date: { latestYear: 1887 },
    status: "available",
  },
  "card-stokes-law": {
    id: "card-stokes-law",
    date: { latestYear: 1851 },
    status: "available",
  },
  "card-smoluchowski-1906": {
    id: "card-smoluchowski-1906",
    date: { latestYear: 1906 },
    status: "later",
  },
  "card-sutherland-1905": {
    id: "card-sutherland-1905",
    date: { latestYear: 1905 },
    status: "parallel-work",
  },
};

const baseStage = FIXTURE_JOURNEY_BROWNIAN.stages[0];
if (!baseStage) throw new Error("Missing baseStage fixture");

describe("journeyEpistemic: integration checks", () => {
  test("a stage citing a post-1904 card without parallelWorkAcknowledged is rejected", () => {
    const unacknowledged = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      stages: [
        {
          ...baseStage,
          premiseRefs: [{ cardId: "card-smoluchowski-1906" }],
        },
      ],
    };
    const findings = checkJourney(unacknowledged, { cards: MOCK_CARD_CONTEXT });
    expect(findings.some((f) => f.rule === "shelf-date-violation")).toBe(true);
  });

  test("a later card remains refused as a chain premise even with parallelWorkAcknowledged", () => {
    const acknowledgedLater = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      stages: [
        {
          ...baseStage,
          premiseRefs: [{ cardId: "card-smoluchowski-1906", parallelWorkAcknowledged: true }],
        },
      ],
    };
    const findings = checkJourney(acknowledgedLater, { cards: MOCK_CARD_CONTEXT });
    expect(findings.some((f) => f.rule === "shelf-date-violation")).toBe(true);
  });

  test("a parallel-work card cited with parallelWorkAcknowledged: true passes", () => {
    const acknowledged = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      stages: [
        {
          ...baseStage,
          premiseRefs: [{ cardId: "card-sutherland-1905", parallelWorkAcknowledged: true }],
        },
      ],
    };
    const findings = checkJourney(acknowledged, { cards: MOCK_CARD_CONTEXT });
    expect(findings.filter((f) => f.severity === "error").length).toBe(0);
  });

  test("an admitted import cited at a stage passes only if declared in admittedImports", () => {
    const withImport = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      admittedImports: [
        {
          importId: "import-sr-energy-transformation",
          provenance: "Zur Elektrodynamik bewegter Körper §8",
          sourceAnchor: "sr-s8-p3",
        },
      ],
      stages: [
        {
          ...baseStage,
          premiseRefs: [
            { cardId: "card-osmotic-pressure" },
            { cardId: "", importId: "import-sr-energy-transformation" },
          ],
        },
      ],
    };
    const findingsPass = checkJourney(withImport, { cards: MOCK_CARD_CONTEXT });
    expect(findingsPass.filter((f) => f.severity === "error").length).toBe(0);

    const withUndeclaredImport = {
      ...withImport,
      admittedImports: [], // not declared
    };
    const findingsFail = checkJourney(withUndeclaredImport, { cards: MOCK_CARD_CONTEXT });
    expect(findingsFail.some((f) => f.rule === "stage-unadmitted-import")).toBe(true);
  });
});
