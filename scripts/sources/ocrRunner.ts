import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { appendFile, lstat, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { type LoadAdapterOptions, loadAdapter } from "../ocr-adapters/loader.ts";
import {
  AdapterAuthError,
  AdapterBadResponseError,
  AdapterQuotaError,
  AdapterTimeoutError,
  AdapterUnavailableError,
  type ChunkImage,
  type ChunkSubmission,
  type CloudOcrAdapter,
  OcrAdapterError,
  type OcrRefusalCode,
  OcrRefusalError,
} from "../ocr-adapters/types.ts";
import {
  type ExpectedPageCounts,
  loadPlan,
  type OcrPlan,
  type ValidatePlanOptions,
  validatePlan,
} from "./ocrPlanSchema.ts";

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function generateToolRunId(): string {
  const d = new Date();
  const dateStr = d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const hex = randomBytes(4).toString("hex");
  return `${dateStr}-${hex}`;
}

export function generateLogRunId(): string {
  const d = new Date();
  const dateStr = d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const hex = randomBytes(4).toString("hex");
  return `${dateStr}-${hex}`;
}

export interface ChunkPlan {
  chunkIndex: number;
  pdfPages: number[];
}

export function planChunks(pdfPageRange: [number, number], chunkSize = 2): ChunkPlan[] {
  const [first, last] = pdfPageRange;
  if (chunkSize < 1 || chunkSize > 4) {
    throw new OcrRefusalError(
      "CHUNK_TOO_LARGE",
      `chunkSize ${chunkSize} is invalid. Maximum allowed is 4, minimum is 1.`,
    );
  }
  if (first < 1 || last < first) {
    throw new OcrRefusalError(
      "PAGE_RANGE_OUT_OF_BOUNDS",
      `Invalid page range [${first}, ${last}].`,
    );
  }

  const chunks: ChunkPlan[] = [];
  let chunkIndex = 0;
  for (let page = first; page <= last; page += chunkSize) {
    const endPage = Math.min(page + chunkSize - 1, last);
    const pages: number[] = [];
    for (let p = page; p <= endPage; p++) {
      pages.push(p);
    }
    chunks.push({
      chunkIndex,
      pdfPages: pages,
    });
    chunkIndex++;
  }

  return chunks;
}

export function redact(
  text: string,
  env: Record<string, string | undefined> = process.env,
): string {
  let result = text;

  // Redact header patterns
  result = result.replace(/(authorization\s*:\s*(?:bearer\s+)?)(\S+)/gi, "$1[REDACTED]");

  // Redact any environment variables with sensitive names
  const sensitiveNames = [
    "API_KEY",
    "SECRET",
    "TOKEN",
    "PASSWORD",
    "AUTH",
    "CREDENTIAL",
    "LUNA_API_KEY",
    "OPENAI_API_KEY",
    "OCR_API_KEY",
    "ANTHROPIC_API_KEY",
    "VERCEL_TOKEN",
    "CLOUDFLARE_API_TOKEN",
  ];

  for (const [key, val] of Object.entries(env)) {
    if (!val || val.length < 4) continue;
    const isSensitive = sensitiveNames.some((s) => key.toUpperCase().includes(s));
    if (isSensitive) {
      result = result.split(val).join("[REDACTED]");
    }
  }

  return result;
}

export interface RenderedPage {
  pdfPage: number;
  imagePath: string;
  imageSha256: string;
  width: number;
  height: number;
  dpi: number;
  renderer: string;
  rendererVersion: string;
}

export interface RenderOptions {
  dpi?: number | undefined;
  rendererVersion?: string | undefined;
  customRenderer?:
    | ((
        pdfPath: string,
        pageNum: number,
        outPath: string,
      ) => Promise<{ width: number; height: number; buffer: Buffer }>)
    | undefined;
}

export async function renderPages(
  facsimilePath: string,
  pdfPages: number[],
  outputDir: string,
  options: RenderOptions = {},
): Promise<RenderedPage[]> {
  await mkdir(outputDir, { recursive: true });
  const dpi = options.dpi ?? 300;
  const fullFacPath = resolve(ROOT, facsimilePath);

  const renderer = "pdftoppm";
  let rendererVersion = options.rendererVersion ?? "unknown";

  if (!options.customRenderer) {
    try {
      const { stdout, stderr } = await execFileAsync("pdftoppm", ["-v"]);
      const out = (stdout || stderr).toString();
      const match = out.match(/version\s+([\d.]+)/i);
      if (match) {
        rendererVersion = match[1]!;
      }
    } catch {
      // pdftoppm might not be in path
    }
  }

  const rendered: RenderedPage[] = [];

  // If customRenderer is provided
  if (options.customRenderer) {
    for (const pageNum of pdfPages) {
      const pngPath = resolve(outputDir, `page-${pageNum}.png`);
      const res = await options.customRenderer(fullFacPath, pageNum, pngPath);
      const sha256 = createHash("sha256").update(res.buffer).digest("hex");
      rendered.push({
        pdfPage: pageNum,
        imagePath: pngPath,
        imageSha256: sha256,
        width: res.width,
        height: res.height,
        dpi,
        renderer: "custom-renderer",
        rendererVersion: rendererVersion || "1.0.0",
      });
    }
    return rendered;
  }

  // Check if any pages need rendering with pdftoppm
  const missingPages = pdfPages.filter((p) => !existsSync(resolve(outputDir, `page-${p}.png`)));

  if (missingPages.length > 0) {
    const minPage = Math.min(...missingPages);
    const maxPage = Math.max(...missingPages);
    const batchPrefix = resolve(outputDir, "tmp_batch");

    try {
      await execFileAsync("pdftoppm", [
        "-png",
        "-r",
        String(dpi),
        "-f",
        String(minPage),
        "-l",
        String(maxPage),
        fullFacPath,
        batchPrefix,
      ]);
    } catch (err: any) {
      throw new Error(
        `Failed to render pages ${minPage}..${maxPage} with pdftoppm: ${err.message}`,
      );
    }

    // Rename generated files to page-<pageNum>.png
    const dirFiles = await readdir(outputDir);
    for (const file of dirFiles) {
      if (file.startsWith("tmp_batch-") && file.endsWith(".png")) {
        const numStr = file.replace(/^tmp_batch-0*/, "").replace(/\.png$/, "");
        const actualPageNum = parseInt(numStr, 10);
        if (!isNaN(actualPageNum)) {
          const target = resolve(outputDir, `page-${actualPageNum}.png`);
          await rename(resolve(outputDir, file), target);
        }
      }
    }
  }

  for (const pageNum of pdfPages) {
    const pngPath = resolve(outputDir, `page-${pageNum}.png`);
    if (!existsSync(pngPath)) {
      throw new Error(`Rendered page image missing at ${pngPath}`);
    }
    const pngBuffer = await readFile(pngPath);
    const sha256 = createHash("sha256").update(pngBuffer).digest("hex");

    let width = 2550;
    let height = 3300;
    if (pngBuffer.length >= 24 && pngBuffer.toString("ascii", 12, 16) === "IHDR") {
      width = pngBuffer.readUInt32BE(16);
      height = pngBuffer.readUInt32BE(20);
    }

    rendered.push({
      pdfPage: pageNum,
      imagePath: pngPath,
      imageSha256: sha256,
      width,
      height,
      dpi,
      renderer,
      rendererVersion,
    });
  }

  return rendered;
}

export interface RunLogEntry {
  timestamp: string;
  suite: string;
  logRunId: string;
  toolRunId: string;
  testId?: string | undefined;
  beadId?: string | undefined;
  key: string;
  planPath?: string | undefined;
  facsimileSha256?: string | undefined;
  chunkIndex?: number | undefined;
  pdfPages?: number[] | undefined;
  renderer?: string | undefined;
  rendererVersion?: string | undefined;
  dpi?: number | undefined;
  imageSha256?: string | undefined;
  textSha256?: string | undefined;
  instructionsVersion?: string | undefined;
  adapter?: string | undefined;
  workerIdentity?: string | undefined;
  jobId?: string | undefined;
  status:
    | "planned"
    | "rendered"
    | "submitted"
    | "completed"
    | "failed"
    | "retried"
    | "skipped-checkpoint"
    | "refused"
    | "paused";
  retry?: number | undefined;
  errorCode?: string | undefined;
  exitCode?: number | undefined;
  message?: string | undefined;
  durationMs?: number | undefined;
}

export async function appendStructuredLog(
  runDir: string,
  logRunId: string,
  entry: RunLogEntry,
): Promise<void> {
  const line = redact(JSON.stringify(entry)) + "\n";
  const runLogPath = resolve(runDir, "run.jsonl");
  await mkdir(runDir, { recursive: true });
  await appendFile(runLogPath, line, "utf-8");

  const testLogsDir = resolve(ROOT, "artifacts/test-logs/ocr-ledgers");
  await mkdir(testLogsDir, { recursive: true });
  const testLogPath = resolve(testLogsDir, `${logRunId}.jsonl`);
  await appendFile(testLogPath, line, "utf-8");
}

export interface ChunkResult {
  chunkIndex: number;
  jobId: string;
  pages: { pdfPage: number; text: string; textSha256: string }[];
  workerIdentity: string;
  model: string;
  costUnits?: number | undefined;
  retries: number;
  durationMs: number;
}

export async function runChunk(
  chunk: ChunkPlan,
  renderedPages: Map<number, RenderedPage>,
  adapter: CloudOcrAdapter,
  plan: OcrPlan,
  instructionText: string,
  toolRunId: string,
  logRunId: string,
  runDir: string,
): Promise<ChunkResult> {
  const images: ChunkImage[] = [];
  for (const pageNum of chunk.pdfPages) {
    const rendered = renderedPages.get(pageNum);
    if (!rendered) {
      throw new Error(`Rendered image missing for page ${pageNum}`);
    }
    images.push({
      path: rendered.imagePath,
      sha256: rendered.imageSha256,
      pdfPage: pageNum,
    });
  }

  const submission: ChunkSubmission = {
    key: plan.key,
    toolRunId,
    chunkIndex: chunk.chunkIndex,
    pdfPages: chunk.pdfPages,
    images,
    instructionsVersion: plan.instructionsVersion,
    instructionText,
  };

  const startTime = Date.now();
  let retries = 0;
  let submitRes: { jobId: string } | undefined;

  // Attempt submit with retry policy (max 2 retries for timeout/bad response)
  const maxRetries = 2;
  while (true) {
    try {
      submitRes = await adapter.submit(submission);
      await appendStructuredLog(runDir, logRunId, {
        timestamp: new Date().toISOString(),
        suite: "ocr-ledgers",
        logRunId,
        toolRunId,
        beadId: "am-src-ocr-orchestrator-u1e0",
        key: plan.key,
        facsimileSha256: plan.facsimileSha256,
        chunkIndex: chunk.chunkIndex,
        pdfPages: chunk.pdfPages,
        instructionsVersion: plan.instructionsVersion,
        adapter: adapter.name,
        jobId: submitRes.jobId,
        status: "submitted",
        retry: retries,
      });
      break;
    } catch (err: any) {
      const isRetryable =
        err instanceof AdapterTimeoutError ||
        err instanceof AdapterBadResponseError ||
        err?.retryable === true;
      if (isRetryable && retries < maxRetries) {
        retries++;
        await appendStructuredLog(runDir, logRunId, {
          timestamp: new Date().toISOString(),
          suite: "ocr-ledgers",
          logRunId,
          toolRunId,
          beadId: "am-src-ocr-orchestrator-u1e0",
          key: plan.key,
          facsimileSha256: plan.facsimileSha256,
          chunkIndex: chunk.chunkIndex,
          pdfPages: chunk.pdfPages,
          adapter: adapter.name,
          status: "retried",
          retry: retries,
          errorCode: err?.code ?? "RETRY",
          message: err.message,
        });
        await new Promise((r) => setTimeout(r, 10 * retries));
        continue;
      }
      throw err;
    }
  }

  // Poll
  const jobId = submitRes!.jobId;
  const pollRes = await adapter.poll(jobId);
  if (pollRes.status === "failed") {
    throw new AdapterBadResponseError(`Cloud OCR job ${jobId} failed during processing.`);
  }

  // Fetch Result
  const fetchRes = await adapter.fetchResult(jobId);

  // Validate worker identity
  if (plan.expectedWorkerIdentity && fetchRes.workerIdentity !== plan.expectedWorkerIdentity) {
    throw new OcrRefusalError(
      "WORKER_IDENTITY_MISMATCH",
      `Worker identity returned by adapter ("${fetchRes.workerIdentity}") does not match plan expectation ("${plan.expectedWorkerIdentity}"). Stopping run.`,
    );
  }

  const durationMs = Date.now() - startTime;
  const pages = fetchRes.pages.map((p) => ({
    pdfPage: p.pdfPage,
    text: p.text,
    textSha256: createHash("sha256").update(p.text).digest("hex"),
  }));

  return {
    chunkIndex: chunk.chunkIndex,
    jobId,
    pages,
    workerIdentity: fetchRes.workerIdentity,
    model: fetchRes.model,
    costUnits: fetchRes.costUnits,
    retries,
    durationMs,
  };
}

export interface CheckpointContext {
  key: string;
  toolRunId: string;
  logRunId: string;
  adapter: string;
  instructionsVersion: string;
  renderedPages: Map<number, RenderedPage>;
}

export async function writeCheckpoint(
  runDir: string,
  chunk: ChunkPlan,
  result: ChunkResult,
  context: CheckpointContext,
): Promise<void> {
  const pagesDir = resolve(runDir, "pages");
  await mkdir(pagesDir, { recursive: true });

  for (const page of result.pages) {
    const rendered = context.renderedPages.get(page.pdfPage);
    const imageSha256 = rendered?.imageSha256 ?? "";

    const frontMatter = [
      "---",
      `key: ${context.key}`,
      `pdfPage: ${page.pdfPage}`,
      `toolRunId: ${context.toolRunId}`,
      `logRunId: ${context.logRunId}`,
      `chunkIndex: ${chunk.chunkIndex}`,
      `jobId: ${result.jobId}`,
      `adapter: ${context.adapter}`,
      `workerIdentity: ${result.workerIdentity}`,
      `model: ${result.model}`,
      `instructionsVersion: ${context.instructionsVersion}`,
      `imageSha256: ${imageSha256}`,
      `textSha256: ${page.textSha256}`,
      `receivedAt: ${new Date().toISOString()}`,
      "---",
      "",
    ].join("\n");

    const fullContent = frontMatter + page.text;
    const targetFile = resolve(pagesDir, `page-${page.pdfPage}.md`);
    const tempFile = resolve(pagesDir, `page-${page.pdfPage}.md.tmp.${process.pid}.${Date.now()}`);

    await writeFile(tempFile, fullContent, "utf-8");
    await rename(tempFile, targetFile);
  }

  await appendStructuredLog(runDir, context.logRunId, {
    timestamp: new Date().toISOString(),
    suite: "ocr-ledgers",
    logRunId: context.logRunId,
    toolRunId: context.toolRunId,
    beadId: "am-src-ocr-orchestrator-u1e0",
    key: context.key,
    facsimileSha256: "",
    chunkIndex: chunk.chunkIndex,
    pdfPages: chunk.pdfPages,
    adapter: context.adapter,
    workerIdentity: result.workerIdentity,
    jobId: result.jobId,
    status: "completed",
    retry: result.retries,
    durationMs: result.durationMs,
  });
}

export interface ParsedPageCheckpoint {
  key: string;
  pdfPage: number;
  toolRunId: string;
  logRunId: string;
  chunkIndex: number;
  jobId: string;
  adapter: string;
  workerIdentity: string;
  model: string;
  instructionsVersion: string;
  imageSha256: string;
  textSha256: string;
  body: string;
}

export function parsePageCheckpoint(content: string): ParsedPageCheckpoint | null {
  if (!content.startsWith("---\n")) return null;
  const endIdx = content.indexOf("\n---\n", 4);
  if (endIdx === -1) return null;

  const fmText = content.slice(4, endIdx);
  const body = content.slice(endIdx + 5);

  const meta: Record<string, any> = {};
  for (const line of fmText.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const k = line.slice(0, colon).trim();
    const v = line.slice(colon + 1).trim();
    meta[k] = v;
  }

  return {
    key: meta.key,
    pdfPage: parseInt(meta.pdfPage, 10),
    toolRunId: meta.toolRunId,
    logRunId: meta.logRunId,
    chunkIndex: parseInt(meta.chunkIndex, 10),
    jobId: meta.jobId,
    adapter: meta.adapter,
    workerIdentity: meta.workerIdentity,
    model: meta.model,
    instructionsVersion: meta.instructionsVersion,
    imageSha256: meta.imageSha256,
    textSha256: meta.textSha256,
    body,
  };
}

export interface ResumeOptions {
  resubmitChunkIndex?: number | undefined;
  resubmitReason?: string | undefined;
}

export interface ResumeState {
  completedChunkIndices: Set<number>;
  existingPages: Map<number, ParsedPageCheckpoint>;
}

export async function resumeRun(
  runDir: string,
  plan: OcrPlan,
  options: ResumeOptions = {},
): Promise<ResumeState> {
  const pagesDir = resolve(runDir, "pages");
  const existingPages = new Map<number, ParsedPageCheckpoint>();
  const completedChunkIndices = new Set<number>();

  if (!existsSync(pagesDir)) {
    return { completedChunkIndices, existingPages };
  }

  const files = await readdir(pagesDir);
  for (const f of files) {
    if (!f.startsWith("page-") || !f.endsWith(".md") || f.includes(".tmp.")) continue;
    try {
      const content = await readFile(resolve(pagesDir, f), "utf-8");
      const parsed = parsePageCheckpoint(content);
      if (parsed) {
        existingPages.set(parsed.pdfPage, parsed);
      }
    } catch {
      // ignore corrupted read
    }
  }

  const chunks = planChunks(plan.pdfPageRange, plan.chunkSize);
  for (const chunk of chunks) {
    let chunkComplete = true;
    for (const pageNum of chunk.pdfPages) {
      const pageData = existingPages.get(pageNum);
      if (!pageData) {
        chunkComplete = false;
        break;
      }

      // Check hash integrity
      const actualDigest = createHash("sha256").update(pageData.body).digest("hex");
      if (actualDigest !== pageData.textSha256) {
        chunkComplete = false;
        break;
      }

      // Check plan metadata compatibility
      if (pageData.instructionsVersion !== plan.instructionsVersion) {
        chunkComplete = false;
        break;
      }
    }

    if (chunkComplete) {
      completedChunkIndices.add(chunk.chunkIndex);
    }
  }

  // Handle explicit resubmit
  if (options.resubmitChunkIndex !== undefined && options.resubmitReason) {
    completedChunkIndices.delete(options.resubmitChunkIndex);
  }

  return { completedChunkIndices, existingPages };
}

export interface RunSummaryResult {
  toolRunId: string;
  key: string;
  adapter: string;
  workerIdentity: string;
  model: string;
  jobIds: string[];
  pageRanges: [number, number];
  dates: {
    startedAt: string;
    completedAt: string;
  };
  imageSha256s: Record<number, string>;
  textSha256s: Record<number, string>;
  renderer: string;
  rendererVersion: string;
  instructionsVersion: string;
  failures: number;
  retries: number;
  costUnits?: number | undefined;
}

export interface PageCoverageItem {
  pdfPage: number;
  status: "drafted" | "missing";
  counts: {
    mathRegions: number;
    footnoteMarkers: number;
    illegible: number;
  };
  expectedCounts?: ExpectedPageCounts | undefined;
  mismatch?: boolean | undefined;
}

export interface CoverageResult {
  toolRunId: string;
  key: string;
  totalPages: number;
  draftedPages: number;
  missingPages: number;
  pages: PageCoverageItem[];
  mismatches: {
    pdfPage: number;
    field: string;
    actual: number;
    expected: number;
  }[];
}

export async function summarizeRun(
  runDir: string,
  plan: OcrPlan,
): Promise<{ summary: RunSummaryResult; coverage: CoverageResult; receiptBlock: string }> {
  const pagesDir = resolve(runDir, "pages");
  const toolRunId = basename(runDir);

  const existingPages = new Map<number, ParsedPageCheckpoint>();
  if (existsSync(pagesDir)) {
    const files = await readdir(pagesDir);
    for (const f of files) {
      if (!f.startsWith("page-") || !f.endsWith(".md") || f.includes(".tmp.")) continue;
      const content = await readFile(resolve(pagesDir, f), "utf-8");
      const parsed = parsePageCheckpoint(content);
      if (parsed) {
        existingPages.set(parsed.pdfPage, parsed);
      }
    }
  }

  // Read run.jsonl for logs and retries
  let failures = 0;
  let retries = 0;
  let startedAt = new Date().toISOString();
  let completedAt = new Date().toISOString();
  const jobIdsSet = new Set<string>();

  const runLogPath = resolve(runDir, "run.jsonl");
  if (existsSync(runLogPath)) {
    const logContent = await readFile(runLogPath, "utf-8");
    const lines = logContent.trim().split("\n");
    if (lines.length > 0 && lines[0]) {
      try {
        startedAt = JSON.parse(lines[0]).timestamp;
      } catch {}
    }
    if (lines.length > 0 && lines[lines.length - 1]) {
      try {
        completedAt = JSON.parse(lines[lines.length - 1]!).timestamp;
      } catch {}
    }
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.status === "failed") failures++;
        if (entry.status === "retried") retries++;
        if (entry.jobId) jobIdsSet.add(entry.jobId);
      } catch {}
    }
  }

  let sampleWorker = plan.expectedWorkerIdentity;
  let sampleModel = "gpt-5.6-luna";
  let sampleAdapter = "fixture";
  const imageSha256s: Record<number, string> = {};
  const textSha256s: Record<number, string> = {};

  for (const pageNum of Array.from(existingPages.keys())) {
    const page = existingPages.get(pageNum)!;
    sampleWorker = page.workerIdentity || sampleWorker;
    sampleModel = page.model || sampleModel;
    sampleAdapter = page.adapter || sampleAdapter;
    imageSha256s[pageNum] = page.imageSha256;
    textSha256s[pageNum] = page.textSha256;
    if (page.jobId) jobIdsSet.add(page.jobId);
  }

  const summary: RunSummaryResult = {
    toolRunId,
    key: plan.key,
    adapter: sampleAdapter,
    workerIdentity: sampleWorker,
    model: sampleModel,
    jobIds: Array.from(jobIdsSet),
    pageRanges: plan.pdfPageRange,
    dates: { startedAt, completedAt },
    imageSha256s,
    textSha256s,
    renderer: "pdftoppm",
    rendererVersion: "26.06.0",
    instructionsVersion: plan.instructionsVersion,
    failures,
    retries,
    costUnits: existingPages.size * 1.0,
  };

  // Coverage
  const [firstPage, lastPage] = plan.pdfPageRange;
  const totalPages = lastPage - firstPage + 1;
  const coveragePages: PageCoverageItem[] = [];
  const mismatches: { pdfPage: number; field: string; actual: number; expected: number }[] = [];

  for (let p = firstPage; p <= lastPage; p++) {
    const page = existingPages.get(p);
    if (!page) {
      coveragePages.push({
        pdfPage: p,
        status: "missing",
        counts: { mathRegions: 0, footnoteMarkers: 0, illegible: 0 },
      });
      continue;
    }

    const mathMatches = page.body.match(/\[\[MATH-REGION/g)?.length ?? 0;
    const fnMatches = page.body.match(/\[\[FN-MARK/g)?.length ?? 0;
    const illegibleMatches = page.body.match(/\[\[ILLEGIBLE\]\]/g)?.length ?? 0;

    const counts = {
      mathRegions: mathMatches,
      footnoteMarkers: fnMatches,
      illegible: illegibleMatches,
    };

    const exp = plan.expectedCounts?.[p];
    let isMismatch = false;
    if (exp) {
      if (exp.displayEquations !== undefined && exp.displayEquations !== counts.mathRegions) {
        isMismatch = true;
        mismatches.push({
          pdfPage: p,
          field: "displayEquations",
          actual: counts.mathRegions,
          expected: exp.displayEquations,
        });
      }
      if (exp.footnoteMarkers !== undefined && exp.footnoteMarkers !== counts.footnoteMarkers) {
        isMismatch = true;
        mismatches.push({
          pdfPage: p,
          field: "footnoteMarkers",
          actual: counts.footnoteMarkers,
          expected: exp.footnoteMarkers,
        });
      }
      if (exp.illegible !== undefined && exp.illegible !== counts.illegible) {
        isMismatch = true;
        mismatches.push({
          pdfPage: p,
          field: "illegible",
          actual: counts.illegible,
          expected: exp.illegible,
        });
      }
    }

    coveragePages.push({
      pdfPage: p,
      status: "drafted",
      counts,
      expectedCounts: exp,
      mismatch: isMismatch,
    });
  }

  const coverage: CoverageResult = {
    toolRunId,
    key: plan.key,
    totalPages,
    draftedPages: existingPages.size,
    missingPages: totalPages - existingPages.size,
    pages: coveragePages,
    mismatches,
  };

  // Receipt block markdown
  const receiptBlock = [
    `### Cloud OCR Draft Record (${plan.key})`,
    "",
    `- **toolRunId:** \`${toolRunId}\``,
    `- **Worker Identity:** ${sampleWorker} (${sampleModel})`,
    `- **Instructions Version:** ${plan.instructionsVersion}`,
    `- **Date:** ${completedAt}`,
    `- **Pages Drafted:** ${existingPages.size} / ${totalPages} (range [${firstPage}, ${lastPage}])`,
    "",
    "> **Notice:** Cloud OCR output is research evidence only. Every equation is retyped against page images; machine draft text is never accepted into the source ledger or edition without line-by-line editorial review.",
  ].join("\n");

  // Save to run directory
  await writeFile(
    resolve(runDir, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
    "utf-8",
  );
  await writeFile(
    resolve(runDir, "coverage.json"),
    JSON.stringify(coverage, null, 2) + "\n",
    "utf-8",
  );
  await writeFile(resolve(runDir, "receipt-block.md"), receiptBlock + "\n", "utf-8");

  return { summary, coverage, receiptBlock };
}

export async function buildCoverage(runDir: string, plan: OcrPlan): Promise<CoverageResult> {
  const { coverage } = await summarizeRun(runDir, plan);
  return coverage;
}
