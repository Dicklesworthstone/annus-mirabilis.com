import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "katex";
import { loadContentIndex, loadFoundationPayload, loadPaperPayload } from "../src/content/compiler/serverLoaders.ts";
import { expressionLatex } from "../src/equations/latex.ts";
import { BROWNIAN_QUANTITIES } from "../src/equations/quantities.ts";
import { parseResult } from "../src/experiments/results/codec.ts";
import { loadOfflineAssets } from "../src/platform/offline/assets.ts";
import { packageOfflineChapter, type OfflineBudget, type OfflineWorkedExample } from "../src/platform/offline/chapter.ts";
import { offlineProfile, publishOfflineChapters, type OfflineManifest } from "../src/platform/offline/server.ts";

/** Consume only built-in prepared results, never a user's current lab or notebook. */
async function preparedExamples(root: string): Promise<readonly OfflineWorkedExample[]> {
  const directory = resolve(root, "src/generated");
  const names = (await readdir(directory)).filter((name) => /^(?:bm|sr|lq|me)\d{2}-example\.json$/u.test(name)).sort();
  const examples: OfflineWorkedExample[] = [];
  for (const name of names) {
    const input: unknown = JSON.parse(await readFile(resolve(directory, name), "utf8"));
    if (!input || typeof input !== "object") throw new Error(`Invalid prepared example: ${name}.`);
    const record = input as Record<string, unknown>;
    // Not every instrument has adopted the prepared-result transport yet. Those instruments
    // receive an explicit online-only notice, never a fabricated static result.
    if (!Array.isArray(record.results) || typeof record.sourceDigest !== "string" ||
        !record.parameters || typeof record.parameters !== "object" || Array.isArray(record.parameters)) continue;
    const parameters = record.parameters as Record<string, string | number | boolean>;
    if (Object.values(parameters).some((value) => !["string", "number", "boolean"].includes(typeof value) ||
        (typeof value === "number" && !Number.isFinite(value))))
      throw new Error(`Invalid prepared scalar parameters: ${name}.`);
    const rows: { quantity: string; value: string; unit: string; status: string }[] = [];
    let omittedArrays = 0;
    for (const encoded of record.results) {
      if (typeof encoded !== "string") throw new Error(`Invalid prepared result encoding: ${name}.`);
      const result = parseResult(encoded);
      if (result.status === "value" && typeof result.value !== "number") { omittedArrays++; continue; }
      rows.push({ quantity: result.quantityId, unit: result.unit, status: result.status,
        value: result.status === "value" ? String(result.value) : "No numeric value" });
    }
    const stem = name.slice(0, 4);
    examples.push({ instrumentId: `${stem.slice(0, 2)}-${stem.slice(2)}`, sourceDigest: record.sourceDigest,
      parameters, rows, omittedArrays });
  }
  return examples;
}

export async function buildOfflineChapters(root = process.cwd(), profileValue = process.env.AM_RELEASE_PROFILE) {
  const profile = offlineProfile(profileValue);
  const index = await loadContentIndex(root);
  if (index.payloads.some((entry) => entry.kind !== "paper" && entry.kind !== "foundation"))
    throw new Error("A new compiled payload kind needs an explicit offline coverage decision.");
  const files: ReturnType<typeof packageOfflineChapter>[] = [];
  // The current reading schema publishes explanatory drafts only. As with site search,
  // do not leak those drafts into preview/launch artifacts while reviewed projections are absent.
  if (profile === "scaffold") {
    const papers = await Promise.all(index.payloads.filter((entry) => entry.kind === "paper")
      .map(async (entry) => ({ payload: await loadPaperPayload(entry.id, root), revision: entry.sha256 })));
    const foundations = await Promise.all(index.payloads.filter((entry) => entry.kind === "foundation")
      .map((entry) => loadFoundationPayload(entry.id, root)));
    const assets = await loadOfflineAssets(root);
    const examples = await preparedExamples(root);
    const budgets = JSON.parse(await readFile(resolve(root, "perf/offline-chapter-budgets.json"), "utf8")) as {
      schemaVersion: number; default: OfflineBudget;
    };
    if (budgets.schemaVersion !== 1 || !budgets.default) throw new Error("Invalid offline budget file.");
    // Git metadata is a recorded input, not the wall clock. Rebuilding the same tree is stable.
    const generatedAt = execFileSync("git", ["log", "-1", "--format=%cI", "--", "content"], {
      cwd: root, encoding: "utf8",
    }).trim();
    if (!generatedAt) throw new Error("Offline chapters require the recorded content commit date.");
    const citations = new Map(papers.flatMap(({ payload }) => payload.citations.map((citation) => [citation.id, citation] as const)));
    for (const { payload, revision } of papers.sort((a, b) => a.payload.paper.id.localeCompare(b.payload.paper.id, "en"))) {
      if (payload.schemaVersion !== 1 || payload.paper.status !== "explanation-preview")
        throw new Error("A changed publication schema needs an explicit offline adapter.");
      const equations = payload.equations.map((equation) => ({ id: equation.id, argument: equation.argument,
        title: equation.title, latex: expressionLatex(equation.tree, BROWNIAN_QUANTITIES),
        spoken: equation.spoken, explanation: equation.explanation }));
      for (const section of payload.paper.sections) {
        files.push(packageOfflineChapter({ paper: payload.paper, section, arguments: payload.arguments,
          foundations, citations: [...citations.values()], equations, examples, assets, budget: budgets.default,
          identity: { buildDigest: index.buildDigest, contentRevision: revision,
            translationRevision: null, generatedAt, releaseId: null } }, (latex) => renderToString(latex, {
          displayMode: true, output: "htmlAndMathml", throwOnError: true, strict: "error",
          trust: false, maxExpand: 1000, maxSize: 20,
        })));
      }
    }
  }
  const manifest: OfflineManifest = { schemaVersion: 1, buildDigest: index.buildDigest, profile,
    chapters: files.map((file) => file.entry) };
  await publishOfflineChapters(root, manifest, files);
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildOfflineChapters();
  console.log(JSON.stringify({ event: "offline-chapters-built", profile: manifest.profile,
    chapters: manifest.chapters.length, bytes: manifest.chapters.reduce((sum, entry) => sum + entry.bytes, 0),
    buildDigest: manifest.buildDigest }));
}
