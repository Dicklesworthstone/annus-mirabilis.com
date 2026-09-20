/**
 * Unit and integration tests for scripts/download-facsimiles.ts.
 * Spec: am-src-download-script-15ar
 *
 * Exercises all 14 named cases:
 * 1. validatePdf accepts valid-2page and rejects html, json, truncated, wrong page count
 * 2. sha256File against SHA256SUMS and streaming vs buffer
 * 3. verifyHostChecksums with MD5 / SHA-1 mismatch
 * 4. extractArticle determinism and image stream equivalence
 * 5. detectEmbeddedTextLayer absent on page 1, present on page 2, unknown on invalid
 * 6. pinFile sequence: pin, noop, PINNED_DIGEST_CONFLICT
 * 7. updatePinnedRecord roundtrip
 * 8. Rights vocabulary refusals: SCAN_TERMS_UNKNOWN, REFERENCE_ONLY_NOT_PINNABLE, RIGHTS_VOCABULARY_INVALID
 * 9. Forbidden witness and publisher hosts (including Wiley subscription license): WITNESS_OR_PUBLISHER_HOST, DERIVATIVE_WITHOUT_REASON
 * 10. Key claims exclusion: LOCK_HELD and release without deletion
 * 11. verifyPins: ok, mismatch, missing, not-available
 * 12. HTTP fetch tests against 127.0.0.1 test server: redirects, retries, 404, size limits, restorePin
 * 13. Identity and runId discipline (no runId or logRunId fields)
 * 14. Static guard against local OCR / text extraction imports
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import yaml from "js-yaml";
import {
  acquireKeyClaim,
  checkAllConfigs,
  detectEmbeddedTextLayer,
  downloadFacsimile,
  emitReceiptStub,
  extractArticle,
  fetchToStaging,
  getRepoRoot,
  main,
  pinFile,
  releaseKeyClaim,
  restorePin,
  sha256File,
  validateConfig,
  validatePdf,
  verifyHostChecksums,
  verifyPins,
} from "./download-facsimiles";
import { newToolRunId } from "./runIds";
import { FacsimileError, getExitCodeForError } from "./sources/facsimileSourceSchema";

const REPO_ROOT = getRepoRoot();
const FIXTURES_DIR = path.join(REPO_ROOT, "src", "testing", "fixtures", "pdf");

/**
 * A record entry the test asserts on. Reading `entry(results, "x").status` is
 * `T | undefined` under noUncheckedIndexedAccess (am-7mp8); this names the absent
 * key instead of failing with "cannot read property of undefined", and it keeps
 * the assertion that the key exists at all.
 */
function entry<T>(record: Record<string, T>, key: string): T {
  const value = record[key];
  if (value === undefined)
    throw new Error(`No entry for ${key}; the record holds ${Object.keys(record).join(", ")}`);
  return value;
}

describe("1. validatePdf structural verification", () => {
  test("accepts valid-2page.pdf with page count 2", () => {
    const buf = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));
    const res = validatePdf(buf);
    expect(res.valid).toBe(true);
    expect(res.pageCount).toBe(2);
  });

  test("rejects html-named.pdf with NOT_A_PDF", () => {
    const buf = fs.readFileSync(path.join(FIXTURES_DIR, "html-named.pdf"));
    const res = validatePdf(buf);
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe("not-a-pdf");
  });

  test("rejects json-error.pdf with NOT_A_PDF", () => {
    const buf = fs.readFileSync(path.join(FIXTURES_DIR, "json-error.pdf"));
    const res = validatePdf(buf);
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe("not-a-pdf");
  });

  test("rejects truncated.pdf with TRUNCATED_PDF", () => {
    const buf = fs.readFileSync(path.join(FIXTURES_DIR, "truncated.pdf"));
    const res = validatePdf(buf);
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe("truncated-pdf");
  });

  test("fails with PAGE_COUNT_OUT_OF_RANGE when expected range does not cover actual pages", () => {
    const buf = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));
    const res = validatePdf(buf, { min: 3, max: 5 });
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe("page-count-out-of-range");
  });
});

describe("2. sha256File digest computation", () => {
  test("equals SHA256SUMS for all fixtures", () => {
    const sumsContent = fs.readFileSync(path.join(FIXTURES_DIR, "SHA256SUMS"), "utf8");
    const lines = sumsContent.trim().split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      const [expectedSha, fileName] = line.trim().split(/\s+/);
      if (expectedSha === undefined || fileName === undefined)
        throw new Error(`SHA256SUMS line is not "<sha> <file>": ${line}`);
      const computed = sha256File(path.join(FIXTURES_DIR, fileName));
      expect(computed).toBe(expectedSha);
    }
  });

  test("streaming digest of a generated 5 MiB file equals buffer digest", () => {
    const largeBuf = Buffer.alloc(5 * 1024 * 1024, 0x42);
    const hashOneShot = createHash("sha256").update(largeBuf).digest("hex");
    const computed = sha256File(largeBuf);
    expect(computed).toBe(hashOneShot);
  });
});

describe("3. verifyHostChecksums", () => {
  test("correct MD5 and SHA-1 pass", () => {
    const expected = {
      md5: "a300152199c905ead60af20a1345a605",
      sha1: "9a71b4b7beae9136f41ee763996987c8a2ae117d",
    };
    const actual = {
      md5: "A300152199C905EAD60AF20A1345A605",
      sha1: "9a71b4b7beae9136f41ee763996987c8a2ae117d",
    };
    const res = verifyHostChecksums(expected, actual);
    expect(res.ok).toBe(true);
    expect(res.verified).toContain("md5");
    expect(res.verified).toContain("sha1");
  });

  test("an MD5 with one changed hex digit fails with error", () => {
    const expected = { md5: "a300152199c905ead60af20a1345a605" };
    const actual = { md5: "b300152199c905ead60af20a1345a605" };
    const res = verifyHostChecksums(expected, actual);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("MD5 checksum mismatch");
  });
});

