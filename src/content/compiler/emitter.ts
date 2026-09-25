/**
 * Route-Local Payload Emitter.
 * Deterministically generates route-local JSON payloads and public Markdown exports
 * to `generated/content/<buildDigest>/` and `public/edition/<buildDigest>/`.
 *
 * Spec: AGENTS.md and am-cm-compiler-core-oa7
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { recordLatex } from "../../equations/recordLatex.ts";
import { inlineMathToMarkdown } from "../inlineMath.ts";
import type { Block, Foundation } from "../schemas/reading.ts";
import type { PaperPayload } from "./compile.ts";

export interface PayloadManifestEntry {
  readonly id: string;
  readonly kind: string;
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly jsonUrl: string;
  readonly markdownUrl: string;
  readonly inputRecords?: readonly string[];
}

export interface ContentBuildIndex {
  readonly schemaVersion: 1;
  readonly inputDigest: string;
  readonly compilerDigest: string;
  readonly buildDigest: string;
  readonly payloads: readonly PayloadManifestEntry[];
}

export interface EmitOptions {
  readonly rootDir: string;
  readonly inputDigest: string;
  readonly compilerDigest: string;
  readonly buildDigest: string;
  readonly papers: readonly PaperPayload[];
  readonly foundations: readonly Foundation[];
}

/**
 * Deterministic JSON stringifier with sorted object keys.
 */
export function canonicalJsonStringify(value: unknown, space = 2): string {
  return `${JSON.stringify(sortKeysRecursively(value), null, space)}\n`;
}

function sortKeysRecursively(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysRecursively);

  const sortedObj: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();
  for (const key of keys) {
    sortedObj[key] = sortKeysRecursively((value as Record<string, unknown>)[key]);
  }
  return sortedObj;
}

const sha256Digest = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");

/** A foundation's title by id, or undefined when no record carries that id. */
export type FoundationTitle = (id: string) => string | undefined;

/*
  A foundation link says what the page says, "Open the foundation: Fractions and ratios"
  (Blocks.tsx). It used to print the record id as the link text and join the lesson's
  returnCaption on with an em dash: "[Foundation: fractions-ratios](...) — Return to the
  constraints on the entropy derivative." That caption labels the way BACK from the lesson,
  which a flat Markdown file does not have, so after the link it read as a description of
  the link, and a wrong one.
*/
function markdownBlocks(blocks: readonly Block[] | undefined, titleOf: FoundationTitle): string {
  if (!blocks) return "";
  return blocks
    .map((b) =>
      b.kind === "paragraph"
        ? inlineMathToMarkdown(b.text)
        : b.kind === "formula"
          ? `$$\n${b.latex}\n$$\n\n${b.spoken}`
          : b.kind === "steps"
            ? b.items.map((x, i) => `${i + 1}. ${inlineMathToMarkdown(x)}`).join("\n")
            : `[Open the foundation: ${titleOf(b.id) ?? b.id}](/foundations/${b.id}/)`,
    )
    .join("\n\n");
}

/**
 * The Markdown a reader downloads from a paper's page: the explanation, then each teaching
 * equation in its own paper's letters (recordLatex).
 */
export function paperMarkdown(paper: PaperPayload, titleOf: FoundationTitle): string {
  return (
    markdownPaper(paper, titleOf) +
    paper.equations
      .map((e) => {
        const rawLatex = "latex" in e && typeof e.latex === "string" ? e.latex : "";
        return `
## ${e.title}

Modern teaching equation; review pending.

$$
${(e.tree ? recordLatex(e) : undefined) ?? rawLatex}
$$

${e.spoken ?? ""}

${e.explanation ?? ""}
`;
      })
      .join("\n")
  );
}

