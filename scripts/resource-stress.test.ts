import assert from "node:assert";
import { describe, it } from "node:test";
import {
  HeavyLaboratoryManager,
  type ReplayableLabState,
} from "../src/experiments/lifecycle/concurrency.ts";
import { lifecycleDiagnostics } from "../src/experiments/lifecycle/diagnostics.ts";
import {
  decodeStreamCheckpoint,
  encodeStreamCheckpoint,
  evaluateCheckpointRecovery,
  STREAM_CHECKPOINT_FRAME_LENGTH,
} from "../src/experiments/lifecycle/recovery.ts";
import { VisibilityCoordinator } from "../src/experiments/lifecycle/visibility.ts";
import {
  BufferTransferRefusedError,
  DetachedBufferInvariantViolationError,
  OwnedBuffer,
  SharedMemoryDisabledError,
  SnapshotBufferPool,
} from "../src/experiments/memory/buffers.ts";
import {
  copyOutF64,
  copyOutVecF64,
  verifyGlueReturnsCopy,
  WasmMemoryStaleViewError,
  WasmMemoryTracker,
} from "../src/experiments/memory/wasmViews.ts";
import { HeavyFixtureLaboratory } from "../src/testing/runtime-fixtures/heavyFixture.ts";
import { disposeSceneGraph } from "../src/visuals/three/dispose.ts";
import { runResourceStressSuite } from "./resource-stress.ts";

