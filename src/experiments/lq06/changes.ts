import type { Command, Parameters } from "../store/instanceStore.ts";
import { LQ06_CLASSES, type Lq06Parameters } from "./definition.ts";

/** Apply every changed class, in revision order, then publish only the last token. */
export function lq06Changes(previous: Lq06Parameters, next: Lq06Parameters) {
  const groups: Record<string, Record<string, number | string | boolean>> = {
    input: {}, measurement: {}, presentation: {},
  };
  for (const key of Object.keys(next) as (keyof Lq06Parameters)[]) {
    if (!Object.is(previous[key], next[key])) {
      const group = groups[LQ06_CLASSES[key]];
      if (!group) throw new TypeError(`Unsupported LQ-06 parameter class for ${key}.`);
      group[key] = next[key];
    }
  }
  const changes: Readonly<{ command: Command; patch: Parameters }>[] = [];
  for (const [cls, command] of [
    ["input", "setup-change"],
    ["measurement", "measurement-change"],
    ["presentation", "presentation-change"],
  ] as const) {
    const patch = groups[cls];
    if (patch && Object.keys(patch).length) changes.push(Object.freeze({ command, patch: Object.freeze(patch) }));
  }
  return Object.freeze(changes);
}
