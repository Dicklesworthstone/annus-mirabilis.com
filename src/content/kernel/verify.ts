import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  checkIdentifierBindings,
  checkIndependentReferences,
  checkLiveTermBindings,
  checkPinnedHash,
  checkTraceScenario,
  validateDisplayRole,
} from "./bindings.ts";
import { pinKey, SLICE_KERNEL_CATALOG, SLICE_REGISTERED_SCENARIOS } from "./catalog.ts";
import { extractTypeScriptExport } from "./extractTypeScript.ts";
import { hashModuleClosure } from "./sourceDigest.ts";
import { computeBm01StokesEinsteinTrace } from "./trace.ts";
import type { ExtractedKernelSource, KernelIssue } from "./types.ts";

export type KernelPinFile = Readonly<{
  schemaVersion: 1;
  functions: Readonly<Record<string, string>>;
  closures: Readonly<Record<string, string>>;
}>;

export type KernelExtractionRecord = Readonly<{
  instrumentId: string;
  exportName: string;
  language: "ts" | "rust";
  filePath: string;
  lineStart: number;
  lineEnd: number;
  sourceHash: string;
  revision: string;
  closureDigest: string;
  displayRole: string;
}>;

export type KernelVerifyResult = Readonly<{
  ok: boolean;
  issues: readonly KernelIssue[];
  extracted: readonly ExtractedKernelSource[];
  records: readonly KernelExtractionRecord[];
}>;

export function loadPins(path: string): KernelPinFile {
  const raw = JSON.parse(readFileSync(path, "utf8")) as KernelPinFile;
  if (raw.schemaVersion !== 1 || !raw.functions || !raw.closures) {
    throw new Error(`Invalid kernel pin file: ${path}`);
  }
  return raw;
}

export function verifySliceKernels(options: {
  root: string;
  revision: string;
  pinsPath?: string | undefined;
  writeManifestPath?: string | undefined;
}): KernelVerifyResult {
  const issues: KernelIssue[] = [];
  const extractedList: ExtractedKernelSource[] = [];
  const records: KernelExtractionRecord[] = [];
  const pins = options.pinsPath ? loadPins(options.pinsPath) : undefined;

  const byInstrument = new Map<string, ExtractedKernelSource[]>();

  for (const entry of SLICE_KERNEL_CATALOG) {
    if (entry.kernel.language !== "ts" || !entry.kernel.module || !entry.kernel.exportName) {
      issues.push({
        code: "missing-ts-kernel-fields",
        instrumentId: entry.instrumentId,
        message: `Catalog entry for ${entry.instrumentId} is not a TypeScript kernel with module and exportName.`,
      });
      continue;
    }
    const extracted = extractTypeScriptExport({
      root: options.root,
      modulePath: entry.kernel.module,
      exportName: entry.kernel.exportName,
      revision: options.revision,
    });
    extractedList.push(extracted);
    const closureDigest = hashModuleClosure(options.root, [extracted.filePath]);
    const key = pinKey(entry.kernel.module, entry.kernel.exportName);
    if (pins) {
      const expected = pins.functions[key];
      if (!expected) {
        issues.push({
          code: "kernel-pin-missing",
          instrumentId: entry.instrumentId,
          functionName: entry.kernel.exportName,
          newHash: extracted.sourceHash,
          message: `Instrument ${entry.instrumentId}: no pinned hash for ${key}.`,
        });
      } else {
        issues.push(
          ...checkPinnedHash({
            instrumentId: entry.instrumentId,
            functionName: entry.kernel.exportName,
            expectedHash: expected,
            actualHash: extracted.sourceHash,
          }),
        );
      }
      const expectedClosure = pins.closures[extracted.filePath];
      if (expectedClosure && expectedClosure !== closureDigest) {
        issues.push({
          code: "kernel-closure-drift",
          instrumentId: entry.instrumentId,
          functionName: entry.kernel.exportName,
          oldHash: expectedClosure,
          newHash: closureDigest,
          message: `Instrument ${entry.instrumentId}: module closure digest for ${extracted.filePath} drifted.`,
        });
      }
    }
    issues.push(...validateDisplayRole(entry.instrumentId, entry.kernel, extracted));
    if (entry.independentReferences && entry.independentReferences.length > 0) {
      issues.push(
        ...checkIndependentReferences(
          options.root,
          entry.instrumentId,
          entry.independentReferences,
        ),
      );
    }
    issues.push(
      ...checkTraceScenario(
        entry.instrumentId,
        entry.traceScenarioId,
        SLICE_REGISTERED_SCENARIOS[entry.instrumentId] ?? [],
      ),
    );
    const list = byInstrument.get(entry.instrumentId) ?? [];
    list.push(extracted);
    byInstrument.set(entry.instrumentId, list);
    records.push({
      instrumentId: entry.instrumentId,
      exportName: extracted.exportName,
      language: "ts",
      filePath: extracted.filePath,
      lineStart: extracted.lineStart,
      lineEnd: extracted.lineEnd,
      sourceHash: extracted.sourceHash,
      revision: extracted.revision,
      closureDigest,
      displayRole: entry.kernel.displayRole,
    });
  }

  const grouped = new Map<string, typeof SLICE_KERNEL_CATALOG>();
  for (const entry of SLICE_KERNEL_CATALOG) {
    const list = grouped.get(entry.instrumentId) ?? [];
    grouped.set(entry.instrumentId, [...list, entry]);
  }
  for (const [instrumentId, entries] of grouped) {
    const kernels = entries.map((e) => e.kernel);
    const bindings = entries.flatMap((e) => e.identifierBindings);
    const liveTerms = [...new Set(entries.flatMap((e) => e.liveTerms))];
    const extractedMap = new Map<string, ExtractedKernelSource>();
    for (const src of byInstrument.get(instrumentId) ?? []) extractedMap.set(src.exportName, src);
    issues.push(
      ...checkIdentifierBindings({ instrumentId, kernels, bindings, extracted: extractedMap }),
    );
    issues.push(
      ...checkLiveTermBindings({ instrumentId, liveTerms, bindings, extracted: extractedMap }),
    );
  }

  if (options.writeManifestPath) {
    mkdirSync(dirname(options.writeManifestPath), { recursive: true });
    const payload = {
      schemaVersion: 1,
      beadId: "am-inst-show-the-code-4brv",
      revision: options.revision,
      functions: records,
      bm01Trace: computeBm01StokesEinsteinTrace(),
    };
    writeFileSync(options.writeManifestPath, `${JSON.stringify(payload, null, 2)}\n`);
  }

  return { ok: issues.length === 0, issues, extracted: extractedList, records };
}

export function writePinsFromExtraction(
  pinsPath: string,
  records: readonly KernelExtractionRecord[],
): void {
  const functions: Record<string, string> = {};
  const closures: Record<string, string> = {};
  for (const rec of records) {
    functions[pinKey(moduleOf(rec), rec.exportName)] = rec.sourceHash;
    closures[rec.filePath] = rec.closureDigest;
  }
  const file: KernelPinFile = { schemaVersion: 1, functions, closures };
  writeFileSync(resolve(pinsPath), `${JSON.stringify(file, null, 2)}\n`);
}

function moduleOf(rec: KernelExtractionRecord): string {
  const entry = SLICE_KERNEL_CATALOG.find(
    (e) => e.instrumentId === rec.instrumentId && e.kernel.exportName === rec.exportName,
  );
  return entry?.kernel.module ?? rec.filePath;
}
