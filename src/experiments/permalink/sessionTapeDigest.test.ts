import { describe, expect, test } from "bun:test";
import { LQ08_DEFAULTS } from "../lq08/definition.ts";
import { LQ08_TAPE } from "../lq08/tape.ts";
import { SR09_TAPE } from "../sr09/tape.ts";
import { computeTapeDigest } from "../tape/controlTape.ts";
import { decodeTapePermalink, encodeTapePermalink } from "./codec.ts";
import {
  digestFormOf,
  restoreTape,
  tapeForSettings,
  tapeStateDigest,
  tapeStateDigestV2,
} from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";

/**
 * A tape's checkpoint digest tells settings apart at every scale, and a link keeps verifying in the
 * form it was shared in (am-inst-permalink-tape-s677).
 *
 * The first form rounded each number to an absolute 10⁻⁶, so every value below 5 × 10⁻⁷ read as 0:
 * BM-04's 8 fN force hashed the same as 12 fN. The second writes each number to 12 significant
 * digits, in 64 bits. Links carry one of three forms, and each still restores.
 */
describe("the checkpoint digest", () => {
  test("the first form cannot tell 8 fN from 12 fN; the second can", () => {
    expect(tapeStateDigest({ F: 8.09e-15 }, 0)).toBe(tapeStateDigest({ F: 1.21e-14 }, 0));
    expect(tapeStateDigestV2({ F: 8.09e-15 }, 0)).not.toBe(tapeStateDigestV2({ F: 1.21e-14 }, 0));
    expect(tapeStateDigestV2({ a: 3e-7 }, 0)).not.toBe(tapeStateDigestV2({ a: 4e-7 }, 0));
  });

  test("the second form is the same for the same settings in any key order, and not across action index", () => {
    const a = tapeStateDigestV2({ T: 290.15, eta: 0.00135, mode: "1905" }, 2);
    expect(tapeStateDigestV2({ mode: "1905", eta: 0.00135, T: 290.15 }, 2)).toBe(a);
    expect(tapeStateDigestV2({ T: 290.15, eta: 0.00135, mode: "1905" }, 3)).not.toBe(a);
    expect(a).toMatch(/^host:[0-9a-f]{16}$/);
  });

  test("each form is read from its prefix", () => {
    expect(digestFormOf("host:0123abcd0123abcd")).toBe("fnv1a64");
    expect(digestFormOf("host:fnv1a:0123abcd")).toBe("fnv1a");
    expect(digestFormOf("host:0123abcd")).toBe("lq08-legacy");
  });
});

describe("a link restores in the form it was shared in", () => {
  const sr09 = { ...SR09_TAPE.defaults, beta: 0.8 };

  const restored = (binding: typeof SR09_TAPE, tape: TapeV2) => {
    const decoded = decodeTapePermalink(`https://x.test/?tape=${encodeTapePermalink(tape)}`);
    expect(decoded.kind).toBe("success");
    if (decoded.kind !== "success") return null;
    const session = binding.createSession("digest-form-test");
    return {
      result: restoreTape(binding, session, decoded.tape),
      after: session.acceptedParameters(),
    };
  };

  test("a new link carries the second form, and restores", () => {
    const tape = tapeForSettings(SR09_TAPE, sr09);
    expect(tape?.acceptedCheckpoint.digest).toMatch(/^host:[0-9a-f]{16}$/);
    if (!tape) return;
    const r = restored(SR09_TAPE, tape);
    expect(r?.result).toEqual({ kind: "restored" });
    expect(r?.after).toEqual(sr09);
  });

  test("a link shared in the first form still restores", () => {
    const tape = tapeForSettings(SR09_TAPE, sr09);
    if (!tape) throw new Error("no tape");
    const first: TapeV2 = {
      ...tape,
      acceptedCheckpoint: {
        ...tape.acceptedCheckpoint,
        digest: tapeStateDigest(tape.initialConditions, 0),
      },
    };
    expect(first.acceptedCheckpoint.digest).toMatch(/^host:fnv1a:/);
    const r = restored(SR09_TAPE, first);
    expect(r?.result).toEqual({ kind: "restored" });
    expect(r?.after).toEqual(sr09);
  });

  test("an LQ-08 link from before the general runner still restores", () => {
    const shared = { ...LQ08_DEFAULTS, frequency: 9.1e14 };
    const tape = tapeForSettings(LQ08_TAPE, shared);
    if (!tape) throw new Error("no tape");
    const numeric: Record<string, number> = {};
    for (const [k, v] of Object.entries(tape.initialConditions))
      if (typeof v === "number") numeric[k] = v;
    const legacy: TapeV2 = {
      ...tape,
      acceptedCheckpoint: {
        ...tape.acceptedCheckpoint,
        digest: computeTapeDigest(numeric, 0, 0).digest,
      },
    };
    expect(legacy.acceptedCheckpoint.digest).toMatch(/^host:[0-9a-f]{8}$/);
    const r = restored(LQ08_TAPE, legacy);
    expect(r?.result).toEqual({ kind: "restored" });
    expect(r?.after).toEqual(shared);
  });

  test("a digest that matches no form refuses the link and leaves the settings", () => {
    const tape = tapeForSettings(SR09_TAPE, sr09);
    if (!tape) throw new Error("no tape");
    const r = restored(SR09_TAPE, {
      ...tape,
      acceptedCheckpoint: { ...tape.acceptedCheckpoint, digest: "host:0000000000000000" },
    });
    expect(r?.result.kind).toBe("not-restored");
    expect(r?.after).toEqual(SR09_TAPE.defaults);
  });
});
