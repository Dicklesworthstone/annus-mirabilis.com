import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { citationTitleClose } from "../../content/citationTitle.ts";
import { hasInlineMath, splitInlineMath } from "../../content/inlineMath.ts";
import type {
  Argument,
  Block,
  Citation,
  Foundation,
  Paper,
} from "../../content/schemas/reading.ts";
import { renderInlineLatex } from "../../equations/render/inlineKatex.ts";
import { type OfflineFigureAsset, renderOfflineAsset } from "./assets.ts";
import { OFFLINE_DETAIL_SOURCE } from "./detail.inline.ts";

export const OFFLINE_CHAPTER_VERSION = 1;
export const OFFLINE_ORIGIN = "https://annus-mirabilis.com";
export type OfflineBudget = Readonly<{ rawBytes: number; gzipBytes: number }>;
export type OfflineIdentity = Readonly<{
  buildDigest: string;
  contentRevision: string;
  translationRevision: string | null;
  generatedAt: string;
  releaseId: string | null;
}>;
export type OfflineWorkedExample = Readonly<{
  instrumentId: string;
  sourceDigest: string;
  parameters: Readonly<Record<string, string | number | boolean>>;
  rows: readonly Readonly<{ quantity: string; value: string; unit: string; status: string }>[];
  omittedArrays: number;
}>;
export type OfflineEquation = Readonly<{
  id: string;
  argument: string;
  title: string;
  latex: string;
  spoken: string;
  explanation: string;
}>;
/** Only the compiled public projection crosses this boundary; never a DOM or a reader session. */
export type OfflineChapterInput = Readonly<{
  paper: Paper;
  section: Paper["sections"][number];
  arguments: readonly Argument[];
  foundations: readonly Foundation[];
  citations: readonly Citation[];
  equations: readonly OfflineEquation[];
  examples: readonly OfflineWorkedExample[];
  identity: OfflineIdentity;
  assets: Readonly<{ mathCss: string; printCss: string; notices: readonly string[] }>;
  budget: OfflineBudget;
  figures?: readonly OfflineFigureAsset[] | undefined;
}>;
export type OfflineChapterEntry = Readonly<{
  paper: string;
  section: string;
  title: string;
  path: string;
  sha256: string;
  bytes: number;
  gzipBytes: number;
  contentRevision: string;
}>;
export const offlineDigest = (text: string | Uint8Array): string =>
  createHash("sha256").update(text).digest("hex");
