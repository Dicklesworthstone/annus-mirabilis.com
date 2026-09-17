/**
 * Annus Mirabilis: Visibility, Background-Tab, and Reduced-Motion Pausing
 *
 * Implements AGENTS.md "Worker behavior, memory, and lifecycle":
 * - Pause laboratories that are not visible (IntersectionObserver, document.visibilityState, pagehide).
 * - Pausing issues no new step requests, lets an in-flight chunk finish and be accepted,
 *   and preserves simulatedTime, stream positions, and the tape.
 * - Resuming continues the exact same run.
 * - With prefers-reduced-motion: reduce, autoplaying animation/stepping pauses while current
 *   state stays visible and manual stepping remains available.
 */

export type PauseReason =
  | "document-hidden"
  | "off-screen"
  | "pagehide"
  | "reduced-motion"
  | "user-pause";

export interface LaboratoryRunState {
  readonly runId: string;
  readonly simulatedTime: number;
  readonly streamIndex: bigint;
  readonly isStepping: boolean;
  readonly tapePosition: number;
}

export interface VisibilityOptions {
  initialDocumentVisible?: boolean;
  initialIntersecting?: boolean;
  initialReducedMotion?: boolean;
  onPauseRequested?: (reason: PauseReason) => void;
  onResumeRequested?: () => void;
}

export class VisibilityCoordinator {
  private _isDocumentVisible: boolean;
  private _isIntersecting: boolean;
  private _isPageHidden: boolean;
  private _prefersReducedMotion: boolean;
  private _isManuallyPaused = false;
  private _onPauseCallbacks = new Set<(reason: PauseReason) => void>();
  private _onResumeCallbacks = new Set<() => void>();

  constructor(options?: VisibilityOptions) {
    this._isDocumentVisible =
      options?.initialDocumentVisible ??
      (typeof document !== "undefined" ? document.visibilityState !== "hidden" : true);
    this._isIntersecting = options?.initialIntersecting ?? true;
    this._isPageHidden = false;
    this._prefersReducedMotion = options?.initialReducedMotion ?? false;

    if (options?.onPauseRequested) {
      this._onPauseCallbacks.add(options.onPauseRequested);
    }
    if (options?.onResumeRequested) {
      this._onResumeCallbacks.add(options.onResumeRequested);
    }
  }

  get isDocumentVisible(): boolean {
    return this._isDocumentVisible;
  }
  get isIntersecting(): boolean {
    return this._isIntersecting;
  }
  get isPageHidden(): boolean {
    return this._isPageHidden;
  }
  get prefersReducedMotion(): boolean {
    return this._prefersReducedMotion;
  }
  get isManuallyPaused(): boolean {
    return this._isManuallyPaused;
  }

  /**
   * Returns true if automatic stepping should be paused.
   */
  get isPaused(): boolean {
    return (
      !this._isDocumentVisible ||
      !this._isIntersecting ||
      this._isPageHidden ||
      this._prefersReducedMotion ||
      this._isManuallyPaused
    );
  }

  get pauseReason(): PauseReason | null {
    if (this._isPageHidden) return "pagehide";
    if (!this._isDocumentVisible) return "document-hidden";
    if (!this._isIntersecting) return "off-screen";
    if (this._prefersReducedMotion) return "reduced-motion";
    if (this._isManuallyPaused) return "user-pause";
    return null;
  }

  /**
   * Whether manual stepping is allowed (e.g. single-step button under reduced-motion).
   */
  get canStepManually(): boolean {
    return this._isDocumentVisible && this._isIntersecting && !this._isPageHidden;
  }

  onPause(callback: (reason: PauseReason) => void): () => void {
    this._onPauseCallbacks.add(callback);
    return () => this._onPauseCallbacks.delete(callback);
  }

  onResume(callback: () => void): () => void {
    this._onResumeCallbacks.add(callback);
    return () => this._onResumeCallbacks.delete(callback);
  }

  setDocumentVisibility(visible: boolean): void {
    const wasPaused = this.isPaused;
    this._isDocumentVisible = visible;
    this.evaluateTransition(wasPaused);
  }

  setIntersection(intersecting: boolean): void {
    const wasPaused = this.isPaused;
    this._isIntersecting = intersecting;
    this.evaluateTransition(wasPaused);
  }

  setPageHide(hidden: boolean): void {
    const wasPaused = this.isPaused;
    this._isPageHidden = hidden;
    this.evaluateTransition(wasPaused);
  }

  setReducedMotion(reduced: boolean): void {
    const wasPaused = this.isPaused;
    this._prefersReducedMotion = reduced;
    this.evaluateTransition(wasPaused);
  }

  setManualPause(paused: boolean): void {
    const wasPaused = this.isPaused;
    this._isManuallyPaused = paused;
    this.evaluateTransition(wasPaused);
  }

  private evaluateTransition(wasPaused: boolean): void {
    const nowPaused = this.isPaused;
    if (!wasPaused && nowPaused) {
      const reason = this.pauseReason ?? "document-hidden";
      for (const cb of this._onPauseCallbacks) {
        cb(reason);
      }
    } else if (wasPaused && !nowPaused) {
      for (const cb of this._onResumeCallbacks) {
        cb();
      }
    }
  }
}
