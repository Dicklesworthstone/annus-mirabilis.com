/**
 * Schema and validation for per-key facsimile source configurations.
 * Spec: am-src-download-script-15ar
 * Rights constraints: docs/rights-vocabulary.yaml
 */

import { URL } from "node:url";

export type CandidateKind = "whole-volume" | "whole-issue" | "article";
export type HostFileSource = "original" | "derivative" | "unknown";
export type EmbeddedTextLayerStatus = "present" | "absent" | "unknown";
export type PublicationDecision = "publish" | "pin-local-only" | "reference-only";
export type CloudProcessing = "permitted" | "forbidden" | "unknown";

export interface Candidate {
  url: string;
  kind: CandidateKind;
  institution: string;
  hostItemId: string;
  hostFileName: string;
  hostFileSource: HostFileSource;
  derivativeReason?: string | null | undefined;
  hostChecksums?: {
    md5?: string | null | undefined;
    sha1?: string | null | undefined;
  } | undefined;
  termsStatementUrls: string[];
  expectedPageCountRange: {
    min: number;
    max: number;
  };
  maxBytes?: number | undefined;
}

export interface ArticlePages {
  printedFirst: number;
  printedLast: number;
  parentPageIndices?: number[] | undefined;
}

export interface FacsimileRights {
  rightsStatus: string;
  publicationDecision: PublicationDecision;
  publicationReason?: string | null | undefined;
  cloudProcessing: CloudProcessing;
  cloudProcessingBasis?: string | null | undefined;
}

export interface PinnedRecord {
  path: string;
  sha256: string;
  pageCount: number;
  mimeType: string;
  acquisitionDate: string;
  originUrl: string;
  finalUrl: string;
  candidateIndex: number;
  hostFileSource: HostFileSource;
  hostChecksumsVerified: ("md5" | "sha1")[];
  embeddedTextLayer: EmbeddedTextLayerStatus;
  parent?: {
    sha256: string;
    pageCount: number;
    path: string;
    parentPageIndices: number[];
  } | undefined;
  pdfLibrary: {
    name: string;
    version: string;
  };
  toolRunId: string;
}

export interface FacsimileSourceConfig {
  configVersion: 1;
  key: string;
  candidates: Candidate[];
  articlePages: ArticlePages;
  rights: FacsimileRights;
  pinned?: PinnedRecord | undefined;
}

export type FacsimileErrorCode =
  // Policy refusals (exit code 2)
  | "WITNESS_OR_PUBLISHER_HOST"
  | "SCAN_TERMS_UNKNOWN"
  | "REFERENCE_ONLY_NOT_PINNABLE"
  | "RIGHTS_VOCABULARY_INVALID"
  | "DERIVATIVE_WITHOUT_REASON"
  | "PINNED_DIGEST_CONFLICT"
  | "LOCK_HELD"
  | "RESTORE_DIGEST_MISMATCH"
  // Validation failures (exit code 3)
  | "INVALID_CONFIG"
  | "NOT_A_PDF"
  | "TRUNCATED_PDF"
  | "PDF_PARSE_FAILED"
  | "PAGE_COUNT_OUT_OF_RANGE"
  | "PARENT_PAGE_INDEX_MISSING"
  | "HOST_CHECKSUM_MISMATCH"
  | "EXTRACTION_NONDETERMINISTIC"
  // Network failures (exit code 4)
  | "HTTP_NOT_HTTPS"
  | "REDIRECT_TO_HTTP"
  | "HTTP_STATUS"
  | "SIZE_LIMIT_EXCEEDED"
  | "NETWORK_RETRIES_EXHAUSTED"
  // General failure (exit code 1)
  | "UNEXPECTED_ERROR";

