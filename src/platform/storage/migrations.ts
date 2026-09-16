/**
 * Forward migrations for one document namespace. A migration upgrades exactly one schema
 * version; the chain applies them in sequence until the document reaches `currentVersion`. An
 * unknown or future version, or a migration that does not land on the next version, is reported
 * as unmigratable so the caller can quarantine the raw value instead of guessing at its shape.
 */

export type Migration = (
  doc: Readonly<Record<string, unknown>>,
) => Readonly<Record<string, unknown>>;

export interface MigrationChain {
  readonly currentVersion: number;
  readonly migrations: ReadonlyMap<number, Migration>;
}

export class UnmigratableVersionError extends Error {
  readonly foundVersion: unknown;
  constructor(message: string, foundVersion: unknown) {
    super(message);
    this.name = "UnmigratableVersionError";
    this.foundVersion = foundVersion;
  }
}

/**
 * `migrations` is keyed by the version a migration upgrades *from* (so key `1` holds the
 * function that turns a v1 document into a v2 document).
 */
export function createMigrationChain(
  currentVersion: number,
  migrations: Readonly<Record<number, Migration>> = {},
): MigrationChain {
  if (!Number.isInteger(currentVersion) || currentVersion < 1)
    throw new TypeError("currentVersion must be a positive integer.");
  return Object.freeze({
    currentVersion,
    migrations: new Map(Object.entries(migrations).map(([k, v]) => [Number(k), v])),
  });
}

function schemaVersionOf(doc: unknown): number {
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    throw new UnmigratableVersionError("Document is not a JSON object.", doc);
  }
  const version = (doc as Record<string, unknown>).schemaVersion;
  if (!Number.isInteger(version))
    throw new UnmigratableVersionError("Document has no integer schemaVersion.", version);
  return version as number;
}

/** Migrates `raw` to `chain.currentVersion`, or throws `UnmigratableVersionError`. */
export function migrateDocument<T>(chain: MigrationChain, raw: unknown): T {
  let version = schemaVersionOf(raw);
  if (version > chain.currentVersion) {
    throw new UnmigratableVersionError(
      `schemaVersion ${version} is newer than the known version ${chain.currentVersion}.`,
      version,
    );
  }
  let doc = raw as Readonly<Record<string, unknown>>;
  while (version < chain.currentVersion) {
    const migrate = chain.migrations.get(version);
    if (!migrate)
      throw new UnmigratableVersionError(
        `No migration is registered from schemaVersion ${version}.`,
        version,
      );
    const migrated = migrate(doc);
    const nextVersion = schemaVersionOf(migrated);
    if (nextVersion !== version + 1) {
      throw new UnmigratableVersionError(
        `The migration from schemaVersion ${version} produced schemaVersion ${nextVersion}, not ${version + 1}.`,
        nextVersion,
      );
    }
    doc = migrated;
    version = nextVersion;
  }
  return doc as unknown as T;
}
