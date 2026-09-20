/**
 * Superseding a pinned facsimile: the ONE path by which an already-pinned extract may be
 * replaced, and the reason this file exists separately from download-facsimiles.ts.
 *
 * READ THIS FIRST. THE REFUSING SCRIPT CAN NOW WRITE.
 *
 * Until am-cf6m, scripts/download-facsimiles.ts could pin a facsimile exactly once and never
 * again. Every route refused a second write, and the refusals were the feature:
 *
 *   pinFile()            PINNED_DIGEST_CONFLICT, "Refusing to replace pinned file."
 *   updatePinnedRecord() PINNED_DIGEST_CONFLICT, "cannot replace with <new digest>"
 *   restorePin()         "restore will not touch an existing conflicting file"
 *
 * That one-way door is what AGENTS.md Rule 1 looks like in code, and it held: when three pinned
 * extracts turned out to serve the wrong pages, nobody could quietly fix them. This module is a
 * deliberate, narrow widening of that door, and a reader meeting it should meet the widening
 * immediately rather than discover it.
 *
 * WHAT IT DOES NOT CHANGE. Every refusal above stays exactly where it was. Nothing here makes
 * `--key` or `--restore` replace a pin. This is a separate entry point that:
 *
 *   - REFUSES without an authorization record naming this key, so the default is still "no";
 *   - NEVER deletes the superseded bytes - they are copied to public/papers/pdfs/retired/
 *     before the live path is replaced, which is how Rule 1's "retire, never remove" is
 *     honoured for a file rather than for an id;
 *   - re-extracts from the LOCAL parent scan, whose sha256 is checked against the one the
 *     config already records, so a supersede cannot silently adopt different source bytes and
 *     does not refetch 31-42 MB from archive.org;
 *   - refuses when the re-extraction reproduces the digest already pinned, because then there
 *     was nothing to supersede and the caller has misdiagnosed something.
 *
 * The authorization is data, not a flag: a flag is something an agent can add to a command line,
 * and this needs the owner's words. `--authorize-supersede` alone does nothing.
 */

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { extractArticle, getRepoRoot, loadConfig, sha256File } from "../download-facsimiles.ts";
import {
  FacsimileError,
  type FacsimileSourceConfig,
  validateConfig,
} from "./facsimileSourceSchema.ts";

/** The owner's authorization for one supersede, recorded verbatim in the config afterwards. */
export interface SupersedeAuthorization {
  /** Who authorized it. A person, or `agent:<name>` only when relaying with the quote below. */
  readonly authorizedBy: string;
  /** The authorizing words, quoted. Not a paraphrase and not a bead id. */
  readonly authorizationText: string;
  /** ISO date the authorization was given. */
  readonly authorizedOn: string;
  /** The keys the authorization reaches. A key not in this list is refused. */
  readonly keys: readonly string[];
  /** Why this pin is wrong, in a sentence a later reader can check. */
  readonly reason: string;
}

export interface SupersedeResult {
  readonly key: string;
  readonly retiredSha256: string;
  readonly retiredPath: string;
  readonly newSha256: string;
  readonly pageCount: number;
}

/** A superseded pin, appended to the config so the retired bytes stay findable forever. */
export interface SupersededPinRecord {
  readonly sha256: string;
  readonly retiredPath: string;
  readonly retiredOn: string;
  readonly reason: string;
  readonly authorizedBy: string;
  readonly authorizationText: string;
}

const MINIMUM_AUTHORIZATION_TEXT = 12;

/**
 * Refuses unless the authorization is present, non-empty, and names this key.
 *
 * Separated so the negative is testable on its own: the planted negative for this module is an
 * unauthorized supersede, and it must still be refused after the widening or the door is simply
 * open.
 */
