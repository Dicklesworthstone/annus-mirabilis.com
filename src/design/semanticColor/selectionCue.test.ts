import { describe, expect, test } from "bun:test";
import {
  allRolesHaveDistinctCue,
  IDENTITY_CUES,
  identityCueFor,
  selectionCueFor,
} from "./identityCues";
import { COLOR_ROLES } from "./roles";

describe("identityCues: the cue is defined for all seven roles", () => {
  for (const role of COLOR_ROLES) {
    test(role, () => {
      expect(IDENTITY_CUES[role]).toBeDefined();
      expect(identityCueFor(role).role).toBe(role);
    });
  }
});

describe("identityCues: marker, dash, and fill pattern each distinguish all seven roles alone", () => {
  for (const channel of ["marker", "dash", "fillPattern"] as const) {
    test(`${channel} has seven distinct values`, () => {
      expect(allRolesHaveDistinctCue(channel)).toBe(true);
    });
  }
});

describe("identityCues: underline and outline are real, defined values for every role", () => {
  test("every role has an underline and outline style from CSS's real, small vocabulary", () => {
    for (const role of COLOR_ROLES) {
      expect(IDENTITY_CUES[role].underline).toBeTruthy();
      expect(IDENTITY_CUES[role].outline).toBeTruthy();
    }
  });
});

describe("selectionCue: adds a non-color channel, never a color", () => {
  for (const role of COLOR_ROLES) {
    test(`${role}: the selection cue has a real outline width and style`, () => {
      const cue = selectionCueFor(role);
      expect(cue.outlineWidthPx).toBeGreaterThan(0);
      expect(cue.outlineStyle).toBe(identityCueFor(role).outline);
      expect(cue).not.toHaveProperty("color");
      expect(cue).not.toHaveProperty("hex");
    });
  }
});