export function escapeOfflineText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function id(value: string): string {
  if (!/^[a-z][a-z0-9-]{0,100}$/u.test(value)) throw new TypeError("Invalid offline content id.");
  return value;
}
function sourceLink(citation: Citation): string {
  const url = new URL(citation.url);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new TypeError("Offline citations require HTTPS without credentials.");
  return `<a rel="noreferrer" href="${escapeOfflineText(url.href)}">${escapeOfflineText(citation.locator)}</a>`;
}
function inlineCss(css: string): string {
  // CSS comes from the build's own stylesheet and font inliner, not authored prose.
  if (/<\/style|@import|expression\s*\(/iu.test(css))
    throw new TypeError("Offline styles must contain only embedded WOFF2 resources.");
  const urls = [...css.matchAll(/url\(\s*([^)]*?)\s*\)/giu)];
  if (urls.length !== (css.match(/url\(/giu) ?? []).length)
    throw new TypeError("Malformed offline stylesheet URL.");
  for (const match of urls) {
    const value = (match[1] ?? "").replace(/^["']|["']$/gu, "");
    if (!/^data:font\/woff2;base64,[A-Za-z0-9+/]+={0,2}$/u.test(value))
      throw new TypeError("Offline styles must contain only embedded WOFF2 resources.");
  }
  return css;
}
function checkedMath(
  latex: string,
  renderMath: (latex: string) => string,
  label = "Equation",
): string {
  const html = renderMath(latex);
  if (
    !html.includes("<math") ||
    !html.includes("katex") ||
    /<(?:script|style|link|meta|iframe|object|embed|img|image|video|audio|form|input)\b|\s(?:on[a-z]+|src|href|xlink:href)\s*=/iu.test(
      html,
    )
  ) {
    throw new TypeError("Offline mathematics must be static KaTeX HTML and MathML.");
  }
  return `<div class="formula" role="region" aria-label="${escapeOfflineText(label)}" tabindex="0">${html}</div>`;
}

export function collectChapterFoundations(
  args: readonly Argument[],
  available: readonly Foundation[],
): readonly Foundation[] {
  const byId = new Map<string, Foundation>();
  for (const foundation of available) {
    if (byId.has(foundation.id)) throw new TypeError(`Duplicate foundation: ${foundation.id}.`);
    byId.set(foundation.id, foundation);
  }
  const needed = new Set<string>(),
    active = new Set<string>();
  function visit(name: string) {
    if (active.has(name)) throw new TypeError(`Cyclic offline foundation: ${name}.`);
    if (needed.has(name)) return;
    const foundation = byId.get(name);
    if (!foundation) throw new TypeError(`Missing offline foundation: ${name}.`);
    active.add(name);
    for (const next of foundation.prerequisites) {
      if (typeof next !== "string" && next.kind === "cross-link") continue;
      const nextId =
        typeof next === "string" ? next : next.foundationId.replace(/^foundation:/, "");
      visit(nextId);
    }
    for (const block of [...foundation.explanation, ...foundation.example])
      if (block.kind === "foundation") visit(block.id);
    active.delete(name);
    needed.add(name);
  }
  for (const argument of args) {
    for (const name of Object.values(argument.help)) visit(name);
    for (const blocks of Object.values(argument.readings))
      for (const block of blocks) if (block.kind === "foundation") visit(block.id);
  }
  return [...needed].sort().map((name) => {
    const foundation = byId.get(name);
    if (!foundation) throw new Error("Foundation closure changed during generation.");
    return foundation;
  });
}

export function packageOfflineChapter(
  input: OfflineChapterInput,
  renderMath: (latex: string) => string,
) {
  const { paper, section, identity, budget } = input;
  id(paper.id);
  id(section.id);
  if (
    !/^[a-f0-9]{64}$/u.test(identity.buildDigest) ||
    !/^[a-f0-9]{64}$/u.test(identity.contentRevision) ||
    !Number.isFinite(Date.parse(identity.generatedAt))
  )
    throw new TypeError("Invalid offline revision identity.");
  if (![budget.rawBytes, budget.gzipBytes].every((n) => Number.isSafeInteger(n) && n > 0))
    throw new TypeError("Offline byte budgets must be positive integers.");
  const args = section.arguments.map((name) => {
    const matches = input.arguments.filter((argument) => argument.id === name);
    const argument = matches[0];
    if (
      matches.length !== 1 ||
      !argument ||
      argument.paper !== paper.id ||
      argument.section !== section.id
    )
      throw new TypeError(`Missing or mismatched offline argument: ${name}.`);
    return argument;
  });
  const foundations = collectChapterFoundations(args, input.foundations);
  const foundationIds = new Set(foundations.map((f) => f.id));
  const e = escapeOfflineText;
  let mathBytes = 0;
  let mathIndex = 0;
  function math(latex: string, label?: string) {
    mathIndex++;
    const equationLabel = label ? `Equation ${mathIndex}: ${label}` : `Equation ${mathIndex}`;
    const html = checkedMath(latex, renderMath, equationLabel);
    mathBytes += Buffer.byteLength(html);
    return html;
  }
  /* A paragraph's or a step's text, with its `\( … \)` mathematics typeset inline by the same
     renderer as the reading face (inlineKatex.ts), and every word escaped. */
  function prose(text: string): string {
    if (!hasInlineMath(text)) return e(text);
    return splitInlineMath(text)
      .map((segment) => {
        if (segment.kind === "text") return e(segment.value);
        const html = renderInlineLatex(segment.value);
        mathBytes += Buffer.byteLength(html);
        return html;
      })
      .join("");
  }
  function blocks(values: readonly Block[]): string {
    return values
      .map((block) => {
        switch (block.kind) {
          case "paragraph":
            return `<p>${prose(block.text)}</p>`;
          case "formula":
            return `${math(block.latex, block.spoken)}<p class="spoken-math">${e(block.spoken)}</p>`;
          case "steps":
            return `<ol>${block.items.map((text) => `<li>${prose(text)}</li>`).join("")}</ol>`;
          case "foundation": {
            if (!foundationIds.has(block.id))
              throw new TypeError(`Unresolved offline foundation: ${block.id}.`);
            return `<p><a href="#foundation-${id(block.id)}">${e(block.returnCaption)}</a> (included in this file)</p>`;
          }
          default:
            throw new TypeError("A new block kind needs an explicit offline renderer.");
        }
      })
      .join("\n");
  }
  const textList = (title: string, values: readonly string[]) =>
    values.length
      ? `<section><h4>${title}</h4><ul>${values.map((text) => `<li>${e(text)}</li>`).join("")}</ul></section>`
      : "";
  const neededCitations = new Set([paper.citation]);
  const instrumentIds = new Set<string>();
  const passages = args
    .map((argument) => {
      id(argument.id);
      for (const name of argument.citations) neededCitations.add(name);
      for (const name of argument.experiments) instrumentIds.add(name);
      const readings = (["overview", "full", "steps", "margin"] as const)
        .map(
          (reading, index) =>
            `<div data-reading="${index}"${index === 1 ? "" : " hidden"}>${index === 3 ? "<h4>Modern qualifications</h4>" : ""}${blocks(argument.readings[reading])}</div>`,
        )
        .join("\n");
      const equations = input.equations
        .filter((equation) => equation.argument === argument.id)
        .map(
          (equation) =>
            `<section id="${id(equation.id)}"><h4>${e(equation.title)}</h4><p>Modern teaching equation, not the equation as printed.</p>${math(equation.latex, equation.title || equation.spoken)}<p>${e(equation.spoken)}</p><p>${e(equation.explanation)}</p></section>`,
        )
        .join("\n");
      const help = Object.entries(argument.help)
        .map(
          ([kind, name]) =>
            `<a href="#foundation-${id(name)}">${kind === "why" ? "Why?" : kind === "missingStep" ? "Show the missing step" : "Show an example"}</a>`,
        )
        .join(" · ");
      return `<article id="${argument.id}" tabindex="-1"><h3>${e(argument.title)}</h3><p class="question">${e(argument.question)}</p>${readings}${equations}${textList("Assumptions", argument.premises)}${textList("Limits", argument.limitations)}<nav aria-label="Tools for ${e(argument.title)}">${help}</nav></article>`;
    })
    .join("\n");
  const appendix = foundations
    .map((foundation) => {
      for (const name of foundation.citations) neededCitations.add(name);
      // The parts and headings FoundationBody renders on the lesson's own page. The prerequisite
      // links printed the record id ("Prerequisite: mean-variance-rms"); the closure holds every
      // prerequisite, so each link carries its lesson's title.
      const prerequisites = foundation.prerequisites.map((p) => {
        const pId = typeof p === "string" ? p : p.foundationId.replace(/^foundation:/, "");
        const title = foundations.find((f) => f.id === pId)?.title ?? pId;
        return `<li><a href="#foundation-${id(pId)}">${e(title)}</a></li>`;
      });
      const example = foundation.exampleTitle
        ? `Worked example: ${e(foundation.exampleTitle)}`
        : "One worked example";
      return `<section id="foundation-${id(foundation.id)}" tabindex="-1"><h3>${e(foundation.title)}</h3><h4 class="question">${e(foundation.question)}</h4>${blocks(foundation.explanation)}<h4>${example}</h4>${blocks(foundation.example)}<h4>Where this lesson stops</h4><p>${e(foundation.stoppingPoint)}</p>${prerequisites.length > 0 ? `<h4>This lesson builds on</h4><ul>${prerequisites.join("")}</ul>` : ""}<a href="#${section.id}">Return to the chapter</a></section>`;
    })
    .join("\n");
  const worked = [...instrumentIds]
    .sort()
    .map((name) => {
      id(name);
      const example = input.examples.find((item) => item.instrumentId === name);
      const online = `<a rel="noreferrer" href="${OFFLINE_ORIGIN}/lab/${name}/">Open ${e(name)} online</a>`;
      if (!example)
        return `<section><h3>${e(name)}</h3><p>This laboratory is not included in this file. The chapter's authored foundation examples remain available above. ${online}</p></section>`;
      if (example.rows.length > 256 || Object.keys(example.parameters).length > 256)
        throw new TypeError("Offline worked-example budget exceeded.");
      const settings = Object.entries(example.parameters)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => `<dt>${e(key)}</dt><dd>${e(String(value))}</dd>`)
        .join("");
      return `<section data-print-worked-example><h3>${e(name)}: a built-in worked result</h3><p>Static host-calculated example, not a running experiment or an observation. Canonical units and owner-supplied statuses are retained. ${online}</p><div class="table-scroll" role="region" aria-label="${e(name)} result table" tabindex="0"><table><caption>Build-time scalar readouts</caption><thead><tr><th scope="col">Quantity</th><th scope="col">Value</th><th scope="col">Unit</th><th scope="col">Status</th></tr></thead><tbody>${example.rows.map((row) => `<tr><th scope="row">${e(row.quantity)}</th><td>${e(row.value)}</td><td>${e(row.unit)}</td><td>${e(row.status)}</td></tr>`).join("")}</tbody></table></div><p>${example.omittedArrays} array outputs are not reproduced. This table does not claim to reproduce the interactive plot.</p><h4>Settings (canonical units)</h4><dl>${settings}</dl><p class="revision">Evaluator: ${e(example.sourceDigest)}</p></section>`;
    })
    .join("\n");
  const citations = [...neededCitations]
    .sort()
    .map((name) => {
      const citation = input.citations.find((item) => item.id === name);
      if (!citation) throw new TypeError(`Missing offline citation: ${name}.`);
      return `<li>${e(citation.title)}${citationTitleClose(citation.title)} ${sourceLink(citation)}</li>`;
    })
    .join("\n");
  const canonical = `${OFFLINE_ORIGIN}/papers/${paper.id}/${section.id}/`;
  const css = inlineCss(`${input.assets.mathCss}\n${input.assets.printCss}\n${OFFLINE_CSS}`);
  const renderedFigures = (input.figures ?? []).map(renderOfflineAsset);
  const figuresSection = renderedFigures.length
    ? `<section><h2>Figures and illustrations</h2>${renderedFigures.map((f) => f.html).join("\n")}</section>`
    : "";
  const hasEmbeddedFigures = renderedFigures.some((f) => f.kind === "embedded");
  const figuresNotice = hasEmbeddedFigures
    ? "<p>Figures with publication rights are embedded as offline data URIs. Pinned or reference-only assets are cited with online links.</p>"
    : "<p>No scans or external figures are embedded. Their source references do not grant redistribution rights.</p>";
  const scriptHash = createHash("sha256").update(OFFLINE_DETAIL_SOURCE).digest("base64");
  const csp = `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'`;
  const html = `<!doctype html>\n<html lang="en" data-detail="1" data-lens="paper"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${e(csp)}"><meta name="referrer" content="no-referrer"><title>${e(section.title)} · ${e(paper.title)}</title><style>${css}</style></head><body><a href="#${section.id}">Skip to the chapter</a><header data-print-header><p>Annus Mirabilis · saved explanation preview</p><h1>${e(paper.title)}: ${e(section.title)}</h1><p lang="de">${e(paper.germanTitle)}</p><p>This file contains the available authored explanation, not the transcription or translation. No simulation, search index, notebook, or private settings are included. Only explicit online links need a connection.</p><p><a rel="noreferrer" href="${canonical}">Current online chapter</a></p><fieldset data-screen-only><legend>Choose a reading</legend><label>Detail <select data-offline-detail disabled><option value="0">Overview</option><option value="1" selected>Full explanation</option><option value="2">Show every step</option></select></label><label><input type="checkbox" data-offline-modern disabled> Show modern qualifications</label></fieldset><p data-offline-status role="status" aria-live="polite"></p><noscript><p>JavaScript is off. The full explanation, foundations, source references, and static worked results are readable.</p></noscript></header><main><section id="${section.id}" tabindex="-1"><h2>${e(section.title)}</h2>${passages}</section>${figuresSection}${appendix ? `<section><h2>Foundations included in this file</h2>${appendix}</section>` : ""}${worked ? `<section><h2>Static laboratory examples</h2>${worked}</section>` : ""}<section><h2>Source references</h2><ol>${citations}</ol></section></main><footer data-print-footer><h2>Edition identity and attribution</h2><dl><dt>Generated</dt><dd>${e(identity.generatedAt)}</dd><dt>Content revision</dt><dd class="revision">${e(identity.contentRevision)}</dd><dt>Translation revision</dt><dd>${e(identity.translationRevision ?? "None: this file holds the explanation, not the translation")}</dd><dt>Build digest</dt><dd class="revision">${e(identity.buildDigest)}</dd><dt>Release</dt><dd>${e(identity.releaseId ?? "Development scaffold; not a published release")}</dd></dl>${input.assets.notices.map((notice) => `<pre>${e(notice)}</pre>`).join("\n")}${figuresNotice}</footer><script>${OFFLINE_DETAIL_SOURCE}</script></body></html>\n`;
  const bytes = Buffer.byteLength(html),
    gzipBytes = gzipSync(html, { level: 9 }).byteLength;
  const contributors = {
    stylesAndFonts: Buffer.byteLength(css),
    math: mathBytes,
    textAndStructure: bytes - Buffer.byteLength(css) - mathBytes,
  };
  if (bytes > budget.rawBytes || gzipBytes > budget.gzipBytes)
    throw new RangeError(
      `Offline chapter ${paper.id}/${section.id} exceeds budget: ${bytes}/${budget.rawBytes} raw bytes, ${gzipBytes}/${budget.gzipBytes} gzip bytes; contributors ${JSON.stringify(contributors)}.`,
    );
  const sha256 = offlineDigest(html);
  const entry: OfflineChapterEntry = {
    paper: paper.id,
    section: section.id,
    title: section.title,
    path: `/offline/${paper.id}/${section.id}-${sha256}.html`,
    sha256,
    bytes,
    gzipBytes,
    contentRevision: identity.contentRevision,
  };
  return Object.freeze({
    entry: Object.freeze(entry),
    html,
    contributors: Object.freeze(contributors),
    scriptHash,
  });
}

const OFFLINE_CSS = `
html { color-scheme: light; scroll-behavior: auto; }
body { margin: 0 auto; padding: 1.25rem; max-width: 52rem; font: 1.1rem/1.65 Georgia,serif; color: #222; background: #fffdf7; overflow-wrap: anywhere; }
h1,h2,h3,h4 { line-height: 1.25; } h1 { font-size: 2rem; } article,main>section,footer { margin-block: 2rem; }
a { color: #733221; } :focus-visible { outline: 3px solid #365bb0; outline-offset: 3px; }
fieldset { display: flex; flex-wrap: wrap; gap: 1rem; } select,input { font: inherit; min-height: 2rem; }
[hidden] { display: none !important; } .question { font-weight: bold; }
.formula,.table-scroll { max-width: 100%; overflow-x: auto; } .formula { margin-block: 1rem; }
pre,.revision { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; font-size: .8rem; }
table { width: 100%; border-collapse: collapse; font-size: .85rem; } td,th { border: 1px solid #aaa; padding: .35rem; text-align: left; }
dl { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,2fr); gap: .3rem 1rem; } dd { margin: 0; }
@media print { body { max-width: none; padding: 0; } h1 { break-before: auto; page-break-before: auto; } [data-screen-only],[data-offline-status],noscript { display: none; } .katex-html { display: block !important; } .katex-mathml { position: absolute !important; } pre { font-size: 7pt; } }
`;