export function assertSupersedeAuthorized(
  key: string,
  auth: SupersedeAuthorization | undefined,
): asserts auth is SupersedeAuthorization {
  if (auth === undefined) {
    throw new FacsimileError(
      "pinned-digest-conflict",
      `Superseding the pin for '${key}' requires an authorization record. Refusing: a pinned facsimile is replaced only on the owner's explicit written authorization (AGENTS.md Rule 1).`,
    );
  }
  if (
    !auth.authorizationText ||
    auth.authorizationText.trim().length < MINIMUM_AUTHORIZATION_TEXT
  ) {
    throw new FacsimileError(
      "pinned-digest-conflict",
      `Superseding the pin for '${key}' requires the authorizing words quoted verbatim, not a summary. Got ${auth.authorizationText ? `${auth.authorizationText.trim().length} characters` : "nothing"}.`,
    );
  }
  if (!auth.authorizedBy?.trim()) {
    throw new FacsimileError(
      "pinned-digest-conflict",
      `Superseding the pin for '${key}' requires naming who authorized it.`,
    );
  }
  if (!auth.reason?.trim()) {
    throw new FacsimileError(
      "pinned-digest-conflict",
      `Superseding the pin for '${key}' requires a reason a later reader can check.`,
    );
  }
  if (!auth.keys.includes(key)) {
    throw new FacsimileError(
      "pinned-digest-conflict",
      `The authorization covers [${auth.keys.join(", ")}] and does not reach '${key}'. Refusing: an authorization for one facsimile is not an authorization for another.`,
    );
  }
}

/** Where a retired pin's bytes live. Content-addressed so two retirements never collide. */
export function retiredPinPath(key: string, sha256: string): string {
  return path.join("public", "papers", "pdfs", "retired", `${key}-${sha256.slice(0, 12)}.pdf`);
}

