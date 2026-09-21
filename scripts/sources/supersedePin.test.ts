/**
 * The negatives that have to hold after the one-way pin door was widened (am-cf6m).
 *
 * The widening is only safe if the DEFAULT is still refusal. Each test below is an attempt to
 * replace a pinned facsimile without the owner's words, and each must be refused. If any of
 * these ever passes, scripts/sources/supersedePin.ts has stopped being a narrow exception and
 * has become a way to overwrite pinned provenance, which AGENTS.md Rule 1 forbids.
 */

import { describe, expect, test } from "bun:test";
import { FacsimileError } from "./facsimileSourceSchema.ts";
import {
  assertSupersedeAuthorized,
  retiredPinPath,
  type SupersedeAuthorization,
} from "./supersedePin.ts";

const GOOD: SupersedeAuthorization = {
  authorizedBy: "jemanuel",
  authorizationText: "Authorize re-extract + re-pin",
  authorizedOn: "2026-09-20",
  keys: ["ap-17-549"],
  reason:
    "The pinned extract's first page is printed 508 by L. Hermann, not printed 549 by Einstein.",
};

/**
 * The refusal itself, code and message together.
 *
 * am-muyh. These five sites all throw `pinned-digest-conflict` and the tests below have always told
 * them apart by MESSAGE, which is the only thing that distinguishes them: five throws in one
 * function, one code. The refusal ratchet credits a site when a test names the QUOTED CODE, so it
 * credited none of this file - five genuinely discriminated sites, scored zero - while a single
 * `expect(err.code).toBe("pinned-digest-conflict")` that distinguishes nothing would have credited
 * all nine sites in this module.
 *
 * Both assertions are made from here on: the code so the measurement can see the coverage, the
 * message because it is the assertion that would fail if the wrong throw fired. Deleting any one of
 * these five refusals fails the test that drives it, which the code assertion alone would not do.
 */
function refusal(
  key: string,
  auth: SupersedeAuthorization | undefined,
): { code: string; message: string } {
  try {
    assertSupersedeAuthorized(key, auth);
  } catch (err) {
    if (err instanceof FacsimileError) return { code: err.code, message: err.message };
    return {
      code: "not-a-FacsimileError",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  return { code: "no-refusal", message: "" };
}

describe("superseding a pinned facsimile refuses by default (am-cf6m)", () => {
  test("no authorization at all is refused, and says why", () => {
    const { code, message } = refusal("ap-17-549", undefined);
    expect(code).toBe("pinned-digest-conflict");
    expect(message).toContain("requires an authorization record");
    expect(message).toContain("Rule 1");
  });

  test("an authorization for a DIFFERENT key does not reach this one", () => {
    // The real hazard: one authorization was granted for ap-17-549 and conditionally for two
    // others. An authorization for one facsimile is not an authorization for another.
    const { code, message } = refusal("ap-19-289", GOOD);
    expect(code).toBe("pinned-digest-conflict");
    expect(message).toContain("does not reach 'ap-19-289'");
  });

  test("a summary instead of the authorizing words is refused", () => {
    const { code, message } = refusal("ap-17-549", { ...GOOD, authorizationText: "approved" });
    expect(code).toBe("pinned-digest-conflict");
    expect(message).toContain("quoted verbatim");
  });

  test("an empty authorization text is refused and reports that it got nothing", () => {
    // Both branches of this one throw's message, which is the only thing distinguishing it from
    // the four other pinned-digest-conflict refusals in the same function. Whitespace trims to
    // zero characters; an empty string is falsy and reports having got nothing at all.
    const whitespace = refusal("ap-17-549", { ...GOOD, authorizationText: "   " });
    expect(whitespace.code).toBe("pinned-digest-conflict");
    expect(whitespace.message).toContain("quoted verbatim");
    expect(whitespace.message).toContain("0 characters");

    const { code, message } = refusal("ap-17-549", { ...GOOD, authorizationText: "" });
    expect(code).toBe("pinned-digest-conflict");
    expect(message).toContain("nothing");
  });

  test("an unnamed authorizer is refused", () => {
    const { code, message } = refusal("ap-17-549", { ...GOOD, authorizedBy: "" });
    expect(code).toBe("pinned-digest-conflict");
    expect(message).toContain("requires naming who authorized it");
  });

  test("a supersede with no checkable reason is refused", () => {
    const { code, message } = refusal("ap-17-549", { ...GOOD, reason: "" });
    expect(code).toBe("pinned-digest-conflict");
    expect(message).toContain("requires a reason");
  });

  test("the genuine authorization passes, so the negatives above are not vacuous", () => {
    // Without this the six refusals could all be produced by a function that refuses everything.
    expect(() => assertSupersedeAuthorized("ap-17-549", GOOD)).not.toThrow();
  });
});

describe("retired pins are content-addressed so two retirements never collide", () => {
  test("the retired path carries the key and the outgoing digest", () => {
    const p = retiredPinPath(
      "ap-17-549",
      "c42f9ac278283bdaaee83b2c4ec0154645d4e4adc4249f8a62c45ed2e51c135f",
    );
    expect(p).toBe("public/papers/pdfs/retired/ap-17-549-c42f9ac27828.pdf");
  });

  test("two different outgoing digests for one key retire to different files", () => {
    const a = retiredPinPath("ap-19-289", "a".repeat(64));
    const b = retiredPinPath("ap-19-289", "b".repeat(64));
    expect(a).not.toBe(b);
  });
});
