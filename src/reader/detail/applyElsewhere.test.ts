import { describe, expect, it } from "bun:test";
import {
  applyElsewhere,
  effectiveDetailForUnit,
  hasOverrides,
  initialOverrideState,
  setGlobalDetail,
  setUnitOverride,
} from "./applyElsewhere.ts";

describe("applyElsewhere (am-read-detail-axis-sfc)", () => {
  it("starts with no overrides", () => {
    const state = initialOverrideState(1);
    expect(state.globalDetail).toBe(1);
    expect(hasOverrides(state)).toBe(false);
    expect(state.lastOverrideLevel).toBeNull();
  });

  it("setUnitOverride sets an override and effectiveDetailForUnit prefers it over the global level", () => {
    const state = setUnitOverride(initialOverrideState(1), "unit-a", 2);
    expect(hasOverrides(state)).toBe(true);
    expect(effectiveDetailForUnit(state, "unit-a")).toBe(2);
    expect(effectiveDetailForUnit(state, "unit-b")).toBe(1);
    expect(state.lastOverrideLevel).toBe(2);
  });

  it("setUnitOverride replaces an existing override on the same unit and updates lastOverrideLevel", () => {
    let state = setUnitOverride(initialOverrideState(1), "unit-a", 2);
    state = setUnitOverride(state, "unit-a", 0);
    expect(effectiveDetailForUnit(state, "unit-a")).toBe(0);
    expect(state.overrides.size).toBe(1);
    expect(state.lastOverrideLevel).toBe(0);
  });

  it("setGlobalDetail changes the global level without touching overrides", () => {
    const withOverride = setUnitOverride(initialOverrideState(1), "unit-a", 2);
    const next = setGlobalDetail(withOverride, 0);
    expect(next.globalDetail).toBe(0);
    expect(next.overrides).toBe(withOverride.overrides);
    expect(hasOverrides(next)).toBe(true);
    expect(effectiveDetailForUnit(next, "unit-a")).toBe(2);
  });

  it("setGlobalDetail is a no-op (same reference) when the level is unchanged", () => {
    const state = initialOverrideState(1);
    expect(setGlobalDetail(state, 1)).toBe(state);
  });

  it("applyElsewhere is a harmless no-op when no override exists", () => {
    const state = initialOverrideState(1);
    expect(applyElsewhere(state)).toBe(state);
  });

  it("applyElsewhere clears all overrides and sets the global level to the one most recently overridden", () => {
    let state = setUnitOverride(initialOverrideState(1), "unit-a", 2);
    state = setUnitOverride(state, "unit-b", 0);
    expect(state.overrides.size).toBe(2);

    const next = applyElsewhere(state);
    expect(next.globalDetail).toBe(0);
    expect(hasOverrides(next)).toBe(false);
    expect(next.lastOverrideLevel).toBeNull();
    expect(effectiveDetailForUnit(next, "unit-a")).toBe(0);
    expect(effectiveDetailForUnit(next, "unit-b")).toBe(0);
  });

  it("a global change made while an override exists leaves that override in place", () => {
    const withOverride = setUnitOverride(initialOverrideState(1), "unit-a", 2);
    const afterGlobalChange = setGlobalDetail(withOverride, 0);
    expect(hasOverrides(afterGlobalChange)).toBe(true);
    expect(effectiveDetailForUnit(afterGlobalChange, "unit-a")).toBe(2);
    expect(afterGlobalChange.globalDetail).toBe(0);
  });
});
