import { makeRefusal } from "../results/refusals.ts";
import { SR06_DEFAULTS, type Sr06Mode, type Sr06Parameters } from "./definition.ts";

export type Sr06ParameterCheck =
  | { kind: "accepted"; data: Sr06Parameters }
  | { kind: "refused"; refusal: ReturnType<typeof makeRefusal> };

const MODES: readonly Sr06Mode[] = ["collinear", "angled", "two-boosts"];

/** What each numeric control is called on the page (VelocityCompositionLab), with its unit. */
const SR06_FIELD_NAMES: Partial<Record<string, string>> = {
  frameBeta: "the frame speed v/c",
  movingSpeed: "the moving-frame speed w/c",
  alphaDeg: "the angle α, in degrees,",
  secondBeta: "the second boost speed v/c",
  secondAngleDeg: "the second boost angle, in degrees,",
  mediumIndex: "the medium index n",
  flowSpeed: "the medium flow speed, in m/s,",
};

export function validateSr06Parameters(input: unknown): Sr06ParameterCheck {
  const bad = (requirements: string, parameterIds: string[] = [], code = "invalid-parameter") => ({
    kind: "refused" as const,
    refusal: makeRefusal(
      "invalid-parameter",
      { parameterIds },
      { details: { requirements, code } },
    ),
  });
  if (!input || typeof input !== "object") return bad("Use a complete parameter record.");
  const keys = Object.keys(SR06_DEFAULTS);
  if (
    Reflect.ownKeys(input).length !== keys.length ||
    Reflect.ownKeys(input).some((k) => typeof k !== "string" || !keys.includes(k))
  )
    return bad("Use complete known data fields.");
  const p = input as Sr06Parameters;
  if (typeof p.showRapidity !== "boolean" || !MODES.includes(p.mode))
    return bad("Choose collinear, angled, or two-boosts, and a rapidity toggle.");
  for (const k of keys as (keyof Sr06Parameters)[]) {
    if (
      typeof SR06_DEFAULTS[k] === "number" &&
      (typeof p[k] !== "number" || !Number.isFinite(p[k]))
    )
      return bad(`Enter ${SR06_FIELD_NAMES[k] ?? "this value"} as a number.`, [k]);
  }
  if (Math.abs(p.frameBeta) >= 1 || Math.abs(p.secondBeta) >= 1)
    return {
      kind: "refused",
      refusal: makeRefusal(
        "superluminal-observer",
        { parameterIds: Math.abs(p.frameBeta) >= 1 ? ["frameBeta"] : ["secondBeta"] },
        {
          rankedRepairs: [
            {
              label: "Use 0.95 of light speed.",
              action: {
                parameterId: Math.abs(p.frameBeta) >= 1 ? "frameBeta" : "secondBeta",
                value: 0.95,
              },
            },
          ],
        },
      ),
    };
  if (p.movingSpeed < 0 || p.movingSpeed > 1)
    return bad("Enter a moving-frame speed w/c from 0 to 1.", ["movingSpeed"]);
  if (!(p.mediumIndex > 1) || p.mediumIndex > 3)
    return bad("Enter a medium index n above 1 and at most 3.", ["mediumIndex"]);
  if (!Number.isFinite(p.flowSpeed) || Math.abs(p.flowSpeed) > 1e3)
    return bad("Enter a medium flow speed of at most 1000 m/s either way.", ["flowSpeed"]);
  return { kind: "accepted", data: Object.freeze({ ...p }) };
}
