/**
 * BM-02's AND LQ-02's SHARED LINKS, THE TWO THAT HAD NONE (am-inst-permalink-tape-s677).
 *
 * Measured 2026-10-12: of 27 reader-facing laboratories, these two offered a reader no way to keep
 * an arrangement. The other 25 did, 24 through the generic tape and 3 through their own settings
 * codec (two of them do both). `src/testing/labShareLinks.test.ts` is the guard that asks the
 * question; this file is the proof that the two new bindings carry settings correctly.
 *
 * NEITHER IS A WORKER LABORATORY, which is why they are not in `workerLabDraftTapes.test.tsx`:
 * `computeBm02Snapshot` and LQ-02's allocation are pure functions of accepted inputs, with no
 * session controller, no prepared example JSON and no stream. So the round trip is driven at the
 * module level rather than through a mounted component, and the component half is held by the
 * census guard above plus the typechecker.
 *
 * THE MANIFEST AGREEMENT IS HERE ON PURPOSE. I hand-wrote `modelId` and `modelVersion` into both
 * bindings from `content/experiments/<id>.yaml`, and a copy-paste there would be invisible: a tape
 * minted under the wrong model id round-trips perfectly against itself and is refused only when a
 * reader opens a link in the laboratory it names. Reading the YAML back is the cheap check that the
 * declaration matches its source.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../content/provenance/yaml.ts";
import { BM02_DRAFT_TAPE } from "../experiments/bm02/draftTape.ts";
import { LQ02_DRAFT_TAPE } from "../experiments/lq02/draftTape.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../experiments/permalink/codec.ts";
import {
  type DraftTapeBinding,
  draftTapeForSettings,
  loadDraftTape,
} from "../experiments/permalink/draftTape.ts";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** The laboratory's own manifest, which is where the tape model is declared. */
function tapeModelOf(experimentId: string): { modelId: string; modelVersion: number } {
  const raw = parseYaml(
    readFileSync(join(ROOT, "content/experiments", `${experimentId}.yaml`), "utf8"),
  ) as Record<string, unknown>;
  const model = raw.tapeModel as Record<string, unknown>;
  return { modelId: String(model.modelId), modelVersion: Number(model.modelVersion) };
}

/** Settings out and back, through the same encoder a reader's address bar carries. */
function roundTrip(
  binding: DraftTapeBinding,
  settings: object,
): Readonly<Record<string, unknown>> | string {
  const tape = draftTapeForSettings(binding, settings);
  if (tape === null) return "no tape minted";
  const decoded = decodeTapePermalink(`?tape=${encodeTapePermalink(tape)}`);
  if (decoded.kind !== "success") return `decode ${decoded.kind}`;
  const loaded = loadDraftTape(binding, decoded.tape);
  // `absent` carries no notice, so the kind is always reported and the reason only when there is
  // one. A template that assumed a notice would not compile, which is how this was found.
  if (loaded.kind !== "loaded")
    return `load ${loaded.kind}${"notice" in loaded ? `: ${loaded.notice}` : ""}`;
  return loaded.settings;
}

const CASES = [
  {
    id: "bm-02",
    binding: BM02_DRAFT_TAPE,
    // A changed particle count and temperature: the two a reader is most likely to share.
    changed: { Np: 4000, T: 310.15 },
    // Outside the declared domain: a radius of zero is refused by name (dispatch 184).
    refused: { a_um: 0 },
  },
  {
    id: "lq-02",
    binding: LQ02_DRAFT_TAPE,
    changed: { T: 2500, nuCutoff: 2e14 },
    // A temperature of zero violates the manifest's `min: 0, minInclusive: false`.
    //
    // NOT a probe frequency above the cutoff, which is what I reached for first and which this
    // laboratory ACCEPTS by design. `src/experiments/lq02/parameters.ts` says so in its own
    // docblock: "A probe frequency above the cutoff is not refused here: the session answers it
    // with a typed outside-domain result." That is the typed-result discipline rather than a gap,
    // so a link may carry it and the laboratory answers honestly; refusing it here would have
    // asserted the opposite of the design.
    refused: { T: 0 },
  },
] as const;

describe("the two form laboratories that had no shared link now carry their settings", () => {
  for (const { id, binding, changed, refused } of CASES) {
    test(`${id}: the binding's model matches its manifest`, () => {
      const declared = tapeModelOf(id);
      expect(binding.environment.experimentId).toBe(id);
      expect(binding.environment.modelId).toBe(declared.modelId);
      expect(binding.environment.modelVersion).toBe(declared.modelVersion);
      // The laboratory draws no random numbers, so these are the honest values, not placeholders.
      expect(binding.environment.streamVersion).toBe("deterministic");
      expect(binding.environment.allocationId).toBe("deterministic");
    });

    test(`${id}: changed settings survive the round trip`, () => {
      const settings = { ...binding.defaults, ...changed };
      const back = roundTrip(binding, settings);
      expect(typeof back).not.toBe("string");
      // Every field the laboratory declares comes back, not merely the ones that changed.
      for (const [key, value] of Object.entries(settings))
        expect((back as Record<string, unknown>)[key]).toEqual(value);
    });

    test(`${id}: the defaults round trip too, so the no-change case is not special`, () => {
      const back = roundTrip(binding, { ...binding.defaults });
      expect(typeof back).not.toBe("string");
      for (const [key, value] of Object.entries(binding.defaults))
        expect((back as Record<string, unknown>)[key]).toEqual(value);
    });

    test(`${id}: a setting outside the declared domain mints no tape (planted negative)`, () => {
      // The arm that makes the round trips above mean something: if the binding validated nothing,
      // every case would pass and a link could carry a state the laboratory refuses.
      expect(roundTrip(binding, { ...binding.defaults, ...refused })).toBe("no tape minted");
    });
  }

  test("a tape minted in one of the two is refused by the other", () => {
    // The identity half: the environment is not decoration. A reader who pastes a BM-02 link into
    // LQ-02 is told so rather than shown LQ-02 drawing BM-02's numbers.
    const tape = draftTapeForSettings(BM02_DRAFT_TAPE, { ...BM02_DRAFT_TAPE.defaults });
    expect(tape).not.toBeNull();
    if (tape === null) return;
    const decoded = decodeTapePermalink(`?tape=${encodeTapePermalink(tape)}`);
    expect(decoded.kind).toBe("success");
    if (decoded.kind !== "success") return;
    const loaded = loadDraftTape(LQ02_DRAFT_TAPE, decoded.tape);
    expect(loaded.kind).toBe("not-restored");
  });
});
