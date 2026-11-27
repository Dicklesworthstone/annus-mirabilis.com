import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import LabPage from "../../app/lab/me-01/page.tsx";
import { loadWireTeachingTapes } from "../../content/teachingTapes.ts";
import { toMe01Draft } from "../me01/controls.ts";
import { ME01_DEFAULTS } from "../me01/definition.ts";
import { createMe01Session } from "../me01/session.ts";
import { ME01_TAPE } from "../me01/tape.ts";
import { playWalkthrough } from "./playWalkthrough.ts";
import { createSessionReplayRunner, tapeForSettings } from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";

/**
 * The positive replay cases record a fresh checkpoint through ME-01's actual current owner.
 * They reuse the published three-control sequence without relabeling an archived source identity.
 * Archived records are read from disk for refusal checks; their served buttons remain below.
 * The real mounted button and form synchronization are exercised by me01TapeLink.test.tsx.
 */
const RECORDS = loadWireTeachingTapes().tapes as ReadonlyMap<string, TapeV2>;
const ARCHIVED_TAPE_ID = "me-01-two-pulses-2026-11-13";
const TAPE_ID = "me01-current-owner-fixture";
const session = (name: string) => createMe01Session(name);

function recordCurrentOwner(): TapeV2 {
  const archived = RECORDS.get(ARCHIVED_TAPE_ID);
  assert.ok(archived);
  const opening = tapeForSettings(ME01_TAPE, ME01_DEFAULTS);
  assert.ok(opening);
  const recorder = createSessionReplayRunner(ME01_TAPE, session("play-fixture-recorder"));
  recorder.applyInitialConditions(opening.initialConditions);
  const events = archived.events.map((event) => ({ ...event }));
  for (const event of events) recorder.applyEvent(event);
  return {
    ...opening,
    title: "Current ME-01 owner fixture",
    events,
    acceptedCheckpoint: recorder.getAcceptedCheckpoint(),
  };
}

const currentRecord = recordCurrentOwner();
const resolve = (id: string): TapeV2 | null =>
  id === TAPE_ID ? currentRecord : RECORDS.get(id) ?? null;

