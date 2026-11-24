import { createMigrationChain, migrateDocument } from "../../../platform/storage/migrations.ts";
import {
  NOTEBOOK_SCHEMA_VERSION,
  type NotebookDocument,
  parseNotebookDocument,
} from "../schema.ts";

const fields = ["format", "schemaVersion", "entries", "lastPlace"];

export class NotebookMigrationError extends TypeError {
  readonly code:
    | "notebook-migration-envelope"
    | "notebook-migration-version"
    | "notebook-migration-entry";
  constructor(code: NotebookMigrationError["code"], message: string) {
    super(message);
    this.name = "NotebookMigrationError";
    this.code = code;
  }
}

function envelope(input: unknown): Readonly<Record<string, unknown>> {
  if (
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
    Reflect.ownKeys(input).length !== fields.length ||
    fields.some(
      (field) => !Object.hasOwn(Object.getOwnPropertyDescriptor(input, field) ?? {}, "value"),
    )
  )
    throw new NotebookMigrationError(
      "notebook-migration-envelope",
      "Unknown or missing notebook fields. The saved original is preserved.",
    );
  return input as Readonly<Record<string, unknown>>;
}

/** A format upgrade only: existing ids, wording, timestamps, frames and last place are unchanged. */
export function migrateTeachBackNotebook(input: Readonly<Record<string, unknown>>) {
  const document = envelope(input);
  if (document.schemaVersion !== 1 || !Array.isArray(document.entries))
    throw new NotebookMigrationError(
      "notebook-migration-version",
      "This is not a version 1 reading notebook.",
    );
  for (let index = 0; index < document.entries.length; index++) {
    const item = Object.getOwnPropertyDescriptor(document.entries, index);
    if (
      !item ||
      !Object.hasOwn(item, "value") ||
      ["teachBack", "exercise", "recording"].includes(
        Object.getOwnPropertyDescriptor(item.value ?? {}, "kind")?.value,
      )
    )
      throw new NotebookMigrationError(
        "notebook-migration-entry",
        "Version 1 notebooks cannot contain saved teach-back, exercise or recording entries.",
      );
  }
  const checked = parseNotebookDocument({ ...document, schemaVersion: NOTEBOOK_SCHEMA_VERSION });
  return Object.freeze({ ...checked, schemaVersion: 2 });
}

/** Version 2 gains typed exercise responses without changing any existing entry. */
export function migrateExerciseNotebook(input: Readonly<Record<string, unknown>>) {
  const document = envelope(input);
  if (document.schemaVersion !== 2 || !Array.isArray(document.entries))
    throw new NotebookMigrationError(
      "notebook-migration-version",
      "This is not a version 2 reading notebook.",
    );
  for (let index = 0; index < document.entries.length; index++) {
    const item = Object.getOwnPropertyDescriptor(document.entries, index);
    if (
      !item ||
      !Object.hasOwn(item, "value") ||
      ["exercise", "recording"].includes(
        Object.getOwnPropertyDescriptor(item.value ?? {}, "kind")?.value,
      )
    )
      throw new NotebookMigrationError(
        "notebook-migration-entry",
        "Version 2 notebooks cannot contain saved exercise or recording entries.",
      );
  }
  const checked = parseNotebookDocument({ ...document, schemaVersion: NOTEBOOK_SCHEMA_VERSION });
  return Object.freeze({ ...checked, schemaVersion: 3 });
}

/** Version 3 gains ordinary experiment recordings; existing reader work remains unchanged. */
export function migrateRecordingNotebook(input: Readonly<Record<string, unknown>>) {
  const document = envelope(input);
  if (document.schemaVersion !== 3 || !Array.isArray(document.entries))
    throw new NotebookMigrationError(
      "notebook-migration-version",
      "This is not a version 3 reading notebook.",
    );
  for (let index = 0; index < document.entries.length; index++) {
    const item = Object.getOwnPropertyDescriptor(document.entries, index);
    if (
      !item ||
      !Object.hasOwn(item, "value") ||
      Object.getOwnPropertyDescriptor(item.value ?? {}, "kind")?.value === "recording"
    )
      throw new NotebookMigrationError(
        "notebook-migration-entry",
        "Version 3 notebooks cannot contain saved recording entries.",
      );
  }
  return parseNotebookDocument({ ...document, schemaVersion: NOTEBOOK_SCHEMA_VERSION });
}

const migrations = createMigrationChain(NOTEBOOK_SCHEMA_VERSION, {
  1: migrateTeachBackNotebook,
  2: migrateExerciseNotebook,
  3: migrateRecordingNotebook,
});

/** Used by storage and file import; opening an older notebook does not itself write anything. */
export function readNotebookDocument(input: unknown): NotebookDocument {
  return parseNotebookDocument(migrateDocument(migrations, envelope(input)));
}
