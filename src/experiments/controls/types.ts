/**
 * Parameter Controls Types and Contracts.
 * Specification: am-inst-parameter-controls-cmj9, am-cm-schemas-experiment-fuu, am-rt-command-classes-dzp.
 */

import type {
  CommandClass,
  ModelDomain,
  NumericalDomain,
  ParameterMapping,
  ParameterSpec,
  VisualRange,
} from "../../content/schemas/experiment.ts";

export type {
  CommandClass,
  ModelDomain,
  NumericalDomain,
  ParameterMapping,
  ParameterSpec,
  VisualRange,
};

export type ControlDomainStatus = "inside" | "boundary" | "outside" | "beyond-track" | "off-grid";

export interface DomainValidationResult {
  readonly valid: boolean;
  readonly status: "inside" | "boundary" | "outside";
  readonly isBeyondVisualTrack: boolean;
  readonly explanation?: string | undefined;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly minInclusive?: boolean | undefined;
  readonly maxInclusive?: boolean | undefined;
  readonly enumerated?: readonly number[] | undefined;
}

export interface OffGridDecision {
  readonly onGrid: boolean;
  readonly status: "on-grid" | "off-grid";
  readonly stepSize?: number | undefined;
  readonly offeredNeighbours: readonly number[];
  readonly explanation?: string | undefined;
}

export type ParseSuccess<T = number | string> = Readonly<{
  ok: true;
  canonicalValue: T;
  displayValue: string;
  isBeyondVisualTrack: boolean;
  unit?: string | undefined;
}>;

export type ParseFailure = Readonly<{
  ok: false;
  error: string;
  explanation: string;
  rawInput: string;
  offeredNeighbours?: readonly number[] | undefined;
}>;

export type ParseResult<T = number | string> = ParseSuccess<T> | ParseFailure;

export interface ControlState {
  readonly rawText: string;
  readonly canonicalValue: number | string;
  readonly displayValue: string;
  readonly isValid: boolean;
  readonly isBeyondVisualTrack: boolean;
  readonly domainStatus: ControlDomainStatus;
  readonly explanation?: string | undefined;
  readonly offeredNeighbours?: readonly number[] | undefined;
}

export interface ParameterControlProps {
  readonly spec: ParameterSpec;
  readonly value: number | string;
  readonly onChange?: ((value: number | string, commandClass: CommandClass) => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly dependentGridValue?: number | undefined;
  readonly "data-testid"?: string | undefined;
  readonly acceptedInputRevision?: number | undefined;
}

export interface ResetOptions {
  readonly mode: "same-seed" | "new-trial";
}

export interface ControlsPanelProps {
  readonly specs: readonly ParameterSpec[];
  readonly values: Record<string, number | string>;
  readonly onChange: (
    parameterId: string,
    value: number | string,
    commandClass: CommandClass,
  ) => void;
  readonly onReset?: ((options: ResetOptions) => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
  readonly advancedParameterIds?: readonly string[] | undefined;
  readonly acceptedInputRevision?: number | undefined;
}
