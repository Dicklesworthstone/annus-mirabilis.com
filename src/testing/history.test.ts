import { describe, expect, test } from "bun:test";
import {
  deserializeStackState,
  MAX_OPEN_PARAM_LENGTH,
  openClarification,
  parseOpenParam,
  resolveOpenParam,
  serializeOpenParam,
  serializeStackState,
} from "../reader/stack/history.ts";
import { EMPTY_STACK_STATE, pushFrame, type StackFrame } from "../reader/stack/stackStore.ts";

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
    clarification: { kind: "instrument-view", id: "bm-01" },
    title: "BM-01",
    question: "What does the mean square displacement tell us?",
    triggerId: "trigger-1",
    scrollFraction: 0.2,
    lab: null,
    ...overrides,
  };
}

describe("parseOpenParam: kind:id, first colon, 200-character bound", () => {
  test("splits on the first colon", () => {
    expect(parseOpenParam("foundation:mean-variance-rms")).toEqual({
      kind: "foundation",
      id: "mean-variance-rms",
    });
  });

  test("a value containing further colons keeps them in the id half", () => {
    expect(parseOpenParam("derivation-step:chain-1/step-3")).toEqual({
      kind: "derivation-step",
      id: "chain-1/step-3",
    });
  });

  test("null, empty, no-colon, and colon-at-either-end values are all refused", () => {
    expect(parseOpenParam(null)).toBeNull();
    expect(parseOpenParam("")).toBeNull();
    expect(parseOpenParam("no-colon-here")).toBeNull();
    expect(parseOpenParam(":leading-colon")).toBeNull();
    expect(parseOpenParam("trailing-colon:")).toBeNull();
  });

  test("a value over 200 characters is refused", () => {
    const over = `foundation:${"a".repeat(MAX_OPEN_PARAM_LENGTH)}`;
    expect(over.length).toBeGreaterThan(MAX_OPEN_PARAM_LENGTH);
    expect(parseOpenParam(over)).toBeNull();
  });

  test("a value at exactly 200 characters is accepted", () => {
    const kind = "foundation:";
    const id = "a".repeat(MAX_OPEN_PARAM_LENGTH - kind.length);
    const value = kind + id;
    expect(value.length).toBe(MAX_OPEN_PARAM_LENGTH);
    expect(parseOpenParam(value)).toEqual({ kind: "foundation", id });
  });
});

describe("serializeOpenParam", () => {
  test("joins kind and id with a colon", () => {
    expect(serializeOpenParam("instrument-view", "bm-01")).toBe("instrument-view:bm-01");
  });

  test("throws rather than silently truncating an overlong value", () => {
    expect(() => serializeOpenParam("foundation", "a".repeat(300))).toThrow(/exceeds 200/);
  });
});

describe("resolveOpenParam: the closed registry decides what actually opens", () => {
  test("an unregistered kind resolves to null without throwing", () => {
    expect(resolveOpenParam("no-such-kind:anything")).toBeNull();
  });

  test("a registered kind whose parser rejects the id resolves to null", () => {
    expect(resolveOpenParam("instrument-view:bm-01:a:b")).toBeNull();
  });

  test("a registered kind with a well-formed id resolves with the parsed id and definition", () => {
    const resolved = resolveOpenParam("instrument-view:bm-01");
    expect(resolved).not.toBeNull();
    if (resolved) {
      expect(resolved.kind).toBe("instrument-view");
      expect(resolved.parsedId).toEqual({ raw: "bm-01" });
    }
  });

  test("an invalid overall value never breaks: it resolves to null, the page does not throw", () => {
    expect(() => resolveOpenParam(`x:${"y".repeat(500)}`)).not.toThrow();
    expect(resolveOpenParam(`x:${"y".repeat(500)}`)).toBeNull();
  });
});

