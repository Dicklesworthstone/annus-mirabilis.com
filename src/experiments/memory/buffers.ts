/**
 * Annus Mirabilis: Buffer Ownership, Reference Counting, and Pooling
 *
 * Implements AGENTS.md "Worker behavior, memory, and lifecycle":
 * - Keep large particle buffers out of React state.
 * - Never transfer or detach a buffer that a published snapshot still exposes.
 * - Never place a mutable buffer behind an immutable snapshot.
 * - Pools recycle only buffers whose reference count (snapshots plus views) is zero.
 * - Active lease eviction is never used for snapshot-exposed buffers.
 * - SharedArrayBuffer allocation is strictly barred (no cross-origin isolation required).
 */

export class SharedMemoryDisabledError extends Error {
  constructor(
    message = "SharedArrayBuffer and shared-memory allocations are strictly disabled in Annus Mirabilis (AGENTS.md).",
  ) {
    super(message);
    this.name = "SharedMemoryDisabledError";
  }
}

export class BufferTransferRefusedError extends Error {
  readonly snapshotVersions: readonly (number | string)[];
  readonly refCount: number;

  constructor(snapshotVersions: readonly (number | string)[], refCount: number, message?: string) {
    const defaultMessage = `Transfer/detach refused: buffer is currently referenced by live snapshot version(s) [${snapshotVersions.join(", ")}] with active refCount ${refCount}.`;
    super(message ?? defaultMessage);
    this.name = "BufferTransferRefusedError";
    this.snapshotVersions = snapshotVersions;
    this.refCount = refCount;
  }
}

export class DetachedBufferInvariantViolationError extends Error {
  readonly snapshotVersions: readonly (number | string)[];

  constructor(snapshotVersions: readonly (number | string)[], message?: string) {
    const defaultMessage = `Invariant violation: buffer exposed to live snapshot version(s) [${snapshotVersions.join(", ")}] has been detached (byteLength === 0).`;
    super(message ?? defaultMessage);
    this.name = "DetachedBufferInvariantViolationError";
    this.snapshotVersions = snapshotVersions;
  }
}

export class PoolExhaustedRefusalError extends Error {
  constructor(message = "Buffer pool exhausted: all buffers are currently held by live snapshots or active leases.") {
    super(message);
    this.name = "PoolExhaustedRefusalError";
  }
}

export interface OwnedBufferOptions {
  label?: string;
  useSharedMemory?: boolean;
}

export interface BufferLeaseMetadata {
  readonly leaseId: string;
  readonly tick: number;
}

/**
 * Owned typed array with reference-counting and snapshot binding.
 */
export class OwnedBuffer<T extends ArrayBufferView = Float64Array> {
  readonly id: string;
  readonly label: string;
  private _buffer: T;
  private readonly _holders = new Set<string>();
  private readonly _snapshotVersions = new Set<number | string>();
  private _isTransferred = false;

  constructor(buffer: T, options?: OwnedBufferOptions) {
    if (options?.useSharedMemory) {
      throw new SharedMemoryDisabledError();
    }
    if (typeof SharedArrayBuffer !== "undefined" && buffer.buffer instanceof SharedArrayBuffer) {
      throw new SharedMemoryDisabledError("Buffer is backed by a SharedArrayBuffer.");
    }
    this.id = `buf-${Math.random().toString(36).slice(2, 10)}`;
    this.label = options?.label ?? "unlabeled";
    this._buffer = buffer;
  }

  get buffer(): T {
    this.assertNotDetached();
    return this._buffer;
  }

  get rawArrayBuffer(): ArrayBuffer {
    this.assertNotDetached();
    return this._buffer.buffer as ArrayBuffer;
  }

  get byteLength(): number {
    return this._buffer.byteLength;
  }

  get refCount(): number {
    return this._holders.size + this._snapshotVersions.size;
  }

  get isTransferred(): boolean {
    return this._isTransferred;
  }

  get snapshotVersions(): readonly (number | string)[] {
    return Array.from(this._snapshotVersions);
  }

  addRef(holderId: string): void {
    if (this._isTransferred) {
      throw new Error(`Cannot add reference to already transferred buffer ${this.id}.`);
    }
    this._holders.add(holderId);
  }

  releaseRef(holderId: string): void {
    this._holders.delete(holderId);
  }

  bindToSnapshot(snapshotVersion: number | string): void {
    if (this._isTransferred) {
      throw new Error(`Cannot bind transferred buffer ${this.id} to snapshot ${snapshotVersion}.`);
    }
    this.assertNotDetached();
    this._snapshotVersions.add(snapshotVersion);
  }

  unbindFromSnapshot(snapshotVersion: number | string): void {
    this._snapshotVersions.delete(snapshotVersion);
  }

  /**
   * Refuses transfer if referenced by any snapshot or active lease holder.
   * On successful transfer, marks the buffer transferred and returns the underlying ArrayBuffer.
   */
  transfer(): ArrayBuffer {
    if (this._snapshotVersions.size > 0 || this._holders.size > 0) {
      throw new BufferTransferRefusedError(
        Array.from(this._snapshotVersions),
        this.refCount,
      );
    }
    if (this._isTransferred) {
      throw new Error(`Buffer ${this.id} has already been transferred.`);
    }
    this._isTransferred = true;
    return this._buffer.buffer as ArrayBuffer;
  }

