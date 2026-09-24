import { expect, test } from "bun:test";
import {
  BOLTZMANN_CONSTANT,
  configurations,
  GRAM_MOLECULE,
  SQUEEZES,
} from "../foundations/configurations.ts";
import { constantValue, getConstantSet } from "../physics/reference/constants.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * am-found-transport-thermo-smv3: the configuration counter holds k_B and N_A itself, because a
 * client component may not import the physics owners. This file, which may, pins both to the
 * owner's exact 2019 SI values, so the counter's gram-molecule entropy is exactly R ln(v/v₀).
 */

const modern = getConstantSet("modern-si-2019");

test("k_B and N_A are the constants owner's exact 2019 SI values", () => {
  expect(BOLTZMANN_CONSTANT).toBe(constantValue(modern, "boltzmannConstant").value);
  expect(GRAM_MOLECULE).toBe(constantValue(modern, "avogadroConstant").value);
});

test("for a gram-molecule the counter's entropy change is R ln(v/v₀) for every squeeze", () => {
  const R = constantValue(modern, "molarGasConstant").value;
  for (const squeeze of SQUEEZES) {
    const expected = R * Math.log(squeeze.kept / squeeze.cells);
    const actual = configurations(GRAM_MOLECULE, squeeze).entropyChange;
    expect(withinTolerance(actual, expected, { relative: 1e-12 }).ok, squeeze.name).toBe(true);
  }
});
