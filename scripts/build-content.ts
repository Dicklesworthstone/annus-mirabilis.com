import { createHash } from "node:crypto";
import { watch } from "node:fs";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BINDINGS_REQUIRED,
  checkParagraphBindings,
  reportLine,
} from "../src/content/bindings/paragraphBindings.ts";
import { compileContent } from "../src/content/compiler/compile.ts";
import type { CompilerDiagnostic } from "../src/content/compiler/compiler.ts";
import { emitPayloads } from "../src/content/compiler/emitter.ts";
import { getLogger } from "../src/testing/log/logger.ts";

export const CONTENT_COMPILER_FILES = [
  "scripts/build-content.ts",
  "src/content/compiler/compile.ts",
  "src/content/compiler/compiler.ts",
  "src/content/compiler/routes.ts",
  "src/content/compiler/loaders.ts",
  "src/content/compiler/json.ts",
  "src/content/compiler/indexes.ts",
  "src/content/compiler/emitter.ts",
  "src/content/compiler/reviewQueue.ts",
  "src/content/compiler/serverLoaders.ts",
  "src/content/compiler/checks/registry.ts",
  "src/content/schemas/reading.ts",
  "src/content/dimensions/rational.ts",
  "src/equations/ast.ts",
  "src/equations/missingStep/contentCheck.ts",
  "src/equations/missingStep/transitionSchema.ts",
  "src/equations/missingStep/workedCheck.ts",
  "src/physics/reference/stepEnumeration.ts",
  "src/equations/derivations/schema.ts",
  "src/equations/derivations/rules/index.ts",
  "src/equations/derivations/rules/registeredIdentity.ts",
  "src/equations/dimensions.ts",
  "src/equations/record.ts",
  "src/equations/quantities.ts",
  "src/equations/massEnergyQuantities.ts",
  "src/equations/teachingProfiles.ts",
  "src/experiments/me02/definition.ts",
  "src/equations/latex.ts",
  "src/experiments/bm01/definition.ts",
  "src/experiments/catalogue.ts",
] as const;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digest = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");

export async function loadReadingFiles(root = ROOT, corpusDir = "content") {
  const directory = resolve(root, corpusDir);
  const files: { path: string; text: string }[] = [];
  let bytes = 0;

  async function walk(path: string): Promise<void> {
    const entries = await readdir(path);
    for (const name of entries.sort()) {
      const full = resolve(path, name);
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) throw new Error(`Content symlinks are not admitted: ${full}`);
      if (name.startsWith("._") || name === ".DS_Store") continue;
      if (stat.isDirectory()) {
        await walk(full);
        continue;
      }
      if (
        name.endsWith(".md") ||
        (name.endsWith(".yaml") &&
          !/equations[\\/]derivations[\\/]/.test(full) &&
          name !== "missing-step-allowlist.yaml") ||
        name.endsWith(".yml") ||
        name.endsWith(".txt")
      )
        continue;
      if (!stat.isFile() || stat.size > 512 * 1024)
        throw new Error(`Invalid or oversized content file: ${full}`);
      if (files.length >= 512) throw new Error("Content record-count budget exceeded.");
      bytes += stat.size;
      if (bytes > 8 * 1024 * 1024) throw new Error("Content total size budget exceeded.");
      const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        await readFile(full),
      );
      files.push({ path: relative(directory, full).split("\\").join("/"), text });
    }
  }

  await walk(directory);
  return files;
}

