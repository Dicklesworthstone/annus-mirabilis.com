/**
 * Annus Mirabilis: Lifecycle Diagnostics Registry
 *
 * Implements AGENTS.md "Worker behavior, memory, and lifecycle":
 * - Tracks live workers, WebGL contexts, event listeners, animation frame handles,
 *   observers, buffer allocations, and suspended laboratories.
 * - Used in test suites and resource-stress scripts to assert that repeated
 *   mount/unmount and route transitions leave all counters at baseline with zero leaks.
 */

export interface LifecycleCounters {
  readonly liveWorkers: number;
  readonly activeWebGLContexts: number;
  readonly createdWebGLContexts: number;
  readonly lostWebGLContexts: number;
  readonly disposedWebGLContexts: number;
  readonly trackedListeners: number;
  readonly animationFrames: number;
  readonly activeObservers: number;
  readonly liveBufferBytes: number;
  readonly pooledBufferBytes: number;
  readonly suspendedLaboratories: number;
}

class DiagnosticsRegistry {
  private _liveWorkers = 0;
  private _activeWebGLContexts = 0;
  private _createdWebGLContexts = 0;
  private _lostWebGLContexts = 0;
  private _disposedWebGLContexts = 0;
  private _trackedListeners = 0;
  private _animationFrames = 0;
  private _activeObservers = 0;
  private _liveBufferBytes = 0;
  private _pooledBufferBytes = 0;
  private _suspendedLaboratories = 0;

  get liveWorkers(): number {
    return this._liveWorkers;
  }
  get activeWebGLContexts(): number {
    return this._activeWebGLContexts;
  }
  get createdWebGLContexts(): number {
    return this._createdWebGLContexts;
  }
  get lostWebGLContexts(): number {
    return this._lostWebGLContexts;
  }
  get disposedWebGLContexts(): number {
    return this._disposedWebGLContexts;
  }
  get trackedListeners(): number {
    return this._trackedListeners;
  }
  get animationFrames(): number {
    return this._animationFrames;
  }
  get activeObservers(): number {
    return this._activeObservers;
  }
  get liveBufferBytes(): number {
    return this._liveBufferBytes;
  }
  get pooledBufferBytes(): number {
    return this._pooledBufferBytes;
  }
  get suspendedLaboratories(): number {
    return this._suspendedLaboratories;
  }

  trackWorker(): () => void {
    this._liveWorkers++;
    let untracked = false;
    return () => {
      if (!untracked) {
        untracked = true;
        this._liveWorkers = Math.max(0, this._liveWorkers - 1);
      }
    };
  }

  trackWebGLContext(): { onLost: () => void; onDisposed: () => void } {
    this._createdWebGLContexts++;
    this._activeWebGLContexts++;
    let disposed = false;
    let lost = false;
    return {
      onLost: () => {
        if (!lost) {
          lost = true;
          this._lostWebGLContexts++;
        }
      },
      onDisposed: () => {
        if (!disposed) {
          disposed = true;
          this._disposedWebGLContexts++;
          this._activeWebGLContexts = Math.max(0, this._activeWebGLContexts - 1);
        }
      },
    };
  }

  trackListener(): () => void {
    this._trackedListeners++;
    let untracked = false;
    return () => {
      if (!untracked) {
        untracked = true;
        this._trackedListeners = Math.max(0, this._trackedListeners - 1);
      }
    };
  }

  trackAnimationFrame(): () => void {
    this._animationFrames++;
    let cancelled = false;
    return () => {
      if (!cancelled) {
        cancelled = true;
        this._animationFrames = Math.max(0, this._animationFrames - 1);
      }
    };
  }

  trackObserver(): () => void {
    this._activeObservers++;
    let untracked = false;
    return () => {
      if (!untracked) {
        untracked = true;
        this._activeObservers = Math.max(0, this._activeObservers - 1);
      }
    };
  }

  addLiveBufferBytes(bytes: number): () => void {
    this._liveBufferBytes += bytes;
    let freed = false;
    return () => {
      if (!freed) {
        freed = true;
        this._liveBufferBytes = Math.max(0, this._liveBufferBytes - bytes);
      }
    };
  }

  setPooledBufferBytes(bytes: number): void {
    this._pooledBufferBytes = Math.max(0, bytes);
  }

  trackSuspendedLaboratory(): () => void {
    this._suspendedLaboratories++;
    let resumed = false;
    return () => {
      if (!resumed) {
        resumed = true;
        this._suspendedLaboratories = Math.max(0, this._suspendedLaboratories - 1);
      }
    };
  }

  snapshot(): LifecycleCounters {
    return {
      liveWorkers: this._liveWorkers,
      activeWebGLContexts: this._activeWebGLContexts,
      createdWebGLContexts: this._createdWebGLContexts,
      lostWebGLContexts: this._lostWebGLContexts,
      disposedWebGLContexts: this._disposedWebGLContexts,
      trackedListeners: this._trackedListeners,
      animationFrames: this._animationFrames,
      activeObservers: this._activeObservers,
      liveBufferBytes: this._liveBufferBytes,
      pooledBufferBytes: this._pooledBufferBytes,
      suspendedLaboratories: this._suspendedLaboratories,
    };
  }

  reset(): void {
    this._liveWorkers = 0;
    this._activeWebGLContexts = 0;
    this._createdWebGLContexts = 0;
    this._lostWebGLContexts = 0;
    this._disposedWebGLContexts = 0;
    this._trackedListeners = 0;
    this._animationFrames = 0;
    this._activeObservers = 0;
    this._liveBufferBytes = 0;
    this._pooledBufferBytes = 0;
    this._suspendedLaboratories = 0;
  }

  assertBaseline(baseline?: Partial<LifecycleCounters>): void {
    const current = this.snapshot();
    const expected = {
      liveWorkers: 0,
      activeWebGLContexts: 0,
      trackedListeners: 0,
      animationFrames: 0,
      activeObservers: 0,
      liveBufferBytes: 0,
      ...baseline,
    };

    const leaks: string[] = [];
    if (current.liveWorkers !== expected.liveWorkers) {
      leaks.push(
        `liveWorkers leaked: expected ${expected.liveWorkers}, got ${current.liveWorkers}`,
      );
    }
    if (current.activeWebGLContexts !== expected.activeWebGLContexts) {
      leaks.push(
        `activeWebGLContexts leaked: expected ${expected.activeWebGLContexts}, got ${current.activeWebGLContexts}`,
      );
    }
    if (current.trackedListeners !== expected.trackedListeners) {
      leaks.push(
        `trackedListeners leaked: expected ${expected.trackedListeners}, got ${current.trackedListeners}`,
      );
    }
    if (current.animationFrames !== expected.animationFrames) {
      leaks.push(
        `animationFrames leaked: expected ${expected.animationFrames}, got ${current.animationFrames}`,
      );
    }
    if (current.activeObservers !== expected.activeObservers) {
      leaks.push(
        `activeObservers leaked: expected ${expected.activeObservers}, got ${current.activeObservers}`,
      );
    }
    if (current.liveBufferBytes !== expected.liveBufferBytes) {
      leaks.push(
        `liveBufferBytes leaked: expected ${expected.liveBufferBytes}, got ${current.liveBufferBytes}`,
      );
    }

    if (leaks.length > 0) {
      throw new Error(`Lifecycle baseline assertion failed:\n  ${leaks.join("\n  ")}`);
    }
  }
}

export const lifecycleDiagnostics = new DiagnosticsRegistry();
