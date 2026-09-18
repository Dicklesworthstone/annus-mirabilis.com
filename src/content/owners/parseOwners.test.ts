import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadOwnersRegistry,
  OwnersParseError,
  parseOwners,
  ROLE_TO_REVIEW_TYPE,
} from "./parseOwners.ts";

const VALID_TABLE = `# Project Owners

| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| jemanuel | Jeffrey Emanuel | editorial-owner,implementation-owner | light-quanta | assigned | yes | agent:BoldHarbor | 2026-09-16 |
| reviewer-sr-1 | Alice Smith | german-source-reviewer | special-relativity | assigned | yes | jemanuel | 2026-09-16 |
| reviewer-sr-2 | Bob Jones | german-source-reviewer | special-relativity | assigned | yes | jemanuel | 2026-09-16 |
| translator-1 | Carol White | translator,glossator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| xproj-1 | Dave Brown | cross-projection-reviewer | mass-energy | assigned | yes | jemanuel | 2026-09-16 |

## Qualifications

### jemanuel
Jeffrey Emanuel is the project owner.
`;

describe("parseOwners", () => {
  it("parses a well-formed table and ignores qualifications section", () => {
    const registry = parseOwners(VALID_TABLE);
    assert.equal(registry.rows.length, 5);

    assert.equal(registry.hasRole("jemanuel", "editorial-owner"), true);
    assert.equal(registry.hasRole("jemanuel", "implementation-owner"), true);
    assert.equal(registry.hasRole("jemanuel", "german-source-reviewer"), false);

    assert.deepEqual(registry.rolesOf("reviewer-sr-1"), ["german-source-reviewer"]);
    assert.deepEqual(registry.rolesOf("reviewer-sr-2"), ["german-source-reviewer"]);
    assert.deepEqual(registry.rolesOf("translator-1"), ["translator", "glossator"]);
    assert.deepEqual(registry.rolesOf("xproj-1"), ["cross-projection-reviewer"]);

    // Test map mappings
    assert.equal(ROLE_TO_REVIEW_TYPE["german-source-reviewer"], "german-source");
    assert.equal(ROLE_TO_REVIEW_TYPE["cross-projection-reviewer"], "cross-projection");
    assert.equal((ROLE_TO_REVIEW_TYPE as Record<string, string>).translator, undefined);
    assert.equal((ROLE_TO_REVIEW_TYPE as Record<string, string>).glossator, undefined);
  });

  it("fails on reordered table header", () => {
    const table = `| displayName | id | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| Jeffrey Emanuel | jemanuel | editorial-owner | light-quanta | assigned | yes | agent:BoldHarbor | 2026-09-16 |
`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "reordered-header";
      },
    );
  });

  it("fails on duplicate owner id", () => {
    const table = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| user-1 | User One | editorial-owner | light-quanta | assigned | yes | admin | 2026-09-16 |
| user-1 | User Duplicate | implementation-owner | light-quanta | assigned | yes | admin | 2026-09-16 |
`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return (
          err instanceof OwnersParseError && err.code === "duplicate-id" && err.rowNumber === 4
        );
      },
    );
  });

  it("fails on email-like id", () => {
    const table = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| alice@example.com | Alice | editorial-owner | light-quanta | assigned | yes | admin | 2026-09-16 |
`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "email-like-id";
      },
    );
  });

  it("fails on model: prefix id", () => {
    const table = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| model:gpt4 | GPT 4 | editorial-owner | light-quanta | assigned | yes | admin | 2026-09-16 |
`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "model-id-rejected";
      },
    );
  });

  it("fails on unknown role", () => {
    const table = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| alice | Alice | chief-quantum-officer | light-quanta | assigned | yes | admin | 2026-09-16 |
`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "unknown-role";
      },
    );
  });

  it("fails on assigned row without consentToBeNamed: yes", () => {
    const table = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| alice | Alice | german-source-reviewer | light-quanta | assigned | no | admin | 2026-09-16 |
`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "missing-consent";
      },
    );
  });

  it("fails on malformed assignedOn date", () => {
    const table = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| alice | Alice | german-source-reviewer | light-quanta | assigned | yes | admin | Sept 16 2026 |
`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "invalid-assigned-date";
      },
    );
  });

  it("Site (parseOwners.ts:120) rejects missing table header with missing-header", () => {
    const text = "# Heading\nNo table present in markdown text\n";
    assert.throws(
      () => parseOwners(text),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "missing-header";
      },
    );
    // Accept pair
    const reg = parseOwners(VALID_TABLE);
    assert.ok(reg.rows.length > 0);
  });

  it("Site (parseOwners.ts:146) rejects missing table separator with missing-table-separator", () => {
    const table = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "missing-table-separator";
      },
    );
    // Accept pair
    const valid = `${table}\n|---|---|---|---|---|---|---|---|\n| u1 | User One | editorial-owner | light-quanta | assigned | yes | admin | 2026-09-16 |`;
    const reg = parseOwners(valid);
    assert.equal(reg.rows.length, 1);
  });

  it("Site (parseOwners.ts:156) rejects invalid table separator with invalid-table-separator", () => {
    const table = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
--- not pipe delimited ---
| u1 | User One | editorial-owner | light-quanta | assigned | yes | admin | 2026-09-16 |`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "invalid-table-separator";
      },
    );
    // Accept pair
    const valid = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| u1 | User One | editorial-owner | light-quanta | assigned | yes | admin | 2026-09-16 |`;
    const reg = parseOwners(valid);
    assert.equal(reg.rows.length, 1);
  });

  it("Site (parseOwners.ts:189) rejects invalid column count with invalid-column-count", () => {
    const table = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| u1 | User One | editorial-owner | light-quanta | assigned | yes | admin |`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "invalid-column-count";
      },
    );
    // Accept pair: exactly 8 columns
    const valid = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| u1 | User One | editorial-owner | light-quanta | assigned | yes | admin | 2026-09-16 |`;
    const reg = parseOwners(valid);
    assert.equal(reg.rows.length, 1);
  });

  it("Site (parseOwners.ts:220) rejects invalid id format with invalid-id-format", () => {
    const table = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| Invalid_Uppercase | User One | editorial-owner | light-quanta | assigned | yes | admin | 2026-09-16 |`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "invalid-id-format";
      },
    );
    // Accept pair: valid lowercase alphanumeric with hyphen
    const valid = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| valid-user-1 | User One | editorial-owner | light-quanta | assigned | yes | admin | 2026-09-16 |`;
    const reg = parseOwners(valid);
    assert.equal(reg.rows.length, 1);
  });

  it("Site (parseOwners.ts:237) rejects missing roles with missing-roles", () => {
    const table = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| valid-user-1 | User One |   | light-quanta | assigned | yes | admin | 2026-09-16 |`;
    assert.throws(
      () => parseOwners(table),
      (err: unknown) => {
        return err instanceof OwnersParseError && err.code === "missing-roles";
      },
    );
    // Accept pair: non-empty roles
    const valid = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| valid-user-1 | User One | editorial-owner | light-quanta | assigned | yes | admin | 2026-09-16 |`;
    const reg = parseOwners(valid);
    assert.equal(reg.rows.length, 1);
  });

  it("parses the real repository docs/OWNERS.md without error", () => {
    const reg = loadOwnersRegistry();
    assert.ok(reg.rows.length > 10);
    assert.equal(reg.hasRole("jemanuel", "editorial-owner"), true);
    assert.equal(reg.hasRole("jemanuel", "implementation-owner"), true);
    assert.equal(reg.isAssigned("jemanuel"), true);
    assert.equal(reg.isAssigned("open-german-source-brownian-motion"), false);
    assert.equal(reg.hasRole("open-german-source-brownian-motion", "german-source-reviewer"), true);
  });
});
