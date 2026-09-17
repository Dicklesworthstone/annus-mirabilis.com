import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type OcrRefusalCode, OcrRefusalError } from "../ocr-adapters/types.ts";

export interface OcrPlanRender {
  dpi: number;
  format: "png";
}

export interface ExpectedPageCounts {
  displayEquations?: number | undefined;
  footnoteMarkers?: number | undefined;
  illegible?: number | undefined;
}

export interface OcrPlan {
  planVersion: 1;
  key: string;
  facsimilePath: string;
  facsimileSha256: string;
  pdfPageRange: [number, number];
  chunkSize: number;
  maxConcurrency: number;
  cloudProcessing: "permitted" | "forbidden" | "unknown";
  cloudProcessingBasisRef: string;
  render: OcrPlanRender;
  instructionsVersion: string;
  expectedWorkerIdentity: string;
  expectedCounts?: Record<number, ExpectedPageCounts> | undefined;
}

export interface ValidatePlanOptions {
  checkFacsimile?: boolean | undefined;
  totalPdfPages?: number | undefined;
  pinnedDigest?: string | undefined;
  facsimileBuffer?: Buffer | undefined;
}

export interface PlanValidationResult {
  valid: boolean;
  plan?: OcrPlan | undefined;
  errors: string[];
  refusalCode?: OcrRefusalCode | undefined;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function toExpectedPageCounts(val: unknown): ExpectedPageCounts {
  if (!val || typeof val !== "object" || Array.isArray(val)) {
    return {};
  }
  const obj = val as Record<string, unknown>;
  const counts: ExpectedPageCounts = {};
  if (typeof obj.displayEquations === "number") {
    counts.displayEquations = obj.displayEquations;
  }
  if (typeof obj.footnoteMarkers === "number") {
    counts.footnoteMarkers = obj.footnoteMarkers;
  }
  if (typeof obj.illegible === "number") {
    counts.illegible = obj.illegible;
  }
  return counts;
}

export function parseYamlOrJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(text);
  }

  const result: Record<string, unknown> = {};
  const lines = text.split("\n");
  let currentObj: Record<string, unknown> | null = null;
  let inExpectedCounts = false;
  let expectedCountsObj: Record<number, ExpectedPageCounts> = {};

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const indent = rawLine.search(/\S/);

    if (inExpectedCounts && indent >= 2) {
      const matchPage = line.trim().match(/^(\d+):\s*(.*)$/);
      if (matchPage) {
        const pageStr = matchPage[1];
        if (pageStr !== undefined) {
          const pageNum = parseInt(pageStr, 10);
          const rest = matchPage[2]?.trim();
          if (rest) {
            expectedCountsObj[pageNum] = toExpectedPageCounts(parsePrimitive(rest));
          } else {
            expectedCountsObj[pageNum] = {};
          }
        }
        continue;
      }
    } else {
      inExpectedCounts = false;
    }

    if (indent === 0) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const valStr = line.slice(colonIdx + 1).trim();

      if (key === "expectedCounts") {
        inExpectedCounts = true;
        expectedCountsObj = {};
        result.expectedCounts = expectedCountsObj;
        continue;
      }

      if (valStr === "") {
        currentObj = {};
        result[key] = currentObj;
      } else {
        result[key] = parsePrimitive(valStr);
        currentObj = null;
      }
    } else if (indent >= 2 && currentObj) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const subKey = line.slice(0, colonIdx).trim();
      const valStr = line.slice(colonIdx + 1).trim();
      currentObj[subKey] = parsePrimitive(valStr);
    }
  }

  return result;
}

