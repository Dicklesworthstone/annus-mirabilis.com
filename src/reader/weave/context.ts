import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";

/** Labels for accepted metadata, not a second source of settings or scientific outputs. */
export type WeaveContextField = Readonly<{
  parameterId: string;
  label: string;
  unit?: string;
  values?: Readonly<Record<string, string>>;
}>;

export const TRACER_WEAVE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "M", label: "Sample size" }),
  Object.freeze({ parameterId: "seed", label: "Seed" }),
]);

/**
 * A grid has no sample size or seed; a walk calls its sample size walkers, not M. The binding
 * names the metadata relevant to its experiment, and every value is read from the SAME accepted
 * snapshot as the comparisons. Unit labels are canonical units, never control display units.
 */
export function weaveContext(
  accepted: Pick<AcceptedSnapshot, "parameters">,
  fields: readonly WeaveContextField[],
): readonly Readonly<{ id: string; label: string; value: string }>[] {
  return fields.map((field) => {
    const value = Object.hasOwn(accepted.parameters, field.parameterId)
      ? accepted.parameters[field.parameterId]
      : undefined;
    const present = typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && value.length > 0);
    const key = String(value);
    const text = field.values && Object.hasOwn(field.values, key) ? field.values[key] : key;
    return Object.freeze({
      id: field.parameterId,
      label: field.label,
      value: present ? `${text}${field.unit ? ` ${field.unit}` : ""}` : "not recorded",
    });
  });
}
