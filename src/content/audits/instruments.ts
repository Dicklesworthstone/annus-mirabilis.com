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
import { type OwnerFunction, ownerTestIndex } from "./ownerTests.ts";
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
  /**
   * THE MANIFEST'S `probes:` LIST, WHICH GOVERNS NOTHING AND IS KEPT ONLY TO BE REPORTED.
   *
   * The experiment schema declares it `readonly string[]` and validates no element, so an id in
   * it resolves to whatever a reader of the manifest imagines. Measured 2026-10-14: 55 of the 77
   * ids declared across 27 manifests are named by nothing in the tree except the manifest line
   * that declares them. The column below reads `readerProbes` instead.
   */
  manifestProbes: readonly string[];
  /**
   * THE PROBES A READER CAN ACTUALLY OPERATE, read from the result cards in `content/results/`.
   *
   * Each is `{instrument, question, preset}` on a numbered result, which `resultCards.ts`
   * validates: the instrument must be a registered laboratory, it must ask a question, and a card
   * with no probe is reported as a problem. This is the "live probe" AGENTS.md's results-face
   * paragraph requires, and it is the one a reader reaches.
   */
  readerProbes: readonly string[];
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
  /** Set when the manifest exists but does not parse; its fields are then unknown, not empty. */
  manifestError?: string;
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
    // A manifest that does not parse is not an empty manifest: say so, rather than report its
    // probes, notModeled and tape as missing (sr-10.yaml went unread for 8 days that way).
    const unread = row.manifestError
      ? `${row.id}: content/experiments/${row.id}.yaml does not parse (${row.manifestError}), so this is unknown, not absent.`
      : undefined;
    /*
     * THE COLUMN READS THE PROBES A READER CAN OPERATE, not the manifest's string list.
     *
     * Two different things are called `probes`. The manifest's is `readonly string[]` with no
     * element validation, so the column failed only on an EMPTY list and 55 of the 77 declared
     * ids are named by nothing but the manifest line declaring them: a column that cannot fail
     * over contents nobody reads. The result cards' probes are validated by `resultCards.ts` --
     * registered laboratory, a question, a preset -- and are what the reader's results face
     * links.
     *
     * Measured 2026-10-14 before the change, both ways over the 33 core instruments: the manifest
     * field failed lq-09, me-01, me-03, sr-01 and sr-04, every one of which a result card DOES
     * probe; the reader-facing field fails bm-08, lq-01 and sr-07, which no result card probes at
     * all. The count falls from 5 to 3 and that is not the point, because the old five were a
     * missing declaration and the new three are three core instruments a reader cannot reach from
     * any numbered result.
     */
    if (row.readerProbes.length === 0) {
      fail(
        "probes",
        `${row.id} is probed by no result card, so no numbered result offers a reader a live probe into it.`,
      );
    }
    if (row.notModeled.length === 0) {
      fail("notModeled", unread ?? `${row.id} has an empty notModeled list.`);
    }
    if (!row.tapeModelId?.trim()) {
      fail("tape-identity", unread ?? `${row.id} has no tape model identity.`);
    }
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

/**
 * The probes a reader can operate, indexed by the instrument each one opens.
 *
 * Read from `content/results/<paper>.yaml` ON DISK rather than through the result-card loader,
 * for the reason AGENTS.md gives under "A check inherits the silence of whatever it reads": a
 * loader that drops or repairs an entry it cannot resolve would hide exactly what this is
 * counting. The records' own key is `instrument`, which is worth saying because the first
 * measurement of this used `instrumentId`, found nothing anywhere, and read as a finding rather
 * than as a broken instrument.
 *
 * Returns the questions rather than a count, so a caller can print what it found.
 */
function readerProbeIndex(rootDir: string): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const dir = resolve(rootDir, "content/results");
  if (!existsSync(dir)) return index;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    let parsed: unknown;
    try {
      parsed = yaml.load(readFileSync(resolve(dir, file), "utf8"));
    } catch {
      // An unparseable results file is not an absent probe. It is reported by the content
      // compiler, which owns these records; this index simply cannot see into it.
      continue;
    }
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      if (!node || typeof node !== "object") return;
      const rec = node as Record<string, unknown>;
      const instrument = rec.instrument;
      const question = rec.question;
      if (typeof instrument === "string" && typeof question === "string" && question.trim()) {
        index.set(instrument, [...(index.get(instrument) ?? []), question]);
      }
      for (const value of Object.values(rec)) walk(value);
    };
    walk(parsed);
  }
  return index;
}

