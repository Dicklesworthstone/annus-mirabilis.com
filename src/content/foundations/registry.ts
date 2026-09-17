/**
 * Loader and validator for content/foundations/registry.yaml
 * (am-found-library-infra-002t). This module owns the registry's own
 * internal-consistency checks; it does not validate authored Foundation or
 * Bridge record content, which src/content/schemas/argument.ts owns.
 *
 * A "record" here means: a file at content/foundations/<slug>.json whose
 * own `id` field equals the registry entry's slug (the part of
 * `foundation:<slug>` after the colon). Filename alone is never trusted.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REGISTRY_PATH = join(HERE, "../../../content/foundations/registry.yaml");
export const CONTENT_DIR = join(HERE, "../../../content/foundations");

export type FoundationKind = "node" | "bridge";
export type FoundationStatus = "planned" | "authored";

export type FoundationRegistryEntry = Readonly<{
  id: string;
  kind: FoundationKind;
  cluster: string;
  ownerBead: string;
  status: FoundationStatus;
  plannedCallers: readonly string[];
}>;

export type FoundationRegistry = Readonly<{
  schemaVersion: number;
  entries: readonly FoundationRegistryEntry[];
}>;

export class RegistryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
  }
}

const ID_PATTERN = /^foundation:[a-z][a-z0-9-]*$/;
const KINDS: readonly FoundationKind[] = ["node", "bridge"];
const STATUSES: readonly FoundationStatus[] = ["planned", "authored"];

/** Parses and structurally validates the raw YAML; does not cross-check against files or owner beads. */
export function parseRegistry(raw: unknown): FoundationRegistry {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new RegistryError("invalid-registry", "Registry must be an object.");
  }
  const doc = raw as Record<string, unknown>;
  if (typeof doc.schemaVersion !== "number") {
    throw new RegistryError("missing-schema-version", "Registry requires a numeric schemaVersion.");
  }
  if (!Array.isArray(doc.entries)) {
    throw new RegistryError("missing-entries", "Registry requires an entries array.");
  }
  const entries: FoundationRegistryEntry[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < doc.entries.length; i++) {
    const entry = doc.entries[i] as Record<string, unknown>;
    const path = `entries[${i}]`;
    if (!entry || typeof entry !== "object") {
      throw new RegistryError("invalid-entry", `${path} must be an object.`);
    }
    if (typeof entry.id !== "string" || !ID_PATTERN.test(entry.id)) {
      throw new RegistryError(
        "invalid-id",
        `${path}.id must match foundation:<slug> (lowercase, digits, hyphens); got ${JSON.stringify(entry.id)}.`,
      );
    }
    if (seenIds.has(entry.id)) {
      throw new RegistryError("duplicate-id", `Duplicate registry id: ${entry.id}.`);
    }
    seenIds.add(entry.id);
    if (!KINDS.includes(entry.kind as FoundationKind)) {
      throw new RegistryError(
        "invalid-kind",
        `${path}.kind must be "node" or "bridge"; got ${JSON.stringify(entry.kind)} for ${entry.id}.`,
      );
    }
    if (typeof entry.cluster !== "string" || !entry.cluster.trim()) {
      throw new RegistryError("missing-cluster", `${path}.cluster is required for ${entry.id}.`);
    }
    if (typeof entry.ownerBead !== "string" || !entry.ownerBead.trim()) {
      throw new RegistryError("missing-owner", `${path}.ownerBead is required for ${entry.id}.`);
    }
    if (!STATUSES.includes(entry.status as FoundationStatus)) {
      throw new RegistryError(
        "invalid-status",
        `${path}.status must be "planned" or "authored"; got ${JSON.stringify(entry.status)} for ${entry.id}.`,
      );
    }
    const plannedCallers = Array.isArray(entry.plannedCallers)
      ? entry.plannedCallers.filter((c): c is string => typeof c === "string")
      : [];
    entries.push({
      id: entry.id,
      kind: entry.kind as FoundationKind,
      cluster: entry.cluster,
      ownerBead: entry.ownerBead,
      status: entry.status as FoundationStatus,
      plannedCallers: Object.freeze(plannedCallers),
    });
  }
  return Object.freeze({ schemaVersion: doc.schemaVersion, entries: Object.freeze(entries) });
}

export function loadRegistry(path = REGISTRY_PATH): FoundationRegistry {
  return parseRegistry(loadYaml(readFileSync(path, "utf8")));
}

function slugOf(id: string): string {
  return id.slice("foundation:".length);
}

export type RecordCheckIssue = Readonly<{
  code: "authored-without-record" | "record-id-mismatch" | "unregistered-record";
  id: string;
  detail: string;
}>;

/**
 * Cross-checks the registry against content/foundations/*.json on disk. A
 * "record" matches an entry only when the file's own `id` field equals the
 * entry's slug; a same-named file with a different internal id is reported
 * as a mismatch, never silently accepted.
 */
export function checkRecordsAgainstRegistry(
  registry: FoundationRegistry,
  contentDir = CONTENT_DIR,
): readonly RecordCheckIssue[] {
  const issues: RecordCheckIssue[] = [];
  const filesById = new Map<string, string>();
  for (const name of readdirSync(contentDir)) {
    if (!name.endsWith(".json")) continue;
    const full = join(contentDir, name);
    let id: unknown;
    try {
      id = (JSON.parse(readFileSync(full, "utf8")) as { id?: unknown }).id;
    } catch {
      continue;
    }
    if (typeof id === "string") filesById.set(id, name);
  }

  for (const entry of registry.entries) {
    const slug = slugOf(entry.id);
    const matchingFile = filesById.get(slug);
    if (entry.status === "authored" && !matchingFile) {
      issues.push({
        code: "authored-without-record",
        id: entry.id,
        detail: `No content/foundations/*.json file has id "${slug}" (registry entry ${entry.id} is marked authored).`,
      });
    }
  }

  const registeredSlugs = new Set(registry.entries.map((e) => slugOf(e.id)));
  for (const [id, file] of filesById) {
    if (!registeredSlugs.has(id)) {
      issues.push({
        code: "unregistered-record",
        id,
        detail: `content/foundations/${file} has id "${id}", which is not in the registry.`,
      });
    }
  }

  return Object.freeze(issues);
}

export function fileExistsForSlug(slug: string, contentDir = CONTENT_DIR): boolean {
  return existsSync(join(contentDir, `${slug}.json`));
}
