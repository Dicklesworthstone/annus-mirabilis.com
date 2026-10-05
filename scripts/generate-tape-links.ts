#!/usr/bin/env bun
/**
 * THE LINK THAT PUTS A WALKTHROUGH'S OPENING SETTINGS INTO ITS INSTRUMENT (am-2rl9).
 *
 * Two finished halves had never been joined. Twenty-five laboratories restore a `?tape=` link on
 * mount (useLabTapeLink and useDraftTapeLink, am-inst-permalink-tape-s677), and twenty-one authored
 * teaching tapes record the settings a walkthrough begins from. No page anywhere produced such a
 * link from a record: the only writer was the reader's own Share control, so a reader following
 * "the boost to 0.6c" had to read v = 0.6 and L0 = 10 off the page and type them into SR-03.
 *
 * WHY A GENERATOR AND NOT AN IMPORT IN THE PAGE. Building the link needs the laboratory's binding,
 * which drags its definition, its parameter validator and its session into whatever imports it.
 * Twenty-five of those in one route is the shape that has broken `next build` here before, and the
 * page needs none of it at runtime: the link is a string. So it is computed here and written to
 * src/generated/tape-links.json, the way every other laboratory result already reaches a page.
 *
 * THE LABORATORY DECIDES, NOT THIS SCRIPT. The tape is built by the laboratory's OWN binding
 * (tapeForSettings / draftTapeForSettings), which merges the recorded settings over the
 * laboratory's defaults and runs the laboratory's own validator. A link is emitted only when that
 * returns a tape, so the link cannot promise a state the instrument would refuse, and no mapping
 * table in this file can drift away from what the instrument accepts, because there is none. A tape
 * whose settings are refused is recorded in `notLinked` WITH the laboratory's own sentence for the
 * refusal, rather than dropped: that is a content finding, and the page says nothing rather than
 * offering a link that would land on a notice.
 *
 * WHAT THE LINK CARRIES, AND WHAT IT DOES NOT. The opening state only: `initialConditions`, no
 * events, and the checkpoint the laboratory computes for that state. It does not replay the
 * walkthrough. The authored checkpoints carry placeholder digests (host:sha256:1111...), so
 * replaying against them would verify nothing, and the tapes' own identities (seed, allocationId)
 * disagree with several instruments' declared environments. Building the tape from the binding
 * sidesteps both: the identities are the instrument's own, and the settings are the walkthrough's.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTeachingTapes, loadWireTeachingTapes } from "../src/content/teachingTapes.ts";
import { loadWalkthroughCatalogue } from "../src/content/walkthroughs.ts";
import { BM01_DRAFT_TAPE } from "../src/experiments/bm01/draftTape.ts";
import { BM04_DRAFT_TAPE } from "../src/experiments/bm04/draftTape.ts";
import { BM05_DRAFT_TAPE } from "../src/experiments/bm05/draftTape.ts";
import { BM07_DRAFT_TAPE } from "../src/experiments/bm07/draftTape.ts";
import { BM08_DRAFT_TAPE } from "../src/experiments/bm08/draftTape.ts";
import { LQ01_DRAFT_TAPE } from "../src/experiments/lq01/draftTape.ts";
import { LQ03_TAPE } from "../src/experiments/lq03/tape.ts";
import { LQ04_TAPE } from "../src/experiments/lq04/tape.ts";
import { LQ05_TAPE } from "../src/experiments/lq05/tape.ts";
import { LQ06_TAPE } from "../src/experiments/lq06/tape.ts";
import { LQ07_TAPE } from "../src/experiments/lq07/tape.ts";
import { LQ08_TAPE } from "../src/experiments/lq08/tape.ts";
import { LQ09_TAPE } from "../src/experiments/lq09/tape.ts";
import { ME01_TAPE } from "../src/experiments/me01/tape.ts";
import { ME02_TAPE } from "../src/experiments/me02/tape.ts";
import { ME03_TAPE } from "../src/experiments/me03/tape.ts";
import { encodeTapePermalink } from "../src/experiments/permalink/codec.ts";
import { MAX_PERMALINK_URL_LENGTH } from "../src/experiments/permalink/codecCore.ts";
import {
  type DraftTapeBinding,
  draftTapeForSettings,
} from "../src/experiments/permalink/draftTape.ts";
import {
  type LabTapeBinding,
  requirementsOf,
  tapeForSettings,
} from "../src/experiments/permalink/sessionTape.ts";

import { SR02_TAPE } from "../src/experiments/sr02/tape.ts";
import { SR03_DRAFT_TAPE } from "../src/experiments/sr03/draftTape.ts";
import { SR04_TAPE } from "../src/experiments/sr04/tape.ts";
import { SR05_TAPE } from "../src/experiments/sr05/tape.ts";
import { SR06_TAPE } from "../src/experiments/sr06/tape.ts";
import { SR07_TAPE } from "../src/experiments/sr07/tape.ts";
import { SR08_TAPE } from "../src/experiments/sr08/tape.ts";
import { SR09_TAPE } from "../src/experiments/sr09/tape.ts";
import { SR10_TAPE } from "../src/experiments/sr10/tape.ts";
import { SR11_TAPE } from "../src/experiments/sr11/tape.ts";
import { SR12_TAPE } from "../src/experiments/sr12/tape.ts";
import { SR13_TAPE } from "../src/experiments/sr13/tape.ts";

/**
 * "session": the laboratory replays the link into its session, so the settings are in force on
 * arrival. "form": a worker laboratory puts them in its form and starts nothing, and its own
 * sentence for that is "The shared link's settings are in the form. Apply them to calculate."
 * The page says which, because they are different promises to a reader.
 */
