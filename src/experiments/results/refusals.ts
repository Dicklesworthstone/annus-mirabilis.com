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
