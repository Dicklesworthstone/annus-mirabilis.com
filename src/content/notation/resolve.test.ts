/**
 * Tests for the Scoped Notation Concordance Resolver.
 * Specification: am-not-concordance-model-uag, AGENTS.md (§2.3, §4.5, §4.7, §6.1, §11.4)
 */

import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import type { SourceManifest } from "../manifest/types.ts";
import {
  buildSourceManifestIndex,
  entriesForAnchor,
  firstUse,
  firstUseInSection,
  modernGroupsFor,
  modernSymbolFor,
  resolveGlyph,
} from "./resolve.ts";
import type { PaperConcordance } from "./types.ts";

const logger = getLogger("notation-model");

// Fixture Manifests
const specialRelativityManifest: SourceManifest = {
  paper: "special-relativity",
  document: "ap-17-891",
  status: "complete",
  pageCount: 31,
  pageRange: [891, 921],
  units: [
    { id: "sr-s3-p1", kind: "paragraph", section: "s3", locators: [{ page: 897 }] },
    { id: "eq-7", kind: "equation", section: "s3", locators: [{ page: 898 }] },
    { id: "sr-s6-p1", kind: "paragraph", section: "s6", locators: [{ page: 905 }] },
    { id: "sr-s7-p1", kind: "paragraph", section: "s7", locators: [{ page: 908 }] },
    { id: "sr-s10-p1", kind: "paragraph", section: "s10", locators: [{ page: 916 }] },
  ],
};

const brownianMotionManifest: SourceManifest = {
  paper: "brownian-motion",
  document: "ap-17-549",
  status: "complete",
  pageCount: 12,
  pageRange: [549, 560],
  units: [
    { id: "bm-s1-p1", kind: "paragraph", section: "s1", locators: [{ page: 549 }] },
    { id: "bm-s3-p1", kind: "paragraph", section: "s3", locators: [{ page: 552 }] },
    { id: "bm-s3-e1", kind: "equation", section: "s3", locators: [{ page: 553 }] },
    { id: "bm-s4-p1", kind: "paragraph", section: "s4", locators: [{ page: 555 }] },
  ],
};

const lightQuantaManifest: SourceManifest = {
  paper: "light-quanta",
  document: "ap-17-132",
  status: "complete",
  pageCount: 17,
  pageRange: [132, 148],
  units: [
    { id: "lq-s1-p1", kind: "paragraph", section: "s1", locators: [{ page: 132 }] },
    { id: "lq-s2-p1", kind: "paragraph", section: "s2", locators: [{ page: 134 }] },
  ],
};

const massEnergyManifest: SourceManifest = {
  paper: "mass-energy",
  document: "ap-18-639",
  status: "complete",
  pageCount: 3,
  pageRange: [639, 641],
  units: [{ id: "me-s1-p1", kind: "paragraph", section: "s1", locators: [{ page: 639 }] }],
};

const manifestIndex = buildSourceManifestIndex([
  specialRelativityManifest,
  brownianMotionManifest,
  lightQuantaManifest,
  massEnergyManifest,
]);

