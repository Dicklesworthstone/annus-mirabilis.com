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
 */
const THEME_GROUP = `<fieldset class="theme-toggle"><legend>Theme</legend>
<label><input type="radio" name="t" value="annalen" checked>Annalen</label>
<label><input type="radio" name="t" value="slate">Slate</label>
</fieldset>
<script>
document.documentElement.dataset.theme = "annalen";
for (const input of document.querySelectorAll("input[name=t]"))
  input.addEventListener("change", () => { document.documentElement.dataset.theme = input.value; });
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

test("the theme check drives the real radio group and reports the observed data-theme", async () => {
  const { baseUrl, server } = await serve(IDENTITY + THEME_GROUP);
  try {
    const result = await runSmokeJourney({ baseUrl });
    const theme = result.checks.find((c) => c.check === "theme-toggle");
    assert.equal(theme?.ok, true);
    // The message must name what was observed, not merely that something was found.
    assert.match(theme?.message ?? "", /slate then annalen/);
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
    assert.match(theme?.message ?? "", /fieldset\.theme-toggle/);
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
