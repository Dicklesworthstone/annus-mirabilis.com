/**
 * Scans rendered HTML / text for forbidden scan furniture, ledger markers,
 * and OCR chunk boundaries (acceptance criterion for am-read-bilingual-faces-pao).
 */

export const FORBIDDEN_SCAN_FURNITURE_PATTERNS = [
  /\[BEGIN_CHUNK\]/i,
  /\[END_CHUNK\]/i,
  /\[CHUNK_\d+\]/i,
  /OCR_PAGE_MARKER/i,
  /<<<PAGE_BREAK>>>/i,
  /__SCAN_FURNITURE__/i,
  /\[DIPLOMATIC_DEBUG\]/i,
  /\[RAW_OCR\]/i,
  /\[LEDGER_MARKER\]/i,
  /\[PAGE_\d+_HEADER\]/i,
  /<<<RUNNING_HEAD>>>/i,
] as const;

export interface ScanFurnitureCheckResult {
  readonly ok: boolean;
  readonly violations: readonly string[];
}

/**
 * Checks a string of rendered HTML or text to ensure no scan furniture appears.
 */
export function checkNoScanFurniture(content: string): ScanFurnitureCheckResult {
  const violations: string[] = [];

  for (const pattern of FORBIDDEN_SCAN_FURNITURE_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      violations.push(
        `Found forbidden scan furniture matching ${pattern.toString()}: "${match[0]}"`,
      );
    }
  }

  return Object.freeze({
    ok: violations.length === 0,
    violations: Object.freeze(violations),
  });
}
