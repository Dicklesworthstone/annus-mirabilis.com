/**
 * Byte accounting for one namespace: UTF-16 code units times two for the key and the value,
 * matching how browsers actually charge storage quota. `maxBytes` is a soft limit only — a
 * feature defines its own trimming policy and never trims without telling the reader.
 */

import { readRaw, type StorageContext } from "./store.ts";

export function estimateBytes(key: string, value: string): number {
  return (key.length + value.length) * 2;
}

export interface NamespaceSize {
  readonly namespace: string;
  readonly bytes: number;
  readonly maxBytes: number;
  readonly overLimit: boolean;
}

export function estimateNamespaceSize(ctx: StorageContext, namespace: string): NamespaceSize {
  const entry = ctx.registry.get(namespace);
  if (!entry) throw new Error(`"${namespace}" is not a registered storage namespace.`);
  const raw = readRaw(ctx, namespace);
  const bytes =
    raw.status === "ok" && raw.value !== undefined ? estimateBytes(namespace, raw.value) : 0;
  return { namespace, bytes, maxBytes: entry.maxBytes, overLimit: bytes > entry.maxBytes };
}

export function estimateTotalSize(ctx: StorageContext): readonly NamespaceSize[] {
  return ctx.registry.all().map((entry) => estimateNamespaceSize(ctx, entry.key));
}
