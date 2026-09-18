/**
 * The 13 canonical fixture equations used across the equations epic.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.2, §11.3, §11.4, §11.5).
 * Epic: am-ep-equations-y76
 * Bead: am-eq-expression-tree-8kl
 */

import type { EquationTree, Expression } from "./types.ts";

// ----------------------------------------------------------------------------
// 1. Einstein's printed D = (RT/N) * (1 / (6*pi*k*P)) (paper 2 §3)
// ----------------------------------------------------------------------------
export const FIXTURE_1_PRINTED_DIFFUSION: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "relation",
    opId: "eq-bm-s3-d4.op.rel",
    operator: "=",
    left: {
      kind: "symbol",
      termId: "eq-bm-s3-d4.t.d",
      quantityId: "diffusionCoefficient",
    },
    right: {
      kind: "product",
      opId: "eq-bm-s3-d4.op.prod",
      style: "explicit",
      args: [
        {
          kind: "quotient",
          opId: "eq-bm-s3-d4.op.thermalFactor",
          style: "fraction",
          numerator: {
            kind: "product",
            opId: "eq-bm-s3-d4.op.rtProd",
            style: "juxtaposed",
            args: [
              {
                kind: "symbol",
                termId: "eq-bm-s3-d4.t.r",
                quantityId: "molarGasConstant",
              },
              {
                kind: "symbol",
                termId: "eq-bm-s3-d4.t.t",
                quantityId: "temperature",
              },
            ],
          },
          denominator: {
            kind: "symbol",
            termId: "eq-bm-s3-d4.t.n",
            quantityId: "avogadroConstant",
          },
        },
        {
          kind: "quotient",
          opId: "eq-bm-s3-d4.op.stokesFactor",
          style: "fraction",
          numerator: { kind: "number", value: "1" },
          denominator: {
            kind: "product",
            opId: "eq-bm-s3-d4.op.stokesDenominator",
            style: "juxtaposed",
            args: [
              { kind: "number", value: "6" },
              { kind: "constant", name: "pi" },
              {
                kind: "symbol",
                termId: "eq-bm-s3-d4.t.k",
                quantityId: "viscosity",
              },
              {
                kind: "symbol",
                termId: "eq-bm-s3-d4.t.p",
                quantityId: "particleRadius",
              },
            ],
          },
        },
      ],
    },
  },
  groups: [
    {
      id: "group-boltzmann",
      memberTermIds: ["eq-bm-s3-d4.t.r", "eq-bm-s3-d4.t.n"],
      quantityId: "boltzmannConstant",
      modernSymbol: "k_B",
    },
  ],
};

// Generated rename form for fixture 1: D = k_B * T * (1 / (6 * pi * eta * a))
export const FIXTURE_1_RENAME_FORM: Expression = {
  kind: "relation",
  opId: "eq-bm-s3-d4.op.rel",
  operator: "=",
  left: {
    kind: "symbol",
    termId: "eq-bm-s3-d4.t.d",
    quantityId: "diffusionCoefficient",
  },
  right: {
    kind: "product",
    opId: "eq-bm-s3-d4.op.prod",
    style: "explicit",
    args: [
      {
        kind: "product",
        opId: "eq-bm-s3-d4.op.kbTProd",
        style: "juxtaposed",
        args: [
          {
            kind: "symbol",
            termId: "eq-bm-s3-d4.t.r",
            quantityId: "boltzmannConstant",
          },
          {
            kind: "symbol",
            termId: "eq-bm-s3-d4.t.t",
            quantityId: "temperature",
          },
        ],
      },
      {
        kind: "quotient",
        opId: "eq-bm-s3-d4.op.stokesFactor",
        style: "fraction",
        numerator: { kind: "number", value: "1" },
        denominator: {
          kind: "product",
          opId: "eq-bm-s3-d4.op.stokesDenominator",
          style: "juxtaposed",
          args: [
            { kind: "number", value: "6" },
            { kind: "constant", name: "pi" },
            {
              kind: "symbol",
              termId: "eq-bm-s3-d4.t.k",
              quantityId: "viscosity",
            },
            {
              kind: "symbol",
              termId: "eq-bm-s3-d4.t.p",
              quantityId: "particleRadius",
            },
          ],
        },
      },
    ],
  },
};

