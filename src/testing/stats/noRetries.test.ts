import { describe, expect, it } from "bun:test";
import { scanContentForRetries, scanProjectForRetries } from "./noRetries.ts";

describe("No-Retries Policy Scanner (am-ver-statistical-policy-grj)", () => {
  it("detects planted retry options in fixtures", () => {
    // 1. Planted bunfig/playwright retry option
    const fixture1 = `
      [test]
      retries = 3
    `;
    const v1 = scanContentForRetries(fixture1, "bunfig.toml");
    expect(v1.length).toBeGreaterThan(0);
    expect(v1[0]?.match).toContain("retries = 3");

    // 2. Planted playwright retries
    const fixture2 = `
      export default defineConfig({
        retries: 2,
      });
    `;
    const v2 = scanContentForRetries(fixture2, "playwright.config.ts");
    expect(v2.length).toBeGreaterThan(0);
    expect(v2[0]?.match).toContain("retries: 2");

    // 3. Planted test-level retry
    const fixture3 = `
      it("runs stochastic test", { retry: 5 }, () => {
        expect(1).toBe(1);
      });
    `;
    const v3 = scanContentForRetries(fixture3, "my.test.ts");
    expect(v3.length).toBeGreaterThan(0);
    expect(v3[0]?.match).toContain("retry: 5");

    // 4. Planted CLI --retry flag
    const fixture4 = `
      run: bun test --retry 3
    `;
    const v4 = scanContentForRetries(fixture4, "workflow.yml");
    expect(v4.length).toBeGreaterThan(0);
    expect(v4[0]?.match).toContain("--retry 3");
  });

  it("passes cleanly on the live project configuration", () => {
    const scan = scanProjectForRetries();
    if (!scan.passed) {
      console.error("Found retry violations in project:", scan.violations);
    }
    expect(scan.passed).toBe(true);
    expect(scan.violations.length).toBe(0);
  });
});
