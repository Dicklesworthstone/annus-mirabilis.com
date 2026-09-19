/**
 * The colour-is-never-alone sweep (am-design-themes-typography-288q).
 *
 * AGENTS.md: "Color helps identify meaning and never carries meaning alone."
 * contrast.test.ts already asserted that property for six hand-picked rules
 * with `toContain` string checks. Six named examples are not a gate: nothing
 * stopped the next rule from encoding a distinction in hue alone. This module
 * sweeps every project stylesheet instead, so the property is enforced for
 * rules nobody has thought of yet.
 *
 * SCOPE, and why it is `--accent` and not every token:
 *   --accent  IS the meaning-bearing token. AGENTS.md reserves it ("red only
 *             for emphasis and the move step"), so a distinction drawn with it
 *             is by definition a distinction a reader must be able to perceive.
 *   --muted   is de-emphasis, not encoding. A reader who cannot perceive it
 *             loses no information: the secondary prose still reads, in order,
 *             and says what it is. Holding muted to the same rule would flag
 *             every hint and caption in the project and teach people to add
 *             exemptions, which is how a gate dies.
 *   --ink / --paper are default text and background; --rule is a decorative
 *             divider, already documented as exempt in tokens.ts.
 *
 * A rule passes if it declares its own non-colour channel. When the channel
 * lives somewhere this scanner cannot see - a UA default, or words in the
 * markup - the selector is registered below with the place that channel
 * actually lives, and the registry is itself checked for staleness.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** The token whose use encodes meaning. See the docblock for why it is alone here. */
export const MEANING_BEARING_TOKEN = "--accent";

/** Properties that paint the token; any of these is a "distinction drawn with colour". */
const COLOUR_PROPERTIES = /(^|[\s;{])(color|background|background-color|border-color)\s*:/;

/**
 * Properties that carry a distinction WITHOUT hue. Deliberately excludes
 * margin and padding: spacing alone does not tell a reader what something is.
 */
const NON_COLOUR_CHANNEL =
  /(^|[\s;{])(font|font-weight|font-style|font-family|font-size|font-variant|font-feature-settings|text-decoration|text-decoration-line|text-decoration-style|text-underline-offset|text-transform|letter-spacing|border|border-style|border-width|border-top|border-bottom|border-left|border-right|outline|content|list-style|background-image|transform|text-shadow)\s*:/;

export interface ColourRule {
  readonly file: string;
  readonly line: number;
  readonly selector: string;
  readonly body: string;
  readonly hasInlineChannel: boolean;
}

const COMMENT = /\/\*[\s\S]*?\*\//g;
/** Innermost-brace matching, so rules nested in @media blocks are found too. */
const RULE = /([^{}]+)\{([^{}]*)\}/g;

export function findProjectCssFiles(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) out.push(...findProjectCssFiles(full));
    else if (entry.endsWith(".css")) out.push(full);
  }
  return out.sort();
}

export function scanColourRules(cssRoot: string, repoRoot: string): ColourRule[] {
  const rules: ColourRule[] = [];
  for (const file of findProjectCssFiles(cssRoot)) {
    const raw = readFileSync(file, "utf8").replace(COMMENT, "");
    for (const match of raw.matchAll(RULE)) {
      const selector = (match[1] ?? "").trim().replace(/\s+/g, " ");
      const body = match[2] ?? "";
      if (!body.includes(`var(${MEANING_BEARING_TOKEN})`)) continue;
      if (!COLOUR_PROPERTIES.test(body)) continue;
      rules.push({
        file: file.slice(repoRoot.length + 1),
        line: raw.slice(0, match.index).split("\n").length,
        selector,
        body: body.trim().replace(/\s+/g, " "),
        hasInlineChannel: NON_COLOUR_CHANNEL.test(body),
      });
    }
  }
  return rules;
}

/**
 * Selectors whose non-colour channel exists but is invisible to a CSS scan.
 * Each value names WHERE the channel actually is, so a reviewer can check it.
 * Verified by reading the markup on 2026-09-19 (pane31).
 */