// ----------------------------------------------------------------------------
// 2. Explanation-layer record D = k_BT / (6*pi*eta*a)
// ----------------------------------------------------------------------------
export const FIXTURE_2_MODERN_DIFFUSION: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "relation",
    operator: "=",
    left: {
      kind: "symbol",
      termId: "eq-model-bm-modern.t.d",
      quantityId: "diffusionCoefficient",
    },
    right: {
      kind: "quotient",
      style: "fraction",
      numerator: {
        kind: "product",
        style: "juxtaposed",
        args: [
          {
            kind: "symbol",
            termId: "eq-model-bm-modern.t.kB",
            quantityId: "boltzmannConstant",
          },
          {
            kind: "symbol",
            termId: "eq-model-bm-modern.t.t",
            quantityId: "temperature",
          },
        ],
      },
      denominator: {
        kind: "product",
        style: "juxtaposed",
        args: [
          { kind: "number", value: "6" },
          { kind: "constant", name: "pi" },
          {
            kind: "symbol",
            termId: "eq-model-bm-modern.t.eta",
            quantityId: "viscosity",
          },
          {
            kind: "symbol",
            termId: "eq-model-bm-modern.t.a",
            quantityId: "particleRadius",
          },
        ],
      },
    },
  },
};

// ----------------------------------------------------------------------------
// 3. Mean displacement: lambda_x = sqrt(2 * D * t)
// ----------------------------------------------------------------------------
export const FIXTURE_3_DISPLACEMENT: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "relation",
    operator: "=",
    left: {
      kind: "symbol",
      termId: "eq-bm-disp.t.lambdaX",
      quantityId: "meanDisplacementX",
    },
    right: {
      kind: "root",
      opId: "eq-bm-disp.op.root",
      degree: 2,
      radicand: {
        kind: "product",
        style: "juxtaposed",
        args: [
          { kind: "number", value: "2" },
          {
            kind: "symbol",
            termId: "eq-bm-disp.t.d",
            quantityId: "diffusionCoefficient",
          },
          {
            kind: "symbol",
            termId: "eq-bm-disp.t.t",
            quantityId: "timeElapsed",
          },
        ],
      },
    },
  },
};

// ----------------------------------------------------------------------------
// 4. Transition relation: f(x, t + tau) = int f(x + Delta, t) * phi(Delta) dDelta
// ----------------------------------------------------------------------------
export const FIXTURE_4_TRANSITION: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "relation",
    operator: "=",
    left: {
      kind: "symbol",
      termId: "eq-bm-trans.t.lhs",
      quantityId: "probabilityDensity",
    },
    right: {
      kind: "integral",
      opId: "eq-bm-trans.op.integral",
      expression: {
        kind: "product",
        style: "juxtaposed",
        args: [
          {
            kind: "symbol",
            termId: "eq-bm-trans.t.f",
            quantityId: "probabilityDensity",
          },
          {
            kind: "symbol",
            termId: "eq-bm-trans.t.phi",
            quantityId: "probabilityDensity",
          },
        ],
      },
      variable: {
        kind: "symbol",
        termId: "eq-bm-trans.t.delta",
        quantityId: "measuredPosition",
      },
    },
  },
};

// ----------------------------------------------------------------------------
// 5. Wien's law in paper 1: rho = alpha * nu^3 * exp(-beta * nu / T)
// ----------------------------------------------------------------------------
export const FIXTURE_5_WIEN_LAW: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "relation",
    operator: "=",
    left: {
      kind: "symbol",
      termId: "eq-lq-s1-1.t.rho",
      quantityId: "frequencyEnergyDensity",
    },
    right: {
      kind: "product",
      style: "juxtaposed",
      args: [
        {
          kind: "symbol",
          termId: "eq-lq-s1-1.t.alpha",
          quantityId: "wienConstantAlpha",
        },
        {
          kind: "power",
          base: {
            kind: "symbol",
            termId: "eq-lq-s1-1.t.nu",
            quantityId: "frequency",
          },
          exponent: { num: 3, den: 1 },
        },
        {
          kind: "function",
          name: "exp",
          argument: {
            kind: "negate",
            argument: {
              kind: "quotient",
              style: "solidus",
              numerator: {
                kind: "product",
                style: "juxtaposed",
                args: [
                  {
                    kind: "symbol",
                    termId: "eq-lq-s1-1.t.beta",
                    quantityId: "wienConstantBeta", // Binds Wien constant!
                  },
                  {
                    kind: "symbol",
                    termId: "eq-lq-s1-1.t.nu2",
                    quantityId: "frequency",
                  },
                ],
              },
              denominator: {
                kind: "symbol",
                termId: "eq-lq-s1-1.t.t",
                quantityId: "temperature",
              },
            },
          },
        },
      ],
    },
  },
};

