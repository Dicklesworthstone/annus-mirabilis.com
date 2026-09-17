import { describe, expect, test } from "bun:test";
import {
  handleStepKeyDown,
  parseDerivationStepParam,
} from "./stepFocus.ts";

describe("am-eq-derivation-renderer-9gd7: stepFocus and keyboard navigation", () => {
  test("ArrowDown moves focus to next step", () => {
    let focusedIndex = 0;
    const handled = handleStepKeyDown(
      { key: "ArrowDown", preventDefault: () => {} } as any,
      0,
      5,
      {
        onFocusStep: (idx) => {
          focusedIndex = idx;
        },
        onToggleExpand: () => {},
        onExitFocusMode: () => {},
      },
    );

    expect(handled).toBe(true);
    expect(focusedIndex).toBe(1);
  });

  test("ArrowUp moves focus to previous step bounded at zero", () => {
    let focusedIndex = 2;
    const handled = handleStepKeyDown(
      { key: "ArrowUp", preventDefault: () => {} } as any,
      2,
      5,
      {
        onFocusStep: (idx) => {
          focusedIndex = idx;
        },
        onToggleExpand: () => {},
        onExitFocusMode: () => {},
      },
    );

    expect(handled).toBe(true);
    expect(focusedIndex).toBe(1);
  });

  test("Enter triggers toggle expand callback", () => {
    let expandedIndex = -1;
    const handled = handleStepKeyDown(
      { key: "Enter", preventDefault: () => {} } as any,
      3,
      5,
      {
        onFocusStep: () => {},
        onToggleExpand: (idx) => {
          expandedIndex = idx;
        },
        onExitFocusMode: () => {},
      },
    );

    expect(handled).toBe(true);
    expect(expandedIndex).toBe(3);
  });

  test("Escape triggers exit focus mode", () => {
    let exited = false;
    const handled = handleStepKeyDown(
      { key: "Escape", preventDefault: () => {} } as any,
      2,
      5,
      {
        onFocusStep: () => {},
        onToggleExpand: () => {},
        onExitFocusMode: () => {
          exited = true;
        },
      },
    );

    expect(handled).toBe(true);
    expect(exited).toBe(true);
  });

  test("Unrelated keys return false and are inert", () => {
    const handled = handleStepKeyDown(
      { key: "Tab", preventDefault: () => {} } as any,
      1,
      5,
      {
        onFocusStep: () => {},
        onToggleExpand: () => {},
        onExitFocusMode: () => {},
      },
    );

    expect(handled).toBe(false);
  });

  test("parseDerivationStepParam correctly parses valid target params", () => {
    const res1 = parseDerivationStepParam("derivation-step:chain-bm-variance/bm-ped-step-1");
    expect(res1).not.toBeNull();
    expect(res1?.chainId).toBe("chain-bm-variance");
    expect(res1?.stepId).toBe("bm-ped-step-1");

    const res2 = parseDerivationStepParam("chain-bm-variance/bm-ped-step-2");
    expect(res2).not.toBeNull();
    expect(res2?.chainId).toBe("chain-bm-variance");
    expect(res2?.stepId).toBe("bm-ped-step-2");
  });

  test("parseDerivationStepParam rejects malformed or over-length strings", () => {
    expect(parseDerivationStepParam("")).toBeNull();
    expect(parseDerivationStepParam("just-one-id")).toBeNull();
    expect(parseDerivationStepParam("too/many/parts/here")).toBeNull();
    expect(parseDerivationStepParam("invalid$id/step")).toBeNull();
    expect(parseDerivationStepParam("a".repeat(200))).toBeNull();
  });
});
