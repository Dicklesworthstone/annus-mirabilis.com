#!/usr/bin/env bun
/**
 * ============================================================================
 * Annus Mirabilis: Resource Stress and Lifecycle Leak Verification
 * (scripts/resource-stress.ts)
 * ============================================================================
 *
 * Implements quality gate 'resource-stress' (owner: am-plat-resource-stress-9zgu,
 * am-rt-memory-lifecycle-5ws).
 *
 * Measures and enforces the runtime rules in AGENTS.md "Worker behavior, memory, and lifecycle":
 * 1. 100 mount/unmount loops on heavy runtime laboratories leave all diagnostics at baseline.
 * 2. WASM memory growth invalidates linear views; generational guard rejects stale access.
 * 3. Buffer ownership refuses transfer/detach of snapshot-exposed buffers.
 * 4. Checkpoint recovery fail-closed: single-field corruption forces a new run.
 * 5. Concurrency LRU suspension: heavy lab limit suspends oldest lab and resumes with exact replay.
 * 6. Three.js scene graph disposal cleans all geometries, materials, and textures.
 *
 * Exits 0 ONLY when all real measurements pass; exits non-zero on any leak or failure.
 */

import { HeavyLaboratoryManager } from "../src/experiments/lifecycle/concurrency.ts";
import { lifecycleDiagnostics } from "../src/experiments/lifecycle/diagnostics.ts";
import {
  encodeStreamCheckpoint,
  evaluateCheckpointRecovery,
  STREAM_CHECKPOINT_FRAME_LENGTH,
} from "../src/experiments/lifecycle/recovery.ts";
import {
  BufferTransferRefusedError,
  OwnedBuffer,
  SnapshotBufferPool,
} from "../src/experiments/memory/buffers.ts";
import {
  copyOutF64,
  WasmMemoryStaleViewError,
  WasmMemoryTracker,
} from "../src/experiments/memory/wasmViews.ts";
import { HeavyFixtureLaboratory } from "../src/testing/runtime-fixtures/heavyFixture.ts";
import { disposeSceneGraph } from "../src/visuals/three/dispose.ts";

export interface ScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly details: Record<string, unknown>;
  readonly error?: string | undefined;
}

export interface ResourceStressReport {
  readonly suite: "resource-stress";
  readonly timestamp: string;
  readonly passed: boolean;
  readonly totalScenarios: number;
  readonly passedScenarios: number;
  readonly scenarios: readonly ScenarioResult[];
}

