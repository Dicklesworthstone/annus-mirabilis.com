/**
 * Type-level proof (am-inst-execution-labels-5ywv acceptance criterion 1): loader state cannot
 * reach `executionLabelFor`. Its parameter type is exactly `ExecutionStateKind`, a four-member
 * string union with no object shape at all, so an object carrying a loader or artifact-loaded
 * flag is not assignable to it. `bun run typecheck` fails this file if the expected error does
 * not occur (an unused `@ts-expect-error` is itself a type error), so this is checked by the
 * repository-wide typecheck gate, not merely asserted at runtime.
 */
import { describe, expect, test } from "bun:test";
import type { ExecutionStateKind } from "../provenance/executionState.ts";
import type { ExecutionLabelProps } from "./ExecutionLabel.tsx";
import { executionLabelFor } from "./executionLabelFor.ts";

describe("labelProps: loader state cannot reach the label component's function", () => {
  test("a loader-state object is not assignable to ExecutionStateKind (and the runtime exhaustiveness guard also rejects it)", () => {
    expect(() => {
      // @ts-expect-error an object carrying loader/artifact state is not an ExecutionStateKind.
      executionLabelFor({ artifactLoaded: true, workerReady: true });
    }).toThrow();
  });

  test("a bare string that is not one of the four derived states is rejected (type-level, and at runtime by the exhaustiveness guard)", () => {
    expect(() => {
      // @ts-expect-error "frankensim" is the data-attribute value, not a derived state name.
      executionLabelFor("frankensim");
    }).toThrow();
  });

  test("each of the four real derived states is accepted and produces non-empty text", () => {
    const states: readonly ExecutionStateKind[] = [
      "frankensim-accepted",
      "host-accepted",
      "static-example",
      "unavailable",
    ];
    for (const state of states) {
      expect(executionLabelFor(state).text.length).toBeGreaterThan(0);
    }
  });

  test("ExecutionLabel props reject a loader-state object at the type level", () => {
    // @ts-expect-error loader/artifact flags are not ExecutionLabel props.
    const rejected: ExecutionLabelProps = { artifactLoaded: true, workerReady: true };
    expect(rejected).not.toBeUndefined();
  });
});
