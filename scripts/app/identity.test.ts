/**
 * The Xcode project ships the identity docs/DECISIONS.md records
 * (D-2026-09-23-app-identity): bundle identifier, devices, minimum iOS, home
 * screen name, and no team while the team id is the owner's placeholder.
 * Bead am-app-xcodegen-scaffold-z228, requirement 10.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { APPLINKS_ENTITLEMENT } from "./association-file.ts";
import { type AppIdentity, readIdentityBlock, TEAM_ID_PLACEHOLDER } from "./identity.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

type ProjectSpec = {
  options: { deploymentTarget: { iOS: string } };
  targets: Record<
    string,
    {
      settings: { base: Record<string, unknown> };
      entitlements?: { path?: string; properties?: Record<string, unknown> };
    }
  >;
};

/** The mismatches between a recorded identity and a project spec, as sentences. */
export function identityMismatches(
  identity: AppIdentity,
  spec: ProjectSpec,
  displayName: string,
): string[] {
  const app = spec.targets.AnnusMirabilis?.settings.base ?? {};
  const problems: string[] = [];
  if (app.PRODUCT_BUNDLE_IDENTIFIER !== identity.bundleId) {
    problems.push(
      `bundle id ${String(app.PRODUCT_BUNDLE_IDENTIFIER)} is not the recorded ${identity.bundleId}`,
    );
  }
  if (spec.options.deploymentTarget.iOS !== identity.minimumIOS.version) {
    problems.push(
      `deployment target ${spec.options.deploymentTarget.iOS} is not the recorded ${identity.minimumIOS.version}`,
    );
  }
  const family = [
    identity.devices.includes("iPhone") ? "1" : "",
    identity.devices.includes("iPad") ? "2" : "",
  ]
    .filter(Boolean)
    .join(",");
  if (app.TARGETED_DEVICE_FAMILY !== family) {
    problems.push(
      `device family ${String(app.TARGETED_DEVICE_FAMILY)} is not ${family} for ${identity.devices.join(" and ")}`,
    );
  }
  const catalyst = app.SUPPORTS_MACCATALYST === true || app.SUPPORTS_MACCATALYST === "YES";
  if (catalyst !== identity.macCatalyst) {
    problems.push(
      `Mac Catalyst is ${catalyst ? "on" : "off"}, the decision says ${identity.macCatalyst ? "on" : "off"}`,
    );
  }
  const team = app.DEVELOPMENT_TEAM;
  if (identity.teamId === TEAM_ID_PLACEHOLDER) {
    if (team !== undefined) {
      problems.push(
        `DEVELOPMENT_TEAM is set to ${String(team)} while the recorded team id is still the owner's placeholder`,
      );
    }
  } else if (team !== identity.teamId) {
    problems.push(`DEVELOPMENT_TEAM ${String(team)} is not the recorded ${identity.teamId}`);
  }
  // Universal links (am-app-universal-links-re8v). The associated-domains entitlement is a named,
  // refused placeholder: signing it needs the team, so it is refused while the team id is the
  // owner's placeholder, and required, exactly, once a real one is recorded.
  const domains = spec.targets.AnnusMirabilis?.entitlements?.properties?.[ASSOCIATED_DOMAINS];
  if (identity.teamId === TEAM_ID_PLACEHOLDER) {
    if (domains !== undefined) {
      problems.push(
        `${ASSOCIATED_DOMAINS} is declared while the recorded team id is still the owner's placeholder`,
      );
    }
  } else if (JSON.stringify(domains) !== JSON.stringify([APPLINKS_ENTITLEMENT])) {
    problems.push(
      `${ASSOCIATED_DOMAINS} is ${JSON.stringify(domains)}, not ["${APPLINKS_ENTITLEMENT}"], now that the team id is recorded`,
    );
  }
  if (displayName !== identity.homeScreenName) {
    problems.push(`home screen name ${displayName} is not the recorded ${identity.homeScreenName}`);
  }
  return problems;
}

const ASSOCIATED_DOMAINS = "com.apple.developer.associated-domains";

function displayNameOf(plist: string): string {
  return /<key>CFBundleDisplayName<\/key>\s*<string>([^<]*)<\/string>/.exec(plist)?.[1] ?? "";
}

