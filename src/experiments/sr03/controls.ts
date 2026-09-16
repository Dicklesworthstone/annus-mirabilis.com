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
  const v = Number(d.v);
  const L0 = Number(d.L0);
  const R = Number(d.R);

  if (Number.isNaN(v)) throw new Error("Frame velocity v must be a valid number.");
  if (Number.isNaN(L0)) throw new Error("Proper length L0 must be a valid number.");
  if (Number.isNaN(R)) throw new Error("Radius R must be a valid number.");

  const customT1 = d.customT1 !== undefined ? Number(d.customT1) : undefined;
  const customX1 = d.customX1 !== undefined ? Number(d.customX1) : undefined;
  const customT2 = d.customT2 !== undefined ? Number(d.customT2) : undefined;
  const customX2 = d.customX2 !== undefined ? Number(d.customX2) : undefined;

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
