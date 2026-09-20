import { BM01_OUTPUTS } from "../experiments/bm01/definition.ts";
import { ME02_OUTPUTS } from "../experiments/me02/definition.ts";
import type { OutputContract } from "../experiments/store/instanceStore.ts";
import { MASS_ENERGY_QUANTITIES } from "./massEnergyQuantities.ts";
import { BROWNIAN_QUANTITIES, type QuantityRegistry } from "./quantities.ts";

export type TeachingPaper = "brownian-motion" | "mass-energy";
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
});
export function teachingProfile(paper: unknown): TeachingProfile | null {
  return typeof paper === "string" && Object.hasOwn(profiles, paper)
    ? profiles[paper as TeachingPaper]
    : null;
}