export type TapeLinkKind = "session" | "form";

export const SESSION_BINDINGS: Readonly<Record<string, LabTapeBinding>> = Object.freeze({
  "lq-03": LQ03_TAPE,
  "lq-04": LQ04_TAPE,
  "lq-05": LQ05_TAPE,
  "lq-06": LQ06_TAPE,
  "lq-07": LQ07_TAPE,
  "lq-08": LQ08_TAPE,
  "lq-09": LQ09_TAPE,
  "me-01": ME01_TAPE,
  "me-02": ME02_TAPE,
  "me-03": ME03_TAPE,
  "sr-02": SR02_TAPE,
  "sr-04": SR04_TAPE,
  "sr-05": SR05_TAPE,
  "sr-06": SR06_TAPE,
  "sr-07": SR07_TAPE,
  "sr-08": SR08_TAPE,
  "sr-09": SR09_TAPE,
  "sr-10": SR10_TAPE,
  "sr-11": SR11_TAPE,
  "sr-12": SR12_TAPE,
  "sr-13": SR13_TAPE,
});

export const DRAFT_BINDINGS: Readonly<Record<string, DraftTapeBinding>> = Object.freeze({
  "bm-01": BM01_DRAFT_TAPE,
  "bm-04": BM04_DRAFT_TAPE,
  "bm-05": BM05_DRAFT_TAPE,
  "bm-07": BM07_DRAFT_TAPE,
  "bm-08": BM08_DRAFT_TAPE,
  "lq-01": LQ01_DRAFT_TAPE,
  "sr-03": SR03_DRAFT_TAPE,
});

export type TapeLink = Readonly<{
  experimentId: string;
  href: string;
  kind: TapeLinkKind;
  settings: number;
}>;

/**
 * Why a tape has no link. The CAUSE is separate from the sentence because they answer different
 * questions: the sentence is for a person reading the generated file, and the cause is what the
 * guard test reads. Without it, a tape dropped from the binding table below is reported as
 * "no-binding" and is indistinguishable from a laboratory that genuinely has none, which is the
 * exact miss the test exists to catch.
 */
export type TapeLinkCause = "no-binding" | "refused" | "not-recordable" | "too-long";

export type TapeLinkGap = Readonly<{
  experimentId: string;
  cause: TapeLinkCause;
  reason: string;
}>;

export type TapeLinks = Readonly<{
  links: Readonly<Record<string, TapeLink>>;
  notLinked: Readonly<Record<string, TapeLinkGap>>;
}>;

/**
 * The laboratory's own words for refusing these settings, preferred over anything this script could
 * say. `requirementsOf` reads a refusal's `details.requirements`, which most laboratories do not
 * fill; the refusal's `message` is what BM-05 says ("This step distribution is not registered for
 * this calculation.") and it names the cause, so it is tried first.
 */
function refusalSentence(lab: string, outcome: { kind: string }): string {
  const refusal = (outcome as { refusal?: { message?: unknown } }).refusal;
  const message = refusal?.message;
  if (typeof message === "string" && message.trim()) return message;
  const requirements = requirementsOf(outcome as never);
  if (requirements) return requirements;
  return `${lab.toUpperCase()} does not accept the settings this walkthrough begins from.`;
}

