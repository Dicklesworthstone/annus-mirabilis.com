/**
 * Pointer cancellation and commit-on-release controller (am-a11y-baseline-1cg5).
 *
 * Implements WCAG 2.2 Success Criterion 2.5.2 (Pointer Cancellation):
 * - Down-Event: No irreversible or state-committing action occurs on pointerdown.
 * - Up-Event / Up-Reversal: Commits action only when pointerup occurs within the target bounds.
 * - Abort / Cancel: pointercancel or releasing outside bounds aborts the action without committing.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface PointerCommitOptions<T = void> {
  readonly onCommit: (payload?: T) => void;
  readonly onCancel?: () => void;
  readonly onPendingChange?: (isPending: boolean) => void;
  readonly getBounds?: () => Rect | DOMRect | null;
  readonly hitTest?: (point: Point) => boolean;
}

export function isPointInsideRect(point: Point, rect: Rect | DOMRect): boolean {
  return (
    point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  );
}

export interface PointerCommitController<T = void> {
  readonly isPending: () => boolean;
  readonly handlePointerDown: (event: {
    clientX: number;
    clientY: number;
    pointerId?: number;
    target?: EventTarget | null | undefined;
  }) => void;
  readonly handlePointerMove: (event: { clientX: number; clientY: number }) => void;
  readonly handlePointerUp: (event: { clientX: number; clientY: number }, payload?: T) => boolean;
  readonly handlePointerCancel: () => void;
  readonly reset: () => void;
}

/**
 * Creates a pointer commit controller ensuring actions commit ONLY on valid release.
 */
export function createPointerCommitController<T = void>(
  options: PointerCommitOptions<T>,
): PointerCommitController<T> {
  let pending = false;
  let _startPoint: Point | null = null;

  const setPending = (val: boolean) => {
    if (pending !== val) {
      pending = val;
      options.onPendingChange?.(val);
    }
  };

  const isPointInTarget = (point: Point): boolean => {
    if (options.hitTest) {
      return options.hitTest(point);
    }
    if (options.getBounds) {
      const bounds = options.getBounds();
      if (bounds) {
        return isPointInsideRect(point, bounds);
      }
    }
    return true; // If no bounds checker provided, default to true
  };

  return {
    isPending: () => pending,

    handlePointerDown: (event) => {
      _startPoint = { x: event.clientX, y: event.clientY };
      setPending(true);
    },

    handlePointerMove: (_event) => {
      // Retain pending state while moving
    },

    handlePointerUp: (event, payload) => {
      if (!pending) return false;
      setPending(false);

      const endPoint: Point = { x: event.clientX, y: event.clientY };
      const isInside = isPointInTarget(endPoint);

      if (isInside) {
        options.onCommit(payload);
        return true;
      } else {
        options.onCancel?.();
        return false;
      }
    },

    handlePointerCancel: () => {
      if (!pending) return;
      setPending(false);
      _startPoint = null;
      options.onCancel?.();
    },

    reset: () => {
      setPending(false);
      _startPoint = null;
    },
  };
}
