import assert from "node:assert/strict";
import test from "node:test";
import { createChunkPlan, executeChunked } from "../workers/scheduler/chunking.ts";

test("Chunk Plan creation and boundary validation", () => {
  const plan1k = createChunkPlan(100000, 1000);
  assert.equal(plan1k.totalWorkUnits, 100000);
  assert.equal(plan1k.chunks.length, 100);
  const first1k = plan1k.chunks[0];
  assert.ok(first1k);
  assert.equal(first1k.startUnit, 0);
  assert.equal(first1k.endUnit, 1000);
  assert.equal(first1k.isLast, false);
  const last1k = plan1k.chunks[99];
  assert.ok(last1k);
  assert.equal(last1k.endUnit, 100000);
  assert.equal(last1k.isLast, true);

  const planSingle = createChunkPlan(100000, 100000);
  assert.equal(planSingle.chunks.length, 1);
  const firstSingle = planSingle.chunks[0];
  assert.ok(firstSingle);
  assert.equal(firstSingle.startUnit, 0);
  assert.equal(firstSingle.endUnit, 100000);
  assert.equal(firstSingle.isLast, true);

  const planZero = createChunkPlan(0, 1000);
  assert.equal(planZero.chunks.length, 1);
  const firstZero = planZero.chunks[0];
  assert.ok(firstZero);
  assert.equal(firstZero.workUnits, 0);
});

test("Chunked execution produces bitwise-identical results for chunk sizes 10^3 and 10^5", async () => {
  interface SimulationState {
    accumulator: number;
    stepCount: number;
  }

  const stepFn = (state: SimulationState, chunk: { workUnits: number }): SimulationState => {
    let acc = state.accumulator;
    for (let i = 0; i < chunk.workUnits; i++) {
      // Deterministic recurrence: acc = (acc * 1103515245 + 12345) & 0x7fffffff
      acc = ((acc * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    }
    return {
      accumulator: acc,
      stepCount: state.stepCount + chunk.workUnits,
    };
  };

  const plan1k = createChunkPlan(100000, 1000);
  const plan100k = createChunkPlan(100000, 100000);

  const result1k = await executeChunked<SimulationState>({
    plan: plan1k,
    initialState: { accumulator: 42, stepCount: 0 },
    step: stepFn,
    isCancelled: () => false,
  });

  const result100k = await executeChunked<SimulationState>({
    plan: plan100k,
    initialState: { accumulator: 42, stepCount: 0 },
    step: stepFn,
    isCancelled: () => false,
  });

  assert.equal(result1k.completed, true);
  assert.equal(result100k.completed, true);
  assert.equal(result1k.state.stepCount, 100000);
  assert.equal(result100k.state.stepCount, 100000);
  assert.equal(result1k.state.accumulator, result100k.state.accumulator);
});

test("Cooperative cancellation stops execution cleanly at next chunk boundary", async () => {
  const cancelAfterChunks = 5;
  let executedChunks = 0;

  const plan = createChunkPlan(50000, 1000); // 50 chunks

  const result = await executeChunked<number>({
    plan,
    initialState: 0,
    step: (state, chunk) => {
      executedChunks++;
      return state + chunk.workUnits;
    },
    isCancelled: () => executedChunks >= cancelAfterChunks,
  });

  assert.equal(result.completed, false);
  assert.equal(result.cancelled, true);
  assert.equal(result.chunksCompleted, cancelAfterChunks);
  assert.equal(result.state, cancelAfterChunks * 1000);
});
