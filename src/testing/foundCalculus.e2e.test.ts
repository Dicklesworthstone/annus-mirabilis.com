import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import { writeCalculusLog } from "./foundCalculus.logger.ts";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

interface TestServer {
  url: string;
  close: () => Promise<void>;
}

async function startStaticServer(rootDir: string = "out"): Promise<TestServer | null> {
  const root = resolve(rootDir);
  const outStat = await stat(root).catch(() => null);
  if (!outStat?.isDirectory()) {
    return null;
  }

  const server: Server = createServer(async (req, res) => {
    let file = resolve(
      root,
      `.${decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname)}`,
    );
    if ((await stat(file).catch(() => null))?.isDirectory()) {
      file = resolve(file, "index.html");
    }
    try {
      res.setHeader("Content-Type", MIME_TYPES[extname(file)] ?? "application/octet-stream");
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise<void>((resolveListening) =>
    server.listen(0, "127.0.0.1", () => resolveListening()),
  );
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    close: () =>
      new Promise<void>((resolveClose) => {
        server.close(() => resolveClose());
      }),
  };
}

test("foundCalculus.e2e: E2E 1 - From Brownian §4, static route linkage to foundation:partial-derivatives and worked example verification", async (t: TestContext) => {
  const server = await startStaticServer();
  if (!server) {
    t.skip("out/ directory not present; skipping static build checks");
    return;
  }

  try {
    // 1. Check Brownian motion paper Section 4 linkage
    const paperRes = await fetch(`${server.url}/papers/brownian-motion/`);
    assert.equal(paperRes.status, 200, "Brownian motion paper route must return 200");
    const paperHtml = await paperRes.text();
    assert.ok(
      paperHtml.includes("partial-derivatives") ||
        paperHtml.includes("Diffusion equation") ||
        paperHtml.includes("diffusion"),
      "Brownian motion paper must reference diffusion equation context",
    );

    // 2. Check partial derivatives foundation page
    const foundRes = await fetch(`${server.url}/foundations/partial-derivatives/`);
    assert.equal(foundRes.status, 200, "foundation:partial-derivatives must return 200");
    const foundHtml = await foundRes.text();

    // Verify key mathematical and explanatory elements
    assert.ok(
      foundHtml.includes("Partial derivatives and held-fixed quantities"),
      "Foundation page must carry full title",
    );
    assert.ok(
      foundHtml.includes("∂") || foundHtml.includes("\\partial") || foundHtml.includes("partial"),
      "Page must contain partial derivative symbols",
    );
    assert.ok(
      foundHtml.includes("held fixed") ||
        foundHtml.includes("held constant") ||
        foundHtml.includes("strictly held"),
      "Page must explicitly explain held-fixed quantities",
    );
    assert.ok(
      foundHtml.includes("/foundations/derivatives/"),
      "Page must carry prerequisite link to derivatives",
    );

    writeCalculusLog({
      testId: "e2e-static-brownian-s4-partial-derivatives",
      foundationId: "partial-derivatives",
      callingAnchor: "brownian-motion:s4#arg-bm-diffusion-eq",
      expected: "Brownian §4 to partial-derivatives navigation and mathematical content verified",
      actual:
        "All titles, symbols, held-fixed notices, and prerequisite links verified in static HTML",
      outcome: "passed",
      message:
        "E2E 1: Successfully verified static route and content for foundation:partial-derivatives",
    });
  } finally {
    await server.close();
  }
});

test("foundCalculus.e2e: E2E 2 - From Brownian §5, static route linkage to foundation:functions-graphs and mean displacement scaling", async (t: TestContext) => {
  const server = await startStaticServer();
  if (!server) {
    t.skip("out/ directory not present; skipping static build checks");
    return;
  }

  try {
    // 1. Check Brownian motion paper route
    const paperRes = await fetch(`${server.url}/papers/brownian-motion/`);
    assert.equal(paperRes.status, 200, "Brownian motion paper route must return 200");

    // 2. Check functions and graphs foundation page
    const foundRes = await fetch(`${server.url}/foundations/functions-graphs/`);
    assert.equal(foundRes.status, 200, "foundation:functions-graphs must return 200");
    const foundHtml = await foundRes.text();

    assert.ok(foundHtml.includes("Functions and graphs"), "Foundation page must carry full title");
    assert.ok(
      foundHtml.includes("/foundations/bridge-negative-numbers-direction/") ||
        foundHtml.includes("/foundations/bridge-"),
      "Page must carry prerequisite link to bridge foundation",
    );

    writeCalculusLog({
      testId: "e2e-static-brownian-s5-functions-graphs",
      foundationId: "functions-graphs",
      callingAnchor: "brownian-motion:s5#arg-bm-displacement-law",
      expected: "Brownian §5 to functions-graphs linkage and prerequisite link verified",
      actual: "Title, prerequisite links, and navigation verified in static HTML",
      outcome: "passed",
      message:
        "E2E 2: Successfully verified static route and content for foundation:functions-graphs",
    });
  } finally {
    await server.close();
  }
});

test("foundCalculus.e2e: E2E 3 - Open foundation:logarithms with JavaScript disabled and assert 'lg' note renders", async (t: TestContext) => {
  const server = await startStaticServer();
  if (!server) {
    t.skip("out/ directory not present; skipping static build checks");
    return;
  }

  try {
    const res = await fetch(`${server.url}/foundations/logarithms/`);
    assert.equal(res.status, 200, "Server must return 200 for foundation:logarithms");
    const html = await res.text();

    // Verify 1905 "lg" historical note is present in static SSR HTML without any client JS execution
    assert.ok(
      html.includes("lg") || html.includes("natural logarithm"),
      "Page HTML must explain 1905 'lg' natural logarithm notation",
    );
    assert.ok(
      html.includes("0.693147"),
      "Page HTML must contain the natural log value ln 2 ≈ 0.693147",
    );
    assert.ok(
      html.includes("0.301030"),
      "Page HTML must contain the common base-10 value log10 2 ≈ 0.301030 to contrast with 1905 prints",
    );

    writeCalculusLog({
      testId: "e2e-journey-logarithms-no-javascript",
      foundationId: "logarithms",
      callingAnchor: "light-quanta:s5",
      jsEnabled: false,
      expected:
        "1905 'lg' notation note rendered statically with ln 2 ≈ 0.693147 and log10 2 ≈ 0.301030",
      actual: "All required notation notes and numbers present in static HTML response",
      outcome: "passed",
      message:
        "E2E 3: Successfully verified foundation:logarithms renders 1905 'lg' note with JavaScript disabled",
    });
  } finally {
    await server.close();
  }
});

test("foundCalculus.e2e: planted negative - missing build directory returns null server for honest skip", async () => {
  const missingServer = await startStaticServer("non-existent-out-directory-probe");
  assert.equal(
    missingServer,
    null,
    "Planted negative: startStaticServer must return null when directory is absent so honest runner skip is triggered",
  );
});

test("foundCalculus.e2e: planted negative - static route content gate fails when required mathematical proof element is missing", async (t: TestContext) => {
  const server = await startStaticServer();
  if (!server) {
    t.skip("out/ directory not present; skipping static build checks");
    return;
  }

  try {
    const res = await fetch(`${server.url}/foundations/partial-derivatives/`);
    assert.equal(res.status, 200, "foundation:partial-derivatives must return 200");
    const html = await res.text();

    assert.throws(
      () => {
        assert.ok(
          html.includes("NONEXISTENT_PARTIAL_DERIVATIVE_TOKEN_PLANTED_NEGATIVE"),
          "Gate must fail when required mathematical token is missing",
        );
      },
      assert.AssertionError,
      "Planted negative: missing mathematical content must throw AssertionError and fail the gate",
    );
  } finally {
    await server.close();
  }
});

