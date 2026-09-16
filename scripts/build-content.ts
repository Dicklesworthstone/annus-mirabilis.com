import { expressionLatex } from "../src/equations/latex.ts";
import { BROWNIAN_QUANTITIES } from "../src/equations/quantities.ts";
import { readFile, readdir, lstat, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { compileReadingContent, type PaperPayload } from "../src/content/compiler/compile.ts";
import type { Block } from "../src/content/schemas/reading.ts";

export const CONTENT_COMPILER_FILES = ["scripts/build-content.ts", "src/content/compiler/compile.ts", "src/content/compiler/json.ts", "src/content/schemas/reading.ts", "src/content/dimensions/rational.ts", "src/equations/ast.ts", "src/equations/dimensions.ts", "src/equations/record.ts", "src/equations/quantities.ts", "src/equations/latex.ts", "src/experiments/bm01/definition.ts"] as const;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digest = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
export async function loadReadingFiles(root = ROOT) {
  const directory = resolve(root, "content"), files: { path: string; text: string }[] = [];
  let bytes = 0;
  async function walk(path: string): Promise<void> {
    for (const name of (await readdir(path)).sort()) {
      const full = resolve(path, name), stat = await lstat(full);
      if (stat.isSymbolicLink()) throw new Error(`Content symlinks are not admitted: ${full}`);
      if (stat.isDirectory()) { await walk(full); continue; }
      if (!stat.isFile() || stat.size > 512 * 1024) throw new Error(`Invalid or oversized content file: ${full}`);
      if (files.length >= 512) throw new Error("Content record-count budget exceeded.");
      bytes += stat.size; if (bytes > 8 * 1024 * 1024) throw new Error("Content total size budget exceeded.");
      const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await readFile(full));
      files.push({ path: relative(directory, full).split("\\").join("/"), text });
    }
  }
  await walk(directory); return files;
}
function markdownBlocks(blocks: readonly Block[]): string {
  return blocks.map(b => b.kind === "paragraph" ? b.text : b.kind === "formula" ? `$$\n${b.latex}\n$$\n\n${b.spoken}` : b.kind === "steps" ? b.items.map((x, i) => `${i + 1}. ${x}`).join("\n") : `[Foundation: ${b.id}](/foundations/${b.id}/) — ${b.returnCaption}`).join("\n\n");
}
function markdownPaper(p: PaperPayload): string {
  return `# ${p.paper.title}\n\n${p.paper.sourceNotice}\n\n${p.arguments.map(a => `## ${a.title}\n\n${a.question}\n\n${markdownBlocks(a.readings.full)}\n\n### Model limits\n\n${a.limitations.join("\n\n")}`).join("\n\n")}\n`;
}
export async function buildContent(root = ROOT) {
  const files = await loadReadingFiles(root), result = compileReadingContent(files);
  if (!result.ok) return { ...result, index: null };
  // Versioned output directories prevent stale, half-updated payload mixtures. Never delete prior output.
  const inputDigest = digest(files.map(f => `${f.path}\0${Buffer.byteLength(f.text)}\0${f.text}`).join(""));
  // Compiler changes must invalidate public URLs even when authored records are unchanged.
  const compilerFiles = CONTENT_COMPILER_FILES;
  const compilerDigest = digest((await Promise.all(compilerFiles.map(async path => `${path}\0${digest(await readFile(resolve(root, path)))}`))).join("\n"));
  const buildDigest = digest(`${inputDigest}\0${compilerDigest}`);
  const generated = resolve(root, "generated/content", buildDigest), publicRoot = resolve(root, "public/edition", buildDigest);
  await mkdir(generated, { recursive: true }); await mkdir(publicRoot, { recursive: true });
  const payloads: { id: string; kind: string; file: string; bytes: number; sha256: string; jsonUrl: string; markdownUrl: string }[] = [];
  async function emit(id: string, kind: string, data: unknown, markdown: string) {
    const file = `${kind}-${id}.json`, json = `${JSON.stringify(data, null, 2)}\n`;
    await writeFile(resolve(generated, file), json); await writeFile(resolve(publicRoot, file), json);
    await writeFile(resolve(publicRoot, `${kind}-${id}.md`), markdown);
    payloads.push({ id, kind, file: `${buildDigest}/${file}`, bytes: Buffer.byteLength(json), sha256: digest(json), jsonUrl: `/edition/${buildDigest}/${file}`, markdownUrl: `/edition/${buildDigest}/${kind}-${id}.md` });
  }
  for (const paper of result.papers) await emit(paper.paper.id, "paper", paper, markdownPaper(paper) + paper.equations.map(e => `
## ${e.title}

Modern teaching equation; review pending.

$$
${expressionLatex(e.tree, BROWNIAN_QUANTITIES)}
$$

${e.spoken}

${e.explanation}
`).join("\n"));
  for (const foundation of result.foundations) await emit(foundation.id, "foundation", foundation, `# ${foundation.title}\n\nAuthored explanation; editorial review pending.\n\n${markdownBlocks(foundation.explanation)}\n\n## Worked example\n\n${markdownBlocks(foundation.example)}\n\n${foundation.stoppingPoint}\n`);
  const index = { schemaVersion: 1, inputDigest, compilerDigest, buildDigest, payloads };
  await writeFile(resolve(generated, "diagnostics.jsonl"), result.diagnostics.map(d => JSON.stringify(d)).join("\n") + "\n");
  // Publish the manifest last, only after every referenced payload was written successfully.
  await writeFile(resolve(root, "generated/content/index.json"), `${JSON.stringify(index, null, 2)}\n`);
  return { ...result, index };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildContent();
  for (const diagnostic of result.diagnostics) console.log(JSON.stringify(diagnostic));
  if (!result.ok) process.exitCode = 1;
  else console.log(JSON.stringify({ event: "content-compiled", papers: result.papers.length, foundations: result.foundations.length, inputDigest: result.index?.inputDigest }));
}
