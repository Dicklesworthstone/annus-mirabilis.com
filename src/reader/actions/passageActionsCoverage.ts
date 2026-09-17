/**
 * Coverage pass for am-read-passage-actions-vbe. Lists hard passages missing an
 * obstacle response and abstract derivations missing an example. Shape matches
 * CoverageDiagnostic in src/content/coverage/types.ts so the ledger bead can
 * consume the rows later; this module does not write ledger artifacts itself.
 */
import {
  OBSTACLE_KIND_IDS,
  type ObstacleKindId,
  type PassageActions,
} from "./passageActions.schema.ts";

export type PassageActionsCoverageGap = Readonly<{
  severity: "flag";
  rule: "hard-passage-missing-obstacle" | "abstract-derivation-missing-example";
  paper: string;
  argumentId: string;
  message: string;
  repair: string;
  obstacleKind?: ObstacleKindId;
}>;

export interface PassageActionsCoverageRecord {
  readonly paper: string;
  readonly argumentId: string;
  readonly actions: PassageActions;
  /** True when this passage is an abstract derivation that owes an example. */
  readonly abstractDerivation?: boolean;
}

export function reportPassageActionsCoverage(
  records: readonly PassageActionsCoverageRecord[],
): readonly PassageActionsCoverageGap[] {
  const gaps: PassageActionsCoverageGap[] = [];
  for (const record of records) {
    if (record.actions.hard) {
      for (const kind of OBSTACLE_KIND_IDS) {
        if (record.actions.obstacleResponses?.[kind] === undefined) {
          gaps.push({
            severity: "flag",
            rule: "hard-passage-missing-obstacle",
            paper: record.paper,
            argumentId: record.argumentId,
            obstacleKind: kind,
            message: `Hard passage ${record.argumentId} has no authored response for ${kind}.`,
            repair: "Author the obstacle response for this kind, or clear the hard flag.",
          });
        }
      }
    }
    if (record.abstractDerivation === true && record.actions.example === undefined) {
      gaps.push({
        severity: "flag",
        rule: "abstract-derivation-missing-example",
        paper: record.paper,
        argumentId: record.argumentId,
        message: `Abstract derivation ${record.argumentId} has no "Show me one example first" target.`,
        repair: "Author an example foundation or static instance for this passage.",
      });
    }
  }
  return Object.freeze(gaps);
}
