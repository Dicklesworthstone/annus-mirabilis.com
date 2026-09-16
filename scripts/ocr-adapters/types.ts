export type OcrRefusalCode =
  | "FACSIMILE_DIGEST_MISMATCH"
  | "CHUNK_TOO_LARGE"
  | "CONCURRENCY_TOO_HIGH"
  | "PAGE_RANGE_OUT_OF_BOUNDS"
  | "MULTI_SOURCE_PLAN"
  | "CLOUD_PROCESSING_NOT_PERMITTED"
  | "NO_ADAPTER"
  | "FORBIDDEN_ADAPTER_NAME"
  | "FIXTURE_ADAPTER_OUTSIDE_TEST"
  | "WORKER_IDENTITY_MISMATCH"
  | "ADAPTER_UNAVAILABLE"
  | "ADAPTER_AUTH"
  | "ADAPTER_QUOTA"
  | "ADAPTER_BAD_RESPONSE"
  | "ADAPTER_TIMEOUT";

export class OcrRefusalError extends Error {
  readonly refusalCode: OcrRefusalCode;
  readonly exitCode: number;

  constructor(refusalCode: OcrRefusalCode, message: string, exitCode = 1) {
    super(`[${refusalCode}] ${message}`);
    this.name = "OcrRefusalError";
    this.refusalCode = refusalCode;
    this.exitCode = exitCode;
  }
}

export type AdapterErrorCode =
  | "ADAPTER_UNAVAILABLE"
  | "ADAPTER_AUTH"
  | "ADAPTER_QUOTA"
  | "ADAPTER_BAD_RESPONSE"
  | "ADAPTER_TIMEOUT";

export class OcrAdapterError extends Error {
  readonly code: AdapterErrorCode;
  readonly retryable: boolean;

  constructor(code: AdapterErrorCode, message: string, retryable = false) {
    super(`[${code}] ${message}`);
    this.name = "OcrAdapterError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class AdapterUnavailableError extends OcrAdapterError {
  constructor(message = "Cloud OCR service is unavailable.") {
    super("ADAPTER_UNAVAILABLE", message, false);
  }
}

export class AdapterAuthError extends OcrAdapterError {
  constructor(message = "Authentication failed for cloud OCR service.") {
    super("ADAPTER_AUTH", message, false);
  }
}

export class AdapterQuotaError extends OcrAdapterError {
  constructor(message = "Quota or rate limit exceeded for cloud OCR service.") {
    super("ADAPTER_QUOTA", message, false);
  }
}

export class AdapterBadResponseError extends OcrAdapterError {
  constructor(message = "Received invalid or unparseable response from cloud OCR service.") {
    super("ADAPTER_BAD_RESPONSE", message, true);
  }
}

export class AdapterTimeoutError extends OcrAdapterError {
  constructor(message = "Cloud OCR request timed out.") {
    super("ADAPTER_TIMEOUT", message, true);
  }
}

export interface ChunkImage {
  path: string;
  sha256: string;
  pdfPage: number;
}

export interface ChunkSubmission {
  key: string;
  toolRunId: string;
  chunkIndex: number;
  pdfPages: number[];
  images: ChunkImage[];
  instructionsVersion: string;
  instructionText: string;
}

export interface SubmitResult {
  jobId: string;
}

export interface PollResult {
  status: "queued" | "running" | "completed" | "failed";
  retryAfterMs?: number | undefined;
}

export interface PageOcrResult {
  pdfPage: number;
  text: string;
}

export interface FetchResult {
  pages: PageOcrResult[];
  workerIdentity: string;
  model: string;
  costUnits?: number | undefined;
}

export interface DescribeResult {
  service: string;
  workerIdentity?: string | undefined;
}

export interface CloudOcrAdapter {
  readonly name: string;
  describe(): Promise<DescribeResult> | DescribeResult;
  submit(chunk: ChunkSubmission): Promise<SubmitResult>;
  poll(jobId: string): Promise<PollResult>;
  fetchResult(jobId: string): Promise<FetchResult>;
}
