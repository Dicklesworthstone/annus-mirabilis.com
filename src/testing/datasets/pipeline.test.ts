import { describe, expect, test } from "bun:test";
import { executeDigitizationPipeline } from "../../content/datasets/pipeline/digitize.ts";

describe("digitization pipeline harness (am-inst-dataset-overlay-ra9r)", () => {
  const input = {
    id: "perrin-1909-table-1-sample",
    title: "Perrin 1909 Granule Displacements Sample",
    publications: [
      {
        id: "pub-1",
        citation: "Perrin (1909) Ann. Chim. Phys. 18: 5-114",
        locator: { kind: "table" as const, number: 1 },
        publicationDate: {
          type: "issue-publication" as const,
          text: "1909",
          earliest: "1909-01-01",
          latest: "1909-12-31",
          precision: "year" as const,
          source: "Ann. Chim. Phys.",
          verifiedAt: "2026-09-16",
        },
      },
    ],
    primaryPublicationId: "pub-1",
    digitizer: {
      name: "Editorial Team",
      method: "Double manual keying",
      date: "2026-09-16",
      sourcePageImage: "perrin-table-1.png",
      digitizationRevision: 1,
    },
    columns: [
      {
        name: "Granule Radius",
        quantityId: "length",
        unit: "um",
        role: "controlled" as const,
      },
      {
        name: "Displacement",
        quantityId: "rmsDisplacement1d",
        unit: "um",
        role: "observed" as const,
      },
    ],
    rawRows: [
      [
        { kind: "number" as const, value: 0.53, originalToken: "0,53" },
        { kind: "number" as const, value: 7.1, originalToken: "7,1" },
      ],
      [
        { kind: "number" as const, value: 0.37, originalToken: "0,37" },
        { kind: "number" as const, value: 8.5, originalToken: "8,5" },
      ],
      [
        { kind: "number" as const, value: 0.21, originalToken: "0,21" },
        { kind: "number" as const, value: 11.2, originalToken: "11,2" },
      ],
    ],
    uncertainty: {
      type: "standard-deviation",
      description: "Sample standard deviation across 100 observations",
    },
    notes: "Historical test run from verified public-domain source",
    rights: {
      status: "public-domain-image" as const,
      statement: "Public domain verified scan from BNF Gallica",
      source: "https://gallica.bnf.fr",
      recordedAt: "2026-09-16",
      reuseTerms: "named-license" as const,
    },
    allowedInferenceModelIds: ["evaluateStokesEinstein"],
    secondPass: {
      passId: "pass-2",
      checkerName: "Second Reviewer",
      verifiedCellCount: 6,
      discrepancies: [],
    },
  };

  test("runs digitization pipeline, validates spot check, and computes SHA-256 digest", () => {
    const result = executeDigitizationPipeline(input);

    expect(result.passedSpotCheck).toBe(true);
    expect(result.csvDigest).toBeDefined();
    expect(result.csvDigest.length).toBe(64); // SHA-256 hex string length
    expect(result.dataset.rows.length).toBe(3);
    expect(result.loggedEvent.outcome).toBe("passed");
  });

  test("spot check failure with discrepancies throws Error", () => {
    const invalidInput = {
      ...input,
      secondPass: {
        passId: "pass-2",
        checkerName: "Second Reviewer",
        verifiedCellCount: 6,
        discrepancies: ["Row 1 col 2: value 7.1 differed from reading 7.2"],
      },
    };

    expect(() => executeDigitizationPipeline(invalidInput)).toThrow(
      /Digitization spot check failed with discrepancies/,
    );
  });
});
