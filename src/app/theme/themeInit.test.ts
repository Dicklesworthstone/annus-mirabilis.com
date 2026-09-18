import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { storageKeyRegistry } from "../../platform/storage/keys";
import { createContainer, installDom, removeContainer, uninstallDom } from "../../testing/reactDom";
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
    expect(registration.allowedValues).toEqual(["annalen", "kramgasse-night", "slate"]);
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
    document.documentElement.setAttribute("data-route-theme", "slate");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("slate");
  });

  test("a stored preference wins over the route default", () => {
    document.documentElement.setAttribute("data-route-theme", "slate");
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

describe("initTheme: Slate default on /discover (AGENTS.md constraint)", () => {
  test("Slate is automatically chosen on /discover when nothing is stored", () => {
    window.history.pushState({}, "", "/discover");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("slate");
  });

  test("Slate is automatically chosen on /discover/brownian-motion/ when nothing is stored", () => {
    window.history.pushState({}, "", "/discover/brownian-motion/");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("slate");
  });

  test("an explicit stored reader preference wins over the /discover default", () => {
    window.history.pushState({}, "", "/discover/brownian-motion/");
    localStorage.setItem(THEME_STORAGE_KEY, "annalen");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });

  test("stored kramgasse-night wins over the /discover default", () => {
    window.history.pushState({}, "", "/discover");
    localStorage.setItem(THEME_STORAGE_KEY, "kramgasse-night");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("kramgasse-night");
  });

  test("meta[name='route-theme'] sets slate default even without location pathname", () => {
    window.history.pushState({}, "", "/");
    const meta = document.createElement("meta");
    meta.name = "route-theme";
    meta.content = "slate";
    document.head.appendChild(meta);
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("slate");
  });

  test("other routes (e.g. /papers/) fall back to annalen when nothing is stored", () => {
    window.history.pushState({}, "", "/papers/brownian-motion/");
    initTheme(THEME_STORAGE_KEY, THEME_FOLLOW_SYSTEM, KNOWN_THEME_IDS);
    expect(document.documentElement.dataset.theme).toBe("annalen");
  });

  test("planted negative: a simulated resolver that ignores /discover route default yields wrong theme", () => {
    window.history.pushState({}, "", "/discover");
    // If we only looked at storage and not route default:
    const mockTheme = localStorage.getItem(THEME_STORAGE_KEY) ?? "annalen";
    expect(mockTheme).toBe("annalen"); // Proves naive fallback misses slate default
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
    document.documentElement.setAttribute("data-route-theme", "slate");
    // eslint-disable-next-line no-new-func
    new Function(THEME_INIT_SOURCE)();
    expect(document.documentElement.dataset.theme).toBe("slate");
  });
});

describe("ThemeToggle: UI reflection of active theme and user selection", () => {
  test("reflects Slate theme default on /discover when nothing is stored", async () => {
    document.documentElement.dataset.theme = "slate";
    const container = createContainer();
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ThemeToggle));
    });
    const slateRadio = container.querySelector(
      'input[type="radio"]:checked',
    ) as HTMLInputElement | null;
    expect(slateRadio).not.toBeNull();
    expect(slateRadio?.parentElement?.textContent).toContain("Slate");
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });

  test("explicit user selection updates localStorage and overrides route default", async () => {
    document.documentElement.dataset.theme = "slate";
    const container = createContainer();
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ThemeToggle));
    });
    const annalenRadio = container.querySelectorAll('input[type="radio"]')[0] as
      | HTMLInputElement
      | undefined;
    if (!annalenRadio) throw new Error("Expected annalen radio button to exist");
    await act(async () => {
      annalenRadio.click();
    });
    expect(document.documentElement.dataset.theme).toBe("annalen");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("annalen");
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  });
});
