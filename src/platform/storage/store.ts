/**
 * Failure-tolerant reads and writes over a `Storage`-shaped backend (real
 * `window.localStorage`, or an injected in-memory double in tests). Saving
 * may fail; reading continues. No call throws into rendering code except the
 * documented development/test refusal for an unregistered key.
 */

import type { KeyRegistry, SettingRegistration } from "./keys.ts";
import { storageKeyRegistry } from "./keys.ts";
import { type MigrationChain, migrateDocument, UnmigratableVersionError } from "./migrations.ts";
import { quarantine } from "./quarantine.ts";

export type ReadStatus = "ok" | "missing" | "unavailable" | "corrupt";
export type WriteStatus = "ok" | "unavailable" | "quota" | "unregistered";

export interface ReadResult<T = string> {
  readonly status: ReadStatus;
  readonly value?: T;
}

export interface WriteResult {
  readonly status: WriteStatus;
}

/** Development and test builds throw on a write to an unregistered key; production refuses it. */
function isDevOrTest(): boolean {
  return process.env.NODE_ENV !== "production";
}

function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22)
  );
}

/** Probes that a `Storage` accessor and a basic read actually work before trusting it. */
function probe(getStorage: () => Storage): Storage | null {
  try {
    const storage = getStorage();
    void storage.length;
    return storage;
  } catch {
    return null;
  }
}

export interface StorageContext {
  readonly registry: KeyRegistry;
  readonly backend: () => Storage | null;
  /** Session-only fallback, keyed by raw storage key, used while storage is unavailable. */
  readonly fallback: Map<string, string>;
}

export interface CreateStorageContextOptions {
  readonly registry?: KeyRegistry;
  readonly getStorage?: () => Storage;
}

export function createStorageContext(options: CreateStorageContextOptions = {}): StorageContext {
  const getStorage = options.getStorage ?? (() => window.localStorage);
  return {
    registry: options.registry ?? storageKeyRegistry,
    backend: () => probe(getStorage),
    fallback: new Map<string, string>(),
  };
}

function fallbackOr(
  ctx: StorageContext,
  key: string,
  statusIfMissing: "missing" | "unavailable",
): ReadResult {
  const fallbackValue = ctx.fallback.get(key);
  return fallbackValue !== undefined
    ? { status: "ok", value: fallbackValue }
    : { status: statusIfMissing };
}

/** Raw string read: the layer beneath settings and documents. */
export function readRaw(ctx: StorageContext, key: string): ReadResult {
  const storage = ctx.backend();
  if (!storage) return fallbackOr(ctx, key, "unavailable");
  try {
    const raw = storage.getItem(key);
    // The fallback may still hold a value written while storage was unavailable earlier this
    // session; prefer real storage's authoritative "missing" only when the fallback agrees.
    if (raw === null) return fallbackOr(ctx, key, "missing");
    return { status: "ok", value: raw };
  } catch {
    return fallbackOr(ctx, key, "unavailable");
  }
}

/** Raw string write: refuses an unregistered key (throwing outside production) and never throws otherwise. */
export function writeRaw(ctx: StorageContext, key: string, value: string): WriteResult {
  if (!ctx.registry.has(key)) {
    if (isDevOrTest())
      throw new Error(
        `Storage key "${key}" is not registered; register it in src/platform/storage/keys.ts first.`,
      );
    return { status: "unregistered" };
  }
  const storage = ctx.backend();
  if (!storage) {
    ctx.fallback.set(key, value);
    return { status: "unavailable" };
  }
  try {
    storage.setItem(key, value);
    ctx.fallback.delete(key);
    return { status: "ok" };
  } catch (error) {
    ctx.fallback.set(key, value);
    return { status: isQuotaExceeded(error) ? "quota" : "unavailable" };
  }
}

export function removeRaw(ctx: StorageContext, key: string): void {
  ctx.fallback.delete(key);
  const storage = ctx.backend();
  try {
    storage?.removeItem(key);
  } catch {
    // Best effort: the key may still be unreadable next time, which reads as "unavailable".
  }
}

export interface SettingReadResult {
  readonly status: ReadStatus;
  readonly value: string;
}

/** Reads a setting, validating the stored string against its allowed values and falling back to the declared default. */
export function readSetting(ctx: StorageContext, key: string): SettingReadResult {
  const entry = ctx.registry.get(key) as SettingRegistration | undefined;
  if (entry?.kind !== "setting") throw new Error(`"${key}" is not a registered setting.`);
  const raw = readRaw(ctx, key);
  if (raw.status === "missing" || raw.status === "unavailable")
    return { status: raw.status, value: entry.defaultValue };
  if (raw.status === "ok" && raw.value !== undefined) {
    if (entry.allowedValues.includes(raw.value)) return { status: "ok", value: raw.value };
    return { status: "corrupt", value: entry.defaultValue };
  }
  return { status: "corrupt", value: entry.defaultValue };
}

/** Writes a setting; throws (a caller programming error, never a storage failure) for a value outside the allowed set. */
export function writeSetting(ctx: StorageContext, key: string, value: string): WriteResult {
  const entry = ctx.registry.get(key) as SettingRegistration | undefined;
  if (entry?.kind !== "setting") throw new Error(`"${key}" is not a registered setting.`);
  if (!entry.allowedValues.includes(value)) {
    throw new TypeError(
      `"${value}" is not an allowed value for setting "${key}" (allowed: ${entry.allowedValues.join(", ")}).`,
    );
  }
  return writeRaw(ctx, key, value);
}

/** Reads a JSON document, migrating it forward; corrupt or unmigratable data is quarantined and reported as `corrupt`. */
export function readDocument<T>(
  ctx: StorageContext,
  namespace: string,
  chain: MigrationChain,
): ReadResult<T> {
  if (!ctx.registry.has(namespace))
    throw new Error(`"${namespace}" is not a registered document namespace.`);
  const raw = readRaw(ctx, namespace);
  if (raw.status !== "ok" || raw.value === undefined) {
    return { status: raw.status === "ok" ? "missing" : raw.status };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.value);
  } catch {
    quarantine(ctx, namespace, raw.value, "invalid-json");
    return { status: "corrupt" };
  }
  try {
    return { status: "ok", value: migrateDocument(chain, parsed) };
  } catch (error) {
    const reason = error instanceof UnmigratableVersionError ? error.message : "migration-failed";
    quarantine(ctx, namespace, raw.value, reason);
    return { status: "corrupt" };
  }
}

export function writeDocument(ctx: StorageContext, namespace: string, doc: unknown): WriteResult {
  if (!ctx.registry.has(namespace))
    throw new Error(`"${namespace}" is not a registered document namespace.`);
  return writeRaw(ctx, namespace, JSON.stringify(doc));
}
