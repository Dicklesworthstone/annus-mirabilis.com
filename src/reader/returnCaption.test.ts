import { describe, expect, test } from "bun:test";
import { returnCaption } from "./returnCaption.ts";

describe("a return caption ends one sentence with one mark", () => {
  test("a label without a closing mark gains a full stop", () => {
    expect(returnCaption("zero average is not no movement")).toBe(
      "Return to zero average is not no movement.",
    );
  });

  test("a label that already ends a sentence keeps its own mark and gains none", () => {
    expect(returnCaption("What would let us count molecules?")).toBe(
      "Return to What would let us count molecules?",
    );
    expect(returnCaption("A stop.")).toBe("Return to A stop.");
    expect(returnCaption("Look!  ")).toBe("Return to Look!");
  });
});
