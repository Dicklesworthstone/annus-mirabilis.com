import { describe, expect, test } from "bun:test";
import { contrastRatio } from "../../a11y/readingSettings/contrast";
import { THEME_TOKENS } from "../../app/theme/tokens";
import { COLOR_ROLES } from "./roles";
import { ROLE_TOKENS } from "./tokens";

describe("tokens.contrast: every role color meets WCAG AA text contrast (4.5:1) on its theme's paper", () => {
  for (const themeId of Object.keys(ROLE_TOKENS) as Array<keyof typeof ROLE_TOKENS>) {
    const paper = THEME_TOKENS[themeId].paper;
    for (const role of COLOR_ROLES) {
      test(`${themeId}: ${role}`, () => {
        const ratio = contrastRatio(ROLE_TOKENS[themeId][role], paper);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