// ----------------------------------------------------------------------------
// 6. Relativity tau = beta * (t - (v / V^2) * x) (paper 3 §3)
// ----------------------------------------------------------------------------
export const FIXTURE_6_RELATIVITY_TAU: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "relation",
    operator: "=",
    left: {
      kind: "symbol",
      termId: "eq-sr-s3-1.t.tau",
      quantityId: "properTimeElapsed",
    },
    right: {
      kind: "product",
      style: "juxtaposed",
      args: [
        {
          kind: "symbol",
          termId: "eq-sr-s3-1.t.beta",
          quantityId: "lorentzFactor", // Binds Lorentz factor!
        },
        {
          kind: "group",
          argument: {
            kind: "sum",
            args: [
              {
                kind: "symbol",
                termId: "eq-sr-s3-1.t.t",
                quantityId: "coordinateTimeStationary",
              },
              {
                kind: "negate",
                argument: {
                  kind: "product",
                  style: "juxtaposed",
                  args: [
                    {
                      kind: "quotient",
                      style: "fraction",
                      numerator: {
                        kind: "symbol",
                        termId: "eq-sr-s3-1.t.v",
                        quantityId: "frameSpeed",
                      },
                      denominator: {
                        kind: "power",
                        base: {
                          kind: "symbol",
                          termId: "eq-sr-s3-1.t.vUpper",
                          quantityId: "speedOfLight",
                        },
                        exponent: { num: 2, den: 1 },
                      },
                    },
                    {
                      kind: "symbol",
                      termId: "eq-sr-s3-1.t.x",
                      quantityId: "lengthMeasuredStationary",
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
};

// ----------------------------------------------------------------------------
// 7. Relativity Galilean coordinate: tau = a * (t - (v / (V^2 - v^2)) * x') (paper 3 §3)
// ----------------------------------------------------------------------------
export const FIXTURE_7_GALILEAN_COORD: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "relation",
    operator: "=",
    left: {
      kind: "symbol",
      termId: "eq-sr-s3-2.t.tau",
      quantityId: "properTimeElapsed",
    },
    right: {
      kind: "product",
      style: "juxtaposed",
      args: [
        {
          kind: "symbol",
          termId: "eq-sr-s3-2.t.a",
          quantityId: "speedOfLight", // constant/scaling factor
        },
        {
          kind: "group",
          argument: {
            kind: "sum",
            args: [
              {
                kind: "symbol",
                termId: "eq-sr-s3-2.t.t",
                quantityId: "coordinateTimeStationary",
              },
              {
                kind: "negate",
                argument: {
                  kind: "product",
                  style: "juxtaposed",
                  args: [
                    {
                      kind: "quotient",
                      style: "fraction",
                      numerator: {
                        kind: "symbol",
                        termId: "eq-sr-s3-2.t.v",
                        quantityId: "frameSpeed",
                      },
                      denominator: {
                        kind: "sum",
                        args: [
                          {
                            kind: "power",
                            base: {
                              kind: "symbol",
                              termId: "eq-sr-s3-2.t.vUpper",
                              quantityId: "speedOfLight",
                            },
                            exponent: { num: 2, den: 1 },
                          },
                          {
                            kind: "negate",
                            argument: {
                              kind: "power",
                              base: {
                                kind: "symbol",
                                termId: "eq-sr-s3-2.t.v2",
                                quantityId: "frameSpeed",
                              },
                              exponent: { num: 2, den: 1 },
                            },
                          },
                        ],
                      },
                    },
                    {
                      kind: "symbol",
                      termId: "eq-sr-s3-2.t.xPrime",
                      quantityId: "auxiliaryGalileanCoordinate", // Distinct quantity!
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
};

// ----------------------------------------------------------------------------
// 8. Boost matrix (explanation layer)
// ----------------------------------------------------------------------------
export const FIXTURE_8_BOOST_MATRIX: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "matrix",
    rows: [
      [
        {
          kind: "symbol",
          termId: "eq-sr-boost.t.gamma1",
          quantityId: "lorentzFactor",
        },
        {
          kind: "negate",
          argument: {
            kind: "product",
            style: "juxtaposed",
            args: [
              {
                kind: "symbol",
                termId: "eq-sr-boost.t.gamma2",
                quantityId: "lorentzFactor",
              },
              {
                kind: "symbol",
                termId: "eq-sr-boost.t.v1",
                quantityId: "frameSpeed",
              },
            ],
          },
        },
      ],
      [
        {
          kind: "negate",
          argument: {
            kind: "quotient",
            style: "fraction",
            numerator: {
              kind: "product",
              style: "juxtaposed",
              args: [
                {
                  kind: "symbol",
                  termId: "eq-sr-boost.t.gamma3",
                  quantityId: "lorentzFactor",
                },
                {
                  kind: "symbol",
                  termId: "eq-sr-boost.t.v2",
                  quantityId: "frameSpeed",
                },
              ],
            },
            denominator: {
              kind: "power",
              base: {
                kind: "symbol",
                termId: "eq-sr-boost.t.c",
                quantityId: "speedOfLight",
              },
              exponent: { num: 2, den: 1 },
            },
          },
        },
        {
          kind: "symbol",
          termId: "eq-sr-boost.t.gamma4",
          quantityId: "lorentzFactor",
        },
      ],
    ],
  },
};

// ----------------------------------------------------------------------------
// 9. Piecewise photoelectric max kinetic energy
// ----------------------------------------------------------------------------
export const FIXTURE_9_PHOTOELECTRIC_PIECEWISE: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "piecewise",
    cases: [
      {
        condition: {
          kind: "relation",
          operator: ">=",
          left: {
            kind: "product",
            style: "juxtaposed",
            args: [
              {
                kind: "symbol",
                termId: "eq-lq-pe.t.h",
                quantityId: "planckConstant",
              },
              {
                kind: "symbol",
                termId: "eq-lq-pe.t.nu",
                quantityId: "frequency",
              },
            ],
          },
          right: {
            kind: "symbol",
            termId: "eq-lq-pe.t.phi",
            quantityId: "workFunction",
          },
        },
        value: {
          kind: "sum",
          args: [
            {
              kind: "product",
              style: "juxtaposed",
              args: [
                {
                  kind: "symbol",
                  termId: "eq-lq-pe.t.h2",
                  quantityId: "planckConstant",
                },
                {
                  kind: "symbol",
                  termId: "eq-lq-pe.t.nu2",
                  quantityId: "frequency",
                },
              ],
            },
            {
              kind: "negate",
              argument: {
                kind: "symbol",
                termId: "eq-lq-pe.t.phi2",
                quantityId: "workFunction",
              },
            },
          ],
        },
      },
    ],
    otherwise: { kind: "number", value: "0" },
  },
};

// ----------------------------------------------------------------------------
// 10. Paper 3 §6 field transformation: Y' = beta * (Y - (v / V) * N)
// with unit-conversion alternate to SI: E'_y = gamma * (E_y - v * B_z)
// ----------------------------------------------------------------------------
export const FIXTURE_10_FIELD_TRANSFORM: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "relation",
    operator: "=",
    left: {
      kind: "symbol",
      termId: "eq-sr-s6-1.t.yPrime",
      quantityId: "electricFieldMoving",
    },
    right: {
      kind: "product",
      style: "juxtaposed",
      args: [
        {
          kind: "symbol",
          termId: "eq-sr-s6-1.t.beta",
          quantityId: "lorentzFactor",
        },
        {
          kind: "group",
          argument: {
            kind: "sum",
            args: [
              {
                kind: "symbol",
                termId: "eq-sr-s6-1.t.y",
                quantityId: "electricFieldStationary",
              },
              {
                kind: "negate",
                argument: {
                  kind: "product",
                  style: "juxtaposed",
                  args: [
                    {
                      kind: "quotient",
                      style: "fraction",
                      numerator: {
                        kind: "symbol",
                        termId: "eq-sr-s6-1.t.v",
                        quantityId: "frameSpeed",
                      },
                      denominator: {
                        kind: "symbol",
                        termId: "eq-sr-s6-1.t.vUpper",
                        quantityId: "speedOfLight",
                      },
                    },
                    {
                      kind: "symbol",
                      termId: "eq-sr-s6-1.t.n",
                      quantityId: "magneticFieldStationary",
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
  alternateForms: [
    {
      id: "eq-sr-s6-1.alt.si",
      relation: "unit-conversion",
      label: "SI units form",
      unitSystem: { from: "gaussian", to: "si" },
      derivationChainId: "chain-sr-fields-gaussian-to-si",
      tree: {
        kind: "relation",
        operator: "=",
        left: {
          kind: "symbol",
          termId: "eq-sr-s6-1.t.yPrime",
          quantityId: "electricFieldMoving",
        },
        right: {
          kind: "product",
          style: "juxtaposed",
          args: [
            {
              kind: "symbol",
              termId: "eq-sr-s6-1.t.beta",
              quantityId: "lorentzFactor",
            },
            {
              kind: "group",
              argument: {
                kind: "sum",
                args: [
                  {
                    kind: "symbol",
                    termId: "eq-sr-s6-1.t.y",
                    quantityId: "electricFieldStationary",
                  },
                  {
                    kind: "negate",
                    argument: {
                      kind: "product",
                      style: "juxtaposed",
                      args: [
                        {
                          kind: "symbol",
                          termId: "eq-sr-s6-1.t.v",
                          quantityId: "frameSpeed",
                        },
                        {
                          kind: "symbol",
                          termId: "eq-sr-s6-1.t.n",
                          quantityId: "magneticFieldStationary",
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    },
  ],
};

// ----------------------------------------------------------------------------
// 11. Einstein's §10 transverse mass: mu / (1 - (v / V)^2)
// with modernization alternate: gamma * m
// ----------------------------------------------------------------------------
export const FIXTURE_11_TRANSVERSE_MASS: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "quotient",
    style: "fraction",
    numerator: {
      kind: "symbol",
      termId: "eq-sr-s10-1.t.mu",
      quantityId: "mass",
    },
    denominator: {
      kind: "sum",
      args: [
        { kind: "number", value: "1" },
        {
          kind: "negate",
          argument: {
            kind: "power",
            base: {
              kind: "group",
              argument: {
                kind: "quotient",
                style: "solidus",
                numerator: {
                  kind: "symbol",
                  termId: "eq-sr-s10-1.t.v",
                  quantityId: "frameSpeed",
                },
                denominator: {
                  kind: "symbol",
                  termId: "eq-sr-s10-1.t.vUpper",
                  quantityId: "speedOfLight",
                },
              },
            },
            exponent: { num: 2, den: 1 },
          },
        },
      ],
    },
  },
  alternateForms: [
    {
      id: "eq-sr-s10-1.alt.modern",
      relation: "modernization",
      label: "Modern relativistic momentum convention",
      modernLensId: "lens-modern-transverse-mass",
      historicalStatus: "later-development",
      tree: {
        kind: "product",
        style: "juxtaposed",
        args: [
          {
            kind: "symbol",
            termId: "eq-sr-s10-1.t.gamma",
            quantityId: "lorentzFactor",
          },
          {
            kind: "symbol",
            termId: "eq-sr-s10-1.t.mu",
            quantityId: "mass",
          },
        ],
      },
    },
  ],
};

// ----------------------------------------------------------------------------
// 12. Paper 4: K_0 - K_1 = L * (1 / sqrt(1 - (v / V)^2) - 1)
// L binds emittedEnergyRestFrame. Carries multi-line layout hints.
// ----------------------------------------------------------------------------
export const FIXTURE_12_MASS_ENERGY: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "relation",
    opId: "eq-me-1.op.relation",
    operator: "=",
    left: {
      kind: "sum",
      opId: "eq-me-1.op.kineticDiff",
      args: [
        {
          kind: "symbol",
          termId: "eq-me-1.t.k0",
          quantityId: "kineticEnergyBefore",
        },
        {
          kind: "negate",
          argument: {
            kind: "symbol",
            termId: "eq-me-1.t.k1",
            quantityId: "kineticEnergyAfter",
          },
        },
      ],
    },
    right: {
      kind: "product",
      opId: "eq-me-1.op.rightProd",
      style: "juxtaposed",
      args: [
        {
          kind: "symbol",
          termId: "eq-me-1.t.l",
          quantityId: "emittedEnergyRestFrame", // Emitted energy, NEVER speed of light!
        },
        {
          kind: "group",
          opId: "eq-me-1.op.bracket",
          argument: {
            kind: "sum",
            args: [
              {
                kind: "quotient",
                style: "fraction",
                numerator: { kind: "number", value: "1" },
                denominator: {
                  kind: "root",
                  opId: "eq-me-1.op.radicand",
                  degree: 2,
                  radicand: {
                    kind: "sum",
                    args: [
                      { kind: "number", value: "1" },
                      {
                        kind: "negate",
                        argument: {
                          kind: "power",
                          base: {
                            kind: "group",
                            argument: {
                              kind: "quotient",
                              style: "solidus",
                              numerator: {
                                kind: "symbol",
                                termId: "eq-me-1.t.v",
                                quantityId: "frameSpeed",
                              },
                              denominator: {
                                kind: "symbol",
                                termId: "eq-me-1.t.vUpper",
                                quantityId: "speedOfLight",
                              },
                            },
                          },
                          exponent: { num: 2, den: 1 },
                        },
                      },
                    ],
                  },
                },
              },
              {
                kind: "negate",
                argument: { kind: "number", value: "1" },
              },
            ],
          },
        },
      ],
    },
  },
  layout: {
    breaks: ["eq-me-1.op.relation"],
    alignAt: ["eq-me-1.op.relation"],
  },
};

// ----------------------------------------------------------------------------
// 13. Paper 2 §2 defining relation: 2 * kappa * N = R
// kappa binds boltzmannConstant with scale: { num: 1, den: 2 }
// N binds avogadroConstant, R binds molarGasConstant
// ----------------------------------------------------------------------------
export const FIXTURE_13_SCALE_RELATION: EquationTree = {
  treeSchemaVersion: 1,
  root: {
    kind: "relation",
    operator: "=",
    left: {
      kind: "product",
      style: "juxtaposed",
      args: [
        { kind: "number", value: "2" },
        {
          kind: "symbol",
          termId: "eq-bm-s2-1.t.kappa",
          quantityId: "boltzmannConstant",
          scale: { num: 1, den: 2 }, // Half-scale!
        },
        {
          kind: "symbol",
          termId: "eq-bm-s2-1.t.n",
          quantityId: "avogadroConstant",
        },
      ],
    },
    right: {
      kind: "symbol",
      termId: "eq-bm-s2-1.t.r",
      quantityId: "molarGasConstant",
    },
  },
};

export const ALL_13_FIXTURES: readonly EquationTree[] = [
  FIXTURE_1_PRINTED_DIFFUSION,
  FIXTURE_2_MODERN_DIFFUSION,
  FIXTURE_3_DISPLACEMENT,
  FIXTURE_4_TRANSITION,
  FIXTURE_5_WIEN_LAW,
  FIXTURE_6_RELATIVITY_TAU,
  FIXTURE_7_GALILEAN_COORD,
  FIXTURE_8_BOOST_MATRIX,
  FIXTURE_9_PHOTOELECTRIC_PIECEWISE,
  FIXTURE_10_FIELD_TRANSFORM,
  FIXTURE_11_TRANSVERSE_MASS,
  FIXTURE_12_MASS_ENERGY,
  FIXTURE_13_SCALE_RELATION,
];
