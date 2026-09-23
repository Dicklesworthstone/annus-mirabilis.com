import { BM01_OUTPUTS } from "../experiments/bm01/definition.ts";
import { ME02_OUTPUTS } from "../experiments/me02/definition.ts";
import type { OutputContract } from "../experiments/store/instanceStore.ts";
import { FOUNDATION_QUANTITIES } from "./foundationQuantities.ts";
import { LIGHT_QUANTA_QUANTITIES } from "./lightQuantaQuantities.ts";
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
export type TeachingExperiment = "bm-01" | "me-02";
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
    outputs: Object.freeze({ "bm-01": BM01_OUTPUTS }),
  }),
  "mass-energy": Object.freeze({
    argumentPrefix: "arg-me-",
    quantities: MASS_ENERGY_QUANTITIES,
    outputs: Object.freeze({ "me-02": ME02_OUTPUTS }),
  }),
  /* Admitted 2026-09-22 so the explanation face's formulas can be coloured by quantity (the
     owner's ruling). No laboratory output is bound: these records are symbolic until an
     instrument's contract is admitted here the way bm-01 and me-02 were. */
  "light-quanta": Object.freeze({
    argumentPrefix: "arg-lq-",
    quantities: LIGHT_QUANTA_QUANTITIES,
    outputs: Object.freeze({}),
  }),
  "special-relativity": Object.freeze({
    argumentPrefix: "arg-sr-",
    quantities: SPECIAL_RELATIVITY_QUANTITIES,
    outputs: Object.freeze({}),
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
