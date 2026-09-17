/**
 * Types and data structures for Equation Genealogy (am-eq-genealogy-hmm).
 *
 * Models the derivation graph derived from equation `usedBy` references and
 * derivation-chain premises. Maintains distinction between historical routes
 * and modern verification oracles, enforces cross-paper provenance tracking
 * (such as Paper 3 §8 light energy transform -> Paper 4 mass-energy),
 * and defines the layout data structures for deterministic rendering.
 */

import type { LogicalRole, PremiseEdgeType } from "../../content/schemas/meanings.ts";
import type { AdmittedImport } from "../derivations/types.ts";

export type GenealogyPerspective = "historical" | "modern";

export type GenealogyNodeType =
  | "postulate"
  | "equation"
  | "result"
  | "premise"
  | "external";

export interface GenealogyNode {
  readonly id: string;
  readonly paper: string;
  readonly label: string;
  readonly type: GenealogyNodeType;
  readonly spokenForm?: string | undefined;
  readonly latex?: string | undefined;
  readonly anchor?: string | undefined;
  readonly isRoot: boolean;
  readonly isNumberedResult: boolean;
  readonly isTarget?: boolean | undefined;
  readonly section?: string | undefined;
  readonly logicalRole?: LogicalRole | undefined;
}

export interface GenealogyEdge {
  readonly from: string;
  readonly to: string;
  readonly edgeType: PremiseEdgeType;
  readonly isPremise: boolean;
  readonly crossPaper: boolean;
  readonly targetPaper?: string | undefined;
  readonly provenance?: AdmittedImport | undefined;
}

export interface GenealogyGraph {
  readonly paper: string;
  readonly perspective: GenealogyPerspective;
  readonly nodes: readonly GenealogyNode[];
  readonly edges: readonly GenealogyEdge[];
  readonly roots: readonly string[];
  readonly crossPaperEdges: readonly GenealogyEdge[];
}

export const GENEALOGY_DIAGNOSTIC_CODES = [
  "missing-premise-edge",
  "spurious-genealogy-edge",
  "genealogy-orphan-result",
  "invalid-cross-paper-edge-set",
  "modern-oracle-in-historical-view",
  "genealogy-cycle-detected",
] as const;

export type GenealogyDiagnosticCode = (typeof GENEALOGY_DIAGNOSTIC_CODES)[number];

export interface GenealogyDiagnostic {
  readonly code: GenealogyDiagnosticCode;
  readonly message: string;
  readonly nodeId?: string | undefined;
  readonly edge?: Readonly<{ from: string; to: string }> | undefined;
  readonly anchor?: string | undefined;
}

export interface LayoutNode {
  readonly id: string;
  readonly layer: number;
  readonly order: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly node: GenealogyNode;
}

export interface LayoutEdge {
  readonly from: string;
  readonly to: string;
  readonly edge: GenealogyEdge;
  readonly path: string;
  readonly fromPoint: Readonly<{ x: number; y: number }>;
  readonly toPoint: Readonly<{ x: number; y: number }>;
}

export interface GenealogyLayoutResult {
  readonly nodes: readonly LayoutNode[];
  readonly edges: readonly LayoutEdge[];
  readonly layers: readonly (readonly LayoutNode[])[];
  readonly width: number;
  readonly height: number;
  readonly svgMarkup: string;
}

export type GenealogyNavDirection = "up" | "down" | "left" | "right";
