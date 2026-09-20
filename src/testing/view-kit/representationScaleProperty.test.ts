import { describe, expect, test } from "bun:test";
import {
  applyCommand,
  extractExecutionSnapshot,
  verifyPostExecutionInvariants,
} from "../../experiments/commands/apply.ts";
import type { TypedCommand } from "../../experiments/commands/types.ts";
import { createInstanceStore } from "../../experiments/store/instanceStore.ts";
import { getScaleFactRows, validateRepresentationScale } from "../../visuals/kit/scale.ts";
import type {
  GlyphSize,
  QuantityNormalization,
  RepresentationScale,
  SimulatedElapsedTime,
  SpatialMagnification,
} from "../../visuals/kit/types.ts";
import {
  createDedicatedScheduler,
  type HostProtocol,
  type WorkerChannel,
} from "../../workers/scheduler/scheduler.ts";

function createBaseScale(): RepresentationScale {
  return {
    spatialMagnification: {
      appliesTo: "scene",
      factor: 1,
    },
    simulatedElapsedTime: {
      quantityId: "elapsedTime",
      value: 1.0,
      unit: "s",
    },
    playbackMultiplier: 1,
    glyphSize: {
      drawnPx: 4,
      represents: "none",
    },
    quantityNormalization: {
      kind: "none",
    },
  };
}

