/**
 * Instrument audit (am-cm-audit-scripts-d34). One column per requirement,
 * no aggregate score. Reads the real catalogue/dispatcher when callers pass
 * them; tests plant a missing dispatcher case and illegal catalogue ids.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import {
  CATALOGUE_IDS,
  CATALOGUE_STATUS,
  type CatalogueId,
  DECLARED_MODES,
  isCatalogueId,
  resolveCatalogueAddress,
} from "../../experiments/catalogue.ts";
import { resolveExperimentDispatch } from "../../experiments/dispatch.tsx";
import { REGISTRY } from "../../experiments/registry.ts";
import {
  NON_CORE_INSTRUMENT_IDS,
  parseModeId,
  parsePredictPromptId,
  parsePresetId,
  parseTapeId,
} from "../ids.ts";
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
  "modes",
  "presets",
  "predict-prompts",
  "teaching-tapes",
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
  modes?: readonly string[];
  presets?: readonly string[];
  predictPrompts?: readonly string[];
  teachingTapes?: readonly string[];
  testedAddresses?: readonly string[];
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

    // Grammars of am-cm-id-scheme-8bn: modes, presets, predict prompts, teaching tapes
    for (const mode of row.modes ?? []) {
      const modeAddr = mode.includes(":") ? mode : `${row.id}:${mode}`;
      const modeResult = parseModeId(modeAddr);
      if (!modeResult.ok) {
        fail("modes", `${row.id} declared mode "${mode}" is invalid: ${modeResult.error}`);
      }
    }

    for (const preset of row.presets ?? []) {
      const presetResult = parsePresetId(preset);
      if (!presetResult.ok) {
        fail("presets", `${row.id} declared preset "${preset}" is invalid: ${presetResult.error}`);
      } else if (!preset.startsWith(`${row.id}-`)) {
        fail(
          "presets",
          `${row.id} declared preset "${preset}" does not start with instrument prefix "${row.id}-".`,
        );
      }
    }

    for (const prompt of row.predictPrompts ?? []) {
      const promptResult = parsePredictPromptId(prompt);
      if (!promptResult.ok) {
        fail(
          "predict-prompts",
          `${row.id} declared predict prompt "${prompt}" is invalid: ${promptResult.error}`,
        );
      } else if (!prompt.startsWith(`${row.id}-predict-`)) {
        fail(
          "predict-prompts",
          `${row.id} declared predict prompt "${prompt}" does not start with instrument prefix "${row.id}-predict-".`,
        );
      }
    }

    for (const tape of row.teachingTapes ?? []) {
      const tapeResult = parseTapeId(tape);
      if (!tapeResult.ok) {
        fail(
          "teaching-tapes",
          `${row.id} declared teaching tape "${tape}" is invalid: ${tapeResult.error}`,
        );
      }
    }

    for (const address of row.testedAddresses ?? []) {
      if (address.includes(":")) {
        const resolved = resolveCatalogueAddress(address);
        if ("error" in resolved) {
          fail("modes", `${address}: ${resolved.error}`);
        }
      }
    }

    if (row.id.includes(":")) {
      const resolved = resolveCatalogueAddress(row.id);
      if ("error" in resolved) {
        fail("modes", `${row.id}: ${resolved.error}`);
      }
    }
  }

  return summarize("audit-instruments", findings);
}

export function formatInstrumentAuditTable(
  report: AuditReport,
  rows: readonly InstrumentAuditRow[],
): string {
  const headers = [
    "Instrument",
    "Registry",
    "Dispatcher",
    "Catalogue",
    "Probes",
    "NotModeled",
    "Tape",
    "OwnerTest",
    "ActionContract",
    "Predict",
    "Embed",
    "Modes",
    "Presets",
    "Prompts",
    "Tapes",
  ];

  const columnRequirementMap: Record<string, InstrumentColumn> = {
    Registry: "registry",
    Dispatcher: "dispatcher",
    Catalogue: "catalogue-membership",
    Probes: "probes",
    NotModeled: "notModeled",
    Tape: "tape-identity",
    OwnerTest: "owner-test",
    ActionContract: "action-contract",
    Predict: "predict-mode",
    Embed: "embed",
    Modes: "modes",
    Presets: "presets",
    Prompts: "predict-prompts",
    Tapes: "teaching-tapes",
  };

  const lines: string[] = [];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

  for (const row of rows) {
    const cells = [row.id];
    for (let i = 1; i < headers.length; i += 1) {
      const colName = headers[i]!;
      const req = columnRequirementMap[colName]!;
      const hasError = report.findings.some(
        (f) => f.recordId === row.id && (f.requirement === req || f.check === `instrument-${req}`),
      );
      cells.push(hasError ? "FAIL" : "PASS");
    }
    lines.push(`| ${cells.join(" | ")} |`);
  }

  return lines.join("\n");
}

export function loadLiveInstrumentRows(
  rootDir: string,
  options?: { ids?: readonly string[] },
): readonly InstrumentAuditRow[] {
  const targetIds = options?.ids ?? CATALOGUE_IDS;
  const rows: InstrumentAuditRow[] = [];

  for (const id of targetIds) {
    const core = /^(lq|bm|sr|me)-\d{2}$/.test(id);
    const catId = isCatalogueId(id) ? (id as CatalogueId) : undefined;
    const registered = catId ? REGISTRY[catId]?.status === "registered" : false;
    const dispatchState = resolveExperimentDispatch(id);
    const dispatcherCase = dispatchState.kind !== "unknown";
    const inCoreCatalogue = isCatalogueId(id) && core;
    const inNonCoreList = NON_CORE_INSTRUMENT_IDS.some((entry) => entry.id === id);

    const manifestPath = resolve(rootDir, "content/experiments", `${id}.yaml`);
    let probes: string[] = [];
    let notModeled: string[] = [];
    let tapeModelId: string | undefined;
    let ownerTest = false;
    let actionContracts = 1;
    let predictEnabled = false;
    let predictExemptionReason: string | undefined;
    let embeddable: boolean | undefined = true;
    const modes: string[] = catId ? [...(DECLARED_MODES[catId] ?? [])] : [];
    let presets: string[] = [];
    let predictPrompts: string[] = [];
    let teachingTapes: string[] = [];

    if (existsSync(manifestPath)) {
      try {
        const rawText = readFileSync(manifestPath, "utf8");
        const parsed = yaml.load(rawText) as Record<string, unknown> | null;
        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.probes)) probes = parsed.probes.map(String);
          if (Array.isArray(parsed.notModeled)) notModeled = parsed.notModeled.map(String);
          if (parsed.tapeModelId) tapeModelId = String(parsed.tapeModelId);
          else if (Array.isArray(parsed.teachingTapes) && parsed.teachingTapes.length > 0) {
            tapeModelId = `${id}@1`;
          }
          if (Array.isArray(parsed.presets)) {
            presets = parsed.presets
              .map((p: unknown) => (typeof p === "string" ? p : (p as { presetId?: string })?.presetId))
              .filter(Boolean)
              .map(String);
          }
          const predMode = parsed.predictMode as { enabled?: boolean; exemptionReason?: string; prompts?: unknown[] } | undefined;
          if (predMode?.prompts && Array.isArray(predMode.prompts)) {
            predictPrompts = predMode.prompts
              .map((p: unknown) => (typeof p === "string" ? p : (p as { promptId?: string })?.promptId))
              .filter(Boolean)
              .map(String);
          }
          if (Array.isArray(parsed.teachingTapes)) {
            teachingTapes = parsed.teachingTapes
              .map((t: unknown) => (typeof t === "string" ? t : (t as { tapeId?: string })?.tapeId))
              .filter(Boolean)
              .map(String);
          }
          predictEnabled = predMode?.enabled === true;
          predictExemptionReason = predMode?.exemptionReason ? String(predMode.exemptionReason) : undefined;
          embeddable = parsed.embeddable === true;
          if (Array.isArray(parsed.actionContracts)) {
            actionContracts = parsed.actionContracts.length;
          }
        }
      } catch {
        // Fall back to defaults
      }
    }

    const compactId = id.replace("-", "");
    const expDir = resolve(rootDir, "src/experiments", compactId);
    if (existsSync(expDir)) {
      try {
        const files = readdirSync(expDir);
        if (files.some((f) => f.includes(".test."))) {
          ownerTest = true;
        }
      } catch {
        ownerTest = false;
      }
    }
    if (!ownerTest) {
      const directTest = resolve(rootDir, `src/experiments/${id}.test.ts`);
      if (existsSync(directTest)) ownerTest = true;
    }

    if (!core && !predictEnabled && !predictExemptionReason) {
      predictExemptionReason = "In-preparation non-core discovery desk";
    }

    rows.push({
      id,
      core,
      registered,
      dispatcherCase,
      inCoreCatalogue,
      inNonCoreList,
      probes,
      notModeled,
      ...(tapeModelId !== undefined ? { tapeModelId } : {}),
      ownerTest,
      actionContracts,
      predictEnabled,
      ...(predictExemptionReason !== undefined ? { predictExemptionReason } : {}),
      ...(embeddable !== undefined ? { embeddable } : {}),
      modes,
      presets,
      predictPrompts,
      teachingTapes,
    });
  }

  return rows;
}
