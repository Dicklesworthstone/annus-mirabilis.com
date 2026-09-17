import type { PublishedResult } from "../store/instanceStore.ts";

/** Rendering adapter only: immutable store NumericViews and raw prepared arrays. */
export function readVector3(
  item: PublishedResult | undefined,
): readonly [number, number, number] | null {
  if (!item || item.status !== "value" || typeof item.value !== "object" || item.value === null)
    return null;
  const data = item.value;
  if (!("length" in data) || data.length !== 3 || !("at" in data) || typeof data.at !== "function")
    return null;
  const values = [data.at(0), data.at(1), data.at(2)];
  if (!values.every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  return Object.freeze(values) as readonly [number, number, number];
}
export function readScalar(item: PublishedResult | undefined): number | null {
  return item?.status === "value" && typeof item.value === "number" && Number.isFinite(item.value)
    ? item.value
    : null;
}
