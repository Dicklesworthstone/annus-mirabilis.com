/**
 * Annus Mirabilis: Heavy Laboratory Concurrency and LRU Suspension
 *
 * Implements AGENTS.md "Worker behavior, memory, and lifecycle":
 * - Exceeding the heavy-laboratory limit suspends the least recently used laboratory.
 * - Suspended laboratory preserves replayable state (seed, stream positions, tape, checkpoint).
 * - Resumed scientific digest equals the digest it would have had without suspension.
 */

import { detectDeviceConcurrencyLimit } from "./limits.ts";

export interface ReplayableLabState {
  readonly laboratoryId: string;
  readonly runId: string;
  readonly seed: string;
  readonly simulatedTime: number;
  readonly streamIndex: bigint;
  readonly scientificDigest: string;
  readonly checkpointBytes?: Uint8Array;
}

export interface ManagedLaboratory {
  readonly id: string;
  lastUsedAt: number;
  isSuspended: boolean;
  savedState: ReplayableLabState | null;
  serializeState: () => ReplayableLabState;
  onSuspend: (state: ReplayableLabState) => void;
  onResume: (state: ReplayableLabState) => void;
}

export class HeavyLaboratoryManager {
  readonly maxConcurrent: number;
  private readonly _labs = new Map<string, ManagedLaboratory>();

  constructor(maxConcurrent?: number) {
    this.maxConcurrent = maxConcurrent ?? detectDeviceConcurrencyLimit().maxConcurrentHeavyLabs;
  }

  get activeCount(): number {
    let count = 0;
    for (const lab of this._labs.values()) {
      if (!lab.isSuspended) count++;
    }
    return count;
  }

  get suspendedCount(): number {
    let count = 0;
    for (const lab of this._labs.values()) {
      if (lab.isSuspended) count++;
    }
    return count;
  }

  register(
    id: string,
    serializeState: () => ReplayableLabState,
    onSuspend: (state: ReplayableLabState) => void,
    onResume: (state: ReplayableLabState) => void,
  ): void {
    const lab: ManagedLaboratory = {
      id,
      lastUsedAt: Date.now(),
      isSuspended: false,
      savedState: null,
      serializeState,
      onSuspend,
      onResume,
    };
    this._labs.set(id, lab);
    this.enforceConcurrency(id);
  }

  unregister(id: string): void {
    this._labs.delete(id);
  }

  touch(id: string): void {
    const lab = this._labs.get(id);
    if (lab) {
      lab.lastUsedAt = Date.now();
      if (lab.isSuspended) {
        this.resume(id);
      } else {
        this.enforceConcurrency(id);
      }
    }
  }

  resume(id: string): void {
    const lab = this._labs.get(id);
    if (!lab || !lab.isSuspended) return;

    this.enforceConcurrency(id);
    lab.isSuspended = false;
    lab.lastUsedAt = Date.now();
    if (lab.savedState) {
      const stateToResume = lab.savedState;
      lab.savedState = null;
      lab.onResume(stateToResume);
    }
  }

  private enforceConcurrency(protectedId: string): void {
    // Collect active labs
    const activeLabs: ManagedLaboratory[] = [];
    for (const lab of this._labs.values()) {
      if (!lab.isSuspended) {
        activeLabs.push(lab);
      }
    }

    if (activeLabs.length <= this.maxConcurrent) return;

    // Need to suspend excess labs by least recently used, protecting protectedId
    activeLabs.sort((a, b) => a.lastUsedAt - b.lastUsedAt);

    for (const candidate of activeLabs) {
      if (activeLabs.length - this.suspendedCount <= this.maxConcurrent) break;
      if (candidate.id === protectedId) continue;

      // Suspend candidate
      candidate.isSuspended = true;
      candidate.savedState = candidate.serializeState();
      candidate.onSuspend(candidate.savedState);
    }
  }
}
