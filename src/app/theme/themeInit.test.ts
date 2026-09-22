import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  buildInlineScriptHashManifest,
  sha256Base64,
} from "../../../scripts/build/inline-script-hashes";
import { storageKeyRegistry } from "../../platform/storage/keys";
import { createContainer, installDom, removeContainer, uninstallDom } from "../../testing/reactDom";
import { INLINE_SCRIPT_REGISTRY } from "../inline-scripts/registry";
import { ThemeToggle } from "./ThemeToggle";
import {
  initTheme,
  KNOWN_THEME_IDS,
  THEME_FOLLOW_SYSTEM,
  THEME_INIT_SOURCE,
  THEME_STORAGE_KEY,
} from "./themeInit.inline";

function stubMatchMedia(prefersDark: boolean) {
  (globalThis as { matchMedia?: unknown }).matchMedia = (query: string) => ({
    matches: query.includes("dark") ? prefersDark : !prefersDark,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
}

beforeEach(async () => {
  await installDom();
  stubMatchMedia(false);
});
afterEach(async () => {
  try {
    localStorage.clear();
  } catch {
    /* not every test leaves storage in a clearable state */
  }
  await uninstallDom();
});

describe("THEME_STORAGE_KEY: the key constant, shared with the real storage registry", () => {
  test("equals the registry's own key for 'theme', not a second hardcoded copy", () => {
    const registration = storageKeyRegistry.get(THEME_STORAGE_KEY);
    expect(registration).toBeDefined();
    expect(registration?.key).toBe(THEME_STORAGE_KEY);
    if (registration?.kind !== "setting") throw new Error("Expected a setting registration.");
    expect(registration.allowedValues).toEqual(["annalen", "kramgasse-night"]);
  });
});

describe("initTheme: stored preference", () => {
  test("a valid stored theme wins", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "kramgasse-night");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
  });

  test("an invalid stored value falls back to annalen, not the invalid value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "not-a-real-theme");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });
});

describe("initTheme: route default from data-route-theme", () => {
  test("an explicit route default is used when nothing is stored", () => {
    document.documentElement.setAttribute("data-route-theme", "kramgasse-night");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
  });

  test("a stored preference wins over the route default", () => {
    document.documentElement.setAttribute("data-route-theme", "kramgasse-night");
    localStorage.setItem(THEME_STORAGE_KEY, "annalen");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });

  test("an invalid route default falls back to annalen", () => {
    document.documentElement.setAttribute("data-route-theme", "not-a-theme");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });
});

describe("initTheme: Slate default via data-route-theme attribute (AGENTS.md constraint)", () => {
  test("data-route-theme on documentElement selects kramgasse-night when nothing is stored", () => {
    document.documentElement.setAttribute("data-route-theme", "kramgasse-night");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
  });

  test("data-route-theme on a container element selects kramgasse-night when nothing is stored", () => {
    const div = document.createElement("div");
    div.setAttribute("data-route-theme", "kramgasse-night");
    document.body.appendChild(div);
    try {
      initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
      expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
    } finally {
      div.remove();
    }
  });

  test("meta[name='data-route-theme'] in head selects kramgasse-night when nothing is stored", () => {
    const meta = document.createElement("meta");
    meta.name = "data-route-theme";
    meta.content = "kramgasse-night";
    document.head.appendChild(meta);
    try {
      initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
      expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
    } finally {
      meta.remove();
    }
  });

  test("an explicit stored reader preference wins over data-route-theme", () => {
    document.documentElement.setAttribute("data-route-theme", "kramgasse-night");
    localStorage.setItem(THEME_STORAGE_KEY, "annalen");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });

  test("stored kramgasse-night wins over data-route-theme", () => {
    document.documentElement.setAttribute("data-route-theme", "kramgasse-night");
    localStorage.setItem(THEME_STORAGE_KEY, "kramgasse-night");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
  });

  test("pages without data-route-theme fall back to annalen when nothing is stored", () => {
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });

  test("planted negative: a simulated resolver that ignores data-route-theme yields wrong theme", () => {
    document.documentElement.setAttribute("data-route-theme", "kramgasse-night");
    // If a resolver ignores the attribute and only inspects storage:
    const mockTheme = localStorage.getItem(THEME_STORAGE_KEY) ?? "annalen";
    expect(mockTheme).toBe("annalen"); // Proves ignoring data-route-theme fails to apply the route's dark theme
  });
});

describe("initTheme: follow-system", () => {
  test("maps a dark system preference to kramgasse-night", () => {
    stubMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, "follow-system");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
  });

  test("maps a light system preference to annalen", () => {
    stubMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, "follow-system");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });

  test("follow-system wins over a route default (an explicit reader choice always wins)", () => {
    stubMatchMedia(true);
    document.documentElement.setAttribute("data-route-theme", "annalen");
    localStorage.setItem(THEME_STORAGE_KEY, "follow-system");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
  });
});

