import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { PaperPayload } from "./compiler/compile.ts";
import type { Foundation } from "./schemas/reading.ts";
type Entry = { id: string; kind: string; file: string; bytes: number; sha256: string; jsonUrl: string; markdownUrl: string };
export async function contentIndex(): Promise<{ payloads: Entry[] }> {
  return JSON.parse(await readFile(resolve("generated/content/index.json"), "utf8"));
}
async function payload<T>(kind: string, id: string): Promise<T & { exports: { json: string; markdown: string } }> {
  const index = await contentIndex(), entry = index.payloads.find(e => e.kind === kind && e.id === id);
  if (!entry || !/^[a-f0-9]{64}\/[a-z0-9-]+\.json$/.test(entry.file)) throw new Error(`No compiled ${kind}: ${id}.`);
  const bytes = await readFile(resolve("generated/content", entry.file));
  if (bytes.length !== entry.bytes || createHash("sha256").update(bytes).digest("hex") !== entry.sha256) throw new Error("Compiled content does not match its manifest.");
  return { ...JSON.parse(bytes.toString("utf8")), exports: { json: entry.jsonUrl, markdown: entry.markdownUrl } };
}
export const loadPaper = (id: string) => payload<PaperPayload>("paper", id);
export const loadFoundation = (id: string) => payload<Foundation>("foundation", id);
