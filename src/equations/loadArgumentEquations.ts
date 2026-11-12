import type { CompiledEquation } from "./viewTypes.ts";

export type ArgumentEquationPayload = Readonly<{
  equations: readonly CompiledEquation[];
  foundationTitles?: Readonly<Record<string, string>>;
}>;
export class EquationPayloadError extends Error {
  readonly code = "invalid-equation-argument";
  constructor() {
    super("No compiled equation payload is available for this argument.");
    this.name = "EquationPayloadError";
  }
}

/** The same small, generated per-argument chunks used by the equation explorer. */
export function loadArgumentEquations(argumentId: string): Promise<ArgumentEquationPayload> {
  if (!/^arg-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(argumentId))
    return Promise.reject(new EquationPayloadError());
  return import(`../generated/argument-equations/${argumentId}.json`);
}