export const EXTERNAL_CHANNELS: Readonly<Record<string, string>> = Object.freeze({
  ":root:where([data-theme]) a:not(.button)":
    "UA default text-decoration: underline on <a href>. globals.css sets text-underline-offset and a:hover text-decoration-thickness, both of which presuppose that underline; nothing removes it for this selector.",
  ".direct-pdf-link":
    "An <a> (src/reader/faces/FacsimileFace.tsx:198) that never sets text-decoration: none, so it keeps the UA underline.",
  "h1 em": "<em> is italic by UA default, so the emphasis is carried by slant as well as hue.",
  ".warning":
    'Markup supplies the words: <span className="badge warning">(wrong model)</span> in src/components/lab/sr10/LightComplexLab.tsx:367 and :374. The phrase "(wrong model)" is the signal; the accent only reinforces it.',
  ".badge-status":
    "Markup supplies a literal label: <strong>Status:</strong> {activeTerm.status} in src/equations/accessibility/TermExplorer.tsx:243.",
  ".explanation-text":
    "Renders {errorExplanation}, the refusal's own prose, in src/experiments/controls/ParameterControl.tsx:433. The explanation text is the channel.",
  ".a11y-btn:hover, .a11y-btn:focus-visible":
    "The focus half is covered by themes.css's global `:where(button, ...):focus-visible { outline: 2px solid var(--focus-ring) }`; .a11y-btn is a real <button> (src/a11y/descriptions/provider.tsx:231, :241), so that outline applies. The hover half is transient pointer feedback, not information a reader must decode.",
  "::selection":
    "Selecting text paints a highlight region that did not exist a moment earlier: a background block appears where there was none. That appearance is the channel; hue only tints it.",
  "button:hover:not(:disabled), .button:hover":
    "Hover is transient pointer feedback rather than encoded information, and this rule additionally swaps figure and ground (color: var(--paper) on background: var(--accent)) rather than merely re-tinting text.",
  ".error":
    'Always used together with .notice (every call site is className="notice error", e.g. src/components/lab/WalkLab.tsx:302), and .notice supplies `border-left: 3px solid` plus padding. Call sites also carry role="alert".',
  ".concordance-card:target, .concordance-card.focused":
    "A 3px box-shadow ring appears where there was none, which is a geometry change, and :target additionally means the URL fragment points at this card.",
  ".parameter-control.has-error":
    "Accompanied by the rendered refusal prose in .explanation-text (src/experiments/controls/ParameterControl.tsx:433), which states the problem in words.",
  ".parameter-control.beyond-track":
    'Accompanied by a separate visible element: <div className="beyond-track-marker"> reading "Beyond visual track (value unit)" at src/experiments/controls/ParameterControl.tsx:421.',
  '.search-option[aria-selected="true"]':
    'Carries aria-selected="true", which assistive technology announces, and paints a background block rather than only re-tinting the text.',
  ".legend-prediction":
    "src/components/lab/PredictOverlay.tsx:110-145 gives the prediction a DASHED stroke and a SQUARE marker against the result's SOLID stroke and CIRCLE marker, plus the ASCII glyphs [# - - -] versus [o ---] and a bold text label. Four non-colour channels.",
});

export function unchannelledRules(rules: readonly ColourRule[]): ColourRule[] {
  return rules.filter((r) => !r.hasInlineChannel && EXTERNAL_CHANNELS[r.selector] === undefined);
}

/* ------------------------------------------------------------------------- *
 * The dark-theme readability sweep.
 *
 * contrast.test.ts checks the six DECLARED token pairs per theme. That is not
 * the same as "every text colour pair used in each theme", which the bead's
 * Requirements actually ask for. A rule that hardcodes a pale background and
 * sets no colour leaves the text at --ink, which is near-white in Kramgasse
 * Night and Slate: pale-on-pale, around 1.0:1, invisible. No declared-pair
 * check can see that, because neither colour is a token.
 *
 * A rule is exempt when it sets its own `color` (self-consistent, even if not
 * theme-aware) or when a `[data-theme="..."]` rule re-paints the same selector.
 * ------------------------------------------------------------------------- */

/**
 * Removes `@media print` blocks before the dark-theme sweep runs.
 *
 * Print output is never themed: src/platform/print/print.css opens its print
 * block with a universal reset, `*, *::before, *::after { background:
 * transparent; color: #000000; }`, and notation.css's print block sets
 * `.notation-page { color: #000; background: #fff; }`. So a rule inside a print
 * block that paints a pale background and sets no colour inherits BLACK, not the
 * theme's near-white --ink, and is correct rather than broken.
 *
 * Without this, the sweep reported three such rules as unreadable - notation.css's
 * printed .concordance-card and .honesty-banner and print.css's
 * .print-scale-facts-table th - and "fixing" them would have themed a monochrome
 * page. The scanner cannot see @media context or an ancestor's inherited colour,
 * so the context is removed instead of modelled.
 */
export function stripPrintBlocks(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@media", i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    const open = css.indexOf("{", at);
    if (open === -1) {
      out += css.slice(i);
      break;
    }
    const prelude = css.slice(at, open);
    if (!/\bprint\b/.test(prelude)) {
      out += css.slice(i, open + 1);
      i = open + 1;
      continue;
    }
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    out += css.slice(i, at);
    i = j;
  }
  return out;
}

const HARDCODED_BG = /background(?:-color)?:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/;
const OWN_COLOUR = /(^|[\s;])color:/;

export interface InheritedInkFailure {
  readonly file: string;
  readonly line: number;
  readonly selector: string;
  readonly background: string;
  readonly theme: string;
  readonly ratio: number;
}

