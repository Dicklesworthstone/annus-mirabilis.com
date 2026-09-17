/**
 * Annus Mirabilis: Heavy Laboratory Runtime Fixture
 *
 * Simulates a heavy stepping laboratory (particle buffers, mock workers, mock WebGL contexts,
 * event listeners, animation frames, observers) used to stress-test mount/unmount lifecycle,
 * memory growth, buffer ownership, and concurrency suspension.
 */

import { lifecycleDiagnostics } from "../../experiments/lifecycle/diagnostics.ts";
import type { ReplayableLabState } from "../../experiments/lifecycle/concurrency.ts";
import { OwnedBuffer } from "../../experiments/memory/buffers.ts";
import { createPhiloxStream } from "../../physics/reference/philox.ts";

export interface HeavyFixtureOptions {
  readonly id?: string;
  readonly seed?: string;
  readonly particleCount?: number;
}

export class HeavyFixtureLaboratory {
  readonly id: string;
  readonly seed: string;
  readonly particleCount: number;
  private _simulatedTime = 0;
  private _stepCount = 0;
  private _isMounted = false;
  private _cleanups: (() => void)[] = [];
  private _particlePositions: OwnedBuffer<Float64Array> | null = null;
  private _philoxStream: ReturnType<typeof createPhiloxStream>;

  constructor(options?: HeavyFixtureOptions) {
    this.id = options?.id ?? `heavy-fixture-${Math.random().toString(36).slice(2, 8)}`;
    this.seed = options?.seed ?? "137035999";
    this.particleCount = options?.particleCount ?? 1000;
    this._philoxStream = createPhiloxStream({ seed: this.seed, kernel: 0, tile: 0 });
  }

  get isMounted(): boolean {
    return this._isMounted;
  }
  get simulatedTime(): number {
    return this._simulatedTime;
  }
  get stepCount(): number {
    return this._stepCount;
  }
  get positions(): OwnedBuffer<Float64Array> | null {
    return this._particlePositions;
  }
  get streamIndex(): bigint {
    return this._philoxStream.index;
  }

  mount(): void {
    if (this._isMounted) return;
    this._isMounted = true;

    // 1. Track worker
    const untrackWorker = lifecycleDiagnostics.trackWorker();
    this._cleanups.push(untrackWorker);

    // 2. Track WebGL context
    const ctx = lifecycleDiagnostics.trackWebGLContext();
    this._cleanups.push(() => ctx.onDisposed());

    // 3. Track resize & visibility listeners
    const untrackListener1 = lifecycleDiagnostics.trackListener();
    const untrackListener2 = lifecycleDiagnostics.trackListener();
    this._cleanups.push(untrackListener1, untrackListener2);

    // 4. Track animation frame
    const untrackRaf = lifecycleDiagnostics.trackAnimationFrame();
    this._cleanups.push(untrackRaf);

    // 5. Track intersection observer
    const untrackObs = lifecycleDiagnostics.trackObserver();
    this._cleanups.push(untrackObs);

    // 6. Allocate particle positions buffer
    const bufSize = this.particleCount * 3; // x, y, z
    const rawArray = new Float64Array(bufSize);
    this._particlePositions = new OwnedBuffer(rawArray, { label: `${this.id}-particles` });
    this._particlePositions.addRef("fixture-mount");

    const untrackBytes = lifecycleDiagnostics.addLiveBufferBytes(bufSize * 8);
    this._cleanups.push(() => {
      if (this._particlePositions) {
        this._particlePositions.releaseRef("fixture-mount");
      }
      untrackBytes();
    });
  }

  step(steps = 1): void {
    if (!this._isMounted || !this._particlePositions) {
      throw new Error("Cannot step unmounted laboratory.");
    }
    for (let s = 0; s < steps; s++) {
      this._stepCount++;
      this._simulatedTime += 0.01;
      const buf = this._particlePositions.buffer;
      for (let i = 0; i < this.particleCount; i++) {
        // Step each particle with stream
        const dx = this._philoxStream.nextNormal() * 0.1;
        buf[i * 3] = (buf[i * 3] ?? 0) + dx;
      }
    }
  }

  serializeState(): ReplayableLabState {
    let digest = `lab-${this.id}-step-${this._stepCount}-time-${this._simulatedTime.toFixed(4)}`;
    if (this._particlePositions) {
      const buf = this._particlePositions.buffer;
      let sum = 0;
      for (let i = 0; i < Math.min(100, buf.length); i++) {
        sum += buf[i] ?? 0;
      }
      digest += `-sum-${sum.toFixed(6)}`;
    }
    return {
      laboratoryId: this.id,
      runId: `run-${this.id}`,
      seed: this.seed,
      simulatedTime: this._simulatedTime,
      streamIndex: this._philoxStream.index,
      scientificDigest: digest,
    };
  }

  unmount(): void {
    if (!this._isMounted) return;
    this._isMounted = false;

    for (const cleanup of this._cleanups) {
      cleanup();
    }
    this._cleanups = [];
    this._particlePositions = null;
  }
}
