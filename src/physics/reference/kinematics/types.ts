import type { DomainKind } from "../../../experiments/results/types.ts";
import type { SignClassification } from "../../../units/tolerance.ts";

export type Event = Readonly<{ t: number; x: number; y: number; z: number }>;
export type Velocity = Readonly<{ ux: number; uy: number; uz: number }>;
export type BetaVector = Readonly<{ bx: number; by: number; bz: number }>;

export type OutsideDomain = Readonly<{
  status: "outside-domain";
  condition: string;
  domainKind: DomainKind;
  reason: string;
}>;

export type KinematicOk<T> = Readonly<{ status: "value"; value: T }>;
export type KinematicResult<T> = KinematicOk<T> | OutsideDomain;

export type IntervalKind = "timelike" | "null" | "spacelike" | "indeterminate";

export type IntervalReport = Readonly<{
  s2: number;
  kind: IntervalKind;
  classification: SignClassification;
}>;

export type Boost = Readonly<{
  beta: BetaVector;
  c: number;
  gamma: number;
  matrix: ReadonlyArray<ReadonlyArray<number>>;
}>;

export type CompositionReport = Readonly<{
  boost: Boost;
  rotation: ReadonlyArray<ReadonlyArray<number>>;
  product: ReadonlyArray<ReadonlyArray<number>>;
  wignerAngle: number;
  resultantSpeed: number;
}>;

export function outsideDomain(condition: string, reason: string): OutsideDomain {
  return Object.freeze({
    status: "outside-domain",
    condition,
    domainKind: "physical",
    reason,
  });
}

export function ok<T>(value: T): KinematicOk<T> {
  return Object.freeze({ status: "value", value });
}
