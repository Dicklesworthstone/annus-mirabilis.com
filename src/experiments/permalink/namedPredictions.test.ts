import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { validateControlTape } from "../tapes/schema.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";
import { permalinkTapeFromControlTape } from "./fromControlTape.ts";
import { validateTapeV2 } from "./schema.ts";
import type { TapePredictionEvent } from "./types.ts";

const authoredRecord = validateControlTape(
  strictParse(
    readFileSync(
      new URL("../../../content/experiments/tapes/the-boost-to-0.6c.yaml", import.meta.url),
      "utf8",
    ),
    "yaml",
  ),
);

const tapeWithPrediction = (form: "verbal" | "values", payload: unknown) => ({
  ...FIXTURE_TEACHING_TAPE_EINSTEIN_08,
  predictions: [{ promptId: "density", form, payload }],
});

describe("named prediction payloads on shared links", () => {
  const cases: readonly TapePredictionEvent[] = [
    { promptId: "density", form: "verbal", payload: { directionId: "symmetric", shapeId: "bell" } },
    {
      promptId: "density",
      form: "values",
      payload: {
        targets: [
          { targetId: "centre", value: 0.4 },
          { targetId: "two-widths", value: 0.05 },
        ],
      },
    },
  ];
  for (const event of cases) {
    test(`${event.form}: retains authored ids through the real URL codec`, () => {
      const result = decodeTapePermalink(
        encodeTapePermalink({ ...FIXTURE_TEACHING_TAPE_EINSTEIN_08, predictions: [event] }),
      );
      assert.ok(result.kind === "success");
      expect(result.tape.predictions).toEqual([event]);
    });

    test(`${event.form}: a recorded prediction survives control-tape conversion and URL replay`, () => {
      // Use the authored record's controls and scientific checkpoint, replacing its one prediction
      // with a named-form recording. The converter must carry the event, never invent an index.
      assert.ok(authoredRecord.events.some((entry) => entry.kind === "prediction"));
      const record = validateControlTape({
        ...authoredRecord,
        events: authoredRecord.events.map((entry) =>
          entry.kind === "prediction"
            ? {
                ...entry,
                promptId: event.promptId,
                payload: { form: event.form, ...event.payload },
              }
            : entry,
        ),
      });
      const converted = permalinkTapeFromControlTape(record);
      assert.ok(converted.kind === "converted");
      expect(converted.tape.predictions).toEqual([event]);
      expect(converted.tape.events.length).toBeGreaterThan(0);

      const replay = decodeTapePermalink(encodeTapePermalink(converted.tape));
      assert.ok(replay.kind === "success");
      expect(replay.tape.predictions).toEqual([event]);
      expect(replay.tape.events).toEqual(converted.tape.events);
      expect(replay.tape.acceptedCheckpoint).toEqual(converted.tape.acceptedCheckpoint);
    });
  }

  test("indexed verbal and value links remain decodable without inventing named ids", () => {
    const predictions: readonly TapePredictionEvent[] = [
      { promptId: "legacy-shape", form: "verbal", payload: { choiceIndex: 1 } },
      { promptId: "legacy-values", form: "values", payload: { values: [[2, 0.4]] } },
    ];
    const decoded = decodeTapePermalink(
      encodeTapePermalink({ ...FIXTURE_TEACHING_TAPE_EINSTEIN_08, predictions }),
    );
    assert.ok(decoded.kind === "success");
    expect(decoded.tape.predictions).toEqual(predictions);
  });

  test("named choices refuse missing ids and ambiguous legacy mixtures", () => {
    for (const payload of [
      { directionId: "symmetric" },
      { shapeId: "bell" },
      { directionId: "", shapeId: "bell" },
      { directionId: "symmetric", shapeId: " " },
      { directionId: "x".repeat(65), shapeId: "bell" },
      { directionId: "symmetric", shapeId: "bell", choiceIndex: 0 },
    ]) {
      assert.throws(() => validateTapeV2(tapeWithPrediction("verbal", payload)), {
        code: "prediction-invalid-named-payload",
        path: "tape.predictions[0].payload",
      });
    }
  });

  test("targets refuse empty, duplicate, unbounded, and nonfinite answers", () => {
    for (const targets of [
      null,
      [],
      [null],
      [[]],
      [{ targetId: "centre", value: Number.NaN }],
      [{ targetId: "centre", value: Infinity }],
      [{ targetId: "centre", value: "0.4" }],
      [{ targetId: "", value: 1 }],
      [{ targetId: "x".repeat(65), value: 1 }],
      [
        { targetId: "centre", value: 1 },
        { targetId: "centre", value: 2 },
      ],
      Array.from({ length: 17 }, (_, i) => ({ targetId: `target-${i}`, value: i })),
    ]) {
      assert.throws(() => validateTapeV2(tapeWithPrediction("values", { targets })), {
        code: "prediction-invalid-named-payload",
        path: "tape.predictions[0].payload",
      });
    }
  });

  test("free text cannot hide inside target records or beside a named choice", () => {
    for (const payload of [
      { targets: [{ targetId: "centre", value: 0.4, note: "private" }] },
      { targets: [{ targetId: "centre", value: 0.4 }], answer: "private" },
      { targets: [{ targetId: "centre", value: 0.4 }], values: [[0, 0.4]] },
    ]) {
      assert.throws(() => validateTapeV2(tapeWithPrediction("values", payload)), {
        code: "prediction-invalid-named-payload",
        path: "tape.predictions[0].payload",
      });
    }
    assert.throws(
      () =>
        validateTapeV2(
          tapeWithPrediction("verbal", {
            directionId: "symmetric",
            shapeId: "bell",
            text: "private",
          }),
        ),
      { code: "prediction-free-text-forbidden", path: "tape.predictions[0].payload" },
    );
  });
});
