import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "../../a11y/readingSettings/contrast";
import { THEME_TOKENS } from "../../app/theme/tokens";

/**
 * A laboratory's drawing colours, set per theme as custom properties in its own stylesheet, stand
 * at 3:1 or better on the surface they are drawn on, in both themes (WCAG 1.4.11, graphical
 * objects). On 2026-09-24 a sweep of live lab drawings found marks from 1.30:1 to 2.95:1 in one
 * theme or the other: SR-11's incident ray, SR-03's E₁, ME-01's first pulse, SR-08's force arrow,
 * the photon in several spectral bands, LQ-01's screen. Each got a light and a dark value in its
 * stylesheet. This test holds those values, and any added the same way, to the threshold.
 *
 * It also holds the two dark blocks together. A dark value is written twice: under
 * :root[data-theme="kramgasse-night"], and again under @media (prefers-color-scheme: dark) for
 * :root:not([data-theme]), which is what a reader without JavaScript gets. Changing one and not
 * the other would give no-script dark readers the old colour.
 *
 * A colour property in any other context (another @media, a selector naming neither theme inside
 * the dark query) is refused rather than guessed at, so the test never checks a value against the
 * wrong theme's paper.
 */
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const LAB_STYLE_DIRS = ["src/components/lab", "src/app/lab"];
const MARK_MIN = 3;

type Surface = "paper" | "wash" | "plotDarkfield";
/** Most drawings sit on the paper or a wash panel; a property drawn on another surface says so. */
const SURFACES: Readonly<Record<string, readonly Surface[]>> = {
  // LQ-01's wave field is --plot-darkfield in both themes.
  "--lq01-field-ink": ["plotDarkfield"],
};
const DEFAULT_SURFACES: readonly Surface[] = ["paper", "wash"];

type Context = "light" | "dark" | "dark-no-script" | "unrecognised";
export type ColourDeclaration = Readonly<{
  property: string;
  value: string;
  context: Context;
  line: number;
}>;

function contextOf(stack: readonly string[]): Context {
  const selector = stack.at(-1) ?? "";
  const media = stack.filter((prelude) => prelude.startsWith("@"));
  if (media.length === 0)
    return /\[data-theme="kramgasse-night"\]/.test(selector) ? "dark" : "light";
  if (
    media.length === 1 &&
    /^@media\s*\(prefers-color-scheme:\s*dark\)$/.test(media[0] ?? "") &&
    /:root:not\(\[data-theme\]\)/.test(selector)
  )
    return "dark-no-script";
  return "unrecognised";
}

/** Custom properties set to a hex colour, with the theme context each is declared in. */
export function colourDeclarations(css: string): ColourDeclaration[] {
  // Comments are blanked, not deleted, so a line number still points at the source line.
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const stack: string[] = [];
  const out: ColourDeclaration[] = [];
  let buffer = "";
  let line = 1;
  const flush = () => {
    const match = /^\s*(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*$/.exec(buffer);
    if (match?.[1] && match[2])
      out.push({
        property: match[1],
        value: match[2].toLowerCase(),
        context: contextOf(stack),
        line,
      });
  };
  for (const ch of text) {
    if (ch === "{") {
      stack.push(buffer.trim());
      buffer = "";
    } else if (ch === "}") {
      flush();
      stack.pop();
      buffer = "";
    } else if (ch === ";") {
      flush();
      buffer = "";
    } else {
      if (ch === "\n") line += 1;
      buffer += ch;
    }
  }
  return out;
}

/** Every reason the declarations in one stylesheet fall short. */
export function colourFindings(file: string, declarations: readonly ColourDeclaration[]): string[] {
  const findings: string[] = [];
  const byProperty = new Map<string, ColourDeclaration[]>();
  for (const d of declarations) {
    if (d.context === "unrecognised")
      findings.push(`${file}:${d.line} ${d.property}: declared outside a recognised theme context`);
    else byProperty.set(d.property, [...(byProperty.get(d.property) ?? []), d]);
  }
  for (const [property, list] of byProperty) {
    const one = (context: Context) => list.filter((d) => d.context === context);
    const [light, dark, noScript] = [one("light"), one("dark"), one("dark-no-script")];
    if (light.length !== 1) {
      findings.push(`${file} ${property}: ${light.length} light declarations, expected 1`);
      continue;
    }
    if (dark.length > 1 || noScript.length > 1)
      findings.push(`${file} ${property}: a dark block declares it more than once`);
    if (dark[0]?.value !== noScript[0]?.value)
      findings.push(
        `${file} ${property}: dark ${dark[0]?.value ?? "(none)"} but no-script dark ${noScript[0]?.value ?? "(none)"}`,
      );
    const values = { light: light[0]?.value ?? "", dark: dark[0]?.value ?? light[0]?.value ?? "" };
    for (const surface of SURFACES[property] ?? DEFAULT_SURFACES) {
      for (const [theme, id] of [
        ["light", "annalen"],
        ["dark", "kramgasse-night"],
      ] as const) {
        const ratio = contrastRatio(values[theme], THEME_TOKENS[id][surface]);
        if (ratio < MARK_MIN)
          findings.push(
            `${file} ${property}: ${values[theme]} is ${ratio.toFixed(2)}:1 on the ${theme} theme's ${surface}`,
          );
      }
    }
  }
  return findings;
}

function styleSheets(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return styleSheets(full);
    return name.endsWith(".css") ? [full] : [];
  });
}

