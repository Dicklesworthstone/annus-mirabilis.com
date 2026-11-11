import { validateConstrainedMarkdown } from "../compiler/loaders.ts";
import { essayFailure } from "../schemas/essay.ts";

export type EssayInline =
  | Readonly<{ kind: "text"; text: string }>
  | Readonly<{ kind: "link"; text: string; anchorId: string }>
  | Readonly<{ kind: "value"; id: string }>;
export type EssayBlock =
  | Readonly<{ kind: "heading"; id: string; text: string }>
  | Readonly<{ kind: "paragraph"; id: string; inlines: readonly EssayInline[] }>
  | Readonly<{ kind: "list"; id: string; items: readonly (readonly EssayInline[])[] }>
  | Readonly<{ kind: "equation"; id: string; equationId: string }>
  | Readonly<{ kind: "quotation"; id: string; anchorId: string }>;

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Only content-ID links and scenario value placeholders have inline syntax. */
export function parseEssayInlines(source: string, path: string): readonly EssayInline[] {
  const result: EssayInline[] = [];
  const pattern = /\[([^\]\n]+)\]\(ref:([a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)?)\)|\{\{value:([a-z][a-z0-9-]*)\}\}/g;
  let at = 0;
  function plain(text: string): void {
    if (/[\[\]{}$\x60\\]|!\[|<\/?|https?:\/\//.test(text))
      essayFailure(path,
        "Use content-ID links, source quotations and equation records; raw Markdown/HTML/LaTeX is not admitted.");
    if (text) result.push({ kind: "text", text });
  }
  for (const match of source.matchAll(pattern)) {
    plain(source.slice(at, match.index));
    if (match[3]) result.push({ kind: "value", id: match[3] });
    else if (match[1] && match[2]) {
      if (/[\[\]{}$\x60\\<>]/.test(match[1])) essayFailure(path, "Link labels must be plain text.");
      result.push({ kind: "link", text: match[1], anchorId: match[2] });
    }
    at = (match.index ?? 0) + match[0].length;
  }
  plain(source.slice(at));
  return result;
}

/**
 * A bounded Markdown subset: ## headings, paragraphs, flat lists, source quotations and
 * equation-record directives. Every block has an authored {#id}, so return links survive edits.
 */
export function parseEssayMarkdown(source: string, path: string): readonly EssayBlock[] {
  validateConstrainedMarkdown(source, path, { throwOnError: true });
  if (source.length > 96000) essayFailure(path, "The essay body exceeds its text budget.");
  const groups = source.trim().split(/\r?\n\s*\r?\n/);
  const blocks: EssayBlock[] = [];
  const ids = new Set<string>();
  const reserved = new Set(["essay-title", "in-the-papers", "transfers", "limits", "citations",
    "related",
    "in-the-papers-title", "transfers-title", "limits-title", "citations-title"]);
  for (let index = 0; index < groups.length; index++) {
    const group = groups[index] ?? "";
    const at = path + ":block-" + (index + 1);
    const match = /\s*\{#([a-z][a-z0-9-]*)\}\s*$/.exec(group);
    const id = match?.[1];
    if (!match || !id || !ID.test(id) || ids.has(id) || reserved.has(id)
      || id.startsWith("transfer-"))
      essayFailure(at, "Each block needs a unique stable {#id} outside the reserved section IDs.");
    ids.add(id);
    const text = group.slice(0, match.index).trim();
    if (text.startsWith("## ")) {
      const heading = text.slice(3);
      if (!heading || /[\n#[\]{}$\x60\\<>]/.test(heading))
        essayFailure(at, "A heading must be one line of plain text.");
      blocks.push({ kind: "heading", id, text: heading });
    } else if (text.startsWith("{{equation:")) {
      const equation = /^\{\{equation:(eq-model-[a-z0-9-]+)\}\}$/.exec(text);
      if (!equation?.[1]) essayFailure(at,
        "An equation block must name one existing model equation.");
      blocks.push({ kind: "equation", id, equationId: equation[1] });
    } else if (text.startsWith("> ")) {
      const quote = /^> source:([a-z][a-z0-9-]*\/[a-z][a-z0-9-]*)$/.exec(text);
      if (!quote?.[1]) essayFailure(at,
        "A quotation must resolve a source anchor; do not retype source text.");
      blocks.push({ kind: "quotation", id, anchorId: quote[1] });
    } else if (text.startsWith("- ")) {
      const lines = text.split(/\r?\n/);
      if (lines.some((line) => !line.startsWith("- ")))
        essayFailure(at, "Lists are flat, with one item per line.");
      blocks.push({ kind: "list", id, items: lines.map((line) => parseEssayInlines(line.slice(2),
        at)) });
    } else {
      if (!text || /^(?:#|>|[0-9]+\.|[|*])|\n(?:#|>|-|[0-9]+\.|[|*])/.test(text))
        essayFailure(at, "Unsupported Markdown block.");
      blocks.push({ kind: "paragraph", id, inlines: parseEssayInlines(text.replace(/\r?\n/g, " "),
        at) });
    }
  }
  if (!blocks.some((block) => block.kind === "heading")
    || !blocks.some((block) => block.kind === "paragraph"))
    essayFailure(path, "An essay needs headings and prose.");
  return blocks;
}

export function essayInlineText(inlines: readonly EssayInline[], values: ReadonlyMap<string,
  string>): string {
  return inlines.map((inline) => inline.kind === "value" ? (values.get(inline.id) ?? "") : inline.text).join("");
}