function markdownPaper(p: PaperPayload, titleOf: FoundationTitle): string {
  return `# ${p.paper.title}\n\n${p.paper.sourceNotice}\n\n${p.arguments
    .map((a) => {
      const readings = a.readings as Record<string, readonly Block[] | undefined> | undefined;
      return `## ${a.title}\n\n${a.question ?? ""}\n\n${markdownBlocks(readings?.full ?? readings?.["full-explanation"], titleOf)}\n\n### Model limits\n\n${(a.limitations ?? []).join("\n\n")}`;
    })
    .join("\n\n")}\n`;
}

/**
 * Emits all generated payloads to generated/content/ and public/edition/ directories.
 */
export async function emitPayloads(options: EmitOptions): Promise<ContentBuildIndex> {
  const generatedDir = resolve(options.rootDir, "generated/content", options.buildDigest);
  const publicDir = resolve(options.rootDir, "public/edition", options.buildDigest);

  await mkdir(generatedDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });

  const payloads: PayloadManifestEntry[] = [];
  const titleOf: FoundationTitle = (id) => options.foundations.find((f) => f.id === id)?.title;

  async function emitOne(
    id: string,
    kind: string,
    data: unknown,
    markdown: string,
    inputRecords?: string[],
  ): Promise<void> {
    const fileName = `${kind}-${id}.json`;
    const jsonStr = canonicalJsonStringify(data, 2);
    const mdFileName = `${kind}-${id}.md`;

    await writeFile(resolve(generatedDir, fileName), jsonStr);
    await writeFile(resolve(publicDir, fileName), jsonStr);
    await writeFile(resolve(publicDir, mdFileName), markdown);

    const bytes = Buffer.byteLength(jsonStr, "utf8");
    const sha = sha256Digest(jsonStr);

    payloads.push({
      id,
      kind,
      file: `${options.buildDigest}/${fileName}`,
      bytes,
      sha256: sha,
      jsonUrl: `/edition/${options.buildDigest}/${fileName}`,
      markdownUrl: `/edition/${options.buildDigest}/${mdFileName}`,
      inputRecords: inputRecords ?? [],
    });
  }

  // 1. Emit papers
  for (const paper of options.papers) {
    const md = paperMarkdown(paper, titleOf);

    const inputRecords = [
      `papers/${paper.paper.id}.json`,
      ...paper.arguments.map((a) => `arguments/${paper.paper.id}/${a.id}.json`),
    ];

    await emitOne(paper.paper.id, "paper", paper, md, inputRecords);
  }

  // 2. Emit foundations
  for (const foundation of options.foundations) {
    // The same parts, in the same order and under the same headings, as FoundationBody renders
    // on the lesson's page. The export used to drop the summary, the question the lesson
    // answers and the prerequisites, and left the stopping sentence unlabelled.
    const prerequisites = foundation.prerequisites.map((p) => {
      const id = typeof p === "string" ? p : p.foundationId.replace(/^foundation:/, "");
      const title = options.foundations.find((f) => f.id === id)?.title ?? id;
      return `- [${title}](/foundations/${id}/)`;
    });
    const md = [
      `# ${foundation.title}`,
      foundation.summary,
      "Written for this edition, not translated from Einstein.",
      `## ${foundation.question}`,
      markdownBlocks(foundation.explanation, titleOf),
      foundation.exampleTitle
        ? `## Worked example: ${foundation.exampleTitle}`
        : "## One worked example",
      markdownBlocks(foundation.example, titleOf),
      "## Where this lesson stops",
      foundation.stoppingPoint,
      ...(prerequisites.length > 0 ? ["## This lesson builds on", prerequisites.join("\n")] : []),
    ].join("\n\n");

    await emitOne(foundation.id, "foundation", foundation, `${md}\n`, [
      `foundations/${foundation.id}.json`,
    ]);
  }

  const index: ContentBuildIndex = {
    schemaVersion: 1,
    inputDigest: options.inputDigest,
    compilerDigest: options.compilerDigest,
    buildDigest: options.buildDigest,
    payloads: payloads.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)),
  };

  // Write index.json
  await writeFile(
    resolve(options.rootDir, "generated/content/index.json"),
    canonicalJsonStringify(index, 2),
  );

  return index;
}
