/**
 * Schema definitions and validation for provenance survey records (docs/provenance/survey/<key>.md).
 */

import { parseYaml } from "./yaml.ts";
import {
  RIGHTS_STATUS_VALUES,
  PUBLICATION_DECISION_VALUES,
  CLOUD_PROCESSING_VALUES,
  REUSE_TERMS_VALUES,
  type RightsStatus,
  type PublicationDecision,
  type CloudProcessing,
  type ReuseTerms,
} from "./receiptSchema.ts";

export type SurveySearch = Readonly<{
  host: string;
  query: string;
  checkedAt: string;
  outcome: string;
}>;

export type ProposedClassification = Readonly<{
  rightsStatus: RightsStatus;
  publicationDecision: PublicationDecision;
  publicationReason?: string;
  cloudProcessing: CloudProcessing;
  cloudProcessingBasis: string;
  reuseTerms: ReuseTerms;
}>;

export type CandidateObservation = Readonly<{
  checkedAt: string;
  url?: string;
  method?: string;
  httpStatus?: number;
  finding: string;
}>;

export type CandidateScan = Readonly<{
  id: string;
  kind: string;
  institution: string;
  hostItemId: string;
  url: string;
  downloadUrl?: string;
  hostFileName: string;
  hostFileSource: string;
  derivativeReason?: string | null;
  hostChecksums?: Readonly<{
    md5?: string | null;
    sha1?: string | null;
    sha256?: string | null;
  }>;
  fileSizeBytes?: number;
  pageCount: number;
  printedPages: Readonly<{ first: number; last: number }>;
  viewerPages: Readonly<{ first: number; last: number }>;
  pdfPageIndices: Readonly<{ first: number; last: number }>;
  embeddedTextLayer: string;
  termsStatementUrls: readonly string[];
  verbatimTerms?: string;
  workLevelCopyrightFlags?: string;
  proposedClassification: ProposedClassification;
  observations: readonly CandidateObservation[];
}>;

export type SurveyIdentityCheck = Readonly<{
  checkedAt: string;
  source: string;
  url?: string;
  method?: string;
  httpStatus?: number;
  canonicalDoi?: string;
  volumeSeries?: string;
  issue?: string;
  printedPages?: string;
  reissueDoi2005?: string;
  eppDates?: Readonly<{ received?: string; published?: string }>;
  cpaeVolume?: number;
  cpaeDocNumber?: number;
  printedDateline?: string;
}>;

export type SurveyWitness = Readonly<{
  kind: string;
  label?: string;
  bibliographicIdentity?: string;
  host?: string;
  url?: string;
  pageTitle?: string;
  indexFile?: string | null;
  revisionId?: string | number | null;
  checkedAt?: string;
  status?: string;
  rightsStatus?: string;
}>;

export type LegibilityCheck = Readonly<{
  pageKind: string;
  printedPage: number;
  grade: "legible" | "marginal" | "illegible";
  notes: string;
}>;

export type SurveyRecommendation = Readonly<{
  candidateId: string;
  fallbackCandidateId?: string;
  publishedAssetKind: string;
  reasoning: string;
}>;

export type SurveyFrontMatter = Readonly<{
  surveyFormatVersion: 1;
  key: string;
  surveyedAt: string;
  searches: readonly SurveySearch[];
  candidates: readonly CandidateScan[];
  identityChecks: readonly SurveyIdentityCheck[];
  witnesses: readonly SurveyWitness[];
  legibility: readonly LegibilityCheck[];
  recommendation: SurveyRecommendation;
  openQuestionsForUser: readonly string[];
}>;

export type SurveyDiagnostic = Readonly<{
  rule: string;
  severity: "error" | "flag";
  path: string;
  message: string;
  expected?: string | undefined;
  actual?: string | undefined;
}>;