describe("app identity (D-2026-09-23-app-identity)", () => {
  const recorded = readIdentityBlock(readFileSync(join(REPO, "docs", "DECISIONS.md"), "utf8"));
  assert.ok(recorded !== null, "docs/DECISIONS.md has no ```yaml app-identity block");
  const identity = recorded;
  const spec = yaml.load(readFileSync(join(REPO, "ios", "project.yml"), "utf8")) as ProjectSpec;
  const displayName = displayNameOf(
    readFileSync(join(REPO, "ios", "AnnusMirabilis", "Resources", "Info.plist"), "utf8"),
  );

  it("the committed project agrees with the recorded identity", () => {
    assert.deepEqual(identityMismatches(identity, spec, displayName), []);
  });

  it("keeps the minimum iOS provisional: only iOS 26.1 has been probed", () => {
    assert.equal(identity.minimumIOS.provisional, true);
  });

  it("refuses a seeded bundle identifier mismatch, naming both values", () => {
    const app = spec.targets.AnnusMirabilis;
    assert.ok(app !== undefined);
    const seeded: ProjectSpec = {
      ...spec,
      targets: {
        ...spec.targets,
        AnnusMirabilis: {
          settings: {
            base: { ...app.settings.base, PRODUCT_BUNDLE_IDENTIFIER: "com.example.Wrong" },
          },
        },
      },
    };
    const problems = identityMismatches(identity, seeded, displayName);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /com\.example\.Wrong.*com\.annus-mirabilis\.AnnusMirabilis/);
  });

  it("refuses a team set while the team id is the owner's placeholder", () => {
    const app = spec.targets.AnnusMirabilis;
    assert.ok(app !== undefined);
    const seeded: ProjectSpec = {
      ...spec,
      targets: {
        ...spec.targets,
        AnnusMirabilis: {
          settings: { base: { ...app.settings.base, DEVELOPMENT_TEAM: "ABCDE12345" } },
        },
      },
    };
    assert.match(identityMismatches(identity, seeded, displayName).join(" "), /placeholder/);
  });

  it("refuses the associated-domains entitlement while the team id is the placeholder", () => {
    const app = spec.targets.AnnusMirabilis;
    assert.ok(app !== undefined);
    const seeded: ProjectSpec = {
      ...spec,
      targets: {
        ...spec.targets,
        AnnusMirabilis: {
          ...app,
          entitlements: { properties: { [ASSOCIATED_DOMAINS]: [APPLINKS_ENTITLEMENT] } },
        },
      },
    };
    assert.equal(identity.teamId, TEAM_ID_PLACEHOLDER);
    assert.match(
      identityMismatches(identity, seeded, displayName).join(" "),
      /associated-domains is declared while/,
    );
  });

  it("requires exactly the applinks entitlement once a real team id is recorded", () => {
    const app = spec.targets.AnnusMirabilis;
    assert.ok(app !== undefined);
    const teamed: AppIdentity = { ...identity, teamId: "ABCDE12345" };
    const withTeam = (entitlements?: { properties: Record<string, unknown> }): ProjectSpec => ({
      ...spec,
      targets: {
        ...spec.targets,
        AnnusMirabilis: {
          settings: { base: { ...app.settings.base, DEVELOPMENT_TEAM: "ABCDE12345" } },
          ...(entitlements === undefined ? {} : { entitlements }),
        },
      },
    });
    assert.match(identityMismatches(teamed, withTeam(), displayName).join(" "), /not \["applinks/);
    assert.match(
      identityMismatches(
        teamed,
        withTeam({ properties: { [ASSOCIATED_DOMAINS]: ["applinks:www.example.com"] } }),
        displayName,
      ).join(" "),
      /not \["applinks/,
    );
    assert.deepEqual(
      identityMismatches(
        teamed,
        withTeam({ properties: { [ASSOCIATED_DOMAINS]: [APPLINKS_ENTITLEMENT] } }),
        displayName,
      ),
      [],
    );
  });

  it("refuses a home screen name that is not the recorded one", () => {
    assert.match(identityMismatches(identity, spec, "Mirabilis").join(" "), /home screen name/);
  });
});
