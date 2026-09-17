/**
 * Annus Mirabilis: WASM Memory-Growth Safety and View Tracking
 *
 * Implements AGENTS.md "Worker behavior, memory, and lifecycle":
 * - WASM memory growth invalidates JavaScript views into linear memory:
 *   never retain such a view across untracked reallocation.
 * - The default is copy-out: wasm-bindgen returns Vec<f64> as a fresh Float64Array copy.
 * - Any zero-copy view must go through wasmViews.ts, which tracks a memory generation
 *   (incremented whenever memory.buffer identity changes) and checks it on every access;
 *   a mismatch throws in development and test builds.
 */

export class WasmMemoryStaleViewError extends Error {
  readonly viewGeneration: number;
  readonly currentGeneration: number;

  constructor(viewGeneration: number, currentGeneration: number, message?: string) {
    const defaultMessage = `WASM memory view stale: view was created at memory generation ${viewGeneration}, but current memory generation is ${currentGeneration} (memory grew or reallocated). Access rejected to prevent silent corruption or NaN poisoning.`;
    super(message ?? defaultMessage);
    this.name = "WasmMemoryStaleViewError";
    this.viewGeneration = viewGeneration;
    this.currentGeneration = currentGeneration;
  }
}

export class WasmMemoryDetachedBufferError extends Error {
  constructor(message = "WASM memory buffer is detached (byteLength === 0).") {
    super(message);
    this.name = "WasmMemoryDetachedBufferError";
  }
}

/**
 * Tracks WebAssembly.Memory buffer identity and generation count across grow() calls.
 */
export class WasmMemoryTracker {
  readonly memory: WebAssembly.Memory;
  private _cachedBuffer: ArrayBuffer;
  private _generation = 1;

  constructor(memory: WebAssembly.Memory) {
    this.memory = memory;
    this._cachedBuffer = memory.buffer;
  }

  /**
   * Returns current generation. Checks if memory.buffer has changed or detached
   * and automatically increments generation if so.
   */
  get currentGeneration(): number {
    this.pollGeneration();
    return this._generation;
  }

  get buffer(): ArrayBuffer {
    this.pollGeneration();
    return this.memory.buffer;
  }

  /**
   * Checks whether the underlying memory has grown or changed identity since last check.
   */
  pollGeneration(): boolean {
    const currentBuf = this.memory.buffer;
    if (currentBuf !== this._cachedBuffer || currentBuf.byteLength === 0) {
      this._generation++;
      this._cachedBuffer = currentBuf;
      return true;
    }
    return false;
  }

  /**
   * Creates a tracked zero-copy view with generational guard.
   */
  createView<T extends ArrayBufferView>(
    factory: (buf: ArrayBuffer, byteOffset: number, length: number) => T,
    byteOffset: number,
    length: number,
  ): TrackedWasmView<T> {
    this.pollGeneration();
    return new TrackedWasmView(this, factory, byteOffset, length, this._generation);
  }

  /**
   * Creates a tracked Float64Array view.
   */
  createFloat64View(byteOffset: number, length: number): TrackedWasmView<Float64Array> {
    return this.createView(
      (buf, offset, len) => new Float64Array(buf, offset, len),
      byteOffset,
      length,
    );
  }
}

/**
 * Generational wrapper over an ArrayBufferView into WebAssembly.Memory.
 * On every read/write access, asserts that the memory generation has not changed.
 */
export class TrackedWasmView<T extends ArrayBufferView> {
  readonly tracker: WasmMemoryTracker;
  readonly byteOffset: number;
  readonly length: number;
  readonly generation: number;
  private readonly _factory: (buf: ArrayBuffer, byteOffset: number, length: number) => T;
  private _cachedView: T;

  constructor(
    tracker: WasmMemoryTracker,
    factory: (buf: ArrayBuffer, byteOffset: number, length: number) => T,
    byteOffset: number,
    length: number,
    generation: number,
  ) {
    this.tracker = tracker;
    this._factory = factory;
    this.byteOffset = byteOffset;
    this.length = length;
    this.generation = generation;
    this._cachedView = factory(tracker.buffer, byteOffset, length);
  }

  /**
   * Asserts the view is valid and has not been invalidated by memory growth.
   */
  assertValid(): void {
    const curGen = this.tracker.currentGeneration;
    if (this.generation !== curGen) {
      throw new WasmMemoryStaleViewError(this.generation, curGen);
    }
    if (this.tracker.buffer.byteLength === 0 || this._cachedView.byteLength === 0) {
      throw new WasmMemoryDetachedBufferError();
    }
  }

  get isValid(): boolean {
    try {
      this.assertValid();
      return true;
    } catch {
      return false;
    }
  }

  get view(): T {
    this.assertValid();
    return this._cachedView;
  }

  at(index: number): number {
    this.assertValid();
    const arr = this._cachedView as unknown as { [key: number]: number; length: number };
    if (index < 0 || index >= arr.length) {
      throw new RangeError(`Index ${index} out of bounds for view of length ${arr.length}`);
    }
    const val = arr[index];
    if (val === undefined) {
      throw new WasmMemoryStaleViewError(this.generation, this.tracker.currentGeneration);
    }
    return val;
  }

  set(index: number, value: number): void {
    this.assertValid();
    const arr = this._cachedView as unknown as { [key: number]: number; length: number };
    if (index < 0 || index >= arr.length) {
      throw new RangeError(`Index ${index} out of bounds for view of length ${arr.length}`);
    }
    arr[index] = value;
  }

  /**
   * Safely copies data out to a newly allocated typed array independent of WASM memory.
   */
  copy(): T {
    this.assertValid();
    const TypedArrayConstructor = this._cachedView.constructor as new (length: number) => T;
    const len = (this._cachedView as unknown as { length: number }).length;
    const out = new TypedArrayConstructor(len);
    new Uint8Array(out.buffer).set(
      new Uint8Array(this.tracker.buffer, this.byteOffset, this._cachedView.byteLength),
    );
    return out;
  }
}

/**
 * Standard copy-out function for f64 regions.
 * Copies directly from WASM memory into a newly allocated Float64Array.
 */
export function copyOutF64(
  memory: WebAssembly.Memory,
  byteOffset: number,
  elementCount: number,
): Float64Array {
  if (memory.buffer.byteLength === 0) {
    throw new WasmMemoryDetachedBufferError();
  }
  const result = new Float64Array(elementCount);
  const srcBytes = new Uint8Array(memory.buffer, byteOffset, elementCount * Float64Array.BYTES_PER_ELEMENT);
  new Uint8Array(result.buffer).set(srcBytes);
  return result;
}

/**
 * Standard copy-out function for Vec<f64> pointers (wasm-bindgen style).
 * Returns a new independent Float64Array copy whose buffer is not memory.buffer.
 */
export function copyOutVecF64(
  memory: WebAssembly.Memory,
  ptr: number,
  len: number,
): Float64Array {
  return copyOutF64(memory, ptr, len);
}

/**
 * Verifies that an array returned from a binding is an independent copy
 * rather than a live/fragile view into WASM linear memory.
 */
export function verifyGlueReturnsCopy(
  returnedArray: ArrayBufferView,
  memory: WebAssembly.Memory,
): boolean {
  if (returnedArray.buffer === memory.buffer) {
    return false;
  }
  return true;
}
