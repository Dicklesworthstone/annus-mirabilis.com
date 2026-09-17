export interface HarHeader {
  name: string;
  value: string;
}

export interface HarEntry {
  request: {
    url: string;
    method?: string;
  };
  response: {
    status: number;
    headers: readonly HarHeader[];
    content: {
      size: number;
      mimeType?: string;
      encoding?: string;
    };
    bodySize: number;
    _transferSize?: number;
  };
}

export interface HarLog {
  log: {
    entries: readonly HarEntry[];
  };
}

export interface TransferredBytesAnalysis {
  totalTransferBytes: number;
  scriptTransferBytes: number;
  cachedEntriesCount: number;
  transferredEntriesCount: number;
  encodings: readonly string[];
}

export function isScriptResource(url: string, mimeType?: string): boolean {
  if (mimeType) {
    const lower = mimeType.toLowerCase();
    if (
      lower.includes("javascript") ||
      lower.includes("ecmascript") ||
      lower === "application/x-javascript" ||
      lower === "text/javascript"
    ) {
      return true;
    }
  }
  const [withoutQuery = ""] = url.split("?");
  const [cleanUrl = ""] = withoutQuery.split("#");
  return cleanUrl.endsWith(".js") || cleanUrl.endsWith(".mjs");
}

export function getHeaderValue(headers: readonly HarHeader[], name: string): string | undefined {
  const target = name.toLowerCase();
  for (const h of headers) {
    if (h.name.toLowerCase() === target) {
      return h.value;
    }
  }
  return undefined;
}

/**
 * Analyzes transferred bytes from a HAR log:
 * - Excludes cached entries (HTTP 304, transferSize === 0, or bodySize === 0 with fromDiskCache/memoryCache).
 * - Separates script transfer bytes from total transfer bytes.
 * - Collects and records content encodings observed (e.g. gzip, br).
 */
export function analyzeTransferredBytes(har: HarLog): TransferredBytesAnalysis {
  let totalTransferBytes = 0;
  let scriptTransferBytes = 0;
  let cachedEntriesCount = 0;
  let transferredEntriesCount = 0;
  const encodingsSet = new Set<string>();

  for (const entry of har.log.entries) {
    const status = entry.response.status;
    const transferSize =
      entry.response._transferSize !== undefined
        ? entry.response._transferSize
        : entry.response.bodySize >= 0
          ? entry.response.bodySize
          : entry.response.content.size;

    // HTTP 304 Not Modified or zero transferred size indicates cache hit
    const isCached = status === 304 || transferSize <= 0;

    if (isCached) {
      cachedEntriesCount++;
      continue;
    }

    transferredEntriesCount++;
    totalTransferBytes += transferSize;

    const encodingHeader = getHeaderValue(entry.response.headers, "content-encoding");
    if (encodingHeader) {
      encodingsSet.add(encodingHeader.trim().toLowerCase());
    }

    const isScript = isScriptResource(entry.request.url, entry.response.content.mimeType);
    if (isScript) {
      scriptTransferBytes += transferSize;
    }
  }

  return {
    totalTransferBytes,
    scriptTransferBytes,
    cachedEntriesCount,
    transferredEntriesCount,
    encodings: Array.from(encodingsSet).sort(),
  };
}
