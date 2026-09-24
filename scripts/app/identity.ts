/**
 * The app identity docs/DECISIONS.md records (D-2026-09-23-app-identity), read from its fenced
 * `yaml app-identity` block. identity.test.ts holds the Xcode project to it; the association
 * file generator reads the bundle id and team id from it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

/** The team id until the owner supplies one: not ten characters, so every gate that needs a team refuses it. */
export const TEAM_ID_PLACEHOLDER = "OWNER_SUPPLIES_APPLE_TEAM_ID";

export type AppIdentity = {
  appName: string;
  homeScreenName: string;
  bundleId: string;
  teamId: string;
  devices: string[];
  macCatalyst: boolean;
  minimumIOS: { version: string; provisional: boolean };
};

/** The fenced `yaml app-identity` block, parsed, or null when the entry has none. */
export function readIdentityBlock(decisions: string): AppIdentity | null {
  const match = /```yaml app-identity\n([\s\S]*?)```/.exec(decisions);
  return match === null ? null : (yaml.load(match[1] ?? "") as AppIdentity);
}

/** The identity recorded in this repository's docs/DECISIONS.md, or null. */
export function recordedIdentity(repo: string): AppIdentity | null {
  return readIdentityBlock(readFileSync(join(repo, "docs", "DECISIONS.md"), "utf8"));
}
