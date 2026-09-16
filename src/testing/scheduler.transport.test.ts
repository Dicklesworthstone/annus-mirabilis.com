import assert from "node:assert/strict";
import test from "node:test";
import {
  BoundedBufferPool,
  createBodyBufferShape,
  createFieldBufferShape,
  forceTransportMode,
  probeTransportCapabilities,
  SharedMemoryDisabledError,
} from "../workers/transport.ts";

test("Transport: Shared-memory mode is strictly disabled and throws SharedMemoryDisabledError", () => {
  // 1. Attempting to force 'shared-memory' throws SharedMemoryDisabledError
  assert.throws(
    () => {
      forceTransportMode("shared-memory");
    },
    (err: unknown) => {
      return err instanceof SharedMemoryDisabledError;
    },
  );

  // 2. Probing transport capabilities always yields hasSharedArrayBuffer: false
  const caps = probeTransportCapabilities({
    crossOriginIsolated: true,
    hasSharedArrayBuffer: true,
    hasWebWorkers: true,
  });
  assert.equal(caps.hasSharedArrayBuffer, false);
  assert.equal(caps.activeMode, "transferable-array-buffer");

  // 3. Probing with web workers disabled falls back to copy-fallback
  const capsNoWorkers = probeTransportCapabilities({
    crossOriginIsolated: false,
    hasSharedArrayBuffer: false,
    hasWebWorkers: false,
  });
  assert.equal(capsNoWorkers.hasSharedArrayBuffer, false);
  assert.equal(capsNoWorkers.activeMode, "copy-fallback");

  // 4. BoundedBufferPool rejects useSharedMemory: true
  const shape = createFieldBufferShape(10, 10);
  assert.throws(
    () => {
      new BoundedBufferPool(shape, 3, true);
    },
    (err: unknown) => {
      return err instanceof SharedMemoryDisabledError;
    },
  );
});

test("Transport: Transferable and copy modes operate correctly with BoundedBufferPool", () => {
  const shape = createBodyBufferShape(5);
  assert.equal(shape.totalElements, 35);
  assert.equal(shape.bytesPerElement, 4);

  const pool = new BoundedBufferPool(shape, 3);
  assert.equal(pool.capacity, 3);
  assert.equal(pool.availableBufferCount, 3);
  assert.equal(pool.activeLeaseCount, 0);

  // Acquire lease 1
  const lease1 = pool.acquire(1);
  assert.equal(lease1.tick, 1);
  assert.equal(lease1.isReleased, false);
  assert.equal(lease1.buffer.length, 35);
  assert.equal(pool.activeLeaseCount, 1);

  // Acquire lease 2
  const lease2 = pool.acquire(2);
  assert.equal(lease2.tick, 2);
  assert.equal(pool.activeLeaseCount, 2);

  // Release lease 1
  lease1.release();
  assert.equal(lease1.isReleased, true);
  assert.throws(() => {
    // Accessing buffer after release throws LeaseExpiredError
    const _ = lease1.buffer;
  });
  assert.equal(pool.activeLeaseCount, 1);

  // Release lease 2
  lease2.release();
  assert.equal(lease2.isReleased, true);
  assert.equal(pool.activeLeaseCount, 0);

  // Force transferable and copy modes and reset
  forceTransportMode("transferable-array-buffer");
  const capsForcedTransferable = probeTransportCapabilities();
  assert.equal(capsForcedTransferable.activeMode, "transferable-array-buffer");

  forceTransportMode("copy-fallback");
  const capsForcedCopy = probeTransportCapabilities();
  assert.equal(capsForcedCopy.activeMode, "copy-fallback");

  forceTransportMode(null);
});