// Fixture Concordances
const specialRelativityConcordance: PaperConcordance = {
  paper: "special-relativity",
  entries: [
    // V -> c (Light speed)
    {
      id: "sr.V.speedOfLight",
      paper: "special-relativity",
      scope: ["all"],
      glyph: { unicode: "V", latex: "V", variant: "plain" },
      meaning: "Speed of light in vacuum",
      binding: { quantityId: "speedOfLight" },
      operation: {
        kind: "rename",
        target: { form: "symbol", modernGlyph: "c" },
      },
      sources: { anchor: "sr-s3-p1", facsimilePage: 897 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
    // \beta in SR §3 is gamma = 1/sqrt(1 - v^2/V^2)
    {
      id: "sr.beta.lorentzFactor",
      paper: "special-relativity",
      scope: ["s3", "sr-s3"],
      glyph: { unicode: "β", latex: "\\beta", variant: "plain" },
      meaning: "Lorentz factor 1/sqrt(1 - v^2/c^2)",
      binding: { quantityId: "lorentzFactor" },
      operation: {
        kind: "rename",
        target: { form: "symbol", modernGlyph: "\\gamma" },
      },
      sources: { anchor: "sr-s3-p1", facsimilePage: 897 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
    // \tau in SR is moving frame coordinate time
    {
      id: "sr.tau.coordinateTimeMoving",
      paper: "special-relativity",
      scope: ["s3", "s4"],
      glyph: { unicode: "τ", latex: "\\tau", variant: "plain" },
      meaning: "Time coordinate in moving frame k",
      binding: { quantityId: "coordinateTimeMoving" },
      operation: {
        kind: "rename",
        target: { form: "symbol", modernGlyph: "t'" },
      },
      sources: { anchor: "sr-s3-p1", facsimilePage: 897 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
    // \varphi in §3 is unknown scale factor \varphi(v)
    {
      id: "sr.varphi.scaleFactorUnknown",
      paper: "special-relativity",
      scope: ["s3"],
      glyph: { unicode: "φ", latex: "\\varphi", variant: "plain" },
      meaning: "Unknown velocity-dependent scale factor",
      binding: { quantityId: "transverseScaleFactor" },
      operation: {
        kind: "rename",
        target: { form: "symbol", modernGlyph: "\\phi(v)" },
      },
      collision: {
        severity: "caution",
        kind: "within-paper",
        collidesWith: ["sr.varphi.propagationAngleStationary"],
        firstUseAnchor: "sr-s3-p1",
        firstUseBySection: [{ sectionId: "s3", anchor: "sr-s3-p1" }],
      },
      sources: { anchor: "sr-s3-p1", facsimilePage: 897 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
    // \varphi in §7 is wave propagation angle
    {
      id: "sr.varphi.propagationAngleStationary",
      paper: "special-relativity",
      scope: ["s7"],
      glyph: { unicode: "φ", latex: "\\varphi", variant: "plain" },
      meaning: "Angle between wave normal and motion axis in stationary frame",
      binding: { quantityId: "waveAngleStationary" },
      operation: {
        kind: "rename",
        target: { form: "symbol", modernGlyph: "\\theta" },
      },
      collision: {
        severity: "caution",
        kind: "within-paper",
        collidesWith: ["sr.varphi.scaleFactorUnknown"],
        firstUseAnchor: "sr-s7-p1",
        firstUseBySection: [{ sectionId: "s7", anchor: "sr-s7-p1" }],
      },
      sources: { anchor: "sr-s7-p1", facsimilePage: 908 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
    // L in SR §6 is radiation energy
    {
      id: "sr.L.radiationEnergy",
      paper: "special-relativity",
      scope: ["s6"],
      glyph: { unicode: "L", latex: "L", variant: "plain" },
      meaning: "Light energy of a wave complex",
      binding: { quantityId: "radiationEnergy" },
      operation: {
        kind: "rename",
        target: { form: "symbol", modernGlyph: "E_{\\text{rad}}" },
      },
      sources: { anchor: "sr-s6-p1", facsimilePage: 905 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
    // Electric field component X with Gaussian unit conversion (NOT a rename!)
    {
      id: "sr.X.electricFieldX",
      paper: "special-relativity",
      scope: ["s6"],
      glyph: { unicode: "X", latex: "X", variant: "plain" },
      meaning: "Electric field x-component in Gaussian CGS",
      binding: { quantityId: "electricFieldX" },
      operation: {
        kind: "unitConversion",
        fromSystem: "gaussian-cgs",
        toSystem: "si",
        factor: 2997924580,
      },
      sources: { anchor: "sr-s6-p1", facsimilePage: 905 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
    // Transverse mass with substantive modernization
    {
      id: "sr.mu.transverseMass",
      paper: "special-relativity",
      scope: ["s10"],
      glyph: { unicode: "μ", latex: "\\mu", variant: "plain" },
      meaning: "Transverse mass m / (1 - v^2/c^2)",
      binding: { quantityId: "transverseMass" },
      operation: {
        kind: "modernization",
        modernLensRef: "sr-10-modern-force",
        argumentChangeDescription:
          "Modern 4-vector dynamics defines invariant rest mass and replaces direction-dependent mass.",
      },
      sources: { anchor: "sr-s10-p1", facsimilePage: 916 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
  ],
  modernOnlySymbols: [
    {
      id: "rapidity",
      glyph: { unicode: "χ", latex: "\\chi", variant: "plain" },
      binding: { quantityId: "rapidity" },
      scope: ["s3"],
      introducedBy: "kinematics-modern-lens",
      label: "Rapidity parameter",
    },
  ],
};

const brownianConcordance: PaperConcordance = {
  paper: "brownian-motion",
  entries: [
    // k in §3 is dynamic viscosity \eta
    {
      id: "bm.k.viscosity",
      paper: "brownian-motion",
      scope: ["s3"],
      glyph: { unicode: "k", latex: "k", variant: "plain" },
      meaning: "Dynamic viscosity coefficient",
      binding: { quantityId: "dynamicViscosity" },
      operation: {
        kind: "rename",
        target: { form: "symbol", modernGlyph: "\\eta" },
      },
      collision: {
        severity: "danger",
        kind: "cross-paper",
        collidesWithModern: ["boltzmannConstant"],
        collidesWith: ["bm.R_N.boltzmannConstant"],
        firstUseAnchor: "bm-s3-p1",
        firstUseBySection: [{ sectionId: "s3", anchor: "bm-s3-p1" }],
      },
      sources: { anchor: "bm-s3-p1", facsimilePage: 552 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
    // R/N -> k_B (group rename)
    {
      id: "bm.R_N.boltzmannConstant",
      paper: "brownian-motion",
      scope: ["all"],
      glyph: { unicode: "R/N", latex: "R/N", variant: "plain" },
      meaning: "Gas constant per molecule (Boltzmann constant)",
      binding: { quantityId: "boltzmannConstant" },
      operation: {
        kind: "rename",
        target: {
          form: "group",
          pattern: { kind: "divide", terms: ["R", "N"] },
          modernGlyph: "k_B",
        },
      },
      sources: { anchor: "bm-s1-p1", facsimilePage: 549 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
    // 2\kappa -> k_B (scaled rename)
    {
      id: "bm.kappa.scaledBoltzmann",
      paper: "brownian-motion",
      scope: ["s1"],
      glyph: { unicode: "κ", latex: "\\kappa", variant: "plain" },
      meaning: "Half-Boltzmann constant kappa = 1/2 k_B",
      binding: {
        quantityId: "boltzmannConstant",
        scale: { num: 1, den: 2 },
      },
      operation: {
        kind: "rename",
        target: {
          form: "scaled",
          modernTree: { op: "mul", factor: { num: 1, den: 2 }, term: "k_B" },
          modernGlyph: "\\tfrac{1}{2}k_B",
        },
      },
      sources: { anchor: "bm-s1-p1", facsimilePage: 549 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
  ],
};

const lightQuantaConcordance: PaperConcordance = {
  paper: "light-quanta",
  entries: [
    // \beta in LQ §2 is Wien radiation constant
    {
      id: "lq.beta.wienConstant",
      paper: "light-quanta",
      scope: ["s2"],
      glyph: { unicode: "β", latex: "\\beta", variant: "plain" },
      meaning: "Wien radiation distribution constant h/k_B",
      binding: { quantityId: "wienConstantBeta" },
      operation: {
        kind: "rename",
        target: { form: "symbol", modernGlyph: "h/k_B" },
      },
      sources: { anchor: "lq-s2-p1", facsimilePage: 134 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
    // R\beta/N -> h (group rename)
    {
      id: "lq.R_beta_N.planckConstant",
      paper: "light-quanta",
      scope: ["s2"],
      glyph: { unicode: "Rβ/N", latex: "R\\beta/N", variant: "plain" },
      meaning: "Planck constant h",
      binding: { quantityId: "planckConstant" },
      operation: {
        kind: "rename",
        target: {
          form: "group",
          pattern: { kind: "multiply", terms: ["R", "\\beta", "N"] },
          modernGlyph: "h",
        },
      },
      sources: { anchor: "lq-s2-p1", facsimilePage: 134 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
    // L in LQ is energy / latent heat
    {
      id: "lq.L.latentHeat",
      paper: "light-quanta",
      scope: ["s1"],
      glyph: { unicode: "L", latex: "L", variant: "plain" },
      meaning: "Energy of system / latent heat",
      binding: { quantityId: "energy" },
      operation: {
        kind: "rename",
        target: { form: "symbol", modernGlyph: "E" },
      },
      sources: { anchor: "lq-s1-p1", facsimilePage: 132 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
  ],
};

const massEnergyConcordance: PaperConcordance = {
  paper: "mass-energy",
  entries: [
    // L in Mass-Energy is radiation energy
    {
      id: "me.L.radiationEnergy",
      paper: "mass-energy",
      scope: ["s1"],
      glyph: { unicode: "L", latex: "L", variant: "plain" },
      meaning: "Light energy emitted by the body",
      binding: { quantityId: "emittedLightEnergy" },
      operation: {
        kind: "rename",
        target: { form: "symbol", modernGlyph: "E" },
      },
      sources: { anchor: "me-s1-p1", facsimilePage: 639 },
      verification: {
        printed: true,
        checkedAgainst: "AP-1905",
        by: "reviewer",
        date: "2026-09-17",
      },
    },
  ],
};

const allConcordances = [
  specialRelativityConcordance,
  brownianConcordance,
  lightQuantaConcordance,
  massEnergyConcordance,
];

describe("Scoped Notation Concordance Resolver (am-not-concordance-model-uag)", () => {
  test("disambiguates identical glyph β across papers and sections", () => {
    // In SR §3, \beta is gamma (Lorentz factor)
    const srBeta = resolveGlyph(
      "special-relativity",
      "sr-s3-p1",
      "\\beta",
      manifestIndex,
      allConcordances,
    );
    expect(srBeta.ok).toBe(true);
    if (srBeta.ok) {
      expect(srBeta.entry.id).toBe("sr.beta.lorentzFactor");
      expect(srBeta.entry.binding).toEqual({ quantityId: "lorentzFactor" });
    }

    // In LQ §2, \beta is Wien constant h/k_B
    const lqBeta = resolveGlyph(
      "light-quanta",
      "lq-s2-p1",
      "\\beta",
      manifestIndex,
      allConcordances,
    );
    expect(lqBeta.ok).toBe(true);
    if (lqBeta.ok) {
      expect(lqBeta.entry.id).toBe("lq.beta.wienConstant");
      expect(lqBeta.entry.binding).toEqual({ quantityId: "wienConstantBeta" });
    }

    logger.log({
      testId: "resolve-beta-disambiguation",
      outcome: "passed",
      message: "Disambiguated beta between SR lorentzFactor and LQ wienConstantBeta",
    });
  });

  test("disambiguates glyph k in Brownian Motion §3 (viscosity) vs Boltzmann constant", () => {
    const bmK = resolveGlyph("brownian-motion", "bm-s3-p1", "k", manifestIndex, allConcordances);
    expect(bmK.ok).toBe(true);
    if (bmK.ok) {
      expect(bmK.entry.id).toBe("bm.k.viscosity");
      expect(bmK.entry.meaning).toBe("Dynamic viscosity coefficient");
      expect(bmK.entry.collision?.severity).toBe("danger");
    }

    // In §4, k is unscoped
    const bmK4 = resolveGlyph("brownian-motion", "bm-s4-p1", "k", manifestIndex, allConcordances);
    expect(bmK4.ok).toBe(false);
    if (!bmK4.ok) {
      expect(bmK4.error).toBe("unscoped");
    }

    logger.log({
      testId: "resolve-k-viscosity",
      outcome: "passed",
      message: "Resolved k in BM §3 as viscosity, correctly unscoped in §4",
    });
  });

  test("disambiguates within-paper collision of φ between SR §3 (scale factor) and §7 (wave angle)", () => {
    const phi3 = resolveGlyph(
      "special-relativity",
      "sr-s3-p1",
      "\\varphi",
      manifestIndex,
      allConcordances,
    );
    expect(phi3.ok).toBe(true);
    if (phi3.ok) {
      expect(phi3.entry.id).toBe("sr.varphi.scaleFactorUnknown");
      expect(phi3.entry.binding).toEqual({ quantityId: "transverseScaleFactor" });
    }

    const phi7 = resolveGlyph(
      "special-relativity",
      "sr-s7-p1",
      "\\varphi",
      manifestIndex,
      allConcordances,
    );
    expect(phi7.ok).toBe(true);
    if (phi7.ok) {
      expect(phi7.entry.id).toBe("sr.varphi.propagationAngleStationary");
      expect(phi7.entry.binding).toEqual({ quantityId: "waveAngleStationary" });
    }

    logger.log({
      testId: "resolve-phi-within-paper",
      outcome: "passed",
      message: "Disambiguated phi in SR §3 vs §7",
    });
  });

  test("disambiguates glyph L across papers 1, 3 (§6), and 4", () => {
    const lqL = resolveGlyph("light-quanta", "lq-s1-p1", "L", manifestIndex, allConcordances);
    expect(lqL.ok).toBe(true);
    if (lqL.ok) expect(lqL.entry.binding).toEqual({ quantityId: "energy" });

    const srL = resolveGlyph("special-relativity", "sr-s6-p1", "L", manifestIndex, allConcordances);
    expect(srL.ok).toBe(true);
    if (srL.ok) expect(srL.entry.binding).toEqual({ quantityId: "radiationEnergy" });

    const meL = resolveGlyph("mass-energy", "me-s1-p1", "L", manifestIndex, allConcordances);
    expect(meL.ok).toBe(true);
    if (meL.ok) expect(meL.entry.binding).toEqual({ quantityId: "emittedLightEnergy" });
  });

  test("resolves equation anchor eq-7 to section s3", () => {
    const res = resolveGlyph("special-relativity", "eq-7", "V", manifestIndex, allConcordances);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.entry.id).toBe("sr.V.speedOfLight");
    }

    const phiRes = resolveGlyph(
      "special-relativity",
      "eq-7",
      "\\varphi",
      manifestIndex,
      allConcordances,
    );
    expect(phiRes.ok).toBe(true);
    if (phiRes.ok) {
      expect(phiRes.entry.id).toBe("sr.varphi.scaleFactorUnknown");
    }
  });

  test("fails resolution on unknown paper or anchor", () => {
    const badPaper = resolveGlyph("quantum-mechanics", "s1", "V", manifestIndex, allConcordances);
    expect(badPaper.ok).toBe(false);
    if (!badPaper.ok) expect(badPaper.error).toBe("unknownPaper");

    const badAnchor = resolveGlyph(
      "special-relativity",
      "non-existent-anchor",
      "V",
      manifestIndex,
      allConcordances,
    );
    expect(badAnchor.ok).toBe(false);
    if (!badAnchor.ok) expect(badAnchor.error).toBe("unknownAnchor");
  });

  test("resolveGlyph NEVER returns a modernOnlySymbol", () => {
    // rapidity is in modernOnlySymbols for special-relativity, NOT in entries
    const res = resolveGlyph(
      "special-relativity",
      "sr-s3-p1",
      "\\chi",
      manifestIndex,
      allConcordances,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("unscoped");
    }
  });

  test("entriesForAnchor returns all scoped entries for that unit/section", () => {
    const s3Entries = entriesForAnchor(
      "special-relativity",
      "sr-s3-p1",
      manifestIndex,
      allConcordances,
    );
    const ids = s3Entries.map((e) => e.id);
    expect(ids).toContain("sr.V.speedOfLight");
    expect(ids).toContain("sr.beta.lorentzFactor");
    expect(ids).toContain("sr.tau.coordinateTimeMoving");
    expect(ids).toContain("sr.varphi.scaleFactorUnknown");
    expect(ids).not.toContain("sr.varphi.propagationAngleStationary");
    expect(ids).not.toContain("sr.L.radiationEnergy");
  });

  test("firstUse and firstUseInSection return exact recorded anchors", () => {
    const fu = firstUse("brownian-motion", "k", allConcordances);
    expect(fu).toBe("bm-s3-p1");

    const fuSec = firstUseInSection("brownian-motion", "s3", "k", allConcordances);
    expect(fuSec).toBe("bm-s3-p1");
  });

  test("toggle contract (modernSymbolFor) strictly enforces rename-only perspective", () => {
    // 1. Rename: V -> c under modern perspective, V under paper perspective
    const modV = modernSymbolFor(
      "special-relativity",
      "sr-s3-p1",
      "V",
      manifestIndex,
      allConcordances,
      { perspective: "modern" },
    );
    expect(modV).toBe("c");

    const papV = modernSymbolFor(
      "special-relativity",
      "sr-s3-p1",
      "V",
      manifestIndex,
      allConcordances,
      { perspective: "paper" },
    );
    expect(papV).toBe("V");

    // 2. Unit conversion: Gaussian field X is NOT converted to a modern symbol
    const modX = modernSymbolFor(
      "special-relativity",
      "sr-s6-p1",
      "X",
      manifestIndex,
      allConcordances,
      { perspective: "modern" },
    );
    expect(modX).toBeUndefined();

    // 3. Substantive modernization: Transverse mass \mu is NOT converted to a mere symbol rename
    const modMu = modernSymbolFor(
      "special-relativity",
      "sr-s10-p1",
      "\\mu",
      manifestIndex,
      allConcordances,
      { perspective: "modern" },
    );
    expect(modMu).toBeUndefined();

    // 4. Modern-only symbol rapidity \chi is NEVER returned
    const modChi = modernSymbolFor(
      "special-relativity",
      "sr-s3-p1",
      "\\chi",
      manifestIndex,
      allConcordances,
      { perspective: "modern" },
    );
    expect(modChi).toBeUndefined();

    logger.log({
      testId: "toggle-contract-rename-only",
      outcome: "passed",
      message: "Verified rename vs unitConversion vs modernization in modernSymbolFor",
    });
  });

  test("modernGroupsFor returns group renames (R/N -> k_B, Rβ/N -> h, 2κ -> k_B)", () => {
    const bmGroups = modernGroupsFor("brownian-motion", "bm-s1-p1", allConcordances, manifestIndex);
    expect(bmGroups.some((g) => g.printedGroup === "R/N" && g.modernGroup === "k_B")).toBe(true);

    const lqGroups = modernGroupsFor("light-quanta", "lq-s2-p1", allConcordances, manifestIndex);
    expect(lqGroups.some((g) => g.printedGroup === "R\\beta/N" && g.modernGroup === "h")).toBe(
      true,
    );

    logger.log({
      testId: "modern-groups-for",
      outcome: "passed",
      message: "Retrieved modern group renames for BM and LQ",
    });
  });
});
