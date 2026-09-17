import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import { compareCheckInventory, type InventoriedCheck } from "./inventory.ts";

const logger = getLogger("verify-content-tests");
const BEAD = "am-cm-audit-scripts-d34";

describe("compareCheckInventory (am-cm-audit-scripts-d34)", () => {
  const baseInventory: InventoriedCheck[] = [
    { id: "check-a", family: "structural" },
    { id: "check-b", family: "semantic" },
    { id: "check-c", family: "audit" },
  ];

  test("STATE 1 (MATCH): identical registered and inventoried checks produce 0 findings", () => {
    const findings = compareCheckInventory(baseInventory, [
      { id: "check-a", family: "structural" },
      { id: "check-b", family: "semantic" },
      { id: "check-c", family: "audit" },
    ]);
    expect(findings).toEqual([]);
    logger.log({
      testId: "inventory-match-ok",
      beadId: BEAD,
      extra: { family: "audit", check: "check-inventory" },
      outcome: "passed",
      message: "exact inventory match produces no findings",
    });
  });

  test("STATE 2 (UNINVENTORIED): registered check missing from inventory yields check-not-inventoried error", () => {
    const findings = compareCheckInventory(baseInventory, [
      ...baseInventory,
      { id: "check-extra-uninventoried", family: "voice" },
    ]);
    expect(findings.length).toBe(1);
    expect(findings[0]?.check).toBe("check-not-inventoried");
    expect(findings[0]?.recordId).toBe("check-extra-uninventoried");
    expect(findings[0]?.severity).toBe("error");
  });

  test("STATE 3 (MISSING): check in inventory not registered in compiler yields check-missing error", () => {
    const findings = compareCheckInventory(
      [...baseInventory, { id: "check-unregistered-ghost", family: "epistemic" }],
      baseInventory,
    );
    expect(findings.length).toBe(1);
    expect(findings[0]?.check).toBe("check-missing");
    expect(findings[0]?.recordId).toBe("check-unregistered-ghost");
    expect(findings[0]?.severity).toBe("error");
  });
});
