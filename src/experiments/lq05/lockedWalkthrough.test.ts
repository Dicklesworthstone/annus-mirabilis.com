import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { permalinkTapeFromControlTape } from "../permalink/fromControlTape.ts";
import { replayTeachingTapeOn } from "../permalink/replayTeachingTape.ts";
import { replayTapeOnSession } from "../permalink/sessionTape.ts";
import type { TapeV2 } from "../permalink/types.ts";
import { checkpointPrefixes } from "../permalink/walkthroughCheckpoints.ts";
import { validateControlTape } from "../tapes/schema.ts";
import { LQ05_PRESETS } from "./definition.ts";
import { createLq05Session } from "./session.ts";
import { LQ05_TAPE } from "./tape.ts";

const record = validateControlTape(
  parseYaml(
    readFileSync(
      new URL("../../../content/experiments/tapes/the-locked-positions.yaml", import.meta.url),
      "utf8",
    ),
  ),
);

function wire(input = record): TapeV2 {
  const result = permalinkTapeFromControlTape(input);
  if (result.kind !== "converted") throw new Error(result.reason);
  // Each selected stop already contains its exact prefix, as loadWalkthroughCatalogue publishes it.
  const { teachingTapeRef: _ref, ...standalone } = result.tape;
  return standalone;
}

function value(session: ReturnType<typeof createLq05Session>, quantityId: string) {
  const result = session.getSnapshot().accepted?.outputs.find(
    (output) => output.quantityId === quantityId,
  );
  if (result?.status !== "value" || typeof result.value !== "number")
    throw new Error(`No accepted scalar ${quantityId}.`);
  return result.value;
}

describe("the locked-positions walkthrough reaches the model it describes", () => {
  test("each authored checkpoint restores the selected probability owner, including seeking backwards", () => {
    const stops = checkpointPrefixes(record);
    const independent = stops.find(
      (stop) => stop.settings.n === 10 && stop.settings.locked === "false",
    );
    const locked = stops.find(
      (stop) => stop.settings.n === 10 && stop.settings.locked === "true",
    );
    const opening = stops.find((stop) => stop.actionIndex === 0);
    expect(independent).toBeDefined();
    expect(locked).toBeDefined();
    expect(opening).toBeDefined();
    const session = createLq05Session("locked-walkthrough-stops");
    for (const stop of [opening!, independent!, locked!, independent!, opening!]) {
      expect(replayTapeOnSession(LQ05_TAPE, session, wire(stop.record)).kind).toBe("success");
      const parameters = session.acceptedParameters();
      expect(parameters.n).toBe(stop.settings.n);
      expect(parameters.f).toBe(0.5);
      expect(parameters.locked).toBe(stop.settings.locked === "true");
      expect(parameters.seed).toBe("12345");
      const expected = parameters.locked ? 0.5 : 0.5 ** parameters.n;
      expect(value(session, "configurationProbability")).toBe(expected);
      expect(value(session, "expectedTrialsToOne")).toBe(1 / expected);
      expect(
        session.getSnapshot().accepted?.outputs.find(
          (output) => output.quantityId === "configurationProbability",
        )?.ownerId,
      ).toBe(
        parameters.locked
          ? "radiation.lockedPositionsProbability"
          : "radiation.independentPointsProbability",
      );
      for (const expectation of stop.record.checkpoints[0]!.expectedDisplayValues ?? [])
        expect(value(session, expectation.outputId!)).toBe(expectation.value);
    }
  });

  test("playing the named walkthrough ends at ten locked points with the prediction preserved", () => {
    const tape = wire();
    const session = createLq05Session("locked-walkthrough-play");
    const result = replayTeachingTapeOn(LQ05_TAPE, session, record.tapeId, {
      resolve: (id) => (id === record.tapeId ? tape : null),
    });
    expect(result.kind).toBe("replayed");
    if (result.kind !== "replayed") throw new Error(result.notice);
    expect(result.isNewRun).toBe(false);
    expect(session.acceptedParameters()).toEqual(LQ05_PRESETS["lq-05-locked-positions"]!.parameters);
    expect(value(session, "configurationProbability")).toBe(0.5);
    expect(
      tape.predictions?.some((prediction) => prediction.promptId === "lq-05-predict-ten-points"),
    ).toBe(true);
    const stops = checkpointPrefixes(record);
    const independent = stops.find(
      (stop) => stop.settings.n === 10 && stop.settings.locked === "false",
    )!;
    const comparison = createLq05Session("locked-walkthrough-independent");
    expect(replayTapeOnSession(LQ05_TAPE, comparison, wire(independent.record)).kind).toBe("success");
    expect(value(comparison, "configurationProbability")).toBe(1 / 1024);
    expect(session.acceptedParameters().n).toBe(comparison.acceptedParameters().n);
    expect(session.acceptedParameters().f).toBe(comparison.acceptedParameters().f);
  });

  test("a relabeled sixty-point endpoint cannot replace the current accepted run", () => {
    const tape = wire();
    const session = createLq05Session("locked-walkthrough-refusal");
    const accepted = session.getSnapshot().accepted;
    const { teachingTapeRef: _ref, ...standalone } = tape;
    const corrupt = {
      ...standalone,
      events: tape.events.map((event) =>
        event.paramId === "n" ? { ...event, value: 60 } : event,
      ),
    };
    expect(replayTapeOnSession(LQ05_TAPE, session, corrupt).kind).not.toBe("success");
    expect(session.getSnapshot().accepted).toBe(accepted);
  });
});
