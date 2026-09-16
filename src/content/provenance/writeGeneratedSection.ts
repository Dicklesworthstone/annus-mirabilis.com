/**
 * Safe updater for generated sections in provenance receipt markdown files.
 * Replaces ONLY the text between <!-- generated:<sectionId>:start --> and <!-- generated:<sectionId>:end -->.
 * Refuses if markers are missing, duplicated, or malformed, and guarantees atomic file replacement.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class GeneratedSectionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GeneratedSectionError";
    this.code = code;
  }
}

export function replaceGeneratedContent(
  originalText: string,
  sectionId: string,
  newContent: string
): { updatedText: string; prefixSha256: string; suffixSha256: string } {
  const startMarker = `<!-- generated:${sectionId}:start -->`;
  const endMarker = `<!-- generated:${sectionId}:end -->`;

  const startIndices: number[] = [];
  let pos = 0;
  while ((pos = originalText.indexOf(startMarker, pos)) !== -1) {
    startIndices.push(pos);
    pos += startMarker.length;
  }

  const endIndices: number[] = [];
  pos = 0;
  while ((pos = originalText.indexOf(endMarker, pos)) !== -1) {
    endIndices.push(pos);
    pos += endMarker.length;
  }

  if (startIndices.length === 0) {
    throw new GeneratedSectionError(
      "missing-start-marker",
      `Missing start marker "${startMarker}" in receipt file.`
    );
  }
  if (startIndices.length > 1) {
    throw new GeneratedSectionError(
      "duplicate-start-marker",
      `Duplicate start marker "${startMarker}" found (${startIndices.length} occurrences).`
    );
  }
  if (endIndices.length === 0) {
    throw new GeneratedSectionError(
      "missing-end-marker",
      `Missing end marker "${endMarker}" in receipt file.`
    );
  }
  if (endIndices.length > 1) {
    throw new GeneratedSectionError(
      "duplicate-end-marker",
      `Duplicate end marker "${endMarker}" found (${endIndices.length} occurrences).`
    );
  }

  const startPos = startIndices[0]!;
  const endPos = endIndices[0]!;

  if (startPos > endPos) {
    throw new GeneratedSectionError(
      "unbalanced-markers",
      `Start marker appears after end marker for section "${sectionId}".`
    );
  }

  const prefix = originalText.slice(0, startPos + startMarker.length);
  const suffix = originalText.slice(endPos);

  const prefixSha256 = crypto.createHash("sha256").update(prefix).digest("hex");
  const suffixSha256 = crypto.createHash("sha256").update(suffix).digest("hex");

  // Format new content with surrounding newlines if non-empty
  const formattedContent = newContent.trim() ? `\n${newContent.trim()}\n` : "\n";
  const updatedText = prefix + formattedContent + suffix;

  return { updatedText, prefixSha256, suffixSha256 };
}

export function writeGeneratedSectionSync(
  filePath: string,
  sectionId: string,
  content: string
): { prefixSha256: string; suffixSha256: string } {
  if (!fs.existsSync(filePath)) {
    throw new GeneratedSectionError("file-not-found", `Target file not found: ${filePath}`);
  }

  const original = fs.readFileSync(filePath, "utf8");
  const { updatedText, prefixSha256, suffixSha256 } = replaceGeneratedContent(
    original,
    sectionId,
    content
  );

  const dir = path.dirname(filePath);
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${randomSuffix}.tmp`);

  fs.writeFileSync(tempPath, updatedText, "utf8");
  fs.renameSync(tempPath, filePath);

  return { prefixSha256, suffixSha256 };
}

export async function writeGeneratedSection(
  filePath: string,
  sectionId: string,
  content: string
): Promise<{ prefixSha256: string; suffixSha256: string }> {
  return writeGeneratedSectionSync(filePath, sectionId, content);
}
