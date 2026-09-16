/**
 * Instrument audit (am-cm-audit-scripts-d34). One column per requirement,
 * no aggregate score. Reads the real catalogue/dispatcher when callers pass
 * them; tests plant a missing dispatcher case and illegal catalogue ids.
 */

import { type AuditFinding, type AuditReport, summarize } from "./types.ts";

export const INSTRUMENT_COLUMNS = [
  "registry",
  "dispatcher",
  "catalogue-membership",
  "probes",
  "notModeled",
  "tape-identity",
  "owner-test",
  "action-contract",
  "predict-mode",
  "embed",
] as const;

export type InstrumentColumn = (typeof INSTRUMENT_COLUMNS)[number];

export type InstrumentAuditRow = Readonly<{
  id: string;
  core: boolean;
  registered: boolean;
  dispatcherCase: boolean;
  inCoreCatalogue: boolean;
  inNonCoreList: boolean;
  probes: readonly string[];
  notModeled: readonly string[];
  tapeModelId?: string;
  ownerTest: boolean;
  actionContracts: number;
  predictEnabled: boolean;
  predictExemptionReason?: string;
  embeddable?: boolean;
}>;

export function auditInstruments(rows: readonly InstrumentAuditRow[]): AuditReport {
  const findings: AuditFinding[] = [];

  for (const row of rows) {
    const fail = (requirement: InstrumentColumn, message: string) => {
      findings.push({
        check: `instrument-${requirement}`,
        family: "audit",
        severity: "error",
        recordId: row.id,
        requirement,
        message,
      });
    };

    if (!row.registered) fail("registry", `${row.id} has no registry entry.`);
    if (!row.dispatcherCase) fail("dispatcher", `${row.id} has no explicit dispatcher case.`);
    if (row.core && !row.inCoreCatalogue) {
      fail(
        "catalogue-membership",
        `${row.id} is treated as core but is not in the core catalogue.`,
      );
    }
    if (!row.core && !row.inNonCoreList) {
      fail(
        "catalogue-membership",
        `${row.id} is treated as non-core but is not in the declared non-core list.`,
      );
    }
    if (row.probes.length === 0) fail("probes", `${row.id} declares no probes.`);
    if (row.notModeled.length === 0) {
      fail("notModeled", `${row.id} has an empty notModeled list.`);
    }
    if (!row.tapeModelId?.trim()) fail("tape-identity", `${row.id} has no tape model identity.`);
    if (!row.ownerTest) fail("owner-test", `${row.id} has no owner test file.`);
    if (row.actionContracts < 1) {
      fail("action-contract", `${row.id} has no action contract for an interactive action.`);
    }
    if (!row.predictEnabled && !row.predictExemptionReason?.trim()) {
      fail("predict-mode", `${row.id} has neither predict mode nor an exemption reason.`);
    }
    if (row.embeddable !== true && row.embeddable !== false) {
      fail("embed", `${row.id} does not declare the embed flag.`);
    }
  }

  return summarize("audit-instruments", findings);
}
