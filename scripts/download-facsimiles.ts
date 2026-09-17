#!/usr/bin/env bun
/**
 * Annus Mirabilis Facsimile Downloader & Pinning Engine
 *
 * Spec: am-src-download-script-15ar
 * Gates step: facsimile-config (scripts/quality-gates/registry.ts)
 *
 * Fetches, verifies host checksums, validates, hashes, detects embedded text layers,
 * extracts articles deterministically, pins scans, and produces receipt stubs.
 * Strictly adheres to AGENTS.md Rule 1 (never deletes files) and hard resource policy
 * (never runs local OCR or text extraction).
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { newToolRunId } from "./runIds";
import {
  type Candidate,
  type EmbeddedTextLayerStatus,
  FacsimileError,
  type FacsimileErrorCode,
  type FacsimileRights,
  type FacsimileSourceConfig,
  FORBIDDEN_HOSTS,
  isForbiddenHost,
  type PinnedRecord,
  type ValidationResult,
  validateConfig,
} from "./sources/facsimileSourceSchema";

export {
  type Candidate,
  type EmbeddedTextLayerStatus,
  FacsimileError,
  type FacsimileErrorCode,
  type FacsimileRights,
  type FacsimileSourceConfig,
  FORBIDDEN_HOSTS,
  isForbiddenHost,
  type PinnedRecord,
  type ValidationResult,
  validateConfig,
};

export const PDF_LIBRARY = {
  name: "annus-mirabilis-pdf",
  version: "1.0.0",
};

const DEFAULT_MAX_BYTES = 268_435_456; // 256 MiB
const DEFAULT_USER_AGENT = "OpenAI File Downloader, XaiImageApiFetch/1.0";
const FIXED_CREATION_DATE = "D:20000101000000Z";

export function getRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function getDefaultConfigDir(): string {
  return path.join(getRepoRoot(), "scripts", "sources", "facsimile-sources");
}

export function loadConfig(configPathOrKey: string, configDir?: string): FacsimileSourceConfig {
  let fullPath = configPathOrKey;
  if (!configPathOrKey.endsWith(".yaml") && !configPathOrKey.endsWith(".yml")) {
    const dir = configDir || getDefaultConfigDir();
    fullPath = path.join(dir, `${configPathOrKey}.yaml`);
  }
  if (!fs.existsSync(fullPath)) {
    throw new FacsimileError("INVALID_CONFIG", `Configuration file not found at ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, "utf8");
  const parsed = yaml.load(content) as FacsimileSourceConfig;
  const validation = validateConfig(parsed);
  if (!validation.valid) {
    const code = validation.refusalCode || "INVALID_CONFIG";
    throw new FacsimileError(
      code,
      `Invalid configuration in ${fullPath}: ${validation.errors.join("; ")}`,
    );
  }
  return parsed;
}

export function checkAllConfigs(configDir?: string): {
  valid: boolean;
  results: Record<string, ValidationResult>;
} {
  const dir = configDir || getDefaultConfigDir();
  if (!fs.existsSync(dir)) {
    return {
      valid: false,
      results: {
        [dir]: {
          valid: false,
          errors: [`Config directory ${dir} does not exist`],
          refusalCode: "INVALID_CONFIG",
        },
      },
    };
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  const results: Record<string, ValidationResult> = {};
  let allValid = true;

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = yaml.load(content);
      const res = validateConfig(parsed);
      results[file] = res;
      if (!res.valid) {
        allValid = false;
      }
    } catch (err: any) {
      results[file] = {
        valid: false,
        errors: [`Failed to parse YAML: ${err.message}`],
        refusalCode: "INVALID_CONFIG",
      };
      allValid = false;
    }
  }

  return { valid: allValid, results };
}

export function acquireKeyClaim(
  key: string,
  toolRunId: string,
  options?: { locksDir?: string },
): { claimPath: string; acquired: boolean; currentClaim?: any } {
  const baseLocksDir =
    options?.locksDir || path.join(getRepoRoot(), "artifacts", "locks", "download-facsimiles");
  const keyLocksDir = path.join(baseLocksDir, key);
  fs.mkdirSync(keyLocksDir, { recursive: true });

  // Check for any active held claim
  const existingFiles = fs.readdirSync(keyLocksDir).filter((f) => f.endsWith(".claim"));
  for (const file of existingFiles) {
    const claimFile = path.join(keyLocksDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(claimFile, "utf8"));
      if (data.state === "held") {
        let isAlive = false;
        try {
          process.kill(data.pid, 0);
          isAlive = true;
        } catch {
          isAlive = false;
        }
        if (isAlive) {
          throw new FacsimileError(
            "LOCK_HELD",
            `Active lock held for key '${key}' by PID ${data.pid} (run ${data.toolRunId}) in ${claimFile}`,
          );
        }
      }
    } catch (e: any) {
      if (e instanceof FacsimileError) throw e;
    }
  }

  const claimPath = path.join(keyLocksDir, `${toolRunId}.claim`);
  const claimData = {
    pid: process.pid,
    toolRunId,
    key,
    state: "held",
    acquiredAt: new Date().toISOString(),
  };
  fs.writeFileSync(claimPath, JSON.stringify(claimData, null, 2) + "\n", {
    encoding: "utf8",
    flag: "wx",
  });
  return { claimPath, acquired: true, currentClaim: claimData };
}

export function releaseKeyClaim(claimPath: string): void {
  if (!fs.existsSync(claimPath)) return;
  try {
    const data = JSON.parse(fs.readFileSync(claimPath, "utf8"));
    data.state = "released";
    data.releasedAt = new Date().toISOString();
    fs.writeFileSync(claimPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  } catch {
    // preserve file
  }
}

export function verifyHostChecksums(
  checksums: { md5?: string | null; sha1?: string | null } | undefined,
  actual: { md5?: string; sha1?: string },
): { ok: boolean; verified: ("md5" | "sha1")[]; error?: string } {
  if (!checksums) return { ok: true, verified: [] };
  const verified: ("md5" | "sha1")[] = [];

  if (checksums.md5) {
    if (!actual.md5 || actual.md5.toLowerCase() !== checksums.md5.toLowerCase()) {
      return {
        ok: false,
        verified: [],
        error: `MD5 checksum mismatch: expected ${checksums.md5}, calculated ${actual.md5}`,
      };
    }
    verified.push("md5");
  }

  if (checksums.sha1) {
    if (!actual.sha1 || actual.sha1.toLowerCase() !== checksums.sha1.toLowerCase()) {
      return {
        ok: false,
        verified: [],
        error: `SHA-1 checksum mismatch: expected ${checksums.sha1}, calculated ${actual.sha1}`,
      };
    }
    verified.push("sha1");
  }

  return { ok: true, verified };
}

export function sha256File(filePathOrBuffer: string | Uint8Array): string {
  const hash = createHash("sha256");
  if (typeof filePathOrBuffer === "string") {
    const buf = fs.readFileSync(filePathOrBuffer);
    hash.update(buf);
  } else {
    hash.update(filePathOrBuffer);
  }
  return hash.digest("hex");
}

export function validatePdf(
  buffer: Uint8Array,
  expectedRange?: { min: number; max: number },
): { valid: boolean; pageCount: number; errorCode?: FacsimileErrorCode; message?: string } {
  // Sniff for HTML, XML, or JSON
  const initialText = Buffer.from(buffer.subarray(0, Math.min(buffer.length, 1024)))
    .toString("utf8")
    .trim();
  if (
    initialText.startsWith("<!DOCTYPE") ||
    initialText.startsWith("<html") ||
    initialText.startsWith("<?xml") ||
    initialText.startsWith("{") ||
    initialText.startsWith("[")
  ) {
    return {
      valid: false,
      pageCount: 0,
      errorCode: "NOT_A_PDF",
      message: "File content starts with HTML, XML, or JSON instead of %PDF-",
    };
  }

  // Header check: %PDF- in first 1024 bytes
  const headerIdx = initialText.indexOf("%PDF-");
  if (headerIdx === -1) {
    return {
      valid: false,
      pageCount: 0,
      errorCode: "NOT_A_PDF",
      message: "Missing %PDF- header within the first 1024 bytes",
    };
  }

  // Footer check: %%EOF in last 2048 bytes
  const tailStart = Math.max(0, buffer.length - 2048);
  const tailText = Buffer.from(buffer.subarray(tailStart)).toString("utf8");
  if (!tailText.includes("%%EOF")) {
    return {
      valid: false,
      pageCount: 0,
      errorCode: "TRUNCATED_PDF",
      message: "Missing %%EOF marker in the last 2048 bytes (truncated file)",
    };
  }

  // Count pages by searching for /Type\s*/Page\b (excluding /Type /Pages)
  const fullText = Buffer.from(buffer).toString("latin1");
  const pageMatches = fullText.match(/\/Type\s*\/Page\b/g);
  const pageCount = pageMatches ? pageMatches.length : 0;

  if (pageCount === 0) {
    return {
      valid: false,
      pageCount: 0,
      errorCode: "PDF_PARSE_FAILED",
      message: "Failed to locate any /Type /Page objects in PDF",
    };
  }

  if (expectedRange) {
    if (pageCount < expectedRange.min || pageCount > expectedRange.max) {
      return {
        valid: false,
        pageCount,
        errorCode: "PAGE_COUNT_OUT_OF_RANGE",
        message: `Page count ${pageCount} is outside expected range [${expectedRange.min}, ${expectedRange.max}]`,
      };
    }
  }

  return { valid: true, pageCount };
}