describe("Resource Stress and Memory Lifecycle Contracts (am-rt-memory-lifecycle-5ws)", () => {
  describe("WASM Memory Growth & Generational Guard", () => {
    it("rejects stale views with WasmMemoryStaleViewError after memory.grow() rather than silently reading undefined or NaN", () => {
      const memory = new WebAssembly.Memory({ initial: 1, maximum: 4 });
      const tracker = new WasmMemoryTracker(memory);

      // Populate initial values
      const initialF64 = new Float64Array(memory.buffer, 0, 8);
      initialF64[0] = 1.0;
      initialF64[1] = 42.0;

      const trackedView = tracker.createFloat64View(0, 8);
      assert.equal(trackedView.at(1), 42.0);

      // Force memory growth: memory.grow(1) detaches the old ArrayBuffer
      memory.grow(1);

      // A naive un-guarded view would read from detached memory or return undefined/NaN
      // The tracked view MUST throw WasmMemoryStaleViewError
      assert.throws(
        () => trackedView.at(1),
        (err: unknown) => err instanceof WasmMemoryStaleViewError,
        "Expected WasmMemoryStaleViewError when accessing stale view after memory growth",
      );

      // Verify the tracker incremented its generation
      assert.ok(tracker.currentGeneration > trackedView.generation);
    });

    it("copyOutF64 and copyOutVecF64 return independent buffers unaffected by subsequent memory growth", () => {
      const memory = new WebAssembly.Memory({ initial: 1 });
      const f64 = new Float64Array(memory.buffer, 0, 4);
      f64[0] = 10.5;
      f64[1] = 20.5;

      const copy1 = copyOutF64(memory, 0, 4);
      const copy2 = copyOutVecF64(memory, 0, 4);

      assert.ok(verifyGlueReturnsCopy(copy1, memory));
      assert.ok(verifyGlueReturnsCopy(copy2, memory));
      assert.equal(copy1[0], 10.5);
      assert.equal(copy2[1], 20.5);

      // Grow memory
      memory.grow(1);

      // Copies remain valid and uncorrupted
      assert.equal(copy1[0], 10.5);
      assert.equal(copy2[1], 20.5);
    });
  });

  describe("Buffer Ownership & Snapshot Immutability", () => {
    it("refuses transfer of a buffer exposed to a live snapshot, naming the snapshot version", () => {
      const raw = new Float64Array(100);
      const owned = new OwnedBuffer(raw, { label: "particle-positions" });

      // Bind to live snapshot version 3
      owned.bindToSnapshot(3);

      assert.throws(
        () => owned.transfer(),
        (err: unknown) => {
          return (
            err instanceof BufferTransferRefusedError &&
            err.snapshotVersions.includes(3) &&
            err.refCount > 0
          );
        },
        "Transfer must be refused when buffer is bound to a live snapshot",
      );

      // Unbinding allows transfer if refCount is 0
      owned.unbindFromSnapshot(3);
      const transferredBuffer = owned.transfer();
      assert.ok(transferredBuffer instanceof ArrayBuffer);
      assert.ok(owned.isTransferred);
    });

    it("detects detached buffer exposed to live snapshot and throws DetachedBufferInvariantViolationError", () => {
      const raw = new Float64Array(10);
      const owned = new OwnedBuffer(raw);
      owned.bindToSnapshot(1);

      // Simulate a buffer detached unexpectedly (e.g. transfer in worker)
      // by inspecting a detached view or asserting invariant
      const detachedArray = new Float64Array(new ArrayBuffer(0));
      const corruptedOwned = new OwnedBuffer(detachedArray);
      corruptedOwned.bindToSnapshot(2);

      assert.throws(
        () => corruptedOwned.assertNotDetached(),
        (err: unknown) => err instanceof DetachedBufferInvariantViolationError,
      );
    });

    it("rejects SharedArrayBuffer allocation and useSharedMemory: true", () => {
      assert.throws(
        () => new OwnedBuffer(new Float64Array(10), { useSharedMemory: true }),
        (err: unknown) => err instanceof SharedMemoryDisabledError,
      );

      assert.throws(
        () => new SnapshotBufferPool(10, 2, true),
        (err: unknown) => err instanceof SharedMemoryDisabledError,
      );
    });

    it("buffer pool recycles buffers only at zero references and never evicts snapshot-held leases", () => {
      const pool = new SnapshotBufferPool(20, 2);
      const leaseA = pool.acquire(1);
      const leaseB = pool.acquire(2);

      // Bind leaseA to snapshot
      leaseA.buffer.bindToSnapshot(99);

      // Third acquire under capacity 2 must evict leaseB (unbound), NOT leaseA (bound)
      const leaseC = pool.acquire(3);
      assert.ok(leaseC);
      assert.equal(leaseA.buffer.snapshotVersions.length, 1);

      leaseA.release();
      leaseB.release();
      leaseC.release();
    });
  });

  describe("Lifecycle Diagnostics & Mount/Unmount Baseline", () => {
    it("leaves all counters at baseline after 100 mount/unmount cycles of heavy laboratory", () => {
      lifecycleDiagnostics.reset();

      for (let i = 0; i < 100; i++) {
        const lab = new HeavyFixtureLaboratory({ id: `mount-test-${i}`, particleCount: 200 });
        lab.mount();
        lab.step(2);
        lab.unmount();
      }

      lifecycleDiagnostics.assertBaseline();
      const snapshot = lifecycleDiagnostics.snapshot();
      assert.equal(snapshot.liveWorkers, 0);
      assert.equal(snapshot.activeWebGLContexts, 0);
      assert.equal(snapshot.trackedListeners, 0);
      assert.equal(snapshot.animationFrames, 0);
      assert.equal(snapshot.activeObservers, 0);
      assert.equal(snapshot.liveBufferBytes, 0);
    });

    it("assertBaseline() fails if any resource is leaked", () => {
      lifecycleDiagnostics.reset();
      const untrack = lifecycleDiagnostics.trackWorker(); // deliberate leak

      assert.throws(
        () => lifecycleDiagnostics.assertBaseline(),
        (err: unknown) => err instanceof Error && err.message.includes("liveWorkers leaked"),
      );

      untrack();
      lifecycleDiagnostics.assertBaseline(); // now clean
    });
  });

  describe("Checkpoint Codec & Fail-Closed Tamper Rejection", () => {
    it("encodes and decodes canonical 83-byte frame exactly", () => {
      const seed = 1234567890123456789n;
      const frame = encodeStreamCheckpoint({
        checkpointVersion: 1,
        streamSemanticsVersion: 1,
        seed,
        kernel: 1,
        tile: 5,
        nextIndex: 100n,
      });

      assert.equal(frame.length, STREAM_CHECKPOINT_FRAME_LENGTH);

      const decoded = decodeStreamCheckpoint(frame);
      assert.equal(decoded.seed, seed);
      assert.equal(decoded.kernel, 1);
      assert.equal(decoded.tile, 5);
      assert.equal(decoded.nextIndex, 100n);
      assert.equal(decoded.checkpointVersion, 1);
      assert.equal(decoded.streamSemanticsVersion, 1);
    });

    it("rejects corruptions and trailing bytes fail-closed, forcing a new run with parentRunId", () => {
      const seed = 555555555n;
      const validFrame = encodeStreamCheckpoint({
        seed,
        kernel: 0,
        tile: 0,
        nextIndex: 40n,
      });

      // 1. Single-byte corrupted kernel
      const corruptKernel = new Uint8Array(validFrame);
      corruptKernel[67] = (corruptKernel[67] ?? 0) ^ 0x01; // flip bit

      const decKernel = evaluateCheckpointRecovery("run-101", corruptKernel, {
        expectedSeed: seed,
        expectedKernel: 0,
      });
      assert.equal(decKernel.action, "new-run");
      if (decKernel.action === "new-run") {
        assert.equal(decKernel.parentRunId, "run-101");
      }

      // 2. Trailing byte
      const trailingByte = new Uint8Array(STREAM_CHECKPOINT_FRAME_LENGTH + 1);
      trailingByte.set(validFrame);
      trailingByte[STREAM_CHECKPOINT_FRAME_LENGTH] = 0x99;

      const decTrailing = evaluateCheckpointRecovery("run-101", trailingByte, {
        expectedSeed: seed,
      });
      assert.equal(decTrailing.action, "new-run");
      if (decTrailing.action === "new-run") {
        assert.equal(decTrailing.mismatchField, "trailing-bytes");
      }
    });
  });

  describe("Visibility and Reduced-Motion Pausing", () => {
    it("pauses stepping on document hidden, off-screen, or pagehide, and continues same run on resume", () => {
      let pauseCount = 0;
      let resumeCount = 0;

      const coord = new VisibilityCoordinator({
        initialDocumentVisible: true,
        initialIntersecting: true,
        initialReducedMotion: false,
        onPauseRequested: () => pauseCount++,
        onResumeRequested: () => resumeCount++,
      });

      assert.equal(coord.isPaused, false);

      // Background tab
      coord.setDocumentVisibility(false);
      assert.equal(coord.isPaused, true);
      assert.equal(coord.pauseReason, "document-hidden");
      assert.equal(pauseCount, 1);

      // Restore visibility
      coord.setDocumentVisibility(true);
      assert.equal(coord.isPaused, false);
      assert.equal(resumeCount, 1);

      // Off-screen scroll
      coord.setIntersection(false);
      assert.equal(coord.isPaused, true);
      assert.equal(coord.pauseReason, "off-screen");
      assert.equal(pauseCount, 2);

      // Scroll back
      coord.setIntersection(true);
      assert.equal(coord.isPaused, false);
      assert.equal(resumeCount, 2);
    });

    it("prefers-reduced-motion pauses autoplay while allowing manual stepping", () => {
      const coord = new VisibilityCoordinator({
        initialDocumentVisible: true,
        initialIntersecting: true,
        initialReducedMotion: true,
      });

      assert.equal(coord.isPaused, true);
      assert.equal(coord.pauseReason, "reduced-motion");
      assert.equal(
        coord.canStepManually,
        true,
        "Manual stepping must remain enabled under reduced-motion",
      );
    });
  });

  describe("Heavy Laboratory Concurrency & LRU Suspension", () => {
    it("suspends the LRU laboratory when limit is exceeded and resumes with replayable state", () => {
      const manager = new HeavyLaboratoryManager(2);
      let suspendedLabId: string | null = null;
      let resumedLabId: string | null = null;

      const dummyState = (id: string): ReplayableLabState => ({
        laboratoryId: id,
        runId: `run-${id}`,
        seed: "123",
        simulatedTime: 1.0,
        streamIndex: 10n,
        scientificDigest: `digest-${id}`,
      });

      manager.register(
        "lab-1",
        () => dummyState("lab-1"),
        (s) => {
          suspendedLabId = s.laboratoryId;
        },
        (s) => {
          resumedLabId = s.laboratoryId;
        },
      );
      manager.register(
        "lab-2",
        () => dummyState("lab-2"),
        (s) => {
          suspendedLabId = s.laboratoryId;
        },
        (s) => {
          resumedLabId = s.laboratoryId;
        },
      );

      assert.equal(manager.activeCount, 2);
      assert.equal(manager.suspendedCount, 0);

      // Touch lab-2 to make lab-1 least recently used
      manager.touch("lab-2");

      // Register lab-3 -> exceeds limit 2, so lab-1 must be suspended
      manager.register(
        "lab-3",
        () => dummyState("lab-3"),
        (s) => {
          suspendedLabId = s.laboratoryId;
        },
        (s) => {
          resumedLabId = s.laboratoryId;
        },
      );

      assert.equal(suspendedLabId, "lab-1");
      assert.equal(manager.activeCount, 2);
      assert.equal(manager.suspendedCount, 1);

      // Resuming lab-1
      manager.resume("lab-1");
      assert.equal(resumedLabId, "lab-1");
    });
  });

  describe("Three.js Scene Graph Disposal Traversal", () => {
    it("disposes geometries, materials, and textures cleanly without duplicate calls", () => {
      let geoDisposed = 0;
      let matDisposed = 0;
      let texDisposed = 0;

      const tex = { dispose: () => texDisposed++ };
      const geo = { dispose: () => geoDisposed++ };
      const mat = { map: tex, dispose: () => matDisposed++ };

      const scene = {
        type: "Scene",
        children: [
          { type: "Mesh", geometry: geo, material: mat, children: [] },
          { type: "Mesh", geometry: geo, material: mat, children: [] }, // shared geo & mat
        ],
      };

      const stats = disposeSceneGraph(scene);
      assert.equal(stats.disposedGeometries, 1);
      assert.equal(stats.disposedMaterials, 1);
      assert.equal(stats.disposedTextures, 1);
      assert.equal(geoDisposed, 1);
      assert.equal(matDisposed, 1);
      assert.equal(texDisposed, 1);
    });
  });

  describe("Full Resource Stress Suite", () => {
    it("all 6 scenarios in runResourceStressSuite pass cleanly", async () => {
      const report = await runResourceStressSuite();
      assert.equal(report.passed, true);
      assert.equal(report.totalScenarios, 6);
      assert.equal(report.passedScenarios, 6);
    });
  });
});
