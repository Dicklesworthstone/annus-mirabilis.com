/** Server-only source admission. A failure disables the scan, never the explanation.
 * Digest/anchor checks here do not replace verify-facsimile-pins' visual identity gate.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { parseYaml } from "../../content/provenance/yaml.ts";
import {
  FacsimileDataError,
  projectFacsimileDocument,
} from "./document.ts";

import type { FacsimileAvailability } from "./wire.ts";
export type { FacsimileAvailability } from "./wire.ts";

const MAX_PDF_BYTES = 64 * 1024 * 1024;
const MAX_METADATA_BYTES = 2 * 1024 * 1024;

function unavailable(code: string, message: string): FacsimileAvailability {
  return Object.freeze({ kind: "unavailable", code, message });
}

async function optionalMetadata(path: string): Promise<unknown | null> {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_METADATA_BYTES) {
      throw new FacsimileDataError("facsimile-metadata-invalid", "Invalid source metadata size.");
    }
    const text = await readFile(path, "utf8");
    return path.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Streaming verification: no PDF bytes enter the client props or a global module cache. */
export async function verifyFacsimilePdf(
  path: string,
  expectedDigest: string,
  publicPdfDirectory: string,
): Promise<void> {
  const [filePath, directory] = await Promise.all([realpath(path), realpath(publicPdfDirectory)]);
  if (!filePath.startsWith(`${directory}${sep}`)) {
    throw new FacsimileDataError("facsimile-path-refused", "The PDF resolves outside the public source directory.");
  }
  const info = await stat(filePath);
  if (!info.isFile() || info.size < 5 || info.size > MAX_PDF_BYTES) {
    throw new FacsimileDataError("facsimile-file-invalid", "The pinned PDF is absent or outside the supported size.");
  }
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    const data = chunk as Buffer;
    if (bytes === 0 && data.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new FacsimileDataError("facsimile-not-pdf", "The pinned file has no PDF header.");
    }
    bytes += data.length;
    if (bytes > MAX_PDF_BYTES) {
      throw new FacsimileDataError("facsimile-file-invalid", "The pinned PDF exceeded the byte limit.");
    }
    hash.update(data);
  }
  if (bytes !== info.size || hash.digest("hex") !== expectedDigest) {
    throw new FacsimileDataError("facsimile-digest-mismatch", "The source bytes differ from the pinned SHA-256 record.");
  }
}

export async function loadFacsimileDocument(
  paperId: string,
  key: string,
  rootDirectory = process.cwd(),
): Promise<FacsimileAvailability> {
  if (!/^[a-z]+(?:-[a-z]+)*$/.test(paperId) || !/^ap-\d+-\d+$/.test(key)) {
    return unavailable("facsimile-identity-invalid", "This paper has no valid source identity.");
  }
  try {
    const config = await optionalMetadata(
      join(rootDirectory, "scripts/sources/facsimile-sources", `${key}.yaml`),
    );
    if (config === null) {
      return unavailable("facsimile-not-pinned", "No published scan is recorded for this paper yet.");
    }
    // Check publication admission before reading even the inventory or PDF bytes.
    const pin = projectFacsimileDocument(paperId, key, config);
    if (pin === null) {
      return unavailable("facsimile-not-published", "This source has no scan admitted for public display.");
    }
    const inventoryDirectory = join(rootDirectory, "content/source-blocks", paperId);
    const inventory =
      (await optionalMetadata(join(inventoryDirectory, "manifest.yaml"))) ??
      (await optionalMetadata(join(inventoryDirectory, "manifest.json")));
    const document = projectFacsimileDocument(paperId, key, config, inventory);
    if (document === null) {
      return unavailable("facsimile-not-published", "This source has no scan admitted for public display.");
    }
    const pdfDirectory = join(rootDirectory, "public/papers/pdfs");
    await verifyFacsimilePdf(join(pdfDirectory, `${key}.pdf`), document.sha256, pdfDirectory);
    return Object.freeze({ kind: "available", document });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return unavailable("facsimile-source-missing", "The pinned scan is missing from this build. The explanation remains available.");
    }
    if (error instanceof FacsimileDataError) {
      return unavailable(error.code, "The scan or its page map did not pass the source checks. Source-page links are withheld rather than guessed; the explanation remains available.");
    }
    return unavailable("facsimile-metadata-unavailable", "The source metadata could not be read. The explanation remains available.");
  }
}
