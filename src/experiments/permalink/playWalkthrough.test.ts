import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import LabPage from "../../app/lab/me-01/page.tsx";
import { loadWireTeachingTapes } from "../../content/teachingTapes.ts";
import { toMe01Draft } from "../me01/controls.ts";
import { ME01_DEFAULTS } from "../me01/definition.ts";
import { ME01_TAPE } from "../me01/tape.ts";
import { playWalkthrough } from "./playWalkthrough.ts";
import type { TapeV2 } from "./types.ts";

/**
 * THE READER'S HALF: what happens when the button on ME-01 is pressed (am-2rl9).
 *
 * `playWalkthrough` is what the control calls, so this drives the reader's path one layer below the
 * click rather than the replay API two layers below it. What is NOT covered here is stated in the
 * commit and again at the end of this comment: no browser event was dispatched, because this
 * repository's DOM harness does not deliver React events, so the click itself is checked as markup —
 * an enabled button with its accessible name — and the behaviour it invokes is checked here.
 *
 * The records are read from disk, not from src/generated/teaching-tapes.json, for the reason
 * replayTeachingTape.test.ts gives: the catalogue is a build product and a test that reads it cannot
 * see a record change. The browser resolves through the catalogue, which prepare:lab keeps current.
 */
const RECORDS = loadWireTeachingTapes().tapes as ReadonlyMap<string, TapeV2>;
const resolve = (id: string): TapeV2 | null => RECORDS.get(id) ?? null;
/*
 * TapeSession declares the MINIMUM a tape needs of a session, so `getServerSnapshot` is invisible
 * through it while ME-01's session has it. Read through the laboratory's own shape here rather than
 * widening a shared interface on behalf of every laboratory; the assertions are what make the cast
 * honest, since a session without it would fail them rather than pass quietly.
 */
type LiveSession = ReturnType<typeof ME01_TAPE.createSession> &
  Readonly<{ getServerSnapshot(): Readonly<{ accepted: unknown }> }>;
const session = (name: string) => ME01_TAPE.createSession(name) as LiveSession;

describe("pressing play on ME-01's recorded walkthrough", () => {
  test("applies the three authored steps and reaches the state the record describes", () => {
    const out = playWalkthrough(ME01_TAPE, session("play-1"), "the-two-pulses", { resolve });
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
    /*
     * WHAT THIS COVERS AND WHAT IT DOES NOT. The control sets the form from the replayed session,
     * because a form left showing old numbers over new results is a defect this repository has paid
     * for: 12 of 12 laboratories with an Apply button lost restored settings that way. This asserts
     * the VALUE that line assigns. It does not assert that the line runs: removing
     * `setDraft(toMe01Draft(next))` from TwoLedgersLab leaves every test in this file green, which I
     * found by planting it, and covering it needs a real click this repository's DOM harness cannot
     * deliver. The gap is one React setter wide and it is named rather than implied.
     */
    const before = toMe01Draft(ME01_DEFAULTS);
    const out = playWalkthrough(ME01_TAPE, session("play-fields"), "the-two-pulses", { resolve });
    if (out.kind !== "played") throw new Error("unreachable");
    const after = toMe01Draft(out.parameters as unknown as Parameters<typeof toMe01Draft>[0]);
    expect(after.emissionAngle).toBe("90");
    expect(after.frameSpeed).toBe("0.1");
    // The walkthrough moves both of them, so a form that kept its old values would be visibly wrong.
    expect(after.emissionAngle).not.toBe(before.emissionAngle);
    expect(after.frameSpeed).not.toBe(before.frameSpeed);
  });

  test("two presses reach the same state, on separate sessions", () => {
    const first = playWalkthrough(ME01_TAPE, session("play-a"), "the-two-pulses", { resolve });
    const second = playWalkthrough(ME01_TAPE, session("play-b"), "the-two-pulses", { resolve });
    if (first.kind !== "played" || second.kind !== "played") throw new Error("unreachable");
    expect(second.parameters).toEqual(first.parameters);
    expect(second.steps).toBe(first.steps);
  });

  test("the run identity and the revisions hold through the control, not only through the API", () => {
    const live = session("play-revisions");
    const before = live.getSnapshot().accepted;
    const served = live.getServerSnapshot().accepted;
    expect(before).toBe(served);
    const out = playWalkthrough(ME01_TAPE, live, "the-two-pulses", { resolve });
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
    const button = /<button\b[^>]*data-walkthrough="the-two-pulses"[^>]*>([^<]*)<\/button>/u.exec(
      html,
    );
    expect(button).not.toBeNull();
    expect(button?.[1]).toBe("Play the recorded walkthrough");
    // Enabled, so the root layout's noscript rule (button:enabled{display:none}) hides it when
    // scripts do not run; no text sits inside it, because that rule hides what a button wraps.
    expect(/<button\b[^>]*data-walkthrough[^>]*\bdisabled\b/u.test(html)).toBe(false);
    // And the route a reader keeps in that case: the walkthrough's own page, server-rendered.
    expect(html).toContain('href="/tapes/the-two-pulses/"');
  });

  test("nothing about the walkthrough's result is served before it is pressed", () => {
    expect(html).not.toContain("data-walkthrough-result");
    // The served label is the laboratory's static worked example, not anything a record said.
    expect(html).toContain('data-execution-label="static"');
    expect(html).not.toContain("me01-two-ledgers-evaluateMe01");
  });
});