export function getExitCodeForError(code: FacsimileErrorCode): number {
  switch (code) {
    case "WITNESS_OR_PUBLISHER_HOST":
    case "SCAN_TERMS_UNKNOWN":
    case "REFERENCE_ONLY_NOT_PINNABLE":
    case "RIGHTS_VOCABULARY_INVALID":
    case "DERIVATIVE_WITHOUT_REASON":
    case "PINNED_DIGEST_CONFLICT":
    case "LOCK_HELD":
    case "RESTORE_DIGEST_MISMATCH":
      return 2;
    case "INVALID_CONFIG":
    case "NOT_A_PDF":
    case "TRUNCATED_PDF":
    case "PDF_PARSE_FAILED":
    case "PAGE_COUNT_OUT_OF_RANGE":
    case "PARENT_PAGE_INDEX_MISSING":
    case "HOST_CHECKSUM_MISMATCH":
    case "EXTRACTION_NONDETERMINISTIC":
      return 3;
    case "HTTP_NOT_HTTPS":
    case "REDIRECT_TO_HTTP":
    case "HTTP_STATUS":
    case "SIZE_LIMIT_EXCEEDED":
    case "NETWORK_RETRIES_EXHAUSTED":
      return 4;
    default:
      return 1;
  }
}

export class FacsimileError extends Error {
  readonly code: FacsimileErrorCode;
  readonly exitCode: number;

  constructor(code: FacsimileErrorCode, message: string) {
    super(message);
    this.name = "FacsimileError";
    this.code = code;
    this.exitCode = getExitCodeForError(code);
  }
}

export const FORBIDDEN_HOSTS: Record<string, string> = {
  "einsteinpapers.press.princeton.edu":
    "Collected Papers of Albert Einstein; witness edition, not original journal scan",
  "wikisource.org": "Community wiki transcription witness, not original archive source",
  "de.wikisource.org": "Community wiki transcription witness, not original archive source",
  "onlinelibrary.wiley.com": "Publisher site under commercial subscription/paywall terms",
  "bibliothek.uni-augsburg.de": "Augsburg facsimile host; witness only / redistribution restriction",
};

export function isForbiddenHost(hostname: string): { forbidden: boolean; reason?: string } {
  const normalized = hostname.toLowerCase();
  if (FORBIDDEN_HOSTS[normalized]) {
    return { forbidden: true, reason: FORBIDDEN_HOSTS[normalized] };
  }
  if (normalized.endsWith(".wikisource.org")) {
    return { forbidden: true, reason: "Wikisource subdomain witness, not original archive scan" };
  }
  return { forbidden: false };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  refusalCode?: FacsimileErrorCode | undefined;
}

