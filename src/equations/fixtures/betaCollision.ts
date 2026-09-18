/**
 * Beta Collision Fixture Pair: Paper 1 (Wien constant beta) vs Paper 3 (Lorentz factor beta).
 *
 * Implements acceptance criterion (b) for am-eq-expression-tree-8kl:
 * - In Paper 1 Wien's radiation law, glyph beta binds to Wien's constant (wienConstantBeta).
 * - In Paper 3 moving-frame coordinate tau, glyph beta binds to the Lorentz factor (lorentzFactor).
 * - Explicitly proves that quantity binding is strictly semantic and NEVER consults the glyph.
 */

import type { Expression } from "../ast.ts";
import type { Quantity, QuantityRegistry } from "../quantities.ts";

const makeQ = (
  id: string,
  name: string,
  glyph: string,
  d: readonly string[],
  unit: string,
  role: Quantity["role"],
  definition: string,
): Quantity =>
  Object.freeze({
    id,
    name,
    glyph,
    dimension: Object.freeze([...d]),
    unit,
    displayUnit: unit,
    displayPower: 0,
    semanticKind: id,
    role,
    definition,
  });

/**
 * Registry containing both Wien's constant beta and the Lorentz factor beta,
 * both sharing the identical printed glyph \beta.
 */
export const BETA_COLLISION_REGISTRY: QuantityRegistry = Object.freeze(
  Object.fromEntries(
    [
      makeQ(
        "spectralEnergyDensity",
        "Spectral energy density",
        "\\rho",
        ["-1", "1", "-2", "0", "0", "0"],
        "J/(m³ Hz)",
        "result",
        "Energy density per frequency interval.",
      ),
      makeQ(
        "wienConstantAlpha",
        "Wien constant alpha",
        "\\alpha",
        ["-1", "1", "1", "0", "0", "0"],
        "J s³ / m³",
        "constant",
        "Constant alpha in Wien's radiation formula.",
      ),
      makeQ(
        "frequency",
        "Frequency",
        "\\nu",
        ["0", "0", "-1", "0", "0", "0"],
        "Hz",
        "input",
        "Radiation frequency.",
      ),
      makeQ(
        "wienConstantBeta",
        "Wien constant beta",
        "\\beta",
        ["0", "0", "0", "1", "0", "0"],
        "K s",
        "constant",
        "The constant beta in Wien's distribution law (h / k_B).",
      ),
      makeQ(
        "temperature",
        "Absolute temperature",
        "T",
        ["0", "0", "0", "1", "0", "0"],
        "K",
        "input",
        "Thermodynamic temperature.",
      ),
      makeQ(
        "coordinateTimeMoving",
        "Moving system time",
        "\\tau",
        ["0", "0", "1", "0", "0", "0"],
        "s",
        "result",
        "Time coordinate in the moving system k.",
      ),
      makeQ(
        "lorentzFactor",
        "Lorentz factor",
        "\\beta", // In 1905 Paper 3 §3, Einstein printed \beta for 1/sqrt(1 - v^2/V^2)
        ["0", "0", "0", "0", "0", "0"],
        "1",
        "result",
        "The relativistic boost factor beta = 1 / sqrt(1 - v^2/V^2).",
      ),
      makeQ(
        "coordinateTimeStationary",
        "Stationary system time",
        "t",
        ["0", "0", "1", "0", "0", "0"],
        "s",
        "input",
        "Time coordinate in stationary system K.",
      ),
      makeQ(
        "relativeVelocity",
        "Relative velocity",
        "v",
        ["1", "0", "-1", "0", "0", "0"],
        "m/s",
        "input",
        "Relative velocity between systems K and k.",
      ),
      makeQ(
        "speedOfLight",
        "Speed of light",
        "V",
        ["1", "0", "-1", "0", "0", "0"],
        "m/s",
        "constant",
        "Speed of light in empty space (printed V in 1905).",
      ),
      makeQ(
        "spatialCoordinateX",
        "Spatial coordinate x",
        "x",
        ["1", "0", "0", "0", "0", "0"],
        "m",
        "input",
        "Spatial coordinate along the motion axis.",
      ),
    ].map((item) => [item.id, item]),
  ),
);

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const pow = (
  base: Expression,
  exponent: { num: number; den: number },
  opId?: string,
): Expression => ({
  kind: "power",
  base,
  exponent,
  ...(opId ? { opId } : {}),
});

