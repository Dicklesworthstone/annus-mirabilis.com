import { encodeResult } from "../results/codec.ts";
import { validateLq06Parameters } from "./parameters.ts";
import { evaluateLq06, type PreparedLq06Example } from "./session.ts";

/** Preflight a link before replacing the currently displayed example. Shape-valid but
 * unrepresentable calculations must leave that example intact instead of failing in render. */
export function prepareLinkedCoefficientExample(
  example: PreparedLq06Example,
  input: unknown,
):
  | Readonly<{ kind: "accepted"; example: PreparedLq06Example }>
  | Readonly<{ kind: "invalid"; message: string }> {
  try {
    const checked = validateLq06Parameters(input);
    if (checked.kind !== "accepted")
      return {
        kind: "invalid",
        message: "The linked coefficient settings are invalid. The displayed example is unchanged.",
      };
    const outputs = evaluateLq06(checked.data);
    return {
      kind: "accepted",
      example: {
        ...example,
        parameters: checked.data,
        results: outputs.map(encodeResult),
        stepIndex: 0,
        simulationTime: 0,
      },
    };
  } catch {
    return {
      kind: "invalid",
      message:
        "The linked calculation is outside the numerical range. The displayed example is unchanged.",
    };
  }
}
