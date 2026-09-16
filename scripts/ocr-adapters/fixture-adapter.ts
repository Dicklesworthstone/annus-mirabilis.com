import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CloudOcrAdapter,
  type ChunkSubmission,
  type SubmitResult,
  type PollResult,
  type FetchResult,
  type DescribeResult,
  AdapterUnavailableError,
  AdapterAuthError,
  AdapterQuotaError,
  AdapterBadResponseError,
  AdapterTimeoutError,
  OcrRefusalError
} from "./types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export interface FixtureAdapterOptions {
  fixtureDir?: string | undefined;
  workerIdentity?: string | undefined;
  model?: string | undefined;
  costUnits?: number | undefined;
  failAtChunkIndex?: number | null | undefined;
  failWithCode?:
    | "ADAPTER_UNAVAILABLE"
    | "ADAPTER_AUTH"
    | "ADAPTER_QUOTA"
    | "ADAPTER_BAD_RESPONSE"
    | "ADAPTER_TIMEOUT"
    | null
    | undefined;
  timeoutsBeforeSuccess?: number | undefined;
  customPageText?: Record<number, string> | undefined;
  nodeEnv?: string | undefined;
}

export class FixtureAdapter implements CloudOcrAdapter {
  readonly name = "fixture";
  readonly workerIdentity: string;
  readonly model: string;
  readonly costUnits: number;
  private fixtureDir: string;
  private failAtChunkIndex: number | null;
  private failWithCode: string | null;
  private timeoutsBeforeSuccess: number;
  private currentTimeoutCount = 0;
  private customPageText: Record<number, string>;
  
  // Submission tracker: chunkIndex -> count
  readonly submissions: Map<number, number> = new Map();
  // Job store: jobId -> chunk
  private jobs: Map<string, ChunkSubmission> = new Map();

  constructor(options: FixtureAdapterOptions = {}) {
    const env = options.nodeEnv ?? process.env.NODE_ENV;
    if (env === "production") {
      throw new OcrRefusalError(
        "FIXTURE_ADAPTER_OUTSIDE_TEST",
        "Fixture adapter cannot be loaded when NODE_ENV=production."
      );
    }

    this.fixtureDir = options.fixtureDir ?? resolve(ROOT, "src/testing/fixtures/ocr");
    this.workerIdentity = options.workerIdentity ?? "gpt-5.6-luna";
    this.model = options.model ?? "gpt-5.6-luna-2026-03-01";
    this.costUnits = options.costUnits ?? 1.0;
    this.failAtChunkIndex = options.failAtChunkIndex ?? null;
    this.failWithCode = options.failWithCode ?? null;
    this.timeoutsBeforeSuccess = options.timeoutsBeforeSuccess ?? 0;
    this.customPageText = options.customPageText ?? {};
  }

  describe(): DescribeResult {
    return {
      service: "fixture-cloud-worker",
      workerIdentity: this.workerIdentity
    };
  }

  async submit(chunk: ChunkSubmission): Promise<SubmitResult> {
    const count = (this.submissions.get(chunk.chunkIndex) ?? 0) + 1;
    this.submissions.set(chunk.chunkIndex, count);

    // Check deliberate failure trigger
    if (this.failAtChunkIndex !== null && chunk.chunkIndex === this.failAtChunkIndex) {
      if (this.timeoutsBeforeSuccess > 0 && this.currentTimeoutCount < this.timeoutsBeforeSuccess) {
        this.currentTimeoutCount++;
        throw new AdapterTimeoutError(`Simulated timeout (${this.currentTimeoutCount}/${this.timeoutsBeforeSuccess}) on chunk ${chunk.chunkIndex}`);
      }

      if (this.failWithCode) {
        switch (this.failWithCode) {
          case "ADAPTER_UNAVAILABLE":
            throw new AdapterUnavailableError(`Cloud OCR service unavailable at chunk ${chunk.chunkIndex}`);
          case "ADAPTER_AUTH":
            throw new AdapterAuthError(`Cloud OCR authentication failed at chunk ${chunk.chunkIndex}`);
          case "ADAPTER_QUOTA":
            throw new AdapterQuotaError(`Cloud OCR quota exceeded at chunk ${chunk.chunkIndex}`);
          case "ADAPTER_BAD_RESPONSE":
            throw new AdapterBadResponseError(`Cloud OCR returned bad response at chunk ${chunk.chunkIndex}`);
          case "ADAPTER_TIMEOUT":
            throw new AdapterTimeoutError(`Cloud OCR timed out at chunk ${chunk.chunkIndex}`);
          default:
            throw new AdapterUnavailableError(`Simulated error at chunk ${chunk.chunkIndex}`);
        }
      }
    }

    const jobId = `fixture-job-chunk-${chunk.chunkIndex}-${Date.now()}`;
    this.jobs.set(jobId, chunk);
    return { jobId };
  }

  async poll(jobId: string): Promise<PollResult> {
    if (!this.jobs.has(jobId)) {
      return { status: "failed" };
    }
    return { status: "completed" };
  }

  async fetchResult(jobId: string): Promise<FetchResult> {
    const chunk = this.jobs.get(jobId);
    if (!chunk) {
      throw new AdapterBadResponseError(`Job not found: ${jobId}`);
    }

    const pages: { pdfPage: number; text: string }[] = [];

    for (const pageNum of chunk.pdfPages) {
      let pageText = this.customPageText[pageNum];
      if (!pageText) {
        // Try reading from fixture directory
        const candidatePaths = [
          resolve(this.fixtureDir, chunk.key, `page-${pageNum}.md`),
          resolve(this.fixtureDir, "fixture-3p", `page-${pageNum}.md`),
          resolve(this.fixtureDir, "fixture-31p", `page-${pageNum}.md`)
        ];
        let loaded = false;
        for (const p of candidatePaths) {
          try {
            pageText = await readFile(p, "utf-8");
            loaded = true;
            break;
          } catch {
            // try next
          }
        }
        if (!loaded || !pageText) {
          // Default synthetic fixture text matching diplomatic markup
          pageText = `[[RUNNING-HEAD Annalen der Physik (4) 17]]\n[[PAGE-NUMBER ${pageNum}]]\nDies ist eine diplomatische Transkription von Seite ${pageNum}.\n[[SPERR]]Bewegung[[/SPERR]] von suspendierten Teilchen.\n[[FN-MARK 1)]]\n[[MATH-REGION page=${pageNum}]]\n$$ \\lambda = \\sqrt{\\frac{R T}{N} \\frac{t}{3 \\pi k r}} $$\n[[FN 1)]] Ann. d. Phys. 17. p. 549. 1905.`;
        }
      }

      pages.push({
        pdfPage: pageNum,
        text: pageText
      });
    }

    return {
      pages,
      workerIdentity: this.workerIdentity,
      model: this.model,
      costUnits: this.costUnits
    };
  }

  getSubmissionCount(chunkIndex: number): number {
    return this.submissions.get(chunkIndex) ?? 0;
  }
}
