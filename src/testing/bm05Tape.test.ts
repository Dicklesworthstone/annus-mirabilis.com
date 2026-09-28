import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { BM05_DEFAULTS } from "../experiments/bm05/definition.ts";
import { validateBm05Parameters } from "../experiments/bm05/parameters.ts";
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

  test("every kernel this tape names is one BM-05 accepts, in the order coin, uniform, gaussian", () => {
    // THIS TEST CHECKED THE NUMERIC ENCODING UNTIL 2026-09-28: the events had to equal
    // WALK_KERNELS.uniform.stepKernel and .gaussian.stepKernel, and initialConditions.kernel had
    // to equal WALK_KERNELS.coin.stepKernel. Those numbers were what the old schema forced, and
    // they were numbers BM-05 REFUSES: validateBm05Parameters rejects `kernel: 0` with "This step
    // distribution is not registered for this calculation", so the tape could not open its own
    // instrument and its page told a reader to set a control to a value it does not offer
    // (am-3xdx).
    //
    // The question worth asking is not whether the record matches a table, it is whether the
    // laboratory takes what the record says. So this hands each state to BM-05's own validator.
    const tape = loadTape();
    const kernelEvents = tape.events.filter(
      (e) => e.kind === "control" && e.parameterId === "kernel",
    );
    expect(kernelEvents).toHaveLength(2);
    const sequence = [
      tape.initialConditions.kernel,
      ...kernelEvents.map((e) => (e.kind === "control" ? e.value : null)),
    ];
    expect(sequence).toEqual(["coin", "uniform", "gaussian"]);
    // Each one, merged over the laboratory's defaults, is a state it accepts. This is the
    // assertion the old version could not make, because none of its three values passed.
    for (const kernel of sequence) {
      const checked = validateBm05Parameters({ ...BM05_DEFAULTS, kernel }) as { kind: string };
      expect(checked.kind, `BM-05 refuses kernel ${String(kernel)}`).toBe("accepted");
    }
    // And the names are still the registry's own, so the record and WALK_KERNELS cannot drift.
    for (const kernel of sequence) expect(Object.keys(WALK_KERNELS)).toContain(kernel);
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

  test("a control value is a number or the name of an enumerated setting, and nothing else", () => {
    // THIS TEST ASSERTED THE OPPOSITE UNTIL 2026-09-28, and its "malformed" value was
    // `value: "uniform"`, which is the name of one of BM-05's own three step distributions. The
    // schema required a finite number, which is what forced this tape to encode the kernel as 0,
    // 1 and 3 (am-3xdx): numbers its own instrument refuses, on a page that told a reader to set
    // a control to a value the control does not offer. The rule is wider now and this checks both
    // of its edges rather than the one it had.
    const tape = loadTape();
    const withValue = (value: unknown) => ({
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
          value,
        },
      ],
      checkpoints: [],
    });
    // Accepted: a number, and the name of an enumerated setting.
    expect(() => validateControlTape(withValue(3))).not.toThrow();
    expect(() => validateControlTape(withValue("uniform"))).not.toThrow();
    // Refused: everything that is neither. An empty string is not a name, and a boolean, an
    // object and a non-finite number are not settings at all.
    for (const bad of ["", "   ", true, {}, [], null, Number.NaN, Number.POSITIVE_INFINITY])
      expect(
        () => validateControlTape(withValue(bad)),
        `${JSON.stringify(bad)} was accepted`,
      ).toThrow();
  });
});
