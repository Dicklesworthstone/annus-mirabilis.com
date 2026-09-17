import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { runSmokeJourney } from "./smoke.ts";

test("runSmokeJourney: passes against server serving home page and 404 page", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!DOCTYPE html><html><head><title>Annus Mirabilis: 1905</title></head><body><h1>Annus Mirabilis</h1><nav><a href='/paper/brownian-motion'>Brownian Motion</a></nav></body></html>");
    } else {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>");
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await runSmokeJourney({ baseUrl });
    assert.equal(result.ok, true);
    assert.equal(result.checks.length, 4);
    assert.equal(result.checks[0]?.check, "home-page");
    assert.equal(result.checks[0]?.ok, true);
    assert.equal(result.checks[1]?.check, "not-found-page");
    assert.equal(result.checks[1]?.ok, true);
    assert.equal(result.checks[2]?.check, "theme-toggle");
    assert.equal(result.checks[2]?.ok, true);
    assert.equal(result.checks[3]?.check, "command-palette");
    assert.equal(result.checks[3]?.ok, true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("runSmokeJourney: fails when home page does not contain product identity", async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!DOCTYPE html><html><head><title>Generic Page</title></head><body><h1>Hello World</h1></body></html>");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await runSmokeJourney({ baseUrl });
    assert.equal(result.ok, false);
    const homeCheck = result.checks.find((c) => c.check === "home-page");
    assert.equal(homeCheck?.ok, false);
    assert.match(homeCheck?.message || "", /product identity/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
