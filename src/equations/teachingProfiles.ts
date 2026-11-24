import { BM01_OUTPUTS } from "../experiments/bm01/definition.ts";
import { LQ08_OUTPUTS } from "../experiments/lq08/definition.ts";
import { ME02_OUTPUTS } from "../experiments/me02/definition.ts";
import { SR05_OUTPUTS } from "../experiments/sr05/definition.ts";
import type { OutputContract } from "../experiments/store/instanceStore.ts";
import { FOUNDATION_QUANTITIES } from "./foundationQuantities.ts";
import { LIGHT_QUANTA_QUANTITIES } from "./lightQuantaQuantities.ts";
import { LABORATORY_EQUATION_OUTPUTS } from "./live/laboratoryOutputs.ts";
import { MASS_ENERGY_QUANTITIES } from "./massEnergyQuantities.ts";
import { BROWNIAN_QUANTITIES, type QuantityRegistry } from "./quantities.ts";
import { SPECIAL_RELATIVITY_QUANTITIES } from "./specialRelativityQuantities.ts";

export type TeachingPaper =
  | "brownian-motion"
  | "mass-energy"
  | "light-quanta"
  | "special-relativity"
  /**
   * The foundation lessons. Not a paper: a lesson's record names the lesson where a paper's names
   * an argument, it is always reading-only (live: false), and it has its own colours.
   */
  | "foundations";
export type TeachingExperiment =
  | "bm-01"
  | "bm-06"
  | "lq-08"
  | "me-02"
  | "sr-05"
  | "sr-09";
export type TeachingProfile = Readonly<{
  argumentPrefix: string;
  quantities: QuantityRegistry;
  outputs: Readonly<Partial<Record<TeachingExperiment, Readonly<Record<string, OutputContract>>>>>;
}>;
/** Closed, paper-scoped admission. Adding a paper never admits arbitrary quantities or labs. */
const profiles: Readonly<Record<TeachingPaper, TeachingProfile>> = Object.freeze({
  "brownian-motion": Object.freeze({
    argumentPrefix: "arg-bm-",
    quantities: BROWNIAN_QUANTITIES,
    outputs: Object.freeze({
      "bm-01": BM01_OUTPUTS,
      "bm-06": LABORATORY_EQUATION_OUTPUTS["bm-06"],
    }),
  }),
  "mass-energy": Object.freeze({
    argumentPrefix: "arg-me-",
    quantities: MASS_ENERGY_QUANTITIES,
    outputs: Object.freeze({ "me-02": ME02_OUTPUTS }),
  }),
  // Only the photoelectric apparatus supplies live values for the modern SI energy relations.
  "light-quanta": Object.freeze({
    argumentPrefix: "arg-lq-",
    quantities: LIGHT_QUANTA_QUANTITIES,
    outputs: Object.freeze({ "lq-08": LQ08_OUTPUTS }),
  }),
  "special-relativity": Object.freeze({
    argumentPrefix: "arg-sr-",
    quantities: SPECIAL_RELATIVITY_QUANTITIES,
    outputs: Object.freeze({
      "sr-05": SR05_OUTPUTS,
      "sr-09": LABORATORY_EQUATION_OUTPUTS["sr-09"],
    }),
  }),
  // The argument field holds the lesson's id; the compiler checks that the lesson exists.
  foundations: Object.freeze({
    argumentPrefix: "",
    quantities: FOUNDATION_QUANTITIES,
    outputs: Object.freeze({}),
  }),
});
export function teachingProfile(paper: unknown): TeachingProfile | null {
  return typeof paper === "string" && Object.hasOwn(profiles, paper)
    ? profiles[paper as TeachingPaper]
    : null;
}