export function validateSurveyFrontMatter(
  raw: unknown,
  filePath: string
): { data?: SurveyFrontMatter | undefined; diagnostics: readonly SurveyDiagnostic[] } {
  const diagnostics: SurveyDiagnostic[] = [];
  const err = (rule: string, path: string, message: string, expected?: string, actual?: string) => {
    diagnostics.push({ rule, severity: "error", path, message, expected, actual });
  };

  if (!raw || typeof raw !== "object") {
    err("survey-schema", "root", "Front matter must be a YAML object.");
    return { diagnostics };
  }

  const o = raw as Record<string, unknown>;

  if (o.surveyFormatVersion !== 1) {
    err("survey-version", "surveyFormatVersion", "surveyFormatVersion must be 1.", "1", String(o.surveyFormatVersion));
  }

  if (typeof o.key !== "string" || !/^ap-\d+-\d+$/.test(o.key)) {
    err("survey-key", "key", `Invalid survey key "${o.key}". Must match ap-<vol>-<page>.`);
  }

  if (typeof o.surveyedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.surveyedAt)) {
    err("survey-date", "surveyedAt", "surveyedAt must be an ISO date (YYYY-MM-DD).");
  }

  if (!Array.isArray(o.searches) || o.searches.length === 0) {
    err("survey-searches", "searches", "searches must be a non-empty array.");
  }

  if (!Array.isArray(o.candidates) || o.candidates.length === 0) {
    err("survey-candidates", "candidates", "candidates must be a non-empty array.");
  }

  const candidateIds = new Set<string>();
  const candidatesList = Array.isArray(o.candidates) ? o.candidates : [];

  for (let i = 0; i < candidatesList.length; i++) {
    const c = candidatesList[i] as Record<string, unknown>;
    const p = `candidates[${i}]`;

    if (!c || typeof c !== "object") {
      err("survey-candidate", p, "Candidate must be an object.");
      continue;
    }

    if (typeof c.id !== "string" || !c.id) {
      err("survey-candidate-id", `${p}.id`, "Candidate id is required.");
    } else {
      candidateIds.add(c.id);
    }

    // Terms validation: must have verbatimTerms (or terms statement) or termsNotFound
    const terms = typeof c.verbatimTerms === "string" ? c.verbatimTerms.trim() : "";
    if (!terms) {
      err(
        "survey-candidate-terms",
        `${p}.verbatimTerms`,
        `Candidate "${c.id || i}" must provide verbatimTerms or record "termsNotFound".`
      );
    }

    // Proposed classification validation
    const pc = c.proposedClassification as Record<string, unknown>;
    if (!pc || typeof pc !== "object") {
      err("survey-proposed-classification", `${p}.proposedClassification`, "proposedClassification is required.");
    } else {
      if (!RIGHTS_STATUS_VALUES.includes(pc.rightsStatus as RightsStatus)) {
        err(
          "survey-rights-status",
          `${p}.proposedClassification.rightsStatus`,
          `Invalid rightsStatus "${pc.rightsStatus}".`,
          RIGHTS_STATUS_VALUES.join(" | "),
          String(pc.rightsStatus)
        );
      }
      if (!PUBLICATION_DECISION_VALUES.includes(pc.publicationDecision as PublicationDecision)) {
        err(
          "survey-publication-decision",
          `${p}.proposedClassification.publicationDecision`,
          `Invalid publicationDecision "${pc.publicationDecision}".`,
          PUBLICATION_DECISION_VALUES.join(" | "),
          String(pc.publicationDecision)
        );
      }
      if (!CLOUD_PROCESSING_VALUES.includes(pc.cloudProcessing as CloudProcessing)) {
        err(
          "survey-cloud-processing",
          `${p}.proposedClassification.cloudProcessing`,
          `Invalid cloudProcessing "${pc.cloudProcessing}".`,
          CLOUD_PROCESSING_VALUES.join(" | "),
          String(pc.cloudProcessing)
        );
      }
      if (!REUSE_TERMS_VALUES.includes(pc.reuseTerms as ReuseTerms)) {
        err(
          "survey-reuse-terms",
          `${p}.proposedClassification.reuseTerms`,
          `Invalid reuseTerms "${pc.reuseTerms}".`,
          REUSE_TERMS_VALUES.join(" | "),
          String(pc.reuseTerms)
        );
      }
    }
  }

  // Recommendation validation
  const rec = o.recommendation as Record<string, unknown>;
  if (!rec || typeof rec !== "object") {
    err("survey-recommendation", "recommendation", "recommendation is required.");
  } else {
    if (typeof rec.candidateId !== "string" || !candidateIds.has(rec.candidateId)) {
      err(
        "survey-recommendation-candidate",
        "recommendation.candidateId",
        `Recommendation candidateId "${rec.candidateId}" does not match any candidate id.`
      );
    }
    if (rec.fallbackCandidateId && (typeof rec.fallbackCandidateId !== "string" || !candidateIds.has(rec.fallbackCandidateId))) {
      err(
        "survey-recommendation-fallback",
        "recommendation.fallbackCandidateId",
        `Recommendation fallbackCandidateId "${rec.fallbackCandidateId}" does not match any candidate id.`
      );
    }
  }

  // Open questions for user validation
  const openQuestions = Array.isArray(o.openQuestionsForUser)
    ? (o.openQuestionsForUser as string[])
    : [];

  const questionsText = openQuestions.join("\n").toLowerCase();

  // Every unknown classification must appear in openQuestionsForUser
  for (let i = 0; i < candidatesList.length; i++) {
    const c = candidatesList[i] as Record<string, unknown>;
    const pc = (c.proposedClassification || {}) as Record<string, unknown>;
    const candidateId = typeof c.id === "string" ? c.id.toLowerCase() : "";

    const hasUnknown =
      pc.cloudProcessing === "unknown" ||
      pc.rightsStatus === "scan-terms-unknown" ||
      (typeof c.verbatimTerms === "string" && c.verbatimTerms.includes("termsNotFound"));

    if (hasUnknown) {
      const isMentioned =
        (candidateId && questionsText.includes(candidateId)) ||
        questionsText.includes("unknown") ||
        questionsText.includes("terms");
      if (!isMentioned) {
        err(
          "survey-unknown-in-questions",
          `candidates[${i}].proposedClassification`,
          `Candidate "${c.id}" has unknown rights/cloud classification or termsNotFound, but is not raised in openQuestionsForUser.`
        );
      }
    }
  }

  return {
    data: diagnostics.length === 0 ? (raw as SurveyFrontMatter) : undefined,
    diagnostics,
  };
}

export function validateSurveyRecord(
  fileText: string,
  filePath: string
): { ok: boolean; diagnostics: readonly SurveyDiagnostic[]; data?: SurveyFrontMatter | undefined } {
  const match = fileText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {
      ok: false,
      diagnostics: [
        {
          rule: "survey-front-matter",
          severity: "error",
          path: "front-matter",
          message: "Survey record must begin with YAML front matter enclosed by ---.",
        },
      ],
    };
  }

  let parsedYaml: unknown;
  try {
    parsedYaml = parseYaml(match[1]!);
  } catch (e) {
    return {
      ok: false,
      diagnostics: [
        {
          rule: "survey-yaml-syntax",
          severity: "error",
          path: "front-matter",
          message: e instanceof Error ? e.message : "Failed to parse YAML front matter.",
        },
      ],
    };
  }

  const result = validateSurveyFrontMatter(parsedYaml, filePath);
  return {
    ok: !result.diagnostics.some((d) => d.severity === "error"),
    diagnostics: result.diagnostics,
    data: result.data,
  };
}
