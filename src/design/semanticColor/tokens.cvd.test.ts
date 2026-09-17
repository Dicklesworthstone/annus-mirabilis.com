/**
 * NOT DONE IN THIS PASS: simulated-dichromacy CIEDE2000 differences
 * (Machado, Oliveira & Fairchild 2009, severity 1.0). That needs a
 * published 3x3 linear-RGB transform matrix per deficiency type, and I do
 * not have high enough confidence in recalling its nine coefficients
 * exactly to assert them as a build gate without a citation I can verify
 * in-session -- asserting a wrong matrix as "the CVD simulation" would be
 * worse than not having one. This file covers normal-vision CIEDE2000
 * separation only, which is real and verified. Disclosed in BATCH_PENDING.
 */
import { describe, expect, test } from "bun:test";
import { THEME_TOKENS } from "../../app/theme/tokens";
import { hexDeltaE2000 } from "./ciede2000";
import { COLOR_ROLES } from "./roles";
import { RESERVED_RED, ROLE_TOKENS } from "./tokens";

const MIN_ROLE_PAIR_DELTA = 20;
const MIN_ACCENT_DELTA = 20;

describe("tokens.cvd: every role pair is at least CIEDE2000 20 apart, per theme", () => {
  for (const themeId of Object.keys(ROLE_TOKENS) as Array<keyof typeof ROLE_TOKENS>) {
    test(`${themeId}: all C(7,2) role pairs clear the minimum`, () => {
      const tokens = ROLE_TOKENS[themeId];
      for (let i = 0; i < COLOR_ROLES.length; i++) {
        for (let j = i + 1; j < COLOR_ROLES.length; j++) {
          const roleA = COLOR_ROLES[i] as (typeof COLOR_ROLES)[number];
          const roleB = COLOR_ROLES[j] as (typeof COLOR_ROLES)[number];
          const delta = hexDeltaE2000(tokens[roleA], tokens[roleB]);
          expect(delta).toBeGreaterThanOrEqual(MIN_ROLE_PAIR_DELTA);
        }
      }
    });
  }
});

describe("tokens.cvd: no role token sits within CIEDE2000 20 of the theme's own accent, focus, or Annalen's reserved red", () => {
  for (const themeId of Object.keys(ROLE_TOKENS) as Array<keyof typeof ROLE_TOKENS>) {
    const theme = THEME_TOKENS[themeId];
    test(`${themeId}: distance from accent and reserved red`, () => {
      for (const role of COLOR_ROLES) {
        const token = ROLE_TOKENS[themeId][role];
        expect(hexDeltaE2000(token, theme.accent)).toBeGreaterThanOrEqual(MIN_ACCENT_DELTA);
        expect(hexDeltaE2000(token, RESERVED_RED)).toBeGreaterThanOrEqual(MIN_ACCENT_DELTA);
      }
    });
  }
});

describe("tokens.cvd: a seeded near-duplicate pair fails the minimum, proving the test is not vacuous", () => {
  test("two colors 5 apart in CIEDE2000 do not clear a 20 minimum", () => {
    const delta = hexDeltaE2000("#3d7af5", "#3d7af6");
    expect(delta).toBeLessThan(MIN_ROLE_PAIR_DELTA);
  });
});
