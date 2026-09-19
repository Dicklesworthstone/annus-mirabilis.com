/**
 * Refusal coverage for discovery link construction (am-muyh).
 *
 * No test imported this module. Both of its throw sites, and the whole of
 * resolveJourneyReturn -- whose own comment is a security invariant, "Never
 * accept a caller-provided return URL" -- could be deleted with the repository
 * green. A plant sweep found it; these are the accept/reject pairs.
 */

import { describe, expect, test } from "bun:test";
import type { DiscoveryJourney } from "../content/schemas/discovery.ts";
import {
  advanceJourneyReturn,
  type JourneyNavigation,
  journeyNavigation,
  labHref,
  resolveJourneyReturn,
  stepHref,
} from "./links.ts";

const CITATION = {
  label: "Ann. Phys. 17, 549",
  url: "https://example.invalid/ap-17-549",
  locator: "p. 549",
};

function stage(id: string, labIds: readonly string[]) {
  return {
    id,
    title: `Stage ${id}`,
    role: "question" as const,
    dependsOn: [] as readonly string[],
    premises: [] as readonly string[],
    question: "What would make a reasonable person suspect this?",
    overview: [] as readonly string[],
    qualifications: [] as readonly string[],
    reasoning: [] as readonly string[],
    alternatives: [],
    labs: labIds.map((id) => ({
      id,
      title: `Lab ${id}`,
      task: "Change one input.",
      observe: "Read the accepted snapshot.",
    })),
    paperLocator: "§4",
    unavailable: null,
  };
}

const JOURNEY: DiscoveryJourney = Object.freeze({
  kind: "discovery-journey",
  schemaVersion: 1,
  id: "journey-brownian-motion",
  paper: "brownian-motion",
  revision: "1",
  reviewState: "machine-draft",
  title: "A route you could take",
  question: "Why does a suspended particle never settle?",
  introduction: [],
  scope: [],
  source: CITATION,
  shelf: [],
  stages: [stage("observable", ["bm-01"]), stage("diffusion", ["bm-05", "bm-06"])],
  evidence: [],
  conclusion: [],
});

const NAVIGATION: readonly JourneyNavigation[] = [journeyNavigation(JOURNEY)];

describe("stepHref (links.ts:29) refuses an address it cannot vouch for", () => {
  test("accepts the four discovery papers with a well-formed step id", () => {
    expect(stepHref("brownian-motion", "observable")).toBe(
      "/discover/brownian-motion/#step-observable",
    );
    expect(stepHref("mass-energy", "two-ledgers")).toBe("/discover/mass-energy/#step-two-ledgers");
  });

  test("refuses a paper outside the four, including the companion dissertation", () => {
    expect(() => stepHref("molecular-dimensions", "observable")).toThrow(TypeError);
    expect(() => stepHref("../../etc", "observable")).toThrow("Invalid discovery address.");
  });

  test("refuses a step id that could carry anything but a step id", () => {
    for (const bad of [
      "Observable",
      "step id",
      "step/../..",
      "-leading",
      "trailing-",
      "a--b",
      "x".repeat(97),
    ]) {
      expect(() => stepHref("brownian-motion", bad)).toThrow(TypeError);
    }
    // 96 characters is the boundary and is admitted; 97 is not.
    expect(() => stepHref("brownian-motion", "a".repeat(96))).not.toThrow();
  });
});

describe("labHref (links.ts:35) refuses a laboratory the step does not offer", () => {
  test("accepts a laboratory the stage lists, and carries the journey and step forward", () => {
    expect(labHref(JOURNEY, "diffusion", "bm-05")).toBe(
      "/lab/bm-05/?journey=brownian-motion&step=diffusion",
    );
  });

  test("refuses a real laboratory that belongs to a different step", () => {
    expect(() => labHref(JOURNEY, "diffusion", "bm-01")).toThrow(
      "That laboratory is not part of this discovery step.",
    );
  });

  test("refuses an unknown step and an unknown laboratory", () => {
    expect(() => labHref(JOURNEY, "no-such-step", "bm-05")).toThrow(TypeError);
    expect(() => labHref(JOURNEY, "observable", "sr-03")).toThrow(TypeError);
  });
});

describe("resolveJourneyReturn never accepts a caller-provided return address", () => {
  test("accepts a handoff whose journey, step and current laboratory all agree", () => {
    const back = resolveJourneyReturn(
      "?journey=brownian-motion&step=observable",
      "/lab/bm-01/",
      NAVIGATION,
    );
    expect(back?.href).toBe("/discover/brownian-motion/#step-observable");
    expect(back?.stepTitle).toBe("Stage observable");
  });

  test("refuses when the current laboratory is not in the named step", () => {
    // bm-05 is real and the step is real, but the step does not offer it.
    expect(
      resolveJourneyReturn("?journey=brownian-motion&step=observable", "/lab/bm-05/", NAVIGATION),
    ).toBeNull();
  });

  test("refuses an unknown journey, an unknown step, and a path that is not a laboratory", () => {
    expect(
      resolveJourneyReturn(
        "?journey=special-relativity&step=observable",
        "/lab/bm-01/",
        NAVIGATION,
      ),
    ).toBeNull();
    expect(
      resolveJourneyReturn("?journey=brownian-motion&step=nope", "/lab/bm-01/", NAVIGATION),
    ).toBeNull();
    expect(
      resolveJourneyReturn(
        "?journey=brownian-motion&step=observable",
        "/papers/brownian-motion/",
        NAVIGATION,
      ),
    ).toBeNull();
  });

  test("refuses a repeated parameter, so a second value cannot smuggle a different target", () => {
    expect(
      resolveJourneyReturn(
        "?journey=brownian-motion&journey=mass-energy&step=observable",
        "/lab/bm-01/",
        NAVIGATION,
      ),
    ).toBeNull();
    expect(
      resolveJourneyReturn(
        "?journey=brownian-motion&step=observable&step=diffusion",
        "/lab/bm-01/",
        NAVIGATION,
      ),
    ).toBeNull();
  });

  test("refuses an over-long query outright rather than parsing it", () => {
    const long = `?journey=brownian-motion&step=observable&pad=${"x".repeat(2100)}`;
    expect(long.length).toBeGreaterThan(2048);
    expect(resolveJourneyReturn(long, "/lab/bm-01/", NAVIGATION)).toBeNull();
  });
});

describe("advanceJourneyReturn keeps an admitted handoff scoped to its own laboratory", () => {
  const admitted = advanceJourneyReturn(
    null,
    "?journey=brownian-motion&step=observable",
    "/lab/bm-01/",
    NAVIGATION,
  );

  test("retains the target across a settings change on the same laboratory", () => {
    const next = advanceJourneyReturn(admitted, "?tape=abc", "/lab/bm-01/", NAVIGATION);
    expect(next.target?.href).toBe("/discover/brownian-motion/#step-observable");
    expect(next).toBe(admitted); // unchanged state is returned identically
  });

  test("does not let another laboratory inherit the handoff", () => {
    expect(advanceJourneyReturn(admitted, "", "/lab/bm-05/", NAVIGATION).target).toBeNull();
  });

  test("clears the handoff when an explicit one is invalid, rather than reviving the older address", () => {
    const next = advanceJourneyReturn(
      admitted,
      "?journey=mass-energy&step=observable",
      "/lab/bm-01/",
      NAVIGATION,
    );
    expect(next.target).toBeNull();
  });
});
