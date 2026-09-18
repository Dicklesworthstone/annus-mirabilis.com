import { describe, expect, test } from "bun:test";
import {
  BufferTransferRefusedError,
  DetachedBufferInvariantViolationError,
  OwnedBuffer,
  PoolExhaustedRefusalError,
  SharedMemoryDisabledError,
  SnapshotBufferPool,
} from "../experiments/memory/buffers.ts";

describe("OwnedBuffer lifecycle and ownership", () => {
  test("reference counting tracks holders and snapshot versions independently", () => {
    const raw = new Float64Array([1.0, 2.0, 3.0]);
    const buf = new OwnedBuffer(raw, { label: "test-buf" });

    expect(buf.refCount).toBe(0);
    expect(buf.snapshotVersions).toEqual([]);

    buf.addRef("view-1");
    expect(buf.refCount).toBe(1);

    buf.addRef("view-2");
    expect(buf.refCount).toBe(2);

    buf.bindToSnapshot(1);
    expect(buf.refCount).toBe(3);
    expect(buf.snapshotVersions).toEqual([1]);

    buf.releaseRef("view-1");
    expect(buf.refCount).toBe(2);

    buf.unbindFromSnapshot(1);
    expect(buf.refCount).toBe(1);

    buf.releaseRef("view-2");
    expect(buf.refCount).toBe(0);
  });

  test("transfer is refused when buffer is referenced by a live snapshot", () => {
    const raw = new Float64Array([4.0, 5.0, 6.0]);
    const buf = new OwnedBuffer(raw, { label: "snapshot-bound" });
    buf.bindToSnapshot(42);

    expect(() => buf.transfer()).toThrow(BufferTransferRefusedError);

    try {
      buf.transfer();
    } catch (err) {
      expect(err instanceof BufferTransferRefusedError).toBe(true);
      const refErr = err as BufferTransferRefusedError;
      expect(refErr.snapshotVersions).toEqual([42]);
      expect(refErr.refCount).toBe(1);
    }
  });

  test("transfer is refused when buffer is held by an active view holder", () => {
    const raw = new Float64Array([7.0, 8.0]);
    const buf = new OwnedBuffer(raw);
    buf.addRef("holder-a");

    expect(() => buf.transfer()).toThrow(BufferTransferRefusedError);

    buf.releaseRef("holder-a");
    // Once released with 0 references, transfer succeeds and yields ArrayBuffer
    const ab = buf.transfer();
    expect(ab).toBeInstanceOf(ArrayBuffer);
    expect(buf.isTransferred).toBe(true);
  });

  test("cannot add reference or snapshot binding to already transferred buffer", () => {
    const raw = new Float64Array([10.0]);
    const buf = new OwnedBuffer(raw);
    buf.transfer();

    expect(() => buf.addRef("new-holder")).toThrow("Cannot add reference");
    expect(() => buf.bindToSnapshot(2)).toThrow("Cannot bind transferred buffer");
  });

  test("shared memory options or SharedArrayBuffer buffers throw SharedMemoryDisabledError", () => {
    const raw = new Float64Array([1.0]);
    expect(() => new OwnedBuffer(raw, { useSharedMemory: true })).toThrow(
      SharedMemoryDisabledError,
    );
    expect(() => new SnapshotBufferPool(10, 2, true)).toThrow(SharedMemoryDisabledError);
  });

  test("cloning produces an independent owned buffer copy", () => {
    const raw = new Float64Array([1.5, 2.5, 3.5]);
    const original = new OwnedBuffer(raw, { label: "orig" });
    const clone = original.clone();

    expect(clone.byteLength).toBe(original.byteLength);
    expect(clone.rawArrayBuffer).not.toBe(original.rawArrayBuffer);
    expect(Array.from(clone.buffer)).toEqual([1.5, 2.5, 3.5]);
  });
});

describe("SnapshotBufferPool recycling and eviction guarantees", () => {
  test("recycles buffers only when refCount is zero", () => {
    const pool = new SnapshotBufferPool(8, 2);
    expect(pool.availableCount).toBe(2);

    const lease1 = pool.acquire(100);
    expect(lease1.buffer.refCount).toBe(1);
    expect(pool.activeLeaseCount).toBe(1);

    const lease2 = pool.acquire(101);
    expect(pool.availableCount).toBe(0);
    expect(pool.activeLeaseCount).toBe(2);

    // Release lease1: buffer refCount drops to 0, returns to pool
    lease1.release();
    expect(lease1.buffer.refCount).toBe(0);
    expect(pool.availableCount).toBe(1);

    // Next acquire gets the recycled buffer
    const lease3 = pool.acquire(102);
    expect(lease3.buffer.id).toBe(lease1.buffer.id);
    expect(lease3.buffer.refCount).toBe(1);

    lease2.release();
    lease3.release();
    expect(pool.availableCount).toBe(2);
  });

  test("eviction never touches snapshot-exposed buffers", () => {
    const pool = new SnapshotBufferPool(4, 2);

    const lease1 = pool.acquire(10);
    const lease2 = pool.acquire(20);

    // Bind lease1's buffer to a live snapshot
    lease1.buffer.bindToSnapshot(1);
    expect(lease1.buffer.snapshotVersions).toEqual([1]);

    // Now both buffers are leased. If we acquire a 3rd buffer, pool must evict.
    // Lease 1 cannot be evicted because it is bound to a snapshot.
    // Lease 2 has no snapshot and can be evicted.
    const lease3 = pool.acquire(30);
    expect(lease3.buffer.id).toBe(lease2.buffer.id);

    // Now if we try to acquire a 4th buffer while lease1 is still bound to snapshot
    // and lease3 is also bound to snapshot:
    lease3.buffer.bindToSnapshot(2);

    // All available buffers in pool are bound to snapshots -> eviction is refused fail-closed
    expect(() => pool.acquire(40)).toThrow(PoolExhaustedRefusalError);
  });
});
