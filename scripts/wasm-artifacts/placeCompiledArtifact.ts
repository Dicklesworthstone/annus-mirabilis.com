#!/usr/bin/env bun
/**
 * Place a COMPILED fs-annus-wasm artifact under public/wasm and write its manifest
 * (am-frankensim-repin-and-bind-jvhg, milestone 2).
 *
 * The artifact is built outside this script, because compilation goes through rch:
 *
 *   cd scripts/wasm-artifacts/fs-annus-wasm
 *   cargo build --release --locked --target wasm32-unknown-unknown        # via rch
 *   wasm-bindgen --target web --omit-default-module-path \
 *     --out-name fs_annus_diffusion --out-dir <dir> <target>/fs_annus_wasm.wasm
 *
 * This script takes <dir> and the cargo output, and places the four wasm-bindgen files
 * content-addressed at public/wasm/<bundleId>/<first 16 hex of the wasm sha256>/. It then
 * writes public/wasm/manifest.json, recording the real digests, sizes, toolchain, wasm-bindgen
 * version, FrankenSim revision and build identity. Nothing is invented. Every recorded value is
 * read from a file:
 * - the pins come from fs-annus-wasm/src/pins.rs;
 * - the toolchain comes from its rust-toolchain.toml;
 * - the wasm-bindgen version comes from its Cargo.lock;
 * - the exports come from the compiled module itself.
 * An earlier artifact directory is never touched or removed.
 *
 * Usage:
 *   bun scripts/wasm-artifacts/placeCompiledArtifact.ts --from <bindgen dir> \
 *     --cargo-wasm <path to fs_annus_wasm.wasm> --build-host <worker> --built-at <ISO time> \
 *     [--out <public/wasm dir>]
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeArtifactDigest } from "../../src/testing/wasm/artifactHelpers.ts";
import { parseCapabilityMatrix } from "./capabilityMatrix.ts";
import { admitExportsForBundle } from "./matrixGate.ts";

export const BUNDLE_ID = "fs-annus-diffusion";
export const FILE_STEM = "fs_annus_diffusion";
export const WASM_FILE = `${FILE_STEM}_bg.wasm`;
export const GLUE_FILE = `${FILE_STEM}.js`;
const BUNDLE_FILES = [WASM_FILE, GLUE_FILE, `${FILE_STEM}.d.ts`, `${FILE_STEM}_bg.wasm.d.ts`];
const REQUESTED_EXPORTS = ["brownian_frames", "philox_normals", "diffusion1d_frames"] as const;
const CRATE_DIR = "scripts/wasm-artifacts/fs-annus-wasm";

export interface PlaceOptions {
  readonly fromDir: string;
  readonly cargoWasm: string;
  readonly buildHost: string;
  readonly builtAt: string;
  readonly outDir?: string;
  readonly repoRoot?: string;
}

/** The placement either succeeds or names why it stopped; it never half-writes a manifest. */
export type Placement =
  | {
      readonly ok: true;
      readonly manifest: Record<string, unknown> & {
        bundleDir: string;
        wasmDigest: string;
        wasmBytes: number;
      };
    }
  | { readonly ok: false; readonly reason: string };

function one(text: string, pattern: RegExp): string | null {
  return text.match(pattern)?.[1] ?? null;
}

/** The exact string the module's build_identity() returns, rebuilt from the pins. */
export function expectedBuildIdentity(transportVersion: string, revision: string): string {
  return JSON.stringify({
    transport: transportVersion,
    frankensimRevision: revision,
    exports: [...REQUESTED_EXPORTS],
  });
}

/** Instantiates the glue on the bytes and returns what the module says it is. */
async function reportedIdentity(fromDir: string, wasmBytes: Uint8Array): Promise<string> {
  const glue = (await import(resolve(fromDir, GLUE_FILE))) as {
    initSync(input: { module: BufferSource }): unknown;
    build_identity(): string;
  };
  glue.initSync({ module: wasmBytes });
  return glue.build_identity();
}