const prod = (args: readonly Expression[], opId?: string): Expression => ({
  kind: "product",
  args,
  ...(opId ? { opId } : {}),
});

const quot = (
  numerator: Expression,
  denominator: Expression,
  opId?: string,
): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
  ...(opId ? { opId } : {}),
});

const fn = (
  name: "exp" | "ln" | "sin" | "cos",
  argument: Expression,
  opId?: string,
): Expression => ({
  kind: "function",
  name,
  argument,
  ...(opId ? { opId } : {}),
});

const neg = (argument: Expression, opId?: string): Expression => ({
  kind: "negate",
  argument,
  ...(opId ? { opId } : {}),
});

const grp = (argument: Expression, opId?: string): Expression => ({
  kind: "group",
  argument,
  ...(opId ? { opId } : {}),
});

const sum = (args: readonly Expression[], opId?: string): Expression => ({
  kind: "sum",
  args,
  ...(opId ? { opId } : {}),
});

const rel = (
  operator: "=" | "approx" | "define",
  left: Expression,
  right: Expression,
  opId?: string,
): Expression => ({
  kind: "relation",
  operator,
  left,
  right,
  ...(opId ? { opId } : {}),
});

/**
 * Paper 1 §2 Fixture: Wien's Radiation Law
 * \rho = \alpha \nu^3 \exp(-\beta \nu / T)
 * where printed \beta binds wienConstantBeta.
 */
export const paper1WienLawFixture: Expression = rel(
  "=",
  sym("eq-s2-d1.t.rho", "spectralEnergyDensity"),
  prod(
    [
      sym("eq-s2-d1.t.alpha", "wienConstantAlpha"),
      pow(sym("eq-s2-d1.t.nu", "frequency"), { num: 3, den: 1 }, "eq-s2-d1.op.nuCubed"),
      fn(
        "exp",
        neg(
          quot(
            prod(
              [
                sym("eq-s2-d1.t.beta", "wienConstantBeta"),
                sym("eq-s2-d1.t.nuArg", "frequency"),
              ],
              "eq-s2-d1.op.betaNu",
            ),
            sym("eq-s2-d1.t.temperature", "temperature"),
            "eq-s2-d1.op.exponentQuot",
          ),
          "eq-s2-d1.op.neg",
        ),
        "eq-s2-d1.op.exp",
      ),
    ],
    "eq-s2-d1.op.rhs",
  ),
  "eq-s2-d1.op.rel",
);

/**
 * Paper 3 §3 Fixture: Relativistic Transformation for tau
 * \tau = \beta (t - \frac{v}{V^2} x)
 * where printed \beta binds lorentzFactor.
 */
export const paper3LorentzTauFixture: Expression = rel(
  "=",
  sym("eq-s3-d1.t.tau", "coordinateTimeMoving"),
  prod(
    [
      sym("eq-s3-d1.t.beta", "lorentzFactor"),
      grp(
        sum(
          [
            sym("eq-s3-d1.t.t", "coordinateTimeStationary"),
            neg(
              prod(
                [
                  quot(
                    sym("eq-s3-d1.t.v", "relativeVelocity"),
                    pow(
                      sym("eq-s3-d1.t.speedOfLight", "speedOfLight"),
                      { num: 2, den: 1 },
                      "eq-s3-d1.op.vSquared",
                    ),
                    "eq-s3-d1.op.vOverVSquared",
                  ),
                  sym("eq-s3-d1.t.x", "spatialCoordinateX"),
                ],
                "eq-s3-d1.op.driftTerm",
              ),
              "eq-s3-d1.op.negTerm",
            ),
          ],
          "eq-s3-d1.op.diff",
        ),
        "eq-s3-d1.op.bracket",
      ),
    ],
    "eq-s3-d1.op.rhs",
  ),
  "eq-s3-d1.op.rel",
);