  /**
   * Asserts the buffer has not been silently detached while held by a snapshot.
   */
  assertNotDetached(): void {
    if (this._buffer.byteLength === 0) {
      if (this._snapshotVersions.size > 0) {
        throw new DetachedBufferInvariantViolationError(Array.from(this._snapshotVersions));
      }
      if (!this._isTransferred && this._holders.size > 0) {
        throw new Error(`Buffer ${this.id} was detached while held by ${this._holders.size} active holders.`);
      }
    }
  }

  /**
   * Creates an independent detached copy that safe snapshots can expose.
   */
  clone(): OwnedBuffer<T> {
    this.assertNotDetached();
    const TypedArrayConstructor = this._buffer.constructor as new (length: number) => T;
    const len = (this._buffer as unknown as { length: number }).length;
    const copy = new TypedArrayConstructor(len);
    new Uint8Array(copy.buffer).set(new Uint8Array(this._buffer.buffer, this._buffer.byteOffset, this._buffer.byteLength));
    return new OwnedBuffer<T>(copy, { label: `${this.label}-copy` });
  }
}

export interface BufferPoolShape {
  readonly elements: number;
  readonly bytesPerElement: number;
}

/**
 * Bounded buffer pool with strict reference counting.
 * Recycles buffers ONLY when their reference count (snapshots + leases) is zero.
 * Active lease eviction NEVER touches snapshot-exposed buffers.
 */
export class SnapshotBufferPool {
  readonly capacity: number;
  readonly elements: number;
  private readonly _pool: OwnedBuffer<Float64Array>[] = [];
  private readonly _activeLeases = new Map<string, { buffer: OwnedBuffer<Float64Array>; tick: number }>();
  private _leaseCounter = 0;
  private _totalAllocated = 0;

  constructor(elements: number, capacity = 3, useSharedMemory = false) {
    if (useSharedMemory) {
      throw new SharedMemoryDisabledError();
    }
    this.elements = elements;
    this.capacity = capacity;
    for (let i = 0; i < capacity; i++) {
      this._pool.push(this.allocateNewBuffer());
    }
  }

  get totalAllocations(): number {
    return this._totalAllocated;
  }

  get availableCount(): number {
    return this._pool.filter((b) => b.refCount === 0 && !b.isTransferred).length;
  }

  get activeLeaseCount(): number {
    return this._activeLeases.size;
  }

  private allocateNewBuffer(): OwnedBuffer<Float64Array> {
    this._totalAllocated++;
    return new OwnedBuffer(new Float64Array(this.elements), {
      label: `pool-buffer-${this._totalAllocated}`,
    });
  }

  /**
   * Acquires an available buffer with refCount === 0.
   * If all are in use, attempts to evict the oldest active lease ONLY if that lease is NOT exposed to any snapshot.
   */
  acquire(tick: number): { leaseId: string; buffer: OwnedBuffer<Float64Array>; release: () => void } {
    // 1. Check for a free buffer in pool with refCount === 0
    let candidateIdx = this._pool.findIndex((b) => b.refCount === 0 && !b.isTransferred && b.byteLength > 0);
    let buf: OwnedBuffer<Float64Array>;

    if (candidateIdx >= 0) {
      buf = this._pool.splice(candidateIdx, 1)[0]!;
    } else {
      // 2. If pool has not reached capacity, allocate a new one
      if (this._totalAllocated < this.capacity) {
        buf = this.allocateNewBuffer();
      } else {
        // 3. Attempt to evict the oldest active lease that has NO snapshot references
        let oldestLeaseId: string | null = null;
        let oldestTick = Number.POSITIVE_INFINITY;

        for (const [id, entry] of this._activeLeases.entries()) {
          // Never evict if buffer is referenced by any snapshot!
          if (entry.buffer.snapshotVersions.length === 0 && entry.tick < oldestTick) {
            oldestTick = entry.tick;
            oldestLeaseId = id;
          }
        }

        if (!oldestLeaseId) {
          throw new PoolExhaustedRefusalError(
            "Cannot acquire pooled buffer: all buffers are bound to live snapshots or zero-evictable leases.",
          );
        }

        const evicted = this._activeLeases.get(oldestLeaseId)!;
        this._activeLeases.delete(oldestLeaseId);
        evicted.buffer.releaseRef(oldestLeaseId);
        buf = evicted.buffer;
      }
    }

    const leaseId = `lease-${++this._leaseCounter}`;
    buf.addRef(leaseId);
    this._activeLeases.set(leaseId, { buffer: buf, tick });

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      if (this._activeLeases.has(leaseId)) {
        this._activeLeases.delete(leaseId);
        buf.releaseRef(leaseId);
        // If buffer is now at refCount 0 and not transferred, return it to the pool
        if (buf.refCount === 0 && !buf.isTransferred && buf.byteLength > 0) {
          if (this._pool.length < this.capacity) {
            this._pool.push(buf);
          }
        }
      }
    };

    return { leaseId, buffer: buf, release };
  }
}