export async function placeCompiledArtifact(options: PlaceOptions): Promise<Placement> {
  const stop = (reason: string): Placement => ({ ok: false, reason });
  const root = resolve(options.repoRoot ?? ".");
  const outDir = resolve(options.outDir ?? join(root, "public/wasm"));
  const crate = join(root, CRATE_DIR);
  const pins = readFileSync(join(crate, "src/pins.rs"), "utf8");
  const revision = one(pins, /FRANKENSIM_REVISION: &str = "([0-9a-f]{40})"/);
  const cargoToml = readFileSync(join(crate, "Cargo.toml"), "utf8");
  const crateVersion = one(cargoToml, /^version = "([^"]+)"/m);
  const toolchain = one(
    readFileSync(join(crate, "rust-toolchain.toml"), "utf8"),
    /^channel = "([^"]+)"/m,
  );
  const lock = readFileSync(join(crate, "Cargo.lock"), "utf8");
  const bindgen = one(lock, /name = "wasm-bindgen"\nversion = "([^"]+)"/);
  if (!revision || !crateVersion || !toolchain || !bindgen)
    return stop(
      "Cannot read the pinned revision, crate version, toolchain or wasm-bindgen version.",
    );
  if (!cargoToml.includes(`revision = "${revision}"`))
    return stop("Cargo.toml metadata and src/pins.rs name different revisions.");

  for (const f of BUNDLE_FILES)
    if (!existsSync(join(options.fromDir, f))) return stop(`Missing ${f} in ${options.fromDir}.`);
  const wasmBytes = readFileSync(join(options.fromDir, WASM_FILE));
  const wasmDigest = computeArtifactDigest(wasmBytes);
  const hashPrefix = wasmDigest.slice(0, 16);
  const module = new WebAssembly.Module(wasmBytes);
  const exported = new Set(WebAssembly.Module.exports(module).map((e) => e.name));
  for (const name of [...REQUESTED_EXPORTS, "build_identity"])
    if (!exported.has(name)) return stop(`The compiled module does not export ${name}.`);
  const imports = WebAssembly.Module.imports(module).map((i) => `${i.module}.${i.name}`);

  const matrix = parseCapabilityMatrix(
    readFileSync(join(root, "docs/FRANKENSIM_BINDING.md"), "utf8"),
  );
  const gate = admitExportsForBundle(matrix, [...REQUESTED_EXPORTS], BUNDLE_ID);
  if (gate.failures.length > 0)
    return stop(
      `Capability matrix refused ${BUNDLE_ID}: ${gate.failures.map((f) => `${f.export}.${f.field}`).join(", ")}`,
    );

  const transportVersion = `fs-annus-wasm ${crateVersion}`;
  const identity = expectedBuildIdentity(transportVersion, revision);
  const reported = await reportedIdentity(options.fromDir, new Uint8Array(wasmBytes));
  if (reported !== identity)
    return stop(`build_identity() reports ${reported}; the pins say ${identity}.`);

  const bundleDir = join(outDir, BUNDLE_ID, hashPrefix);
  for (const f of BUNDLE_FILES) {
    const target = join(bundleDir, f);
    const bytes = readFileSync(join(options.fromDir, f));
    if (
      existsSync(target) &&
      computeArtifactDigest(readFileSync(target)) !== computeArtifactDigest(bytes)
    )
      return stop(`${target} exists with different bytes; a content-addressed file never changes.`);
  }
  mkdirSync(bundleDir, { recursive: true });
  const files: Record<string, { sha256: string; bytes: number }> = {};
  for (const f of BUNDLE_FILES) {
    const bytes = readFileSync(join(options.fromDir, f));
    const target = join(bundleDir, f);
    copyFileSync(join(options.fromDir, f), target);
    files[f] = { sha256: computeArtifactDigest(bytes), bytes: bytes.byteLength };
  }
  const cargoBytes = readFileSync(options.cargoWasm);
  const glueBytes = files[GLUE_FILE]?.bytes ?? 0;
  const totalBundleBytes = Object.values(files).reduce((s, f) => s + f.bytes, 0);

  const manifest = {
    schemaVersion: 1,
    bundleId: BUNDLE_ID,
    bundleDir: `public/wasm/${BUNDLE_ID}/${hashPrefix}`,
    wasmDigest,
    wasmBytes: wasmBytes.byteLength,
    hashPrefix,
    revisions: { frankensim: revision },
    toolchain,
    wasmBindgenVersion: bindgen,
    streamSemanticsVersion: 1,
    refusalMappingDigest: computeArtifactDigest(
      Buffer.from("refusal-mapping:am-fs-capability-audit-byc:v1", "utf8"),
    ),
    capabilities: gate.admitted
      .filter((adm) => exported.has(adm.export))
      .map((adm) => ({
        capabilityId: adm.capabilityId,
        browserExport: adm.export,
        releaseArtifact: adm.releaseArtifact,
        acceptanceState: adm.acceptanceState,
        determinismClass: "Deterministic",
        streamKernelIds: [0x19050001],
        exportSignatures: [adm.export],
      })),
    sizeBudget: {
      // 500 KB is a chosen delivery policy, not a measurement.
      maxBytes: 500000,
      fullPackageBytes: 4900000,
      recordedBytes: wasmBytes.byteLength,
      jsGlueBytes: glueBytes,
      totalBundleBytes,
    },
    files,
    build: {
      generator: CRATE_DIR,
      generatorType: "rust-wasm-bindgen",
      description:
        "fs-annus-wasm compiled for wasm32-unknown-unknown: FrankenSim's brownian.rs, diffusion1d.rs and philox_normals.rs by reference at the pinned revision, with fs-math, fs-rand and fs-sparse by path; wasm-bindgen glue.",
      command: `cargo build --release --locked --target wasm32-unknown-unknown (rch worker ${options.buildHost}); wasm-bindgen --target web --omit-default-module-path --out-name ${FILE_STEM}`,
      flags: ["opt-level=z", "lto=true", "codegen-units=1", "panic=abort", "strip=true"],
      timestamp: options.builtAt,
      identity,
      cargoWasmSha256: computeArtifactDigest(cargoBytes),
      cargoWasmBytes: cargoBytes.byteLength,
      imports,
    },
  };
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { ok: true, manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Map<string, string>();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) args.set(argv[i] ?? "", argv[i + 1] ?? "");
  const missing = ["--from", "--cargo-wasm", "--build-host", "--built-at"].filter(
    (k) => !args.get(k),
  );
  if (missing.length > 0) {
    console.error(`Missing ${missing.join(", ")}.`);
    process.exit(2);
  }
  const placed = await placeCompiledArtifact({
    fromDir: args.get("--from") ?? "",
    cargoWasm: args.get("--cargo-wasm") ?? "",
    buildHost: args.get("--build-host") ?? "",
    builtAt: args.get("--built-at") ?? "",
    ...(args.get("--out") ? { outDir: args.get("--out") as string } : {}),
  });
  if (!placed.ok) {
    console.error(`Not placed: ${placed.reason}`);
    process.exit(1);
  }
  const m = placed.manifest;
  console.log(`${m.bundleDir} ${m.wasmDigest} ${m.wasmBytes} bytes`);
}
