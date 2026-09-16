/**
 * Server-side route payload loaders for App Router pages and static generation.
 *
 * Spec: AGENTS.md and am-cm-compiler-core-oa7
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Argument, Foundation } from "../schemas/reading.ts";
import type { PaperPayload } from "./compile.ts";
import type { ContentBuildIndex } from "./emitter.ts";

export async function loadContentIndex(rootDir = process.cwd()): Promise<ContentBuildIndex> {
  const indexPath = resolve(rootDir, "generated/content/index.json");
  const content = await readFile(indexPath, "utf8");
  return JSON.parse(content) as ContentBuildIndex;
}

export async function loadCompiledPayload<T>(
  kind: string,
  id: string,
  rootDir = process.cwd(),
): Promise<T & { exports: { json: string; markdown: string } }> {
  const index = await loadContentIndex(rootDir);
  const entry = index.payloads.find((e) => e.kind === kind && e.id === id);

  if (!entry || !/^[a-f0-9]{64}\/[a-z0-9-]+\.json$/.test(entry.file)) {
    throw new Error(`Compiled payload not found for ${kind}: ${id}`);
  }

  const payloadPath = resolve(rootDir, "generated/content", entry.file);
  const bytes = await readFile(payloadPath);

  if (bytes.length !== entry.bytes) {
    throw new Error(
      `Byte length mismatch for ${kind}/${id}: expected ${entry.bytes}, got ${bytes.length}`,
    );
  }

  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== entry.sha256) {
    throw new Error(
      `SHA-256 digest mismatch for ${kind}/${id}: expected ${entry.sha256}, got ${sha}`,
    );
  }

  const data = JSON.parse(bytes.toString("utf8")) as T;
  return {
    ...data,
    exports: {
      json: entry.jsonUrl,
      markdown: entry.markdownUrl,
    },
  };
}

export async function loadPaperPayload(id: string, rootDir = process.cwd()): Promise<PaperPayload> {
  return loadCompiledPayload<PaperPayload>("paper", id, rootDir);
}

export async function loadFoundationPayload(
  id: string,
  rootDir = process.cwd(),
): Promise<Foundation> {
  return loadCompiledPayload<Foundation>("foundation", id, rootDir);
}

export async function loadArgumentPayload(
  paperId: string,
  argumentId: string,
  rootDir = process.cwd(),
): Promise<Argument> {
  const paper = await loadPaperPayload(paperId, rootDir);
  const arg = paper.arguments.find((a) => a.id === argumentId);
  if (!arg) {
    throw new Error(`Argument '${argumentId}' not found in paper '${paperId}'.`);
  }
  return arg;
}

export async function loadSectionPayload(
  paperId: string,
  sectionId: string,
  rootDir = process.cwd(),
): Promise<{
  paper: PaperPayload["paper"];
  section: PaperPayload["paper"]["sections"][number];
  arguments: Argument[];
  foundations: Foundation[];
}> {
  const paper = await loadPaperPayload(paperId, rootDir);
  const section = paper.paper.sections.find((s) => s.id === sectionId);
  if (!section) {
    throw new Error(`Section '${sectionId}' not found in paper '${paperId}'.`);
  }

  const sectionArgs = paper.arguments.filter((a) => section.arguments.includes(a.id));
  const neededFoundationIds = new Set<string>();
  for (const a of sectionArgs) {
    for (const fid of Object.values(a.help ?? {})) {
      neededFoundationIds.add(fid);
    }
    for (const reading of Object.values(a.readings)) {
      for (const b of reading) {
        if (b.kind === "foundation") neededFoundationIds.add(b.id);
      }
    }
  }

  const sectionFoundations = paper.foundations.filter((f) => neededFoundationIds.has(f.id));

  return {
    paper: paper.paper,
    section,
    arguments: sectionArgs,
    foundations: sectionFoundations,
  };
}
