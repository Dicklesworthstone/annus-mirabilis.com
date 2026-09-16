/**
 * Span anchor schema and text digest calculation for sentence and alignment spans.
 * Specification: AGENTS.md and am-cm-schemas-source-1en
 */

import crypto from "node:crypto";
import { codePointLength } from "./inlines.ts";

export type SpanAnchor = Readonly<{
  start: number;
  end: number;
  blockRevision: number;
  textDigest: string;
}>;

export class SpanValidationError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path = "span") {
    super(`${path}: ${message} (${code})`);
    this.name = "SpanValidationError";
    this.code = code;
    this.path = path;
  }
}

/**
 * Computes canonical SHA-256 digest over NFC-normalized plain text.
 */
export function spanTextDigest(text: string): string {
  const normalized = text.normalize("NFC");
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function validateSpanAnchor(
  raw: unknown,
  plainText: string,
  currentBlockRevision: number,
  path = "span",
): SpanAnchor {
  if (!raw || typeof raw !== "object") {
    throw new SpanValidationError("invalid-span", "Span must be an object.", path);
  }

  const o = raw as Record<string, unknown>;

  if (typeof o.start !== "number" || o.start < 0 || !Number.isInteger(o.start)) {
    throw new SpanValidationError(
      "invalid-span-start",
      "Span start must be a non-negative integer.",
      `${path}.start`,
    );
  }
  if (typeof o.end !== "number" || o.end <= o.start || !Number.isInteger(o.end)) {
    throw new SpanValidationError(
      "invalid-span-end",
      `Span end (${o.end}) must be an integer greater than start (${o.start}).`,
      `${path}.end`,
    );
  }

  const textLen = codePointLength(plainText);
  if (o.end > textLen) {
    throw new SpanValidationError(
      "span-out-of-bounds",
      `Span end (${o.end}) exceeds text length (${textLen} code points).`,
      `${path}.end`,
    );
  }

  const revision =
    typeof o.blockRevision === "number"
      ? o.blockRevision
      : typeof o.sourceRevision === "number"
        ? o.sourceRevision
        : undefined;

  if (typeof revision !== "number" || revision <= 0 || !Number.isInteger(revision)) {
    throw new SpanValidationError(
      "invalid-span-revision",
      "Span blockRevision must be a positive integer.",
      `${path}.blockRevision`,
    );
  }

  if (revision < currentBlockRevision) {
    throw new SpanValidationError(
      "span-revision-stale",
      `Span blockRevision (${revision}) is stale compared to block revision (${currentBlockRevision}).`,
      `${path}.blockRevision`,
    );
  }
  if (revision > currentBlockRevision) {
    throw new SpanValidationError(
      "span-revision-future",
      `Span blockRevision (${revision}) is ahead of current block revision (${currentBlockRevision}).`,
      `${path}.blockRevision`,
    );
  }

  const expectedDigest = spanTextDigest(plainText);
  if (typeof o.textDigest !== "string" || o.textDigest !== expectedDigest) {
    throw new SpanValidationError(
      "span-digest-mismatch",
      `Span textDigest (${o.textDigest}) does not match computed digest of plain text (${expectedDigest}).`,
      `${path}.textDigest`,
    );
  }

  return {
    start: o.start as number,
    end: o.end as number,
    blockRevision: revision,
    textDigest: o.textDigest as string,
  };
}