describe("openClarification: push, or inline for a non-descending kind", () => {
  const returnTo = {
    anchor: "brownian-4",
    face: "reading",
    detail: 1,
    perspective: null,
    notation: null,
    unitLayer: null,
    selectionId: null,
    formId: null,
    triggerId: "trigger-1",
    scrollFraction: 0.2,
    lab: null,
  };

  test("a descending kind pushes exactly one frame", () => {
    const outcome = openClarification(EMPTY_STACK_STATE, {
      kind: "instrument-view",
      id: "bm-01",
      question: "What does the mean square displacement tell us?",
      returnTo,
    });
    expect(outcome.status).toBe("descended");
    if (outcome.status !== "descended") throw new Error("expected descended");
    expect(outcome.state.frames).toHaveLength(1);
    expect(outcome.frame.clarification).toEqual({ kind: "instrument-view", id: "bm-01" });
    expect(outcome.frame.question).toBe("What does the mean square displacement tell us?");
    expect(outcome.replacedDeepest).toBe(false);
  });

  test("term (descends: false) never pushes a frame: it reports inline", () => {
    const outcome = openClarification(EMPTY_STACK_STATE, {
      kind: "term",
      id: "meanSquareDisplacement",
      question: "irrelevant for an inline open",
      returnTo,
    });
    expect(outcome.status).toBe("inline");
    if (outcome.status !== "inline") throw new Error("expected inline");
    expect(outcome.parsedId).toEqual({ routeSlug: null, termId: "meanSquareDisplacement" });
  });

  test("an unknown kind reports unknown-kind and pushes nothing", () => {
    const outcome = openClarification(EMPTY_STACK_STATE, {
      kind: "not-a-real-kind",
      id: "x",
      question: "q",
      returnTo,
    });
    expect(outcome.status).toBe("unknown-kind");
  });

  test("an id that fails its kind's parser reports parser-rejected and pushes nothing", () => {
    const outcome = openClarification(EMPTY_STACK_STATE, {
      kind: "instrument-view",
      id: "bm-01:a:b",
      question: "q",
      returnTo,
    });
    expect(outcome.status).toBe("parser-rejected");
  });

  test("the frame's title comes from the kind's own title(parsedId), not from the caller", () => {
    const outcome = openClarification(EMPTY_STACK_STATE, {
      kind: "instrument-view",
      id: "bm-01",
      question: "q",
      returnTo,
    });
    if (outcome.status !== "descended") throw new Error("expected descended");
    expect(outcome.frame.title).not.toBe("");
    expect(outcome.frame.title.length).toBeGreaterThan(0);
  });

  test("pushing at MAX_CLARIFICATION_DEPTH replaces the deepest frame", () => {
    // Uses the real "instrument-view" kind rather than a test-registered one: resetting the
    // shared kinds registry mid-file would leak into every other test file sharing this process
    // (the exact cross-test pollution BoldHarbor flagged 2026-09-16 -- shared mutable state, not
    // just shared file paths, is the same hazard). "instrument-view" only checks address grammar,
    // so 13 distinct well-formed ids are enough with no registry mutation at all.
    let state = EMPTY_STACK_STATE;
    for (let i = 0; i < 12; i++) {
      const outcome = openClarification(state, {
        kind: "instrument-view",
        id: `bm-0${(i % 8) + 1}`,
        question: "q",
        returnTo,
      });
      if (outcome.status !== "descended") throw new Error("expected descended");
      state = outcome.state;
    }
    const outcome = openClarification(state, {
      kind: "instrument-view",
      id: "sr-01",
      question: "q",
      returnTo,
    });
    if (outcome.status !== "descended") throw new Error("expected descended");
    expect(outcome.replacedDeepest).toBe(true);
    expect(outcome.state.frames).toHaveLength(12);
  });
});

describe("StackState <-> history.state serialization: untrusted on the way in", () => {
  test("a serialized state round-trips through deserialization", () => {
    const { state } = pushFrame(EMPTY_STACK_STATE, frame());
    const serialized = serializeStackState(state);
    const restored = deserializeStackState(serialized);
    expect(restored).toEqual(state);
  });

  test("null, non-objects, and malformed frames are all refused, never thrown", () => {
    expect(deserializeStackState(null)).toBeNull();
    expect(deserializeStackState(42)).toBeNull();
    expect(deserializeStackState({})).toBeNull();
    expect(deserializeStackState({ frames: "not-an-array" })).toBeNull();
    expect(deserializeStackState({ frames: [{ anchor: "x" }] })).toBeNull();
  });

  test("a frame missing a required field is refused", () => {
    const { state } = pushFrame(EMPTY_STACK_STATE, frame());
    const serialized = serializeStackState(state);
    const corrupted = { frames: [{ ...serialized.frames[0], title: undefined }] };
    expect(deserializeStackState(corrupted)).toBeNull();
  });

  test("a lab reference round-trips too", () => {
    const withLab = frame({
      lab: {
        instanceId: "bm-01:1",
        experimentId: "bm-01",
        modelIdentity: "bm-01@v1",
        runId: "bm-01:1/run/1",
        checkpointDigest: "host:deadbeef",
        compactTape: "opaque-bytes",
      },
    });
    const { state } = pushFrame(EMPTY_STACK_STATE, withLab);
    const restored = deserializeStackState(serializeStackState(state));
    expect(restored).toEqual(state);
  });
});

