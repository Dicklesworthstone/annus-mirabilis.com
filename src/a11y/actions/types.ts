/**
 * Types and interfaces for the Action Contract Framework (am-a11y-action-contracts-k75g).
 *
 * Ensures every scientific interaction in an instrument has a nonvisual equivalent
 * with identical command semantics, identical output hashes, and verifiable equivalence.
 */

import type { CommandClass } from "../../content/schemas/experiment.ts";

export type ActionFamily =
  | "interval"
  | "event-table"
  | "ratio"
  | "axis-component"
  | "object-inclusion"
  | "subexpression";

export interface ActionAcceptedResult {
  readonly outputs: readonly string[];
  readonly allowedStatuses: readonly string[];
}

export interface ActionContract {
  readonly actionId: string;
  readonly family: ActionFamily;
  readonly question: string;
  readonly inputs: readonly string[];
  readonly commandClass: CommandClass;
  readonly acceptedResult: ActionAcceptedResult;
  readonly visualAffordance: string;
  readonly equivalentAffordance: string;
  readonly announcement: string;
  readonly modalities?:
    | readonly ("keyboard" | "direct-entry" | "screen-reader" | "switch-control")[]
    | undefined;
}

export interface CanonicalActionCommand {
  readonly actionId: string;
  readonly commandClass: CommandClass;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly timestamp?: string | undefined;
}

export interface ActionExecutionResult {
  readonly actionId: string;
  readonly affordance: "visual" | "equivalent";
  readonly command: CanonicalActionCommand;
  readonly commandHash: string;
  readonly acceptedOutputs: Readonly<Record<string, unknown>>;
  readonly outputsHash: string;
  readonly snapshotVersion: number;
  readonly announcementText?: string | undefined;
}

export interface EquivalenceComparisonResult {
  readonly actionId: string;
  readonly equivalent: boolean;
  readonly commandHashMatches: boolean;
  readonly outputsHashMatches: boolean;
  readonly snapshotVersionMatches: boolean;
  readonly visualExecution: ActionExecutionResult;
  readonly equivalentExecution: ActionExecutionResult;
  readonly mismatchReason?: string | undefined;
}

export type ActionContractAuditCode =
  | "missing-action-contract"
  | "drag-only-action-forbidden"
  | "missing-visual-affordance"
  | "missing-equivalent-affordance"
  | "missing-action-announcement"
  | "action-equivalent-insufficient"
  | "result-outputs-mismatch"
  | "action-id-mismatch";

export interface ActionContractAuditDiagnostic {
  readonly code: ActionContractAuditCode;
  readonly message: string;
  readonly instrumentId: string;
  readonly actionId?: string | undefined;
  readonly path?: string | undefined;
}
