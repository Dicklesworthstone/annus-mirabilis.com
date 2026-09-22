import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { runSmokeJourney } from "./smoke.ts";

const HEAD = "<!DOCTYPE html><html><head><title>Annus Mirabilis: 1905</title></head><body>";
const IDENTITY =
  "<h1>Annus Mirabilis</h1><nav><a href='/paper/brownian-motion'>Brownian Motion</a></nav>";

/**
 * Mirrors the contract ThemeToggle.tsx exposes to a reader: a
 * `fieldset.theme-toggle` radio group whose selection writes
 * `document.documentElement.dataset.theme`. This fixture proves the CHECK is
 * live; that the real site honours the same contract is proven separately by
 * running the journey against the static build (am-im0x).
 *
 * TWO radios, and the split label, because the check drives two transitions and
 * finds each one by its accessible name. A fixture with one radio cannot reach
 * the state the check exists to observe, so the check would pass on a page where
 * the theme never changed - which is precisely what it did after `slate` was
 * removed from here and from the step list.
 */
/**
 * The theme control this fixture serves, as the site actually renders it: ONE icon button whose
 * accessible name is the action a press takes (the owner, 2026-09-22: "a single toggle that is
 * either an icon of sun or a moon"). It served a switch named "Dark theme" before that.
 *
 * The fixture must stay a FAITHFUL STAND-IN, not merely something the check accepts, so the part
 * that decides the name is copied from themes.css rather than invented: both names are in the
 * button, visually hidden, and the one that does not apply to the current data-theme is
 * display: none. The check computes the name through getByRole, so it sees exactly what that CSS
 * leaves. It starts on annalen, as the home page does under a light device setting.
 */
const themeButton = (hideWhenDark: string, hideWhenLight: string) => `<style>
.theme-toggle-name{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
:root[data-theme="kramgasse-night"] ${hideWhenDark},:root:not([data-theme="kramgasse-night"]) ${hideWhenLight}{display:none}
</style>
<button type="button" class="theme-toggle"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="6"/></svg>
<span class="theme-toggle-name theme-toggle-to-dark">Switch to dark theme</span>
<span class="theme-toggle-name theme-toggle-to-light">Switch to light theme</span>
</button>
<script>
document.documentElement.dataset.theme = "annalen";
document.querySelector("button.theme-toggle").addEventListener("click", () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "kramgasse-night" ? "annalen" : "kramgasse-night";
});
</script>`;
const THEME_GROUP = themeButton(".theme-toggle-to-dark", ".theme-toggle-to-light");
/** Planted wrong: the CSS keeps the name of the theme the reader is already on. */
const THEME_WRONG_NAME = themeButton(".theme-toggle-to-light", ".theme-toggle-to-dark");

function serve(
  homeBody: string,
  homeHead: string = HEAD,
): Promise<{ baseUrl: string; server: Server }> {
  const server = createServer((req, res) => {
    const notFound = req.url !== "/";
    res.writeHead(notFound ? 404 : 200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      notFound
        ? `${HEAD}<h1>404 Not Found</h1></body></html>`
        : `${homeHead}${homeBody}</body></html>`,
    );
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ baseUrl: `http://127.0.0.1:${port}`, server });
    });
  });
}
const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

test("the theme check drives the real toggle and reports the observed data-theme", async () => {
  const { baseUrl, server } = await serve(IDENTITY + THEME_GROUP);
  try {
    const result = await runSmokeJourney({ baseUrl });
    const theme = result.checks.find((c) => c.check === "theme-toggle");
    assert.equal(theme?.ok, true);
    // The message must name what was observed, not merely that something was found.
    assert.match(theme?.message ?? "", /kramgasse-night then annalen/);
    assert.match(theme?.message ?? "", /renamed after each press/);
  } finally {
    await close(server);
  }
});

test("an absent theme control fails the check instead of passing it", async () => {
  const { baseUrl, server } = await serve(IDENTITY);
  try {
    const result = await runSmokeJourney({ baseUrl });
    const theme = result.checks.find((c) => c.check === "theme-toggle");
    assert.equal(theme?.ok, false);
    // The selector the refusal names, so a reader of a failing smoke run is told what was looked
    // for. It named button[role="switch"].theme-switch until the control became an icon button.
    assert.match(theme?.message ?? "", /button\.theme-toggle/);
    assert.equal(result.ok, false);
  } finally {
    await close(server);
  }
});

test("a toggle whose name says the theme it is already on fails the check", async () => {
  // The planted wrong implementation: present, clickable, and changing data-theme, but named for
  // the wrong action. A check that asserted presence and the theme change alone would pass it.
  const { baseUrl, server } = await serve(IDENTITY + THEME_WRONG_NAME);
  try {
    const result = await runSmokeJourney({ baseUrl });
    const theme = result.checks.find((c) => c.check === "theme-toggle");
    assert.equal(theme?.ok, false);
    assert.match(theme?.message ?? "", /is not named "Switch to dark theme"/);
  } finally {
    await close(server);
  }
});

test("an unmounted command palette fails the check and names what was searched for", async () => {
  const { baseUrl, server } = await serve(IDENTITY + THEME_GROUP);
  try {
    const result = await runSmokeJourney({ baseUrl });
    const palette = result.checks.find((c) => c.check === "command-palette");
    assert.equal(palette?.ok, false);
    assert.match(palette?.message ?? "", /data-command-palette-trigger/);
    assert.match(palette?.message ?? "", /CommandPalette\.tsx/);
  } finally {
    await close(server);
  }
});

test("the journey reports four checks, home first and not-found second", async () => {
  const { baseUrl, server } = await serve(IDENTITY + THEME_GROUP);
  try {
    const result = await runSmokeJourney({ baseUrl });
    assert.equal(result.checks.length, 4);
    assert.equal(result.checks[0]?.check, "home-page");
    assert.equal(result.checks[0]?.ok, true);
    assert.equal(result.checks[1]?.check, "not-found-page");
    assert.equal(result.checks[1]?.ok, true);
  } finally {
    await close(server);
  }
});

test("runSmokeJourney: fails when home page does not contain product identity", async () => {
  const { baseUrl, server } = await serve(
    "<h1>Hello World</h1>",
    "<!DOCTYPE html><html><head><title>Generic Page</title></head><body>",
  );
  try {
    const result = await runSmokeJourney({ baseUrl });
    assert.equal(result.ok, false);
    const homeCheck = result.checks.find((c) => c.check === "home-page");
    assert.equal(homeCheck?.ok, false);
    assert.match(homeCheck?.message || "", /product identity/);
  } finally {
    await close(server);
  }
});