describe("initTheme: no stored preference, no route default", () => {
  test("falls back to annalen, never a dark theme by default", () => {
    stubMatchMedia(true); // even with a dark system preference
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });
});

describe("initTheme: storage exceptions never throw", () => {
  test("a throwing localStorage.getItem still resolves a theme", () => {
    const originalGetItem = localStorage.getItem.bind(localStorage);
    localStorage.getItem = () => {
      throw new Error("storage unavailable");
    };
    try {
      expect(() =>
        initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS),
      ).not.toThrow();
      expect(document.documentElement.dataset.theme).toBe("annalen");
    } finally {
      localStorage.getItem = originalGetItem;
    }
  });
});

describe("THEME_INIT_SOURCE: a self-contained, immediately-invoked expression", () => {
  test("has no imports and no require calls", () => {
    expect(THEME_INIT_SOURCE.startsWith("(function initTheme(")).toBe(true);
    expect(THEME_INIT_SOURCE.trimEnd().endsWith(");")).toBe(true);
    for (const spliced of ["THEME_STORAGE_KEY", "THEME_FOLLOW_SYSTEM", "KNOWN_THEME_IDS"]) {
      expect(THEME_INIT_SOURCE).not.toContain(spliced);
    }
    expect(THEME_INIT_SOURCE).not.toContain("import ");
    expect(THEME_INIT_SOURCE).not.toContain("require(");
  });

  test("inlines the real storage key literally", () => {
    expect(THEME_INIT_SOURCE).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  test("executing the derived source produces the same result as calling the function directly", () => {
    document.documentElement.setAttribute("data-route-theme", "kramgasse-night");
    // eslint-disable-next-line no-new-func
    new Function(THEME_INIT_SOURCE)();
    expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
  });
});

describe("ThemeToggle: UI reflection of active theme and user selection", () => {
  /**
   * These followed the three-radio fieldset that stood here until 2026-09-22, when the owner
   * ruled the edition has "a single dark/light toggle". They are rewritten rather than deleted:
   * every property they protected still applies to the switch, and a test that keeps querying
   * `input[type="radio"]` would fail on the markup while proving nothing about the behaviour.
   */
  async function renderToggle() {
    const container = createContainer();
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ThemeToggle));
    });
    return { container, root };
  }

  function switchOf(container: HTMLElement): HTMLButtonElement {
    const el = container.querySelector('button[role="switch"]');
    if (!el) throw new Error("Expected a single theme switch to exist");
    return el as HTMLButtonElement;
  }

  test("reflects the dark theme default on /discover when nothing is stored", async () => {
    document.documentElement.dataset.theme = "kramgasse-night";
    const { container, root } = await renderToggle();
    // State lives in aria-checked, not in which of several controls is selected.
    expect(switchOf(container).getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("explicit user selection updates localStorage and overrides route default", async () => {
    document.documentElement.dataset.theme = "kramgasse-night";
    const { container, root } = await renderToggle();
    await act(async () => {
      switchOf(container).click();
    });
    expect(document.documentElement.dataset.theme).toBe("annalen");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("annalen");
    expect(switchOf(container).getAttribute("aria-checked")).toBe("false");
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("there is ONE theme control, and system preference is not a third choice", async () => {
    // The ruling was about the count. Three controls became one, and "System" stopped being a
    // visible option: with nothing stored the switch reflects the resolved preference instead.
    document.documentElement.dataset.theme = "annalen";
    const { container, root } = await renderToggle();
    expect(container.querySelectorAll('button[role="switch"]').length).toBe(1);
    expect(container.querySelectorAll('input[type="radio"]').length).toBe(0);
    expect(container.textContent ?? "").not.toContain("System");
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("the switch shows a short word and keeps the theme's own name in the accessible name", async () => {
    document.documentElement.dataset.theme = "annalen";
    const { container, root } = await renderToggle();
    const control = switchOf(container);
    const hidden = control.querySelector(".theme-switch-full-name");
    // A control that dropped the span would read only "Dark" to a screen reader, and the edition
    // would have lost its theme's name to a layout fix.
    expect(hidden).not.toBeNull();
    const accessibleName = control.textContent ?? "";
    const visible = accessibleName.replace(hidden?.textContent ?? "", "").trim();
    expect(visible).toBe("Dark");
    // WCAG 2.5.3: the accessible name CONTAINS the visible label, which is why the full name is
    // appended rather than substituted for the short word.
    expect(accessibleName).toContain(visible);
    // The name completes the visible word to a control's job description and stops there.
    expect(accessibleName.replace(/\s+/g, " ").trim()).toBe("Dark theme");
    // It used to append the edition's theme name as well. That reached screen-reader users ONLY -
    // .theme-switch-full-name is clipped to 1px and "Kramgasse Night" renders nowhere a sighted
    // reader can see it - so the parenthetical was verbosity charged to one audience on every
    // page. If it comes back, it comes back visibly, for everyone.
    expect(accessibleName).not.toContain("Kramgasse");

    // The name is FIXED across states. A control labelled "Switch to dark" renames itself on
    // press, so a screen-reader user re-reading it hears the opposite of what they chose.
    await act(async () => {
      control.click();
    });
    expect(switchOf(container).textContent).toBe(accessibleName);

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("the announcement never adds a row to the header after the reader clicks", async () => {
    document.documentElement.dataset.theme = "annalen";
    const { container, root } = await renderToggle();
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-live")).toBe("polite");
    // Visually hidden, not removed: it is the only announcement a screen reader gets for a change
    // it cannot see. Left visible it grew the header in response to the reader's own click.
    expect(status?.className).toBe("theme-switch-announcement");
    expect(status?.textContent).toBe("");

    await act(async () => {
      switchOf(container).click();
    });
    expect(status?.textContent).toBe("Theme changed to Kramgasse Night.");
    expect(status?.className).toBe("theme-switch-announcement");

    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });
});

describe("theme script manifest registration (AC 7)", () => {
  test("INLINE_SCRIPT_REGISTRY contains the theme script with exact metadata and source", () => {
    const entry = INLINE_SCRIPT_REGISTRY.find((e) => e.id === "theme");
    expect(entry).toBeDefined();
    expect(entry?.ownerBeadId).toBe("am-design-themes-typography-288q");
    expect(entry?.module).toBe("src/app/theme/themeInit.inline.ts");
    expect(entry?.source).toBe(THEME_INIT_SOURCE);
    expect(entry?.routes).toBe("all");
  });

  test("the theme script's hash appears in the compiled manifest matching sha256Base64(THEME_INIT_SOURCE)", () => {
    const manifest = buildInlineScriptHashManifest(INLINE_SCRIPT_REGISTRY, {
      buildRevision: "test-rev",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const themeManifestEntry = manifest.scripts.find((s) => s.id === "theme");
    expect(themeManifestEntry).toBeDefined();
    expect(themeManifestEntry?.ownerBeadId).toBe("am-design-themes-typography-288q");
    expect(themeManifestEntry?.sha256).toBe(sha256Base64(THEME_INIT_SOURCE));
    expect(themeManifestEntry?.length).toBe(Buffer.byteLength(THEME_INIT_SOURCE, "utf8"));
  });

  test("planted negative: a corrupted script source or missing registration fails hash verification", () => {
    const manifest = buildInlineScriptHashManifest(INLINE_SCRIPT_REGISTRY, {
      buildRevision: "test-rev",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const themeManifestEntry = manifest.scripts.find((s) => s.id === "theme");
    expect(themeManifestEntry).toBeDefined();

    function verifyScriptHash(
      id: string,
      actualSource: string,
    ): { valid: boolean; reason?: string } {
      const entry = manifest.scripts.find((s) => s.id === id);
      if (!entry) return { valid: false, reason: "missing from manifest" };
      const actualHash = sha256Base64(actualSource);
      if (entry.sha256 !== actualHash) {
        return {
          valid: false,
          reason: `hash mismatch: expected ${entry.sha256}, got ${actualHash}`,
        };
      }
      return { valid: true };
    }

    // Honest check: real source passes
    expect(verifyScriptHash("theme", THEME_INIT_SOURCE).valid).toBe(true);

    // Negative 1: modified source fails
    const corrupted = `${THEME_INIT_SOURCE} /* mutation */`;
    const corruptedResult = verifyScriptHash("theme", corrupted);
    expect(corruptedResult.valid).toBe(false);
    expect(corruptedResult.reason).toContain("hash mismatch");

    // Negative 2: unregistered script ID fails
    const unregisteredResult = verifyScriptHash("rogue-theme", THEME_INIT_SOURCE);
    expect(unregisteredResult.valid).toBe(false);
    expect(unregisteredResult.reason).toBe("missing from manifest");
  });
});

describe("self-hosted typography wiring: font files, licenses, and @font-face declarations", () => {
  const THEMES_CSS_PATH = join(dirname(fileURLToPath(import.meta.url)), "themes.css");
  const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../public/fonts");
  const cssContent = readFileSync(THEMES_CSS_PATH, "utf8");

  const EXPECTED_FAMILIES = [
    {
      family: "Newsreader",
      subpath: "newsreader/Newsreader-Variable.ttf",
      licenseSubpath: "newsreader/OFL.txt",
    },
    {
      family: "Plus Jakarta Sans",
      subpath: "plus-jakarta-sans/PlusJakartaSans-Variable.ttf",
      licenseSubpath: "plus-jakarta-sans/OFL.txt",
    },
    {
      family: "JetBrains Mono",
      subpath: "jetbrains-mono/JetBrainsMono-Variable.ttf",
      licenseSubpath: "jetbrains-mono/OFL.txt",
    },
  ];

  for (const item of EXPECTED_FAMILIES) {
    test(`@font-face declares self-hosted ${item.family} with font-display: swap`, () => {
      const pattern = new RegExp(
        `@font-face\\s*\\{[^}]*font-family:\\s*"${item.family}"[^}]*\\}`,
        "g",
      );
      const match = cssContent.match(pattern);
      expect(match).not.toBeNull();
      const block = match?.[0] ?? "";
      expect(block).toContain("font-display: swap");
      expect(block).toContain(`/fonts/${item.subpath}`);
      expect(block).not.toMatch(/https?:\/\//i);
    });

    test(`${item.family} font binary and OFL license exist on disk in public/fonts`, () => {
      const fontFilePath = join(FONTS_DIR, item.subpath);
      const licenseFilePath = join(FONTS_DIR, item.licenseSubpath);
      expect(existsSync(fontFilePath)).toBe(true);
      expect(existsSync(licenseFilePath)).toBe(true);

      const licenseText = readFileSync(licenseFilePath, "utf8");
      expect(licenseText).toContain("SIL OPEN FONT LICENSE");
    });
  }

  test("planted negative: an external font URL or missing OFL license is rejected", () => {
    function auditFontFaceRule(rule: string): { valid: boolean; issue?: string } {
      if (/https?:\/\//i.test(rule)) {
        return { valid: false, issue: "External font URL detected (must be self-hosted)" };
      }
      if (!rule.includes("font-display: swap")) {
        return { valid: false, issue: "Missing font-display: swap" };
      }
      return { valid: true };
    }

    const goodRule = `@font-face { font-family: "Newsreader"; src: url("/fonts/newsreader/Newsreader-Variable.ttf"); font-display: swap; }`;
    expect(auditFontFaceRule(goodRule).valid).toBe(true);

    const badExternalRule = `@font-face { font-family: "Newsreader"; src: url("https://example.com/newsreader.woff2"); font-display: swap; }`;
    expect(auditFontFaceRule(badExternalRule).valid).toBe(false);
    expect(auditFontFaceRule(badExternalRule).issue).toContain("External font URL");

    const badNoSwapRule = `@font-face { font-family: "Newsreader"; src: url("/fonts/newsreader/Newsreader-Variable.ttf"); }`;
    expect(auditFontFaceRule(badNoSwapRule).valid).toBe(false);
    expect(auditFontFaceRule(badNoSwapRule).issue).toContain("font-display: swap");
  });
});
