/**
 * am-read-detail-axis-sfc. Per-unit Detail overrides and the "Apply this to the rest of the
 * page" action, decoupled from DetailControl.tsx so the state machine is tested with no DOM.
 *
 * The global Detail and per-unit overrides are two independent layers: setting the global level
 * (`setGlobalDetail`) never touches `overrides` -- an override is the reader's explicit local
 * choice and outranks the global default until the unit's own override is replaced or "Apply
 * this to the rest of the page" collapses every override back into the global level, using the
 * level most recently chosen as an override (`lastOverrideLevel`), never an arbitrary or
 * majority one.
 */
import type { Detail } from "../navigation/state.ts";

export type OverrideState = Readonly<{
  globalDetail: Detail;
  overrides: ReadonlyMap<string, Detail>;
  lastOverrideLevel: Detail | null;
}>;

export function initialOverrideState(globalDetail: Detail): OverrideState {
  return Object.freeze({
    globalDetail,
    overrides: new Map<string, Detail>(),
    lastOverrideLevel: null,
  });
}

/** The global control's own change. Never touches `overrides`: the global default moving must
 * not silently discard a reader's explicit per-unit choice. */
export function setGlobalDetail(state: OverrideState, level: Detail): OverrideState {
  if (state.globalDetail === level) return state;
  return Object.freeze({ ...state, globalDetail: level });
}

/** Sets or replaces one unit's override, tracking it as the level "Apply this to the rest of
 * the page" will use if the reader reaches for the global control next. */
export function setUnitOverride(
  state: OverrideState,
  unitId: string,
  level: Detail,
): OverrideState {
  const overrides = new Map(state.overrides);
  overrides.set(unitId, level);
  return Object.freeze({ ...state, overrides, lastOverrideLevel: level });
}

export function hasOverrides(state: OverrideState): boolean {
  return state.overrides.size > 0;
}

export function effectiveDetailForUnit(state: OverrideState, unitId: string): Detail {
  return state.overrides.get(unitId) ?? state.globalDetail;
}

/** Clears every per-unit override and sets the global level to the one most recently chosen as
 * an override. A safe no-op, returning the same reference, when no override exists -- the
 * action is never reachable without one, but this stays harmless if called anyway. */
export function applyElsewhere(state: OverrideState): OverrideState {
  if (state.overrides.size === 0 || state.lastOverrideLevel === null) return state;
  return Object.freeze({
    globalDetail: state.lastOverrideLevel,
    overrides: new Map<string, Detail>(),
    lastOverrideLevel: null,
  });
}