export function supersedePin(
  key: string,
  auth: SupersedeAuthorization | undefined,
  options?: { configDir?: string; repoRoot?: string },
): SupersedeResult {
  assertSupersedeAuthorized(key, auth);

  const cfg = loadConfig(key, options?.configDir);
  const root = options?.repoRoot ?? getRepoRoot();

  const pinned = cfg.pinned;
  if (!pinned) {
    throw new FacsimileError(
      "invalid-config",
      `No pinned record for '${key}'. Superseding replaces an existing pin; use the ordinary pin path for a first pin.`,
    );
  }
  const parent = pinned.parent;
  if (!parent) {
    throw new FacsimileError(
      "invalid-config",
      `Pinned record for '${key}' has no parent scan, so there is nothing to re-extract from.`,
    );
  }

  // The local parent, checked against the digest the config already records. A supersede that
  // adopted different source bytes would be a new acquisition wearing an old receipt.
  const parentPath = path.isAbsolute(parent.path) ? parent.path : path.join(root, parent.path);
  if (!fs.existsSync(parentPath)) {
    throw new FacsimileError(
      "invalid-config",
      `Parent scan ${parent.path} is not present locally. Superseding re-extracts from the retained parent and never refetches.`,
    );
  }
  const parentSha = sha256File(parentPath);
  if (parentSha !== parent.sha256) {
    throw new FacsimileError(
      "pinned-digest-conflict",
      `Parent scan ${parent.path} has digest ${parentSha}, but the config records ${parent.sha256}. Refusing to re-extract from source bytes the receipt does not describe.`,
    );
  }

  const indices = cfg.articlePages.parentPageIndices;
  if (!indices || indices.length === 0) {
    throw new FacsimileError(
      "parent-page-index-missing",
      `Config '${key}' declares no parentPageIndices, so there is no window to extract.`,
    );
  }

  const parentBuf = fs.readFileSync(parentPath);
  const extracted = extractArticle(parentBuf, [...indices], parentSha);
  const newSha256 = sha256File(extracted);

  if (newSha256 === pinned.sha256) {
    throw new FacsimileError(
      "pinned-digest-conflict",
      `Re-extracting '${key}' from parent pages ${indices[0]}-${indices[indices.length - 1]} reproduces the digest already pinned (${newSha256}). There is nothing to supersede; the window in this config is the window the pin already holds.`,
    );
  }

  // Retire the outgoing bytes BEFORE the live path is touched. Rule 1: never removed.
  const livePath = path.isAbsolute(pinned.path) ? pinned.path : path.join(root, pinned.path);
  let retiredRel = "";
  let retiredSha = "";
  if (fs.existsSync(livePath)) {
    retiredSha = sha256File(livePath);
    retiredRel = retiredPinPath(key, retiredSha);
    const retiredAbs = path.join(root, retiredRel);
    fs.mkdirSync(path.dirname(retiredAbs), { recursive: true });
    if (!fs.existsSync(retiredAbs)) {
      fs.copyFileSync(livePath, retiredAbs);
    }
    const retiredCheck = sha256File(retiredAbs);
    if (retiredCheck !== retiredSha) {
      throw new FacsimileError(
        "pinned-digest-conflict",
        `Retired copy at ${retiredRel} has digest ${retiredCheck}, expected ${retiredSha}. Refusing to proceed: the outgoing bytes are not safely retained.`,
      );
    }
  }

  // Only now is the live pin replaced, through a staged file and an atomic rename.
  fs.mkdirSync(path.dirname(livePath), { recursive: true });
  const tmp = `${livePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tmp, extracted);
  const staged = sha256File(tmp);
  if (staged !== newSha256) {
    fs.rmSync(tmp, { force: true });
    throw new FacsimileError(
      "pinned-digest-conflict",
      `Staged copy digest ${staged} does not match the extraction ${newSha256}.`,
    );
  }
  fs.renameSync(tmp, livePath);

  writeSupersededConfig(key, options?.configDir, {
    newSha256,
    pageCount: indices.length,
    parentPageIndices: [...indices],
    retired:
      retiredSha === ""
        ? undefined
        : {
            sha256: retiredSha,
            retiredPath: retiredRel,
            retiredOn: new Date().toISOString().slice(0, 10),
            reason: auth.reason,
            authorizedBy: auth.authorizedBy,
            authorizationText: auth.authorizationText,
          },
  });

  return {
    key,
    retiredSha256: retiredSha,
    retiredPath: retiredRel,
    newSha256,
    pageCount: indices.length,
  };
}

/**
 * Writes the new digest and appends the retirement record.
 *
 * This deliberately does NOT route through updatePinnedRecord, which refuses a digest change by
 * design. Bypassing it here rather than relaxing it there keeps the ordinary pin path exactly as
 * strict as it was: one function in the codebase can change a pinned digest, and it is the one
 * that demanded the owner's words first.
 */
function writeSupersededConfig(
  key: string,
  configDir: string | undefined,
  update: {
    newSha256: string;
    pageCount: number;
    parentPageIndices: number[];
    retired?: SupersededPinRecord | undefined;
  },
): void {
  const dir = configDir ?? path.join(getRepoRoot(), "scripts", "sources", "facsimile-sources");
  const configPath = path.join(dir, `${key}.yaml`);
  const parsed = yaml.load(fs.readFileSync(configPath, "utf8")) as FacsimileSourceConfig & {
    supersededPins?: SupersededPinRecord[];
  };
  if (!parsed.pinned) {
    throw new FacsimileError("invalid-config", `Config ${configPath} lost its pinned record.`);
  }

  parsed.pinned.sha256 = update.newSha256;
  parsed.pinned.pageCount = update.pageCount;
  if (parsed.pinned.parent) {
    parsed.pinned.parent.parentPageIndices = update.parentPageIndices;
  }
  if (update.retired) {
    parsed.supersededPins = [...(parsed.supersededPins ?? []), update.retired];
  }

  const tmpPath = `${configPath}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpPath, yaml.dump(parsed, { indent: 2, lineWidth: -1 }), "utf8");
  const reloaded = yaml.load(fs.readFileSync(tmpPath, "utf8"));
  const validation = validateConfig(reloaded);
  if (!validation.valid) {
    fs.rmSync(tmpPath, { force: true });
    throw new FacsimileError(
      "invalid-config",
      `Superseded config failed validation: ${validation.errors.join("; ")}`,
    );
  }
  fs.renameSync(tmpPath, configPath);
}
