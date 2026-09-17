/**
 * Pointer Cancellation Controller Bun Test Suite.
 *
 * Spec: AGENTS.md §10.1 and am-a11y-baseline-1cg5
 */

import { describe, expect, it } from "bun:test";
import { createPointerCommitController, isPointInsideRect, type Rect } from "../../a11y/pointer.ts";

describe("Pointer Cancellation Controller (am-a11y-baseline-1cg5)", () => {
  const targetBounds: Rect = {
    left: 50,
    top: 50,
    right: 150,
    bottom: 90,
    width: 100,
    height: 40,
  };

  it("checks point inside bounding box correctly", () => {
    expect(isPointInsideRect({ x: 100, y: 70 }, targetBounds)).toBe(true);
    expect(isPointInsideRect({ x: 49, y: 70 }, targetBounds)).toBe(false);
    expect(isPointInsideRect({ x: 100, y: 95 }, targetBounds)).toBe(false);
  });

  it("commits action when pointerup occurs inside target bounds", () => {
    let committed = false;
    let committedPayload: string | undefined;

    const controller = createPointerCommitController<string>({
      getBounds: () => targetBounds,
      onCommit: (payload) => {
        committed = true;
        committedPayload = payload;
      },
    });

    expect(controller.isPending()).toBe(false);

    controller.handlePointerDown({ clientX: 60, clientY: 60 });
    expect(controller.isPending()).toBe(true);
    expect(committed).toBe(false);

    const success = controller.handlePointerUp({ clientX: 70, clientY: 65 }, "action-payload");
    expect(success).toBe(true);
    expect(committed).toBe(true);
    expect(committedPayload).toBe("action-payload");
    expect(controller.isPending()).toBe(false);
  });

  it("aborts without committing when pointerup occurs outside target bounds", () => {
    let committed = false;
    let cancelled = false;

    const controller = createPointerCommitController({
      getBounds: () => targetBounds,
      onCommit: () => {
        committed = true;
      },
      onCancel: () => {
        cancelled = true;
      },
    });

    controller.handlePointerDown({ clientX: 60, clientY: 60 });
    expect(controller.isPending()).toBe(true);

    // Release at (200, 200) outside targetBounds
    const success = controller.handlePointerUp({ clientX: 200, clientY: 200 });
    expect(success).toBe(false);
    expect(committed).toBe(false);
    expect(cancelled).toBe(true);
    expect(controller.isPending()).toBe(false);
  });

  it("aborts immediately upon receiving pointercancel event", () => {
    let committed = false;
    let cancelled = false;

    const controller = createPointerCommitController({
      getBounds: () => targetBounds,
      onCommit: () => {
        committed = true;
      },
      onCancel: () => {
        cancelled = true;
      },
    });

    controller.handlePointerDown({ clientX: 60, clientY: 60 });
    expect(controller.isPending()).toBe(true);

    controller.handlePointerCancel();
    expect(controller.isPending()).toBe(false);
    expect(cancelled).toBe(true);
    expect(committed).toBe(false);

    // Subsequent pointerup does nothing
    const success = controller.handlePointerUp({ clientX: 60, clientY: 60 });
    expect(success).toBe(false);
    expect(committed).toBe(false);
  });
});
