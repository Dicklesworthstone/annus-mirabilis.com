/**
 * Collect WASM Artifacts and Licenses.
 * Bead: am-gov-license-inventory-w6yz
 */

import { basename, join, normalize } from "node:path";
import type { LicenseItem } from "./types.ts";

export interface WasmCapability {
  readonly capabilityId?: string;
  readonly browserExport?: string;
}

export interface WasmManifest {
  readonly bundleId?: string;
  readonly bundleDir?: string;
  readonly revisions?: { readonly frankensim?: string; [key: string]: unknown };
  readonly capabilities?: readonly WasmCapability[];
  readonly artifacts?: readonly { readonly path?: string }[];
}

export interface CollectWasmOptions {
  readonly rootDir: string;
  readonly manifestJson: WasmManifest | null; // parsed public/wasm/manifest.json
  readonly wasmFilesOnDisk: readonly string[]; // relative paths to all *.wasm files under public/wasm
  readonly readText: (path: string) => string | null;
}

export function collectWasm(options: CollectWasmOptions): LicenseItem[] {
  const { manifestJson, wasmFilesOnDisk } = options;
  const items: LicenseItem[] = [];

  const manifestFiles = new Set<string>();

  if (manifestJson) {
    const manifest = manifestJson;
    const bundleId = manifest.bundleId || "unknown-bundle";
    const revisions = manifest.revisions || {};
    const frankensimRev = revisions.frankensim;

    const filesObj = manifest.files || {};
    const bundleDir = manifest.bundleDir || "";

    // Record manifest artifacts
    for (const fileName of Object.keys(filesObj)) {
      if (fileName.endsWith(".wasm")) {
        const expectedRelPath = normalize(join(bundleDir, fileName));
        manifestFiles.add(expectedRelPath);
        // Also index by basename in case relative path differs in representation
        manifestFiles.add(fileName);
      }
    }

    // Check that the manifest has revisions and license
    let artifactLicense = "MIT with OpenAI/Anthropic Rider";
    if (!frankensimRev) {
      artifactLicense = "MISSING-FRANKENSIM-REVISION";
    }

    // Each declared capability in manifest
    const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];
    const capList = capabilities
      .map((c) => c.capabilityId || c.browserExport)
      .filter(Boolean)
      .join(", ");

    items.push({
      kind: "wasm",
      name: `${bundleId} (FrankenSim WASM artifact)`,
      version: frankensimRev ? String(frankensimRev).slice(0, 7) : "unknown",
      license: artifactLicense,
      source: bundleDir || "public/wasm",
      authorOrNotice: `FrankenSim upstream revision ${frankensimRev || "missing"}; capabilities: [${capList}]`,
    });
  }

  // Check every *.wasm file on disk against the manifest
  for (const diskWasm of wasmFilesOnDisk) {
    const norm = normalize(diskWasm);
    const bName = basename(diskWasm);
    const inManifest = manifestFiles.has(norm) || manifestFiles.has(bName);

    if (!inManifest) {
      items.push({
        kind: "wasm",
        name: `Unregistered WASM: ${diskWasm}`,
        version: "unregistered",
        license: "UNREGISTERED-WASM-ARTIFACT",
        source: diskWasm,
        authorOrNotice: `File ${diskWasm} is present on disk but absent from public/wasm/manifest.json`,
      });
    }
  }

  return items;
}
