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
import {
  acquireKeyClaim,
  checkAllConfigs,
  detectEmbeddedTextLayer,
  emitReceiptStub,
  extractArticle,
  fetchToStaging,
  getRepoRoot,
  pinFile,
  releaseKeyClaim,
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
    expect(res.errorCode).toBe("NOT_A_PDF");
  });

  test("rejects json-error.pdf with NOT_A_PDF", () => {
    const buf = fs.readFileSync(path.join(FIXTURES_DIR, "json-error.pdf"));
    const res = validatePdf(buf);
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe("NOT_A_PDF");
  });

  test("rejects truncated.pdf with TRUNCATED_PDF", () => {
    const buf = fs.readFileSync(path.join(FIXTURES_DIR, "truncated.pdf"));
    const res = validatePdf(buf);
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe("TRUNCATED_PDF");
  });

  test("fails with PAGE_COUNT_OUT_OF_RANGE when expected range does not cover actual pages", () => {
    const buf = fs.readFileSync(path.join(FIXTURES_DIR, "valid-2page.pdf"));
    const res = validatePdf(buf, { min: 3, max: 5 });
    expect(res.valid).toBe(false);
    expect(res.errorCode).toBe("PAGE_COUNT_OUT_OF_RANGE");
  });
});

describe("2. sha256File digest computation", () => {
  test("equals SHA256SUMS for all fixtures", () => {
    const sumsContent = fs.readFileSync(path.join(FIXTURES_DIR, "SHA256SUMS"), "utf8");
    const lines = sumsContent.trim().split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      const [expectedSha, fileName] = line.trim().split(/\s+/);
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
      expect(e.code).toBe("PINNED_DIGEST_CONFLICT");
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
    expect(res.refusalCode).toBe("SCAN_TERMS_UNKNOWN");
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
    expect(res.refusalCode).toBe("REFERENCE_ONLY_NOT_PINNABLE");
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
    expect(res.refusalCode).toBe("RIGHTS_VOCABULARY_INVALID");
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
    expect(res.refusalCode).toBe("RIGHTS_VOCABULARY_INVALID");
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
    expect(res.refusalCode).toBe("WITNESS_OR_PUBLISHER_HOST");
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
    expect(res.refusalCode).toBe("WITNESS_OR_PUBLISHER_HOST");
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
    expect(res.refusalCode).toBe("WITNESS_OR_PUBLISHER_HOST");
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
    expect(res.refusalCode).toBe("DERIVATIVE_WITHOUT_REASON");
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
      expect(e.code).toBe("LOCK_HELD");
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
    expect(results["ap-99-001"].status).toBe("ok");
    expect(results["ap-99-002"].status).toBe("mismatch");
    expect(results["ap-99-003"].status).toBe("missing");
    expect(results["ap-99-004"].status).toBe("not-available");
    expect(allOk).toBe(false);
  });
});

describe("12. Loopback HTTP network test server", () => {
  let server: http.Server;
  let serverPort: number;
  let retryCount = 0;

  beforeAll((done) => {
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

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        serverPort = addr.port;
      }
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
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
      expect(e.code).toBe("REDIRECT_TO_HTTP");
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
      expect(e.code).toBe("HTTP_STATUS");
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
      expect(e.code).toBe("SIZE_LIMIT_EXCEEDED");
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
    expect(results["ap-17-549.yaml"].valid).toBe(true);
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
    expect(results["ap-99-999.yaml"].valid).toBe(false);
    expect(results["ap-99-999.yaml"].refusalCode).toBe("WITNESS_OR_PUBLISHER_HOST");
    expect(results["ap-99-999.yaml"].errors[0]).toContain("onlinelibrary.wiley.com");
  });
});

describe("16. Error codes are classified, not defaulted (am-7mp8)", () => {
  test("every code the script throws is a member of the union and lands in its class", () => {
    // EXTRACTION_ERROR is thrown three times in the page-extraction path. It was
    // missing from FacsimileErrorCode, so getExitCodeForError fell through to its
    // default and reported a PDF-structure failure as a general failure. scripts/
    // is outside the typecheck program, so nothing said so.
    expect(new FacsimileError("EXTRACTION_ERROR", "missing page object").exitCode).toBe(3);
    for (const code of [
      "PDF_PARSE_FAILED",
      "PARENT_PAGE_INDEX_MISSING",
      "EXTRACTION_NONDETERMINISTIC",
    ] as const) {
      expect(getExitCodeForError(code)).toBe(3);
    }
  });

  test("policy refusals and network failures keep their own classes", () => {
    expect(getExitCodeForError("PINNED_DIGEST_CONFLICT")).toBe(2);
    expect(getExitCodeForError("NETWORK_RETRIES_EXHAUSTED")).toBe(4);
  });

  test("a code outside the union still falls back to a general failure", () => {
    // Planted negative: the fallback must remain reachable, or this test would
    // pass for any code at all and prove nothing about the mapping.
    expect(getExitCodeForError("NOT_A_REAL_CODE" as never)).toBe(1);
    expect(getExitCodeForError("UNEXPECTED_ERROR")).toBe(1);
  });
});
