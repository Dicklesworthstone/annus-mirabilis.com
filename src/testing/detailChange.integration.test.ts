import { describe, expect, it } from "bun:test";
import {
  createStackStore,
  EMPTY_STACK_STATE,
  type StackFrame,
  updateOpenFrameDetail,
} from "../reader/stack/stackStore.ts";

function mockFrame(overrides: Partial<StackFrame> = {}): StackFrame {
  return {
    anchor: "ap-17-549-p1",
    face: "reading",
    detail: 1,
    perspective: null,
    notation: null,
    unitLayer: null,
    selectionId: null,
    formId: null,
    clarification: { kind: "instrument-view", id: "bm-01" },
    title: "Osmotic pressure and Brownian motion",
    question: "How does osmotic pressure relate to particle motion?",
    triggerId: "trigger-detail-1",
    scrollFraction: 0.25,
    lab: null,
    ...overrides,
  };
}

describe("detailChange.integration (am-read-return-stack-oxa)", () => {
  it("Detail change on open frame leaves depth, question, and title intact while updating detail", () => {
    const store = createStackStore();
    store.push(mockFrame({ detail: 1 }));

    const initialSnapshot = store.getSnapshot();
    expect(initialSnapshot.frames.length).toBe(1);
    expect(initialSnapshot.frames[0]?.detail).toBe(1);

    store.updateOpenDetail(2);

    const updatedSnapshot = store.getSnapshot();
    expect(updatedSnapshot.frames.length).toBe(1);
    expect(updatedSnapshot.frames[0]?.detail).toBe(2);
    expect(updatedSnapshot.frames[0]?.question).toBe(initialSnapshot.frames[0]?.question);
    expect(updatedSnapshot.frames[0]?.title).toBe(initialSnapshot.frames[0]?.title);
    expect(updatedSnapshot.frames[0]?.clarification).toEqual(
      initialSnapshot.frames[0]?.clarification,
    );
  });

  it("Detail change on nested stack modifies only the topmost frame", () => {
    const store = createStackStore();
    store.push(mockFrame({ detail: 1, title: "Outer Frame" }));
    store.push(mockFrame({ detail: 1, title: "Inner Frame" }));

    expect(store.getSnapshot().frames.length).toBe(2);

    store.updateOpenDetail(3);

    const snapshot = store.getSnapshot();
    expect(snapshot.frames.length).toBe(2);
    expect(snapshot.frames[0]?.detail).toBe(1);
    expect(snapshot.frames[0]?.title).toBe("Outer Frame");
    expect(snapshot.frames[1]?.detail).toBe(3);
    expect(snapshot.frames[1]?.title).toBe("Inner Frame");
  });

  it("Detail change on empty stack is a harmless no-op", () => {
    const res = updateOpenFrameDetail(EMPTY_STACK_STATE, 3);
    expect(res).toBe(EMPTY_STACK_STATE);
  });
});
