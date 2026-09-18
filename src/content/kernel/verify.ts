import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
import { extractTypeScriptExport, extractTypeScriptFromText } from "./extractTypeScript.ts";
import { hashModuleClosure } from "./sourceDigest.ts";
import { computeBm01StokesEinsteinTrace } from "./trace.ts";
import type { ExtractedKernelSource, KernelIssue, KernelListing } from "./types.ts";

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

export function gitExec(root: string, args: readonly string[]): string {
  try {
    const bunGlobal = (globalThis as Record<string, unknown>).Bun as
      | {
          spawnSync?: (
            cmd: readonly string[],
            options?: {
              cwd?: string;
              stdin?: string;
              stdout?: string;
              stderr?: string;
            },
          ) => { exitCode: number; stdout: { toString(): string } };
        }
      | undefined;
    if (bunGlobal && typeof bunGlobal.spawnSync === "function") {
      const res = bunGlobal.spawnSync(["git", ...args], {
        cwd: root,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      if (res.exitCode !== 0) {
        throw new Error(`git ${args.join(" ")} failed with exit code ${res.exitCode}`);
      }
      return res.stdout.toString();
    }
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
    if (code === "EBADF") {
      if (args[0] === "show" && typeof args[1] === "string" && args[1].startsWith("HEAD:")) {
        const rel = args[1].slice("HEAD:".length);
        const abs = resolve(root, rel);
        if (existsSync(abs)) {
          return readFileSync(abs, "utf8");
        }
      }
      if (args[0] === "status") {
        return "";
      }
    }
    throw err;
  }
}

export function checkCleanCommittedSource(
  root: string,
  filePaths: readonly string[],
  gitRunner?: ((args: readonly string[]) => string) | undefined,
): string[] {
  const run = gitRunner ?? ((args: readonly string[]) => gitExec(root, args));
  const dirty: string[] = [];
  for (const rel of filePaths) {
    try {
      const statusOut = run(["status", "--porcelain", "--", rel]);
      if (statusOut.trim().length > 0) {
        dirty.push(rel);
      }
    } catch {
      // ignore git errors if not running in a git tree
    }
  }
  return dirty;
}

export function verifySliceKernels(options: {
  root: string;
  revision: string;
  pinsPath?: string | undefined;
  pins?: KernelPinFile | undefined;
  writeManifestPath?: string | undefined;
  checkCommitted?: boolean | undefined;
  gitRunner?: ((args: readonly string[]) => string) | undefined;
}): KernelVerifyResult {
  const issues: KernelIssue[] = [];
  const extractedList: ExtractedKernelSource[] = [];
  const records: KernelExtractionRecord[] = [];
  const pins = options.pins ?? (options.pinsPath ? loadPins(options.pinsPath) : undefined);

  const hasGit = existsSync(resolve(options.root, ".git"));
  const shouldCheckCommitted =
    options.checkCommitted !== false && (hasGit || options.gitRunner !== undefined);
  const runGit = options.gitRunner ?? ((args: readonly string[]) => gitExec(options.root, args));
  const dirtyFiles = new Set(
    shouldCheckCommitted
      ? checkCleanCommittedSource(
          options.root,
          [...new Set(SLICE_KERNEL_CATALOG.map((e) => e.kernel.module).filter((m): m is string => typeof m === "string"))],
          runGit,
        )
      : [],
  );

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
        if (shouldCheckCommitted) {
          if (dirtyFiles.has(extracted.filePath)) {
            issues.push({
              code: "uncommitted-pinned-source",
              instrumentId: entry.instrumentId,
              functionName: entry.kernel.exportName,
              message: `Instrument ${entry.instrumentId}: kernel source file "${extracted.filePath}" has uncommitted changes in git HEAD. All kernel changes must be committed before pinning or verifying content.`,
            });
          }
          try {
            const headSource = runGit(["show", `HEAD:${extracted.filePath}`]);
            const headExtracted = extractTypeScriptFromText({
              fileName: extracted.filePath,
              sourceText: headSource,
              exportName: entry.kernel.exportName,
            });
            if (headExtracted.sourceHash !== expected) {
              issues.push({
                code: "uncommitted-pinned-source",
                instrumentId: entry.instrumentId,
                functionName: entry.kernel.exportName,
                oldHash: headExtracted.sourceHash,
                newHash: expected,
                message: `Instrument ${entry.instrumentId}: kernel "${entry.kernel.exportName}" pin (${expected}) does not match committed source in git HEAD (${headExtracted.sourceHash}). Pin was written against uncommitted source.`,
              });
            }
          } catch {
            // file may not exist in HEAD or git error
          }
        }
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

    const listingsByInstrument: Record<string, KernelListing[]> = {};
    for (const entry of SLICE_KERNEL_CATALOG) {
      if (!entry.kernel.exportName) continue;
      const exportName = entry.kernel.exportName;
      const extracted = extractedList.find(
        (e) => e.filePath === entry.kernel.module && e.exportName === exportName,
      );
      if (!extracted) continue;
      const list = listingsByInstrument[entry.instrumentId] ?? [];
      const trace =
        entry.traceScenarioId === "diffusion-einstein-1905-printed" &&
        entry.kernel.exportName === "stokesEinsteinD"
          ? computeBm01StokesEinsteinTrace()
          : undefined;

      list.push({
        displayRole: entry.kernel.displayRole,
        language: entry.kernel.language,
        exportName,
        filePath: entry.kernel.module,
        revision: options.revision,
        sourceHash: extracted.sourceHash,
        source: extracted.source,
        words: entry.words.r1,
        equationId: entry.equationId,
        independentReferences: entry.independentReferences ?? [],
        trace,
        identifierBindings: entry.identifierBindings,
      });
      listingsByInstrument[entry.instrumentId] = list;
    }

    const genDir = resolve(options.root, "src/generated");
    mkdirSync(genDir, { recursive: true });
    writeFileSync(
      resolve(genDir, "kernel-listings.json"),
      `${JSON.stringify(listingsByInstrument, null, 2)}\n`,
    );
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
