import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadWireTeachingTapes } from "../../content/teachingTapes.ts";
import { playWalkthrough } from "../../experiments/permalink/playWalkthrough.ts";
import type { LabTapeBinding } from "../../experiments/permalink/sessionTape.ts";
import type { TapeV2 } from "../../experiments/permalink/types.ts";

/**
 * THE CONTROL IN EVERY LABORATORY THAT CAN HONOUR IT (am-2rl9, dispatch 436).
 *
 * The contract is checked per laboratory rather than once, because the failure this guards against is
 * a laboratory that mounts the control and cannot honour it: a button on a laboratory whose
 * walkthrough refuses, or one that plays and leaves the label claiming a static worked example.
 *
 * The records are read from disk rather than from src/generated/teaching-tapes.json for the reason
 * replayTeachingTape.test.ts gives: the catalogue is a build product and a test reading it cannot see
 * a record change. The COMPONENT resolves through the catalogue, which is right for a browser, so the
 * button counts below are asserted against the rendered page and the replays against the records.
 */
const RECORDS = loadWireTeachingTapes().tapes as ReadonlyMap<string, TapeV2>;
const resolve = (id: string): TapeV2 | null => RECORDS.get(id) ?? null;

/** Every laboratory that mounts the control, with the walkthroughs it should offer. */
const WIRED = [
  { lab: "me-01", module: "me01/tape.ts", binding: "ME01_TAPE", tapes: ["the-two-pulses"] },
  {
    lab: "lq-05",
    module: "lq05/tape.ts",
    binding: "LQ05_TAPE",
    tapes: ["lq-05-journey-stage-e", "the-locked-positions"],
  },
  { lab: "lq-06", module: "lq06/tape.ts", binding: "LQ06_TAPE", tapes: ["the-move"] },
  {
    lab: "lq-07",
    module: "lq07/tape.ts",
    binding: "LQ07_TAPE",
    tapes: ["lq-07-journey-stage-g", "stokes-rule-energy-budget"],
  },
  { lab: "lq-09", module: "lq09/tape.ts", binding: "LQ09_TAPE", tapes: ["ionization-bounds"] },
] as const;

/**
 * Laboratories that carry a walkthrough record and must NOT show a button, because pressing it could
 * not work: bm-01 is form-only, so it has no live session to replay into, and me-03's records do not
 * convert, so no resolver can hand them over.
 */
const NOT_WIRED = ["bm-01", "me-03"] as const;

async function bindingOf(entry: (typeof WIRED)[number]): Promise<LabTapeBinding> {
  const mod = (await import(`../../experiments/${entry.module}`)) as Record<string, unknown>;
  return mod[entry.binding] as LabTapeBinding;
}

async function pageMarkup(lab: string): Promise<string> {
  const mod = (await import(`../../app/lab/${lab}/page.tsx`)) as {
    default: () => React.ReactElement | Promise<React.ReactElement>;
  };
  const out = mod.default();
  return renderToStaticMarkup(out instanceof Promise ? await out : out);
}

describe("the walkthrough control, laboratory by laboratory", () => {
  for (const entry of WIRED) {
    test(`${entry.lab}: plays each of its ${entry.tapes.length} walkthrough(s) into its own session`, async () => {
      const binding = await bindingOf(entry);
      expect(binding.environment.experimentId).toBe(entry.lab);
      for (const tapeId of entry.tapes) {
        const session = binding.createSession(`${entry.lab}-${tapeId}`);
        const served = session.getSnapshot().accepted;
        const out = playWalkthrough(binding, session, tapeId, { resolve });
        expect(out.kind).toBe("played");
        if (out.kind !== "played") throw new Error("unreachable");
        // The label stays earned: the accepted snapshot is no longer the served one, which is what
        // stops the page calling the result a static worked example. This path sets no label itself.
        expect(session.getSnapshot().accepted).not.toBe(served);
        expect(out.notice).toContain("this laboratory's own");
      }
    });

    test(`${entry.lab}: a walkthrough from another laboratory is refused and changes nothing`, async () => {
      const binding = await bindingOf(entry);
      const session = binding.createSession(`${entry.lab}-refusal`);
      const served = session.getSnapshot().accepted;
      // the-two-pulses is ME-01's, so every other laboratory must refuse it by name.
      const foreign = entry.lab === "me-01" ? "the-move" : "the-two-pulses";
      const out = playWalkthrough(binding, session, foreign, { resolve });
      expect(out.kind).toBe("refused");
      if (out.kind !== "refused") throw new Error("unreachable");
      expect(out.code).toBe("not-this-laboratory");
      expect(out.notice).not.toMatch(/undefined|\[object/u);
      expect(session.getSnapshot().accepted).toBe(served);
    });

    test(`${entry.lab}: serves an enabled button per walkthrough, and a link that survives no JavaScript`, async () => {
      const html = await pageMarkup(entry.lab);
      const buttons = [
        ...html.matchAll(/<button\b([^>]*data-walkthrough="([^"]*)"[^>]*)>(.*?)<\/button>/gs),
      ];
      expect(buttons.map((match) => match[2]).sort()).toEqual([...entry.tapes].sort());
      // Enabled, so the root layout's noscript rule hides it when scripts do not run.
      for (const match of buttons) expect(/\bdisabled\b/.test(match[1] ?? "")).toBe(false);
      // One walkthrough reads as "the recorded walkthrough"; several are named, or a reader could not
      // tell two buttons apart.
      for (const match of buttons) {
        const label = (match[3] ?? "").replace(/<[^>]+>/g, "").trim();
        expect(label.length).toBeGreaterThan(0);
        if (entry.tapes.length > 1) expect(label.startsWith("Play: ")).toBe(true);
      }
      // The route a reader keeps without JavaScript, server-rendered by LabTapes.
      for (const tapeId of entry.tapes) expect(html).toContain(`href="/tapes/${tapeId}/"`);
      // Nothing about a result is served before the button is pressed.
      expect(html).not.toContain("data-walkthrough-result");
    });
  }

  for (const lab of NOT_WIRED) {
    test(`${lab}: carries a walkthrough link and no button, because pressing one could not work`, async () => {
      const html = await pageMarkup(lab);
      expect(html).not.toContain("data-walkthrough=");
      // The walkthrough is still reachable as a page: what is absent is a control that would refuse.
      expect(html).toMatch(/href="\/tapes\/[^"]+\/"/u);
    });
  }
});
