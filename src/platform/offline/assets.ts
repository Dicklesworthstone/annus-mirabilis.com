import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Inline the locked KaTeX package's own WOFF2 files. Never read a system font or a URL. */
export async function inlineKatexFonts(
  css: string,
  readFont: (relativePath: string) => Promise<Uint8Array>,
): Promise<string> {
  const faces = [...css.matchAll(/@font-face\s*\{[^}]*\}/gu)];
  if (faces.length === 0 || faces.length > 64)
    throw new Error("KaTeX font-face coverage is missing or excessive.");
  let embedded = css;
  let total = 0;
  for (const [rule] of faces) {
    const match = /url\(\s*["']?(fonts\/[A-Za-z0-9_-]+\.woff2)["']?\s*\)/u.exec(rule);
    const path = match?.[1];
    if (!path) throw new Error("Each KaTeX font face must have an explicit local WOFF2 file.");
    const bytes = await readFont(path);
    total += bytes.byteLength;
    if (
      bytes.byteLength < 4 ||
      bytes.byteLength > 256_000 ||
      total > 1_048_576 ||
      Buffer.from(bytes.subarray(0, 4)).toString("ascii") !== "wOF2"
    )
      throw new Error(`Invalid or oversized KaTeX WOFF2 font: ${path}.`);
    const data = `url(data:font/woff2;base64,${Buffer.from(bytes).toString("base64")}) format("woff2")`;
    const replacement = rule.replace(/src\s*:[^;}]*/u, `src:${data}`);
    if (replacement === rule) throw new Error("KaTeX font rule has no source declaration.");
    embedded = embedded.replace(rule, replacement);
  }
  return embedded.replace(/\/\*[\s\S]*?\*\//gu, "");
}

export async function loadOfflineAssets(root: string) {
  const katex = resolve(root, "node_modules/katex");
  const css = await readFile(resolve(katex, "dist/katex.min.css"), "utf8");
  const mathCss = await inlineKatexFonts(css, (path) => readFile(resolve(katex, "dist", path)));
  const printCss = await readFile(resolve(root, "src/platform/print/print.css"), "utf8");
  const [projectLicense, mathLicense] = await Promise.all([
    readFile(resolve(root, "LICENSE"), "utf8"),
    readFile(resolve(katex, "LICENSE"), "utf8"),
  ]);
  return Object.freeze({
    mathCss,
    printCss,
    notices: Object.freeze([
      "Text and implementation: notices reproduced from this repository's LICENSE. No license is inferred for a scan, dataset, or historical translation not included here.\n\n" +
        projectLicense,
      "Mathematics and embedded math-font assets: KaTeX. The locked package's WOFF2 faces are embedded whole, not subset per chapter. Reading text uses the device's serif font.\n\n" +
        mathLicense,
    ]),
  });
}

export type PublicationDecision = "publish" | "pin-local-only" | "reference-only";

export type OfflineFigureAsset = Readonly<{
  id: string;
  title: string;
  publicationDecision: PublicationDecision;
  mimeType?: string;
  bytes?: Uint8Array | null;
  locator?: string;
  url?: string;
  caption?: string;
}>;

export type RenderedOfflineAsset = Readonly<{
  id: string;
  kind: "embedded" | "citation";
  html: string;
}>;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Rights filter: only 'publish' assets are embedded as data: URIs.
 * 'pin-local-only' and 'reference-only' assets are replaced by citations.
 */
export function renderOfflineAsset(asset: OfflineFigureAsset): RenderedOfflineAsset {
  if (asset.publicationDecision === "publish") {
    if (!asset.bytes || !asset.mimeType) {
      throw new Error(
        `Publishable asset "${asset.id}" requires binary bytes and mimeType for offline embedding.`,
      );
    }
    const base64 = Buffer.from(asset.bytes).toString("base64");
    const dataUri = `data:${asset.mimeType};base64,${base64}`;
    const alt = escapeHtml(asset.title);
    const caption = escapeHtml(asset.caption ?? asset.title);
    const html = `<figure id="${escapeHtml(asset.id)}" class="offline-figure"><img src="${dataUri}" alt="${alt}"><figcaption>${caption}</figcaption></figure>`;
    return Object.freeze({
      id: asset.id,
      kind: "embedded",
      html,
    });
  }

  if (
    asset.publicationDecision === "pin-local-only" ||
    asset.publicationDecision === "reference-only"
  ) {
    const locator = escapeHtml(asset.locator ?? "Source reference");
    const title = escapeHtml(asset.title);
    const href = escapeHtml(asset.url ?? "#");
    const decision = escapeHtml(asset.publicationDecision);
    const html = `<figure id="${escapeHtml(asset.id)}" class="cited-asset"><figcaption><p><strong>${title}</strong>: ${locator}. <a rel="noreferrer" href="${href}">${locator}</a></p><p class="rights-notice">Excluded from offline edition; rights designation: ${decision}.</p></figcaption></figure>`;
    return Object.freeze({
      id: asset.id,
      kind: "citation",
      html,
    });
  }

  throw new TypeError(`Unsupported publicationDecision: ${String(asset.publicationDecision)}.`);
}

export function filterOfflineAssets(
  assets: readonly OfflineFigureAsset[],
): readonly RenderedOfflineAsset[] {
  return Object.freeze(assets.map(renderOfflineAsset));
}
