import { type AttributeMap, DomContractError, parseInstrumentRoot } from "../domContract.ts";

export type InstrumentIdentity = ReturnType<typeof parseInstrumentRoot>;

/** Parses every identity attribute the harness DOM contract requires. Names a missing one. */
export function readInstrumentIdentity(
  attrs: AttributeMap,
  declaredModes?: readonly string[],
): InstrumentIdentity {
  return parseInstrumentRoot(attrs, declaredModes);
}

export function missingIdentityAttribute(error: unknown): string | undefined {
  if (error instanceof DomContractError) return error.attribute;
  return undefined;
}
