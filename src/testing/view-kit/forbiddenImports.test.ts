import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const KIT_DIR = path.join(REPO_ROOT, "src/visuals/kit");

describe("View Kit Architecture & Import Boundaries (am-inst-2d-view-kit-u75r)", () => {
  test("src/visuals/kit imports NO modules from src/equations/ (selection store decoupling)", () => {
    const files = fs
      .readdirSync(KIT_DIR)
      .filter((name) => /\.(ts|tsx)$/.test(name))
      .map((name) => ({
        name,
        content: fs.readFileSync(path.join(KIT_DIR, name), "utf8"),
      }));

    expect(files.length).toBeGreaterThan(10);

    for (const file of files) {
      const hasEquationImport =
        /from\s+["'][^"']*equations[^"']*["']/.test(file.content) ||
        /import\s*\(\s*["'][^"']*equations[^"']*["']\s*\)/.test(file.content);

      expect(hasEquationImport).toBe(
        false,
        `File src/visuals/kit/${file.name} violates decoupling by importing from src/equations/`,
      );
    }
  });

  test("src/visuals/kit maintains zero private physics calculations in React state", () => {
    const files = fs
      .readdirSync(KIT_DIR)
      .filter((name) => /\.(ts|tsx)$/.test(name))
      .map((name) => ({
        name,
        content: fs.readFileSync(path.join(KIT_DIR, name), "utf8"),
      }));

    for (const file of files) {
      // Ensure no useState holds scientific constants or simulation state
      const hasPhysicsState =
        /useState<.*(?:Diffusion|Velocity|Position|Energy|Wavelength).*>/.test(file.content);
      expect(hasPhysicsState).toBe(
        false,
        `File src/visuals/kit/${file.name} must not hold physics state in React useState`,
      );
    }
  });
});