describe("4. extractArticle determinism and image stream equivalence", () => {
  test("extracts pages 2-3 deterministically with identical bytes and image stream equivalence", () => {
    const parentBuf = fs.readFileSync(path.join(FIXTURES_DIR, "whole-issue-4page.pdf"));
    const parentSha = sha256File(parentBuf);

    const extract1 = extractArticle(parentBuf, [2, 3], parentSha);
    const extract2 = extractArticle(parentBuf, [2, 3], parentSha);

    // Byte identical outputs across multiple invocations
    expect(Buffer.compare(Buffer.from(extract1), Buffer.from(extract2))).toBe(0);

    const text1 = Buffer.from(extract1).toString("latin1");
    // CreationDate and ModDate equals documented constant
    expect(text1).toContain("/CreationDate (D:20000101000000Z)");
    expect(text1).toContain("/ModDate (D:20000101000000Z)");

    // No library Producer or Creator strings
    expect(text1).not.toContain("/Producer");
    expect(text1).not.toContain("/Creator");

    // Page count of extracted PDF is exactly 2
    const val = validatePdf(extract1);
    expect(val.valid).toBe(true);
    expect(val.pageCount).toBe(2);

    // Verify image streams from pages 2 and 3 equal the parent page's
    const parentText = Buffer.from(parentBuf).toString("latin1");
    const parentMatch2 = parentText.match(/8 0 obj[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/);
    const extractedMatch2 = text1.match(/5 0 obj[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/);
    expect(parentMatch2).not.toBeNull();
    expect(extractedMatch2).not.toBeNull();
    if (!parentMatch2 || !extractedMatch2) {
      throw new Error("Expected stream matches for page 2 image objects");
    }
    expect(extractedMatch2[1]).toBe(parentMatch2[1]);

    const parentMatch3 = parentText.match(/9 0 obj[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/);
    const extractedMatch3 = text1.match(/6 0 obj[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/);
    expect(parentMatch3).not.toBeNull();
    expect(extractedMatch3).not.toBeNull();
    if (!parentMatch3 || !extractedMatch3) {
      throw new Error("Expected stream matches for page 3 image objects");
    }
    expect(extractedMatch3[1]).toBe(parentMatch3[1]);
  });
});

describe("5. detectEmbeddedTextLayer", () => {
  test("page 1 of valid-2page.pdf is absent, page 2 is present", () => {
    const buf = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));
    expect(detectEmbeddedTextLayer(buf, [1])).toBe("absent");
    expect(detectEmbeddedTextLayer(buf, [2])).toBe("present");
    expect(detectEmbeddedTextLayer(buf)).toBe("present");
  });

  test("returns unknown on unparseable / corrupt bytes", () => {
    const garbage = Buffer.from("not a real pdf content");
    expect(detectEmbeddedTextLayer(garbage)).toBe("unknown");
  });
});

describe("6. pinFile sequence and PINNED_DIGEST_CONFLICT", () => {
  const toolRunId = newToolRunId();
  const testRoot = path.join(REPO_ROOT, "artifacts", "test-tmp", "download-facsimiles", toolRunId);
  const stagedPath = path.join(testRoot, "staged.pdf");
  const destPath = path.join(testRoot, "pinned.pdf");

  beforeAll(() => {
    fs.mkdirSync(testRoot, { recursive: true });
    const content = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));
    fs.writeFileSync(stagedPath, content);
  });

  test("pins to empty destination, then noops on identical bytes, then refuses on conflicting bytes", () => {
    const sha = sha256File(stagedPath);

    // Initial pin
    const res1 = pinFile(stagedPath, destPath, sha);
    expect(res1.action).toBe("pinned");
    expect(fs.existsSync(destPath)).toBe(true);

    // Idempotent re-run
    const res2 = pinFile(stagedPath, destPath, sha);
    expect(res2.action).toBe("noop");

    // Conflicting digest refusal
    const otherSha = "0000000000000000000000000000000000000000000000000000000000000000";
    expect(() => {
      pinFile(stagedPath, destPath, otherSha);
    }).toThrow();

    try {
      pinFile(stagedPath, destPath, otherSha);
    } catch (e: any) {
      expect(e).toBeInstanceOf(FacsimileError);
      expect(e.code).toBe("pinned-digest-conflict");
      expect(e.exitCode).toBe(2);
    }

    // Existing file digest remains intact
    expect(sha256File(destPath)).toBe(sha);
  });
});

describe("8. Rights vocabulary refusals", () => {
  const baseConfig = {
    configVersion: 1,
    key: "ap-99-001",
    candidates: [
      {
        url: "https://archive.org/details/test.pdf",
        kind: "article",
        institution: "Archive",
        hostItemId: "test",
        hostFileName: "test.pdf",
        hostFileSource: "original",
        termsStatementUrls: ["https://example.org/terms"],
        expectedPageCountRange: { min: 1, max: 10 },
      },
    ],
    articlePages: { printedFirst: 1, printedLast: 10 },
    rights: {
      rightsStatus: "scan-open-terms",
      publicationDecision: "publish",
      cloudProcessing: "permitted",
      cloudProcessingBasis: "Public domain open terms",
    },
  };

  test("scan-terms-unknown refuses with SCAN_TERMS_UNKNOWN", () => {
    const cfg = {
      ...baseConfig,
      rights: {
        ...baseConfig.rights,
        rightsStatus: "scan-terms-unknown",
      },
    };
    const res = validateConfig(cfg);
    expect(res.valid).toBe(false);
    expect(res.refusalCode).toBe("scan-terms-unknown");
  });

  test("reference-only refuses with REFERENCE_ONLY_NOT_PINNABLE", () => {
    const cfg = {
      ...baseConfig,
      rights: {
        ...baseConfig.rights,
        publicationDecision: "reference-only",
        publicationReason: "Citing only",
      },
    };
    const res = validateConfig(cfg);
    expect(res.valid).toBe(false);
    expect(res.refusalCode).toBe("reference-only-not-pinnable");
  });

  test("scan-terms-restrict-redistribution with publish refuses with RIGHTS_VOCABULARY_INVALID", () => {
    const cfg = {
      ...baseConfig,
      rights: {
        ...baseConfig.rights,
        rightsStatus: "scan-terms-restrict-redistribution",
        publicationDecision: "publish",
      },
    };
    const res = validateConfig(cfg);
    expect(res.valid).toBe(false);
    expect(res.refusalCode).toBe("rights-vocabulary-invalid");
  });

  test("cloudProcessing with no cloudProcessingBasis refuses with RIGHTS_VOCABULARY_INVALID", () => {
    const cfg = {
      ...baseConfig,
      rights: {
        ...baseConfig.rights,
        cloudProcessingBasis: "",
      },
    };
    const res = validateConfig(cfg);
    expect(res.valid).toBe(false);
    expect(res.refusalCode).toBe("rights-vocabulary-invalid");
  });
});

describe("9. Schema and denylist checks: publisher subscription and witness hosts", () => {
  const baseConfig = {
    configVersion: 1,
    key: "ap-99-001",
    candidates: [
      {
        url: "https://example.org/valid.pdf",
        kind: "article",
        institution: "Archive",
        hostItemId: "test",
        hostFileName: "test.pdf",
        hostFileSource: "original",
        termsStatementUrls: ["https://example.org/terms"],
        expectedPageCountRange: { min: 1, max: 10 },
      },
    ],
    articlePages: { printedFirst: 1, printedLast: 10 },
    rights: {
      rightsStatus: "scan-open-terms",
      publicationDecision: "publish",
      cloudProcessing: "permitted",
      cloudProcessingBasis: "Open terms",
    },
  };

  test("refuses commercial publisher Wiley subscription host with WITNESS_OR_PUBLISHER_HOST", () => {
    const cfg = {
      ...baseConfig,
      candidates: [
        {
          ...baseConfig.candidates[0],
          url: "https://onlinelibrary.wiley.com/doi/pdf/10.1002/andp.19053221004",
        },
      ],
    };
    const res = validateConfig(cfg);
    expect(res.valid).toBe(false);
    expect(res.refusalCode).toBe("witness-or-publisher-host");
    expect(res.errors[0]).toContain("onlinelibrary.wiley.com");
  });

  test("refuses Princeton Collected Papers witness host with WITNESS_OR_PUBLISHER_HOST", () => {
    const cfg = {
      ...baseConfig,
      candidates: [
        {
          ...baseConfig.candidates[0],
          url: "https://einsteinpapers.press.princeton.edu/vol2-doc/150",
        },
      ],
    };
    const res = validateConfig(cfg);
    expect(res.valid).toBe(false);
    expect(res.refusalCode).toBe("witness-or-publisher-host");
  });

  test("refuses Wikisource subdomain host with WITNESS_OR_PUBLISHER_HOST", () => {
    const cfg = {
      ...baseConfig,
      candidates: [
        {
          ...baseConfig.candidates[0],
          url: "https://de.wikisource.org/wiki/Ist_die_Tr%C3%A4gheit_eines_K%C3%B6rpers_von_seinem_Energieinhalt_abh%C3%A4ngig%3F",
        },
      ],
    };
    const res = validateConfig(cfg);
    expect(res.valid).toBe(false);
    expect(res.refusalCode).toBe("witness-or-publisher-host");
  });

  test("derivative candidate without derivativeReason fails with DERIVATIVE_WITHOUT_REASON", () => {
    const cfg = {
      ...baseConfig,
      candidates: [
        {
          ...baseConfig.candidates[0],
          hostFileSource: "derivative",
          derivativeReason: null,
        },
      ],
    };
    const res = validateConfig(cfg);
    expect(res.valid).toBe(false);
    expect(res.refusalCode).toBe("derivative-without-reason");
  });
});

