/** Shared bounded projection for the conditional light-quanta proof owners. */
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";

/** Getters and cyclic/deep input are refused before projection and exact arithmetic. */
export function boundedLqExpression(value: unknown): Expression | undefined {
  let nodes = 0;
  function plain(item: unknown, depth: number): boolean {
    if (++nodes > 2048 || depth > 24) return false;
    if (item === null || typeof item === "boolean") return true;
    if (typeof item === "string") return item.length <= 1000;
    if (typeof item === "number") return Number.isFinite(item);
    if (typeof item !== "object") return false;
    if (Array.isArray(item)) {
      if (Object.getPrototypeOf(item) !== Array.prototype) return false;
      const descriptors = Object.getOwnPropertyDescriptors(item);
      const length = Object.getOwnPropertyDescriptor(item, "length")?.value;
      return (
        Number.isSafeInteger(length) &&
        length <= 32 &&
        Reflect.ownKeys(descriptors).length === length + 1 &&
        Object.entries(descriptors).every(
          ([key, descriptor]) =>
            "value" in descriptor &&
            (key === "length" ||
              (/^(?:0|[1-9]\d*)$/.test(key) && plain(descriptor.value, depth + 1))),
        )
      );
    }
    if (![null, Object.prototype].includes(Object.getPrototypeOf(item))) return false;
    const descriptors = Object.getOwnPropertyDescriptors(item);
    if (
      descriptors.kind?.value === "symbol" &&
      (typeof descriptors.quantityId?.value !== "string" ||
        typeof descriptors.termId?.value !== "string" ||
        (descriptors.index !== undefined && typeof descriptors.index.value !== "string"))
    )
      return false;
    return (
      Object.keys(descriptors).length <= 12 &&
      Object.values(descriptors).every(
        (descriptor) => "value" in descriptor && plain(descriptor.value, depth + 1),
      )
    );
  }
  return value !== null && typeof value === "object" && plain(value, 0)
    ? projectDerivationSymbols(
        value as Expression,
        (node) => node.quantityId + (node.index ? `[${node.index}]` : ""),
      )
    : undefined;
}