export async function loadAllContentFiles(root = ROOT, corpusDir = "content") {
  const directory = resolve(root, corpusDir);
  const files: { path: string; text: string }[] = [];
  let bytes = 0;

  async function walk(path: string): Promise<void> {
    const entries = await readdir(path);
    for (const name of entries.sort()) {
      const full = resolve(path, name);
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) throw new Error(`Content symlinks are not admitted: ${full}`);
      if (name.startsWith("._") || name === ".DS_Store") continue;
      if (stat.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!stat.isFile() || stat.size > 512 * 1024)
        throw new Error(`Invalid or oversized content file: ${full}`);
      if (files.length >= 512) throw new Error("Content record-count budget exceeded.");
      bytes += stat.size;
      if (bytes > 8 * 1024 * 1024) throw new Error("Content total size budget exceeded.");
      const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        await readFile(full),
      );
      files.push({ path: relative(directory, full).split("\\").join("/"), text });
    }
  }

  await walk(directory);
  return files;
}

export async function buildContent(
  root = ROOT,
  options?: { corpusDir?: string; emit?: boolean; shouldEmit?: boolean },
) {
  const corpusDir = options?.corpusDir ?? "content";
  const shouldEmit =
    options?.emit ?? options?.shouldEmit ?? (root !== ROOT || corpusDir === "content");
  const files = await loadReadingFiles(root, corpusDir);

  const compiled = await compileContent(files);
  // Every printed paragraph and display of a required paper reaches its explanation, and every
  // gap fails the build by name (src/content/bindings/paragraphBindings.ts).
  const bindingProblems = BINDINGS_REQUIRED.flatMap((paper) => {
    const report = checkParagraphBindings(root, paper);
    if (!report) return [];
    console.log(JSON.stringify({ event: "paragraph-bindings", report: reportLine(report) }));
    return report.problems.map(
      (message): CompilerDiagnostic => ({
        severity: "error",
        code: "paragraph-binding",
        path: `content/bindings/${paper}.yaml`,
        message,
        rule: "paragraph-binding",
        beadId: "am-bind-paragraphs-and-displays-me-u7bu",
      }),
    );
  });
  const result =
    bindingProblems.length === 0
      ? compiled
      : { ...compiled, ok: false, diagnostics: [...compiled.diagnostics, ...bindingProblems] };
  const logger = getLogger("build-content");

  // Log each diagnostic through structured test logger
  for (const diagnostic of result.diagnostics) {
    logger.log({
      testId: diagnostic.checkId ?? diagnostic.code ?? "diagnostic",
      beadId: diagnostic.beadId ?? "am-cm-compiler-core-oa7",
      outcome: diagnostic.severity === "error" ? "failed" : "passed",
      message: diagnostic.message,
      extra: {
        family: diagnostic.family ?? "compiler",
        rule: diagnostic.rule ?? diagnostic.code,
        severity: diagnostic.severity,
        checkId: diagnostic.checkId ?? diagnostic.code,
        recordId: diagnostic.recordId ?? diagnostic.path,
        file: diagnostic.file,
        path: diagnostic.path,
        fingerprint: diagnostic.fingerprint,
        repair: diagnostic.repair,
      },
    });
  }

  // Calculate hashes and digests
  const inputDigest = digest(
    files.map((f) => `${f.path}\0${Buffer.byteLength(f.text)}\0${f.text}`).join(""),
  );
  const compilerFiles = CONTENT_COMPILER_FILES;
  const compilerDigest = digest(
    (
      await Promise.all(
        compilerFiles.map(async (path) => {
          try {
            const fileContent = await readFile(resolve(root, path));
            return `${path}\0${digest(fileContent)}`;
          } catch {
            return `${path}\0missing`;
          }
        }),
      )
    ).join("\n"),
  );
  const buildDigest = digest(`${inputDigest}\0${compilerDigest}`);

  // If review queue exists, write artifacts/content-review-queue.json and .md
  if (result.reviewQueue && shouldEmit) {
    const artifactsDir = resolve(root, "artifacts");
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(
      resolve(artifactsDir, "content-review-queue.json"),
      result.reviewQueue.jsonContent,
    );
    await writeFile(
      resolve(artifactsDir, "content-review-queue.md"),
      result.reviewQueue.markdownContent,
    );
  }

  if (!result.ok) {
    // Log failure summary
    logger.log({
      testId: "build-content-summary",
      beadId: "am-cm-compiler-core-oa7",
      outcome: "failed",
      message: `Content compilation failed with ${result.diagnostics.filter((d) => d.severity === "error").length} errors.`,
      extra: {
        family: "compiler",
        event: "content-compiled",
        errorsCount: result.diagnostics.filter((d) => d.severity === "error").length,
        flagsCount: result.diagnostics.filter(
          (d) => d.severity === "flag" || d.severity === "review",
        ).length,
        openFlagsCount: result.reviewQueue?.summary.openCount ?? 0,
        reviewedFlagsCount: result.reviewQueue?.summary.reviewedCount ?? 0,
        staleReviewsCount: result.reviewQueue?.summary.staleCount ?? 0,
        phaseDurationsMs: {
          load: Math.round(result.durations.loadMs),
          validate: Math.round(result.durations.validateMs),
          index: Math.round(result.durations.indexMs),
          check: Math.round(result.durations.checkMs),
          emit: 0,
          total: Math.round(result.durations.totalMs),
        },
        papersCount: 0,
        foundationsCount: 0,
        inputDigest,
        buildDigest,
      },
    });
    await logger.flush();
    return { ...result, index: null };
  }

  // Emit payloads
  let index = null;
  let emitMs = 0;
  if (shouldEmit) {
    const startEmit = performance.now();
    index = await emitPayloads({
      rootDir: root,
      inputDigest,
      compilerDigest,
      buildDigest,
      papers: result.papers,
      foundations: result.foundations,
    });
    emitMs = performance.now() - startEmit;

    // Diagnostics output in generated folder
    const generatedDir = resolve(root, "generated/content", buildDigest);
    await writeFile(
      resolve(generatedDir, "diagnostics.jsonl"),
      `${result.diagnostics.map((d) => JSON.stringify(d)).join("\n")}\n`,
    );
  }

  // Log success summary
  logger.log({
    testId: "build-content-summary",
    beadId: "am-cm-compiler-core-oa7",
    outcome: "passed",
    message: `Content compilation succeeded with ${result.papers.length} papers and ${result.foundations.length} foundations.`,
    extra: {
      family: "compiler",
      event: "content-compiled",
      errorsCount: 0,
      flagsCount: result.diagnostics.filter((d) => d.severity === "flag" || d.severity === "review")
        .length,
      openFlagsCount: result.reviewQueue?.summary.openCount ?? 0,
      reviewedFlagsCount: result.reviewQueue?.summary.reviewedCount ?? 0,
      staleReviewsCount: result.reviewQueue?.summary.staleCount ?? 0,
      phaseDurationsMs: {
        load: Math.round(result.durations.loadMs),
        validate: Math.round(result.durations.validateMs),
        index: Math.round(result.durations.indexMs),
        check: Math.round(result.durations.checkMs),
        emit: Math.round(emitMs),
        total: Math.round(result.durations.totalMs + emitMs),
      },
      papersCount: result.papers.length,
      foundationsCount: result.foundations.length,
      inputDigest,
      buildDigest,
    },
  });
  await logger.flush();

  return { ...result, index };
}

