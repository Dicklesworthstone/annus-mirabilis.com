import { describe, expect, test } from "bun:test";
import { checkPointerVoice, pointerVoiceOk } from "./pointerVoice.ts";
import type { WeavePredicate } from "./types.ts";

describe("checkPointerVoice", () => {
  test("accepts valid assumption-active pointer", () => {
    const predicate: WeavePredicate = {
      id: "p1",
      instrumentId: "bm-01",
      targets: ["s1-p1"],
      meaning: "assumption-active",
      pointerText: "The system is evolving under standard thermal agitation.",
      conditions: [],
    };
    expect(pointerVoiceOk(predicate)).toBe(true);
    expect(checkPointerVoice(predicate)).toEqual([]);
  });

  const overclaimTexts = [
    "This is now true.",
    "This is now correct.",
    "This has been proved.",
    "This has been proven.",
    "This is verified.",
  ];
  for (const text of overclaimTexts) {
    test(`rejects overclaim: ${text}`, () => {
      const predicate: WeavePredicate = {
        id: "p2",
        instrumentId: "bm-01",
        targets: ["s1-p1"],
        meaning: "quantity-compared",
        pointerText: text,
        conditions: [],
      };
      const violations = checkPointerVoice(predicate);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.rule === "weave-voice-overclaim")).toBe(true);
    });
  }

  const agreementTexts = [
    "This agrees with the model.",
    "This matches the prediction.",
    "This confirms the theory.",
    "Exactly as predicted.",
  ];
  for (const text of agreementTexts) {
    test(`rejects agreement language when outside domain: ${text}`, () => {
      const predicate: WeavePredicate = {
        id: "p3",
        instrumentId: "bm-01",
        targets: ["s1-p1"],
        meaning: "outside-selected-domain",
        pointerText: text,
        conditions: [],
      };
      const violations = checkPointerVoice(predicate);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.rule === "weave-voice-outside-domain-claims-agreement")).toBe(
        true,
      );
    });
  }

  test("statistical agreement pointer requires bound, significance, sample size, and seed", () => {
    const incompletePredicate: WeavePredicate = {
      id: "p4",
      instrumentId: "bm-01",
      targets: ["s1-p1"],
      meaning: "agreement-within-stated-bound",
      pointerText: "Observed values stay within the bound.",
      conditions: [
        {
          kind: "agreement",
          statisticQuantityId: "mean",
          sampleCountQuantityId: "N",
          minimumSampleSize: 100,
          boundFamily: "dkw",
          enterAlpha: 0.05,
          exitAlpha: 0.1,
        },
      ],
    };
    const violations = checkPointerVoice(incompletePredicate);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.rule === "weave-voice-agreement-underspecified")).toBe(true);

    const completePredicate: WeavePredicate = {
      id: "p4-complete",
      instrumentId: "bm-01",
      targets: ["s1-p1"],
      meaning: "agreement-within-stated-bound",
      pointerText: "Agreement within DKW bound at alpha = 0.05, sample size N = 500, fixed seed.",
      conditions: [
        {
          kind: "agreement",
          statisticQuantityId: "mean",
          sampleCountQuantityId: "N",
          minimumSampleSize: 100,
          boundFamily: "dkw",
          enterAlpha: 0.05,
          exitAlpha: 0.1,
        },
      ],
    };
    expect(pointerVoiceOk(completePredicate)).toBe(true);
  });

  test("deterministic agreement pointer requires bound or tolerance", () => {
    const incompletePredicate: WeavePredicate = {
      id: "p5",
      instrumentId: "bm-01",
      targets: ["s1-p1"],
      meaning: "agreement-within-stated-bound",
      pointerText: "The value matches the formula.",
      conditions: [],
    };
    const violations = checkPointerVoice(incompletePredicate);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.rule === "weave-voice-agreement-underspecified")).toBe(true);

    const completePredicate: WeavePredicate = {
      id: "p5-complete",
      instrumentId: "bm-01",
      targets: ["s1-p1"],
      meaning: "agreement-within-stated-bound",
      pointerText: "Computed value matches prediction within numerical tolerance of 1e-4.",
      conditions: [],
    };
    expect(pointerVoiceOk(completePredicate)).toBe(true);
  });
});