describe("pressing play on ME-01's recorded walkthrough", () => {
  test("applies the three authored steps and reaches the state the record describes", () => {
    const out = playWalkthrough(ME01_TAPE, session("play-1"), TAPE_ID, { resolve });
    expect(out.kind).toBe("played");
    if (out.kind !== "played") throw new Error("unreachable");
    expect(out.steps).toBe(3);
    expect(out.parameters.emissionAngle).toBe(90);
    expect(out.parameters.frameSpeed).toBe(0.1);
    expect(out.notice).toContain("3 steps");
    // The sentence a reader reads says the numbers are the laboratory's, which is the whole point of
    // the execution-label rule; a record cannot lend a label to a replay.
    expect(out.notice).toContain("this laboratory's own");
  });

  test("the values the fields will show are the walkthrough's, not the ones they had", () => {
    // Check the form conversion here; the mounted suite exercises the real click and setter.
    const before = toMe01Draft(ME01_DEFAULTS);
    const out = playWalkthrough(ME01_TAPE, session("play-fields"), TAPE_ID, { resolve });
    if (out.kind !== "played") throw new Error("unreachable");
    const after = toMe01Draft(out.parameters as unknown as Parameters<typeof toMe01Draft>[0]);
    expect(after.emissionAngle).toBe("90");
    expect(after.frameSpeed).toBe("0.1");
    // The walkthrough moves both of them, so a form that kept its old values would be visibly wrong.
    expect(after.emissionAngle).not.toBe(before.emissionAngle);
    expect(after.frameSpeed).not.toBe(before.frameSpeed);
  });

  test("two presses reach the same state, on separate sessions", () => {
    const first = playWalkthrough(ME01_TAPE, session("play-a"), TAPE_ID, { resolve });
    const second = playWalkthrough(ME01_TAPE, session("play-b"), TAPE_ID, { resolve });
    if (first.kind !== "played" || second.kind !== "played") throw new Error("unreachable");
    expect(second.parameters).toEqual(first.parameters);
    expect(second.steps).toBe(first.steps);
  });

  test("the run identity and the revisions hold through the control, not only through the API", () => {
    const live = session("play-revisions");
    const before = live.getSnapshot().accepted;
    const served = live.getServerSnapshot().accepted;
    expect(before).toBe(served);
    const out = playWalkthrough(ME01_TAPE, live, TAPE_ID, { resolve });
    expect(out.kind).toBe("played");
    const accepted = live.getSnapshot().accepted as unknown as
      | Readonly<{ runId: string; revisions: Readonly<{ input: number; observer: number }> }>
      | undefined;
    if (!accepted) throw new Error("no accepted snapshot after a play");
    // Two setup-changes and the initial conditions moved the input revision; the walkthrough's one
    // observer-change moved only the observer revision and started no new run.
    expect(accepted.revisions.input).toBe(3);
    expect(accepted.revisions.observer).toBe(1);
    expect(accepted.runId.endsWith("/run/3")).toBe(true);
    // And the accepted snapshot is no longer the served one, which is what stops the page calling
    // the result a static worked example: the label is earned per snapshot by the laboratory.
    expect(live.getSnapshot().accepted).not.toBe(served);
  });

  test("archived source identities still refuse verified replay without changing the live owner", () => {
    for (const tapeId of ["the-two-pulses", ARCHIVED_TAPE_ID]) {
      const archived = RECORDS.get(tapeId);
      assert.ok(archived);
      expect(resolve(tapeId)).toBe(archived);
      expect(archived.modelIdentity.artifactDigest)
        .not.toBe(currentRecord.modelIdentity.artifactDigest);
      const live = session(`play-archived-${tapeId}`);
      const before = live.getSnapshot();
      const out = playWalkthrough(ME01_TAPE, live, tapeId, { resolve });
      assert.equal(out.kind, "refused");
      expect(out.code).toBe("tape-artifact-mismatch");
      expect(out.offerNewRun).toBe(true);
      expect(live.getSnapshot()).toBe(before);
    }
  });

  test("a walkthrough recorded elsewhere is refused in the reader's words, and changes nothing", () => {
    const live = session("play-wrong");
    const served = live.getServerSnapshot().accepted;
    const out = playWalkthrough(ME01_TAPE, live, "the-boost-to-0.6c", { resolve });
    expect(out.kind).toBe("refused");
    if (out.kind !== "refused") throw new Error("unreachable");
    expect(out.code).toBe("not-this-laboratory");
    expect(out.notice).toContain("sr-03");
    expect(out.notice).not.toMatch(/undefined|\[object/u);
    // A refusal leaves the laboratory exactly as it was.
    expect(live.getSnapshot().accepted).toBe(served);
  });

  test("a name no walkthrough carries is refused rather than silently doing nothing", () => {
    const out = playWalkthrough(ME01_TAPE, session("play-none"), "no-such-walkthrough", {
      resolve,
    });
    expect(out.kind).toBe("refused");
    if (out.kind !== "refused") throw new Error("unreachable");
    expect(out.code).toBe("unknown-walkthrough");
    expect(out.notice.length).toBeGreaterThan(0);
  });
});

describe("the control as the page serves it", () => {
  const html = renderToStaticMarkup(LabPage());

  test("an enabled button carrying its own name, and a link that survives without JavaScript", () => {
    const button =
      /<button\b[^>]*data-walkthrough="me-01-two-pulses-2026-11-13"[^>]*>([^<]*)<\/button>/u.exec(
        html,
      );
    expect(button).not.toBeNull();
    expect(button?.[1]).toBe("Play: the two pulses (13 November 2026)");
    // Enabled, so the root layout's noscript rule (button:enabled{display:none}) hides it when
    // scripts do not run; no text sits inside it, because that rule hides what a button wraps.
    expect(/<button\b[^>]*data-walkthrough[^>]*\bdisabled\b/u.test(html)).toBe(false);
    // And the route a reader keeps in that case: the walkthrough's own page, server-rendered.
    expect(html).toContain('href="/tapes/me-01-opposite-pulses-2026-11-27/"');
    expect(html).toContain('href="/tapes/the-two-pulses/"');
    expect(html).toContain('href="/tapes/me-01-two-pulses-2026-11-13/"');
  });

  test("nothing about the walkthrough's result is served before it is pressed", () => {
    expect(html).not.toContain("data-walkthrough-result");
    // The served label is the laboratory's static worked example, not anything a record said.
    expect(html).toContain('data-execution-label="static"');
    expect(html).not.toContain("me01-two-ledgers-evaluateMe01");
  });
});
