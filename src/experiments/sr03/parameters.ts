import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { powerOfTenText } from "../../units/scientific.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { EndpointPairChoice, FrameId, Sr03Parameters } from "./definition.ts";

const requiredKeys = ["rodRestFrame", "v", "L0", "measuringFrame", "endpointPairId", "R"] as const;
const optionalKeys = ["customT1", "customX1", "customT2", "customX2"] as const;
const allowedKeys = new Set<string>([...requiredKeys, ...optionalKeys]);

function refused(parameterIds: readonly string[], requirements: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}

export function validateSr03Parameters(input: unknown): Computation<Sr03Parameters> {
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  ) {
    return refused(requiredKeys, "Provide a plain settings record.");
  }
  const raw = input as Record<string, unknown>;

  const ownKeys = Reflect.ownKeys(raw);
  for (const k of ownKeys) {
    if (typeof k !== "string") return refused(requiredKeys, "Keys must be strings.");
    if (!allowedKeys.has(k)) {
      return refused(requiredKeys, `Unknown setting '${k}'.`);
    }
  }

  for (const k of requiredKeys) {
    if (!Object.hasOwn(raw, k)) {
      return refused([k], `Missing required parameter '${k}'.`);
    }
  }

  const rodRestFrame = raw.rodRestFrame as FrameId;
  if (rodRestFrame !== "K" && rodRestFrame !== "k") {
    return refused(
      ["rodRestFrame"],
      "Choose the platform frame K or the moving frame k as the rod's rest frame.",
    );
  }

  const measuringFrame = raw.measuringFrame as FrameId;
  if (measuringFrame !== "K" && measuringFrame !== "k") {
    return refused(
      ["measuringFrame"],
      "Choose the platform frame K or the moving frame k as the measuring observer's frame.",
    );
  }

  const vRaw = raw.v;
  if (typeof vRaw !== "number" || !Number.isFinite(vRaw)) {
    return {
      kind: "refused",
      refusal: makeRefusal(
        "nonfinite-input",
        { parameterIds: ["v"] },
        {
          details: { requirements: "Enter the relative speed v, as a fraction of c, as a number." },
        },
      ),
    };
  }

  if (Math.abs(vRaw) >= 1) {
    return {
      kind: "refused",
      refusal: makeRefusal("superluminal-observer", { parameterIds: ["v"] }),
    };
  }

  if (Math.abs(vRaw) > 0.95) {
    return {
      kind: "refused",
      refusal: makeRefusal("superluminal-observer", { parameterIds: ["v"] }),
    };
  }

  const L0Raw = raw.L0;
  if (typeof L0Raw !== "number" || !Number.isFinite(L0Raw) || L0Raw < 1e-6 || L0Raw > 1e6) {
    return refused(
      ["L0"],
      `Enter a proper rod length L_{0} from ${powerOfTenText(1e-6)} to ${powerOfTenText(1e6)} light-seconds.`,
    );
  }

  const RRaw = raw.R;
  if (typeof RRaw !== "number" || !Number.isFinite(RRaw) || RRaw < 1e-6 || RRaw > 1e6) {
    return refused(
      ["R"],
      `Enter a sphere radius R from ${powerOfTenText(1e-6)} to ${powerOfTenText(1e6)} light-seconds.`,
    );
  }

  const endpointPairId = raw.endpointPairId as EndpointPairChoice;
  const validPairs: readonly EndpointPairChoice[] = [
    "platform-simultaneous",
    "frame-simultaneous",
    "causal-timelike",
    "causal-lightlike",
    "causal-threshold",
    "custom",
  ];
  if (!validPairs.includes(endpointPairId)) {
    return refused(["endpointPairId"], `Unknown endpoint pair id '${endpointPairId}'.`);
  }

  let customT1: number | undefined;
  let customX1: number | undefined;
  let customT2: number | undefined;
  let customX2: number | undefined;

  if (endpointPairId === "custom") {
    customT1 = typeof raw.customT1 === "number" ? raw.customT1 : 0;
    customX1 = typeof raw.customX1 === "number" ? raw.customX1 : 0;
    customT2 = typeof raw.customT2 === "number" ? raw.customT2 : 0;
    customX2 = typeof raw.customX2 === "number" ? raw.customX2 : 10;

    if (![customT1, customX1, customT2, customX2].every(Number.isFinite)) {
      return {
        kind: "refused",
        refusal: makeRefusal(
          "nonfinite-input",
          { parameterIds: ["customT1", "customX1", "customT2", "customX2"] },
          {
            details: {
              requirements:
                "Enter both events' times, in seconds, and positions, in light-seconds, as numbers.",
            },
          },
        ),
      };
    }
  }

  const customParams =
    customT1 !== undefined &&
    customX1 !== undefined &&
    customT2 !== undefined &&
    customX2 !== undefined
      ? { customT1, customX1, customT2, customX2 }
      : {};

  const resultData: Sr03Parameters = {
    rodRestFrame,
    v: vRaw,
    L0: L0Raw,
    measuringFrame,
    endpointPairId,
    R: RRaw,
    ...customParams,
  };

  return {
    kind: "accepted",
    data: Object.freeze(resultData),
  };
}
