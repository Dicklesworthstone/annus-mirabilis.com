import { type RefusalCode, refusalCodeRegistry } from "./refusalCodes.ts";
import type { DomainKind, ParameterAction } from "./types.ts";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type RequestRefusal = Readonly<{
  code: RefusalCode;
  domainKind: DomainKind;
  affected: Readonly<{ parameterIds?: readonly string[]; capabilityId?: string }>;
  message: string;
  rankedRepairs: readonly Readonly<{ label: string; action?: ParameterAction }>[];
  details?: Readonly<Record<string, JsonValue>>;
}>;

/** Raw engine error strings belong in details, never in the reader's message. */
export function makeRefusal(
  code: RefusalCode,
  affected: RequestRefusal["affected"],
  options: Pick<RequestRefusal, "details"> & {
    rankedRepairs?: RequestRefusal["rankedRepairs"];
  } = {},
): RequestRefusal {
  const definition = refusalCodeRegistry[code];
  if (!definition) throw new TypeError(`Unregistered refusal code: ${code}`);
  return {
    code,
    domainKind: definition.domainKind,
    affected,
    message: definition.message,
    rankedRepairs: options.rankedRepairs ?? [{ label: definition.repair }],
    ...(options.details === undefined ? {} : { details: options.details }),
  };
}

/** The sentence a reader is shown for a refusal: the validator's specific requirement when it gave
 * one in details.requirements, otherwise the code's registered message. */
export function refusalSentence(refusal: Pick<RequestRefusal, "message" | "details">): string {
  const requirement = refusal.details?.requirements;
  return typeof requirement === "string" && requirement.trim() ? requirement : refusal.message;
}