function expandHex(hex: string): string {
  return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
}

/**
 * Finds rules whose text falls back to --ink over a hardcoded background and
 * fails `minRatio` in a dark theme. `contrast` is injected so this module never
 * reimplements the WCAG formula.
 */
export function scanInheritedInkFailures(
  cssRoot: string,
  repoRoot: string,
  darkThemeInk: Readonly<Record<string, string>>,
  contrast: (a: string, b: string) => number,
  minRatio = 4.5,
): InheritedInkFailure[] {
  interface Rule {
    file: string;
    line: number;
    selector: string;
    body: string;
  }
  const all: Rule[] = [];
  for (const file of findProjectCssFiles(cssRoot)) {
    const raw = stripPrintBlocks(readFileSync(file, "utf8").replace(COMMENT, ""));
    for (const m of raw.matchAll(RULE)) {
      all.push({
        file: file.slice(repoRoot.length + 1),
        line: raw.slice(0, m.index).split("\n").length,
        selector: (m[1] ?? "").trim().replace(/\s+/g, " "),
        body: m[2] ?? "",
      });
    }
  }

  const overridden = new Map<string, Set<string>>();
  for (const theme of Object.keys(darkThemeInk)) overridden.set(theme, new Set());
  for (const rule of all) {
    if (!/background(-color)?:|(^|[\s;])color:/.test(rule.body)) continue;
    // Split the comma group FIRST: a theme override may list several parts, each
    // carrying its own [data-theme="..."] prefix, and matching the whole string
    // would leave the prefix glued to every part after the first.
    for (const part of rule.selector.split(",")) {
      const m = part.trim().match(/^\[data-theme="([a-z-]+)"\]\s*(.*)$/);
      if (!m) continue;
      const bucket = overridden.get(m[1] ?? "");
      if (bucket) bucket.add((m[2] ?? "").trim());
    }
  }

  /**
   * Selectors whose own rule sets `color`. A state rule such as
   * `.genealogy-node-btn:hover { background: #f7f3eb }` inherits its colour from
   * `.genealogy-node-btn { color: #2b2621 }`, the SAME element, not from --ink,
   * so it is self-consistent in every theme. Only the state rule is inspected by
   * the loop below, so without this the hover rule reads as unreadable.
   */
  const selfColoured = new Set<string>();
  for (const rule of all) {
    if (!OWN_COLOUR.test(rule.body)) continue;
    for (const part of rule.selector.split(",")) selfColoured.add(part.trim());
  }
  /** Strips a trailing state so `.x:hover` and `.x[data-selected="true"]` find `.x`. */
  const baseOf = (selector: string): string =>
    selector.replace(/(?::[a-z-]+(?:\([^)]*\))?|\[[^\]]*\]|\.is-[a-z-]+)+$/i, "").trim();

  const failures: InheritedInkFailure[] = [];
  for (const rule of all) {
    if (rule.selector.includes("[data-theme=")) continue;
    const bg = rule.body.match(HARDCODED_BG);
    if (!bg?.[1] || OWN_COLOUR.test(rule.body)) continue;
    const background = expandHex(bg[1]);
    for (const [theme, ink] of Object.entries(darkThemeInk)) {
      for (const part of rule.selector.split(",").map((s) => s.trim())) {
        if (overridden.get(theme)?.has(part)) continue;
        const base = baseOf(part);
        if (base !== part && base !== "" && selfColoured.has(base)) continue;
        const ratio = contrast(ink, background);
        if (ratio < minRatio) {
          failures.push({
            file: rule.file,
            line: rule.line,
            selector: part,
            background,
            theme,
            ratio,
          });
        }
      }
    }
  }
  return failures;
}

/**
 * Every `[data-theme="..."]` selector in the project's CSS, with the theme
 * name it targets. A name that is not a real theme id is a dead selector:
 * it parses, it lints, it ships, and it silently never matches. derivation.css
 * carried two of these, `[data-theme="kramgasse"]` for the move step and the
 * move box, against the real id `kramgasse-night`, so Kramgasse Night lost the
 * dark treatment its author had written while Slate kept its own.
 */
export function scanThemeSelectors(
  cssRoot: string,
  repoRoot: string,
): { file: string; line: number; theme: string }[] {
  const found: { file: string; line: number; theme: string }[] = [];
  for (const file of findProjectCssFiles(cssRoot)) {
    const raw = readFileSync(file, "utf8").replace(COMMENT, "");
    for (const m of raw.matchAll(/\[data-theme="([a-z-]+)"\]/g)) {
      found.push({
        file: file.slice(repoRoot.length + 1),
        line: raw.slice(0, m.index).split("\n").length,
        theme: m[1] ?? "",
      });
    }
  }
  return found;
}
