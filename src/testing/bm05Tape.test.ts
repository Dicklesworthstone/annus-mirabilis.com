import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { validateControlTape } from "../experiments/tapes/schema.ts";
import { WALK_KERNELS } from "../physics/reference/diffusion/walkLaws.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * am-bm-05-random-steps-ntzl: the "coin to bell" teaching tape registered in this bead's manifest
 * requirements. Proves schema conformance only (validateControlTape is the real validator this
 * bead's own test plan names) -- it does NOT prove the tape replays through BM-05's session,
 * because that integration (am-inst-permalink-tape-s677) is an open blocker this bead's own
 * dependency list carries. See the file's header comment for the full caveat.
 */
describe("BM-05 teaching tape: coin to bell (schema conformance only)", () => {
  function loadTape() {
    const raw = load(
      readFileSync(join(root, "content/experiments/tapes/coin-to-bell.yaml"), "utf8"),
    );
    return validateControlTape(raw);
  }

  test("validates against the real schema-version-2 control-tape validator", () => {
    const tape = loadTape();
    expect(tape.tapeId).toBe("coin-to-bell");
    expect(tape.experimentId).toBe("bm-05");
    expect(tape.isTeachingSequence).toBe(true);
    expect(tape.allocationId).toBe("bm-05.walk.v1");
  });

  test("steps through n = 4, 16, 64, 400 on the coin kernel before any kernel switch", () => {
    const tape = loadTape();
    const measurementEvents = tape.events.filter(
      (e) => e.kind === "control" && e.commandClass === "measurement-change",
    );
    expect(measurementEvents.map((e) => (e.kind === "control" ? e.value : null))).toEqual([
      4, 16, 64, 400,
    ]);
    for (const e of measurementEvents) {
      if (e.kind === "control") expect(e.parameterId).toBe("n");
    }
  });

  test("the kernel switch events use WALK_KERNELS' own numeric ids, in the bead's stated order (coin, uniform, gaussian)", () => {
    const tape = loadTape();
    const kernelEvents = tape.events.filter(
      (e) => e.kind === "control" && e.parameterId === "kernel",
    );
    expect(kernelEvents).toHaveLength(2);
    const values = kernelEvents.map((e) => (e.kind === "control" ? e.value : null));
    expect(values).toEqual([WALK_KERNELS.uniform.stepKernel, WALK_KERNELS.gaussian.stepKernel]);
    // The starting kernel (coin) is carried in initialConditions, also using the same encoding.
    expect(tape.initialConditions.kernel).toBe(WALK_KERNELS.coin.stepKernel);
    for (const e of kernelEvents) {
      if (e.kind === "control") expect(e.commandClass).toBe("setup-change");
    }
  });

  test("the seed is held fixed across the kernel switch (common random numbers, not three independent trials)", () => {
    const tape = loadTape();
    expect(tape.seed).toBe("1905");
    for (const c of tape.checkpoints) expect(c.seed).toBe("1905");
  });

  test("action indices strictly increase and the coin-kernel 400-step checkpoint precedes both kernel switches", () => {
    const tape = loadTape();
    const indices = tape.events.map((e) => e.actionIndex);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(indices.length);
    const coinCheckpoint = tape.checkpoints.find((c) => c.actionIndex === 4);
    const kernelSwitchIndices = tape.events
      .filter((e) => e.kind === "control" && e.parameterId === "kernel")
      .map((e) => e.actionIndex);
    expect(coinCheckpoint).toBeDefined();
    for (const idx of kernelSwitchIndices) expect(idx).toBeGreaterThan(4);
  });

  test("a malformed copy (a non-numeric control value) is rejected by the real validator", () => {
    const tape = loadTape();
    const broken = {
      tapeVersion: tape.tapeVersion,
      tapeId: tape.tapeId,
      experimentId: tape.experimentId,
      mode: tape.mode,
      modelIdentity: tape.modelIdentity,
      constantSetId: tape.constantSetId,
      seed: tape.seed,
      streamVersion: tape.streamVersion,
      allocationId: tape.allocationId,
      initialConditions: tape.initialConditions,
      events: [
        {
          kind: "control",
          actionIndex: 1,
          commandClass: "setup-change",
          commandId: "select-kernel",
          parameterId: "kernel",
          value: "uniform",
        },
      ],
      checkpoints: [],
    };
    expect(() => validateControlTape(broken)).toThrow();
  });
});
