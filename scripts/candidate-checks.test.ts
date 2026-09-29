import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  type AcceptedWasmObservation,
  acceptedWasmResultPerCapability,
  allCandidateChecksPassed,
  type CandidateBrowserProbe,
  candidateRoutes,
  DECLARED_NOT_RUNNABLE,
  deliberateTypedRefusal,
  type Fetcher,
  REQUEST_ATTEMPTS,
  type RefusalObservation,
  runCandidateChecksAgainst,
  scriptChunks,
  servedAsBuilt,
  staleNotRunnableDeclarations,
  summarizeCandidateChecks,
  undeclaredNotRunnable,
  WASM_CAPABILITY_TARGETS,
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

  // A CANDIDATE SERVES MORE THAN PAGES, and two checks read the rest of it (dispatch 387). Without
  // these the fixture is not "a candidate serving exactly the build": fragment-anchors-resolve would
  // find no sitemap and wasm-artifact-served-as-pinned no manifest, and both would correctly refuse.
  //
  // The anchor page carries 120 links because the check floors a sweep at 100 pairs: a run that
  // collects almost nothing has a broken href pattern rather than a clean site, and a fixture that
  // could not clear its own floor would be testing the floor instead of the check.
  const anchorIdsInFixture = Array.from({ length: 120 }, (_, i) => `frag-${i}`);
  put(
    "anchors/targets/index.html",
    `<main>${anchorIdsInFixture.map((id) => `<h2 id="${id}">${id}</h2>`).join("")}</main>`,
  );
  put(
    "anchors/links/index.html",
    `<main>${anchorIdsInFixture
      .map((id) => `<a href="/anchors/targets/#${id}">${id}</a>`)
      .join("")}</main>`,
  );
  put(
    "sitemap.xml",
    `<?xml version="1.0"?><urlset>${["/papers/mass-energy/", "/anchors/links/", "/anchors/targets/"]
      .map((route) => `<loc>https://annus-mirabilis.com${route}</loc>`)
      .join("")}</urlset>`,
  );

  const wasmBytes = Buffer.from("\0asm\u0001\0\0\0 fixture artifact", "binary");
  const glueBytes = Buffer.from("export function brownian_frames() {}\n", "utf8");
  const digestOf = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  const bundleDir = "wasm/fs-annus-diffusion/deadbeefdeadbeef";
  mkdirSync(join(staticDir, ...bundleDir.split("/")), { recursive: true });
  writeFileSync(join(staticDir, ...bundleDir.split("/"), "artifact_bg.wasm"), wasmBytes);
  writeFileSync(join(staticDir, ...bundleDir.split("/"), "artifact.js"), glueBytes);
  put(
    "wasm/manifest.json",
    JSON.stringify({
      schemaVersion: 1,
      bundleId: "fs-annus-diffusion",
      bundleDir: `public/${bundleDir}`,
      wasmDigest: digestOf(wasmBytes),
      // The real manifest's three, with their browser exports: the browser checks read this list as
      // their denominator, so a fixture declaring fewer would make the target rows look stale.
      capabilities: [
        { capabilityId: "diffusion.brownian-frames", browserExport: "brownian_frames" },
        { capabilityId: "diffusion.philox-normals", browserExport: "philox_normals" },
        { capabilityId: "diffusion.ftcs-1d", browserExport: "diffusion1d_frames" },
      ],
      files: {
        "artifact_bg.wasm": { sha256: digestOf(wasmBytes), bytes: wasmBytes.length },
        "artifact.js": { sha256: digestOf(glueBytes), bytes: glueBytes.length },
      },
    }),
  );
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
      // Two checks added by dispatches 384 and 387. The ORDER is asserted with the names, so a
      // check appended without thought shows up here rather than sliding in unnoticed.
      ["wasm-artifact-served-as-pinned", "passed"],
      ["fragment-anchors-resolve", "passed"],
    ]);
    // THIS RUN SUPPLIES NO PROBE, and since dispatch 462 that is not a pass. Two of the three
    // silences above are the browser checks, whose declarations were removed when they were
    // implemented, so they are undeclared here and the catalogue refuses. The passing form is the
    // last test in this file, which supplies a probe. The history is worth keeping: until am-qsh9
    // this predicate returned false for EVERY candidate that could ever exist, because all three
    // structurally could not run, so `validatePromotePreconditions` threw on every promote and the
    // four real checks passing was invisible. A declaration with a reason and an owning bead is
    // what fixed that; what must NOT happen is a declaration standing in for an implementation.
    expect(allCandidateChecksPassed(results)).toBe(false);
    expect(undeclaredNotRunnable(results).map((r) => r.name)).toEqual([
      "accepted-wasm-result-per-capability",
      "deliberate-typed-refusal",
    ]);
    expect(summarizeCandidateChecks(results)).toContain("6 passed");
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

describe("a check that cannot run blocks a promotion unless somebody said why (am-qsm9)", () => {
  const passed = (name: string) => ({ name, status: "passed" as const, detail: "ran" });
  const failed = (name: string) => ({ name, status: "failed" as const, detail: "broke" });
  const silent = (name: string) => ({
    name,
    status: "not-available" as const,
    detail: "did not run",
  });
  const declared = [...DECLARED_NOT_RUNNABLE.keys()];

  test("the declared check is the one the catalogue actually leaves not-available", async () => {
    // Against the real catalogue, not a hand-built list: a declaration for a check that now runs,
    // or for one that is not in the catalogue at all, is stale and must be removed rather than left.
    // It was three declarations until dispatch 462 implemented two of them; this asserts the
    // remaining one is still genuinely silent rather than that any particular number of them is.
    const { staticDir, root, fetcher } = fixture();
    const results = await runCandidateChecksAgainst({ fetcher, staticDir, root });
    expect(results.length).toBeGreaterThan(4);
    expect(staleNotRunnableDeclarations(results)).toEqual([]);
    for (const name of declared)
      expect(results.find((r) => r.name === name)?.status).toBe("not-available");
  });

  test("every declaration carries a reason and an owning bead", () => {
    expect(declared.length).toBeGreaterThan(0);
    for (const [name, { reason, bead }] of DECLARED_NOT_RUNNABLE) {
      expect(reason.length, `${name} has no reason`).toBeGreaterThan(60);
      expect(bead, `${name} names no bead`).toMatch(/^am-[a-z0-9-]+$/);
    }
  });

  test("an UNDECLARED check that did not run still blocks the promotion", () => {
    const results = [passed("a"), silent("a-new-check-nobody-declared")];
    expect(undeclaredNotRunnable(results).map((r) => r.name)).toEqual([
      "a-new-check-nobody-declared",
    ]);
    expect(allCandidateChecksPassed(results)).toBe(false);
  });

  test("a DECLARED check that fails still blocks the promotion", () => {
    const name = declared[0] ?? "";
    expect(name.length).toBeGreaterThan(0);
    expect(allCandidateChecksPassed([passed("a"), failed(name)])).toBe(false);
  });

  test("a declaration cannot make a promotion pass over nothing", () => {
    // Every check declared and none run: no evidence at all, so not a pass. This is the shape the
    // repository keeps finding, a green computed over an empty population.
    expect(allCandidateChecksPassed(declared.map(silent))).toBe(false);
    expect(allCandidateChecksPassed([])).toBe(false);
  });

  test("a declared check that starts passing is reported as a stale declaration", () => {
    const name = declared[0] ?? "";
    const results = [passed("a"), passed(name), ...declared.slice(1).map(silent)];
    expect(staleNotRunnableDeclarations(results)).toEqual([name]);
  });
});

/**
 * A FAKE PROBE, so the two browser checks are tested without a browser (dispatch 462).
 *
 * The real probe is scripts/candidateBrowserProbe.ts and it needs Playwright, a served deployment
 * and about eleven seconds per laboratory. What is tested here is the PREDICATE: which observations
 * a check accepts and which it refuses. The observations below are the ones the real probe returned
 * when it drove the built export on 2026-09-28, including the failing one, so these are recorded
 * measurements rather than invented shapes.
 */
const GOOD_OBSERVATIONS: Readonly<Record<string, AcceptedWasmObservation>> = {
  "diffusion.brownian-frames": {
    capabilityId: "diffusion.brownian-frames",
    lab: "bm-01",
    labelsBefore: ["static", "static", "static", "static", "static"],
    labelsAfter: ["frankensim", "frankensim", "host", "host", "host"],
    labelTexts: ["Ideal model, computed with FrankenSim"],
    wasmRequests: ["/wasm/fs-annus-diffusion/80a1f8fda6f69003/fs_annus_diffusion_bg.wasm"],
    pageErrors: [],
  },
  "diffusion.philox-normals": {
    capabilityId: "diffusion.philox-normals",
    lab: "bm-05",
    labelsBefore: ["static", "static"],
    labelsAfter: ["frankensim", "frankensim"],
    labelTexts: ["Ideal model, computed with FrankenSim"],
    wasmRequests: ["/wasm/fs-annus-diffusion/80a1f8fda6f69003/fs_annus_diffusion_bg.wasm"],
    pageErrors: [],
  },
  "diffusion.ftcs-1d": {
    capabilityId: "diffusion.ftcs-1d",
    lab: "bm-06",
    labelsBefore: ["static", "static"],
    labelsAfter: ["host", "host", "frankensim"],
    labelTexts: ["Ideal model, host calculation", "Ideal model, computed with FrankenSim"],
    wasmRequests: ["/wasm/fs-annus-diffusion/80a1f8fda6f69003/fs_annus_diffusion_bg.wasm"],
    pageErrors: [],
  },
};

/** Indexed access is `| undefined` under noUncheckedIndexedAccess, and a spread of that widens
 * every field to optional, so the observations are read through here. */
function good(capabilityId: string): AcceptedWasmObservation {
  const observation = GOOD_OBSERVATIONS[capabilityId];
  if (observation === undefined) throw new Error(`no recorded observation for ${capabilityId}`);
  return observation;
}

/** What BM-05 really does when the reader leaves the default coin walk: fetched, and still host. */
const FETCHED_BUT_HOST: AcceptedWasmObservation = {
  capabilityId: "diffusion.philox-normals",
  lab: "bm-05",
  labelsBefore: ["static", "static"],
  labelsAfter: ["host", "host"],
  labelTexts: ["Ideal model, host calculation"],
  wasmRequests: ["/wasm/fs-annus-diffusion/80a1f8fda6f69003/fs_annus_diffusion_bg.wasm"],
  pageErrors: [],
};

const GOOD_REFUSAL: RefusalObservation = {
  lab: "bm-06",
  codes: ["ftcs-unstable"],
  readerText:
    "Requested calculation not accepted This time step is too large for the explicit diffusion scheme. This step gives a diffusion number D·Δt/Δx² of 42.944, and the explicit scheme stays stable only up to 0.5. FrankenSim's diffusion1d_frames refused the step before computing anything.",
  nonFiniteTokens: [],
  pageErrors: [],
};

function fakeProbe(
  overrides: Readonly<{
    observations?: Readonly<Record<string, AcceptedWasmObservation>>;
    refusal?: RefusalObservation;
  }> = {},
): CandidateBrowserProbe & { readonly driven: string[] } {
  const driven: string[] = [];
  const observations = overrides.observations ?? GOOD_OBSERVATIONS;
  return {
    driven,
    observeAcceptedWasm: async (target) => {
      driven.push(target.capabilityId);
      const observation = observations[target.capabilityId];
      if (observation === undefined)
        throw new Error(`the fake probe has no observation for ${target.capabilityId}`);
      return observation;
    },
    provokeRefusal: async (target) => {
      driven.push(`refusal:${target.lab}`);
      return overrides.refusal ?? GOOD_REFUSAL;
    },
    close: async () => {},
  };
}

describe("the two checks that need a browser (dispatch 462)", () => {
  test("every declared capability is driven, and the detail names each one and what it showed", async () => {
    const { fetcher } = fixture();
    const probe = fakeProbe();
    const result = await acceptedWasmResultPerCapability(fetcher, probe);
    expect(result.status).toBe("passed");
    // The denominator is stated, and every capability the manifest declared was actually driven.
    expect(probe.driven).toEqual([
      "diffusion.brownian-frames",
      "diffusion.philox-normals",
      "diffusion.ftcs-1d",
    ]);
    expect(result.detail).toContain("3 of 3 declared capability(ies)");
    for (const capability of ["brownian_frames", "philox_normals", "diffusion1d_frames"])
      expect(result.detail).toContain(capability);
    expect(result.detail).toContain("bm-01");
  });

  test("a fetched artifact that produced a host calculation FAILS", async () => {
    // The negative the whole check exists for, and a measured one: BM-05 on its default coin walk
    // fetches the artifact with a 200 and stays "Ideal model, host calculation". A check keyed on
    // the network request would pass here. AGENTS.md: a loaded WASM file does not earn the label.
    const { fetcher } = fixture();
    const result = await acceptedWasmResultPerCapability(
      fetcher,
      fakeProbe({
        observations: { ...GOOD_OBSERVATIONS, "diffusion.philox-normals": FETCHED_BUT_HOST },
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("1 wasm request(s) were made and no frankensim label appeared");
    // It still says what it examined, so a reader of the release record sees the other two passed.
    expect(result.detail).toContain("1 of 3");
  });

  test("a label already present on arrival is not an earned one", async () => {
    const { fetcher } = fixture();
    const result = await acceptedWasmResultPerCapability(
      fetcher,
      fakeProbe({
        observations: {
          ...GOOD_OBSERVATIONS,
          "diffusion.ftcs-1d": {
            ...good("diffusion.ftcs-1d"),
            labelsBefore: ["frankensim"],
          },
        },
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("already present on arrival");
  });

  test("an attribute without the reader's wording is not a result a reader got", async () => {
    const { fetcher } = fixture();
    const result = await acceptedWasmResultPerCapability(
      fetcher,
      fakeProbe({
        observations: {
          ...GOOD_OBSERVATIONS,
          "diffusion.brownian-frames": {
            ...good("diffusion.brownian-frames"),
            labelTexts: ["Ideal model, host calculation"],
          },
        },
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("no reader-facing wording");
  });

  test("nothing to examine is a failure, in both of its shapes", async () => {
    // The dispatch's own words: a fetch that 404s or an empty capability list reads as clean. These
    // two must not. A `passed` here would be a green computed over an empty population.
    const { fetcher } = fixture();
    const missing: Fetcher = async (path) =>
      path === "/wasm/manifest.json" ? { status: 404, body: Buffer.alloc(0) } : await fetcher(path);
    const empty: Fetcher = async (path) =>
      path === "/wasm/manifest.json"
        ? { status: 200, body: Buffer.from(JSON.stringify({ capabilities: [] })) }
        : await fetcher(path);
    const onFourOhFour = await acceptedWasmResultPerCapability(missing, fakeProbe());
    expect(onFourOhFour.status).toBe("failed");
    expect(onFourOhFour.detail).toContain("answered 404");
    const onEmpty = await acceptedWasmResultPerCapability(empty, fakeProbe());
    expect(onEmpty.status).toBe("failed");
    expect(onEmpty.detail).toContain("zero capabilities");
  });

  test("a capability with no target row is refused rather than skipped", async () => {
    // A row missing means the check would silently examine two of three and report both good.
    const { fetcher } = fixture();
    const result = await acceptedWasmResultPerCapability(
      fetcher,
      fakeProbe(),
      WASM_CAPABILITY_TARGETS.filter((target) => target.capabilityId !== "diffusion.ftcs-1d"),
    );
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("have no target row: diffusion.ftcs-1d");
  });

  test("every target row names a capability the deployment declares, and its export", () => {
    // The rows are data, and this is what keeps them true: the ids and exports are the manifest's.
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "public/wasm/manifest.json"), "utf8"),
    ) as { capabilities: { capabilityId: string; browserExport: string }[] };
    const declared = new Map(manifest.capabilities.map((c) => [c.capabilityId, c.browserExport]));
    expect(WASM_CAPABILITY_TARGETS.length).toBe(declared.size);
    for (const target of WASM_CAPABILITY_TARGETS) {
      expect(declared.get(target.capabilityId)).toBe(target.browserExport);
      expect(target.why.length).toBeGreaterThan(40);
      expect(target.lab).toMatch(/^[a-z]{2}-\d{2}$/u);
    }
  });

  test("the typed refusal must arrive, and must say something a reader can act on", async () => {
    const good = await deliberateTypedRefusal(fakeProbe());
    expect(good.status).toBe("passed");
    expect(good.detail).toContain("ftcs-unstable");
    expect(good.detail).toContain("codes [ftcs-unstable]");

    const noCode = await deliberateTypedRefusal(
      fakeProbe({ refusal: { ...GOOD_REFUSAL, codes: [] } }),
    );
    expect(noCode.status).toBe("failed");
    expect(noCode.detail).toContain("nothing typed refused");

    const noSentence = await deliberateTypedRefusal(
      fakeProbe({ refusal: { ...GOOD_REFUSAL, readerText: "" } }),
    );
    expect(noSentence.status).toBe("failed");
    expect(noSentence.detail).toContain("no reader-facing sentence");

    const unexplained = await deliberateTypedRefusal(
      fakeProbe({
        refusal: { ...GOOD_REFUSAL, readerText: "Requested calculation not accepted." },
      }),
    );
    expect(unexplained.status).toBe("failed");
    expect(unexplained.detail).toContain("does not say");
  });

  test("a NaN where a value would be is not a typed refusal", async () => {
    // AGENTS.md: a typed refusal, "not a NaN, not a zero, not a silent clamp". A page carrying the
    // code AND a NaN has leaked the thing the typed states exist to prevent.
    const result = await deliberateTypedRefusal(
      fakeProbe({ refusal: { ...GOOD_REFUSAL, nonFiniteTokens: ["NaN"] } }),
    );
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("shows NaN");
  });

  test("a page error during the drive fails the check, however good the labels look", async () => {
    const { fetcher } = fixture();
    const result = await acceptedWasmResultPerCapability(
      fetcher,
      fakeProbe({
        observations: {
          ...GOOD_OBSERVATIONS,
          "diffusion.brownian-frames": {
            ...good("diffusion.brownian-frames"),
            pageErrors: ["the deployment answered 404 for /lab/bm-01/"],
          },
        },
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("404 for /lab/bm-01/");
  });

  test("no probe is not-available, is UNDECLARED, and therefore blocks a promotion", async () => {
    // This is the load-bearing consequence of implementing them: their DECLARED_NOT_RUNNABLE
    // entries were removed in the same commit, so a release whose browser probe failed to launch
    // cannot promote on a silence. Before dispatch 462 both were declared and a no-probe run passed.
    const { staticDir, root, fetcher } = fixture();
    const results = await runCandidateChecksAgainst({ fetcher, staticDir, root });
    const names = undeclaredNotRunnable(results).map((r) => r.name);
    expect(names).toEqual(["accepted-wasm-result-per-capability", "deliberate-typed-refusal"]);
    expect(allCandidateChecksPassed(results)).toBe(false);
    expect(DECLARED_NOT_RUNNABLE.has("accepted-wasm-result-per-capability")).toBe(false);
    expect(DECLARED_NOT_RUNNABLE.has("deliberate-typed-refusal")).toBe(false);
    for (const name of names) expect(byName(results, name)?.detail).toContain("no browser probe");
  });

  test("with a probe the catalogue passes, and no declaration is left stale", async () => {
    const { staticDir, root, fetcher } = fixture();
    const results = await runCandidateChecksAgainst({
      fetcher,
      staticDir,
      root,
      probe: fakeProbe(),
    });
    expect(results.map((r) => [r.name, r.status])).toEqual([
      ["four-complete-paper-texts", "not-available"],
      ["paper-pages-served-as-built", "passed"],
      ["representative-foundations", "passed"],
      ["every-instrument-bundle", "passed"],
      ["no-javascript-source-text", "passed"],
      ["accepted-wasm-result-per-capability", "passed"],
      ["deliberate-typed-refusal", "passed"],
      ["wasm-artifact-served-as-pinned", "passed"],
      ["fragment-anchors-resolve", "passed"],
    ]);
    expect(staleNotRunnableDeclarations(results)).toEqual([]);
    expect(undeclaredNotRunnable(results)).toEqual([]);
    expect(allCandidateChecksPassed(results)).toBe(true);
    expect(summarizeCandidateChecks(results)).toContain("8 passed");
  });
});