/**
 * Runs one compile and prints its diagnostics. Returns whether the compile was clean, never
 * throws -- a caller in watch mode uses the return value to decide whether to set a nonzero
 * process exit code, and keeps watching either way (this bead's own rule: "never let the
 * generated directory become a second source of truth" implies a bad edit must be reported
 * loudly, not crash the watcher a content author is relying on).
 */
export async function runContentCompileOnce(
  corpusDir: string,
  options: { root?: string | undefined; shouldEmit?: boolean | undefined } = {},
): Promise<boolean> {
  const result = await buildContent(options.root ?? ROOT, {
    corpusDir,
    ...(options.shouldEmit !== undefined ? { emit: options.shouldEmit } : {}),
  });
  for (const diagnostic of result.diagnostics) {
    if (diagnostic.severity === "error") {
      console.error(JSON.stringify(diagnostic));
    } else {
      console.log(JSON.stringify(diagnostic));
    }
  }

  if (result.ok) {
    console.log(
      JSON.stringify({
        event: "content-compiled",
        papers: result.papers.length,
        foundations: result.foundations.length,
        inputDigest: result.index?.inputDigest,
        buildDigest: result.index?.buildDigest,
      }),
    );
  }
  return result.ok;
}

/**
 * Watches `corpusDir` and re-runs a full compile on every change, debounced so a batch of saves
 * (an editor writing several files, or a git checkout) triggers one recompile instead of one per
 * file. Never throws out of the watch loop: a compile that fails is reported (runContentCompileOnce
 * already prints its diagnostics) and the watcher keeps running, exactly like a real content
 * author expects from `bun run dev` -- a broken edit should not kill the dev server.
 */