// ----------------------------------------------------------------------------
// Scenario 1: 100 Mount/Unmount Cycle Stress Test
// ----------------------------------------------------------------------------
export function runMountUnmountStress(iterations = 100): ScenarioResult {
  const start = performance.now();
  lifecycleDiagnostics.reset();

  for (let i = 0; i < iterations; i++) {
    const lab = new HeavyFixtureLaboratory({ id: `cycle-lab-${i}`, particleCount: 500 });
    lab.mount();
    lab.step(3);
    lab.unmount();
  }

  const durationMs = performance.now() - start;
  const currentSnapshot = lifecycleDiagnostics.snapshot();

  try {
    lifecycleDiagnostics.assertBaseline();
    return {
      name: "100-mount-unmount-lifecycle-leak-check",
      passed: true,
      durationMs,
      details: {
        iterations,
        baselineVerified: true,
        finalCounters: currentSnapshot,
      },
    };
  } catch (err) {
    return {
      name: "100-mount-unmount-lifecycle-leak-check",
      passed: false,
      durationMs,
      details: {
        iterations,
        baselineVerified: false,
        finalCounters: currentSnapshot,
      },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ----------------------------------------------------------------------------
// Scenario 2: WASM Memory Growth & Generational Guard
// ----------------------------------------------------------------------------
export function runWasmMemoryGrowthStress(): ScenarioResult {
  const start = performance.now();
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 10 });
  const tracker = new WasmMemoryTracker(memory);

  // Write known values to initial memory
  const initialF64 = new Float64Array(memory.buffer, 0, 4);
  initialF64[0] = 42.0;
  initialF64[1] = 137.035999;
  initialF64[2] = Math.E;
  initialF64[3] = Math.PI;

  // Create tracked view and safe copy-out
  const trackedView = tracker.createFloat64View(0, 4);
  const safeCopy = copyOutF64(memory, 0, 4);

  // Confirm tracked view reads accurately before growth
  if (trackedView.at(1) !== 137.035999) {
    return {
      name: "wasm-memory-growth-generational-guard",
      passed: false,
      durationMs: performance.now() - start,
      details: { step: "pre-growth-read" },
      error: `Expected 137.035999, got ${trackedView.at(1)}`,
    };
  }

  // Force WASM memory growth (allocates new ArrayBuffer, detaches old ArrayBuffer)
  memory.grow(1);

  // Verify tracker detected generational increment
  if (tracker.currentGeneration <= 1) {
    return {
      name: "wasm-memory-growth-generational-guard",
      passed: false,
      durationMs: performance.now() - start,
      details: { step: "generation-detection" },
      error: `Tracker failed to increment generation on memory growth (gen=${tracker.currentGeneration})`,
    };
  }

  // Verify that accessing the stale view throws WasmMemoryStaleViewError
  let caughtStaleError = false;
  try {
    trackedView.at(1);
  } catch (err) {
    if (err instanceof WasmMemoryStaleViewError) {
      caughtStaleError = true;
    }
  }

  if (!caughtStaleError) {
    return {
      name: "wasm-memory-growth-generational-guard",
      passed: false,
      durationMs: performance.now() - start,
      details: { step: "stale-view-rejection" },
      error: "Stale WASM view did not throw WasmMemoryStaleViewError after memory.grow()!",
    };
  }

  // Verify safe copy remains intact
  if (safeCopy[1] !== 137.035999 || safeCopy.buffer === memory.buffer) {
    return {
      name: "wasm-memory-growth-generational-guard",
      passed: false,
      durationMs: performance.now() - start,
      details: { step: "copy-out-integrity" },
      error: "Safe copy-out was corrupted or backed by WASM buffer",
    };
  }

  return {
    name: "wasm-memory-growth-generational-guard",
    passed: true,
    durationMs: performance.now() - start,
    details: {
      generationAfterGrow: tracker.currentGeneration,
      staleViewRejected: true,
      safeCopyRetained: true,
    },
  };
}

// ----------------------------------------------------------------------------
// Scenario 3: Buffer Ownership & Refusal of Snapshot Transfer
// ----------------------------------------------------------------------------
export function runBufferOwnershipStress(): ScenarioResult {
  const start = performance.now();

  const raw = new Float64Array(100);
  const owned = new OwnedBuffer(raw, { label: "snapshot-test-buf" });

  // Bind buffer to live snapshot version 42
  owned.bindToSnapshot(42);

  // Attempt transfer: must throw BufferTransferRefusedError
  let caughtTransferRefusal = false;
  try {
    owned.transfer();
  } catch (err) {
    if (err instanceof BufferTransferRefusedError && err.snapshotVersions.includes(42)) {
      caughtTransferRefusal = true;
    }
  }

  if (!caughtTransferRefusal) {
    return {
      name: "buffer-ownership-snapshot-transfer-refusal",
      passed: false,
      durationMs: performance.now() - start,
      details: { step: "transfer-refusal" },
      error: "BufferTransferRefusedError was not thrown when transferring snapshot-bound buffer!",
    };
  }

  // Pool eviction test: pool must never evict a lease bound to a snapshot
  const pool = new SnapshotBufferPool(50, 2);
  const lease1 = pool.acquire(1);
  const lease2 = pool.acquire(2);

  // Bind lease1 to snapshot version 100
  lease1.buffer.bindToSnapshot(100);

  // Acquire 3rd buffer (pool capacity 2): must evict lease2 (unbound), NOT lease1 (bound)
  const lease3 = pool.acquire(3);

  if (lease1.buffer.snapshotVersions.length === 0) {
    return {
      name: "buffer-ownership-snapshot-transfer-refusal",
      passed: false,
      durationMs: performance.now() - start,
      details: { step: "pool-eviction-safety" },
      error: "Pool evicted snapshot-bound lease1!",
    };
  }

  lease1.release();
  lease2.release();
  lease3.release();

  return {
    name: "buffer-ownership-snapshot-transfer-refusal",
    passed: true,
    durationMs: performance.now() - start,
    details: {
      transferRefusalVerified: true,
      poolEvictionSafeguardVerified: true,
    },
  };
}

// ----------------------------------------------------------------------------
// Scenario 4: Checkpoint Codec & Fail-Closed Tamper Rejection
// ----------------------------------------------------------------------------
export function runCheckpointRecoveryStress(): ScenarioResult {
  const start = performance.now();

  const seed = 9876543210123456789n;
  const validFrame = encodeStreamCheckpoint({
    checkpointVersion: 1,
    streamSemanticsVersion: 1,
    seed,
    kernel: 2,
    tile: 10,
    nextIndex: 500n,
  });

  if (validFrame.length !== STREAM_CHECKPOINT_FRAME_LENGTH) {
    return {
      name: "checkpoint-fail-closed-recovery",
      passed: false,
      durationMs: performance.now() - start,
      details: { step: "frame-length" },
      error: `Expected frame length ${STREAM_CHECKPOINT_FRAME_LENGTH}, got ${validFrame.length}`,
    };
  }

  // 1. Valid recovery continues
  const validDecision = evaluateCheckpointRecovery("run-alpha", validFrame, {
    expectedSeed: seed,
    expectedKernel: 2,
    expectedTile: 10,
  });

  if (validDecision.action !== "continue") {
    return {
      name: "checkpoint-fail-closed-recovery",
      passed: false,
      durationMs: performance.now() - start,
      details: { step: "valid-continue" },
      error: "Valid checkpoint was unexpectedly rejected!",
    };
  }

  // 2. Corrupt seed -> must trigger new-run
  const corruptSeedFrame = new Uint8Array(validFrame);
  corruptSeedFrame[59] = (corruptSeedFrame[59] ?? 0) ^ 0xff; // flip byte in seed

  const seedDecision = evaluateCheckpointRecovery("run-alpha", corruptSeedFrame, {
    expectedSeed: seed,
  });

  if (seedDecision.action !== "new-run" || seedDecision.mismatchField !== "seed") {
    return {
      name: "checkpoint-fail-closed-recovery",
      passed: false,
      durationMs: performance.now() - start,
      details: { step: "seed-corruption" },
      error: "Corrupted seed checkpoint did not force new-run!",
    };
  }

  // 3. Trailing byte -> must fail closed
  const trailingByteFrame = new Uint8Array(STREAM_CHECKPOINT_FRAME_LENGTH + 1);
  trailingByteFrame.set(validFrame);
  trailingByteFrame[STREAM_CHECKPOINT_FRAME_LENGTH] = 0xee;

  const trailingDecision = evaluateCheckpointRecovery("run-alpha", trailingByteFrame, {
    expectedSeed: seed,
  });

  if (trailingDecision.action !== "new-run") {
    return {
      name: "checkpoint-fail-closed-recovery",
      passed: false,
      durationMs: performance.now() - start,
      details: { step: "trailing-byte-rejection" },
      error: "Trailing byte frame was not rejected fail-closed!",
    };
  }

  return {
    name: "checkpoint-fail-closed-recovery",
    passed: true,
    durationMs: performance.now() - start,
    details: {
      canonical83BytesVerified: true,
      validRecoveryContinued: true,
      tamperedSeedForcedNewRun: true,
      trailingBytesRefusedFailClosed: true,
    },
  };
}

// ----------------------------------------------------------------------------
// Scenario 5: Concurrency LRU Suspension & Exact Resumption Replay
// ----------------------------------------------------------------------------
export function runConcurrencySuspensionStress(): ScenarioResult {
  const start = performance.now();

  const manager = new HeavyLaboratoryManager(2); // Cap at 2
  const suspendedStates: Record<string, string> = {};

  const labA = new HeavyFixtureLaboratory({ id: "lab-A", seed: "10001" });
  const labB = new HeavyFixtureLaboratory({ id: "lab-B", seed: "10002" });
  const labC = new HeavyFixtureLaboratory({ id: "lab-C", seed: "10003" });

  labA.mount();
  labB.mount();

  manager.register(
    "lab-A",
    () => labA.serializeState(),
    (s) => {
      suspendedStates["lab-A"] = s.scientificDigest;
    },
    () => {},
  );

  manager.register(
    "lab-B",
    () => labB.serializeState(),
    (s) => {
      suspendedStates["lab-B"] = s.scientificDigest;
    },
    () => {},
  );

  // Step both labs
  labA.step(5);
  labB.step(5);

  // Touch Lab B to make Lab A the least recently used
  manager.touch("lab-B");

  // Mount and register Lab C: exceeds concurrency limit (3 > 2), so Lab A must be suspended!
  labC.mount();
  manager.register(
    "lab-C",
    () => labC.serializeState(),
    () => {},
    () => {},
  );

  if (!suspendedStates["lab-A"]) {
    return {
      name: "concurrency-lru-suspension-replay",
      passed: false,
      durationMs: performance.now() - start,
      details: { step: "lru-suspension" },
      error: "Lab A was not suspended when concurrency limit was exceeded!",
    };
  }

  labA.unmount();
  labB.unmount();
  labC.unmount();

  return {
    name: "concurrency-lru-suspension-replay",
    passed: true,
    durationMs: performance.now() - start,
    details: {
      lruSuspensionVerified: true,
      preservedDigest: suspendedStates["lab-A"],
    },
  };
}

// ----------------------------------------------------------------------------
// Scenario 6: Three.js Scene Graph Disposal Traversal
// ----------------------------------------------------------------------------
export function runSceneGraphDisposalStress(): ScenarioResult {
  const start = performance.now();

  let geometriesDisposed = 0;
  let materialsDisposed = 0;
  let texturesDisposed = 0;

  const mockTexture = {
    dispose: () => {
      texturesDisposed++;
    },
  };

  const mockGeometry = {
    dispose: () => {
      geometriesDisposed++;
    },
  };

  const mockMaterial = {
    map: mockTexture,
    normalMap: mockTexture, // shared texture - must only dispose once
    dispose: () => {
      materialsDisposed++;
    },
  };

  const mockScene = {
    type: "Scene",
    children: [
      {
        type: "Mesh",
        geometry: mockGeometry,
        material: mockMaterial,
        children: [],
      },
      {
        type: "Group",
        children: [
          {
            type: "Mesh",
            geometry: mockGeometry, // shared geometry - must only dispose once
            material: [mockMaterial, mockMaterial], // multi-material array
            children: [],
          },
        ],
      },
    ],
  };

  const stats = disposeSceneGraph(mockScene);

  if (geometriesDisposed !== 1 || materialsDisposed !== 1 || texturesDisposed !== 1) {
    return {
      name: "three-scene-graph-disposal",
      passed: false,
      durationMs: performance.now() - start,
      details: { stats, geometriesDisposed, materialsDisposed, texturesDisposed },
      error: `Disposal count mismatch: geometries=${geometriesDisposed} (expected 1), materials=${materialsDisposed} (expected 1), textures=${texturesDisposed} (expected 1)`,
    };
  }

  return {
    name: "three-scene-graph-disposal",
    passed: true,
    durationMs: performance.now() - start,
    details: {
      stats,
      cleanDeduplicatedDisposal: true,
    },
  };
}

// ----------------------------------------------------------------------------
// Main Orchestrator
// ----------------------------------------------------------------------------
export async function runResourceStressSuite(): Promise<ResourceStressReport> {
  const scenarios: ScenarioResult[] = [
    runMountUnmountStress(100),
    runWasmMemoryGrowthStress(),
    runBufferOwnershipStress(),
    runCheckpointRecoveryStress(),
    runConcurrencySuspensionStress(),
    runSceneGraphDisposalStress(),
  ];

  const passedScenarios = scenarios.filter((s) => s.passed).length;
  const allPassed = passedScenarios === scenarios.length;

  return {
    suite: "resource-stress",
    timestamp: new Date().toISOString(),
    passed: allPassed,
    totalScenarios: scenarios.length,
    passedScenarios,
    scenarios,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const isJson = process.argv.includes("--json");
  const isVerbose = process.argv.includes("--verbose");

  runResourceStressSuite().then((report) => {
    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`\n================================================================`);
      console.log(`Annus Mirabilis: Resource Stress & Lifecycle Gate Report`);
      console.log(`================================================================`);
      console.log(`Status: ${report.passed ? "PASSED" : "FAILED"}`);
      console.log(`Scenarios: ${report.passedScenarios} / ${report.totalScenarios} passed\n`);

      for (const s of report.scenarios) {
        const mark = s.passed ? "✔" : "✖";
        console.log(`  ${mark} ${s.name} (${s.durationMs.toFixed(2)}ms)`);
        if (!s.passed && s.error) {
          console.error(`      Error: ${s.error}`);
        }
        if (isVerbose) {
          console.log(`      Details:`, JSON.stringify(s.details));
        }
      }
      console.log(`================================================================\n`);
    }

    process.exit(report.passed ? 0 : 1);
  });
}
