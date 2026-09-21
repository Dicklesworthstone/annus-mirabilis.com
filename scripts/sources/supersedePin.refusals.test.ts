/**
 * Targeted tests for the refusals in supersedePin.ts (am-p465, am-kd9h).
 *
 * This module widened the one-way door that AGENTS.md Rule 1 puts in front of a pinned facsimile,
 * and it shipped with a single planted negative. Its refusals are the only thing standing between
 * an authorization string and a replaced pinned PDF, so a false green here is worth more than a
 * false green anywhere else in the migration. Each case cites its site as `(supersedePin.ts:NN)`
 * and asserts the MESSAGE as well as the code, because nine of the fifteen sites share
 * `pinned-digest-conflict`.
 *
 * NOTHING HERE COMPLETES A SUPERSEDE. Every case is a refusal, every fixture lives in a fresh
 * temporary directory outside the repository, and no test touches public/papers/pdfs.
 *
 * ELEVEN OF THE FIFTEEN SITES ARE DRIVEN HERE. The other four are unreachable, and are left
 * counted as untested rather than covered by a case that lands somewhere else:
 *
 *   :175  "declares no parentPageIndices" - loadConfig runs validateConfig, which already refuses
 *         a config with no window, so any config reaching this line has one. Measured, not
 *         assumed: the case below shows which refusal actually fires.
 *   :220  the staged copy's digest against the extraction - sha256File accepts a Uint8Array as
 *         well as a path, so both digests are taken over the same bytes that were just written.
 *         Only an I/O fault separates them.
 *   :277  "Config lost its pinned record" - writeSupersededConfig re-reads the same file in the
 *         same configDir that loadConfig already found a pinned record in, in the same process.
 *   :295  the re-validation after the yaml round trip - the update writes only sha256, pageCount,
 *         parentPageIndices and supersededPins, all forms validateConfig had already accepted on
 *         the way in.
 *
 * :220, :277 and :295 are defensive guards against corruption and against a future caller, which
 * is a reason to keep them, not a reason to claim they are tested.
 *
 * RE-VERIFIED 2026-09-21, after the scanner's positional-attribution fix changed this file's
 * reported residue from 3 to 4. The 4 is not a regression and the paragraphs above are not stale
 * prose: all four sites were planted again, one at a time, against supersedePin.test.ts, this
 * file and verify-facsimile-pins.test.ts, and none of them reddened anything. The premises were
 * re-read at the same time rather than taken on trust - supersedePin.ts:183 still computes
 * newSha256 as sha256File(extracted) over the buffer that :216 then writes, so :220's two digests
 * are still taken over the same bytes; and writeSupersededConfig is still not exported, so :277
 * and :295 are still reachable only through supersedePin, which found a pinned record in that
 * same directory moments earlier. Nothing was added here, deliberately: a case that cannot reach
 * its site would raise the covered count without covering anything.
 *
 * The fixtures are left on disk. Each case builds a fresh mkdtemp directory under the system
 * temporary directory and never removes it, because AGENTS.md Rule 1 has no exception for files a
 * test created. Nothing accumulates inside the repository.
 */

import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { extractArticle, sha256File } from "../download-facsimiles.ts";
import { FacsimileError } from "./facsimileSourceSchema.ts";
import {
  assertSupersedeAuthorized,
  retiredPinPath,
  type SupersedeAuthorization,
  supersedePin,
} from "./supersedePin.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEY = "ap-18-639";
const TEMPLATE = path.join(HERE, "facsimile-sources", `${KEY}.yaml`);
/** A real 31-page PDF that extractArticle parses, used as the retained parent scan. */
const PARENT_FIXTURE = path.join(
  HERE,
  "..",
  "..",
  "src",
  "testing",
  "fixtures",
  "ocr",
  "fixture-31p.pdf",
);
const WINDOW = [3, 4, 5];

/** The authorization every case below starts from; only the refusal under test is broken. */
const AUTH: SupersedeAuthorization = {
  authorizedBy: "jemanuel",
  authorizationText: "re-extract and re-pin ap-18-639, I authorize it",
  authorizedOn: "2026-09-21",
  keys: [KEY],
  reason: "The pinned extract serves the wrong printed pages.",
};

function refusalFrom(run: () => unknown): FacsimileError {
  try {
    run();
  } catch (err) {
    if (err instanceof FacsimileError) return err;
    throw err;
  }
  throw new Error("The supersede was accepted when it should have been refused.");
}

type Config = Record<string, unknown> & {
  articlePages: Record<string, unknown>;
  pinned?: Record<string, unknown> & { parent?: Record<string, unknown> };
};

/**
 * Builds a fresh fixture root outside the repository: a config directory holding one config
 * derived from the real one, the retained parent scan, and the live pinned file.
 */
