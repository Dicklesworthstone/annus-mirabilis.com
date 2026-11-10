import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { validateJourney } from "../src/content/schemas/journey.ts";
import { strictParse } from "../src/content/schemas/strictParse.ts";
import { REAL_JOURNEYS } from "../src/discovery/journeys/realJourneys.ts";
import { JourneySerializationError, serializeJourneyRecord } from "./emit-journey-records.ts";

const brownian = REAL_JOURNEYS.find((journey) => journey.paper === "brownian-motion");
assert(brownian);

describe("journey emission preserves authored text across the real compiler boundary", () => {
  test("multiline prose retains literal escapes, token-like text and replacement characters", () => {
    const firstStage = brownian.stages[0];
    assert(firstStage);
    const explanation =
      'Keep "__journey_multiline__0__" and a literal \\n.\n\n' +
      'Quotes: "two". Replacement text: $& and $$; a tab\there; a final newline.\n';
    const journey = {
      ...brownian,
      stages: [
        { ...firstStage, support: { ...firstStage.support, explanation } },
        ...brownian.stages.slice(1),
      ],
    };

    const emitted = serializeJourneyRecord(journey);
    const decoded = strictParse(emitted, "yaml") as { stages: unknown };
    const parsed = validateJourney(decoded);
    expect(parsed.stages[0]?.support.explanation).toBe(explanation);
    expect(decoded.stages).toEqual(journey.stages);
    expect(emitted).toContain("\\u000a\\u000a");
    expect(emitted).toContain("\\u0009");
    expect(emitted).not.toContain("explanation: |-");
  });

  test("journey-serialization-changed-data refuses a valid record whose single-line tab would change", () => {
    const journey = { ...brownian, naggingFact: "A particle moves\tthrough the liquid." };
    // This is valid authored content. The failure must come from the actual emitted round trip,
    // not from a malformed journey fixture or an injected result of the equality comparison.
    expect(validateJourney(journey).naggingFact).toBe(journey.naggingFact);
    let refusal: unknown;
    try {
      serializeJourneyRecord(journey);
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(JourneySerializationError);
    assert(refusal instanceof JourneySerializationError);
    expect(refusal.code).toBe("journey-serialization-changed-data");
    expect(refusal.message).toBe("Journey serialization changed authored data: brownian-motion");

    const supported = { ...journey, naggingFact: journey.naggingFact.replace("\t", " ") };
    const parsed = validateJourney(strictParse(serializeJourneyRecord(supported), "yaml"));
    expect(parsed.naggingFact).toBe(supported.naggingFact);
  });
});