export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Configuration root must be an object"], refusalCode: "INVALID_CONFIG" };
  }

  const c = config as Record<string, any>;

  if (c.configVersion !== 1) {
    errors.push(`configVersion must be 1, found ${c.configVersion}`);
  }

  if (typeof c.key !== "string" || !/^ap-\d{2}-\d{1,4}$/.test(c.key)) {
    errors.push(`Invalid key format: ${c.key}. Expected pattern: ap-<volume>-<page>`);
  }

  // Rights validation
  if (!c.rights || typeof c.rights !== "object") {
    errors.push("Missing rights section");
  } else {
    const rights = c.rights as FacsimileRights;
    if (rights.rightsStatus === "scan-terms-unknown") {
      return {
        valid: false,
        errors: ["scan-terms-unknown cannot be pinned or published until terms are located"],
        refusalCode: "SCAN_TERMS_UNKNOWN",
      };
    }

    if (rights.publicationDecision === "reference-only") {
      return {
        valid: false,
        errors: ["reference-only assets are consulted and cited, never pinned"],
        refusalCode: "REFERENCE_ONLY_NOT_PINNABLE",
      };
    }

    if (rights.rightsStatus === "scan-terms-restrict-redistribution" && rights.publicationDecision === "publish") {
      return {
        valid: false,
        errors: ["Scans with terms restricting redistribution must not be published (must be pin-local-only or reference-only)"],
        refusalCode: "RIGHTS_VOCABULARY_INVALID",
      };
    }

    if (rights.publicationDecision === "pin-local-only") {
      if (!rights.publicationReason || typeof rights.publicationReason !== "string" || rights.publicationReason.trim() === "") {
        return {
          valid: false,
          errors: ["publicationDecision: pin-local-only requires a non-empty publicationReason"],
          refusalCode: "RIGHTS_VOCABULARY_INVALID",
        };
      }
    }

    if (rights.cloudProcessing && (!rights.cloudProcessingBasis || typeof rights.cloudProcessingBasis !== "string" || rights.cloudProcessingBasis.trim() === "")) {
      return {
        valid: false,
        errors: ["cloudProcessing requires a non-empty cloudProcessingBasis"],
        refusalCode: "RIGHTS_VOCABULARY_INVALID",
      };
    }
  }

  // Article pages validation
  if (!c.articlePages || typeof c.articlePages !== "object") {
    errors.push("Missing articlePages section");
  } else {
    const ap = c.articlePages;
    if (typeof ap.printedFirst !== "number" || typeof ap.printedLast !== "number" || ap.printedLast < ap.printedFirst) {
      errors.push("articlePages must specify printedFirst and printedLast with printedLast >= printedFirst");
    }
    if (ap.parentPageIndices !== undefined) {
      if (!Array.isArray(ap.parentPageIndices) || ap.parentPageIndices.some((idx: any) => typeof idx !== "number" || idx < 1)) {
        errors.push("parentPageIndices must be an array of positive 1-based integers");
      }
    }
  }

  // Candidates validation
  if (!Array.isArray(c.candidates) || c.candidates.length === 0) {
    errors.push("candidates must be a non-empty array");
  } else {
    for (let i = 0; i < c.candidates.length; i++) {
      const candidate = c.candidates[i];
      if (!candidate || typeof candidate !== "object") {
        errors.push(`candidates[${i}] must be an object`);
        continue;
      }

      // URL and Denylist check
      if (typeof candidate.url !== "string") {
        errors.push(`candidates[${i}].url must be a string`);
      } else {
        try {
          const parsedUrl = new URL(candidate.url);
          const hostCheck = isForbiddenHost(parsedUrl.hostname);
          if (hostCheck.forbidden) {
            return {
              valid: false,
              errors: [`candidates[${i}].url uses forbidden host '${parsedUrl.hostname}': ${hostCheck.reason}`],
              refusalCode: "WITNESS_OR_PUBLISHER_HOST",
            };
          }
          const isLoopbackTest =
            process.env.NODE_ENV === "test" &&
            (parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost");
          if (parsedUrl.protocol !== "https:" && !isLoopbackTest) {
            return {
              valid: false,
              errors: [`candidates[${i}].url must use HTTPS protocol, found '${parsedUrl.protocol}'`],
              refusalCode: "HTTP_NOT_HTTPS",
            };
          }
        } catch {
          errors.push(`candidates[${i}].url is not a valid URL: ${candidate.url}`);
        }
      }

      // Derivative reason check
      if (candidate.hostFileSource === "derivative") {
        if (!candidate.derivativeReason || typeof candidate.derivativeReason !== "string" || candidate.derivativeReason.trim() === "") {
          return {
            valid: false,
            errors: [`candidates[${i}] with hostFileSource 'derivative' requires derivativeReason`],
            refusalCode: "DERIVATIVE_WITHOUT_REASON",
          };
        }
      }

      // Expected page count range check
      if (!candidate.expectedPageCountRange || typeof candidate.expectedPageCountRange !== "object") {
        errors.push(`candidates[${i}] missing expectedPageCountRange`);
      } else {
        const { min, max } = candidate.expectedPageCountRange;
        if (typeof min !== "number" || typeof max !== "number" || min < 1 || max < min) {
          errors.push(`candidates[${i}].expectedPageCountRange must have 1 <= min <= max`);
        }
      }
    }
  }

  // Pinned record validation (if present)
  if (c.pinned !== undefined) {
    if (typeof c.pinned !== "object" || c.pinned === null) {
      errors.push("pinned must be an object if present");
    } else {
      const p = c.pinned;
      if (typeof p.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(p.sha256)) {
        errors.push("pinned.sha256 must be a 64-character lowercase hex string");
      }
      if (typeof p.toolRunId !== "string" || !/^\d{8}T\d{6}Z-[0-9a-f]+$/.test(p.toolRunId)) {
        errors.push("pinned.toolRunId must be in timestamp-plus-hex format");
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      refusalCode: "INVALID_CONFIG",
    };
  }

  return { valid: true, errors: [] };
}
