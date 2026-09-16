/**
 * Announcement Manager for Graph Descriptions (am-a11y-graph-descriptions-vxe1).
 *
 * Rules:
 * 1. Emits polite announcements only on commits (pointer/key release, explicit apply) or explicit "Describe now" requests.
 * 2. At most one automatic announcement per committed action.
 * 3. Automatic announcements are spaced at least 1 second apart (1000 ms), with a newer committed summary replacing a queued older one.
 * 4. Suppressed while an animation runs (0 automatic announcements during continuous 60 Hz simulation).
 * 5. "Describe now" bypasses rate limits and animation suppression, reading layer two immediately on demand.
 * 6. Presentation changes (e.g. RepresentationScale changes) update rendered facts without emitting automatic scientific announcements.
 * 7. Supports host-fed clocks for deterministic testing.
 */

import { announce } from "../announce.ts";

export interface AnnouncementManagerOptions {
  /** Clock provider returning timestamps in milliseconds (default: Date.now). */
  readonly clock?: (() => number) | undefined;
  /** Custom announce dispatch function (default: shared announce). */
  readonly onAnnounce?: ((message: string) => void) | undefined;
  /** Minimum spacing between automatic announcements in ms (default: 1000). */
  readonly throttleIntervalMs?: number | undefined;
}

export class AnnouncementManager {
  private readonly clock: () => number;
  private readonly dispatch: (message: string) => void;
  private readonly throttleIntervalMs: number;

  private isAnimating = false;
  private lastAnnounceTime = 0;
  private pendingCommitSummary: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: AnnouncementManagerOptions = {}) {
    this.clock = options.clock ?? (() => Date.now());
    this.dispatch = options.onAnnounce ?? ((msg) => announce(msg));
    this.throttleIntervalMs = options.throttleIntervalMs ?? 1000;
  }

  /**
   * Updates whether an animation/simulation is currently actively running.
   * When running, automatic announcements from frame updates or continuous motion are suppressed.
   */
  public setAnimating(running: boolean): void {
    this.isAnimating = running;
    if (running && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.pendingCommitSummary = null;
    }
  }

  public getAnimating(): boolean {
    return this.isAnimating;
  }

  /**
   * Emits an automatic announcement for a committed user action (e.g. slider release, preset selection).
   * If an animation is actively running, the automatic announcement is suppressed.
   * Otherwise, rate limited to 1 second spacing; newer committed text replaces queued older text.
   */
  public emitCommitAnnouncement(summary: string): void {
    if (!summary || summary.trim().length === 0) return;

    // Suppress automatic announcements while animation is actively running
    if (this.isAnimating) {
      return;
    }

    const now = this.clock();
    const elapsed = now - this.lastAnnounceTime;

    if (elapsed >= this.throttleIntervalMs && !this.timer) {
      this.lastAnnounceTime = now;
      this.dispatch(summary);
    } else {
      // Replace any queued older summary with this newest committed summary
      this.pendingCommitSummary = summary;

      if (!this.timer) {
        const remainingDelay = Math.max(0, this.throttleIntervalMs - elapsed);
        this.timer = setTimeout(() => {
          this.timer = null;
          if (this.pendingCommitSummary && !this.isAnimating) {
            this.lastAnnounceTime = this.clock();
            const textToAnnounce = this.pendingCommitSummary;
            this.pendingCommitSummary = null;
            this.dispatch(textToAnnounce);
          }
        }, remainingDelay);
      }
    }
  }

  /**
   * "Describe now" action: bypasses rate limiting and animation suppression,
   * announcing the layer-two description immediately on demand.
   */
  public describeNow(layer2Text: string): void {
    if (!layer2Text || layer2Text.trim().length === 0) return;

    // Clear any pending queued commit announcement since user requested immediate readout
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.pendingCommitSummary = null;
    }

    this.lastAnnounceTime = this.clock();
    this.dispatch(layer2Text);
  }

  /**
   * Handles a presentation-level change (such as a scale or zoom change).
   * Updates rendered facts without emitting an automatic scientific announcement.
   */
  public handlePresentationChange(): void {
    // Presentation changes deliberately do NOT emit automatic announcements
  }

  /**
   * Cleans up any active timer resources.
   */
  public dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingCommitSummary = null;
  }
}