function parseInlineMapping(str: string): Record<string, unknown> {
  const inner = str.trim().replace(/^\{/, "").replace(/\}$/, "").trim();
  if (!inner) return {};
  const res: Record<string, unknown> = {};
  const parts = inner.split(",");
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;
    const k = part.slice(0, colonIdx).trim().replace(/^['"]/, "").replace(/['"]$/, "");
    const v = part.slice(colonIdx + 1).trim();
    res[k] = parsePrimitive(v);
  }
  return res;
}

function parsePrimitive(val: string): unknown {
  val = val.trim();
  if (val.startsWith("{") && val.endsWith("}")) {
    return parseInlineMapping(val);
  }
  if (val.startsWith("[") && val.endsWith("]")) {
    const inner = val.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((s) => parsePrimitive(s.trim()));
  }
  if (val === "true") return true;
  if (val === "false") return false;
  if (val === "null") return null;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

export function validatePlan(
  raw: unknown,
  options: ValidatePlanOptions = {},
): PlanValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      valid: false,
      errors: ["Plan must be a non-null object."],
      refusalCode: "MULTI_SOURCE_PLAN",
    };
  }

  const obj = raw as Record<string, unknown>;

  // Check for multi-source plan (e.g. keys array or multiple keys declared)
  if (
    Array.isArray(obj.keys) ||
    (Array.isArray(obj.key) && obj.key.length > 1) ||
    Array.isArray(obj.facsimilePaths)
  ) {
    return {
      valid: false,
      errors: ["A plan must cover exactly one paper key and one facsimile."],
      refusalCode: "MULTI_SOURCE_PLAN",
    };
  }

  if (obj.planVersion !== 1) {
    errors.push("planVersion must be 1.");
  }

  if (typeof obj.key !== "string" || !obj.key.trim()) {
    errors.push("key must be a non-empty string.");
  }

  if (typeof obj.facsimilePath !== "string" || !obj.facsimilePath.trim()) {
    errors.push("facsimilePath must be a non-empty string.");
  }

  if (typeof obj.facsimileSha256 !== "string" || !/^[0-9a-f]{64}$/i.test(obj.facsimileSha256)) {
    errors.push("facsimileSha256 must be a 64-character lowercase hex string.");
  }

  // Cloud processing determination
  if (obj.cloudProcessing !== "permitted") {
    return {
      valid: false,
      errors: [
        `cloudProcessing is '${String(obj.cloudProcessing)}', but must be 'permitted'. OCR paused by policy.`,
      ],
      refusalCode: "CLOUD_PROCESSING_NOT_PERMITTED",
    };
  }

  if (typeof obj.cloudProcessingBasisRef !== "string" || !obj.cloudProcessingBasisRef.trim()) {
    errors.push("cloudProcessingBasisRef is required.");
  }

  // Page range validation
  let validatedPageRange: [number, number] | undefined;
  if (!Array.isArray(obj.pdfPageRange) || obj.pdfPageRange.length !== 2) {
    errors.push("pdfPageRange must be [firstPage, lastPage].");
  } else {
    const [first, last] = obj.pdfPageRange;
    if (typeof first !== "number" || typeof last !== "number" || first < 1 || last < first) {
      return {
        valid: false,
        errors: [
          `Invalid pdfPageRange: [${String(first)}, ${String(last)}]. Pages must be >= 1 and first <= last.`,
        ],
        refusalCode: "PAGE_RANGE_OUT_OF_BOUNDS",
      };
    }

    if (options.totalPdfPages !== undefined && last > options.totalPdfPages) {
      return {
        valid: false,
        errors: [
          `pdfPageRange [${first}, ${last}] exceeds total PDF pages (${options.totalPdfPages}).`,
        ],
        refusalCode: "PAGE_RANGE_OUT_OF_BOUNDS",
      };
    }
    validatedPageRange = [first, last];
  }

  // Chunk size validation (max 4, min 1)
  const rawChunk = obj.chunkSize;
  const chunkSize = rawChunk === undefined ? 2 : rawChunk;
  if (typeof chunkSize !== "number" || chunkSize < 1 || chunkSize > 4) {
    return {
      valid: false,
      errors: [`chunkSize ${String(chunkSize)} is invalid. Must be between 1 and 4.`],
      refusalCode: "CHUNK_TOO_LARGE",
    };
  }

  // Concurrency validation (max 2, min 1)
  const rawConcurrency = obj.maxConcurrency;
  const maxConcurrency = rawConcurrency === undefined ? 1 : rawConcurrency;
  if (typeof maxConcurrency !== "number" || maxConcurrency < 1 || maxConcurrency > 2) {
    return {
      valid: false,
      errors: [`maxConcurrency ${String(maxConcurrency)} exceeds allowed limit (maximum 2).`],
      refusalCode: "CONCURRENCY_TOO_HIGH",
    };
  }

  // Render options
  let validRender = false;
  const render = obj.render === undefined ? { dpi: 300, format: "png" } : obj.render;
  if (render && typeof render === "object" && !Array.isArray(render)) {
    const rObj = render as Record<string, unknown>;
    if (rObj.dpi === 300 && rObj.format === "png") {
      validRender = true;
    }
  }
  if (!validRender) {
    errors.push("render must specify { dpi: 300, format: 'png' }.");
  }

  if (typeof obj.instructionsVersion !== "string" || !obj.instructionsVersion.trim()) {
    errors.push("instructionsVersion must be specified.");
  }

  if (typeof obj.expectedWorkerIdentity !== "string" || !obj.expectedWorkerIdentity.trim()) {
    errors.push("expectedWorkerIdentity must be specified.");
  }

  // Facsimile digest check if requested
  if (typeof obj.facsimileSha256 === "string") {
    if (options.pinnedDigest && obj.facsimileSha256) {
      if (obj.facsimileSha256.toLowerCase() !== options.pinnedDigest.toLowerCase()) {
        return {
          valid: false,
          errors: [
            `facsimileSha256 ${obj.facsimileSha256} does not match pinned digest ${options.pinnedDigest}.`,
          ],
          refusalCode: "FACSIMILE_DIGEST_MISMATCH",
        };
      }
    }

    if (options.facsimileBuffer && obj.facsimileSha256) {
      const computedDigest = createHash("sha256").update(options.facsimileBuffer).digest("hex");
      if (obj.facsimileSha256.toLowerCase() !== computedDigest.toLowerCase()) {
        return {
          valid: false,
          errors: [
            `facsimileSha256 ${obj.facsimileSha256} does not match computed digest ${computedDigest}.`,
          ],
          refusalCode: "FACSIMILE_DIGEST_MISMATCH",
        };
      }
    }
  }

  if (errors.length > 0 || !validatedPageRange) {
    return { valid: false, errors };
  }

  const expectedCounts =
    obj.expectedCounts &&
    typeof obj.expectedCounts === "object" &&
    !Array.isArray(obj.expectedCounts)
      ? (obj.expectedCounts as Record<number, ExpectedPageCounts>)
      : undefined;

  const plan: OcrPlan = {
    planVersion: 1,
    key: typeof obj.key === "string" ? obj.key : "",
    facsimilePath: typeof obj.facsimilePath === "string" ? obj.facsimilePath : "",
    facsimileSha256:
      typeof obj.facsimileSha256 === "string" ? obj.facsimileSha256.toLowerCase() : "",
    pdfPageRange: validatedPageRange,
    chunkSize,
    maxConcurrency,
    cloudProcessing: "permitted",
    cloudProcessingBasisRef:
      typeof obj.cloudProcessingBasisRef === "string" ? obj.cloudProcessingBasisRef : "",
    render: { dpi: 300, format: "png" },
    instructionsVersion: typeof obj.instructionsVersion === "string" ? obj.instructionsVersion : "",
    expectedWorkerIdentity:
      typeof obj.expectedWorkerIdentity === "string" ? obj.expectedWorkerIdentity : "",
    expectedCounts,
  };

  return { valid: true, plan, errors: [] };
}

export async function loadPlan(
  planPath: string,
  options: ValidatePlanOptions = {},
): Promise<OcrPlan> {
  const fullPath = resolve(ROOT, planPath);
  const text = await readFile(fullPath, "utf-8");
  const raw = parseYamlOrJson(text);

  let buffer: Buffer | undefined;
  if (options.checkFacsimile) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const rawObj = raw as Record<string, unknown>;
      if (typeof rawObj.facsimilePath === "string") {
        const facPath = resolve(ROOT, rawObj.facsimilePath);
        buffer = await readFile(facPath);
      }
    }
  }

  const result = validatePlan(raw, {
    ...options,
    facsimileBuffer: buffer ?? options.facsimileBuffer,
  });

  if (!result.valid || !result.plan) {
    const refusal = result.refusalCode ?? "MULTI_SOURCE_PLAN";
    throw new OcrRefusalError(
      refusal,
      `Plan validation failed for ${planPath}:\n${result.errors.join("\n")}`,
    );
  }

  return result.plan;
}
