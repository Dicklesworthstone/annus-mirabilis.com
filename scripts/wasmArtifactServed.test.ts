/**
 * THE CANDIDATE SERVES THE PINNED WASM, BYTE FOR BYTE (am-rel-candidate-checks-kc7y, dispatch 387).
 *
 * AGENTS.md requires a candidate check for "one real accepted WASM result per numerical capability
 * ... against the deployed assets rather than the build directory", and the bead sharpens it to
 * "assert the manifest digest and the refusal semantics". An accepted RESULT needs a browser to
 * press Apply and run the worker; the harness is HTTP-only, so that half stays declared
 * not-runnable. The DIGEST half is a claim about bytes, and bytes are what HTTP serves.
 *
 * WHY THIS IS NOT verify-wasm-artifacts AGAIN. That checks digests in the LOCAL build. What was
 * unchecked is that the CANDIDATE serves those same bytes: a stale CDN object, a partial upload or a
 * mispinned directory passes every local gate and still reaches a reader.
 *
 * THE PLANT THAT MATTERS IS THE WRONG DIGEST, NOT THE MISSING FILE. A check that only notices a 404
 * would pass a candidate serving a different artifact under the right name, which is the failure
 * this exists for. Both are tested, and they report differently.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { type Fetched, type Fetcher, wasmArtifactServedAsPinned } from "./candidate-checks.ts";

const WASM = Buffer.from("\0asm\x01\0\0\0 pinned artifact bytes", "binary");
const JS = Buffer.from("export function brownian_frames() {}\n", "utf8");
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const DIR = "/wasm/fs-annus-diffusion/80a1f8fda6f69003";

function manifest(files: Record<string, { sha256?: string; bytes?: number }>) {
  return {
    schemaVersion: 1,
    bundleId: "fs-annus-diffusion",
    bundleDir: "public/wasm/fs-annus-diffusion/80a1f8fda6f69003",
    wasmDigest: sha(WASM),
    capabilities: [{ capabilityId: "diffusion.brownian-frames" }],
    files,
  };
}

function site(pages: Record<string, Buffer | string>): Fetcher {
  return async (path: string): Promise<Fetched> => {
    const body = pages[path];
    if (body === undefined) return { status: 404, body: Buffer.from("") };
    return { status: 200, body: Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8") };
  };
}

const honest = {
  "/wasm/manifest.json": JSON.stringify(
    manifest({
      "fs_annus_diffusion_bg.wasm": { sha256: sha(WASM), bytes: WASM.length },
      "fs_annus_diffusion.js": { sha256: sha(JS), bytes: JS.length },
    }),
  ),
  [`${DIR}/fs_annus_diffusion_bg.wasm`]: WASM,
  [`${DIR}/fs_annus_diffusion.js`]: JS,
};

describe("the deployed WASM artifact", () => {
  test("passes when every declared file hashes to what the manifest pins, and says how many", async () => {
    const out = await wasmArtifactServedAsPinned(site(honest));
    expect(out.name).toBe("wasm-artifact-served-as-pinned");
    expect(out.status).toBe("passed");
    // The denominator is in the detail, because "no mismatches" over 0 files reads the same.
    expect(out.detail).toContain("2 of 2 declared files");
    expect(out.detail).toContain("1 capabilities declared");
    // And it does not overclaim.
    expect(out.detail).toContain("NOT that a reader obtains an accepted result");
  });

  test("PLANTED: a WRONG DIGEST fails, naming the file — not merely a missing one", async () => {
    // The candidate serves a DIFFERENT artifact under the right name and the right length. A check
    // that only noticed 404s would pass this.
    const tampered = Buffer.from("\0asm\x01\0\0\0 pinned artifact byteX", "binary");
    expect(tampered.length).toBe(WASM.length);
    const out = await wasmArtifactServedAsPinned(
      site({ ...honest, [`${DIR}/fs_annus_diffusion_bg.wasm`]: tampered }),
    );
    expect(out.status).toBe("failed");
    expect(out.detail).toContain("fs_annus_diffusion_bg.wasm");
    expect(out.detail).toContain("sha256");
    expect(out.detail).toContain("did not match what the manifest pins");
  });

  test("a byte count that disagrees fails even when no sha256 is declared", async () => {
    const out = await wasmArtifactServedAsPinned(
      site({
        ...honest,
        "/wasm/manifest.json": JSON.stringify(
          manifest({ "fs_annus_diffusion_bg.wasm": { bytes: WASM.length + 1 } }),
        ),
      }),
    );
    expect(out.status).toBe("failed");
    expect(out.detail).toContain("bytes served");
  });

  test("a declared file the candidate does not serve fails, and reports differently", async () => {
    const { [`${DIR}/fs_annus_diffusion.js`]: _dropped, ...missing } = honest;
    const out = await wasmArtifactServedAsPinned(site(missing));
    expect(out.status).toBe("failed");
    expect(out.detail).toContain("HTTP 404");
    // Distinguishable from a digest mismatch, so the repair is obvious from the line.
    expect(out.detail).not.toContain("sha256");
  });

  test("a manifest declaring nothing FAILS rather than reporting a clean artifact", async () => {
    const out = await wasmArtifactServedAsPinned(
      site({ "/wasm/manifest.json": JSON.stringify(manifest({})) }),
    );
    expect(out.status).toBe("failed");
    expect(out.detail).toContain("declares 0 files");
  });

  test("no manifest on the candidate means nothing was checked, and says so", async () => {
    const out = await wasmArtifactServedAsPinned(site({}));
    expect(out.status).toBe("failed");
    expect(out.detail).toContain("nothing was checked");
  });
});
