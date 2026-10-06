/**
 * A LABORATORY'S APPLY FAILURE STAYS TYPED (am-ig23).
 *
 * Seventeen lab components collapsed `session.apply()`'s typed refusal into a string:
 *
 *     setError(r.kind === "refused"
 *       ? String(r.refusal.details?.requirements ?? r.refusal.message)
 *       : r.outcome.message);
 *
 * The sentence that produces is good. The code, the ranked repairs and the staleness marking are all lost at
 * that one assignment, and AGENTS.md's refusal contract asks for all four. These cases pin the shared half,
 * including the two ways the hand-written expression above goes wrong.
 */

import { describe, expect, test } from "bun:test";
import {
  applyFailure,
  failureCode,
  failureFromThrown,
  ParameterRefusalError,
} from "./applyFailure.ts";
import { refusalSentence } from "./refusalSentence.ts";
import { makeRefusal } from "./refusals.ts";

/**
 * An unavailable result, built from a REGISTERED outcome rather than cast.
 *
 * The first draft wrote `{ outcome: "worker-unavailable", retry: "not-retryable" }` and cast it. TypeScript
 * refused, and it was right twice: neither name exists. The registry's ids are "transport-error",
 * "protocol-mismatch", "malformed-response", "budget-exhausted", "cancelled", "superseded" and the rest, and
 * RetryGuidance is "retry-same-request" | "new-run" | "reload" | "none". A cast would have put a fictional
 * outcome into a test about honest reporting.
 */
const unavailableResult = (message: string) => ({
  kind: "unavailable" as const,
  outcome: {
    outcome: "transport-error" as const,
    message,
    retry: "retry-same-request" as const,
  },
});

const offGrid = () =>
  makeRefusal(
    "off-replay-grid",
    { parameterIds: ["exposure"] },
    {
      details: {
        requirements: "Enter an exposure in steps of 0.25 s, such as 0.25, 0.5 or 0.75 s.",
      },
      rankedRepairs: [
        {
          label: "Use the nearest available interval on the quarter-second recording grid.",
          action: { parameterId: "exposure", value: 0.25 },
        },
      ],
    },
  );

describe("refusalSentence", () => {
  test("prefers the requirements detail, which is the admissible range in a reader's words", () => {
    expect(refusalSentence(offGrid())).toMatch(/steps of 0.25 s/);
  });

  test("falls back to the registry message when there is no requirements detail", () => {
    const bare = makeRefusal("off-replay-grid", { parameterIds: ["exposure"] });
    expect(refusalSentence(bare)).toBe(bare.message);
    expect(refusalSentence(bare).length).toBeGreaterThan(10);
  });

  test("A NON-STRING requirements is ignored rather than stringified", () => {
    // `String(r.refusal.details?.requirements ?? r.refusal.message)` yields "[object Object]" here, which is
    // not a sentence. WalkLab is the only one of the seventeen that guards against it; the other sixteen
    // would show it to a reader.
    const odd = makeRefusal(
      "off-replay-grid",
      { parameterIds: ["exposure"] },
      { details: { requirements: { nested: "value" } } },
    );
    expect(refusalSentence(odd)).toBe(odd.message);
    expect(refusalSentence(odd)).not.toContain("[object Object]");
  });

  test("an empty or whitespace requirements falls back too", () => {
    for (const requirements of ["", "   "]) {
      const r = makeRefusal(
        "off-replay-grid",
        { parameterIds: ["exposure"] },
        { details: { requirements } },
      );
      expect(refusalSentence(r)).toBe(r.message);
    }
  });
});

describe("applyFailure", () => {
  test("an accepted result is not a failure", () => {
    expect(applyFailure({ kind: "accepted" })).toBeNull();
  });

  test("a refusal keeps the refusal itself, not only its sentence", () => {
    const failure = applyFailure({ kind: "refused", refusal: offGrid() });
    expect(failure?.kind).toBe("refused");
    if (failure?.kind !== "refused") throw new Error("unreachable");
    // The three things the string collapse lost.
    expect(failure.refusal.code).toBe("off-replay-grid");
    expect(failure.refusal.rankedRepairs).toHaveLength(1);
    expect(failure.refusal.rankedRepairs[0]?.action?.parameterId).toBe("exposure");
    expect(failure.text).toMatch(/steps of 0.25 s/);
  });

  test("failureCode gives the code for a refusal and nothing for anything else", () => {
    const refused = applyFailure({ kind: "refused", refusal: offGrid() });
    expect(refused && failureCode(refused)).toBe("off-replay-grid");
    const unavailable = applyFailure(unavailableResult("No worker here."));
    expect(unavailable && failureCode(unavailable)).toBeUndefined();
  });

  test("an execution outcome keeps its own message", () => {
    const failure = applyFailure(unavailableResult("No worker on this device."));
    expect(failure?.kind).toBe("unavailable");
    expect(failure?.text).toBe("No worker on this device.");
  });

  test("a result that is neither gets its OWN variant, not an invented outcome", () => {
    // Fabricating an ExecutionOutcome here would mean choosing a code and a retry guidance this layer has no
    // basis for, and an invented outcome is indistinguishable downstream from one the engine raised.
    const failure = applyFailure({ kind: "something-else" });
    expect(failure?.kind).toBe("unexplained");
    if (failure?.kind !== "unexplained") throw new Error("unreachable");
    expect(failure.resultKind).toBe("something-else");
    expect(failure.text).toMatch(/gave no reason/);
    expect(failureCode(failure)).toBeUndefined();
  });

  test("THE THROWN PATH: a ParameterRefusalError restores the whole refusal", () => {
    // The real site, one layer below the component: five controls.ts modules validate a draft and throw. Four
    // of them threw `new TypeError(String(r.refusal.details?.requirements ?? r.refusal.message))`, which is
    // the sentence and nothing else, so a component's catch could not recover the code however carefully it
    // was written.
    const thrown = new ParameterRefusalError(offGrid());
    const failure = failureFromThrown(thrown, "fallback");
    expect(failure.kind).toBe("refused");
    if (failure.kind !== "refused") throw new Error("unreachable");
    expect(failure.refusal.code).toBe("off-replay-grid");
    expect(failure.refusal.rankedRepairs[0]?.action?.value).toBe(0.25);
    expect(failure.text).toMatch(/steps of 0.25 s/);
    // Its own message is the reader's sentence too, so an unhandled one still reads correctly.
    expect(thrown.message).toMatch(/steps of 0.25 s/);
    expect(thrown.name).toBe("ParameterRefusalError");
  });

  test("an ordinary throw keeps its message and is NOT called a refusal", () => {
    const failure = failureFromThrown(new TypeError("Enter a whole number."), "fallback");
    expect(failure.kind).toBe("unexplained");
    expect(failure.text).toBe("Enter a whole number.");
    expect(failureCode(failure)).toBeUndefined();
  });

  test("a thrown value with no message falls back to the caller's sentence", () => {
    for (const thrown of [new Error(""), "a string", undefined])
      expect(failureFromThrown(thrown, "Check the camera settings.").text).toBe(
        "Check the camera settings.",
      );
  });

  test("a refused result with no refusal object does not claim to be a refusal", () => {
    // The dangerous shape: reading `kind` alone and then dereferencing `refusal`. This must degrade to the
    // unexplained variant rather than throw inside a render.
    const failure = applyFailure({ kind: "refused" });
    expect(failure?.kind).toBe("unexplained");
  });
});
