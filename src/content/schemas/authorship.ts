/**
 * Authorship attribution block schema and contributor validation.
 * Specification: docs/OWNERS.md and am-cm-schemas-source-1en
 */

export type AuthorshipKind = "human" | "model";

export type AuthorshipEntry = Readonly<{
  id: string;
  name?: string | undefined;
  kind: AuthorshipKind;
  modelId?: string | undefined;
}>;

export type AuthorshipBlock = Readonly<{
  draftedBy: readonly AuthorshipEntry[];
  translatedBy?: readonly AuthorshipEntry[] | undefined;
  editedBy?: readonly AuthorshipEntry[] | undefined;
}>;

export class AuthorshipValidationError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path = "authorship") {
    super(`${path}: ${message} (${code})`);
    this.name = "AuthorshipValidationError";
    this.code = code;
    this.path = path;
  }
}

export function validateAuthorshipEntry(
  raw: unknown,
  roleContext?: "reviewer" | "facilitator" | "tester" | "author" | "translator" | "editor",
  path = "authorshipEntry"
): AuthorshipEntry {
  if (!raw || typeof raw !== "object") {
    throw new AuthorshipValidationError("invalid-authorship-entry", "Authorship entry must be an object.", path);
  }

  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new AuthorshipValidationError("missing-contributor-id", "Contributor id is required.", `${path}.id`);
  }

  const id = o.id.trim();

  if (id.startsWith("model:")) {
    throw new AuthorshipValidationError(
      "invalid-model-prefix",
      `Contributor id "${id}" must not start with "model:". Use kind: "model" and modelId instead.`,
      `${path}.id`
    );
  }

  if (o.kind !== "human" && o.kind !== "model") {
    throw new AuthorshipValidationError(
      "invalid-authorship-kind",
      `Invalid authorship kind "${o.kind}". Expected "human" or "model".`,
      `${path}.kind`
    );
  }

  const kind = o.kind as AuthorshipKind;

  if (kind === "model") {
    if (typeof o.modelId !== "string" || !o.modelId.trim()) {
      throw new AuthorshipValidationError(
        "missing-model-id",
        `Model authorship entry for id "${id}" requires a non-empty modelId.`,
        `${path}.modelId`
      );
    }
  }

  // Reject agent id as reviewer/facilitator/tester
  const isAgent = id.startsWith("agent:") || kind === "model";
  if (isAgent && (roleContext === "reviewer" || roleContext === "facilitator" || roleContext === "tester")) {
    throw new AuthorshipValidationError(
      "agent-as-reviewer",
      `Agent id "${id}" cannot serve as a ${roleContext}. Review roles require independent human evaluation.`,
      `${path}.id`
    );
  }

  return {
    id,
    ...(typeof o.name === "string" ? { name: o.name } : {}),
    kind,
    ...(typeof o.modelId === "string" ? { modelId: o.modelId } : {}),
  };
}

export function validateAuthorshipBlock(
  raw: unknown,
  path = "authorship"
): AuthorshipBlock {
  if (!raw || typeof raw !== "object") {
    throw new AuthorshipValidationError("invalid-authorship-block", "Authorship block must be an object.", path);
  }

  const o = raw as Record<string, unknown>;

  if (!Array.isArray(o.draftedBy) || o.draftedBy.length === 0) {
    throw new AuthorshipValidationError("missing-drafted-by", "Authorship block must contain at least one draftedBy entry.", `${path}.draftedBy`);
  }

  const draftedBy = o.draftedBy.map((e, i) => validateAuthorshipEntry(e, "author", `${path}.draftedBy[${i}]`));
  const translatedBy = Array.isArray(o.translatedBy)
    ? o.translatedBy.map((e, i) => validateAuthorshipEntry(e, "translator", `${path}.translatedBy[${i}]`))
    : undefined;
  const editedBy = Array.isArray(o.editedBy)
    ? o.editedBy.map((e, i) => validateAuthorshipEntry(e, "editor", `${path}.editedBy[${i}]`))
    : undefined;

  return {
    draftedBy,
    ...(translatedBy ? { translatedBy } : {}),
    ...(editedBy ? { editedBy } : {}),
  };
}

/**
 * Derives canonical AuthorshipBlock from source entity records.
 */
export function authorshipOf(record: any): AuthorshipBlock {
  if (!record || typeof record !== "object") {
    throw new AuthorshipValidationError("invalid-record", "Cannot derive authorship from non-object.");
  }

  if (record.authorship) {
    return validateAuthorshipBlock(record.authorship);
  }

  // TranslationUnit mapping
  if (record.translator) {
    const translatorEntry = validateAuthorshipEntry(record.translator, "translator");
    const editorEntry = record.editor ? validateAuthorshipEntry(record.editor, "editor") : undefined;
    return {
      draftedBy: [translatorEntry],
      translatedBy: [translatorEntry],
      ...(editorEntry ? { editedBy: [editorEntry] } : {}),
    };
  }

  // EditorialNote mapping
  if (record.author) {
    const authorEntry = validateAuthorshipEntry(record.author, "author");
    return {
      draftedBy: [authorEntry],
    };
  }

  // GlossUnit mapping
  if (record.attribution) {
    const glossatorEntry = validateAuthorshipEntry(record.attribution, "author");
    const editorEntry = record.editor ? validateAuthorshipEntry(record.editor, "editor") : undefined;
    return {
      draftedBy: [glossatorEntry],
      ...(editorEntry ? { editedBy: [editorEntry] } : {}),
    };
  }

  throw new AuthorshipValidationError("unrecognized-record", "Record does not carry recognized authorship fields.");
}
