/**
 * The negatives that have to hold after the one-way pin door was widened (am-cf6m).
 *
 * The widening is only safe if the DEFAULT is still refusal. Each test below is an attempt to
 * replace a pinned facsimile without the owner's words, and each must be refused. If any of
 * these ever passes, scripts/sources/supersedePin.ts has stopped being a narrow exception and
 * has become a way to overwrite pinned provenance, which AGENTS.md Rule 1 forbids.
 */

import { describe, expect, test } from "bun:test";
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

function refusalFor(key: string, auth: SupersedeAuthorization | undefined): string {
  try {
    assertSupersedeAuthorized(key, auth);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return "";
}

describe("superseding a pinned facsimile refuses by default (am-cf6m)", () => {
  test("no authorization at all is refused, and says why", () => {
    const message = refusalFor("ap-17-549", undefined);
    expect(message).toContain("requires an authorization record");
    expect(message).toContain("Rule 1");
  });

  test("an authorization for a DIFFERENT key does not reach this one", () => {
    // The real hazard: one authorization was granted for ap-17-549 and conditionally for two
    // others. An authorization for one facsimile is not an authorization for another.
    const message = refusalFor("ap-19-289", GOOD);
    expect(message).toContain("does not reach 'ap-19-289'");
  });

  test("a summary instead of the authorizing words is refused", () => {
    const message = refusalFor("ap-17-549", { ...GOOD, authorizationText: "approved" });
    expect(message).toContain("quoted verbatim");
  });

  test("an empty authorization text is refused and reports that it got nothing", () => {
    const message = refusalFor("ap-17-549", { ...GOOD, authorizationText: "   " });
    expect(message).toContain("quoted verbatim");
  });

  test("an unnamed authorizer is refused", () => {
    expect(refusalFor("ap-17-549", { ...GOOD, authorizedBy: "" })).toContain(
      "requires naming who authorized it",
    );
  });

  test("a supersede with no checkable reason is refused", () => {
    expect(refusalFor("ap-17-549", { ...GOOD, reason: "" })).toContain("requires a reason");
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
