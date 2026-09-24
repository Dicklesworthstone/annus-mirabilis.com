import { readTypedNumber } from "../controls/typedNumber.ts";
import type { Sr03Parameters } from "./definition.ts";
import { validateSr03Parameters } from "./parameters.ts";

export interface Sr03Draft {
  rodRestFrame: string;
  v: string;
  L0: string;
  measuringFrame: string;
  endpointPairId: string;
  R: string;
  customT1?: string;
  customX1?: string;
  customT2?: string;
  customX2?: string;
}

export function toSr03Draft(p: Sr03Parameters): Sr03Draft {
  const draft: Record<string, string> = {
    rodRestFrame: p.rodRestFrame,
    v: String(p.v),
    L0: String(p.L0),
    measuringFrame: p.measuringFrame,
    endpointPairId: p.endpointPairId,
    R: String(p.R),
  };
  if (p.customT1 !== undefined) draft.customT1 = String(p.customT1);
  if (p.customX1 !== undefined) draft.customX1 = String(p.customX1);
  if (p.customT2 !== undefined) draft.customT2 = String(p.customT2);
  if (p.customX2 !== undefined) draft.customX2 = String(p.customX2);
  return draft as unknown as Sr03Draft;
}

export function fromSr03Draft(d: Sr03Draft): Sr03Parameters {
  // Number("") is 0, so a cleared field would read as 0 and apply without a word (dispatch 165).
  const read = (text: string, label: string): number => {
    const typed = readTypedNumber(text, label);
    if (typed.kind === "refused") throw new Error(typed.requirement);
    return typed.value;
  };
  const v = read(d.v, "the frame speed v/c");
  const L0 = read(d.L0, "the proper length L₀");
  const R = read(d.R, "the sphere radius R");

  const custom = d.customT1 !== undefined;
  const customT1 = custom ? read(d.customT1 ?? "", "the time of the first event") : undefined;
  const customX1 = custom ? read(d.customX1 ?? "", "the place of the first event") : undefined;
  const customT2 = custom ? read(d.customT2 ?? "", "the time of the second event") : undefined;
  const customX2 = custom ? read(d.customX2 ?? "", "the place of the second event") : undefined;

  const raw: Record<string, unknown> = {
    rodRestFrame: d.rodRestFrame,
    v,
    L0,
    measuringFrame: d.measuringFrame,
    endpointPairId: d.endpointPairId,
    R,
    ...(customT1 !== undefined ? { customT1, customX1, customT2, customX2 } : {}),
  };

  const validation = validateSr03Parameters(raw);
  if (validation.kind === "refused") {
    throw new Error(
      typeof validation.refusal.details?.requirements === "string"
        ? validation.refusal.details.requirements
        : validation.refusal.message,
    );
  }
  if (validation.kind !== "accepted") {
    throw new Error("Invalid parameters.");
  }
  return validation.data;
}
