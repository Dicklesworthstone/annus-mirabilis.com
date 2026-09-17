import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { storageKeyRegistry } from "../../platform/storage/keys";
import { installDom, uninstallDom } from "../../testing/reactDom";
import { initTheme, THEME_INIT_SOURCE, THEME_STORAGE_KEY } from "./themeInit.inline";

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
    expect(registration.allowedValues).toEqual(["annalen", "kramgasse-night", "slate"]);
  });
});

describe("initTheme: stored preference", () => {
  test("a valid stored theme wins", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "kramgasse-night");
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
  });

  test("an invalid stored value falls back to annalen, not the invalid value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "not-a-real-theme");
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });
});

describe("initTheme: route default from data-route-theme", () => {
  test("an explicit route default is used when nothing is stored", () => {
    document.documentElement.setAttribute("data-route-theme", "slate");
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("slate");
  });

  test("a stored preference wins over the route default", () => {
    document.documentElement.setAttribute("data-route-theme", "slate");
    localStorage.setItem(THEME_STORAGE_KEY, "annalen");
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });

  test("an invalid route default falls back to annalen", () => {
    document.documentElement.setAttribute("data-route-theme", "not-a-theme");
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });
});

describe("initTheme: follow-system", () => {
  test("maps a dark system preference to kramgasse-night", () => {
    stubMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, "follow-system");
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
  });

  test("maps a light system preference to annalen", () => {
    stubMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, "follow-system");
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });

  test("follow-system wins over a route default (an explicit reader choice always wins)", () => {
    stubMatchMedia(true);
    document.documentElement.setAttribute("data-route-theme", "annalen");
    localStorage.setItem(THEME_STORAGE_KEY, "follow-system");
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
  });
});

describe("initTheme: no stored preference, no route default", () => {
  test("falls back to annalen, never a dark theme by default", () => {
    stubMatchMedia(true); // even with a dark system preference
    initTheme();
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
      expect(() => initTheme()).not.toThrow();
      expect(document.documentElement.dataset.theme).toBe("annalen");
    } finally {
      localStorage.getItem = originalGetItem;
    }
  });
});

describe("THEME_INIT_SOURCE: a self-contained, immediately-invoked expression", () => {
  test("has no imports and no require calls", () => {
    expect(THEME_INIT_SOURCE.startsWith("(function initTheme()")).toBe(true);
    expect(THEME_INIT_SOURCE.trimEnd().endsWith(")();")).toBe(true);
    expect(THEME_INIT_SOURCE).not.toContain("import ");
    expect(THEME_INIT_SOURCE).not.toContain("require(");
  });

  test("inlines the real storage key literally", () => {
    expect(THEME_INIT_SOURCE).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  test("executing the derived source produces the same result as calling the function directly", () => {
    document.documentElement.setAttribute("data-route-theme", "slate");
    // eslint-disable-next-line no-new-func
    new Function(THEME_INIT_SOURCE)();
    expect(document.documentElement.dataset.theme).toBe("slate");
  });
});
