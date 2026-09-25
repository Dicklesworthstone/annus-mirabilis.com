import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  allCandidateChecksPassed,
  candidateRoutes,
  type Fetcher,
  REQUEST_ATTEMPTS,
  runCandidateChecksAgainst,
  scriptChunks,
  servedAsBuilt,
  summarizeCandidateChecks,
} from "./candidate-checks.ts";

/**
 * A static tree shaped like `.vercel/output/static`, and a repo root holding mass-energy's frozen
 * ids. The fetcher serves the same files by default, so every check that can run passes; each
 * negative then changes one served thing and names the check that must fail.
 */
function fixture() {
  const staticDir = mkdtempSync(join(tmpdir(), "am-cc-static-"));
  const root = mkdtempSync(join(tmpdir(), "am-cc-root-"));
  const put = (path: string, body: string) => {
    const file = join(staticDir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
  };
  put("papers/mass-energy/index.html", "<main>reading</main>");
  put(
    "papers/mass-energy/view/german/index.html",
    '<main id="main"><p id="s0-p1">Die Resultate</p><div id="eq-s0-d1">l*</div></main>',
  );
  put("lab/bm-01/index.html", '<script src="/_next/static/chunks/lab.js" async=""></script>');
  put("_next/static/chunks/lab.js", "console.log(1)");
  put("foundations/fractions/index.html", "<main>fractions</main>");
  mkdirSync(join(root, "content/source-blocks/mass-energy"), { recursive: true });
  writeFileSync(
    join(root, "content/source-blocks/mass-energy/manifest.ids.snapshot.txt"),
    "s0-p1\neq-s0-d1\n",
  );
  const served = new Map<string, { status: number; body: Buffer }>();
  const fetcher: Fetcher = async (path) => {
    const override = served.get(path);
    if (override) return override;
    const file = join(staticDir, path.endsWith("/") ? `${path}index.html` : path);
    try {
      return { status: 200, body: readFileSync(file) };
    } catch {
      return { status: 404, body: Buffer.from("not found") };
    }
  };
  return { staticDir, root, served, fetcher, put };
}

const byName = (results: { name: string; status: string; detail: string }[], name: string) =>
  results.find((r) => r.name === name);

describe("candidate checks (am-rel-candidate-checks-kc7y)", () => {
  test("the population is read from the uploaded tree", () => {
    const { staticDir } = fixture();
    expect(candidateRoutes(staticDir)).toEqual({
      paperPages: ["/papers/mass-energy/", "/papers/mass-energy/view/german/"],
      labPages: ["/lab/bm-01/"],
      foundationPages: ["/foundations/fractions/"],
    });
    expect(scriptChunks('<script src="/_next/static/chunks/a.js" async=""></script>')).toEqual([
      "/_next/static/chunks/a.js",
    ]);
  });

  test("a candidate serving exactly the build passes every check that can run, and no other", async () => {
    const { staticDir, root, fetcher } = fixture();
    const results = await runCandidateChecksAgainst({ fetcher, staticDir, root });
    expect(results.map((r) => [r.name, r.status])).toEqual([
      ["four-complete-paper-texts", "not-available"],
      ["paper-pages-served-as-built", "passed"],
      ["representative-foundations", "passed"],
      ["every-instrument-bundle", "passed"],
      ["no-javascript-source-text", "passed"],
      ["accepted-wasm-result-per-capability", "not-available"],
      ["deliberate-typed-refusal", "not-available"],
    ]);
    // Three checks did not run, so the catalogue as a whole has not passed.
    expect(allCandidateChecksPassed(results)).toBe(false);
    expect(summarizeCandidateChecks(results)).toContain("4 passed");
    expect(summarizeCandidateChecks(results)).toContain("3 not run");
    expect(byName(results, "every-instrument-bundle")?.detail).toContain("1 pages, 1 chunks");
  });

  test("one changed byte on a paper page fails that check and names the page", async () => {
    const { staticDir, root, fetcher, served } = fixture();
    served.set("/papers/mass-energy/", { status: 200, body: Buffer.from("<main>readinG</main>") });
    const check = byName(
      await runCandidateChecksAgainst({ fetcher, staticDir, root }),
      "paper-pages-served-as-built",
    );
    expect(check?.status).toBe("failed");
    expect(check?.detail).toContain("/papers/mass-energy/");
  });

  test("a script chunk the candidate does not serve fails the instrument check", async () => {
    const { staticDir, root, fetcher, served } = fixture();
    served.set("/_next/static/chunks/lab.js", { status: 404, body: Buffer.from("") });
    const check = byName(
      await runCandidateChecksAgainst({ fetcher, staticDir, root }),
      "every-instrument-bundle",
    );
    expect(check?.status).toBe("failed");
    expect(check?.detail).toContain("HTTP 404");
  });

  test("a frozen id with no anchor fails the no-JavaScript check", async () => {
    const { staticDir, root, fetcher, put } = fixture();
    put(
      "papers/mass-energy/view/german/index.html",
      '<main id="main"><p id="s0-p1">Die Resultate</p></main>',
    );
    const check = byName(
      await runCandidateChecksAgainst({ fetcher, staticDir, root }),
      "no-javascript-source-text",
    );
    expect(check?.status).toBe("failed");
    expect(check?.detail).toContain(
      '1 of 2 frozen ids anchored inside <main id="main">; missing eq-s0-d1',
    );
  });

  test("the page streamed as a hidden segment, with <main> empty, fails the no-JavaScript check", async () => {
    // The shape live served from c3b3116b: an empty fallback in <main>, and every anchor in a
    // hidden late segment after it that only a script moves in.
    const { staticDir, root, fetcher, put } = fixture();
    put(
      "papers/mass-energy/view/german/index.html",
      '<main id="main"><!--$?--><template id="B:0"></template><!--/$--></main>' +
        '<div hidden id="S:0"><p id="s0-p1">Die Resultate</p><div id="eq-s0-d1">l*</div></div>',
    );
    const check = byName(
      await runCandidateChecksAgainst({ fetcher, staticDir, root }),
      "no-javascript-source-text",
    );
    expect(check?.status).toBe("failed");
    expect(check?.detail).toContain('0 of 2 frozen ids anchored inside <main id="main">');
  });

  // Vercel's toolbar loader as production served it on 2026-09-24, appended to the webpack chunk.
  const TOOLBAR =
    '\n;(function(){if(typeof document==="undefined"||!/(?:^|;\\s)__vercel_toolbar=1(?:;|$)/.test(document.cookie))return;var s=document.createElement(\'script\');s.src=\'https://vercel.live/_next-live/feedback/feedback.js\';s.setAttribute("data-explicit-opt-in","true");s.setAttribute("data-cookie-opt-in","true");s.setAttribute("data-deployment-id","dpl_A9rtHXRksk9GrFtRQT7D9cbTrQLV");((document.head||document.documentElement).appendChild(s))})();';

  test("Vercel's toolbar loader appended to a chunk is named as a finding, not passed silently", async () => {
    const { staticDir, root, fetcher, served } = fixture();
    served.set("/_next/static/chunks/lab.js", {
      status: 200,
      body: Buffer.from(`console.log(1)${TOOLBAR}`),
    });
    const check = byName(
      await runCandidateChecksAgainst({ fetcher, staticDir, root }),
      "every-instrument-bundle",
    );
    expect(check?.status).toBe("passed");
    expect(check?.detail).toContain("1 of 2 lab pages");
    expect(check?.detail).toContain("Finding: 1 served as built plus Vercel's toolbar loader");
    expect(check?.detail).toContain("/_next/static/chunks/lab.js");
  });

  test("anything else appended to a chunk fails, even beside the toolbar's own text", async () => {
    const { staticDir, root, fetcher, served } = fixture();
    for (const tail of [TOOLBAR.replace("vercel.live", "evil.example"), `${TOOLBAR} `, ";x()"]) {
      served.set("/_next/static/chunks/lab.js", {
        status: 200,
        body: Buffer.from(`console.log(1)${tail}`),
      });
      const check = byName(
        await runCandidateChecksAgainst({ fetcher, staticDir, root }),
        "every-instrument-bundle",
      );
      expect(check?.status).toBe("failed");
    }
  });

  test("an empty build is a failure, never a pass over nothing", async () => {
    const { root, fetcher } = fixture();
    const empty = mkdtempSync(join(tmpdir(), "am-cc-empty-"));
    const results = await runCandidateChecksAgainst({ fetcher, staticDir: empty, root });
    expect(byName(results, "paper-pages-served-as-built")?.status).toBe("failed");
    expect(byName(results, "every-instrument-bundle")?.status).toBe("failed");
    expect(allCandidateChecksPassed(results)).toBe(false);
  });
});

describe("a request that gets no HTTP response is asked again; nothing else is", () => {
  // 7cd223c4 was refused on 2026-09-24 because two of 161 vercel curl requests failed outright
  // (status 0). Both pages were then served identical to the build. A failed request says nothing
  // about the bytes; a real status or a byte difference does, and is never retried.
  const counting = (inner: Fetcher) => {
    const calls = new Map<string, number>();
    const fetcher: Fetcher = async (path) => {
      calls.set(path, (calls.get(path) ?? 0) + 1);
      return inner(path);
    };
    return { calls, fetcher };
  };

  test("one failed request, then the built bytes: passes, and says it retried", async () => {
    const { staticDir, fetcher: real } = fixture();
    let failedOnce = false;
    const { calls, fetcher } = counting(async (path) => {
      if (!failedOnce) {
        failedOnce = true;
        return { status: 0, body: Buffer.alloc(0) };
      }
      return real(path);
    });
    const report = await servedAsBuilt(fetcher, staticDir, ["/lab/bm-01/"], 1, 0);
    expect(report.problems).toEqual([]);
    expect(report.retried).toEqual(["/lab/bm-01/ (2 requests)"]);
    expect(calls.get("/lab/bm-01/")).toBe(2);
  });

  test("every request failing is still a failure, after exactly the allowed attempts", async () => {
    const { staticDir } = fixture();
    const { calls, fetcher } = counting(async () => ({ status: 0, body: Buffer.alloc(0) }));
    const report = await servedAsBuilt(fetcher, staticDir, ["/lab/bm-01/"], 1, 0);
    expect(report.problems).toEqual(["/lab/bm-01/: HTTP request failed"]);
    expect(calls.get("/lab/bm-01/")).toBe(REQUEST_ATTEMPTS);
  });

  test("a real HTTP status is not retried", async () => {
    const { staticDir } = fixture();
    const { calls, fetcher } = counting(async () => ({ status: 404, body: Buffer.from("no") }));
    const report = await servedAsBuilt(fetcher, staticDir, ["/lab/bm-01/"], 1, 0);
    expect(report.problems).toEqual(["/lab/bm-01/: HTTP 404"]);
    expect(calls.get("/lab/bm-01/")).toBe(1);
  });

  test("different bytes are not retried", async () => {
    const { staticDir } = fixture();
    const { calls, fetcher } = counting(async () => ({
      status: 200,
      body: Buffer.from("changed"),
    }));
    const report = await servedAsBuilt(fetcher, staticDir, ["/lab/bm-01/"], 1, 0);
    expect(report.problems.length).toBe(1);
    expect(report.problems[0]).toContain("differ from the built");
    expect(calls.get("/lab/bm-01/")).toBe(1);
  });
});
