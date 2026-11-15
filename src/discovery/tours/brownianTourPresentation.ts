import type { PublishedResult } from "../../experiments/store/instanceStore.ts";

export type BrownianHistogram = Readonly<{
  edges: readonly number[];
  observed: readonly number[];
  model: readonly number[];
  outsideLeft: number;
  outsideRight: number;
}>;

/** Display copies only. Bin probabilities and every statistic still belong to the lab owner. */
export function brownianHistogram(outputs: readonly PublishedResult[]): BrownianHistogram | null {
  const vector = (id: string): readonly number[] | null => {
    const output = outputs.find((item) => item.quantityId === id);
    return output?.status === "value" && typeof output.value !== "number"
      ? Array.from(output.value.copy())
      : null;
  };
  const scalar = (id: string) => {
    const output = outputs.find((item) => item.quantityId === id);
    return output?.status === "value" && typeof output.value === "number" ? output.value : null;
  };
  const edges = vector("histogramEdges");
  const observed = vector("histogramFrequencies");
  const model = vector("histogramGaussian");
  const outsideLeft = scalar("underflow");
  const outsideRight = scalar("overflow");
  if (!edges || !observed || !model || outsideLeft === null || outsideRight === null ||
      edges.length !== observed.length + 1 || model.length !== observed.length)
    return null;
  return { edges, observed, model, outsideLeft, outsideRight };
}