function fixture(mutate: (cfg: Config) => void, options?: { parentBytes?: Uint8Array | null }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "am-supersede-"));
  const configDir = path.join(root, "configs");
  fs.mkdirSync(configDir, { recursive: true });

  const cfg = yaml.load(fs.readFileSync(TEMPLATE, "utf8")) as Config;
  const parentSha = sha256File(PARENT_FIXTURE);
  const parentRel = path.join("sources", "parents", `${parentSha}.pdf`);

  cfg.articlePages.parentPageIndices = [...WINDOW];
  (cfg.verifiedAnchor as Record<string, unknown>).parentPageIndex = WINDOW[0];
  cfg.articlePages.printedFirst = 639;
  cfg.articlePages.printedLast = 641;
  const pinned = cfg.pinned as Record<string, unknown> & { parent: Record<string, unknown> };
  pinned.path = path.join("public", "papers", "pdfs", `${KEY}.pdf`);
  pinned.pageCount = WINDOW.length;
  pinned.parent.sha256 = parentSha;
  pinned.parent.path = parentRel;
  pinned.parent.parentPageIndices = [...WINDOW];

  // The live pinned file, with bytes that are not the re-extraction, so a case reaches the
  // retirement step rather than stopping at "nothing to supersede".
  const liveAbs = path.join(root, pinned.path as string);
  fs.mkdirSync(path.dirname(liveAbs), { recursive: true });
  fs.writeFileSync(liveAbs, Buffer.from("%PDF-1.4\nthe outgoing pinned extract\n%%EOF\n"));
  pinned.sha256 = crypto.createHash("sha256").update("a digest nothing reproduces").digest("hex");

  const parentBytes =
    options?.parentBytes === undefined ? fs.readFileSync(PARENT_FIXTURE) : options.parentBytes;
  if (parentBytes !== null) {
    const parentAbs = path.join(root, parentRel);
    fs.mkdirSync(path.dirname(parentAbs), { recursive: true });
    fs.writeFileSync(parentAbs, parentBytes);
  }

  mutate(cfg);
  fs.writeFileSync(
    path.join(configDir, `${KEY}.yaml`),
    yaml.dump(cfg, { indent: 2, lineWidth: -1 }),
    "utf8",
  );
  return { root, configDir, liveAbs, parentSha };
}

const supersedeRefusal = (
  mutate: (cfg: Config) => void,
  options?: { parentBytes?: Uint8Array | null; auth?: SupersedeAuthorization },
) => {
  const f = fixture(mutate, options);
  return {
    f,
    err: refusalFrom(() =>
      supersedePin(KEY, options?.auth ?? AUTH, { configDir: f.configDir, repoRoot: f.root }),
    ),
  };
};

describe("supersedePin.ts refusals: the authorization", () => {
  test("no authorization record at all (supersedePin.ts:92)", () => {
    const err = refusalFrom(() => assertSupersedeAuthorized(KEY, undefined));
    expect(err.code).toBe("pinned-digest-conflict");
    expect(err.message).toContain("requires an authorization record");
  });

  test("a summary where the authorizing words belong (supersedePin.ts:101)", () => {
    const err = refusalFrom(() =>
      assertSupersedeAuthorized(KEY, { ...AUTH, authorizationText: "approved" }),
    );
    expect(err.code).toBe("pinned-digest-conflict");
    expect(err.message).toContain("quoted verbatim, not a summary");
    expect(err.message).toContain("8 characters");
  });

  test("an empty authorization text is not a short one (supersedePin.ts:101)", () => {
    const err = refusalFrom(() =>
      assertSupersedeAuthorized(KEY, { ...AUTH, authorizationText: "" }),
    );
    // The code as well as the wording. This case asserted only the message, so it cited a site
    // whose code it never named, and a block that does not name its site's code cannot credit
    // that site at all (am-ksl3). It is also the stronger assertion: an absent authorization
    // has to arrive as
    // the SAME refusal as a too-short one, not as some other failure that happens to phrase
    // itself the same way.
    expect(err.code).toBe("pinned-digest-conflict");
    expect(err.message).toContain("Got nothing.");
  });

  test("nobody named as the authorizer (supersedePin.ts:107)", () => {
    const err = refusalFrom(() => assertSupersedeAuthorized(KEY, { ...AUTH, authorizedBy: "   " }));
    expect(err.code).toBe("pinned-digest-conflict");
    expect(err.message).toContain("requires naming who authorized it");
  });

  test("no reason a later reader can check (supersedePin.ts:113)", () => {
    const err = refusalFrom(() => assertSupersedeAuthorized(KEY, { ...AUTH, reason: "" }));
    expect(err.code).toBe("pinned-digest-conflict");
    expect(err.message).toContain("requires a reason a later reader can check");
  });

  test("an authorization for a different facsimile (supersedePin.ts:119)", () => {
    const err = refusalFrom(() =>
      assertSupersedeAuthorized(KEY, { ...AUTH, keys: ["ap-17-549", "ap-19-289"] }),
    );
    expect(err.code).toBe("pinned-digest-conflict");
    expect(err.message).toContain("does not reach 'ap-18-639'");
    expect(err.message).toContain("an authorization for one facsimile is not an authorization");
  });

  test("a complete authorization is accepted, not refused", () => {
    assert.doesNotThrow(() => assertSupersedeAuthorized(KEY, AUTH));
  });
});

