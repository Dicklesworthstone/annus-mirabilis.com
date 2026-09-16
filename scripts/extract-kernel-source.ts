import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractTypeScriptExport,
  extractTypeScriptFromText,
  KernelExtractionError,
} from "../src/content/kernel/extractTypeScript.ts";
import { hashKernelSource } from "../src/content/kernel/sourceDigest.ts";
import { verifySliceKernels, writePinsFromExtraction } from "../src/content/kernel/verify.ts";

export { KernelExtractionError };

export function checkCleanCommittedSource(root: string, filePaths: readonly string[]): string[] {
  const dirty: string[] = [];
  for (const rel of filePaths) {
    try {
      const out = execFileSync("git", ["diff", "HEAD", "--", rel], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      if (out.trim().length > 0) {
        dirty.push(rel);
      }
    } catch {
      // ignore git errors if not running in a git tree
    }
  }
  return dirty;
}

export type IdentifierBinding = Readonly<{
  kernelFunction: string;
  identifier: string;
  quantityId: string;
  termIds?: readonly string[] | undefined;
}>;

export type KernelFunctionRef = Readonly<{
  language?: "ts" | "rust" | undefined;
  module?: string | undefined;
  exportName?: string | undefined;
  crate?: string | undefined;
  path?: string | undefined;
  fnName?: string | undefined;
  revision?: string | undefined;
}>;

export type ExtractedFunction = Readonly<{
  exportName: string;
  module: string;
  source: string;
  sourceHash: string;
  lineStart: number;
  lineEnd: number;
  identifiers: readonly string[];
}>;

export type KernelBindingViolation = Readonly<{
  instrumentId: string;
  quantityId: string;
  message: string;
}>;

export function sha256Hex(source: string): string {
  return hashKernelSource(source);
}

export function extractFunctionSource(
  fileName: string,
  source: string,
  exportName: string,
): ExtractedFunction {
  const extracted = extractTypeScriptFromText({ fileName, sourceText: source, exportName });
  return {
    exportName: extracted.exportName,
    module: extracted.filePath,
    source: extracted.source,
    sourceHash: extracted.sourceHash,
    lineStart: extracted.lineStart,
    lineEnd: extracted.lineEnd,
    identifiers: extracted.identifiers,
  };
}

export function extractFromRepoFile(
  root: string,
  modulePath: string,
  exportName: string,
): ExtractedFunction {
  const abs = resolve(root, modulePath);
  const rel = relative(root, abs).split("\\").join("/");
  if (rel.startsWith("..") || rel.startsWith("/")) {
    throw new KernelExtractionError(
      "kernel-path-escape",
      `Module path "${modulePath}" escapes the repository root.`,
    );
  }
  const extracted = extractTypeScriptExport({
    root,
    modulePath: rel,
    exportName,
    revision: "workspace",
  });
  return {
    exportName: extracted.exportName,
    module: modulePath.split("\\").join("/"),
    source: extracted.source,
    sourceHash: extracted.sourceHash,
    lineStart: extracted.lineStart,
    lineEnd: extracted.lineEnd,
    identifiers: extracted.identifiers,
  };
}

export function assertPinnedHash(
  instrumentId: string,
  extracted: ExtractedFunction,
  pinnedHash: string,
): void {
  if (extracted.sourceHash === pinnedHash) return;
  throw new KernelExtractionError(
    "kernel-hash-drift",
    `Instrument ${instrumentId}: kernel "${extracted.exportName}" source hash drifted. Pinned ${pinnedHash}; extracted ${extracted.sourceHash}. Update the pin in the same commit as the kernel change.`,
  );
}

export function sourceHasIdentifier(source: string, identifier: string): boolean {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9_$])${escaped}(?![A-Za-z0-9_$])`).test(source);
}

export function checkKernelBindings(options: {
  instrumentId: string;
  liveTermQuantityIds: readonly string[];
  kernelFunctions: readonly KernelFunctionRef[];
  identifierBindings: readonly IdentifierBinding[];
  extractedByExportName: ReadonlyMap<string, ExtractedFunction>;
}): KernelBindingViolation[] {
  const violations: KernelBindingViolation[] = [];
  const declared = new Set(
    options.kernelFunctions
      .map((k) => k.exportName ?? k.fnName)
      .filter((n): n is string => typeof n === "string"),
  );
  for (const binding of options.identifierBindings) {
    if (!declared.has(binding.kernelFunction)) {
      violations.push({
        instrumentId: options.instrumentId,
        quantityId: binding.quantityId,
        message: `binding for "${binding.quantityId}" names undeclared kernel function "${binding.kernelFunction}"`,
      });
      continue;
    }
    const extracted = options.extractedByExportName.get(binding.kernelFunction);
    if (!extracted || !sourceHasIdentifier(extracted.source, binding.identifier)) {
      violations.push({
        instrumentId: options.instrumentId,
        quantityId: binding.quantityId,
        message: `identifier "${binding.identifier}" for "${binding.quantityId}" was not found in the extracted source of "${binding.kernelFunction}"`,
      });
    }
  }
  for (const quantityId of options.liveTermQuantityIds) {
    const matches = options.identifierBindings.filter((b) => b.quantityId === quantityId);
    if (matches.length === 0) {
      violations.push({
        instrumentId: options.instrumentId,
        quantityId,
        message: `live term "${quantityId}" has no identifier binding in any kernel function`,
      });
    }
  }
  return violations;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const pinsPath = resolve(root, "src/content/kernel/pins.json");
  const writePins = process.argv.includes("--write-pins");
  const skipPins = process.argv.includes("--no-pins");
  const result = verifySliceKernels({
    root,
    revision: process.env.KERNEL_REVISION ?? "workspace",
    pinsPath: skipPins || writePins || !existsSync(pinsPath) ? undefined : pinsPath,
    writeManifestPath: resolve(root, "generated/kernel-sources.json"),
  });
  if (writePins) {
    const allowDirty =
      process.argv.includes("--allow-dirty-pins") || process.argv.includes("--allow-dirty");
    if (!allowDirty) {
      const filePaths = [...new Set(result.records.map((r) => r.filePath))];
      const dirtyFiles = checkCleanCommittedSource(root, filePaths);
      if (dirtyFiles.length > 0) {
        console.error(
          JSON.stringify({
            code: "uncommitted-pinned-source",
            beadId: "am-inst-show-the-code-4brv",
            dirtyFiles,
            message: `Cannot write pins: the following ${dirtyFiles.length} pinned files have uncommitted working-tree changes in git HEAD: ${dirtyFiles.join(", ")}. Pinning uncommitted source violates the show-the-code guarantee. Commit your changes before writing pins, or pass --allow-dirty-pins to override.`,
          }),
        );
        process.exit(1);
      }
    }
    writePinsFromExtraction(pinsPath, result.records);
    // Re-verify immediately against the newly written pins to ensure zero false positives
    const verifiedAfterWrite = verifySliceKernels({
      root,
      revision: process.env.KERNEL_REVISION ?? "workspace",
      pinsPath,
      writeManifestPath: resolve(root, "generated/kernel-sources.json"),
    });
    if (!verifiedAfterWrite.ok) {
      for (const issue of verifiedAfterWrite.issues) {
        console.error(JSON.stringify({ ...issue, beadId: "am-inst-show-the-code-4brv" }));
      }
      process.exit(1);
    }
  }
  if (!result.ok) {
    for (const issue of result.issues) {
      console.error(JSON.stringify({ ...issue, beadId: "am-inst-show-the-code-4brv" }));
    }
    process.exit(1);
  }
  console.log(
    JSON.stringify({
      ok: true,
      functions: result.records.length,
      issues: result.issues.length,
      ...(writePins ? { pinsWritten: true } : {}),
    }),
  );
}
