/**
 * Reader-side adapter only. The counting entrance receives evaluated results from the LQ-05
 * experiment seam and holds no physics of its own: AGENTS.md Doctrine 4, enforced by
 * src/testing/noPhysicsInComponents.test.ts. Spec: am-ymr5.
 */
export type {
  TokenArrangement,
  TokenExample,
  TokenExampleResult,
  TokenSetup,
} from "../../experiments/lq05/entranceScenario.ts";
export {
  PART_NAMES,
  partName,
  requireTokenExample,
  TOKEN_INITIAL,
  TOKEN_WORKED_EXAMPLES,
  tokenExample,
} from "../../experiments/lq05/entranceScenario.ts";
