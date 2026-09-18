import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vectors from "./philox.vectors.json";

const PLACEHOLDER = "SHA256_PLACEHOLDER_64_HEX_CHARS_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

describe("Philox Vectors Provenance and Integrity", () => {
  test("provenance header frankensimRevision matches docs/FRANKENSIM_BINDING.md pin", () => {
    const bindingPath = join(process.cwd(), "docs/FRANKENSIM_BINDING.md");
    const bindingText = readFileSync(bindingPath, "utf8");

    const match = bindingText.match(/Pinned FrankenSim Revision:\*\* `([0-9a-f]{40})`/);
    expect(match).not.toBeNull();
    const pinnedRevision = match?.[1];

    expect(vectors.provenance.frankensimRevision).toBe(pinnedRevision);
    expect(vectors.provenance.frankensimRevision).toBe("5bbbfae6f7de614422f6f97f5798a3e00f8ad813");
  });

  test("vector file SHA-256 digest matches provenance header", () => {
    const vectorPath = join(process.cwd(), "src/physics/reference/philox.vectors.json");
    const fileText = readFileSync(vectorPath, "utf8");

    const recordedHash = vectors.provenance.sha256;
    expect(recordedHash).toMatch(/^[0-9a-f]{64}$/);

    const textWithPlaceholder = fileText.replace(recordedHash, PLACEHOLDER);
    const computedHash = createHash("sha256").update(textWithPlaceholder, "utf8").digest("hex");

    expect(computedHash).toBe(recordedHash);
  });

  test("semantics and checkpoint versions in provenance header match constants", () => {
    expect(vectors.provenance.streamSemanticsVersion).toBe(1);
    expect(vectors.provenance.streamCheckpointVersion).toBe(1);
  });
});
