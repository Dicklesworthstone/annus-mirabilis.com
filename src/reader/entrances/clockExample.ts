/**
 * Reader-side adapter only. The clock entrance receives evaluated results from the SR-01
 * experiment seam and holds no physics of its own: AGENTS.md Doctrine 4, enforced by
 * src/testing/noPhysicsInComponents.test.ts. Spec: am-ymr5.
 */
export type {
  ClockExample,
  ClockExampleResult,
  ClockReadings,
} from "../../experiments/sr01/entranceScenario.ts";
export {
  CLOCK_INITIAL,
  CLOCK_WORKED_EXAMPLES,
  clockExample,
  parseClockDraft,
  requireClockExample,
} from "../../experiments/sr01/entranceScenario.ts";
