import { describe, expect, test } from "bun:test";
import {
  closeAll,
  createStackStore,
  EMPTY_STACK_STATE,
  MAX_CLARIFICATION_DEPTH,
  popFrame,
  pushFrame,
  type StackFrame,
  stackDepth,
  topFrame,
  updateOpenFrameDetail,
} from "../reader/stack/stackStore.ts";

function frame(overrides: Partial<StackFrame> = {}): StackFrame {
  return {
    anchor: "brownian-4",
    face: "reading",
    detail: 1,
    perspective: null,
    notation: null,
    unitLayer: null,
    selectionId: null,
    formId: null,
    clarification: { kind: "foundation", id: "mean-variance-rms" },
    title: "Mean, variance and RMS",
    question: "What does the displacement mean square tell us?",
    triggerId: "trigger-1",
    scrollFraction: 0.2,
    lab: null,
    ...overrides,
  };
}

describe("push, pop, close-all", () => {
  test("pushing a frame onto an empty stack grows it to depth 1", () => {
    const { state, replacedDeepest } = pushFrame(EMPTY_STACK_STATE, frame());
    expect(stackDepth(state)).toBe(1);
    expect(replacedDeepest).toBe(false);
    expect(topFrame(state)).toEqual(frame());
  });

  test("popping the only frame returns to the empty stack", () => {
    const { state } = pushFrame(EMPTY_STACK_STATE, frame());
    const popped = popFrame(state);
    expect(stackDepth(popped)).toBe(0);
    expect(topFrame(popped)).toBeUndefined();
  });

  test("popping an already-empty stack is a harmless no-op", () => {
    expect(popFrame(EMPTY_STACK_STATE)).toBe(EMPTY_STACK_STATE);
  });

  test("closeAll clears every frame at once", () => {
    let state = EMPTY_STACK_STATE;
    for (let i = 0; i < 5; i++) state = pushFrame(state, frame({ triggerId: `t${i}` })).state;
    expect(stackDepth(state)).toBe(5);
    const closed = closeAll(state);
    expect(stackDepth(closed)).toBe(0);
  });

  test("closeAll on an empty stack is a harmless no-op", () => {
    expect(closeAll(EMPTY_STACK_STATE)).toBe(EMPTY_STACK_STATE);
  });
});

describe("the depth limit: MAX_CLARIFICATION_DEPTH is 12, shared with navigation/state.ts", () => {
  test("pushing exactly to the limit never replaces", () => {
    let state = EMPTY_STACK_STATE;
    for (let i = 0; i < MAX_CLARIFICATION_DEPTH; i++) {
      const outcome = pushFrame(state, frame({ triggerId: `t${i}` }));
      expect(outcome.replacedDeepest).toBe(false);
      state = outcome.state;
    }
    expect(stackDepth(state)).toBe(MAX_CLARIFICATION_DEPTH);
  });

  test("a push at the limit replaces the deepest frame instead of growing the stack", () => {
    let state = EMPTY_STACK_STATE;
    for (let i = 0; i < MAX_CLARIFICATION_DEPTH; i++) {
      state = pushFrame(state, frame({ triggerId: `t${i}` })).state;
    }
    const outcome = pushFrame(
      state,
      frame({ triggerId: "one-too-many", title: "The replacement" }),
    );
    expect(outcome.replacedDeepest).toBe(true);
    expect(stackDepth(outcome.state)).toBe(MAX_CLARIFICATION_DEPTH);
    expect(topFrame(outcome.state)?.title).toBe("The replacement");
    // Every frame below the deepest is untouched.
    expect(outcome.state.frames[0]?.triggerId).toBe("t0");
    expect(outcome.state.frames[MAX_CLARIFICATION_DEPTH - 2]?.triggerId).toBe(
      `t${MAX_CLARIFICATION_DEPTH - 2}`,
    );
  });
});

describe("updateOpenFrameDetail: the Detail-change contract", () => {
  test("updates only the topmost frame's own recorded Detail, in place", () => {
    let state = pushFrame(EMPTY_STACK_STATE, frame({ detail: 1, triggerId: "outer" })).state;
    state = pushFrame(state, frame({ detail: 1, triggerId: "inner", title: "Inner" })).state;
    const updated = updateOpenFrameDetail(state, 2);
    expect(stackDepth(updated)).toBe(2);
    expect(updated.frames[0]?.detail).toBe(1);
    expect(updated.frames[1]?.detail).toBe(2);
    // The question and opened idea are untouched -- the compass shows the same thing.
    expect(updated.frames[1]?.question).toBe(state.frames[1]?.question);
    expect(updated.frames[1]?.title).toBe(state.frames[1]?.title);
  });

  test("is a no-op when the stack is empty: the root passage's Detail is not a stack concern", () => {
    expect(updateOpenFrameDetail(EMPTY_STACK_STATE, 2)).toBe(EMPTY_STACK_STATE);
  });
});

describe("createStackStore: stable snapshots, subscribe/unsubscribe", () => {
  test("getSnapshot is referentially stable across calls with no mutation", () => {
    const store = createStackStore();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  test("push/pop/closeAll notify subscribers exactly once each and update the snapshot", () => {
    const store = createStackStore();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications++;
    });
    store.push(frame());
    expect(notifications).toBe(1);
    expect(stackDepth(store.getSnapshot())).toBe(1);
    store.pop();
    expect(notifications).toBe(2);
    expect(stackDepth(store.getSnapshot())).toBe(0);
    store.push(frame());
    store.closeAll();
    expect(notifications).toBe(4);
    unsubscribe();
    store.push(frame());
    expect(notifications).toBe(4);
  });

  test("replace swaps the whole stack in one notification", () => {
    const store = createStackStore();
    const target = pushFrame(EMPTY_STACK_STATE, frame()).state;
    let notifications = 0;
    store.subscribe(() => {
      notifications++;
    });
    store.replace(target);
    expect(notifications).toBe(1);
    expect(store.getSnapshot()).toBe(target);
  });
});

describe("immutability", () => {
  test("frames and the stack state are frozen", () => {
    const { state } = pushFrame(EMPTY_STACK_STATE, frame());
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.frames)).toBe(true);
    expect(Object.isFrozen(state.frames[0])).toBe(true);
    expect(Object.isFrozen(state.frames[0]?.clarification)).toBe(true);
  });
});
