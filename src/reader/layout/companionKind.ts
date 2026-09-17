export const COMPANION_KINDS = ["original", "explanation", "equation", "laboratory"] as const;
export type CompanionKind = (typeof COMPANION_KINDS)[number];

export class CompanionKindError extends Error {
  readonly code = "unknown-companion-kind" as const;
  readonly raw: string;
  constructor(raw: string) {
    super(`Unknown companion kind "${raw}". Use original, explanation, equation, or laboratory.`);
    this.name = "CompanionKindError";
    this.raw = raw;
  }
}

export function isCompanionKind(value: string): value is CompanionKind {
  return (COMPANION_KINDS as readonly string[]).includes(value);
}

/** Blank or omitted query falls back to explanation. Unknown values refuse by typed code. */
export function resolveCompanionKind(raw: string | undefined): CompanionKind {
  if (raw === undefined || raw.trim() === "") return "explanation";
  const value = raw.trim();
  if (isCompanionKind(value)) return value;
  throw new CompanionKindError(value);
}
