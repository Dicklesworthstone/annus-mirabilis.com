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
 * The theme control this fixture serves, as the site actually renders it.
 *
 * It served a three-radio fieldset until 2026-09-22. 884dfc19 replaced that control with one
 * switch and 17104098 moved the real check in smoke.ts onto `button[role="switch"].theme-switch`
 * plus an exact accessible name, so this fixture stopped matching what the check looks for and
 * both tests below went red in the node lane.
 *
 * The fixture must stay a FAITHFUL STAND-IN, not merely something the check accepts. Three things
 * here are load-bearing and copied from the real control rather than invented:
 *   - role="switch" with aria-checked, which is how the check finds it by role.
 *   - the accessible name "Dark theme": the visible word "Dark" plus a clipped span reading
 *     " theme". %28's 977308cd dropped the edition's theme name from it, so a fixture saying
 *     "Dark theme (Kramgasse Night)" would now be testing a string the site no longer has.
 *   - starting on annalen, because the check's first expected transition is to kramgasse-night
 *     and a fixture that started dark would let it pass without the control doing anything.
 */
const THEME_GROUP = `<button type="button" role="switch" aria-checked="false" class="theme-switch">
<span class="theme-switch-track" aria-hidden="true"><span class="theme-switch-knob"></span></span>
<span>Dark<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)"> theme</span></span>
</button>
<script>
document.documentElement.dataset.theme = "annalen";
document.querySelector("button.theme-switch").addEventListener("click", (event) => {
  const control = event.currentTarget;
  const next = control.getAttribute("aria-checked") === "true" ? "annalen" : "kramgasse-night";
  control.setAttribute("aria-checked", next === "kramgasse-night" ? "true" : "false");
  document.documentElement.dataset.theme = next;
});
</script>`;

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

test("the theme check drives the real switch and reports the observed data-theme", async () => {
  const { baseUrl, server } = await serve(IDENTITY + THEME_GROUP);
  try {
    const result = await runSmokeJourney({ baseUrl });
    const theme = result.checks.find((c) => c.check === "theme-toggle");
    assert.equal(theme?.ok, true);
    // The message must name what was observed, not merely that something was found.
    assert.match(theme?.message ?? "", /kramgasse-night then annalen/);
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
    // for. It named fieldset.theme-toggle until the control changed shape.
    assert.match(theme?.message ?? "", /button\[role="switch"\]\.theme-switch/);
    assert.equal(result.ok, false);
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
