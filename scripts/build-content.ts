import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileContent,
  compileReadingContent,
  type Diagnostic,
  type PaperPayload,
} from "../src/content/compiler/compile.ts";
import { emitPayloads } from "../src/content/compiler/emitter.ts";
import { checkFileSize, checkNfc } from "../src/content/compiler/loaders.ts";
import type { Block, Foundation } from "../src/content/schemas/reading.ts";
import { expressionLatex } from "../src/equations/latex.ts";
import { BROWNIAN_QUANTITIES } from "../src/equations/quantities.ts";
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
  "src/equations/dimensions.ts",
  "src/equations/record.ts",
  "src/equations/quantities.ts",
  "src/equations/latex.ts",
  "src/experiments/bm01/definition.ts",
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
      if (stat.isDirectory()) {
        await walk(full);
        continue;
      }
      if (
        name.endsWith(".md") ||
        name.endsWith(".yaml") ||
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

function markdownBlocks(blocks: readonly Block[]): string {
  return blocks
    .map((b) =>
      b.kind === "paragraph"
        ? b.text
        : b.kind === "formula"
          ? `$$\n${b.latex}\n$$\n\n${b.spoken}`
          : b.kind === "steps"
            ? b.items.map((x, i) => `${i + 1}. ${x}`).join("\n")
            : `[Foundation: ${b.id}](/foundations/${b.id}/) — ${b.returnCaption}`,
    )
    .join("\n\n");
}

function markdownPaper(p: PaperPayload): string {
  return `# ${p.paper.title}\n\n${p.paper.sourceNotice}\n\n${p.arguments
    .map(
      (a) =>
        `## ${a.title}\n\n${a.question}\n\n${markdownBlocks(a.readings.full)}\n\n### Model limits\n\n${a.limitations.join(
          "\n\n",
        )}`,
    )
    .join("\n\n")}\n`;
}

export async function buildContent(root = ROOT, options?: { corpusDir?: string }) {
  const corpusDir = options?.corpusDir ?? "content";
  const files = await loadReadingFiles(root, corpusDir);

  const result = await compileContent(files);
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
  if (result.reviewQueue) {
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
  const startEmit = performance.now();
  const index = await emitPayloads({
    rootDir: root,
    inputDigest,
    compilerDigest,
    buildDigest,
    papers: result.papers,
    foundations: result.foundations,
  });
  const emitMs = performance.now() - startEmit;

  // Diagnostics output in generated folder
  const generatedDir = resolve(root, "generated/content", buildDigest);
  await writeFile(
    resolve(generatedDir, "diagnostics.jsonl"),
    result.diagnostics.map((d) => JSON.stringify(d)).join("\n") + "\n",
  );

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

// CLI Execution
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let corpusDir = "content";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--corpus" && args[i + 1]) {
      corpusDir = args[i + 1]!;
      i++;
    }
  }

  const result = await buildContent(ROOT, { corpusDir });
  for (const diagnostic of result.diagnostics) {
    if (diagnostic.severity === "error") {
      console.error(JSON.stringify(diagnostic));
    } else {
      console.log(JSON.stringify(diagnostic));
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  } else {
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
}