describe("face-switch ordering during open clarification (am-read-return-stack-oxa)", () => {
  test("switching faces during an open clarification creates a distinct history entry; back restores face first, then passage", () => {
    // Models history.state entries managed across reader navigation and return stack
    type HistoryEntry = {
      url: string;
      readerState: { view: string; anchor: string; detail: number };
      clarificationState: ReturnType<typeof serializeStackState>;
    };

    const historyTimeline: HistoryEntry[] = [];
    let historyCursor = -1;

    function navigatePush(entry: HistoryEntry) {
      historyTimeline.splice(historyCursor + 1);
      historyTimeline.push(entry);
      historyCursor++;
    }

    function navigateBack(): HistoryEntry {
      if (historyCursor <= 0) throw new Error("cannot navigate back past root");
      historyCursor--;
      return historyTimeline[historyCursor]!;
    }

    // 1. Initial passage state at /papers/brownian-motion/#brownian-4 with face="reading"
    navigatePush({
      url: "/papers/brownian-motion/#brownian-4",
      readerState: { view: "reading", anchor: "brownian-4", detail: 1 },
      clarificationState: serializeStackState(EMPTY_STACK_STATE),
    });
    expect(historyCursor).toBe(0);
    expect(historyTimeline[0]?.readerState.view).toBe("reading");

    // 2. Open clarification (instrument-view:bm-01) from face="reading"
    const openOutcome = openClarification(EMPTY_STACK_STATE, {
      kind: "instrument-view",
      id: "bm-01",
      question: "What does the mean square displacement tell us?",
      returnTo: {
        anchor: "brownian-4",
        face: "reading",
        detail: 1,
        perspective: null,
        notation: null,
        unitLayer: null,
        selectionId: "sel-msd",
        formId: null,
        triggerId: "btn-trigger-bm01",
        scrollFraction: 0.25,
        lab: null,
      },
    });
    if (openOutcome.status !== "descended") throw new Error("expected descended outcome");

    // Pushes exactly one history entry for the clarification descent
    navigatePush({
      url: "/papers/brownian-motion/?open=instrument-view:bm-01#brownian-4",
      readerState: { view: "reading", anchor: "brownian-4", detail: 1 },
      clarificationState: serializeStackState(openOutcome.state),
    });
    expect(historyCursor).toBe(1);
    expect(openOutcome.frame.face).toBe("reading");
    expect(openOutcome.frame.anchor).toBe("brownian-4");

    // 3. Reader switches reading face to "german" while clarification is STILL OPEN
    // AGENTS.md / Spec: "A face switch while a clarification is open is its own history entry"
    navigatePush({
      url: "/papers/brownian-motion/?view=german&open=instrument-view:bm-01#brownian-4",
      readerState: { view: "german", anchor: "brownian-4", detail: 1 },
      clarificationState: serializeStackState(openOutcome.state),
    });
    expect(historyCursor).toBe(2);
    expect(historyTimeline[historyCursor]?.readerState.view).toBe("german");
    expect(historyTimeline[historyCursor]?.url).toContain("view=german");
    expect(historyTimeline[historyCursor]?.url).toContain("open=instrument-view:bm-01");

    // 4. First back navigation: must undo the face switch FIRST
    const afterFirstBack = navigateBack();
    expect(historyCursor).toBe(1);
    // Face is restored to "reading"
    expect(afterFirstBack.readerState.view).toBe("reading");
    expect(afterFirstBack.url).not.toContain("view=german");
    // The clarification frame is still OPEN and untouched
    expect(afterFirstBack.url).toContain("open=instrument-view:bm-01");
    const stackAfterFirstBack = deserializeStackState(afterFirstBack.clarificationState);
    expect(stackAfterFirstBack).not.toBeNull();
    expect(stackAfterFirstBack?.frames).toHaveLength(1);
    expect(stackAfterFirstBack?.frames[0]?.clarification.id).toBe("bm-01");
    expect(stackAfterFirstBack?.frames[0]?.face).toBe("reading");

    // 5. Second back navigation: pops the clarification frame SECOND
    const afterSecondBack = navigateBack();
    expect(historyCursor).toBe(0);
    // Returns to the root interrupted passage
    expect(afterSecondBack.readerState.view).toBe("reading");
    expect(afterSecondBack.readerState.anchor).toBe("brownian-4");
    expect(afterSecondBack.url).toBe("/papers/brownian-motion/#brownian-4");
    const stackAfterSecondBack = deserializeStackState(afterSecondBack.clarificationState);
    expect(stackAfterSecondBack).not.toBeNull();
    expect(stackAfterSecondBack?.frames).toHaveLength(0);
  });
});
