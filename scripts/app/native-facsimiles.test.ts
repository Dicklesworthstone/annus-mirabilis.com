import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { checkedReceipts, receiptHref } from "../../src/app/sources/receiptPages.ts";
import { parseYaml } from "../../src/content/provenance/yaml.ts";
import {
  buildNativeFacsimiles,
  FACSIMILE_MAX_BYTES,
  NativeFacsimileExportError,
  projectNativeFacsimile,
} from "./native-facsimiles.ts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../..");
const receipts = checkedReceipts({ rootDir: REPO, requireLocal: false });
const massEnergy = receipts.find((entry) => entry.key === "ap-18-639")?.receipt;
assert.ok(massEnergy);
const receipt = massEnergy.frontMatter;
const config = parseYaml(
  readFileSync(join(REPO, "scripts/sources/facsimile-sources/ap-18-639.yaml"), "utf8"),
) as Record<string, unknown>;

function fixture(data?: Uint8Array): { root: string; file: string } {
  const root = mkdtempSync(join(tmpdir(), "native-facsimile-"));
  const file = join(root, "papers/pdfs/ap-18-639.pdf");
  mkdirSync(dirname(file), { recursive: true });
  if (data) writeFileSync(file, data);
  else copyFileSync(join(REPO, "public/papers/pdfs/ap-18-639.pdf"), file);
  return { root, file };
}

function pinFor(data: Uint8Array) {
  const sha256 = createHash("sha256").update(data).digest("hex");
  return {
    receipt: { ...receipt, scan: { ...receipt.scan, sha256 } },
    config: { ...config, pinned: { ...(config.pinned as Record<string, unknown>), sha256 } },
  };
}

function refused(run: () => unknown): void {
  assert.throws(
    run,
    (error: unknown) =>
      error instanceof NativeFacsimileExportError && error.code === "facsimile-source-invalid",
  );
}

describe("native facsimile pins", () => {
  it("projects every checked source receipt and the exact published PDF bytes", () => {
    const assets = buildNativeFacsimiles(REPO, join(REPO, "public"));
    assert.deepEqual(
      assets.map((entry) => entry.key),
      receipts.map((entry) => entry.key),
    );
    for (const asset of assets) {
      const owner = receipts.find((entry) => entry.key === asset.key)?.receipt?.frontMatter;
      assert.ok(owner);
      assert.equal(asset.title, owner.paper.titleGerman);
      assert.equal(asset.receiptHref, receiptHref(owner.slug));
      assert.equal(asset.redistributable, owner.scan.publicationDecision === "publish");
      if (!asset.redistributable) continue;
      const data = readFileSync(join(REPO, `public${asset.path}`));
      assert.equal(asset.bytes, data.byteLength);
      assert.equal(asset.sha256, createHash("sha256").update(data).digest("hex"));
      assert.equal(asset.sha256, owner.scan.sha256);
    }
  });

  it("never reads or exposes a private scan path, digest, or size", () => {
    const withheld = {
      ...receipt,
      scan: { ...receipt.scan, publicationDecision: "pin-local-only" as const },
    };
    const asset = projectNativeFacsimile(withheld, null, "/intentionally-absent");
    assert.equal(asset.redistributable, false);
    assert.equal(asset.receiptHref, "/sources/mass-energy/");
    assert.equal("path" in asset || "sha256" in asset || "bytes" in asset, false);
    const older = mkdtempSync(join(tmpdir(), "native-facsimile-old-"));
    assert.deepEqual(buildNativeFacsimiles(older, "/intentionally-absent"), []);
  });

  it("facsimile-source-invalid refuses mismatched pins and changed PDF bytes (native-facsimiles.ts:50) (native-facsimiles.ts:70)", () => {
    const { root, file } = fixture();
    refused(() =>
      projectNativeFacsimile(
        { ...receipt, scan: { ...receipt.scan, sha256: "0".repeat(64) } },
        config,
        root,
      ),
    );
    const data = readFileSync(file);
    data.writeUInt8(data.readUInt8(data.length - 1) ^ 1, data.length - 1);
    writeFileSync(file, data);
    refused(() => projectNativeFacsimile(receipt, config, root));
  });

  it("facsimile-source-invalid refuses non-PDF bytes and oversized files (native-facsimiles.ts:61) (native-facsimiles.ts:70)", () => {
    const data = Buffer.from("<html>not a PDF</html>");
    const owners = pinFor(data);
    const { root } = fixture(data);
    refused(() => projectNativeFacsimile(owners.receipt, owners.config, root));
    const large = fixture(Buffer.from("%PDF-"));
    truncateSync(large.file, FACSIMILE_MAX_BYTES + 1);
    refused(() => projectNativeFacsimile(receipt, config, large.root));
  });

  it("facsimile-source-invalid refuses high-bit pseudoheaders despite matching ASCII text and digest (native-facsimiles.ts:70)", () => {
    const data = Buffer.from([0xa5, 0xd0, 0xc4, 0xc6, 0xad]);
    assert.equal(data.toString("ascii"), "%PDF-", "this fixture exposes lossy ASCII decoding");
    const owners = pinFor(data);
    const { root } = fixture(data);
    refused(() => projectNativeFacsimile(owners.receipt, owners.config, root));
  });

  it("facsimile-source-invalid refuses receipt path aliases despite a matching PDF (native-facsimiles.ts:55)", () => {
    const { root } = fixture();
    const alias = {
      ...receipt,
      scan: { ...receipt.scan, path: "public/papers/pdfs/../ap-18-639.pdf" },
    };
    refused(() => projectNativeFacsimile(alias, config, root));
  });

  it("facsimile-source-invalid refuses a checked owner result without its receipt (native-facsimiles.ts:98)", () => {
    // A malformed file is normally rejected by checkedReceipts before this guard.
    // Drive the defensive boundary with a contract-violating owner result, evaluating
    // the actual unchanged source in a private module instance rather than mocking
    // process-wide imports or pretending an ordinary malformed receipt reaches it.
    const sourceUrl = new URL("./native-facsimiles.ts", import.meta.url);
    const compiled = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
      fileName: fileURLToPath(sourceUrl),
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const load = createRequire(import.meta.url);
    let ownerCalls = 0;
    const sandbox = {
      exports: {},
      Buffer,
      require(specifier: string) {
        if (specifier === "../../src/app/sources/receiptPages.ts") {
          return {
            ...load(specifier),
            checkedReceipts: () => {
              ownerCalls++;
              return [{ key: "ap-18-639", checkResult: { errors: [] } }];
            },
          };
        }
        return load(specifier);
      },
    };
    runInNewContext(compiled, sandbox, { timeout: 1000 });
    const isolated = sandbox.exports as Pick<
      typeof import("./native-facsimiles.ts"),
      "buildNativeFacsimiles" | "NativeFacsimileExportError"
    >;
    const root = mkdtempSync(join(tmpdir(), "native-facsimile-missing-receipt-"));
    mkdirSync(join(root, "docs/provenance"), { recursive: true });
    assert.throws(
      () => isolated.buildNativeFacsimiles(root, "/intentionally-absent"),
      (error: unknown) =>
        error instanceof isolated.NativeFacsimileExportError &&
        error.code === "facsimile-source-invalid" &&
        error.message === "ap-18-639: the source receipt is unreadable.",
    );
    assert.equal(ownerCalls, 1);
  });
});
