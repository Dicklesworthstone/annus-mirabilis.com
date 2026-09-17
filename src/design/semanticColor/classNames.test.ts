import { describe, expect, test } from "bun:test";
import { ROLE_CLASS_NAMES, roleClassName } from "./classNames";
import { COLOR_ROLES } from "./roles";

describe("roleClassName: exactly am-role-<role>", () => {
  for (const role of COLOR_ROLES) {
    test(role, () => {
      expect(roleClassName(role)).toBe(`am-role-${role}`);
    });
  }
});

describe("ROLE_CLASS_NAMES: the enumerated set the KaTeX trust callback admits", () => {
  test("has exactly seven entries, one per declared role, no more and no fewer", () => {
    expect(ROLE_CLASS_NAMES.length).toBe(COLOR_ROLES.length);
    expect(new Set(ROLE_CLASS_NAMES).size).toBe(COLOR_ROLES.length);
  });
});
