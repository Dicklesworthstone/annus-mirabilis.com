import { describe, expect, test } from "bun:test";
import {
  BoundedBufferPool,
  createBodyBufferShape,
  createFieldBufferShape,
  ExperimentTransport,
  forceTransportMode,
  globalTransportBus,
  LeaseExpiredError,
  probeTransportCapabilities,
  SharedMemoryDisabledError,
  TransportWorkerSupervisor,
} from "../workers/transport.ts";
import { appendExtractionLog, newExtractionLogRunId } from "./extractionLogging.ts";

const logRunId = newExtractionLogRunId();

describe("Transport Runtime Extraction", () => {
  test("capability probe reports shared memory as disabled and selects transferable buffer path when workers exist", () => {
    const start = performance.now();
    forceTransportMode(null);

    // Simulated probe with workers available
    const capsWithWorkers = probeTransportCapabilities({
      crossOriginIsolated: true,
      hasSharedArrayBuffer: true, // SAB in environment
      hasWebWorkers: true,
    });
    // Transport still selects transferable path and reports SAB disabled
    expect(capsWithWorkers.hasSharedArrayBuffer).toBe(false);
    expect(capsWithWorkers.activeMode).toBe("transferable-array-buffer");
    expect(capsWithWorkers.description).toContain("shared memory disabled");

    // Simulated probe without workers
    const capsWithoutWorkers = probeTransportCapabilities({
      crossOriginIsolated: false,
      hasSharedArrayBuffer: false,
      hasWebWorkers: false,
    });
    expect(capsWithoutWorkers.hasSharedArrayBuffer).toBe(false);
    expect(capsWithoutWorkers.activeMode).toBe("copy-fallback");
    expect(capsWithoutWorkers.description).toContain("Copy fallback");

    appendExtractionLog({
      logRunId,
      testId: "transport-capability-probe-shared-memory-disabled",
      outcome: "pass",
      durationMs: performance.now() - start,
      message:
        "probeTransportCapabilities keeps shared memory disabled and falls back to transferable/copy paths",
    });
  });

  test("selecting shared-memory mode throws typed SharedMemoryDisabledError", () => {
    const start = performance.now();
    expect(() => forceTransportMode("shared-memory")).toThrow(SharedMemoryDisabledError);
    appendExtractionLog({
      logRunId,
      testId: "transport-force-shared-memory-throws",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "forceTransportMode('shared-memory') throws SharedMemoryDisabledError",
    });
  });

  test("BoundedBufferPool with useSharedMemory: true throws typed SharedMemoryDisabledError", () => {
    const start = performance.now();
    const shape = createFieldBufferShape(16, 16);
    expect(() => new BoundedBufferPool(shape, 3, true)).toThrow(SharedMemoryDisabledError);
    appendExtractionLog({
      logRunId,
      testId: "transport-bounded-buffer-pool-shared-memory-throws",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "BoundedBufferPool refuses useSharedMemory: true with SharedMemoryDisabledError",
    });
  });

  test("ExperimentTransport attachBufferPool refuses useSharedMemory: true with SharedMemoryDisabledError", () => {
    const start = performance.now();
    const transport = new ExperimentTransport("test-exp-shared-refusal");
    const shape = createFieldBufferShape(8, 8);
    expect(() => transport.attachBufferPool(shape, 2, true)).toThrow(SharedMemoryDisabledError);
    appendExtractionLog({
      logRunId,
      testId: "transport-experiment-attach-buffer-pool-shared-memory-throws",
      outcome: "pass",
      durationMs: performance.now() - start,
      message:
        "ExperimentTransport.attachBufferPool refuses useSharedMemory: true with SharedMemoryDisabledError",
    });
  });

  test("donor-trap: oldest-lease eviction: acquiring past capacity evicts the oldest active lease and reports it", () => {
    // Characterization test pinning the donor's oldest-lease eviction trap
    // am-rt-memory-lifecycle-5ws reference-counts snapshot buffers instead of silently evicting
    const start = performance.now();
    const shape = createBodyBufferShape(2);
    const capacity = 2; // Double buffering
    const pool = new BoundedBufferPool(shape, capacity);

    const lease1 = pool.acquire(10);
    lease1.buffer[0] = 100;
    const lease2 = pool.acquire(11);
    lease2.buffer[0] = 200;

    // Acquire 3rd buffer without releasing 1 or 2 -> evicts lease 1 (oldest tick 10)
    const lease3 = pool.acquire(12);
    expect(lease3.tick).toBe(12);

    // Oldest lease1 is now evicted/expired
    expect(lease1.isReleased).toBe(true);
    expect(() => lease1.buffer).toThrow(LeaseExpiredError);

    // Lease 2 and 3 remain active and valid
    expect(lease2.isReleased).toBe(false);
    expect(lease2.buffer[0]).toBe(200);

    lease2.release();
    lease3.release();

    appendExtractionLog({
      logRunId,
      testId: "donor-trap-oldest-lease-eviction",
      outcome: "pass",
      durationMs: performance.now() - start,
      message:
        "donor-trap: oldest-lease eviction confirmed; unreleased oldest lease is evicted upon capacity overflow",
    });
  });

  test("buffer counts plateau under sustained high-frequency stepping (no memory leak)", () => {
    const start = performance.now();
    const shape = createBodyBufferShape(5);
    const capacity = 3;
    const pool = new BoundedBufferPool(shape, capacity);

    expect(pool.allocatedBufferCount).toBe(capacity);

    for (let tick = 1; tick <= 500; tick++) {
      const lease = pool.acquire(tick);
      lease.buffer[0] = tick * 0.1;
      lease.release();
    }

    expect(pool.allocatedBufferCount).toBe(capacity);
    expect(pool.activeLeaseCount).toBe(0);
    expect(pool.availableBufferCount).toBe(capacity);

    appendExtractionLog({
      logRunId,
      testId: "transport-buffer-count-plateau",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "BoundedBufferPool allocations stay capped at configured capacity",
    });
  });

  test("worker failure supervisor records valid steps and retains last good state on failure", () => {
    const start = performance.now();
    const supervisor = new TransportWorkerSupervisor();

    supervisor.recordValidStep(42, [
      {
        bodyId: "tracer-particle-1",
        position: [1.2, 3.4, 0],
        quaternion: [0, 0, 0, 1],
        tick: 42,
      },
    ]);

    expect(supervisor.getState().isHealthy).toBe(true);
    expect(supervisor.getState().lastValidPoseTick).toBe(42);

    supervisor.recordFailure("Worker out of memory");
    const failureState = supervisor.getState();
    expect(failureState.isHealthy).toBe(false);
    expect(failureState.lastValidPoseTick).toBe(42);
    expect(failureState.lastValidPoses[0]!.position).toEqual([1.2, 3.4, 0]);
    expect(failureState.refusal.isRefused).toBe(true);
    expect(failureState.refusal.reason).toContain("Worker out of memory");

    appendExtractionLog({
      logRunId,
      testId: "transport-worker-supervisor-fallback",
      outcome: "pass",
      durationMs: performance.now() - start,
      message:
        "TransportWorkerSupervisor preserves last accepted state and provides honest refusal on crash",
    });
  });

  test("ExperimentTransport and globalTransportBus provide stable instance scoping", () => {
    const start = performance.now();
    const t1 = globalTransportBus.get("bm-01-diffusion");
    const t2 = globalTransportBus.get("bm-01-diffusion");
    expect(t1).toBe(t2);

    const shape = createBodyBufferShape(3);
    t1.attachBufferPool(shape, 3);
    expect(t1.bufferPool).toBeDefined();
    expect(t1.bufferPool?.capacity).toBe(3);

    appendExtractionLog({
      logRunId,
      testId: "transport-experiment-bus-stability",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "globalTransportBus returns stable ExperimentTransport instances",
    });
  });
});