export function buildTapeLinks(): TapeLinks {
  const links: Record<string, TapeLink> = {};
  const notLinked: Record<string, TapeLinkGap> = {};
  for (const tape of loadTeachingTapes().tapes) {
    const lab = tape.experimentId;
    const session = SESSION_BINDINGS[lab];
    const draft = DRAFT_BINDINGS[lab];
    if (!session && !draft) {
      notLinked[tape.tapeId] = {
        experimentId: lab,
        cause: "no-binding",
        reason: `${lab.toUpperCase()} has no shared-link binding, so a link cannot carry settings to it.`,
      };
      continue;
    }
    const binding = session ?? draft;
    if (!binding) continue;
    const settings = tape.initialConditions;
    const merged = { ...binding.defaults, ...settings };
    // The laboratory's own sentence for a refusal, so the gap names the cause rather than the fact.
    const checked = binding.validate(merged);
    if (checked.kind !== "accepted") {
      notLinked[tape.tapeId] = {
        experimentId: lab,
        cause: "refused",
        reason: refusalSentence(lab, checked),
      };
      continue;
    }
    const built = session
      ? tapeForSettings(session, merged)
      : draft
        ? draftTapeForSettings(draft, merged)
        : null;
    if (!built) {
      notLinked[tape.tapeId] = {
        experimentId: lab,
        cause: "not-recordable",
        reason: `${lab.toUpperCase()} accepted these settings but could not record them in a shared link.`,
      };
      continue;
    }
    const href = `/lab/${lab}/?tape=${encodeTapePermalink(built)}`;
    if (href.length > MAX_PERMALINK_URL_LENGTH) {
      notLinked[tape.tapeId] = {
        experimentId: lab,
        cause: "too-long",
        reason: `The link for these settings is ${href.length} characters, over the ${MAX_PERMALINK_URL_LENGTH} a shared link may carry.`,
      };
      continue;
    }
    links[tape.tapeId] = {
      experimentId: lab,
      href,
      kind: session ? "session" : "form",
      settings: Object.keys(settings).length,
    };
  }
  return Object.freeze({ links: Object.freeze(links), notLinked: Object.freeze(notLinked) });
}

/** Every laboratory this generator can build a link for; the guard test reads it against the tree. */
export const BOUND_LABORATORIES: readonly string[] = Object.freeze(
  [...Object.keys(SESSION_BINDINGS), ...Object.keys(DRAFT_BINDINGS)].sort(),
);

/**
 * THE AUTHORED WALKTHROUGHS AS WIRE TAPES, FOR THE BROWSER (am-2rl9, dispatch 382).
 *
 * `loadWireTeachingTapes` reads the YAML with node:fs, so it cannot run where an instrument runs.
 * This is the same map as a build product, which is how every other laboratory result already
 * reaches a page. It is written beside tape-links.json BY THE SAME GENERATOR on purpose: two
 * artifacts from one source that some lane regenerates separately is a staleness trap, and this
 * repository has one recorded already.
 *
 * SIZE, MEASURED BEFORE CHOOSING THE SHAPE (2026-09-28): the whole map is 11,876 bytes raw and
 * 2,453 gzipped, across 12 tapes and 10 instruments; the largest single instrument is 2,010 raw and
 * 644 gzipped. Against the initial reading route's 200 KiB compressed budget that is 1.2 per cent,
 * so it ships as ONE file. A per-instrument split would buy under 2 kB and cost a loader.
 *
 * The 10 records that do not convert are carried as `problems` rather than dropped, because a
 * walkthrough missing from a resolver and one that never existed look identical to a caller.
 */
async function generateTeachingTapes(root: string) {
  const { tapes, problems } = loadWireTeachingTapes(root);
  const byId: Record<string, unknown> = {};
  for (const id of [...tapes.keys()].sort()) byId[id] = tapes.get(id);
  await writeFile(
    resolve(root, "src/generated/teaching-tapes.json"),
    `${JSON.stringify({ tapes: byId, problems }, null, 2)}\n`,
  );
  await writeFile(
    resolve(root, "src/generated/walkthroughs.json"),
    `${JSON.stringify(loadWalkthroughCatalogue(root), null, 2)}\n`,
  );
  return { tapes: Object.keys(byId).length, problems: problems.length };
}

export async function generateTapeLinks() {
  const built = buildTapeLinks();
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  await mkdir(resolve(root, "src/generated"), { recursive: true });
  await writeFile(
    resolve(root, "src/generated/tape-links.json"),
    `${JSON.stringify(built, null, 2)}\n`,
  );
  const wire = await generateTeachingTapes(root);
  return {
    linked: Object.keys(built.links).length,
    notLinked: Object.keys(built.notLinked).length,
    replayable: wire.tapes,
    unconvertible: wire.problems,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await generateTapeLinks()));
}
