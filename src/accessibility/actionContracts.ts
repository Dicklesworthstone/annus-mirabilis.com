/**
 * Accessibility Action Contracts
 *
 * Every interaction an instrument offers must declare its accessible equivalent,
 * and the declaration must be checkable rather than aspirational.
 *
 * Standard equivalence pattern (from AGENTS.md / ME-03):
 * Visual: "Drag a boundary around objects"
 * Equivalent: "Select the objects included in the system and inspect energy crossing that boundary"
 */

export {
  ACTION_FAMILIES,
  type ActionContract,
  type ActionFamily,
  checkAccessibleEquivalence,
  VALID_ACTION_STATUSES,
  type ValidActionStatus,
  validateActionContract,
  validateActionContracts,
} from "../content/schemas/experiment.ts";