describe("supersedePin.ts refusals: what the config must already say", () => {
  test("no pinned record to supersede (supersedePin.ts:143)", () => {
    const { err } = supersedeRefusal((cfg) => {
      delete cfg.pinned;
    });
    expect(err.code).toBe("invalid-config");
    expect(err.message).toContain("Superseding replaces an existing pin");
  });

  test("a pin with no parent scan recorded (supersedePin.ts:150)", () => {
    const { err } = supersedeRefusal((cfg) => {
      if (cfg.pinned) delete cfg.pinned.parent;
    });
    expect(err.code).toBe("invalid-config");
    expect(err.message).toContain("has no parent scan, so there is nothing to re-extract from");
  });

  test("the retained parent scan is not on disk (supersedePin.ts:160)", () => {
    const { err } = supersedeRefusal(() => {}, { parentBytes: null });
    expect(err.code).toBe("invalid-config");
    expect(err.message).toContain("never refetches");
  });

  test("the parent on disk is not the parent the receipt describes (supersedePin.ts:167)", () => {
    const { err } = supersedeRefusal(() => {}, {
      parentBytes: Buffer.from("%PDF-1.4\na different scan entirely\n%%EOF\n"),
    });
    expect(err.code).toBe("pinned-digest-conflict");
    expect(err.message).toContain("Refusing to re-extract from source bytes the receipt does not");
  });

  /**
   * MEASURED, NOT ASSUMED: this is why supersedePin.ts:175 is unreachable.
   *
   * The site refuses a config that "declares no parentPageIndices", but loadConfig runs
   * validateConfig first, and validateConfig already refuses exactly that config. Any config that
   * reaches line 175 therefore has a non-empty window. The case below asserts what actually
   * happens rather than citing a line it cannot reach.
   *
   * It deliberately does NOT assert the refusal code. Naming `invalid-config` here would add a
   * test block against that code without citing a line, and the scanner's surplus rule would then
   * credit one of the unreachable sites at 277 or 295 off it. Declining a credit I have not earned
   * is worth more than a tidier assertion.
   */
  test("the config validator refuses a missing window before supersedePin sees it", () => {
    const { err } = supersedeRefusal((cfg) => {
      delete cfg.articlePages.parentPageIndices;
    });
    expect(err.message).toContain("parentPageIndices must be a non-empty array");
    expect(err.message).not.toContain("declares no parentPageIndices");
  });
});

describe("supersedePin.ts refusals: the extraction and the retirement", () => {
  test("the re-extraction reproduces the pin, so nothing was wrong (supersedePin.ts:186)", () => {
    const reproduced = sha256File(
      extractArticle(fs.readFileSync(PARENT_FIXTURE), [...WINDOW], sha256File(PARENT_FIXTURE)),
    );
    const { err } = supersedeRefusal((cfg) => {
      if (cfg.pinned) cfg.pinned.sha256 = reproduced;
    });
    expect(err.code).toBe("pinned-digest-conflict");
    expect(err.message).toContain("There is nothing to supersede");
    expect(err.message).toContain(reproduced);
  });

  test("the outgoing bytes are not safely retained (supersedePin.ts:206)", () => {
    // A file already sitting at the content-addressed retirement path, holding something else.
    // The copy is then skipped and the digest check is the only thing between that file and a
    // replaced pin, which is exactly what this site is for.
    const f = fixture(() => {});
    const liveSha = sha256File(f.liveAbs);
    const planted = path.join(f.root, retiredPinPath(KEY, liveSha));
    fs.mkdirSync(path.dirname(planted), { recursive: true });
    fs.writeFileSync(planted, Buffer.from("%PDF-1.4\nnot the outgoing bytes\n%%EOF\n"));

    const err = refusalFrom(() =>
      supersedePin(KEY, AUTH, { configDir: f.configDir, repoRoot: f.root }),
    );
    expect(err.code).toBe("pinned-digest-conflict");
    expect(err.message).toContain("the outgoing bytes are not safely retained");
    // The live pin is untouched: a refusal never half-replaces a facsimile.
    expect(sha256File(f.liveAbs)).toBe(liveSha);
  });
});