export function loadLiveInstrumentRows(
  rootDir: string,
  options?: { ids?: readonly string[] },
): readonly InstrumentAuditRow[] {
  const targetIds = options?.ids ?? CATALOGUE_IDS;
  const rows: InstrumentAuditRow[] = [];
  // Read every test file once; each lab below asks which of them import its owner functions.
  const ownerTests = ownerTestIndex(rootDir);
  const readerProbes = readerProbeIndex(rootDir);

  for (const id of targetIds) {
    const core = /^(lq|bm|sr|me)-\d{2}$/.test(id);
    const catId = isCatalogueId(id) ? (id as CatalogueId) : undefined;
    const registered = catId ? REGISTRY[catId]?.status === "registered" : false;
    const dispatchState = resolveExperimentDispatch(id);
    const dispatcherCase = dispatchState.kind !== "unknown";
    const inCoreCatalogue = isCatalogueId(id) && core;
    const inNonCoreList = NON_CORE_INSTRUMENT_IDS.some((entry) => entry.id === id);

    const manifestPath = resolve(rootDir, "content/experiments", `${id}.yaml`);
    let manifestProbes: string[] = [];
    let notModeled: string[] = [];
    let tapeModelId: string | undefined;
    let ownerFunctions: OwnerFunction[] = [];
    // No manifest, no evidence: these start empty and are filled only from the manifest itself.
    let actionContracts = 0;
    let predictEnabled = false;
    let predictExemptionReason: string | undefined;
    let embeddable: boolean | undefined;
    const modes: string[] = catId ? [...(DECLARED_MODES[catId] ?? [])] : [];
    let presets: string[] = [];
    let predictPrompts: string[] = [];
    let teachingTapes: string[] = [];
    let manifestError: string | undefined;

    if (existsSync(manifestPath)) {
      try {
        const rawText = readFileSync(manifestPath, "utf8");
        const parsed = yaml.load(rawText) as Record<string, unknown> | null;
        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.probes)) manifestProbes = parsed.probes.map(String);
          if (Array.isArray(parsed.notModeled)) notModeled = parsed.notModeled.map(String);
          // The manifests declare `tapeModel: { modelId, modelVersion }`. Until 2026-09-24 this read
          // `tapeModelId`, a key no manifest uses, so the tape column was never read from real data.
          const tapeModel = parsed.tapeModel as
            | { modelId?: unknown; modelVersion?: unknown }
            | undefined;
          if (parsed.tapeModelId) tapeModelId = String(parsed.tapeModelId);
          else if (tapeModel && typeof tapeModel.modelId === "string" && tapeModel.modelId.trim()) {
            tapeModelId = `${tapeModel.modelId}@${String(tapeModel.modelVersion ?? 1)}`;
          } else if (Array.isArray(parsed.teachingTapes) && parsed.teachingTapes.length > 0) {
            tapeModelId = `${id}@1`;
          }
          if (Array.isArray(parsed.presets)) {
            presets = parsed.presets
              .map((p: unknown) =>
                typeof p === "string" ? p : (p as { presetId?: string })?.presetId,
              )
              .filter(Boolean)
              .map(String);
          }
          const predMode = parsed.predictMode as
            | { enabled?: boolean; exempt?: boolean; reason?: unknown; prompts?: unknown[] }
            | undefined;
          if (predMode?.prompts && Array.isArray(predMode.prompts)) {
            predictPrompts = predMode.prompts
              .map((p: unknown) =>
                typeof p === "string" ? p : (p as { promptId?: string })?.promptId,
              )
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
          // The schema writes an exemption as `predictMode: { exempt: true, reason }`
          // (src/content/schemas/experiment.ts). Until 2026-09-24 this read `exemptionReason`, a key
          // no manifest uses, so the five exempt labs (lq-03, lq-04, bm-06, sr-04, sr-05) were
          // reported as having neither predict mode nor an exemption.
          predictExemptionReason =
            predMode?.exempt === true &&
            typeof predMode.reason === "string" &&
            predMode.reason.trim() !== ""
              ? predMode.reason
              : undefined;
          if (typeof parsed.embeddable === "boolean") embeddable = parsed.embeddable;
          const owner = parsed.owner as { kernelFunctions?: unknown } | undefined;
          if (Array.isArray(owner?.kernelFunctions)) {
            ownerFunctions = owner.kernelFunctions.flatMap((fn: unknown) => {
              const { module, exportName } = (fn ?? {}) as {
                module?: unknown;
                exportName?: unknown;
              };
              return typeof module === "string" && typeof exportName === "string"
                ? [{ module, exportName }]
                : [];
            });
          }
          // The manifests declare their action contracts as `actions`. This read `actionContracts`,
          // a key no manifest uses, and defaulted to 1, so every lab passed the column unread
          // (am-instrument-audit-defaults-pass-50bl).
          if (Array.isArray(parsed.actions)) actionContracts = parsed.actions.length;
          else if (Array.isArray(parsed.actionContracts))
            actionContracts = parsed.actionContracts.length;
        }
      } catch (error) {
        // Recorded, never swallowed: the audit reports an unreadable manifest as unreadable.
        manifestError = String((error as { reason?: string }).reason ?? error).split("\n")[0];
      }
    }

    // A lab has an owner test when a test file, wherever it lives, imports one of the owner
    // functions its manifest names (src/content/audits/ownerTests.ts). Until 2026-09-24 this looked
    // for any test in src/experiments/<compact id>/, which missed the 25 labs tested from
    // src/testing/ and beside the reference evaluators, and credited a test whatever it imported.
    const ownerTest = ownerFunctions.some((fn) => ownerTests.testsOf(fn).length > 0);

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
      manifestProbes,
      readerProbes: readerProbes.get(id) ?? [],
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
      ...(manifestError !== undefined ? { manifestError } : {}),
    });
  }

  return rows;
}