describe("lab drawing colours stand out on their surface in both themes", () => {
  test("every colour property in a lab stylesheet clears 3:1, and its two dark blocks agree", () => {
    const files = LAB_STYLE_DIRS.flatMap((dir) => styleSheets(join(ROOT, dir)));
    const findings: string[] = [];
    let properties = 0;
    let declaring = 0;
    for (const file of files) {
      const declarations = colourDeclarations(readFileSync(file, "utf8"));
      if (declarations.length === 0) continue;
      declaring += 1;
      properties += new Set(declarations.map((d) => d.property)).size;
      findings.push(...colourFindings(relative(ROOT, file), declarations));
    }
    console.log(
      `[lab colours] ${files.length} stylesheets, ${declaring} declaring colours; ${properties} properties; ${findings.length} findings`,
    );
    // Not vacuous: on 2026-09-24 six stylesheets declared 17 such properties.
    expect(properties).toBeGreaterThan(0);
    expect(findings).toEqual([]);
  });

  test("the reader skips comments and classifies the three theme contexts", () => {
    const css = `
      /* .x { --in-comment: #000000; } */
      .x { --light: #047857; /* --also-comment: #000; */ --second: #1d4ed8; }
      :root[data-theme="kramgasse-night"] .x { --light: #10b981; }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme]) .x { --light: #10b981; }
      }
      @media (max-width: 40rem) { .x { --narrow: #b45309; } }
      .x { --not-a-colour: 19px; }
    `;
    expect(colourDeclarations(css).map((d) => `${d.property} ${d.value} ${d.context}`)).toEqual([
      "--light #047857 light",
      "--second #1d4ed8 light",
      "--light #10b981 dark",
      "--light #10b981 dark-no-script",
      "--narrow #b45309 unrecognised",
    ]);
  });

  test("planted negatives: low contrast, dark blocks that disagree, and an unrecognised context", () => {
    const css = `
      .x { --faint: #10b981; --drift: #047857; --ok: #047857; }
      :root[data-theme="kramgasse-night"] .x { --drift: #10b981; --ok: #10b981; }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme]) .x { --drift: #34d399; --ok: #10b981; }
      }
      @media print { .x { --printed: #000000; } }
    `;
    expect(colourFindings("plant.css", colourDeclarations(css))).toEqual([
      "plant.css:7 --printed: declared outside a recognised theme context",
      "plant.css --faint: #10b981 is 2.45:1 on the light theme's paper",
      "plant.css --faint: #10b981 is 2.27:1 on the light theme's wash",
      "plant.css --drift: dark #10b981 but no-script dark #34d399",
    ]);
  });
});
