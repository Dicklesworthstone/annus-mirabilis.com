import type { DomainKind } from "./types.ts";

export type RefusalDefinition = Readonly<{
  domainKind: DomainKind;
  message: string;
  repair: string;
}>;

/** A registration without reader language must never earn an explanation id. */
export function defineRefusalRegistry<const T extends Record<string, RefusalDefinition>>(
  entries: T,
): Readonly<T> {
  const registry = { ...entries };
  for (const [code, definition] of Object.entries(registry)) {
    if (
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(code) ||
      !["physical", "model", "numerical", "input"].includes(definition.domainKind) ||
      !definition.message.trim() ||
      !definition.repair.trim()
    ) {
      throw new TypeError(`Invalid refusal definition: ${code}`);
    }
    if (
      ["input", "numerical"].includes(definition.domainKind) &&
      /\b(impossible|nature|forbidden)\b/i.test(`${definition.message} ${definition.repair}`)
    ) {
      throw new TypeError(`Software refusal makes a physical claim: ${code}`);
    }
    Object.defineProperty(registry, code, { value: Object.freeze({ ...definition }) });
  }
  return Object.freeze(registry);
}

export const refusalCodeRegistry = defineRefusalRegistry({
  "circular-radius-from-displacement": {
    domainKind: "model",
    message:
      "A radius inferred from these same displacements with an assumed molecular number cannot independently recover that number.",
    repair:
      "Declare a radius from an independent measurement, or inspect the compatible radius–number family.",
  },
  "ftcs-unstable": {
    domainKind: "numerical",
    message: "This time step is too large for the explicit diffusion scheme.",
    repair: "Reduce the time step to the stated limit.",
  },
  "off-replay-grid": {
    domainKind: "numerical",
    message: "This interval is not on the recorded time grid.",
    repair: "Choose a recorded interval, or start a new run with a different grid.",
  },
  "superluminal-observer": {
    domainKind: "physical",
    message: "An inertial observer must move more slowly than light in this model.",
    repair: "Choose a speed with magnitude below the speed of light.",
  },
  "outside-wien-domain": {
    domainKind: "model",
    message: "The Wien approximation does not describe this radiation regime.",
    repair: "Choose a lower density or compare with a different radiation model.",
  },
  "stokes-gas-medium": {
    domainKind: "model",
    message: "This Stokes-drag model omits the slip correction needed for small tracers in a gas.",
    repair: "Choose a Newtonian liquid, or a model with a slip correction.",
  },
  // A laboratory setting outside the modelDomain its manifest declares (content/experiments/<id>.yaml).
  // The refusal's details.requirements names the range, in the page's units, and the manifest's reason.
  "outside-model-domain": {
    domainKind: "model",
    message: "This setting is outside the range the model describes.",
    repair: "Enter a value inside the stated range.",
  },
  "invalid-seed": {
    domainKind: "input",
    message: "The seed must be an unsigned 64-bit whole number written in canonical decimal form.",
    repair: "Enter digits without a sign, spaces, or leading zeros.",
  },
  "nonfinite-input": {
    domainKind: "input",
    message: "One of the inputs is not a finite number.",
    repair: "Enter a finite number in the stated units.",
  },
  "unsupported-kernel": {
    domainKind: "input",
    message: "This step distribution is not registered for this calculation.",
    repair: "Choose a registered step distribution.",
  },
  "invalid-parameter": {
    domainKind: "input",
    message: "These inputs do not meet the calculation's stated requirements.",
    repair: "Use the stated range and input combination.",
  },
  "stream-index-overflow": {
    domainKind: "input",
    message: "This request would exceed the random stream's 64-bit draw counter.",
    repair: "Request fewer draws, or start a new identified stream.",
  },
  "drift-diffusion-unstable": {
    domainKind: "numerical",
    message: "This time step exceeds the explicit drift-diffusion scheme's positivity limit.",
    repair: "Reduce the time step to the stated limit.",
  },
  "drift-cfl-exceeded": {
    domainKind: "numerical",
    message: "This time step exceeds the upwind drift scheme's Courant limit.",
    repair: "Reduce the time step to the stated limit.",
  },
  "quantile-not-converged": {
    domainKind: "numerical",
    message: "The quantile calculation did not reach its stated accuracy.",
    repair: "Retry with a larger iteration budget.",
  },
  "tape-version-unsupported": {
    domainKind: "input",
    message: "This shared state was recorded with an unsupported tape version.",
    repair: "Start a new run with the current model.",
  },
  "tape-model-mismatch": {
    domainKind: "input",
    message: "This shared state was recorded with a different model identity or version.",
    repair: "Start a new run with the current model.",
  },
  "tape-artifact-mismatch": {
    domainKind: "input",
    message: "This shared state was recorded with a different computational artifact digest.",
    repair: "Start a new run with the current model.",
  },
  "tape-constant-set-mismatch": {
    domainKind: "input",
    message: "This shared state was recorded with a different physical constant set.",
    repair: "Start a new run with the current model.",
  },
  "tape-stream-version-mismatch": {
    domainKind: "input",
    message:
      "This shared state was recorded with a different pseudorandom stream generator version.",
    repair: "Start a new run with the current model.",
  },
  "tape-allocation-mismatch": {
    domainKind: "input",
    message: "This shared state was recorded with a different random stream allocation.",
    repair: "Start a new run with the current model.",
  },
  "tape-grid-mismatch": {
    domainKind: "input",
    message: "This shared state was recorded on a different stochastic replay grid.",
    repair: "Start a new run with the current model.",
  },
});
export type RefusalCode = keyof typeof refusalCodeRegistry;