describe("10. Key claims exclusion and release", () => {
  const toolRunId1 = newToolRunId();
  const toolRunId2 = newToolRunId();
  const testLocksDir = path.join(REPO_ROOT, "artifacts", "test-tmp", "locks", toolRunId1);

  beforeAll(() => {
    fs.mkdirSync(testLocksDir, { recursive: true });
  });

  test("second acquisition while claim is held fails with LOCK_HELD, and release rewrites without deletion", () => {
    const key = "ap-99-test";
    const claim1 = acquireKeyClaim(key, toolRunId1, { locksDir: testLocksDir });
    expect(claim1.acquired).toBe(true);
    expect(fs.existsSync(claim1.claimPath)).toBe(true);

    // Second acquisition for the same key while PID is alive must fail with LOCK_HELD
    expect(() => {
      acquireKeyClaim(key, toolRunId2, { locksDir: testLocksDir });
    }).toThrow();

    try {
      acquireKeyClaim(key, toolRunId2, { locksDir: testLocksDir });
    } catch (e: any) {
      expect(e).toBeInstanceOf(FacsimileError);
      expect(e.code).toBe("lock-held");
    }

    // Release rewrites state to released
    releaseKeyClaim(claim1.claimPath);
    expect(fs.existsSync(claim1.claimPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(claim1.claimPath, "utf8"));
    expect(data.state).toBe("released");
  });
});

describe("11. verifyPins reporting", () => {
  const testRoot = path.join(REPO_ROOT, "artifacts", "test-tmp", "verify-pins", newToolRunId());
  const configDir = path.join(testRoot, "configs");

  beforeAll(() => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(path.join(testRoot, "public", "papers", "pdfs"), { recursive: true });
    fs.mkdirSync(path.join(testRoot, "sources", "pinned"), { recursive: true });

    // Pinned file 1: intact
    const pdfBuf = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));
    const pdfSha = sha256File(pdfBuf);
    fs.writeFileSync(path.join(testRoot, "public", "papers", "pdfs", "ap-99-001.pdf"), pdfBuf);

    // Write config 1 (publish, intact)
    const cfg1 = {
      configVersion: 1,
      key: "ap-99-001",
      candidates: [
        {
          url: "https://example.org/1.pdf",
          kind: "article",
          expectedPageCountRange: { min: 1, max: 2 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: { rightsStatus: "scan-open-terms", publicationDecision: "publish" },
      pinned: { path: "public/papers/pdfs/ap-99-001.pdf", sha256: pdfSha },
    };
    fs.writeFileSync(path.join(configDir, "ap-99-001.yaml"), JSON.stringify(cfg1));

    // Pinned file 2: mismatch
    const badBuf = Buffer.from(pdfBuf);
    badBuf[badBuf.length - 10] = 0x30;
    fs.writeFileSync(path.join(testRoot, "public", "papers", "pdfs", "ap-99-002.pdf"), badBuf);

    const cfg2 = {
      configVersion: 1,
      key: "ap-99-002",
      candidates: [
        {
          url: "https://example.org/2.pdf",
          kind: "article",
          expectedPageCountRange: { min: 1, max: 2 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: { rightsStatus: "scan-open-terms", publicationDecision: "publish" },
      pinned: { path: "public/papers/pdfs/ap-99-002.pdf", sha256: pdfSha },
    };
    fs.writeFileSync(path.join(configDir, "ap-99-002.yaml"), JSON.stringify(cfg2));

    // Config 3: missing publish file
    const cfg3 = {
      configVersion: 1,
      key: "ap-99-003",
      candidates: [
        {
          url: "https://example.org/3.pdf",
          kind: "article",
          expectedPageCountRange: { min: 1, max: 2 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: { rightsStatus: "scan-open-terms", publicationDecision: "publish" },
      pinned: { path: "public/papers/pdfs/ap-99-003.pdf", sha256: pdfSha },
    };
    fs.writeFileSync(path.join(configDir, "ap-99-003.yaml"), JSON.stringify(cfg3));

    // Config 4: missing pin-local-only file
    const cfg4 = {
      configVersion: 1,
      key: "ap-99-004",
      candidates: [
        {
          url: "https://example.org/4.pdf",
          kind: "article",
          expectedPageCountRange: { min: 1, max: 2 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "pin-local-only",
        publicationReason: "Local study",
      },
      pinned: { path: "sources/pinned/ap-99-004.pdf", sha256: pdfSha },
    };
    fs.writeFileSync(path.join(configDir, "ap-99-004.yaml"), JSON.stringify(cfg4));
  });

  test("reports ok for intact, mismatch for changed byte, missing for publish, not-available for local-only", () => {
    const { results, allOk } = verifyPins({ configDir, repoRoot: testRoot, requireLocal: false });
    expect(entry(results, "ap-99-001").status).toBe("ok");
    expect(entry(results, "ap-99-002").status).toBe("mismatch");
    expect(entry(results, "ap-99-003").status).toBe("missing");
    expect(entry(results, "ap-99-004").status).toBe("not-available");
    expect(allOk).toBe(false);
  });
});

describe("12. Loopback HTTP network test server", () => {
  let server: http.Server;
  let serverPort: number;
  let retryCount = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", `http://127.0.0.1:${serverPort}`);

      if (url.pathname === "/valid.pdf") {
        const buf = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));
        res.writeHead(200, { "Content-Type": "application/pdf" });
        res.end(buf);
      } else if (url.pathname === "/redirect-chain") {
        res.writeHead(302, { Location: `http://127.0.0.1:${serverPort}/valid.pdf` });
        res.end();
      } else if (url.pathname === "/redirect-insecure") {
        res.writeHead(302, { Location: "http://example.com/insecure.pdf" });
        res.end();
      } else if (url.pathname === "/retry-flaky") {
        retryCount++;
        if (retryCount <= 2) {
          res.writeHead(503, { "Content-Type": "text/plain" });
          res.end("Service Unavailable");
        } else {
          const buf = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));
          res.writeHead(200, { "Content-Type": "application/pdf" });
          res.end(buf);
        }
      } else if (url.pathname === "/oversize.pdf") {
        res.writeHead(200, { "Content-Type": "application/pdf" });
        res.end(Buffer.alloc(2000, 0x50));
      } else if (url.pathname === "/html-as-pdf") {
        res.writeHead(200, { "Content-Type": "application/pdf" });
        res.end("<html><body>Error</body></html>");
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          serverPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  test("fetches PDF across redirect chain on loopback test server", async () => {
    const stagingPath = path.join(REPO_ROOT, "artifacts", "test-tmp", "net-test", "staged.pdf");
    const res = await fetchToStaging(`http://127.0.0.1:${serverPort}/redirect-chain`, stagingPath);
    expect(res.httpStatus).toBe(200);
    expect(res.redirects.length).toBe(1);
    expect(validatePdf(fs.readFileSync(stagingPath)).valid).toBe(true);
  });

  test("refuses redirect to non-loopback insecure HTTP with REDIRECT_TO_HTTP", async () => {
    const stagingPath = path.join(REPO_ROOT, "artifacts", "test-tmp", "net-test", "insecure.pdf");
    try {
      await fetchToStaging(`http://127.0.0.1:${serverPort}/redirect-insecure`, stagingPath);
      expect(true).toBe(false); // unreachable
    } catch (e: any) {
      expect(e).toBeInstanceOf(FacsimileError);
      expect(e.code).toBe("redirect-to-http");
    }
  });

  test("retries on 503 and succeeds on 3rd attempt", async () => {
    retryCount = 0;
    const stagingPath = path.join(REPO_ROOT, "artifacts", "test-tmp", "net-test", "retry.pdf");
    const res = await fetchToStaging(`http://127.0.0.1:${serverPort}/retry-flaky`, stagingPath);
    expect(res.httpStatus).toBe(200);
    expect(retryCount).toBe(3);
  });

  test("fails on 404 with HTTP_STATUS", async () => {
    const stagingPath = path.join(REPO_ROOT, "artifacts", "test-tmp", "net-test", "missing.pdf");
    try {
      await fetchToStaging(`http://127.0.0.1:${serverPort}/missing.pdf`, stagingPath);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e).toBeInstanceOf(FacsimileError);
      expect(e.code).toBe("http-status");
    }
  });

  test("aborts and throws SIZE_LIMIT_EXCEEDED when body exceeds maxBytes", async () => {
    const stagingPath = path.join(REPO_ROOT, "artifacts", "test-tmp", "net-test", "oversize.pdf");
    try {
      await fetchToStaging(`http://127.0.0.1:${serverPort}/oversize.pdf`, stagingPath, {
        maxBytes: 500,
      });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e).toBeInstanceOf(FacsimileError);
      expect(e.code).toBe("size-limit-exceeded");
    }
  });
});

describe("13. Identity and runId discipline", () => {
  test("newToolRunId matches timestamp-plus-hex format and does not use runId or logRunId", () => {
    const id = newToolRunId();
    expect(/^\d{8}T\d{6}Z-[0-9a-f]+$/.test(id)).toBe(true);
  });

  test("receipt stub contains downloadLog and no literal runId field", () => {
    const cfg: any = {
      key: "ap-99-001",
      candidates: [
        {
          url: "https://example.org/1.pdf",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "1.pdf",
        },
      ],
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
      },
      pinned: {
        path: "public/papers/pdfs/ap-99-001.pdf",
        sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        pageCount: 2,
        toolRunId: newToolRunId(),
      },
    };
    const stub = emitReceiptStub(cfg, "artifacts/facsimile-logs/ap-99-001/run.jsonl");
    expect(stub).toContain("downloadLog:");
    expect(stub).not.toMatch(/\brunId\s*:/);
    expect(stub).not.toMatch(/\blogRunId\s*:/);
  });
});

describe("14. Static guard against local OCR and text extraction APIs", () => {
  test("scripts/download-facsimiles.ts does not contain prohibited OCR or extraction strings", () => {
    const content = fs.readFileSync(
      path.join(REPO_ROOT, "scripts", "download-facsimiles.ts"),
      "utf8",
    );

    const prohibitedOcr = ["tesseract", "ocrmypdf", "focr", "easyocr", "paddleocr", "pix2tex"];
    for (const tool of prohibitedOcr) {
      expect(content.toLowerCase()).not.toContain(tool);
    }

    const prohibitedExtraction = [["get", "TextContent"].join(""), "pdftotext", "extractText"];
    for (const api of prohibitedExtraction) {
      expect(content).not.toContain(api);
    }
  });

  test("scripts/download-facsimiles.ts never imports or invokes child_process or subprocess execution", () => {
    const content = fs.readFileSync(
      path.join(REPO_ROOT, "scripts", "download-facsimiles.ts"),
      "utf8",
    );

    const prohibitedSubprocess = ["child_process", "execSync", "spawnSync", "execFile"];
    for (const sub of prohibitedSubprocess) {
      expect(content).not.toContain(sub);
    }
    // Also assert no standalone spawn(...) or fork(...) invocations
    expect(content).not.toMatch(/\bspawn\s*\(/);
    expect(content).not.toMatch(/\bfork\s*\(/);
  });

  test("scripts/download-facsimiles.ts imports only standard libraries and local helpers", () => {
    const content = fs.readFileSync(
      path.join(REPO_ROOT, "scripts", "download-facsimiles.ts"),
      "utf8",
    );
    const fromMatches = content.match(/from\s+["'][^"']+["']/g) || [];
    expect(fromMatches.length).toBeGreaterThan(0);
    for (const match of fromMatches) {
      expect(match).toMatch(/from\s+["'](node:[a-z/]+|js-yaml|\.\/[a-zA-Z0-9/._-]+)["']/);
    }
  });

  test("detectEmbeddedTextLayer strictly returns enum status and never exposes text", () => {
    const buf = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));
    const status = detectEmbeddedTextLayer(buf, [2]);
    expect(["present", "absent", "unknown"]).toContain(status);
  });

  test("download-facsimiles exports zero text-decoding or OCR APIs", async () => {
    const mod = await import("./download-facsimiles");
    const exportedKeys = Object.keys(mod);
    expect(exportedKeys).not.toContain("extractText");
    expect(exportedKeys).not.toContain("transcribe");
    expect(exportedKeys).not.toContain("ocr");
  });
});

describe("15. Quality gate checkAllConfigs and planted bad input refusal", () => {
  test("validates all real production facsimile source configs cleanly", () => {
    const { valid, results } = checkAllConfigs();
    expect(valid).toBe(true);
    expect(Object.keys(results).length).toBeGreaterThanOrEqual(6);
    expect(entry(results, "ap-17-549.yaml").valid).toBe(true);
  });

  // am-xgf9: the missing-anchor rule used to be gated on the anchor being present.
  //
  // validateConfig ran validateFacsimileAnchor only inside
  //   if (c.verifiedAnchor !== undefined || c.articlePages.verifiedAnchor !== undefined)
  // so rule 1 of that function - "Missing anchor must FAIL loudly" - was
  // unreachable from --check-config, the gate people actually run while editing
  // configs. It looked like it worked because ap-19-289 WAS caught: that file
  // writes `verifiedAnchor:` with its fields de-indented to sibling level, so
  // YAML parses the key as present with a null value and the guard let the rule
  // run. ap-34-591 omits the key entirely and was reported valid while the pin
  // gate refused it. Two configs failing the same way, opposite verdicts.
  //
  // These two cases are that exact pair, in the two shapes that decided it.
  function configWithoutAnchor(extra: Record<string, unknown>): Record<string, unknown> {
    return {
      configVersion: 1,
      key: "ap-99-777",
      candidates: [
        {
          url: "https://archive.org/download/item/ap-99-777.pdf",
          kind: "article",
          institution: "Internet Archive",
          hostItemId: "test-item",
          hostFileName: "ap-99-777.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 4 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2, parentPageIndices: [1, 2], ...extra },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    };
  }

  test("a config with NO verifiedAnchor key is refused (the ap-34-591 shape)", () => {
    const res = validateConfig(configWithoutAnchor({}));
    expect(res.valid).toBe(false);
    expect(res.refusalCode).toBe("missing-verified-anchor");
  });

  test("a config whose verifiedAnchor key is present but null is refused too (the ap-19-289 shape)", () => {
    // The state that used to be the ONLY one caught. Keeping both means the next
    // reader can see that the verdict no longer depends on which way the file broke.
    const res = validateConfig(configWithoutAnchor({ verifiedAnchor: null }));
    expect(res.valid).toBe(false);
    expect(res.refusalCode).toBe("missing-verified-anchor");
  });

  test("control: the same config WITH an anchor is accepted, so this refuses nothing it should admit", () => {
    const res = validateConfig({
      ...configWithoutAnchor({}),
      verifiedAnchor: { parentPageIndex: 1, printedPage: 1, verifiedBy: "test-fixture" },
    });
    expect(res.valid).toBe(true);
  });

  test("fails quality gate on a planted bad config (publisher under subscription license)", () => {
    const tempDir = path.join(REPO_ROOT, "artifacts", "test-tmp", "bad-configs", newToolRunId());
    fs.mkdirSync(tempDir, { recursive: true });
    const badYaml = `
configVersion: 1
key: ap-99-999
candidates:
  - url: "https://onlinelibrary.wiley.com/doi/pdf/10.1002/andp.19053221004"
    kind: article
    institution: "Wiley"
    hostItemId: "test"
    hostFileName: "test.pdf"
    hostFileSource: original
    termsStatementUrls: []
    expectedPageCountRange: { min: 1, max: 10 }
articlePages:
  printedFirst: 1
  printedLast: 10
rights:
  rightsStatus: scan-open-terms
  publicationDecision: publish
  cloudProcessing: permitted
  cloudProcessingBasis: "test"
`;
    fs.writeFileSync(path.join(tempDir, "ap-99-999.yaml"), badYaml, "utf8");
    const { valid, results } = checkAllConfigs(tempDir);
    expect(valid).toBe(false);
    expect(entry(results, "ap-99-999.yaml").valid).toBe(false);
    expect(entry(results, "ap-99-999.yaml").refusalCode).toBe("witness-or-publisher-host");
    expect(entry(results, "ap-99-999.yaml").errors[0]).toContain("onlinelibrary.wiley.com");
  });
});

describe("16. Error codes are classified, not defaulted (am-7mp8)", () => {
  test("every code the script throws is a member of the union and lands in its class", () => {
    // EXTRACTION_ERROR is thrown three times in the page-extraction path. It was
    // missing from FacsimileErrorCode, so getExitCodeForError fell through to its
    // default and reported a PDF-structure failure as a general failure. scripts/
    // is outside the typecheck program, so nothing said so.
    expect(new FacsimileError("extraction-error", "missing page object").exitCode).toBe(3);
    for (const code of [
      "pdf-parse-failed",
      "parent-page-index-missing",
      "extraction-nondeterministic",
    ] as const) {
      expect(getExitCodeForError(code)).toBe(3);
    }
  });

  test("policy refusals and network failures keep their own classes", () => {
    expect(getExitCodeForError("pinned-digest-conflict")).toBe(2);
    expect(getExitCodeForError("network-retries-exhausted")).toBe(4);
  });

  test("a code outside the union still falls back to a general failure", () => {
    // Planted negative: the fallback must remain reachable, or this test would
    // pass for any code at all and prove nothing about the mapping.
    expect(getExitCodeForError("NOT_A_REAL_CODE" as never)).toBe(1);
    expect(getExitCodeForError("unexpected-error")).toBe(1);
  });
});

describe("17. Complete downloadFacsimile engine lifecycle, parent reuse, and refusals with mockFetch", () => {
  const testRoot = path.join(
    REPO_ROOT,
    "artifacts",
    "test-tmp",
    "mock-fetch-suite",
    newToolRunId(),
  );
  const configDir = path.join(testRoot, "configs");
  const valid2PageBuf = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));
  const valid2PageMd5 = createHash("md5").update(valid2PageBuf).digest("hex");
  const valid2PageSha1 = createHash("sha1").update(valid2PageBuf).digest("hex");
  const valid2PageSha256 = createHash("sha256").update(valid2PageBuf).digest("hex");

  const wholeIssueBuf = fs.readFileSync(path.join(FIXTURES_DIR, "whole-issue-4page.pdf"));
  const wholeIssueMd5 = createHash("md5").update(wholeIssueBuf).digest("hex");
  const wholeIssueSha1 = createHash("sha1").update(wholeIssueBuf).digest("hex");

  beforeAll(() => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(path.join(testRoot, "public", "papers", "pdfs"), { recursive: true });
    fs.mkdirSync(path.join(testRoot, "sources", "pinned"), { recursive: true });
  });

  /**
   * Writes a fixture config, supplying the verified anchor and parent-page
   * mapping every config must now carry (am-xgf9).
   *
   * --check-config used to run the anchor rule only when a verifiedAnchor key
   * was already present, so these fixtures never had to satisfy a rule the pin
   * gate has always applied. They are download-lifecycle fixtures, not
   * page-mapping fixtures: the defaults below are the identity mapping (parent
   * page n is printed page n), and a test that cares supplies its own.
   */
  function writeTestConfig(key: string, cfg: Record<string, unknown>): string {
    const filePath = path.join(configDir, `${key}.yaml`);
    const ap = { ...((cfg.articlePages as Record<string, unknown>) ?? {}) };
    const first = typeof ap.printedFirst === "number" ? ap.printedFirst : 1;
    const last = typeof ap.printedLast === "number" ? ap.printedLast : first;
    if (ap.parentPageIndices === undefined) {
      ap.parentPageIndices = Array.from({ length: last - first + 1 }, (_, i) => first + i);
    }
    const complete = {
      ...cfg,
      articlePages: ap,
      verifiedAnchor: cfg.verifiedAnchor ?? {
        parentPageIndex: (ap.parentPageIndices as number[])[0],
        printedPage: first,
        verifiedBy: "test-fixture",
      },
    };
    fs.writeFileSync(filePath, yaml.dump(complete, { indent: 2, lineWidth: -1 }), "utf8");
    return filePath;
  }

  test("17.1 happy path: article candidate downloaded, host checksums verified, validated, pinned to public root, receipt stub emitted, log written", async () => {
    const key = "ap-99-101";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/ap-99-101.pdf",
          kind: "article",
          institution: "Internet Archive",
          hostItemId: "test-item-01",
          hostFileName: "ap-99-101.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 4 },
          hostChecksums: { md5: valid2PageMd5, sha1: valid2PageSha1 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "Public domain open terms",
      },
    });

    const mockFetch: typeof fetch = async (_input, init) => {
      if (init?.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(valid2PageBuf.length),
          },
        });
      }
      return new Response(valid2PageBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    const res = await downloadFacsimile(key, {
      configDir,
      repoRoot: testRoot,
      fetchFn: mockFetch,
    });

    expect(res.action).toBe("pinned");
    expect(res.targetPath).toBe(`public/papers/pdfs/${key}.pdf`);
    expect(fs.existsSync(res.targetAbsPath)).toBe(true);
    expect(res.sha256).toBe(valid2PageSha256);
    expect(sha256File(res.targetAbsPath)).toBe(valid2PageSha256);

    // Receipt stub exists, parses, and has required fields
    expect(res.receiptStubPath).toBeDefined();
    expect(res.receiptStubPath && fs.existsSync(res.receiptStubPath)).toBe(true);
    const stubContent = fs.readFileSync(res.receiptStubPath || "", "utf8");
    const stubObj = (yaml.load(stubContent) as any).scan;
    expect(stubObj.sha256).toBe(valid2PageSha256);
    expect(stubObj.downloadLog).toBe(res.logPath);
    expect(stubObj.hostChecksumsVerified).toEqual(["md5", "sha1"]);

    // Structured log exists and has toolRunId and beadId
    expect(fs.existsSync(res.logPath)).toBe(true);
    const logLines = fs.readFileSync(res.logPath, "utf8").trim().split("\n");
    const lastLog = logLines[logLines.length - 1];
    expect(lastLog).toBeDefined();
    const logLine = JSON.parse(lastLog || "{}");
    expect(logLine.action).toBe("pinned");
    expect(logLine.toolRunId).toBe(res.toolRunId);
    expect(logLine.beadId).toBe("am-src-download-script-15ar");
    expect(logLine.exitCode).toBe(0);

    // Config on disk was updated with pinned record
    const updatedCfg = yaml.load(
      fs.readFileSync(path.join(configDir, `${key}.yaml`), "utf8"),
    ) as any;
    expect(updatedCfg.pinned).toBeDefined();
    expect(updatedCfg.pinned.sha256).toBe(valid2PageSha256);
    expect(updatedCfg.pinned.toolRunId).toBe(res.toolRunId);
  });

  test("17.2 idempotent re-run: downloading again with identical bytes returns noop", async () => {
    const key = "ap-99-101";
    const mockFetch: typeof fetch = async () => {
      return new Response(valid2PageBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    const res = await downloadFacsimile(key, {
      configDir,
      repoRoot: testRoot,
      fetchFn: mockFetch,
    });

    expect(res.action).toBe("noop");
    expect(res.sha256).toBe(valid2PageSha256);
  });

  test("17.3 happy path: whole-issue extraction cuts pages, retains parent, and second key reuses parent", async () => {
    const parentKey1 = "ap-99-103";
    const parentKey2 = "ap-99-104";
    const parentUrl = "https://archive.org/download/volume17/ap-whole-issue.pdf";

    writeTestConfig(parentKey1, {
      configVersion: 1,
      key: parentKey1,
      candidates: [
        {
          url: parentUrl,
          kind: "whole-issue",
          institution: "Internet Archive",
          hostItemId: "volume17",
          hostFileName: "issue.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 4, max: 4 },
          hostChecksums: { md5: wholeIssueMd5, sha1: wholeIssueSha1 },
        },
      ],
      articlePages: { printedFirst: 2, printedLast: 3, parentPageIndices: [2, 3] },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "Public domain open terms",
      },
    });

    writeTestConfig(parentKey2, {
      configVersion: 1,
      key: parentKey2,
      candidates: [
        {
          url: parentUrl,
          kind: "whole-issue",
          institution: "Internet Archive",
          hostItemId: "volume17",
          hostFileName: "issue.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 4, max: 4 },
          hostChecksums: { md5: wholeIssueMd5, sha1: wholeIssueSha1 },
        },
      ],
      articlePages: { printedFirst: 3, printedLast: 4, parentPageIndices: [3, 4] },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "pin-local-only",
        publicationReason: "Study copy for extraction check",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "Public domain open terms",
      },
    });

    const mockFetch: typeof fetch = async () => {
      return new Response(wholeIssueBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    // First extraction (pages 2, 3)
    const res1 = await downloadFacsimile(parentKey1, {
      configDir,
      repoRoot: testRoot,
      fetchFn: mockFetch,
    });

    expect(res1.action).toBe("pinned");
    expect(res1.pinnedRecord.parent).toBeDefined();
    const parentSha = res1.pinnedRecord.parent?.sha256;
    expect(parentSha).toBeDefined();
    expect(res1.pinnedRecord.parent?.parentPageIndices).toEqual([2, 3]);

    const retainedParentPath = path.join(testRoot, "sources", "parents", `${parentSha}.pdf`);
    expect(fs.existsSync(retainedParentPath)).toBe(true);

    // Second extraction (pages 3, 4) reusing the parent scan
    const res2 = await downloadFacsimile(parentKey2, {
      configDir,
      repoRoot: testRoot,
      fetchFn: mockFetch,
    });

    expect(res2.action).toBe("pinned");
    expect(res2.pinnedRecord.parent).toBeDefined();
    expect(res2.pinnedRecord.parent?.sha256).toBe(parentSha);
    expect(res2.pinnedRecord.parent?.parentPageIndices).toEqual([3, 4]);

    // Target 2 is pinned to sources/pinned/ because of pin-local-only
    expect(res2.targetPath).toBe(`sources/pinned/${parentKey2}.pdf`);
    expect(fs.existsSync(res2.targetAbsPath)).toBe(true);
  });

  test("17.4 refusal: conflicting pinned file on disk refuses with PINNED_DIGEST_CONFLICT (exit 2)", async () => {
    const key = "ap-99-105";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/conflict.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "conflict.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    // Create a pre-existing conflicting file on disk at destination
    const dest = path.join(testRoot, "public", "papers", "pdfs", `${key}.pdf`);
    fs.writeFileSync(dest, "corrupted or different PDF bytes");
    const preMtime = fs.statSync(dest).mtimeMs;

    const mockFetch: typeof fetch = async () => {
      return new Response(valid2PageBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("pinned-digest-conflict");
    expect(caughtError.exitCode).toBe(2);

    // Existing file must remain unmodified (Rule 1)
    expect(fs.readFileSync(dest, "utf8")).toBe("corrupted or different PDF bytes");
    expect(fs.statSync(dest).mtimeMs).toBe(preMtime);
  });

  test("17.5 refusal: conflicting pinned record in config refuses with PINNED_DIGEST_CONFLICT (exit 2)", async () => {
    const key = "ap-99-106";
    const conflictSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/conflict-cfg.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "conflict-cfg.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
      pinned: {
        path: `public/papers/pdfs/${key}.pdf`,
        sha256: conflictSha,
        pageCount: 2,
        mimeType: "application/pdf",
        acquisitionDate: "2026-01-01",
        originUrl: "https://archive.org/download/item/conflict-cfg.pdf",
        finalUrl: "https://archive.org/download/item/conflict-cfg.pdf",
        candidateIndex: 0,
        hostFileSource: "original",
        hostChecksumsVerified: [],
        embeddedTextLayer: "absent",
        pdfLibrary: { name: "annus-mirabilis-pdf", version: "1.0.0" },
        toolRunId: newToolRunId(),
      },
    });

    const mockFetch: typeof fetch = async () => {
      return new Response(valid2PageBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("pinned-digest-conflict");
    expect(caughtError.exitCode).toBe(2);

    // Config must not be overwritten
    const cfgAfter = yaml.load(fs.readFileSync(path.join(configDir, `${key}.yaml`), "utf8")) as any;
    expect(cfgAfter.pinned.sha256).toBe(conflictSha);
  });

  test("17.6 refusal: host checksum mismatch refuses with HOST_CHECKSUM_MISMATCH (exit 3)", async () => {
    const key = "ap-99-107";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/test.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "test.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
          hostChecksums: { md5: "00000000000000000000000000000000" },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    const mockFetch: typeof fetch = async () => {
      return new Response(valid2PageBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("host-checksum-mismatch");
    expect(caughtError.exitCode).toBe(3);
  });

  test("17.7 refusal: HTML served instead of PDF refuses with NOT_A_PDF (exit 3)", async () => {
    const key = "ap-99-108";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/html.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "html.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    const mockFetch: typeof fetch = async () => {
      return new Response("<!DOCTYPE html><html><body>Error 403 Forbidden</body></html>", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("not-a-pdf");
    expect(caughtError.exitCode).toBe(3);
  });

  test("17.8 refusal: JSON error response refuses with NOT_A_PDF (exit 3)", async () => {
    const key = "ap-99-109";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/error.json",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "error.json",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("not-a-pdf");
    expect(caughtError.exitCode).toBe(3);
  });

  test("17.9 refusal: truncated PDF refuses with TRUNCATED_PDF (exit 3)", async () => {
    const key = "ap-99-110";
    const truncatedBuf = fs.readFileSync(path.join(FIXTURES_DIR, "truncated.pdf"));
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/truncated.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "truncated.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    const mockFetch: typeof fetch = async () => {
      return new Response(truncatedBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("truncated-pdf");
    expect(caughtError.exitCode).toBe(3);
  });

  test("17.10 refusal: page count out of range refuses with PAGE_COUNT_OUT_OF_RANGE (exit 3)", async () => {
    const key = "ap-99-111";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/test.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "test.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 10, max: 20 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    const mockFetch: typeof fetch = async () => {
      return new Response(valid2PageBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("page-count-out-of-range");
    expect(caughtError.exitCode).toBe(3);
  });

  test("17.11 refusal: oversize download refuses with SIZE_LIMIT_EXCEEDED (exit 4)", async () => {
    const key = "ap-99-112";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/oversize.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "oversize.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
          maxBytes: 200,
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    const mockFetch: typeof fetch = async () => {
      return new Response(valid2PageBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("size-limit-exceeded");
    expect(caughtError.exitCode).toBe(4);
  });

  test("17.12 refusal: HTTP status 404 refuses with HTTP_STATUS (exit 4)", async () => {
    const key = "ap-99-113";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/notfound.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "notfound.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    const mockFetch: typeof fetch = async () => {
      return new Response("Not Found", { status: 404 });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("http-status");
    expect(caughtError.exitCode).toBe(4);
  });

  test("17.13 refusal: insecure HTTP redirect hop refuses with REDIRECT_TO_HTTP (exit 4)", async () => {
    const key = "ap-99-114";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/start.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "start.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    const mockFetch: typeof fetch = async (input) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith("https:")) {
        return new Response(null, {
          status: 302,
          headers: { Location: "http://insecure.example.org/diverted.pdf" },
        });
      }
      return new Response(valid2PageBuf, { status: 200 });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("redirect-to-http");
    expect(caughtError.exitCode).toBe(4);
  });

  test("17.14 refusal: network retries exhausted on persistent 503 (exit 4)", async () => {
    const key = "ap-99-115";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/flaky.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "flaky.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    let calls = 0;
    const mockFetch: typeof fetch = async () => {
      calls++;
      return new Response("Service Unavailable", { status: 503 });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
        baseDelayMs: 0,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("network-retries-exhausted");
    expect(caughtError.exitCode).toBe(4);
    expect(calls).toBe(4); // initial + 3 retries
  });

  test("17.15 dry-run mode validates configuration without downloading body or pinning files", async () => {
    const key = "ap-99-116";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/dryrun.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "dryrun.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    let getCalled = false;
    const mockFetch: typeof fetch = async (_input, init) => {
      if (init?.method === "GET") getCalled = true;
      return new Response(null, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    const res = await downloadFacsimile(key, {
      configDir,
      repoRoot: testRoot,
      fetchFn: mockFetch,
      dryRun: true,
    });

    expect(res.action).toBe("noop");
    expect(getCalled).toBe(false);
    expect(fs.existsSync(res.targetAbsPath)).toBe(false);
  });

  test("17.16 lock exclusion: second run refuses with LOCK_HELD (exit 2)", async () => {
    const key = "ap-99-117";
    writeTestConfig(key, {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/lock.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "lock.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2 },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    });

    // Acquire lock manually for this key
    const locksDir = path.join(testRoot, "artifacts", "locks", "download-facsimiles");
    const activeClaim = acquireKeyClaim(key, newToolRunId(), { locksDir });

    const mockFetch: typeof fetch = async () => {
      return new Response(valid2PageBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    let caughtError: any = null;
    try {
      await downloadFacsimile(key, {
        configDir,
        repoRoot: testRoot,
        fetchFn: mockFetch,
        locksDir,
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(FacsimileError);
    expect(caughtError.code).toBe("lock-held");
    expect(caughtError.exitCode).toBe(2);

    releaseKeyClaim(activeClaim.claimPath);
  });
});

describe("18. Configuration immutability and atomic updates (test 7 from spec)", () => {
  const testRoot = path.join(
    REPO_ROOT,
    "artifacts",
    "test-tmp",
    "config-immutability",
    newToolRunId(),
  );
  const configDir = path.join(testRoot, "configs");
  const valid2PageBuf = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));

  beforeAll(() => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(path.join(testRoot, "public", "papers", "pdfs"), { recursive: true });
  });

  test("forced validation failure leaves key's file byte-identical; successful pin of A leaves B byte-identical", async () => {
    const keyA = "ap-99-201";
    const keyB = "ap-99-202";

    const cfgA = {
      configVersion: 1,
      key: keyA,
      candidates: [
        {
          url: "https://archive.org/download/item/a.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "a.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2, parentPageIndices: [1, 2] },
      // Required of every config since am-xgf9; identity mapping, as above.
      verifiedAnchor: { parentPageIndex: 1, printedPage: 1, verifiedBy: "test-fixture" },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    };

    const cfgB = {
      configVersion: 1,
      key: keyB,
      candidates: [
        {
          url: "https://archive.org/download/item/b.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "b.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2, parentPageIndices: [1, 2] },
      // Required of every config since am-xgf9; identity mapping, as above.
      verifiedAnchor: { parentPageIndex: 1, printedPage: 1, verifiedBy: "test-fixture" },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    };

    const pathA = path.join(configDir, `${keyA}.yaml`);
    const pathB = path.join(configDir, `${keyB}.yaml`);
    fs.writeFileSync(pathA, yaml.dump(cfgA, { indent: 2, lineWidth: -1 }), "utf8");
    fs.writeFileSync(pathB, yaml.dump(cfgB, { indent: 2, lineWidth: -1 }), "utf8");

    const initialA = fs.readFileSync(pathA, "utf8");
    const initialB = fs.readFileSync(pathB, "utf8");

    // 1. Force failure on key A (mock returns HTML instead of PDF)
    const failingFetch: typeof fetch = async () => {
      return new Response("<html>Not a PDF</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    };

    try {
      await downloadFacsimile(keyA, { configDir, repoRoot: testRoot, fetchFn: failingFetch });
    } catch {
      // Expected refusal
    }

    // Key A's config file must remain byte-identical after failure
    expect(fs.readFileSync(pathA, "utf8")).toBe(initialA);

    // 2. Successful pin of key A
    const successFetch: typeof fetch = async () => {
      return new Response(valid2PageBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    await downloadFacsimile(keyA, { configDir, repoRoot: testRoot, fetchFn: successFetch });

    // Key A's config was updated with pinned block
    expect(fs.readFileSync(pathA, "utf8")).not.toBe(initialA);

    // Key B's config file must remain completely byte-identical
    expect(fs.readFileSync(pathB, "utf8")).toBe(initialB);
  });
});

describe("19. Stale lock detection, age reporting, and take-over-stale", () => {
  const testLocksDir = path.join(REPO_ROOT, "artifacts", "test-tmp", "stale-locks", newToolRunId());

  beforeAll(() => {
    fs.mkdirSync(testLocksDir, { recursive: true });
  });

  test("stale claim (dead PID) requires explicit --take-over-stale to supersede without deleting", () => {
    const key = "ap-99-301";
    const keyLocksDir = path.join(testLocksDir, key);
    fs.mkdirSync(keyLocksDir, { recursive: true });

    const staleToolRunId = "20260101T000000Z-deadbeef";
    const staleClaimPath = path.join(keyLocksDir, `${staleToolRunId}.claim`);
    const staleData = {
      pid: 99999999, // Unlikely to exist
      toolRunId: staleToolRunId,
      key,
      state: "held",
      acquiredAt: new Date(Date.now() - 30_000).toISOString(),
    };
    fs.writeFileSync(staleClaimPath, JSON.stringify(staleData, null, 2), "utf8");

    // Without takeOverStale -> throws LOCK_HELD with stale claim details
    let caught: any = null;
    try {
      acquireKeyClaim(key, newToolRunId(), { locksDir: testLocksDir });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(FacsimileError);
    expect(caught.code).toBe("lock-held");
    expect(caught.message).toContain("Stale claim held for key");
    expect(caught.message).toContain("dead PID 99999999");
    expect(caught.message).toContain(`--take-over-stale ${staleToolRunId}`);

    // With takeOverStale matching -> succeeds!
    const newToolRun = newToolRunId();
    const res = acquireKeyClaim(key, newToolRun, {
      locksDir: testLocksDir,
      takeOverStale: staleToolRunId,
    });
    expect(res.acquired).toBe(true);

    // Verify stale claim file still exists (never deleted) and state is superseded
    expect(fs.existsSync(staleClaimPath)).toBe(true);
    const updatedStaleData = JSON.parse(fs.readFileSync(staleClaimPath, "utf8"));
    expect(updatedStaleData.state).toBe("superseded");
    expect(updatedStaleData.supersededBy).toBe(newToolRun);

    releaseKeyClaim(res.claimPath);
  });
});

describe("20. CLI main entrypoint argument parsing and mockFetch dispatch", () => {
  const testRoot = path.join(REPO_ROOT, "artifacts", "test-tmp", "cli-entrypoint", newToolRunId());
  const configDir = path.join(testRoot, "configs");
  const valid2PageBuf = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));

  beforeAll(() => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(path.join(testRoot, "public", "papers", "pdfs"), { recursive: true });

    const key = "ap-99-401";
    const cfg = {
      configVersion: 1,
      key,
      candidates: [
        {
          url: "https://archive.org/download/item/cli.pdf",
          kind: "article",
          institution: "Archive",
          hostItemId: "item",
          hostFileName: "cli.pdf",
          hostFileSource: "original",
          termsStatementUrls: ["https://example.org/terms"],
          expectedPageCountRange: { min: 1, max: 5 },
        },
      ],
      articlePages: { printedFirst: 1, printedLast: 2, parentPageIndices: [1, 2] },
      // Required of every config since am-xgf9; identity mapping, as above.
      verifiedAnchor: { parentPageIndex: 1, printedPage: 1, verifiedBy: "test-fixture" },
      rights: {
        rightsStatus: "scan-open-terms",
        publicationDecision: "publish",
        cloudProcessing: "permitted",
        cloudProcessingBasis: "test",
      },
    };
    fs.writeFileSync(
      path.join(configDir, `${key}.yaml`),
      yaml.dump(cfg, { indent: 2, lineWidth: -1 }),
      "utf8",
    );
  });

  test("main returns 0 on --help", async () => {
    const code = await main(["--help"], { exitOnCompletion: false });
    expect(code).toBe(0);
  });

  test("main returns 0 on --check-config", async () => {
    const code = await main(["--check-config", "--config-dir", configDir], {
      exitOnCompletion: false,
    });
    expect(code).toBe(0);
  });

  test("main returns 0 on successful download and pin with mockFetch", async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(valid2PageBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    const code = await main(["--key", "ap-99-401", "--config-dir", configDir], {
      exitOnCompletion: false,
      repoRoot: testRoot,
      fetchFn: mockFetch,
    });
    expect(code).toBe(0);
  });

  test("main returns 0 on --verify when file is present", async () => {
    const code = await main(["--verify", "--key", "ap-99-401", "--config-dir", configDir], {
      exitOnCompletion: false,
      repoRoot: testRoot,
    });
    expect(code).toBe(0);
  });

  test("restorePin restores missing pin with mockFetch and refuses digest mismatch", async () => {
    const key = "ap-99-401";
    const targetFile = path.join(testRoot, "public", "papers", "pdfs", `${key}.pdf`);
    // Move to backup instead of deleting
    const backupFile = `${targetFile}.bak`;
    fs.renameSync(targetFile, backupFile);
    expect(fs.existsSync(targetFile)).toBe(false);

    // Mock fetch returning correct bytes restores
    const mockFetch: typeof fetch = async () => {
      return new Response(valid2PageBuf, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    const res = await restorePin(key, { configDir, repoRoot: testRoot, fetchFn: mockFetch });
    expect(res.restored).toBe(true);
    expect(fs.existsSync(targetFile)).toBe(true);

    // Now test restore refusal with bad bytes
    const destAgain = `${targetFile}.test-bad`;
    fs.renameSync(targetFile, destAgain);

    const badFetch: typeof fetch = async () => {
      return new Response("bad bytes not matching recorded digest", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    };

    let caught: any = null;
    try {
      await restorePin(key, { configDir, repoRoot: testRoot, fetchFn: badFetch });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(FacsimileError);
    expect(caught.code).toBe("restore-digest-mismatch");
    expect(caught.exitCode).toBe(2);
  });
});
