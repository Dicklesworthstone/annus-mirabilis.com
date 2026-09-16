/**
 * Work-unit chunking for long-running physical simulations and evaluations.
 *
 * Rules:
 * 1. Chunks are sized strictly by integer work units (e.g. 10^3 to 10^5 steps), NEVER by elapsed milliseconds.
 * 2. Evaluating a scenario with chunk size 10^3 vs 10^5 yields bitwise-identical accepted results.
 * 3. Cooperative yield allows workers to inspect cancellation/supersession between chunks without stalling main thread.
 *
 * Spec: AGENTS.md §6.2, §15.4 and am-rt-worker-scheduler-7tl
 */

export interface WorkUnitChunk {
  readonly chunkIndex: number;
  readonly startUnit: number;
  readonly endUnit: number;
  readonly workUnits: number;
  readonly isLast: boolean;
}

export interface ChunkPlan {
  readonly totalWorkUnits: number;
  readonly chunkSize: number;
  readonly chunks: readonly WorkUnitChunk[];
}

export function createChunkPlan(totalWorkUnits: number, chunkSize = 1000): ChunkPlan {
  if (!Number.isSafeInteger(totalWorkUnits) || totalWorkUnits < 0) {
    throw new TypeError(
      `Invalid totalWorkUnits: ${totalWorkUnits}. Must be a nonnegative safe integer.`,
    );
  }
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new TypeError(`Invalid chunkSize: ${chunkSize}. Must be a positive safe integer.`);
  }

  if (totalWorkUnits === 0) {
    const singleChunk: WorkUnitChunk = {
      chunkIndex: 0,
      startUnit: 0,
      endUnit: 0,
      workUnits: 0,
      isLast: true,
    };
    return Object.freeze({
      totalWorkUnits: 0,
      chunkSize,
      chunks: Object.freeze([singleChunk]),
    });
  }

  const chunks: WorkUnitChunk[] = [];
  let chunkIndex = 0;
  let startUnit = 0;

  while (startUnit < totalWorkUnits) {
    const endUnit = Math.min(startUnit + chunkSize, totalWorkUnits);
    const workUnits = endUnit - startUnit;
    const isLast = endUnit >= totalWorkUnits;

    chunks.push(
      Object.freeze({
        chunkIndex,
        startUnit,
        endUnit,
        workUnits,
        isLast,
      }),
    );

    startUnit = endUnit;
    chunkIndex++;
  }

  return Object.freeze({
    totalWorkUnits,
    chunkSize,
    chunks: Object.freeze(chunks),
  });
}

/**
 * Yield execution cooperatively to allow message queue events (cancellation/supersession) to process.
 */
export async function cooperativeYield(): Promise<void> {
  // Use scheduler.yield if available in modern browsers, otherwise queue microtask / zero-timeout
  const nav =
    typeof globalThis !== "undefined"
      ? (globalThis as unknown as { scheduler?: { yield?: () => Promise<void> } })
      : undefined;
  if (nav?.scheduler?.yield && typeof nav.scheduler.yield === "function") {
    try {
      await nav.scheduler.yield();
      return;
    } catch {
      /* Fall through */
    }
  }

  await new Promise<void>((resolve) => {
    if (typeof setImmediate === "function") {
      setImmediate(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export interface ChunkedExecutionOptions<TState> {
  readonly plan: ChunkPlan;
  readonly initialState: TState;
  readonly step: (state: TState, chunk: WorkUnitChunk) => TState;
  readonly isCancelled: () => boolean;
  readonly onChunk?: ((chunk: WorkUnitChunk, state: TState) => void) | undefined;
}

export interface ChunkedExecutionResult<TState> {
  readonly completed: boolean;
  readonly cancelled: boolean;
  readonly state: TState;
  readonly chunksCompleted: number;
}

export async function executeChunked<TState>(
  options: ChunkedExecutionOptions<TState>,
): Promise<ChunkedExecutionResult<TState>> {
  let currentState = options.initialState;
  let chunksCompleted = 0;

  for (const chunk of options.plan.chunks) {
    if (options.isCancelled()) {
      return {
        completed: false,
        cancelled: true,
        state: currentState,
        chunksCompleted,
      };
    }

    currentState = options.step(currentState, chunk);
    chunksCompleted++;

    if (options.onChunk) {
      options.onChunk(chunk, currentState);
    }

    if (!chunk.isLast) {
      await cooperativeYield();
    }
  }

  return {
    completed: true,
    cancelled: false,
    state: currentState,
    chunksCompleted,
  };
}