export function watchContentCompile(
  corpusDir: string,
  options: {
    root?: string;
    debounceMs?: number;
    onCompile?: (ok: boolean) => void;
    shouldEmit?: boolean;
  } = {},
): { close: () => void } {
  const debounceMs = options.debounceMs ?? 150;
  const watchRoot = resolve(options.root ?? ROOT, corpusDir);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let rerunQueued = false;

  function scheduleRun(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void runOnceGuarded();
    }, debounceMs);
  }

  async function runOnceGuarded(): Promise<void> {
    if (running) {
      rerunQueued = true;
      return;
    }
    running = true;
    try {
      const ok = await runContentCompileOnce(corpusDir, {
        root: options.root,
        shouldEmit: options.shouldEmit,
      });
      options.onCompile?.(ok);
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: "error",
          code: "watch-compile-crashed",
          path: "cli",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      options.onCompile?.(false);
    } finally {
      running = false;
      if (rerunQueued) {
        rerunQueued = false;
        scheduleRun();
      }
    }
  }

  const watcher = watch(watchRoot, { recursive: true }, () => {
    scheduleRun();
  });

  return {
    close: () => {
      if (timer) clearTimeout(timer);
      watcher.close();
    },
  };
}

export function parseCliArgs(args: readonly string[]): {
  corpusDir: string;
  watchMode: boolean;
  shouldEmit?: boolean;
} {
  let corpusDir = "content";
  let watchMode = false;
  let shouldEmit: boolean | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--corpus") {
      const nextArg = args[i + 1];
      if (!nextArg) {
        throw new Error("Missing directory path following --corpus flag.");
      }
      corpusDir = nextArg;
      i++;
    } else if (args[i] === "--watch") {
      watchMode = true;
    } else if (args[i] === "--emit") {
      shouldEmit = true;
    } else if (args[i] === "--no-emit") {
      shouldEmit = false;
    }
  }
  return { corpusDir, watchMode, ...(shouldEmit !== undefined ? { shouldEmit } : {}) };
}

// CLI Execution
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let parsed: { corpusDir: string; watchMode: boolean; shouldEmit?: boolean };
  try {
    parsed = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(
      JSON.stringify({
        severity: "error",
        code: "missing-corpus-argument",
        path: "cli",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    process.exitCode = 1;
    process.exit(1);
  }

  const { corpusDir, watchMode, shouldEmit } = parsed;
  const firstRunOk = await runContentCompileOnce(
    corpusDir,
    shouldEmit !== undefined ? { shouldEmit } : {},
  );

  if (watchMode) {
    console.log(
      JSON.stringify({ event: "content-watch-started", corpusDir: resolve(ROOT, corpusDir) }),
    );
    watchContentCompile(corpusDir, shouldEmit !== undefined ? { shouldEmit } : {});
    // Keep the process alive; the watcher above is the only thing keeping the event loop busy.
  } else if (!firstRunOk) {
    process.exitCode = 1;
  }
}
