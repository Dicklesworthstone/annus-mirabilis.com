import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { tapeIdentityReport } from "../../content/teachingTapes.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { playWalkthrough } from "../permalink/playWalkthrough.ts";
import {
  createSessionReplayRunner,
  restoreTape,
  settingsFromTape,
  tapeStateOf,
} from "../permalink/sessionTape.ts";
import { resolveTeachingTape } from "../permalink/teachingTapeCatalogue.ts";
import { WALKTHROUGH_CATALOGUE } from "../permalink/walkthroughCatalogue.ts";
import type { ScientificResult } from "../results/types.ts";
import { validateControlTape } from "../tapes/schema.ts";
import { createMe01Session } from "./session.ts";
import { ME01_TAPE } from "./tape.ts";

const CURRENT_ID = "me-01-two-pulses-2026-11-13";
const HISTORICAL_ID = "the-two-pulses";
const historicalSource = readFileSync(
  new URL("../../../content/experiments/tapes/the-two-pulses.yaml", import.meta.url),
  "utf8",
);
const historical = validateControlTape(strictParse(historicalSource, "yaml"));
const record = validateControlTape(
  strictParse(
    readFileSync(
      new URL(
        "../../../content/experiments/tapes/me-01-two-pulses-2026-11-13.yaml",
        import.meta.url,
      ),
      "utf8",
    ),
    "yaml",
  ),
);

describe("the separately recorded ME-01 two-pulses walkthrough", () => {
  test("has its own declared identity, explicit opening state and the reviewed three controls", () => {
    expect(record.tapeId).toBe(CURRENT_ID);
    expect(record.modelIdentity).toEqual({
      modelId: ME01_TAPE.environment.modelId,
      modelVersion: String(ME01_TAPE.environment.modelVersion),
      artifactDigest: ME01_TAPE.environment.artifactDigest,
    });
    expect(record.modelIdentity.artifactDigest).not.toBe(historical.modelIdentity.artifactDigest);
    expect(record.initialConditions).toEqual(tapeStateOf(ME01_TAPE.defaults));
    expect(record.events).toEqual(historical.events);
    expect(record.events).toHaveLength(3);
    expect(record.checkpoints.map((checkpoint) => checkpoint.actionIndex)).toEqual([0, 1, 2, 3]);
    expect(tapeIdentityReport().undeclared).not.toContain(CURRENT_ID);
  });

  test("every digest and all nine displayed values reproduce through the real current owner", () => {
    const owner = createMe01Session("two-pulses-recorded-values");
    const runner = createSessionReplayRunner(ME01_TAPE, owner);
    runner.applyInitialConditions(record.initialConditions);
    let compared = 0;
    for (const checkpoint of record.checkpoints) {
      for (const event of record.events) {
        if (event.kind !== "control" || event.actionIndex !== checkpoint.actionIndex) continue;
        runner.applyEvent({
          actionIndex: event.actionIndex,
          commandClass: event.commandClass,
          paramId: event.parameterId,
          value: event.value,
        });
      }
      expect(runner.getAcceptedCheckpoint().acceptedActionIndex).toBe(checkpoint.actionIndex);
      expect(runner.getAcceptedCheckpoint().digest).toBe(checkpoint.digest);
      const evaluated = owner.evaluate(owner.acceptedParameters()) as unknown as Readonly<
        Record<string, ScientificResult>
      >;
      for (const expected of checkpoint.expectedDisplayValues ?? []) {
        const result = evaluated[expected.label];
        assert.ok(result && result.status === "value", expected.label);
        expect(result.value).toBe(expected.value);
        expect(result.unit).toBe(expected.unit);
        expect(expected.constantSetId).toBe(ME01_TAPE.environment.constantSetId);
        compared++;
      }
    }
    expect(compared).toBe(9);
  });

  test("the browser catalogue verifies full playback and all four stops in either direction", () => {
    const tape = resolveTeachingTape(CURRENT_ID);
    assert.ok(tape);
    expect(tape.teachingTapeRef?.tapeId).toBe(CURRENT_ID);
    const owner = createMe01Session("two-pulses-catalogue");
    const played = playWalkthrough(ME01_TAPE, owner, CURRENT_ID);
    assert.equal(played.kind, "played");
    expect(played.isNewRun).toBe(false);
    expect(played.steps).toBe(3);
    expect(owner.acceptedParameters().frameSpeed).toBe(0.1);
    expect(owner.acceptedParameters().emissionAngle).toBe(90);
    const walkthrough = WALKTHROUGH_CATALOGUE.walkthroughs.find(
      (entry) => entry.tapeId === CURRENT_ID,
    );
    assert.ok(walkthrough);
    expect(walkthrough.checkpoints).toHaveLength(4);
    for (const stop of [...walkthrough.checkpoints, ...[...walkthrough.checkpoints].reverse()]) {
      assert.ok(stop.tape);
      expect(restoreTape(ME01_TAPE, owner, stop.tape).kind).toBe("restored");
      expect(owner.acceptedParameters()).toEqual(
        settingsFromTape(stop.settings, ME01_TAPE.defaults),
      );
    }
    const final = walkthrough.checkpoints.at(-1)?.tape;
    assert.ok(final);
    const accepted = owner.getSnapshot();
    expect(
      restoreTape(ME01_TAPE, owner, {
        ...final,
        acceptedCheckpoint: { ...final.acceptedCheckpoint, digest: "host:0000000000000000" },
      }).kind,
    ).toBe("not-restored");
    expect(owner.getSnapshot()).toBe(accepted);
  });

  test("historical bytes and link resolution stay unchanged and refuse without mutating the owner", () => {
    expect(createHash("sha256").update(historicalSource).digest("hex")).toBe(
      "a1ab58c80c4d06d61ab886b538f8e7ac2116fee1483874a5415643e8ed4fec30",
    );
    const tape = resolveTeachingTape(HISTORICAL_ID);
    assert.ok(tape);
    expect(tape.teachingTapeRef?.tapeId).toBe(HISTORICAL_ID);
    expect(tape.modelIdentity.artifactDigest).toBe(historical.modelIdentity.artifactDigest);
    const decoded = decodeTapePermalink(encodeTapePermalink(tape));
    assert.equal(decoded.kind, "success");
    expect(decoded.tape.teachingTapeRef).toEqual(tape.teachingTapeRef);
    expect(decoded.tape.modelIdentity).toEqual(tape.modelIdentity);
    const owner = createMe01Session("two-pulses-historical-refusal");
    const before = owner.getSnapshot();
    const outcome = playWalkthrough(ME01_TAPE, owner, HISTORICAL_ID);
    assert.equal(outcome.kind, "refused");
    expect(outcome.code).toBe("tape-artifact-mismatch");
    expect(owner.getSnapshot()).toBe(before);
  });
});
