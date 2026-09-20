import { describe, expect, test } from "bun:test";
import {
  decodeStreamCheckpoint,
  encodeStreamCheckpoint,
  evaluateCheckpointRecovery,
  handleLaboratoryCrashOrContextLoss,
  STREAM_CHECKPOINT_DOMAIN,
  STREAM_CHECKPOINT_FRAME_LENGTH,
  STREAM_CHECKPOINT_MAGIC,
} from "../experiments/lifecycle/recovery.ts";

describe("StreamCheckpoint encoding, decoding, and fail-closed validation", () => {
  const validParams = {
    checkpointVersion: 1,
    streamSemanticsVersion: 1,
    seed: 137035999n,
    kernel: 0x19050001,
    tile: 42,
    nextIndex: 1000n,
  };

  test("encodes and decodes canonical 83-byte frame exactly", () => {
    const encoded = encodeStreamCheckpoint(validParams);
    expect(encoded.length).toBe(STREAM_CHECKPOINT_FRAME_LENGTH);
    expect(encoded.length).toBe(83);

    const decoded = decodeStreamCheckpoint(encoded);
    expect(decoded.magic).toBe(STREAM_CHECKPOINT_MAGIC);
    expect(decoded.domain).toBe(STREAM_CHECKPOINT_DOMAIN);
    expect(decoded.checkpointVersion).toBe(1);
    expect(decoded.streamSemanticsVersion).toBe(1);
    expect(decoded.seed).toBe(137035999n);
    expect(decoded.kernel).toBe(0x19050001);
    expect(decoded.tile).toBe(42);
    expect(decoded.nextIndex).toBe(1000n);
  });

  test("valid checkpoint evaluation returns continue decision", () => {
    const encoded = encodeStreamCheckpoint(validParams);
    const decision = evaluateCheckpointRecovery("run-100", encoded, {
      expectedSeed: 137035999n,
      expectedKernel: 0x19050001,
      expectedTile: 42,
      expectedNextIndex: 1000n,
    });

    expect(decision.action).toBe("continue");
    if (decision.action === "continue") {
      expect(decision.checkpoint.seed).toBe(137035999n);
      expect(decision.checkpoint.kernel).toBe(0x19050001);
    }
  });

  test("each single-field mutation forces a new run with the named reason", () => {
    const baseEnvelope = {
      checkpointBytes: encodeStreamCheckpoint(validParams),
      modelVersion: "bm-01.v1",
      protocolVersion: 1,
      tapeSchemaVersion: 2,
      parameterDigest: "digest-abc-123",
    };

    const expected = {
      modelVersion: "bm-01.v1",
      protocolVersion: 1,
      tapeSchemaVersion: 2,
      parameterDigest: "digest-abc-123",
      expectedSeed: 137035999n,
      expectedKernel: 0x19050001,
      expectedTile: 42,
      expectedNextIndex: 1000n,
    };

    // 1. Model version mutation
    const mutModel = evaluateCheckpointRecovery(
      "run-100",
      {
        ...baseEnvelope,
        modelVersion: "bm-01.v2",
      },
      expected,
    );
    expect(mutModel.action).toBe("new-run");
    if (mutModel.action === "new-run") {
      expect(mutModel.mismatchField).toBe("modelVersion");
      expect(mutModel.parentRunId).toBe("run-100");
    }

    // 2. Protocol version mutation
    const mutProto = evaluateCheckpointRecovery(
      "run-100",
      {
        ...baseEnvelope,
        protocolVersion: 2,
      },
      expected,
    );
    expect(mutProto.action).toBe("new-run");
    if (mutProto.action === "new-run") {
      expect(mutProto.mismatchField).toBe("protocolVersion");
    }

    // 3. Tape schema version mutation
    const mutTape = evaluateCheckpointRecovery(
      "run-100",
      {
        ...baseEnvelope,
        tapeSchemaVersion: 3,
      },
      expected,
    );
    expect(mutTape.action).toBe("new-run");
    if (mutTape.action === "new-run") {
      expect(mutTape.mismatchField).toBe("tapeSchemaVersion");
    }

    // 4. Parameter digest mutation
    const mutParam = evaluateCheckpointRecovery(
      "run-100",
      {
        ...baseEnvelope,
        parameterDigest: "digest-different-456",
      },
      expected,
    );
    expect(mutParam.action).toBe("new-run");
    if (mutParam.action === "new-run") {
      expect(mutParam.mismatchField).toBe("parameterDigest");
    }

    // 5. Seed mutation
    const bytesMutSeed = encodeStreamCheckpoint({ ...validParams, seed: 999999n });
    const mutSeed = evaluateCheckpointRecovery(
      "run-100",
      { ...baseEnvelope, checkpointBytes: bytesMutSeed },
      expected,
    );
    expect(mutSeed.action).toBe("new-run");
    if (mutSeed.action === "new-run") {
      expect(mutSeed.mismatchField).toBe("seed");
    }

    // 6. Stream kernel id mutation
    const bytesMutKernel = encodeStreamCheckpoint({ ...validParams, kernel: 0x19050002 });
    const mutKernel = evaluateCheckpointRecovery(
      "run-100",
      { ...baseEnvelope, checkpointBytes: bytesMutKernel },
      expected,
    );
    expect(mutKernel.action).toBe("new-run");
    if (mutKernel.action === "new-run") {
      expect(mutKernel.mismatchField).toBe("kernel");
    }

    // 7. Tile mutation
    const bytesMutTile = encodeStreamCheckpoint({ ...validParams, tile: 99 });
    const mutTile = evaluateCheckpointRecovery(
      "run-100",
      { ...baseEnvelope, checkpointBytes: bytesMutTile },
      expected,
    );
    expect(mutTile.action).toBe("new-run");
    if (mutTile.action === "new-run") {
      expect(mutTile.mismatchField).toBe("tile");
    }

    // 8. Next index mutation
    const bytesMutIndex = encodeStreamCheckpoint({ ...validParams, nextIndex: 2000n });
    const mutIndex = evaluateCheckpointRecovery(
      "run-100",
      { ...baseEnvelope, checkpointBytes: bytesMutIndex },
      expected,
    );
    expect(mutIndex.action).toBe("new-run");
    if (mutIndex.action === "new-run") {
      expect(mutIndex.mismatchField).toBe("index");
    }

    // 9. Checkpoint version mutation
    const bytesMutCpVer = encodeStreamCheckpoint({ ...validParams, checkpointVersion: 2 });
    const mutCpVer = evaluateCheckpointRecovery(
      "run-100",
      { ...baseEnvelope, checkpointBytes: bytesMutCpVer },
      expected,
    );
    expect(mutCpVer.action).toBe("new-run");
    if (mutCpVer.action === "new-run") {
      expect(mutCpVer.mismatchField).toBe("checkpointVersion");
    }

    // 10. Stream semantics version mutation
    const bytesMutSemVer = encodeStreamCheckpoint({ ...validParams, streamSemanticsVersion: 2 });
    const mutSemVer = evaluateCheckpointRecovery(
      "run-100",
      { ...baseEnvelope, checkpointBytes: bytesMutSemVer },
      expected,
    );
    expect(mutSemVer.action).toBe("new-run");
    if (mutSemVer.action === "new-run") {
      expect(mutSemVer.mismatchField).toBe("streamSemanticsVersion");
    }

    // 11. Magic mutation
    const bytesMutMagic = new Uint8Array(encodeStreamCheckpoint(validParams));
    bytesMutMagic[0] = 0x58; // 'X' instead of 'F'
    const mutMagic = evaluateCheckpointRecovery(
      "run-100",
      { ...baseEnvelope, checkpointBytes: bytesMutMagic },
      expected,
    );
    expect(mutMagic.action).toBe("new-run");
    if (mutMagic.action === "new-run") {
      expect(mutMagic.mismatchField).toBe("magic");
    }

    // 12. Domain mutation
    const bytesMutDomain = new Uint8Array(encodeStreamCheckpoint(validParams));
    bytesMutDomain[10] = 0x58; // corrupt domain
    const mutDomain = evaluateCheckpointRecovery(
      "run-100",
      { ...baseEnvelope, checkpointBytes: bytesMutDomain },
      expected,
    );
    expect(mutDomain.action).toBe("new-run");
    if (mutDomain.action === "new-run") {
      expect(mutDomain.mismatchField).toBe("domain");
    }

    // 13. Trailing byte mutation (extra byte appended)
    const trailingBytes = new Uint8Array(84);
    trailingBytes.set(encodeStreamCheckpoint(validParams));
    trailingBytes[83] = 0x00;
    const mutTrailing = evaluateCheckpointRecovery(
      "run-100",
      { ...baseEnvelope, checkpointBytes: trailingBytes },
      expected,
    );
    expect(mutTrailing.action).toBe("new-run");
    if (mutTrailing.action === "new-run") {
      expect(mutTrailing.mismatchField).toBe("trailing-bytes");
    }
  });

  test("forced worker crash and WebGL context loss pause laboratory with explanation", () => {
    const rawCheckpoint = encodeStreamCheckpoint(validParams);
    const expected = {
      expectedSeed: 137035999n,
      expectedKernel: 0x19050001,
      expectedTile: 42,
    };

    // 1. Worker crash with valid checkpoint
    const crashResult = handleLaboratoryCrashOrContextLoss({
      event: "worker-crash",
      currentRunId: "run-crash-test",
      checkpoint: rawCheckpoint,
      expected,
    });
    expect(crashResult.isPaused).toBe(true);
    expect(crashResult.explanation).toContain("Laboratory worker crashed: execution paused");
    expect(crashResult.decision.action).toBe("continue");

    // 2. WebGL context loss with mutated checkpoint
    const mutatedCheckpoint = encodeStreamCheckpoint({ ...validParams, seed: 999n });
    const contextLossResult = handleLaboratoryCrashOrContextLoss({
      event: "webgl-context-lost",
      currentRunId: "run-loss-test",
      checkpoint: mutatedCheckpoint,
      expected,
    });
    expect(contextLossResult.isPaused).toBe(true);
    expect(contextLossResult.explanation).toContain("WebGL context lost: rendering paused");
    expect(contextLossResult.decision.action).toBe("new-run");
    if (contextLossResult.decision.action === "new-run") {
      expect(contextLossResult.decision.mismatchField).toBe("seed");
      expect(contextLossResult.decision.parentRunId).toBe("run-loss-test");
      expect(contextLossResult.decision.newRunId).toContain("run-loss-test-recovered-new");
    }
  });
});
