/**
 * Shared interaction primitives and family contracts.
 * Specification: am-inst-interaction-families-m2ps, AGENTS.md §10.4–10.5.
 */

import type { CommandClass } from "../commands/types.ts";

export { ACTION_FAMILIES, type ActionFamily } from "../../content/schemas/experiment.ts";

export interface TypedActionPayload<TInputs = Record<string, unknown>> {
  readonly instrumentId: string;
  readonly actionId: string;
  readonly inputs: TInputs;
  readonly commandClass: CommandClass;
  readonly timestamp?: number | undefined;
}

export interface BaseInteractionProps<TInputs = Record<string, unknown>> {
  readonly instrumentId: string;
  readonly actionId: string;
  readonly commandClass?: CommandClass | undefined;
  readonly onAction: (action: TypedActionPayload<TInputs>) => void;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
  readonly "data-testid"?: string | undefined;
}
