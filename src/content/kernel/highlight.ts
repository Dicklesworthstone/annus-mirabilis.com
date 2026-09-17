import type { IdentifierBinding } from "../schemas/experiment.ts";

const IDENT = /[A-Za-z_$][A-Za-z0-9_$]*/y;

export type HighlightToken = Readonly<{
  kind: "ident" | "comment" | "string" | "text";
  text: string;
  start: number;
  quantityId?: string | undefined;
}>;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hueForQuantity(quantityId: string): number {
  let h = 0;
  for (let i = 0; i < quantityId.length; i++) h = (h * 33 + quantityId.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * Lightness is 28%, not 32%, because the hue is chosen by hashing the quantity id
 * and must clear WCAG AA at every hue it can produce. Against the code block's
 * --wash (#e8eadf) the worst hue is 60deg: 3.91 at L=32%, 4.34 at 30%, 4.83 at
 * 28%. Axe measured 4.14 on the shipped 32% for rmsDisplacement1d once the
 * listings began rendering. src/content/kernel/identContrast.test.ts holds the
 * threshold over all 360 hues.
 */
export function quantityHue(quantityId: string): string {
  return `hsl(${hueForQuantity(quantityId)} 45% 28%)`;
}

export function quantityColorStyle(quantityId: string): string {
  return `color: ${quantityHue(quantityId)}; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 0.18em;`;
}

export function selectionCss(quantityIds: readonly string[]): string {
  return quantityIds
    .map(
      (id) =>
        `.equation-context[data-selected-quantity-id="${id}"] [data-quantity-id="${id}"] { background: #efe0ad; }`,
    )
    .join("\n");
}

/**
 * Restricted TypeScript / Rust highlighter: escape HTML, then wrap bound
 * identifiers. Comments and strings are not treated as identifiers.
 */
export function tokenizeKernelSource(
  source: string,
  bindings: readonly IdentifierBinding[],
): HighlightToken[] {
  const byIdent = new Map<string, string>();
  for (const b of bindings) {
    if (!byIdent.has(b.identifier)) byIdent.set(b.identifier, b.quantityId);
  }
  const out: HighlightToken[] = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    if (source.startsWith("//", i)) {
      const end = source.indexOf("\n", i);
      const slice = source.slice(i, end === -1 ? n : end);
      out.push({ kind: "comment", text: slice, start: i });
      i += slice.length;
      continue;
    }
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      const slice = source.slice(i, end === -1 ? n : end + 2);
      out.push({ kind: "comment", text: slice, start: i });
      i += slice.length;
      continue;
    }
    const ch = source[i] ?? "";
    if (ch === "'" || ch === '"' || ch === "`") {
      let j = i + 1;
      while (j < n) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === ch) {
          j++;
          break;
        }
        j++;
      }
      out.push({ kind: "string", text: source.slice(i, j), start: i });
      i = j;
      continue;
    }
    IDENT.lastIndex = i;
    const m = IDENT.exec(source);
    if (m && m.index === i) {
      const ident = m[0];
      const quantityId = byIdent.get(ident);
      out.push(
        quantityId
          ? { kind: "ident", text: ident, start: i, quantityId }
          : { kind: "ident", text: ident, start: i },
      );
      i += ident.length;
      continue;
    }
    out.push({ kind: "text", text: ch, start: i });
    i++;
  }
  return out;
}

export function highlightKernelSource(
  source: string,
  language: "ts" | "rust",
  bindings: readonly IdentifierBinding[],
): string {
  void language;
  return tokenizeKernelSource(source, bindings)
    .map((token) => {
      const escaped = escapeHtml(token.text);
      if (token.kind === "comment") return `<span class="kernel-comment">${escaped}</span>`;
      if (token.kind === "string") return `<span class="kernel-string">${escaped}</span>`;
      if (token.kind === "ident" && token.quantityId) {
        return `<span class="kernel-ident" data-quantity-id="${escapeHtml(token.quantityId)}" style="${quantityColorStyle(token.quantityId)}">${escaped}</span>`;
      }
      return escaped;
    })
    .join("");
}
