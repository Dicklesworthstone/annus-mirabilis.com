/**
 * A WALKTHROUGH'S LINK OPENS ITS INSTRUMENT IN THE STATE THE WALKTHROUGH BEGINS FROM (am-2rl9).
 *
 * scripts/generate-tape-links.ts writes one `/lab/<id>/?tape=...` link per teaching tape whose
 * laboratory accepts its opening settings. The page renders the link and can say nothing about
 * whether it works, so this is where that is answered, and the strong case is the third test: the
 * link is decoded and handed to the LABORATORY'S OWN restore path, the same function
 * useLabTapeLink and useDraftTapeLink call on mount. A link that restores here is a link that
 * arrives set up.
 *
 * WHAT IT DOES NOT CLAIM. Not that a browser applies it: the restore runs in an effect after
 * hydration, so a reader with no JavaScript gets the laboratory's worked example and the page says
 * so. Not that the walkthrough replays: the link carries the opening state only.
 *
 * THE POPULATION IS DERIVED FROM THE TREE, not from a list here, because the failure worth catching
 * is a tape silently missing from the generated map. A missing entry and a laboratory with no
 * binding look identical in the output, so the second test reads the binding FILES off disk and
 * requires a link for every tape whose laboratory has one.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  BOUND_LABORATORIES,
  buildTapeLinks,
  DRAFT_BINDINGS,
  SESSION_BINDINGS,
} from "../../scripts/generate-tape-links.ts";
import { loadTeachingTapes } from "../content/teachingTapes.ts";
import { decodeTapePermalink } from "../experiments/permalink/codec.ts";
import { MAX_PERMALINK_URL_LENGTH } from "../experiments/permalink/codecCore.ts";
import { loadDraftTape } from "../experiments/permalink/draftTape.ts";
import { restoreTape } from "../experiments/permalink/sessionTape.ts";

const { tapes } = loadTeachingTapes();
const built = buildTapeLinks();
const bindingFile = (lab: string, name: string) =>
  join(process.cwd(), "src", "experiments", lab.replace("-", ""), name);

describe("a teaching tape's link to its instrument", () => {
  test("every tape is either linked or has a reason, and there are tapes of both", () => {
    expect(tapes.length).toBeGreaterThan(15);
    const unaccounted = tapes
      .map((t) => t.tapeId)
      .filter((id) => !built.links[id] && !built.notLinked[id]);
    expect(unaccounted).toEqual([]);
    for (const id of Object.keys(built.links))
      expect(Boolean(built.notLinked[id]), `${id} is both linked and not`).toBe(false);
    // Non-vacuity on purpose: an empty link map would pass every other assertion here.
    expect(Object.keys(built.links).length).toBeGreaterThan(10);
    for (const [id, gap] of Object.entries(built.notLinked))
      expect(gap.reason.trim().length, `${id} has no reason`).toBeGreaterThan(20);
  });

  test("a tape whose laboratory has a shared-link binding is linked", () => {
    const missing: string[] = [];
    for (const tape of tapes) {
      const hasBinding =
        existsSync(bindingFile(tape.experimentId, "tape.ts")) ||
        existsSync(bindingFile(tape.experimentId, "draftTape.ts"));
      // A laboratory that can carry settings in a link, whose tape carries none, is the defect.
      // The cause is read rather than the sentence: a tape dropped from the generator's binding
      // table is reported as "no-binding" and reads exactly like a laboratory that has none.
      if (hasBinding && !built.links[tape.tapeId]) {
        const cause = built.notLinked[tape.tapeId]?.cause;
        if (cause !== "refused" && cause !== "not-recordable" && cause !== "too-long")
          missing.push(`${tape.tapeId} (${cause ?? "absent"}, but ${tape.experimentId} has one)`);
      }
      if (!hasBinding && built.links[tape.tapeId])
        missing.push(`${tape.tapeId} (linked with none)`);
    }
    expect(missing).toEqual([]);
  });

  test("every generated link is restored by the laboratory it addresses", () => {
    const failures: string[] = [];
    let restored = 0;
    for (const [tapeId, link] of Object.entries(built.links)) {
      expect(link.href.length, `${tapeId} is over the permalink bound`).toBeLessThanOrEqual(
        MAX_PERMALINK_URL_LENGTH,
      );
      expect(link.href.startsWith(`/lab/${link.experimentId}/?tape=`)).toBe(true);
      const decoded = decodeTapePermalink(new URL(`https://annus-mirabilis.com${link.href}`));
      if (decoded.kind !== "success") {
        failures.push(`${tapeId}: the link does not decode (${decoded.kind})`);
        continue;
      }
      // Every setting the author recorded reaches the laboratory, with the value they recorded.
      const record = tapes.find((t) => t.tapeId === tapeId);
      for (const [key, value] of Object.entries(record?.initialConditions ?? {})) {
        const carried = decoded.tape.initialConditions[key];
        if (String(carried) !== String(value))
          failures.push(`${tapeId}: ${key} recorded ${value}, link carries ${String(carried)}`);
      }
      const session = SESSION_BINDINGS[link.experimentId];
      const draft = DRAFT_BINDINGS[link.experimentId];
      if (session) {
        const out = restoreTape(session, session.createSession(`${tapeId}-test`), decoded.tape);
        if (out.kind !== "restored")
          failures.push(`${tapeId}: ${out.kind} ${"notice" in out ? out.notice : ""}`);
        else restored += 1;
      } else if (draft) {
        const out = loadDraftTape(draft, decoded.tape);
        if (out.kind !== "loaded")
          failures.push(`${tapeId}: ${out.kind} ${"notice" in out ? out.notice : ""}`);
        else restored += 1;
      } else failures.push(`${tapeId}: no binding for ${link.experimentId}`);
    }
    expect(failures).toEqual([]);
    expect(restored).toBe(Object.keys(built.links).length);
  });

  test("the generator's binding table holds every binding in the tree", () => {
    const onDisk = new Set<string>();
    for (const tape of tapes) {
      if (
        existsSync(bindingFile(tape.experimentId, "tape.ts")) ||
        existsSync(bindingFile(tape.experimentId, "draftTape.ts"))
      )
        onDisk.add(tape.experimentId);
    }
    expect([...onDisk].length).toBeGreaterThan(10);
    expect([...onDisk].filter((lab) => !BOUND_LABORATORIES.includes(lab))).toEqual([]);
  });
});
