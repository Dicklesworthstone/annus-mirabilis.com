import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import type { SketchPoint } from "../tapes/schema.ts";

export const BM06_CURVE_PROMPT = "bm-06-predict-density-shape";

export type Bm06PredictionCurve =
  | Readonly<{ kind: "curve"; points: readonly SketchPoint[] }>
  | Readonly<{ kind: "unavailable"; reason: string }>;

/** Change the axes of accepted samples; this projection never evaluates the Gaussian law. */
export function bm06PredictionCurve(snapshot: AcceptedSnapshot): Bm06PredictionCurve {
  const x = snapshot.outputs.find((output) => output.quantityId === "positionCoordinate1d");
  const density = snapshot.outputs.find((output) => output.quantityId === "probabilityDensity");
  const rms = snapshot.outputs.find((output) => output.quantityId === "rmsDisplacement1d");
  if (density?.status === "analytic-limit")
    return {
      kind: "unavailable",
      reason:
        "At zero time all probability is at the starting point. There is no finite density curve to compare with a sketch.",
    };
  if (
    x?.status !== "value" ||
    typeof x.value === "number" ||
    density?.status !== "value" ||
    typeof density.value === "number" ||
    rms?.status !== "value" ||
    typeof rms.value !== "number" ||
    !Number.isFinite(rms.value) ||
    rms.value <= 0 ||
    x.value.length !== density.value.length ||
    x.value.length < 2
  )
    return {
      kind: "unavailable",
      reason: "This accepted result has no finite density samples for a comparison.",
    };
  const positions = x.value;
  const heights = density.value;
  const scale = rms.value;
  const points = Array.from(
    { length: positions.length },
    (_, index): SketchPoint => [positions.at(index) / scale, heights.at(index) * scale],
  );
  if (points.some(([position, height]) => !Number.isFinite(position) || !Number.isFinite(height)))
    return {
      kind: "unavailable",
      reason: "This accepted result cannot be represented on the comparison axes.",
    };
  return { kind: "curve", points };
}