export function detectEmbeddedTextLayer(
  buffer: Uint8Array,
  pageIndices?: number[],
): EmbeddedTextLayerStatus {
  try {
    const text = Buffer.from(buffer).toString("latin1");
    // Find all /Type /Page objects
    const pageObjRegex =
      /(\d+)\s+(\d+)\s+obj\s*<<([\s\S]*?)>>\s*(?:stream[\s\S]*?endstream\s*)?endobj/g;
    const pageObjects: Array<{ id: number; content: string }> = [];

    for (let match = pageObjRegex.exec(text); match !== null; match = pageObjRegex.exec(text)) {
      const dict = match[3];
      if (/\/Type\s*\/Page\b/.test(dict) && !/\/Type\s*\/Pages\b/.test(dict)) {
        pageObjects.push({ id: Number.parseInt(match[1], 10), content: match[0] });
      }
    }

    if (pageObjects.length === 0) return "unknown";

    const targetIndices =
      pageIndices && pageIndices.length > 0 ? pageIndices : pageObjects.map((_, i) => i + 1);

    let hasFont = false;
    for (const pIdx of targetIndices) {
      const pageObj = pageObjects[pIdx - 1];
      if (!pageObj) continue;

      // Check if page object has inline /Font or references a Font object
      if (/\/Font\b/.test(pageObj.content)) {
        hasFont = true;
        break;
      }
    }

    return hasFont ? "present" : "absent";
  } catch {
    return "unknown";
  }
}

