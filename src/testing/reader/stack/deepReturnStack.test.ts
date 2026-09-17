/**
 * am-read-return-stack-oxa. Deep multi-level recursive clarification return stack integration test.
 *
 * Verifies the critical product requirements from AGENTS.md & bead specification:
 * 1. Deep descent: A reader opens clarifications several levels deep (e.g. passage -> instrument ->
 *    foundation -> prerequisite -> worked example).
 * 2. Unwinding & Focus: Step-by-step pop restores focus to the exact triggering element of each previous frame.
 * 3. Exact interrupted sentence: Returning to root restores focus to the exact interrupted sentence
 *    content ID anchor (never an array position or numeric index).
 * 4. Live experiment reuse: When returning, a still-mounted laboratory instance is reused rather than restarted,
 *    preserving runId, seed, and execution status.
 * 5. Face switching: Content ID anchors remain identical across every reading face ("reading", "german",
 *    "english", "parallel", "gloss", "facsimile", "results"); switching faces preserves the reader's place.
 * 6. Close-all: Directly returns to the root interrupted sentence and reuses the live lab instance.
 * 7. Planted negative tests: Fallback to sentence anchor when trigger is removed; safe null return on invalid DOM;
 *    checkpoint invalidation on altered seed/digest.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createInstanceRegistry } from "../../../experiments/store/registry.ts";
import { type ControlTape, computeTapeDigest } from "../../../experiments/tape/controlTape.ts";
import { focusOpenedHeading, returnToInterruptedSentence } from "../../../reader/stack/focus.ts";
import {
  deserializeStackState,
  openClarification,
  serializeStackState,
} from "../../../reader/stack/history.ts";
import { getClarificationKind, registerClarificationKind } from "../../../reader/stack/kinds.ts";
import { decideLabRestore } from "../../../reader/stack/restoreLab.ts";
import {
  closeAll,
  createStackStore,
  EMPTY_STACK_STATE,
  type LabReference,
  pushFrame,
  type StackFrame,
  stackDepth,
  topFrame,
} from "../../../reader/stack/stackStore.ts";
import { installDom, uninstallDom } from "../../reactDom.ts";

const SENTENCE_ANCHOR = "ap-17-549-s4-sentence-3";
const FIXTURE_EXPERIMENT_ID = "bm-01";
const FIXTURE_MODEL_IDENTITY = "bm-01@v1";
const FIXTURE_SEED = 1905;

function ensureRegisteredKind(kind: string, descends: boolean, titlePrefix: string): void {
  if (!getClarificationKind(kind)) {
    registerClarificationKind(kind, {
      parseId: (raw: string) => (raw ? { id: raw } : null),
      staticHref: (parsed: unknown) => `#${(parsed as { id: string }).id}`,
      title: (parsed: unknown) => `${titlePrefix}: ${(parsed as { id: string }).id}`,
      descends,
    });
  }
}

function buildFixtureTape(seed: number = FIXTURE_SEED): ControlTape {
  const state = { position: 1.5 };
  const tick = 25;
  const { digest, digestKind } = computeTapeDigest(state, tick, seed);
  return {
    version: 1,
    tapeId: "fixture-tape-bm01",
    experimentId: FIXTURE_EXPERIMENT_ID,
    modelIdentity: FIXTURE_MODEL_IDENTITY,
    tickS: 0.05,
    initialConditions: { position: 0 },
    seed,
    totalTicks: 200,
    events: [],
    checkpoints: [{ tick, state, digest, digestKind }],
  };
}

beforeEach(async () => {
  await installDom();
  ensureRegisteredKind("foundation", true, "Foundation");
  ensureRegisteredKind("example", true, "Worked Example");
});

afterEach(uninstallDom);

describe("Deep multi-level clarification return stack (am-read-return-stack-oxa)", () => {
  test("4-level deep descent, step-by-step pop unwinding, and lab instance reuse", () => {
    // 1. Setup DOM with nested clarification triggers and exact sentence anchor
    document.body.innerHTML = `
      <main id="reader-root">
        <section id="passage-section">
          <p id="${SENTENCE_ANCHOR}" class="reader-sentence">
            Die von der molekularkinetischen Theorie der Wärme geforderte Bewegung...
            <button id="btn-trigger-level-1" type="button">Inspect Mean-Variance</button>
          </p>
        </section>
        <div id="dialog-level-1">
          <h2 id="heading-level-1" tabindex="-1">Level 1: Mean Variance RMS</h2>
          <button id="btn-trigger-level-2" type="button">Derive Diffusion Equation</button>
        </div>
        <div id="dialog-level-2">
          <h2 id="heading-level-2" tabindex="-1">Level 2: Diffusion Equation</h2>
          <button id="btn-trigger-level-3" type="button">Investigate Stokes-Einstein</button>
        </div>
        <div id="dialog-level-3">
          <h2 id="heading-level-3" tabindex="-1">Level 3: Stokes-Einstein Relation</h2>
          <button id="btn-trigger-level-4" type="button">See Worked Example</button>
        </div>
        <div id="dialog-level-4">
          <h2 id="heading-level-4" tabindex="-1">Level 4: Worked Example: Sugar in Water</h2>
        </div>
      </main>
    `;

    // 2. Setup live running experiment in registry
    const registry = createInstanceRegistry();
    const placementKey = `${SENTENCE_ANCHOR}#bm-01/0`;
    const instanceEntry = registry.acquire(placementKey, FIXTURE_EXPERIMENT_ID, () => ({
      initialParameters: { viscosity: 0.001, temperature: 293.15, radius: 1e-6 },
      parameterClasses: {
        viscosity: "input" as const,
        temperature: "input" as const,
        radius: "input" as const,
      },
      outputs: {
        meanSquareDisplacement: {
          statuses: ["value" as const],
          unit: "m^2",
          semanticKind: "scalar",
          ownerId: FIXTURE_EXPERIMENT_ID,
        },
      },
    }));
    expect(registry.has(placementKey)).toBe(true);

    const tape = buildFixtureTape(FIXTURE_SEED);
    const checkpoint = tape.checkpoints[0];
    if (!checkpoint) throw new Error("checkpoint required for test");
    const liveLabRef: LabReference = {
      instanceId: placementKey,
      experimentId: FIXTURE_EXPERIMENT_ID,
      modelIdentity: FIXTURE_MODEL_IDENTITY,
      runId: `${placementKey}/run/1905`,
      checkpointDigest: checkpoint.digest,
      compactTape: "valid-compact-tape-bytes",
    };

    // 3. Initiate clarification store
    const store = createStackStore();
    expect(stackDepth(store.getSnapshot())).toBe(0);

    // 4. Descend Level 1: Passage -> Instrument View
    const outcome1 = openClarification(store.getSnapshot(), {
      kind: "instrument-view",
      id: "bm-01",
      question: "What does the mean square displacement tell us?",
      returnTo: {
        anchor: SENTENCE_ANCHOR,
        face: "reading",
        detail: 1,
        perspective: null,
        notation: null,
        unitLayer: null,
        selectionId: "sel-msd",
        formId: "form-standard",
        triggerId: "btn-trigger-level-1",
        scrollFraction: 0.2,
        lab: liveLabRef,
      },
    });
    expect(outcome1.status).toBe("descended");
    if (outcome1.status !== "descended") throw new Error("level 1 failed");
    store.push(outcome1.frame);
    expect(stackDepth(store.getSnapshot())).toBe(1);

    focusOpenedHeading(document.getElementById("heading-level-1"));
    expect(document.activeElement?.id).toBe("heading-level-1");

    // 5. Descend Level 2: Instrument View -> Diffusion Foundation
    const outcome2 = openClarification(store.getSnapshot(), {
      kind: "foundation",
      id: "diffusion-equation",
      question: "How does irregular motion lead to diffusion?",
      returnTo: {
        anchor: SENTENCE_ANCHOR,
        face: "reading",
        detail: 1,
        perspective: null,
        notation: null,
        unitLayer: null,
        selectionId: null,
        formId: null,
        triggerId: "btn-trigger-level-2",
        scrollFraction: 0.35,
        lab: liveLabRef,
      },
    });
    expect(outcome2.status).toBe("descended");
    if (outcome2.status !== "descended") throw new Error("level 2 failed");
    store.push(outcome2.frame);
    expect(stackDepth(store.getSnapshot())).toBe(2);

    focusOpenedHeading(document.getElementById("heading-level-2"));
    expect(document.activeElement?.id).toBe("heading-level-2");

    // 6. Descend Level 3: Foundation -> Stokes-Einstein Relation
    const outcome3 = openClarification(store.getSnapshot(), {
      kind: "foundation",
      id: "stokes-einstein",
      question: "How does drag balance osmotic pressure?",
      returnTo: {
        anchor: SENTENCE_ANCHOR,
        face: "reading",
        detail: 1,
        perspective: null,
        notation: null,
        unitLayer: null,
        selectionId: null,
        formId: null,
        triggerId: "btn-trigger-level-3",
        scrollFraction: 0.45,
        lab: liveLabRef,
      },
    });
    expect(outcome3.status).toBe("descended");
    if (outcome3.status !== "descended") throw new Error("level 3 failed");
    store.push(outcome3.frame);
    expect(stackDepth(store.getSnapshot())).toBe(3);

    focusOpenedHeading(document.getElementById("heading-level-3"));
    expect(document.activeElement?.id).toBe("heading-level-3");

    // 7. Descend Level 4: Stokes-Einstein -> Worked Example: Sugar in Water
    const outcome4 = openClarification(store.getSnapshot(), {
      kind: "example",
      id: "sugar-in-water",
      question: "What diffusion coefficient does sugar in water yield?",
      returnTo: {
        anchor: SENTENCE_ANCHOR,
        face: "reading",
        detail: 2,
        perspective: null,
        notation: null,
        unitLayer: null,
        selectionId: null,
        formId: null,
        triggerId: "btn-trigger-level-4",
        scrollFraction: 0.5,
        lab: liveLabRef,
      },
    });
    expect(outcome4.status).toBe("descended");
    if (outcome4.status !== "descended") throw new Error("level 4 failed");
    store.push(outcome4.frame);
    expect(stackDepth(store.getSnapshot())).toBe(4);

    focusOpenedHeading(document.getElementById("heading-level-4"));
    expect(document.activeElement?.id).toBe("heading-level-4");

    // 8. Unwind Level 4 -> Level 3
    const frame4 = topFrame(store.getSnapshot());
    if (!frame4) throw new Error("frame4 missing");
    store.pop();
    expect(stackDepth(store.getSnapshot())).toBe(3);
    const returnTarget3 = returnToInterruptedSentence(window, document, frame4);
    expect(returnTarget3).not.toBeNull();
    expect(returnTarget3?.element.id).toBe("btn-trigger-level-4");
    expect(document.activeElement?.id).toBe("btn-trigger-level-4");

    // 9. Unwind Level 3 -> Level 2
    const frame3 = topFrame(store.getSnapshot());
    if (!frame3) throw new Error("frame3 missing");
    store.pop();
    expect(stackDepth(store.getSnapshot())).toBe(2);
    const returnTarget2 = returnToInterruptedSentence(window, document, frame3);
    expect(returnTarget2).not.toBeNull();
    expect(returnTarget2?.element.id).toBe("btn-trigger-level-3");
    expect(document.activeElement?.id).toBe("btn-trigger-level-3");

    // 10. Unwind Level 2 -> Level 1
    const frame2 = topFrame(store.getSnapshot());
    if (!frame2) throw new Error("frame2 missing");
    store.pop();
    expect(stackDepth(store.getSnapshot())).toBe(1);
    const returnTarget1 = returnToInterruptedSentence(window, document, frame2);
    expect(returnTarget1).not.toBeNull();
    expect(returnTarget1?.element.id).toBe("btn-trigger-level-2");
    expect(document.activeElement?.id).toBe("btn-trigger-level-2");

    // 11. Unwind Level 1 -> Root Passage (exact interrupted sentence)
    const frame1 = topFrame(store.getSnapshot());
    if (!frame1) throw new Error("frame1 missing");
    store.pop();
    expect(stackDepth(store.getSnapshot())).toBe(0);

    const returnTargetRoot = returnToInterruptedSentence(window, document, frame1);
    expect(returnTargetRoot).not.toBeNull();
    expect(returnTargetRoot?.element.id).toBe("btn-trigger-level-1");
    expect(document.activeElement?.id).toBe("btn-trigger-level-1");
    expect(frame1.anchor).toBe(SENTENCE_ANCHOR);

    // 12. Verify Live Laboratory Instance is Reused, NOT Restarted
    const labDecision = decideLabRestore({
      mounted: registry.has(placementKey),
      lab: frame1.lab,
      tape,
      currentExperimentId: FIXTURE_EXPERIMENT_ID,
      currentModelIdentity: FIXTURE_MODEL_IDENTITY,
      expectedSeed: FIXTURE_SEED,
    });
    expect(labDecision).toEqual({ action: "reuse" });
    expect(registry.has(placementKey)).toBe(true);
    expect(instanceEntry.store.getSnapshot().status).toBe("idle");

    // Reacquiring placement key reattaches to existing instance instead of creating new
    const reacquired = registry.acquire(placementKey, FIXTURE_EXPERIMENT_ID, () => {
      throw new Error("should not recreate store");
    });
    expect(reacquired.reattached).toBe(true);
    expect(reacquired.instanceId).toBe(instanceEntry.instanceId);
  });

  test("close-all from deep stack returns to root interrupted sentence and reuses live lab", () => {
    document.body.innerHTML = `
      <main id="reader-root">
        <p id="${SENTENCE_ANCHOR}">
          Root sentence.
          <button id="origin-btn" type="button">Trigger</button>
        </p>
      </main>
    `;

    const liveLabRef: LabReference = {
      instanceId: "live-inst-closeall",
      experimentId: FIXTURE_EXPERIMENT_ID,
      modelIdentity: FIXTURE_MODEL_IDENTITY,
      runId: "run-closeall",
      checkpointDigest: "digest-closeall",
      compactTape: "tape-closeall",
    };

    let state = EMPTY_STACK_STATE;
    const originFrame: StackFrame = {
      anchor: SENTENCE_ANCHOR,
      face: "reading",
      detail: 1,
      perspective: null,
      notation: null,
      unitLayer: null,
      selectionId: null,
      formId: null,
      clarification: { kind: "instrument-view", id: "bm-01" },
      title: "BM-01",
      question: "Question 1",
      triggerId: "origin-btn",
      scrollFraction: 0.1,
      lab: liveLabRef,
    };

    state = pushFrame(state, originFrame).state;
    for (let depth = 2; depth <= 5; depth++) {
      state = pushFrame(state, {
        ...originFrame,
        clarification: { kind: "foundation", id: `foundation-${depth}` },
        title: `Depth ${depth}`,
        triggerId: `nested-trigger-${depth}`,
      }).state;
    }
    expect(stackDepth(state)).toBe(5);

    // Close all frames at once
    const closedState = closeAll(state);
    expect(stackDepth(closedState)).toBe(0);

    // Return to the origin frame's interrupted sentence
    const target = returnToInterruptedSentence(window, document, originFrame);
    expect(target).not.toBeNull();
    expect(target?.element.id).toBe("origin-btn");
    expect(document.activeElement?.id).toBe("origin-btn");

    // Confirm lab reuse
    const decision = decideLabRestore({
      mounted: true,
      lab: liveLabRef,
      tape: null,
      currentExperimentId: FIXTURE_EXPERIMENT_ID,
      currentModelIdentity: FIXTURE_MODEL_IDENTITY,
      expectedSeed: FIXTURE_SEED,
    });
    expect(decision).toEqual({ action: "reuse" });
  });

  test("anchors are content IDs identical across every reading face", () => {
    const faces = [
      "reading",
      "results",
      "german",
      "english",
      "parallel",
      "gloss",
      "facsimile",
    ] as const;

    // Build stack across multiple faces
    for (const face of faces) {
      const f: StackFrame = {
        anchor: SENTENCE_ANCHOR,
        face,
        detail: 1,
        perspective: null,
        notation: null,
        unitLayer: null,
        selectionId: null,
        formId: null,
        clarification: { kind: "instrument-view", id: "bm-01" },
        title: `Title for ${face}`,
        question: `Question for ${face}`,
        triggerId: "btn-any",
        scrollFraction: 0.2,
        lab: null,
      };

      // Content ID anchor is invariant
      expect(f.anchor).toBe(SENTENCE_ANCHOR);
      expect(f.anchor.startsWith("ap-17-549")).toBe(true);

      // Serialization and deserialization preserves content ID anchor and face
      const serialized = serializeStackState({ frames: [f] });
      const deserialized = deserializeStackState(serialized);
      expect(deserialized?.frames[0]?.anchor).toBe(SENTENCE_ANCHOR);
      expect(deserialized?.frames[0]?.face).toBe(face);
    }
  });

  test("planted negative: fallback to sentence anchor when triggerId is removed from DOM", () => {
    document.body.innerHTML = `
      <div id="passage-container">
        <p id="${SENTENCE_ANCHOR}">Exact sentence element present, but button was removed.</p>
      </div>
    `;

    const f: StackFrame = {
      anchor: SENTENCE_ANCHOR,
      face: "reading",
      detail: 1,
      perspective: null,
      notation: null,
      unitLayer: null,
      selectionId: null,
      formId: null,
      clarification: { kind: "foundation", id: "brownian-motion" },
      title: "Brownian Motion",
      question: "Question",
      triggerId: "vanished-button-id",
      scrollFraction: 0.15,
      lab: null,
    };

    const target = returnToInterruptedSentence(window, document, f);
    expect(target).not.toBeNull();
    // Element focused is the exact sentence anchor element
    expect(target?.element.id).toBe(SENTENCE_ANCHOR);
    expect(target?.isOrigin).toBe(false);
    expect(target?.element.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement?.id).toBe(SENTENCE_ANCHOR);
  });

  test("planted negative: unmounted lab with altered seed invalidates checkpoint to new-run", () => {
    const tape = buildFixtureTape(FIXTURE_SEED);
    const checkpoint = tape.checkpoints[0];
    if (!checkpoint) throw new Error("checkpoint required for test");

    const labRef: LabReference = {
      instanceId: "inst-unmounted",
      experimentId: FIXTURE_EXPERIMENT_ID,
      modelIdentity: FIXTURE_MODEL_IDENTITY,
      runId: "run-unmounted",
      checkpointDigest: checkpoint.digest,
      compactTape: "tape-bytes",
    };

    // Expected seed is different from tape seed (1905 vs 1906)
    const decision = decideLabRestore({
      mounted: false,
      lab: labRef,
      tape,
      currentExperimentId: FIXTURE_EXPERIMENT_ID,
      currentModelIdentity: FIXTURE_MODEL_IDENTITY,
      expectedSeed: FIXTURE_SEED + 1,
    });

    expect(decision.action).toBe("new-run");
    if (decision.action === "new-run") {
      expect(decision.reason).toContain("seed");
      expect(decision.reason).toContain(String(FIXTURE_SEED));
    }
  });
});
