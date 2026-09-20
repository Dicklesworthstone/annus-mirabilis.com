/** Presentation actions never run a calculation or replace the prepared example. */
export type MassEnergyEntranceState = Readonly<{
  phase: number;
  scenarioId: "fast" | "slow";
  unchangedOffset: boolean;
  revision: number;
}>;
export type MassEnergyEntranceAction =
  | { type: "align" | "next" | "back" | "show-all" }
  | { type: "scenario"; id: "fast" | "slow" }
  | { type: "premise"; unchanged: boolean };
export const MASS_ENERGY_ENTRANCE_INITIAL: MassEnergyEntranceState = Object.freeze({
  phase: 0,
  scenarioId: "fast",
  unchangedOffset: true,
  revision: 0,
});
export function reduceMassEnergyEntrance(
  state: MassEnergyEntranceState,
  action: MassEnergyEntranceAction,
): MassEnergyEntranceState {
  let phase = state.phase;
  let scenarioId = state.scenarioId;
  let unchangedOffset = state.unchangedOffset;
  switch (action.type) {
    case "align":
      phase = Math.max(1, phase);
      break;
    case "next":
      phase = Math.min(3, phase + 1);
      break;
    case "back":
      phase = Math.max(0, phase - 1);
      break;
    case "show-all":
      phase = 3;
      break;
    case "scenario":
      if (action.id !== "fast" && action.id !== "slow") return state;
      scenarioId = action.id;
      break;
    case "premise":
      unchangedOffset = action.unchanged;
      break;
    default:
      return state;
  }
  if (
    phase === state.phase &&
    scenarioId === state.scenarioId &&
    unchangedOffset === state.unchangedOffset
  )
    return state;
  return Object.freeze({ phase, scenarioId, unchangedOffset, revision: state.revision + 1 });
}