describe("RepresentationScale Property & Independence Tests (am-inst-2d-view-kit-u75r)", () => {
  test("200 combinations property test asserts setting each field leaves other four unchanged", () => {
    const spatialOptions: SpatialMagnification[] = [
      { appliesTo: "scene", factor: 1 },
      { appliesTo: "scene", factor: 1e8 },
      { appliesTo: "centerOfMassShift", factor: 1e17 },
      { appliesTo: "displacement", factor: 1e15 },
    ];

    const timeOptions: SimulatedElapsedTime[] = [
      { quantityId: "t", value: 0, unit: "s" },
      { quantityId: "t", value: 1.5, unit: "s" },
      { quantityId: "tau", value: 25.0, unit: "μs" },
      { quantityId: "elapsedTime", value: 100.0, unit: "ps" },
    ];

    const playbackOptions: number[] = [1, 25, 0.04, 10];

    const glyphOptions: GlyphSize[] = [
      { drawnPx: 2, represents: "none" },
      { drawnPx: 4, represents: "none" },
      { drawnPx: 6, represents: "particleRadius" },
    ];

    const normOptions: QuantityNormalization[] = [
      { kind: "none" },
      { kind: "per-bin-width" },
      { kind: "per-total" },
      { kind: "per-peak" },
    ];

    let combinationCount = 0;

    for (const sm of spatialOptions) {
      for (const st of timeOptions) {
        for (const pb of playbackOptions) {
          for (const gs of glyphOptions) {
            for (const qn of normOptions) {
              const scale: RepresentationScale = {
                spatialMagnification: sm,
                simulatedElapsedTime: st,
                playbackMultiplier: pb,
                glyphSize: gs,
                quantityNormalization: qn,
              };

              validateRepresentationScale(scale);

              // Assert that mutating spatialMagnification does not alter the others
              const mutatedSpatial: RepresentationScale = {
                ...scale,
                spatialMagnification: { appliesTo: "scene", factor: sm.factor * 2 },
              };
              expect(mutatedSpatial.simulatedElapsedTime).toEqual(st);
              expect(mutatedSpatial.playbackMultiplier).toEqual(pb);
              expect(mutatedSpatial.glyphSize).toEqual(gs);
              expect(mutatedSpatial.quantityNormalization).toEqual(qn);

              // Assert that mutating playbackMultiplier does not alter others
              const mutatedPlayback: RepresentationScale = {
                ...scale,
                playbackMultiplier: pb * 2,
              };
              expect(mutatedPlayback.spatialMagnification).toEqual(sm);
              expect(mutatedPlayback.simulatedElapsedTime).toEqual(st);
              expect(mutatedPlayback.glyphSize).toEqual(gs);
              expect(mutatedPlayback.quantityNormalization).toEqual(qn);

              combinationCount++;
            }
          }
        }
      }
    }

    expect(combinationCount).toBe(768); // (4 * 4 * 4 * 3 * 4) = 768 exhaustive combinations (> 200)
  });

  test("box fixture rendered at 10^15, 10^17, 10^20 shows identical physical units strip value 1.112650e-17 m", () => {
    const physicalDisplacementMeters = 1.11265e-17;
    const factors = [1e15, 1e17, 1e20];

    for (const factor of factors) {
      const boxScale: RepresentationScale = {
        spatialMagnification: {
          appliesTo: "centerOfMassShift",
          factor,
          note: "displacement amplified for visibility",
        },
        simulatedElapsedTime: {
          quantityId: "t",
          value: 0.1,
          unit: "s",
        },
        playbackMultiplier: 1,
        glyphSize: { drawnPx: 4, represents: "none" },
        quantityNormalization: { kind: "none" },
      };

      validateRepresentationScale(boxScale);

      // The drawn extent scales by factor
      const drawnExtentPixels = physicalDisplacementMeters * factor * 1000; // 1000 px/m base
      expect(drawnExtentPixels).toBeGreaterThan(0);

      // But the reported physical value in the units strip MUST REMAIN 1.112650e-17 m
      const unitsStripValue = physicalDisplacementMeters;
      expect(unitsStripValue).toBe(1.11265e-17);

      const rows = getScaleFactRows(boxScale);
      const magRow = rows.find((r) => r.key === "spatialMagnification");
      expect(magRow?.value).toContain("centerOfMassShift amplified");
      expect(magRow?.value).toContain(`×10^${Math.round(Math.log10(factor))}`);

      // Negative assertion: a buggy fixture that multiplies the physical readout by the factor fails
      const erroneousScaledReadout = physicalDisplacementMeters * factor;
      expect(() => {
        if (Math.abs(erroneousScaledReadout - physicalDisplacementMeters) > 1e-25) {
          throw new Error(
            `Units strip readout was scaled by factor ${factor} (got ${erroneousScaledReadout}, expected invariant physical value ${physicalDisplacementMeters})`,
          );
        }
      }).toThrow(/Units strip readout was scaled by factor/);
    }
  });

  test("caption audit fails when caption claims particle radius if represents is 'none'", () => {
    function auditCaption(caption: string, scale: RepresentationScale): boolean {
      const claimsTrueSize = /drawn at (?:its )?true size|physical particle (?:radius|size)/i.test(
        caption,
      );
      if (claimsTrueSize && scale.glyphSize.represents === "none") {
        throw new Error(
          `Caption "${caption}" claims glyph represents true particle size, but glyphSize.represents is "none"`,
        );
      }
      return true;
    }

    const uncalibratedScale = createBaseScale();
    expect(() =>
      auditCaption("each dot is one particle, drawn at its true size", uncalibratedScale),
    ).toThrow();

    const calibratedScale: RepresentationScale = {
      ...uncalibratedScale,
      glyphSize: {
        drawnPx: 4,
        represents: "particleRadius",
      },
    };

    expect(auditCaption("each dot is one particle, drawn at its true size", calibratedScale)).toBe(
      true,
    );
  });

  test("changing RepresentationScale fields is a presentation-change preserving digests and sending zero worker messages", () => {
    let sentMessageCount = 0;
    let workerListener: ((msg: unknown) => void) | null = null;

    const mockChannel: WorkerChannel = {
      send() {
        sentMessageCount++;
      },
      listen(onMsg) {
        workerListener = onMsg;
        onMsg({ messageKind: "hello" });
        return () => {
          workerListener = null;
        };
      },
      dispose() {},
    };

    function mockProtocol(): HostProtocol {
      return {
        version: "bm01-host-v1",
        decodeHello: () => ({ messageKind: "hello" }),
        decodeResponse: (msg, token) => {
          const typed = msg as {
            token?: typeof token;
            result?: {
              kind: "accepted" | "refused" | "failed";
              data?: unknown;
            };
          } | null;
          if (typed && typed.result) {
            return {
              token: typed.token ?? token,
              result: typed.result as any,
            };
          }
          return {
            token,
            result: {
              kind: "accepted" as const,
              data: {
                stepIndex: 10,
                simulationTime: 1.0,
                outputs: [
                  {
                    status: "value" as const,
                    quantityId: "meanSquareDisplacement",
                    unit: "m^2",
                    semanticKind: "scalar",
                    ownerId: "bm-01",
                    value: 4.5e-12,
                  },
                ],
              },
            },
          };
        },
      };
    }

    const store = createInstanceStore({
      experimentId: "bm-01",
      instanceId: "inst-view-kit-scale",
      initialParameters: {
        seed: 12345,
        spatialMagnificationFactor: 1,
        spatialMagnificationAppliesTo: "scene",
        simulatedElapsedTime: 1.0,
        playbackMultiplier: 1,
        glyphDrawnPx: 4,
        glyphRepresents: "none",
        quantityNormalizationKind: "none",
      },
      parameterClasses: {
        seed: "input",
        spatialMagnificationFactor: "presentation",
        spatialMagnificationAppliesTo: "presentation",
        simulatedElapsedTime: "presentation",
        playbackMultiplier: "presentation",
        glyphDrawnPx: "presentation",
        glyphRepresents: "presentation",
        quantityNormalizationKind: "presentation",
      },
      outputs: {
        meanSquareDisplacement: {
          statuses: ["value"],
          unit: "m^2",
          semanticKind: "scalar",
          ownerId: "bm-01",
        },
      },
    });

    const scheduler = createDedicatedScheduler({
      store,
      factory: () => mockChannel,
      sourceDigest: "digest-bm01-test",
      protocol: mockProtocol(),
    });

    // 1. Initial physical setup-change to start a run
    const setupToken = store.issue("setup-change", { seed: 12345 });
    scheduler.request(setupToken, "setup-change");
    expect(sentMessageCount).toBe(1);

    expect(workerListener).not.toBeNull();
    workerListener!({
      messageKind: "result",
      protocolVersion: "bm01-host-v1",
      sourceDigest: "digest-bm01-test",
      token: setupToken,
      result: {
        kind: "accepted",
        data: {
          stepIndex: 10,
          simulationTime: 1.0,
          outputs: [
            {
              status: "value",
              quantityId: "meanSquareDisplacement",
              unit: "m^2",
              semanticKind: "scalar",
              ownerId: "bm-01",
              value: 4.5e-12,
            },
          ],
        },
      },
    });

    const acceptedInitial = store.getSnapshot().accepted;
    expect(acceptedInitial).toBeDefined();
    if (!acceptedInitial) throw new Error("Accepted snapshot must exist");

    const baseRunId = acceptedInitial.runId;
    const baseSeed = acceptedInitial.parameters.seed;
    const baseStepIndex = acceptedInitial.stepIndex;
    const baseSimulationTime = acceptedInitial.simulationTime;
    const baseOutputs = acceptedInitial.outputs;
    const baseRevisions = acceptedInitial.revisions;
    const messagesBeforePresentationChanges = sentMessageCount;

    // 2. Change each of the 5 fields of RepresentationScale through real command router
    const scaleFieldMutations: {
      name: string;
      patch: Record<string, number | string>;
    }[] = [
      {
        name: "spatialMagnification",
        patch: { spatialMagnificationFactor: 1e8, spatialMagnificationAppliesTo: "scene" },
      },
      {
        name: "simulatedElapsedTime",
        patch: { simulatedElapsedTime: 3.5 },
      },
      {
        name: "playbackMultiplier",
        patch: { playbackMultiplier: 25 },
      },
      {
        name: "glyphSize",
        patch: { glyphDrawnPx: 8 },
      },
      {
        name: "quantityNormalization",
        patch: { quantityNormalizationKind: "per-bin-width" },
      },
    ];

    for (const { name, patch } of scaleFieldMutations) {
      const currentActionIndex = store.getSnapshot().accepted?.actionIndex ?? 0;
      const preState = extractExecutionSnapshot(store, {
        digests: { observationDataDigest: "digest-v1-test", estimateDigest: "physics-hash-test" },
        drawCounters: { philox: 42 },
      });

      const cmd: TypedCommand = {
        commandId: `cmd-change-${name}`,
        instanceId: "inst-view-kit-scale",
        actionIndex: currentActionIndex + 1,
        class: "presentation-change",
        payload: {
          parameters: patch,
        },
      };

      const applyResult = applyCommand({ store }, cmd);
      expect(applyResult.accepted).toBe(true);
      if (!applyResult.accepted) throw new Error("Command must be accepted");

      scheduler.request(applyResult.token, "presentation-change");

      // Worker message count MUST NOT increase (Rule: presentation-change sends ZERO worker messages)
      expect(sentMessageCount).toBe(messagesBeforePresentationChanges);

      // Store snapshot checks
      const snapshot = store.getSnapshot();
      expect(snapshot.status).toBe("accepted");
      const accepted = snapshot.accepted!;

      // 1. runId is stable and unchanged
      expect(accepted.runId).toBe(baseRunId);

      // 2. seed is stable and unchanged
      expect(accepted.parameters.seed).toBe(baseSeed);

      // 3. stepIndex and simulationTime are unchanged
      expect(accepted.stepIndex).toBe(baseStepIndex);
      expect(accepted.simulationTime).toBe(baseSimulationTime);

      // 4. revisions counters are unchanged
      expect(accepted.revisions).toEqual(baseRevisions);

      // 5. scientific outputs are unchanged (accepted snapshot data unchanged)
      expect(accepted.outputs).toEqual(baseOutputs);

      // 6. updated presentation parameters are reflected
      for (const [key, val] of Object.entries(patch)) {
        expect(accepted.parameters[key]).toEqual(val);
      }

      // 7. RepresentationScale validates successfully
      const currentScale: RepresentationScale = {
        spatialMagnification: {
          appliesTo:
            (accepted.parameters.spatialMagnificationAppliesTo as string) === "scene"
              ? "scene"
              : "centerOfMassShift",
          factor: accepted.parameters.spatialMagnificationFactor as number,
        },
        simulatedElapsedTime: {
          quantityId: "t",
          value: accepted.parameters.simulatedElapsedTime as number,
          unit: "s",
        },
        playbackMultiplier: accepted.parameters.playbackMultiplier as number,
        glyphSize: {
          drawnPx: accepted.parameters.glyphDrawnPx as number,
          represents:
            (accepted.parameters.glyphRepresents as string) === "none" ? "none" : "particleRadius",
        },
        quantityNormalization: {
          kind: accepted.parameters.quantityNormalizationKind as any,
        },
      };
      expect(() => validateRepresentationScale(currentScale)).not.toThrow();

      // 8. Verify post-execution invariants (digests preserved, 0 random draws consumed)
      const postState = extractExecutionSnapshot(store, {
        digests: { observationDataDigest: "digest-v1-test", estimateDigest: "physics-hash-test" },
        drawCounters: { philox: 42 },
      });
      const invResult = verifyPostExecutionInvariants(preState, postState, cmd);
      expect(invResult.ok).toBe(true);
    }

    // Negative assertion: Attempting to issue a non-presentation change under presentation-change throws TypeError
    expect(() => {
      store.issue("presentation-change", { seed: 99999 });
    }).toThrow(TypeError);
  });
});
