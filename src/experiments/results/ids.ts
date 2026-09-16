import { executionOutcomeRegistry } from "./outcomes.ts";
import { type RefusalDefinition, refusalCodeRegistry } from "./refusalCodes.ts";
import { outputStatusRegistry } from "./types.ts";

function keys<T extends object>(registry: T): readonly (keyof T & string)[] {
  return Object.freeze(Object.keys(registry).sort()) as readonly (keyof T & string)[];
}
export function resultIds<const R extends Record<string, RefusalDefinition>>(refusals: R) {
  const outputStatusIds = keys(outputStatusRegistry);
  const executionOutcomeIds = keys(executionOutcomeRegistry);
  const refusalCodeIds = keys(refusals);
  const statusEnumIds = Object.freeze(
    [...new Set<string>([...outputStatusIds, ...executionOutcomeIds, ...refusalCodeIds])].sort(),
  );
  return Object.freeze({ outputStatusIds, executionOutcomeIds, refusalCodeIds, statusEnumIds });
}
export const { outputStatusIds, executionOutcomeIds, refusalCodeIds, statusEnumIds } =
  resultIds(refusalCodeRegistry);
