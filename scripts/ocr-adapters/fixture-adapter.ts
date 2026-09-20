import {
  AdapterAuthError,
  AdapterBadResponseError,
  AdapterQuotaError,
  AdapterTimeoutError,
  AdapterUnavailableError,
  type ChunkSubmission,
  type CloudOcrAdapter,
  type DescribeResult,
  type FetchResult,
  OcrRefusalError,
  type PollResult,
  type SubmitResult,
} from "./types.ts";

export const SYNTHETIC_FIXTURE_BANNER =
  "SYNTHETIC OCR FIXTURE — NOT SOURCE — NOT LEDGER — NOT EDITION";

/** Obviously synthetic dispatch-port output. Never a stand-in for Annalen text. */
export function syntheticFixtureDraft(pdfPage: number, key: string): string {
  return [
    `<!-- ${SYNTHETIC_FIXTURE_BANNER} -->`,
    `[[SYNTHETIC-FIXTURE key=${key} pdfPage=${pdfPage}]]`,
    "This is test-double output for the OCR dispatch port.",
    "It is not a transcription of any printed page and must never be copied into a ledger.",
    `[[PAGE-NUMBER ${pdfPage}]]`,
    `[[MATH-REGION page=${pdfPage}]]`,
    "% unverified synthetic draft — not a historical equation",
    `$$ x_{\\mathrm{fixture}} = ${pdfPage} $$`,
    "[[FN-MARK 1)]]",
    "[[FN 1)]] synthetic footnote for coverage counts only.",
  ].join("\n");
}

export interface FixtureAdapterOptions {
  fixtureDir?: string | undefined;
  workerIdentity?: string | undefined;
  model?: string | undefined;
  costUnits?: number | undefined;
  failAtChunkIndex?: number | null | undefined;
  /**
   * Make the ADAPTER_AUTH failure quote the Authorization header, the way a real HTTP
   * client reports a failing request. Off by default; the redaction test turns it on so
   * there is a credential on a write path for the orchestrator to redact.
   */
  echoCredentialInAuthError?: boolean;
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
  private failAtChunkIndex: number | null;
  private failWithCode: string | null;
  private echoCredentialInAuthError: boolean;
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
        "Fixture adapter cannot be loaded when NODE_ENV=production.",
      );
    }

    this.workerIdentity = options.workerIdentity ?? "gpt-5.6-luna";
    this.model = options.model ?? "gpt-5.6-luna-2026-03-01";
    this.costUnits = options.costUnits ?? 1.0;
    this.failAtChunkIndex = options.failAtChunkIndex ?? null;
    this.failWithCode = options.failWithCode ?? null;
    this.echoCredentialInAuthError = options.echoCredentialInAuthError ?? false;
    this.timeoutsBeforeSuccess = options.timeoutsBeforeSuccess ?? 0;
    this.customPageText = options.customPageText ?? {};
  }

  describe(): DescribeResult {
    return {
      service: "fixture-cloud-worker",
      workerIdentity: this.workerIdentity,
    };
  }

  async submit(chunk: ChunkSubmission): Promise<SubmitResult> {
    const count = (this.submissions.get(chunk.chunkIndex) ?? 0) + 1;
    this.submissions.set(chunk.chunkIndex, count);

    // Check deliberate failure trigger
    if (this.failAtChunkIndex !== null && chunk.chunkIndex === this.failAtChunkIndex) {
      if (this.timeoutsBeforeSuccess > 0 && this.currentTimeoutCount < this.timeoutsBeforeSuccess) {
        this.currentTimeoutCount++;
        throw new AdapterTimeoutError(
          `Simulated timeout (${this.currentTimeoutCount}/${this.timeoutsBeforeSuccess}) on chunk ${chunk.chunkIndex}`,
        );
      }

      if (this.failWithCode) {
        switch (this.failWithCode) {
          case "ADAPTER_UNAVAILABLE":
            throw new AdapterUnavailableError(
              `Cloud OCR service unavailable at chunk ${chunk.chunkIndex}`,
            );
          case "ADAPTER_AUTH":
            throw new AdapterAuthError(
              this.echoCredentialInAuthError
                ? // The leak vector a real adapter has: an HTTP client that reports the
                  // failing request, Authorization header and all. Opt-in, so no existing
                  // expectation of this message changes, and used by the redaction test to
                  // give the orchestrator something it must redact before writing.
                  `Cloud OCR authentication failed at chunk ${chunk.chunkIndex}: ` +
                    `request was Authorization: Bearer ${process.env.LUNA_API_KEY ?? ""}`
                : `Cloud OCR authentication failed at chunk ${chunk.chunkIndex}`,
            );
          case "ADAPTER_QUOTA":
            throw new AdapterQuotaError(`Cloud OCR quota exceeded at chunk ${chunk.chunkIndex}`);
          case "ADAPTER_BAD_RESPONSE":
            throw new AdapterBadResponseError(
              `Cloud OCR returned bad response at chunk ${chunk.chunkIndex}`,
            );
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
      const pageText = this.customPageText[pageNum] ?? syntheticFixtureDraft(pageNum, chunk.key);
      pages.push({
        pdfPage: pageNum,
        text: pageText,
      });
    }

    return {
      pages,
      workerIdentity: this.workerIdentity,
      model: this.model,
      costUnits: this.costUnits,
    };
  }

  getSubmissionCount(chunkIndex: number): number {
    return this.submissions.get(chunkIndex) ?? 0;
  }
}
