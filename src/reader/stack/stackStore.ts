/**
 * am-read-return-stack-oxa. The clarification stack: a finite array of frames, each one a
 * complete snapshot of where the reader was when they opened something. This module owns only
 * the frame array (push/pop/close-all/depth-limit-replace/update-open-detail); the base passage
 * state (anchor/face/detail when no frame is open) stays the consuming reader shell's own
 * concern, exactly as it already is in src/reader/navigation/state.ts's ReaderState.
 *
 * MAX_CLARIFICATION_DEPTH is imported, not redefined: src/reader/navigation/state.ts already
 * exports it and this bead does not get to disagree with the existing foundation-only stack
 * about the one number they must share.
 */
import { MAX_CLARIFICATION_DEPTH } from "../navigation/state.ts";

export { MAX_CLARIFICATION_DEPTH };

/** A reference to a mounted or previously-mounted laboratory instance, sufficient to reuse it if
 * still mounted or attempt a validated restore from its last checkpoint if not. Opaque tape
 * bytes, never interpreted by this module -- restoreLab.ts and am-rt-control-tapes-0gc own that. */
export type LabReference = Readonly<{
  instanceId: string;
  experimentId: string;
  modelIdentity: string;
  runId: string;
  checkpointDigest: string;
  compactTape: string;
}>;

export type ClarificationTarget = Readonly<{ kind: string; id: string }>;

/** One frame: the complete state needed to render what the reader saw, and to return to it. */
export type StackFrame = Readonly<{
  anchor: string;
  face: string;
  detail: number;
  perspective: string | null;
  notation: string | null;
  unitLayer: string | null;
  selectionId: string | null;
  formId: string | null;
  clarification: ClarificationTarget;
  /** The idea just opened, in words -- the clarification kind's own title(parsedId), computed
   * once by openClarification and carried on the frame so the compass never re-resolves the kind
   * registry (or repeats a stale parse) just to render text. */
  title: string;
  question: string;
  /** DOM id of the control that opened this frame, for focus return. Empty string if the frame
   * was opened by a direct link rather than a click (there is no origin control to return to). */
  triggerId: string;
  /** Scroll offset of the trigger relative to the anchor, as a fraction of viewport height. */
  scrollFraction: number;
  lab: LabReference | null;
}>;

export type StackState = Readonly<{ frames: readonly StackFrame[] }>;

export const EMPTY_STACK_STATE: StackState = Object.freeze({ frames: Object.freeze([]) });

export type PushOutcome = Readonly<{ state: StackState; replacedDeepest: boolean }>;

function freezeFrame(frame: StackFrame): StackFrame {
  return Object.freeze({ ...frame, clarification: Object.freeze({ ...frame.clarification }) });
}

/** Pushes a frame. At MAX_CLARIFICATION_DEPTH, replaces the deepest frame instead of growing the
 * stack; the caller uses `replacedDeepest` to decide whether to push or replace the history
 * entry (a replace is never a new history entry, per this bead's Depth limit requirement). */
export function pushFrame(state: StackState, frame: StackFrame): PushOutcome {
  const frames = [...state.frames];
  const replacedDeepest = frames.length >= MAX_CLARIFICATION_DEPTH;
  const sealed = freezeFrame(frame);
  if (replacedDeepest) frames[MAX_CLARIFICATION_DEPTH - 1] = sealed;
  else frames.push(sealed);
  return { state: Object.freeze({ frames: Object.freeze(frames) }), replacedDeepest };
}

/** Pops the deepest frame. A no-op on an already-empty stack, never a throw: popping past the
 * root is a reachable, harmless state during rapid back-button use. */
export function popFrame(state: StackState): StackState {
  if (!state.frames.length) return state;
  return Object.freeze({ frames: Object.freeze(state.frames.slice(0, -1)) });
}

/** Clears every frame, returning to the root passage. */
export function closeAll(state: StackState): StackState {
  if (!state.frames.length) return state;
  return EMPTY_STACK_STATE;
}

/** A Detail change while a frame is open updates that frame's own recorded Detail in place. It
 * never pushes a frame, never pops one, and (by not touching `clarification` or `question`)
 * never changes what the compass shows. A no-op when the stack is empty: the root passage's
 * Detail is the consuming reader shell's own state, not a stack concern. */
export function updateOpenFrameDetail(state: StackState, detail: number): StackState {
  if (!state.frames.length) return state;
  const frames = [...state.frames];
  const top = frames[frames.length - 1];
  if (!top) return state;
  frames[frames.length - 1] = freezeFrame({ ...top, detail });
  return Object.freeze({ frames: Object.freeze(frames) });
}

export function topFrame(state: StackState): StackFrame | undefined {
  return state.frames.at(-1);
}

export function stackDepth(state: StackState): number {
  return state.frames.length;
}

/**
 * A minimal external store (subscribe/getSnapshot, the same shape instanceStore.ts and
 * useSyncExternalStore expect) over a StackState. Kept separate from React so stackStore.test.ts
 * exercises it with no DOM.
 */
export function createStackStore(initial: StackState = EMPTY_STACK_STATE) {
  let state = initial;
  const listeners = new Set<() => void>();
  function emit(next: StackState): void {
    state = next;
    for (const listener of [...listeners]) listener();
  }
  return Object.freeze({
    getSnapshot: (): StackState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    push(frame: StackFrame): PushOutcome {
      const outcome = pushFrame(state, frame);
      emit(outcome.state);
      return outcome;
    },
    pop(): void {
      emit(popFrame(state));
    },
    closeAll(): void {
      emit(closeAll(state));
    },
    updateOpenDetail(detail: number): void {
      emit(updateOpenFrameDetail(state, detail));
    },
    /** Replaces the whole stack, e.g. when history navigation restores a serialized state. Never
     * partially applied: a caller that wants one mutation uses push/pop/closeAll instead. */
    replace(next: StackState): void {
      emit(next);
    },
  });
}

export type StackStore = ReturnType<typeof createStackStore>;
