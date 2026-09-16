import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface WorkflowViolation {
  readonly file: string;
  readonly rule: string;
  readonly message: string;
}

const FORBIDDEN_TOKENS = [
  {
    token: "vercel",
    rule: "no-vercel",
    message: "Vercel CLI or actions are forbidden in CI workflows.",
  },
  {
    token: "deploy",
    rule: "no-deploy",
    message: "Deployment steps are forbidden in CI workflows.",
  },
  { token: "alias", rule: "no-alias", message: "Alias steps are forbidden in CI workflows." },
  {
    token: "wrangler",
    rule: "no-wrangler",
    message: "Wrangler CLI or actions are forbidden in CI workflows.",
  },
  {
    token: "cloudflare",
    rule: "no-cloudflare",
    message: "Cloudflare actions or secrets are forbidden in CI workflows.",
  },
  {
    token: "pull_request_target",
    rule: "no-pull-request-target",
    message: "pull_request_target trigger is strictly forbidden due to privilege escalation risks.",
  },
  {
    token: "--family apple",
    rule: "no-apple-family-in-ci",
    message: "Apple quality gate family must never be run in website CI workflows.",
  },
];

/**
 * Scans a workflow YAML text for security, privilege, and scope violations.
 */
export function scanWorkflowContent(filename: string, content: string): WorkflowViolation[] {
  const violations: WorkflowViolation[] = [];

  // Check forbidden tokens/patterns
  for (const { token, rule, message } of FORBIDDEN_TOKENS) {
    const escaped = token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_-])${escaped}(?:$|[^a-zA-Z0-9_-])`, "i");
    if (regex.test(content)) {
      violations.push({
        file: filename,
        rule,
        message: `${message} Found match for '${token}'.`,
      });
    }
  }

  // Check write permissions
  const writePermPattern =
    /permissions:\s*[\s\S]*?(?:write|contents:\s*write|id-token:\s*write|pull-requests:\s*write|actions:\s*write|deployments:\s*write|packages:\s*write)/i;
  if (writePermPattern.test(content)) {
    violations.push({
      file: filename,
      rule: "no-write-permissions",
      message: "Workflow must not grant write permissions. Only 'contents: read' is permitted.",
    });
  }

  // Ensure 'permissions: contents: read' is present
  const hasContentsRead = /permissions:\s*(?:contents:\s*read|read-all)/i.test(content);
  if (!hasContentsRead) {
    violations.push({
      file: filename,
      rule: "require-contents-read",
      message: "Workflow must explicitly declare 'permissions: contents: read'.",
    });
  }

  return violations;
}

describe("CI Workflow Security & Scope Scanner", () => {
  const workflowsDir = join(process.cwd(), ".github", "workflows");

  it("passes all real repository workflow files in .github/workflows", () => {
    const files = readdirSync(workflowsDir).filter(
      (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
    );
    expect(files.length).toBeGreaterThanOrEqual(2);

    const allViolations: WorkflowViolation[] = [];
    for (const file of files) {
      const content = readFileSync(join(workflowsDir, file), "utf8");
      const violations = scanWorkflowContent(file, content);
      allViolations.push(...violations);
    }

    expect(allViolations).toEqual([]);
  });

  it("fails on fixture workflow containing 'vercel deploy'", () => {
    const fixtureYaml = `
name: Deploy Workflow
on:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: npx vercel deploy --prod
`;
    const violations = scanWorkflowContent("deploy-fixture.yml", fixtureYaml);
    expect(violations.some((v) => v.rule === "no-vercel")).toBe(true);
    expect(violations.some((v) => v.rule === "no-deploy")).toBe(true);
  });

  it("fails on fixture workflow containing 'pull_request_target'", () => {
    const fixtureYaml = `
name: PR Target
on:
  pull_request_target:
    branches: [main]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: bun test
`;
    const violations = scanWorkflowContent("pr-target-fixture.yml", fixtureYaml);
    expect(violations.some((v) => v.rule === "no-pull-request-target")).toBe(true);
  });

  it("fails on fixture workflow granting write permissions", () => {
    const fixtureYaml = `
name: Write Permissions
on:
  push:
    branches: [main]
permissions:
  contents: write
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: bun test
`;
    const violations = scanWorkflowContent("write-fixture.yml", fixtureYaml);
    expect(violations.some((v) => v.rule === "no-write-permissions")).toBe(true);
  });

  it("fails on fixture workflow invoking --family apple", () => {
    const fixtureYaml = `
name: Apple CI Gate
on:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  apple:
    runs-on: macos-latest
    steps:
      - run: bun scripts/quality-gates.ts --family apple
`;
    const violations = scanWorkflowContent("apple-fixture.yml", fixtureYaml);
    expect(violations.some((v) => v.rule === "no-apple-family-in-ci")).toBe(true);
  });
});