export function extractArticle(
  parentBuffer: Uint8Array,
  parentPageIndices: number[],
  parentSha256: string,
): Uint8Array {
  const text = Buffer.from(parentBuffer).toString("latin1");
  const objRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  const objects: Map<number, string> = new Map();
  const pageObjIds: number[] = [];

  for (let match = objRegex.exec(text); match !== null; match = objRegex.exec(text)) {
    const id = Number.parseInt(match[1], 10);
    const body = match[3].trim();
    objects.set(id, body);
    if (/\/Type\s*\/Page\b/.test(body) && !/\/Type\s*\/Pages\b/.test(body)) {
      pageObjIds.push(id);
    }
  }

  // Collect the page objects for parentPageIndices
  const selectedPageIds: number[] = [];
  for (const idx of parentPageIndices) {
    const id = pageObjIds[idx - 1];
    if (id === undefined) {
      throw new FacsimileError(
        "PARENT_PAGE_INDEX_MISSING",
        `Parent PDF has ${pageObjIds.length} pages; requested 1-based page ${idx} does not exist.`,
      );
    }
    selectedPageIds.push(id);
  }

  // Find all referenced objects recursively from selected pages
  const collectedIds = new Set<number>();
  function collectReferences(objText: string) {
    const refRegex = /(\d+)\s+(\d+)\s+R/g;
    for (
      let refMatch = refRegex.exec(objText);
      refMatch !== null;
      refMatch = refRegex.exec(objText)
    ) {
      const refId = Number.parseInt(refMatch[1], 10);
      if (!collectedIds.has(refId) && objects.has(refId)) {
        // Skip Catalog and Pages tree objects
        const targetBody = objects.get(refId)!;
        if (/\/Type\s*\/Catalog\b/.test(targetBody) || /\/Type\s*\/Pages\b/.test(targetBody)) {
          continue;
        }
        collectedIds.add(refId);
        collectReferences(targetBody);
      }
    }
  }

  for (const pageId of selectedPageIds) {
    collectReferences(objects.get(pageId)!);
  }

  // Renumber objects deterministically:
  // 1: Catalog
  // 2: Pages
  // 3..: Selected Page objects
  // followed by collected dependency objects
  // followed by Info dictionary
  const idMap = new Map<number, number>();
  let nextId = 3;
  for (const pageId of selectedPageIds) {
    idMap.set(pageId, nextId++);
  }

  const sortedCollected = Array.from(collectedIds)
    .filter((id) => !idMap.has(id))
    .sort((a, b) => a - b);
  for (const id of sortedCollected) {
    idMap.set(id, nextId++);
  }

  const infoId = nextId++;
  const newObjects: Array<{ id: number; body: string }> = [];

  // 1: Catalog
  newObjects.push({
    id: 1,
    body: "<<\n  /Type /Catalog\n  /Pages 2 0 R\n>>",
  });

  // 2: Pages
  const kidsStr = selectedPageIds.map((id) => `${idMap.get(id)} 0 R`).join(" ");
  newObjects.push({
    id: 2,
    body: `<<\n  /Type /Pages\n  /Kids [${kidsStr}]\n  /Count ${selectedPageIds.length}\n>>`,
  });

  // Function to rewrite references according to idMap
  function rewriteReferences(body: string, isPage: boolean): string {
    let rewritten = body.replace(/(\d+)\s+(\d+)\s+R/g, (_, oldId) => {
      const nId = Number.parseInt(oldId, 10);
      return idMap.has(nId) ? `${idMap.get(nId)} 0 R` : `${nId} 0 R`;
    });
    if (isPage) {
      // Set /Parent to 2 0 R
      rewritten = rewritten.replace(/\/Parent\s+\d+\s+\d+\s+R/, "/Parent 2 0 R");
    }
    return rewritten;
  }

  // Add Page objects
  for (const pageId of selectedPageIds) {
    const originalBody = objects.get(pageId)!;
    newObjects.push({
      id: idMap.get(pageId)!,
      body: rewriteReferences(originalBody, true),
    });
  }

  // Add Dependency objects (images, fonts, etc.) preserving exact stream bytes
  for (const id of sortedCollected) {
    const originalBody = objects.get(id)!;
    newObjects.push({
      id: idMap.get(id)!,
      body: rewriteReferences(originalBody, false),
    });
  }

  // Info dictionary: fixed CreationDate and ModDate, NO Producer/Creator
  newObjects.push({
    id: infoId,
    body: `<<\n  /CreationDate (${FIXED_CREATION_DATE})\n  /ModDate (${FIXED_CREATION_DATE})\n>>`,
  });

  // Deterministic document ID derived from parent SHA-256 and page indices
  const docId = createHash("sha256")
    .update(`${parentSha256}:${parentPageIndices.join(",")}`)
    .digest("hex")
    .slice(0, 32);

  // Build PDF buffer
  const header = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  let bodyStr = "";
  const offsets: number[] = [0];
  let currentOffset = Buffer.byteLength(header, "utf8");

  for (let i = 0; i < newObjects.length; i++) {
    offsets.push(currentOffset);
    const objStr = `${newObjects[i].id} 0 obj\n${newObjects[i].body}\nendobj\n`;
    bodyStr += objStr;
    currentOffset += Buffer.byteLength(objStr, "utf8");
  }

  const startXref = currentOffset;
  let xref = `xref\n0 ${newObjects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= newObjects.length; i++) {
    const off = String(offsets[i]).padStart(10, "0");
    xref += `${off} 00000 n \n`;
  }

  const trailer = `trailer\n<<\n  /Size ${newObjects.length + 1}\n  /Root 1 0 R\n  /Info ${infoId} 0 R\n  /ID [ <${docId}> <${docId}> ]\n>>\nstartxref\n${startXref}\n%%EOF\n`;

  return Buffer.concat([
    Buffer.from(header, "utf8"),
    Buffer.from(bodyStr, "latin1"),
    Buffer.from(xref, "utf8"),
    Buffer.from(trailer, "utf8"),
  ]);
}

export function pinFile(
  stagedPath: string,
  destinationPath: string,
  expectedSha256: string,
): { pinned: boolean; action: "pinned" | "noop" } {
  if (fs.existsSync(destinationPath)) {
    const existingSha256 = sha256File(destinationPath);
    if (existingSha256 === expectedSha256) {
      return { pinned: false, action: "noop" };
    }
    throw new FacsimileError(
      "PINNED_DIGEST_CONFLICT",
      `Pinned file conflict at ${destinationPath}: existing digest is ${existingSha256}, incoming is ${expectedSha256}. Refusing to replace pinned file.`,
    );
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const tmpDest = `${destinationPath}.tmp.${Date.now()}`;
  fs.copyFileSync(stagedPath, tmpDest);

  const verifiedDigest = sha256File(tmpDest);
  if (verifiedDigest !== expectedSha256) {
    throw new FacsimileError(
      "PINNED_DIGEST_CONFLICT",
      `Digest mismatch on staged copy: expected ${expectedSha256}, got ${verifiedDigest}`,
    );
  }

  fs.renameSync(tmpDest, destinationPath);
  return { pinned: true, action: "pinned" };
}

export function updatePinnedRecord(configPath: string, pinned: PinnedRecord): void {
  const content = fs.readFileSync(configPath, "utf8");
  const parsed = yaml.load(content) as FacsimileSourceConfig;
  parsed.pinned = pinned;

  const tmpPath = `${configPath}.tmp.${Date.now()}`;
  const serialized = yaml.dump(parsed, { indent: 2, lineWidth: -1 });
  fs.writeFileSync(tmpPath, serialized, "utf8");

  // Verify roundtrip before atomic rename
  const reloaded = yaml.load(fs.readFileSync(tmpPath, "utf8"));
  const validation = validateConfig(reloaded);
  if (!validation.valid) {
    throw new FacsimileError(
      "INVALID_CONFIG",
      `Failed to validate updated config: ${validation.errors.join("; ")}`,
    );
  }

  fs.renameSync(tmpPath, configPath);
}

export function emitReceiptStub(config: FacsimileSourceConfig, logPath: string): string {
  const p = config.pinned;
  const c = config.candidates[p?.candidateIndex ?? 0];
  const stubObj = {
    originUrl: p?.originUrl || c?.url,
    finalUrl: p?.finalUrl || c?.url,
    institution: c?.institution || "Unknown",
    hostItemId: c?.hostItemId || "Unknown",
    hostFileName: c?.hostFileName || path.basename(p?.path || ""),
    hostFileSource: p?.hostFileSource || c?.hostFileSource,
    hostChecksumsVerified: p?.hostChecksumsVerified || [],
    termsStatementUrls: c?.termsStatementUrls || [],
    acquisitionDate: p?.acquisitionDate || new Date().toISOString().slice(0, 10),
    sha256: p?.sha256 || "",
    mimeType: p?.mimeType || "application/pdf",
    pageCount: p?.pageCount || 0,
    parent: p?.parent || null,
    embeddedTextLayer: p?.embeddedTextLayer || "unknown",
    rightsStatus: config.rights.rightsStatus,
    publicationDecision: config.rights.publicationDecision,
    publicationReason: config.rights.publicationReason || null,
    cloudProcessing: config.rights.cloudProcessing,
    cloudProcessingBasis: config.rights.cloudProcessingBasis || null,
    path: p?.path || "",
    downloadLog: logPath,
  };
  return yaml.dump({ scan: stubObj }, { indent: 2, lineWidth: -1 });
}

export function verifyPins(options?: {
  key?: string;
  configDir?: string;
  repoRoot?: string;
  requireLocal?: boolean;
}): {
  results: Record<
    string,
    {
      status: "ok" | "mismatch" | "missing" | "not-available";
      path: string;
      expected?: string;
      actual?: string;
    }
  >;
  allOk: boolean;
} {
  const dir = options?.configDir || getDefaultConfigDir();
  const root = options?.repoRoot || getRepoRoot();
  const requireLocal = options?.requireLocal ?? false;

  const files = options?.key
    ? [`${options.key}.yaml`]
    : fs.readdirSync(dir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  const results: Record<
    string,
    {
      status: "ok" | "mismatch" | "missing" | "not-available";
      path: string;
      expected?: string;
      actual?: string;
    }
  > = {};
  let allOk = true;

  for (const file of files) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) continue;
    const cfg = yaml.load(fs.readFileSync(filePath, "utf8")) as FacsimileSourceConfig;
    const key = cfg.key;
    if (!cfg.pinned) continue;

    const fullPath = path.isAbsolute(cfg.pinned.path)
      ? cfg.pinned.path
      : path.join(root, cfg.pinned.path);
    if (!fs.existsSync(fullPath)) {
      if (cfg.rights.publicationDecision === "publish") {
        results[key] = {
          status: "missing",
          path: cfg.pinned.path,
          expected: cfg.pinned.sha256,
        };
        allOk = false;
      } else {
        // pin-local-only
        results[key] = {
          status: "not-available",
          path: cfg.pinned.path,
          expected: cfg.pinned.sha256,
        };
        if (requireLocal) {
          allOk = false;
        }
      }
    } else {
      const actualSha = sha256File(fullPath);
      if (actualSha === cfg.pinned.sha256) {
        results[key] = {
          status: "ok",
          path: cfg.pinned.path,
          expected: cfg.pinned.sha256,
          actual: actualSha,
        };
      } else {
        results[key] = {
          status: "mismatch",
          path: cfg.pinned.path,
          expected: cfg.pinned.sha256,
          actual: actualSha,
        };
        allOk = false;
      }
    }
  }

  return { results, allOk };
}

export async function restorePin(
  key: string,
  options?: {
    configDir?: string;
    repoRoot?: string;
    stagingDir?: string;
    fetchFn?: typeof fetch;
  },
): Promise<{ restored: boolean; sha256: string }> {
  const cfg = loadConfig(key, options?.configDir);
  if (!cfg.pinned) {
    throw new FacsimileError(
      "INVALID_CONFIG",
      `No pinned record found for key '${key}' to restore.`,
    );
  }

  const root = options?.repoRoot || getRepoRoot();
  const destPath = path.isAbsolute(cfg.pinned.path)
    ? cfg.pinned.path
    : path.join(root, cfg.pinned.path);

  if (fs.existsSync(destPath)) {
    const existingSha = sha256File(destPath);
    if (existingSha === cfg.pinned.sha256) {
      return { restored: false, sha256: existingSha };
    }
  }

  const runId = newToolRunId();
  const stagingBase =
    options?.stagingDir || path.join(root, "artifacts", "facsimile-staging", key, runId);
  fs.mkdirSync(stagingBase, { recursive: true });
  const downloadPath = path.join(stagingBase, "restore-download.pdf");

  const fetchFn = options?.fetchFn || fetch;
  const res = await fetchFn(cfg.pinned.originUrl, { method: "GET" });
  if (res.status !== 200) {
    throw new FacsimileError(
      "HTTP_STATUS",
      `Restore download from ${cfg.pinned.originUrl} returned HTTP ${res.status}`,
    );
  }

  const bytes = await res.arrayBuffer();
  fs.writeFileSync(downloadPath, Buffer.from(bytes));

  const stagedSha = sha256File(downloadPath);
  if (stagedSha !== cfg.pinned.sha256) {
    throw new FacsimileError(
      "RESTORE_DIGEST_MISMATCH",
      `Restored file SHA-256 (${stagedSha}) does not match recorded digest (${cfg.pinned.sha256})`,
    );
  }

  pinFile(downloadPath, destPath, cfg.pinned.sha256);
  return { restored: true, sha256: stagedSha };
}

export async function fetchToStaging(
  url: string,
  stagingPath: string,
  options?: {
    maxBytes?: number;
    userAgent?: string;
    maxRetries?: number;
    fetchFn?: typeof fetch;
  },
): Promise<{
  bytes: number;
  sha256: string;
  md5: string;
  sha1: string;
  httpStatus: number;
  contentType: string;
  finalUrl: string;
  redirects: string[];
}> {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
  const maxRetries = options?.maxRetries ?? 3;
  const fetchFn = options?.fetchFn ?? fetch;

  const redirects: string[] = [];
  let currentUrl = url;
  let attempts = 0;
  let res: Response | null = null;

  while (attempts <= maxRetries) {
    attempts++;

    // Validate URL protocol on initial URL and on every hop
    const parsed = new URL(currentUrl);
    const isLoopback =
      process.env.NODE_ENV === "test" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
    if (parsed.protocol !== "https:" && !isLoopback) {
      if (redirects.length > 0) {
        throw new FacsimileError(
          "REDIRECT_TO_HTTP",
          `Redirect chain diverted to insecure HTTP: ${currentUrl}`,
        );
      }
      throw new FacsimileError("HTTP_NOT_HTTPS", `Candidate URL is not HTTPS: ${currentUrl}`);
    }

    try {
      res = await fetchFn(currentUrl, {
        method: "GET",
        headers: { "User-Agent": userAgent },
        redirect: "manual",
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          throw new FacsimileError(
            "HTTP_STATUS",
            `Redirect HTTP ${res.status} missing Location header`,
          );
        }
        const nextUrl = new URL(location, currentUrl).toString();
        redirects.push(currentUrl);
        currentUrl = nextUrl;
        continue;
      }

      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        if (attempts <= maxRetries) {
          const delay = Math.min(100 * Math.pow(2, attempts - 1), 1000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new FacsimileError(
          "NETWORK_RETRIES_EXHAUSTED",
          `HTTP ${res.status} after ${attempts} retries`,
        );
      }

      if (res.status !== 200) {
        throw new FacsimileError("HTTP_STATUS", `HTTP error ${res.status} fetching ${currentUrl}`);
      }

      break;
    } catch (err: any) {
      if (err instanceof FacsimileError) throw err;
      if (attempts <= maxRetries) {
        const delay = Math.min(100 * Math.pow(2, attempts - 1), 1000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new FacsimileError(
        "NETWORK_RETRIES_EXHAUSTED",
        `Fetch failed after ${attempts} attempts: ${err.message}`,
      );
    }
  }

  if (!res || res.status !== 200) {
    throw new FacsimileError("HTTP_STATUS", `Failed to retrieve 200 OK for ${url}`);
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  fs.mkdirSync(path.dirname(stagingPath), { recursive: true });

  const shaHash = createHash("sha256");
  const md5Hash = createHash("md5");
  const sha1Hash = createHash("sha1");

  const buffer = await res.arrayBuffer();
  const data = Buffer.from(buffer);

  if (data.length > maxBytes) {
    fs.writeFileSync(stagingPath, data.subarray(0, maxBytes));
    throw new FacsimileError(
      "SIZE_LIMIT_EXCEEDED",
      `Download exceeded maximum allowed size of ${maxBytes} bytes (received ${data.length} bytes)`,
    );
  }

  shaHash.update(data);
  md5Hash.update(data);
  sha1Hash.update(data);

  fs.writeFileSync(stagingPath, data);

  return {
    bytes: data.length,
    sha256: shaHash.digest("hex"),
    md5: md5Hash.digest("hex"),
    sha1: sha1Hash.digest("hex"),
    httpStatus: res.status,
    contentType,
    finalUrl: currentUrl,
    redirects,
  };
}

export function writeStructuredLog(
  logPath: string,
  event: {
    suite: "download-facsimiles";
    toolRunId: string;
    key?: string;
    candidateIndex?: number;
    url?: string;
    finalUrl?: string;
    redirects?: string[];
    httpStatus?: number;
    contentType?: string;
    bytes?: number;
    sha256?: string;
    hostChecksumsVerified?: string[];
    pageCount?: number;
    parentSha256?: string;
    parentPageIndices?: number[];
    embeddedTextLayer?: string;
    pdfLibrary?: { name: string; version: string };
    rightsStatus?: string;
    publicationDecision?: string;
    cloudProcessing?: string;
    action: string;
    errorCode?: string;
    exitCode: number;
    message: string;
    durationMs?: number;
  },
): void {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const payload = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  fs.appendFileSync(logPath, JSON.stringify(payload) + "\n", "utf8");
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) {
    console.log(`Usage:
  bun scripts/download-facsimiles.ts --check-config [--config-dir <dir>]
  bun scripts/download-facsimiles.ts --key <key> [--candidate <index>] [--dry-run] [--config-dir <dir>]
  bun scripts/download-facsimiles.ts --verify [--key <key>] [--require-local] [--config-dir <dir>]
  bun scripts/download-facsimiles.ts --restore --key <key> [--config-dir <dir>]`);
    process.exit(0);
  }

  let configDir: string | undefined;
  const configDirIdx = args.indexOf("--config-dir");
  if (configDirIdx !== -1 && args[configDirIdx + 1]) {
    configDir = args[configDirIdx + 1];
  }

  // 1. --check-config mode (quality gates check)
  if (args.includes("--check-config")) {
    console.log("=== Facsimile Scan Configuration Quality Gate ===");
    const { valid, results } = checkAllConfigs(configDir);
    for (const [file, res] of Object.entries(results)) {
      if (res.valid) {
        console.log(`✓ ${file}: valid`);
      } else {
        console.error(`❌ ${file}: INVALID (${res.refusalCode})`);
        for (const err of res.errors) {
          console.error(`    - ${err}`);
        }
      }
    }
    if (!valid) {
      process.exit(3); // INVALID_CONFIG
    }
    console.log("\nAll facsimile source configurations verified valid.");
    process.exit(0);
  }

  // 2. --verify mode
  if (args.includes("--verify")) {
    console.log("=== Facsimile Pin Verification ===");
    let key: string | undefined;
    const keyIdx = args.indexOf("--key");
    if (keyIdx !== -1 && args[keyIdx + 1]) {
      key = args[keyIdx + 1];
    }
    const requireLocal = args.includes("--require-local");
    const { results, allOk } = verifyPins({ key, configDir, requireLocal });
    for (const [k, r] of Object.entries(results)) {
      if (r.status === "ok") {
        console.log(`✓ ${k}: OK (${r.path})`);
      } else if (r.status === "not-available") {
        console.log(`⚠️ ${k}: NOT AVAILABLE (local-only pin at ${r.path})`);
      } else if (r.status === "mismatch") {
        console.error(
          `❌ ${k}: DIGEST MISMATCH at ${r.path} (expected ${r.expected}, got ${r.actual})`,
        );
      } else {
        console.error(`❌ ${k}: MISSING file at ${r.path}`);
      }
    }
    if (!allOk) {
      process.exit(2);
    }
    process.exit(0);
  }

  // 3. --restore mode
  if (args.includes("--restore")) {
    const keyIdx = args.indexOf("--key");
    if (keyIdx === -1 || !args[keyIdx + 1]) {
      console.error("--restore requires --key <key>");
      process.exit(1);
    }
    const key = args[keyIdx + 1];
    try {
      const res = await restorePin(key, { configDir });
      console.log(`Restored pin for ${key}: ${res.sha256}`);
      process.exit(0);
    } catch (e: any) {
      console.error(`Restore failed: ${e.message}`);
      process.exit(e instanceof FacsimileError ? e.exitCode : 1);
    }
  }

  // 4. Download and pin mode
  const keyIdx = args.indexOf("--key");
  if (keyIdx === -1 || !args[keyIdx + 1]) {
    console.error("Missing required --key or mode flag (--check-config, --verify, --restore)");
    process.exit(1);
  }
  const key = args[keyIdx + 1];
  let candidateIndex = 0;
  const candIdx = args.indexOf("--candidate");
  if (candIdx !== -1 && args[candIdx + 1]) {
    candidateIndex = Number.parseInt(args[candIdx + 1], 10);
  }
  const dryRun = args.includes("--dry-run");

  const startTime = Date.now();
  const toolRunId = newToolRunId();
  const root = getRepoRoot();
  const logPath = path.join(root, "artifacts", "facsimile-logs", key, `${toolRunId}.jsonl`);

  let claimPath: string | null = null;
  try {
    const configPath = path.join(configDir || getDefaultConfigDir(), `${key}.yaml`);
    const cfg = loadConfig(configPath);
    const candidate = cfg.candidates[candidateIndex];
    if (!candidate) {
      throw new FacsimileError(
        "INVALID_CONFIG",
        `No candidate found at index ${candidateIndex} for key ${key}`,
      );
    }

    if (dryRun) {
      console.log(
        `[dry-run] Validated config for ${key}, candidate ${candidateIndex}: ${candidate.url}`,
      );
      writeStructuredLog(logPath, {
        suite: "download-facsimiles",
        toolRunId,
        key,
        candidateIndex,
        url: candidate.url,
        action: "noop",
        exitCode: 0,
        message: "Dry run configuration check successful",
      });
      process.exit(0);
    }

    const claimRes = acquireKeyClaim(key, toolRunId);
    claimPath = claimRes.claimPath;

    const stagingDir = path.join(root, "artifacts", "facsimile-staging", key, toolRunId);
    const downloadPath = path.join(stagingDir, "download.pdf");

    console.log(`Fetching candidate ${candidateIndex} (${candidate.url}) to staging...`);
    const fetchRes = await fetchToStaging(candidate.url, downloadPath, {
      maxBytes: candidate.maxBytes,
    });

    const checksumCheck = verifyHostChecksums(candidate.hostChecksums, {
      md5: fetchRes.md5,
      sha1: fetchRes.sha1,
    });
    if (!checksumCheck.ok) {
      throw new FacsimileError(
        "HOST_CHECKSUM_MISMATCH",
        checksumCheck.error || "Host checksum verification failed",
      );
    }

    const fileBuf = fs.readFileSync(downloadPath);
    const valPdf = validatePdf(fileBuf, candidate.expectedPageCountRange);
    if (!valPdf.valid) {
      throw new FacsimileError(
        valPdf.errorCode || "NOT_A_PDF",
        valPdf.message || "PDF validation failed",
      );
    }

    const textLayer = detectEmbeddedTextLayer(fileBuf, cfg.articlePages.parentPageIndices);

    let finalPinBuf = fileBuf;
    let parentInfo: PinnedRecord["parent"] | undefined;

    if (candidate.kind === "whole-volume" || candidate.kind === "whole-issue") {
      if (!cfg.articlePages.parentPageIndices || cfg.articlePages.parentPageIndices.length === 0) {
        throw new FacsimileError(
          "PARENT_PAGE_INDEX_MISSING",
          "Whole-volume/whole-issue candidate requires configured parentPageIndices",
        );
      }

      // Retain parent scan under sources/parents/<parent-sha256>.pdf
      const parentDest = path.join(root, "sources", "parents", `${fetchRes.sha256}.pdf`);
      fs.mkdirSync(path.dirname(parentDest), { recursive: true });
      if (!fs.existsSync(parentDest)) {
        fs.copyFileSync(downloadPath, parentDest);
      }

      parentInfo = {
        sha256: fetchRes.sha256,
        pageCount: valPdf.pageCount,
        path: `sources/parents/${fetchRes.sha256}.pdf`,
        parentPageIndices: cfg.articlePages.parentPageIndices,
      };

      finalPinBuf = extractArticle(fileBuf, cfg.articlePages.parentPageIndices, fetchRes.sha256);
    }

    const finalSha256 = sha256File(finalPinBuf);
    const targetRelPath =
      cfg.rights.publicationDecision === "publish"
        ? `public/papers/pdfs/${key}.pdf`
        : `sources/pinned/${key}.pdf`;
    const targetAbsPath = path.join(root, targetRelPath);

    const extractedStagingPath = path.join(stagingDir, `${key}.pdf`);
    fs.writeFileSync(extractedStagingPath, finalPinBuf);

    const pinRes = pinFile(extractedStagingPath, targetAbsPath, finalSha256);

    const finalVal = validatePdf(finalPinBuf);
    const pinnedRecord: PinnedRecord = {
      path: targetRelPath,
      sha256: finalSha256,
      pageCount: finalVal.pageCount,
      mimeType: "application/pdf",
      acquisitionDate: new Date().toISOString().slice(0, 10),
      originUrl: candidate.url,
      finalUrl: fetchRes.finalUrl,
      candidateIndex,
      hostFileSource: candidate.hostFileSource,
      hostChecksumsVerified: checksumCheck.verified,
      embeddedTextLayer: textLayer,
      parent: parentInfo,
      pdfLibrary: PDF_LIBRARY,
      toolRunId,
    };

    updatePinnedRecord(configPath, pinnedRecord);

    const receiptStub = emitReceiptStub(cfg, logPath);
    const receiptStubPath = path.join(stagingDir, "receipt-stub.yaml");
    fs.writeFileSync(receiptStubPath, receiptStub, "utf8");

    writeStructuredLog(logPath, {
      suite: "download-facsimiles",
      toolRunId,
      key,
      candidateIndex,
      url: candidate.url,
      finalUrl: fetchRes.finalUrl,
      redirects: fetchRes.redirects,
      httpStatus: fetchRes.httpStatus,
      contentType: fetchRes.contentType,
      bytes: finalPinBuf.length,
      sha256: finalSha256,
      hostChecksumsVerified: checksumCheck.verified,
      pageCount: finalVal.pageCount,
      parentSha256: parentInfo?.sha256,
      parentPageIndices: parentInfo?.parentPageIndices,
      embeddedTextLayer: textLayer,
      pdfLibrary: PDF_LIBRARY,
      rightsStatus: cfg.rights.rightsStatus,
      publicationDecision: cfg.rights.publicationDecision,
      cloudProcessing: cfg.rights.cloudProcessing,
      action: pinRes.action,
      exitCode: 0,
      message: `Successfully pinned scan to ${targetRelPath}`,
      durationMs: Date.now() - startTime,
    });

    console.log(
      `\n🎉 Success! Pinned scan for ${key} to ${targetRelPath} (action: ${pinRes.action})`,
    );
    console.log(`SHA-256: ${finalSha256}`);
    console.log(`Receipt stub written to ${receiptStubPath}`);
    process.exit(0);
  } catch (err: any) {
    const exitCode = err instanceof FacsimileError ? err.exitCode : 1;
    const errorCode = err instanceof FacsimileError ? err.code : "UNEXPECTED_ERROR";
    console.error(`\n❌ Pinning failed (${errorCode}): ${err.message}`);

    writeStructuredLog(logPath, {
      suite: "download-facsimiles",
      toolRunId,
      key,
      candidateIndex,
      action: "refused",
      errorCode,
      exitCode,
      message: err.message,
      durationMs: Date.now() - startTime,
    });

    process.exit(exitCode);
  } finally {
    if (claimPath) {
      releaseKeyClaim(claimPath);
    }
  }
}

const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
