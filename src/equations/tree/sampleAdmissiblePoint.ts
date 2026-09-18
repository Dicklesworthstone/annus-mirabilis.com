/**
 * Seeded Admissible-Point Sampler for Semantic Expression Trees.
 *
 * Draws assignments inside each quantity's physical admissible domain.
 * Client components MUST NEVER import this file (enforced by clientBoundary.test.ts).
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.2).
 * Epic: am-ep-equations-y76
 * Bead: am-eq-expression-tree-8kl
 */

import type { QuantityRegistry } from "../../content/quantities/registry.ts";
import type { Expression } from "./types.ts";
import { walk } from "./walk.ts";

export interface AdmissiblePoint {
  readonly seed: string;
  readonly assignments: Readonly<Record<string, number>>;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DomainInterval {
  readonly min: number;
  readonly max: number;
}

const KNOWN_QUANTITY_DOMAINS: Readonly<Record<string, DomainInterval>> = {
  particleRadius: { min: 1e-7, max: 1e-5 },
  temperature: { min: 273.15, max: 373.15 },
  absoluteTemperature: { min: 273.15, max: 373.15 },
  viscosity: { min: 1e-4, max: 1e-2 },
  diffusionCoefficient: { min: 1e-13, max: 1e-11 },
  timeElapsed: { min: 0.1, max: 10.0 },
  elapsedTime: { min: 0.1, max: 10.0 },
  meanDisplacementX: { min: 1e-7, max: 1e-5 },
  frequency: { min: 1e14, max: 1e15 },
  wavelength: { min: 4e-7, max: 8e-7 },
  speedOfLight: { min: 299792458, max: 299792458 },
  molarGasConstant: { min: 8.314462618, max: 8.314462618 },
  avogadroConstant: { min: 6.02214076e23, max: 6.02214076e23 },
  boltzmannConstant: { min: 1.380649e-23, max: 1.380649e-23 },
  planckConstant: { min: 6.62607015e-34, max: 6.62607015e-34 },
  lorentzFactor: { min: 1.01, max: 5.0 },
  frameSpeed: { min: 1e6, max: 2.5e8 },
};

const DEFAULT_POSITIVE_DOMAIN: DomainInterval = { min: 0.5, max: 5.0 };

export function sampleAdmissiblePoint(
  tree: Expression,
  registry: QuantityRegistry | unknown,
  seed: bigint | number | string,
): AdmissiblePoint {
  const seedBigInt = typeof seed === "bigint" ? seed : BigInt(String(seed));
  const seedNumber = Number(seedBigInt % 0xffffffffn);
  const rand = mulberry32(seedNumber);

  const symbols = walk(tree).filter(
    (n): n is Extract<Expression, { kind: "symbol" }> => n.kind === "symbol",
  );

  const assignments: Record<string, number> = {};

  for (const sym of symbols) {
    let domain = KNOWN_QUANTITY_DOMAINS[sym.quantityId];
    if (!domain) {
      if (
        sym.quantityId.toLowerCase().includes("radius") ||
        sym.quantityId.toLowerCase().includes("temperature")
      ) {
        domain = { min: 1.0, max: 100.0 };
      } else {
        domain = DEFAULT_POSITIVE_DOMAIN;
      }
    }

    const value =
      domain.min === domain.max ? domain.min : domain.min + rand() * (domain.max - domain.min);

    // Bind by both termId and quantityId for convenience
    assignments[sym.termId] = value;
    if (assignments[sym.quantityId] === undefined) {
      assignments[sym.quantityId] = value;
    }
  }

  return {
    seed: seedBigInt.toString(),
    assignments: Object.freeze(assignments),
  };
}
