/**
 * RSC Client Boundary Gate Test Suite.
 *
 * Enforces:
 * 1. Modules reachable from `src/app` without a 'use client' directive are Server Components.
 * 2. Server Components MUST NOT use React client-only hooks or APIs:
 *    createContext, useContext, useState, useEffect, useRef, useReducer, etc.
 * 3. A 'use client' directive marks a boundary that stops Server Component traversal.
 * 4. Pure type-only imports (import type) do not pull target modules into the runtime graph.
 * 5. String literals and comments mentioning hooks do not trigger false positives.
 * 6. Live working tree is clean with zero violations.
 */

import { describe, expect, it } from "bun:test";
import {
  checkClientBoundaries,
  checkSchemaLayerBoundaries,
  collectAppRouterSourceFiles,
  detectClientHookUsages,
  detectNodeBuiltinUsages,
  extractRuntimeImportSpecifiers,
  hasUseClientDirective,
  isClientSafeSchemaModule,
  isNodeBuiltinSpecifier,
  runClientBoundaryGateCli,
  type SourceFileRecord,
} from "../../scripts/rsc-client-boundary.ts";

describe("RSC Client Boundary Gate", () => {
  describe("Planted Negatives (Fail-Closed Verification)", () => {
    it("rejects direct useState import in server page without 'use client'", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/page.tsx",
          content: `
            import { useState } from "react";
            export default function Page() {
              const [count, setCount] = useState(0);
              return <div>{count}</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.file).toBe("src/app/page.tsx");
      expect(violations[0]?.hooks).toContain("useState");
      expect(violations[0]?.chain).toEqual(["src/app/page.tsx"]);
      expect(violations[0]?.message).toContain("useState");
    });

    it("rejects direct createContext import in server layout without 'use client'", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/layout.tsx",
          content: `
            import { createContext } from "react";
            export const ThemeContext = createContext("light");
            export default function Layout({ children }: { children: React.ReactNode }) {
              return <html><body>{children}</body></html>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.file).toBe("src/app/layout.tsx");
      expect(violations[0]?.hooks).toContain("createContext");
    });

    it("rejects React.useState member access in server component without 'use client'", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/lab/page.tsx",
          content: `
            import * as React from "react";
            export default function LabPage() {
              const state = React.useState(0);
              return <div>Lab</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.file).toBe("src/app/lab/page.tsx");
      expect(violations[0]?.hooks).toContain("useState");
    });

    it("rejects 2-hop transitive reachability: page -> reader -> hook without 'use client'", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/papers/page.tsx",
          content: `
            import { PaperReader } from "../../reader/PaperReader.tsx";
            export default function Page() {
              return <PaperReader />;
            }
          `,
        },
        {
          path: "src/reader/PaperReader.tsx",
          content: `
            import { TelemetryPanel } from "./TelemetryPanel.tsx";
            export function PaperReader() {
              return <TelemetryPanel />;
            }
          `,
        },
        {
          path: "src/reader/TelemetryPanel.tsx",
          content: `
            import { useEffect } from "react";
            export function TelemetryPanel() {
              useEffect(() => {}, []);
              return <div>Telemetry</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.file).toBe("src/reader/TelemetryPanel.tsx");
      expect(violations[0]?.hooks).toContain("useEffect");
      expect(violations[0]?.chain).toEqual([
        "src/app/papers/page.tsx",
        "src/reader/PaperReader.tsx",
        "src/reader/TelemetryPanel.tsx",
      ]);
      expect(violations[0]?.message).toContain(
        "reachable from App Router entry 'src/app/papers/page.tsx'",
      );
    });

    it("rejects deep 4-hop chain and pinpoints the exact import path", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/discover/page.tsx",
          content: `import { StepA } from "../../components/StepA"; export default function P() { return <StepA />; }`,
        },
        {
          path: "src/components/StepA.tsx",
          content: `import { StepB } from "./StepB"; export function StepA() { return <StepB />; }`,
        },
        {
          path: "src/components/StepB.tsx",
          content: `import { StepC } from "./StepC"; export function StepB() { return <StepC />; }`,
        },
        {
          path: "src/components/StepC.tsx",
          content: `
            import { useReducer } from "react";
            export function StepC() {
              const [s, d] = useReducer((x: number) => x + 1, 0);
              return <div>{s}</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.file).toBe("src/components/StepC.tsx");
      expect(violations[0]?.hooks).toContain("useReducer");
      expect(violations[0]?.chain).toEqual([
        "src/app/discover/page.tsx",
        "src/components/StepA.tsx",
        "src/components/StepB.tsx",
        "src/components/StepC.tsx",
      ]);
    });

    it("rejects re-export barrel chain: page -> barrel -> leaf using useRef", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/page.tsx",
          content: `import { CanvasView } from "@/components"; export default function Page() { return <CanvasView />; }`,
        },
        {
          path: "src/components/index.ts",
          content: `export * from "./CanvasView.tsx";`,
        },
        {
          path: "src/components/CanvasView.tsx",
          content: `
            import { useRef } from "react";
            export function CanvasView() {
              const ref = useRef<HTMLCanvasElement>(null);
              return <canvas ref={ref} />;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.file).toBe("src/components/CanvasView.tsx");
      expect(violations[0]?.hooks).toContain("useRef");
    });

    it("extractRuntimeImportSpecifiers extracts bare side-effect imports alongside from-imports without swallowing", () => {
      const input =
        'import { a } from "./named.ts"; import "./sideEffect.ts"; import def from "./default.ts";';
      const specs = extractRuntimeImportSpecifiers(input);
      expect(specs).toContain("./sideEffect.ts");
      expect(specs).toContain("./named.ts");
      expect(specs).toContain("./default.ts");
      expect(specs.length).toBe(3);
    });

    it("planted negative on REAL chain: removing 'use client' from src/experiments/presentation.ts fails and names presentation.ts", () => {
      const liveFiles = collectAppRouterSourceFiles(process.cwd());
      expect(liveFiles.length).toBeGreaterThan(100);

      // Verify presentation.ts exists in live files with 'use client'
      const presentationFile = liveFiles.find((f) => f.path === "src/experiments/presentation.ts");
      expect(presentationFile).toBeDefined();
      if (!presentationFile) return;
      expect(hasUseClientDirective(presentationFile.content)).toBe(true);

      // Plant the negative: remove 'use client' from presentation.ts in the real repository graph
      const plantedFiles = liveFiles.map((f) => {
        if (f.path === "src/experiments/presentation.ts") {
          return {
            ...f,
            content: f.content.replace(/^["']use client["'];?\s*/m, ""),
          };
        }
        return f;
      });

      const violations = checkClientBoundaries(plantedFiles);
      expect(violations.length).toBeGreaterThanOrEqual(1);

      const presentationViolation = violations.find(
        (v) => v.file === "src/experiments/presentation.ts",
      );
      expect(presentationViolation).toBeDefined();
      expect(presentationViolation?.hooks).toContain("createContext");
      expect(presentationViolation?.chain).toContain("src/reader/PaperReader.tsx");
      expect(presentationViolation?.chain).toContain("src/reader/actions/kindRegistration.ts");
      expect(presentationViolation?.chain).toContain("src/reader/stack/kinds.ts");
      expect(presentationViolation?.chain).toContain("src/experiments/dispatch.tsx");
      expect(presentationViolation?.chain).toContain("src/experiments/presentation.ts");
    });
  });

  describe("Client Boundary Barrier & Allowed Behaviors", () => {
    it("accepts client hooks when the component declares 'use client'", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/page.tsx",
          content: `
            import { ClientCounter } from "../components/ClientCounter.tsx";
            export default function Page() {
              return <ClientCounter />;
            }
          `,
        },
        {
          path: "src/components/ClientCounter.tsx",
          content: `
            "use client";
            import { useState } from "react";
            export function ClientCounter() {
              const [val] = useState(0);
              return <div>{val}</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(0);
    });

    it("stops RSC traversal at 'use client' barrier, allowing transitive imports to use hooks", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/page.tsx",
          content: `
            import { ClientContainer } from "../components/ClientContainer.tsx";
            export default function Page() {
              return <ClientContainer />;
            }
          `,
        },
        {
          path: "src/components/ClientContainer.tsx",
          content: `
            'use client';
            import { InternalHookUser } from "./InternalHookUser.tsx";
            export function ClientContainer() {
              return <InternalHookUser />;
            }
          `,
        },
        {
          path: "src/components/InternalHookUser.tsx",
          // Notice: does not need 'use client' because its parent boundary is 'use client'
          content: `
            import { useEffect, useState } from "react";
            export function InternalHookUser() {
              const [val] = useState(1);
              useEffect(() => {}, []);
              return <div>{val}</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(0);
    });

    it("accepts root-level files that declare 'use client' (e.g. error.tsx)", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/error.tsx",
          content: `
            "use client";
            import { useEffect } from "react";
            export default function ErrorBoundary({ error }: { error: Error }) {
              useEffect(() => { console.error(error); }, [error]);
              return <div>Something went wrong</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(0);
    });

    it("does not pull modules into runtime server graph via pure 'import type' statements", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/page.tsx",
          content: `
            import type { WidgetConfig } from "../components/HeavyWidget.tsx";
            export default function Page() {
              const config: WidgetConfig = { enabled: true };
              return <div>{String(config.enabled)}</div>;
            }
          `,
        },
        {
          path: "src/components/HeavyWidget.tsx",
          content: `
            import { useState } from "react";
            export interface WidgetConfig { enabled: boolean; }
            export function HeavyWidget() {
              const [x] = useState(0);
              return <div>{x}</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(0);
    });

    it("ignores unused/standalone modules in repository that are not reachable from src/app", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/page.tsx",
          content: `export default function Page() { return <div>Home</div>; }`,
        },
        {
          path: "src/experimental/IsolatedWidget.tsx",
          content: `
            import { useState } from "react";
            export function IsolatedWidget() {
              const [x] = useState(0);
              return <div>{x}</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(0);
    });

    it("does not false-positive on comments or string literals mentioning hooks", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/page.tsx",
          content: `
            // In Server Components, do NOT use useState or useEffect
            /*
             * Note: createContext is client only
             */
            export default function Page() {
              const notice = "Forbidden hook: useRef, useReducer";
              return <div>{notice}</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(0);
    });

    it("accurately parses 'use client' with leading comments and whitespace", () => {
      const withComments = `
        /**
         * Top-level component comment.
         */
        // Another explanatory note
        "use client";
        import { useState } from "react";
      `;
      expect(hasUseClientDirective(withComments)).toBe(true);

      const notDirective = `
        const msg = "use client";
      `;
      expect(hasUseClientDirective(notDirective)).toBe(false);
    });

    it("detectClientHookUsages correctly identifies named imports and member access", () => {
      const code = `
        import { useState, useEffect as useMyEffect } from "react";
        import * as React from "react";
        const c = React.createContext(null);
      `;
      const detected = detectClientHookUsages(code);
      expect(detected).toContain("useState");
      expect(detected).toContain("useEffect");
      expect(detected).toContain("createContext");
    });
  });

  describe("Node Builtin In Client Component Detection (Fail-Closed Verification)", () => {
    it("rejects direct node:fs import in client component", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/components/ClientWidget.tsx",
          content: `
            "use client";
            import { readFileSync } from "node:fs";
            export function ClientWidget() {
              return <div>Widget</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.file).toBe("src/components/ClientWidget.tsx");
      expect(violations[0]?.kind).toBe("node-builtin-in-client-component");
      expect(violations[0]?.builtins).toContain("node:fs");
    });

    it("rejects unprefixed fs import in client component", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/components/ClientWidget.tsx",
          content: `
            "use client";
            import fs from "fs";
            export function ClientWidget() { return <div>Widget</div>; }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.file).toBe("src/components/ClientWidget.tsx");
      expect(violations[0]?.kind).toBe("node-builtin-in-client-component");
      expect(violations[0]?.builtins).toContain("fs");
    });

    it("rejects direct require('node:fs') and require('node:path') in client component", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/components/ClientWidget.tsx",
          content: `
            "use client";
            const fs = require("node:fs");
            const path = require('node:path');
            export function ClientWidget() { return <div>Widget</div>; }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.file).toBe("src/components/ClientWidget.tsx");
      expect(violations[0]?.kind).toBe("node-builtin-in-client-component");
      expect(violations[0]?.builtins).toContain("node:fs");
      expect(violations[0]?.builtins).toContain("node:path");
    });

    it("rejects transitive reachability: page -> ClientComponent -> helper -> module importing node:path", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/discover/page.tsx",
          content: `
            import { ClientComponent } from "../../components/ClientComponent.tsx";
            export default function DiscoverPage() {
              return <ClientComponent />;
            }
          `,
        },
        {
          path: "src/components/ClientComponent.tsx",
          content: `
            "use client";
            import { formatPath } from "../utils/helper.ts";
            export function ClientComponent() {
              return <div>{formatPath("a")}</div>;
            }
          `,
        },
        {
          path: "src/utils/helper.ts",
          content: `
            import { join } from "node:path";
            export function formatPath(p: string) { return join("/base", p); }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.file).toBe("src/utils/helper.ts");
      expect(violations[0]?.kind).toBe("node-builtin-in-client-component");
      expect(violations[0]?.builtins).toContain("node:path");
      expect(violations[0]?.chain).toEqual([
        "src/app/discover/page.tsx",
        "src/components/ClientComponent.tsx",
        "src/utils/helper.ts",
      ]);
    });

    it("rejects node builtins in App Router client entry points (e.g. error.tsx)", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/error.tsx",
          content: `
            "use client";
            import { writeFileSync } from "node:fs";
            export default function ErrorBoundary() { return <div>Error</div>; }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.file).toBe("src/app/error.tsx");
      expect(violations[0]?.kind).toBe("node-builtin-in-client-component");
      expect(violations[0]?.builtins).toContain("node:fs");
    });

    it("planted negative on REAL repo graph reproducing Outage 2: re-pointing trace.ts to bindings.ts fails and names bindings.ts", () => {
      const liveFiles = collectAppRouterSourceFiles(process.cwd());
      expect(liveFiles.length).toBeGreaterThan(100);

      const traceFile = liveFiles.find((f) => f.path === "src/content/kernel/trace.ts");
      expect(traceFile).toBeDefined();
      if (!traceFile) return;

      // Simulate pre-c03a4b3 state: trace.ts imports bindings.ts
      const plantedFiles = liveFiles.map((f) => {
        if (f.path === "src/content/kernel/trace.ts") {
          return {
            ...f,
            content: f.content.replace('from "./traceValidation.ts";', 'from "./bindings.ts";'),
          };
        }
        return f;
      });

      const violations = checkClientBoundaries(plantedFiles);
      expect(violations.length).toBeGreaterThanOrEqual(1);

      const bindingsViolation = violations.find((v) => v.file === "src/content/kernel/bindings.ts");
      expect(bindingsViolation).toBeDefined();
      expect(bindingsViolation?.kind).toBe("node-builtin-in-client-component");
      expect(bindingsViolation?.builtins).toContain("node:fs");
      expect(bindingsViolation?.builtins).toContain("node:path");
      expect(bindingsViolation?.chain).toContain("src/content/kernel/trace.ts");
      expect(bindingsViolation?.chain).toContain("src/content/kernel/bindings.ts");
    });

    it("allows Server Components in src/app to import Node builtins", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/page.tsx",
          content: `
            import { readFileSync } from "node:fs";
            import { join } from "node:path";
            export default function Page() {
              const data = readFileSync(join(process.cwd(), "package.json"), "utf8");
              return <pre>{data}</pre>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(0);
    });

    it("allows pure type imports from Node builtins in client components", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/components/ClientViewer.tsx",
          content: `
            "use client";
            import type { PathLike } from "node:fs";
            export function ClientViewer({ p }: { p: PathLike }) {
              return <div>{String(p)}</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(0);
    });

    it("does not false-positive on comments or strings mentioning node builtins", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/components/ClientInfo.tsx",
          content: `
            "use client";
            // Do not import node:fs or node:path here
            /* require("node:fs") is bad */
            export function ClientInfo() {
              const info = "Uses web standard crypto, not node:crypto";
              return <div>{info}</div>;
            }
          `,
        },
      ];

      const violations = checkClientBoundaries(files);
      expect(violations.length).toBe(0);
    });

    it("isNodeBuiltinSpecifier and detectNodeBuiltinUsages correctly classify builtins", () => {
      expect(isNodeBuiltinSpecifier("node:fs")).toBe(true);
      expect(isNodeBuiltinSpecifier("node:fs/promises")).toBe(true);
      expect(isNodeBuiltinSpecifier("node:path")).toBe(true);
      expect(isNodeBuiltinSpecifier("node:child_process")).toBe(true);
      expect(isNodeBuiltinSpecifier("node:os")).toBe(true);
      expect(isNodeBuiltinSpecifier("node:crypto")).toBe(true);
      expect(isNodeBuiltinSpecifier("fs")).toBe(true);
      expect(isNodeBuiltinSpecifier("path")).toBe(true);
      expect(isNodeBuiltinSpecifier("crypto")).toBe(true);
      expect(isNodeBuiltinSpecifier("react")).toBe(false);
      expect(isNodeBuiltinSpecifier("./fs.ts")).toBe(false);

      const code = `
        import fs from "node:fs";
        const path = require("node:path");
        import { spawn } from "child_process";
      `;
      const detected = detectNodeBuiltinUsages(code);
      expect(detected).toContain("node:fs");
      expect(detected).toContain("node:path");
      expect(detected).toContain("child_process");
    });
  });

  describe("Schema Layer Boundary (am-bwnf standing rule)", () => {
    /**
     * The defect this rule exists for, transcribed from am-bwnf. Before the
     * split, `glossConventions.ts` held `isModalityClass` beside a `node:fs`
     * loader and imported `GLOSS_NOTE_CLASSES` from `source.ts`, which reaches
     * `node:crypto` through `spans.ts`. Any Client Component that wanted the
     * predicate took the filesystem with it. These fixtures reproduce that
     * exact shape, module for module.
     */
    const HISTORICAL_DEFECT: SourceFileRecord[] = [
      {
        path: "src/app/papers/[paper]/[section]/page.tsx",
        content: `
          import { GlossFace } from "../../../../reader/faces/GlossFace.tsx";
          export default function Page() { return <GlossFace />; }
        `,
      },
      {
        path: "src/reader/faces/GlossFace.tsx",
        content: `
          "use client";
          import { useState } from "react";
          import { isModalityClass } from "../../content/schemas/glossConventions.ts";
          export function GlossFace() {
            const [on, setOn] = useState(false);
            return <span onClick={() => setOn(!on)}>{String(isModalityClass("hedge", []))}</span>;
          }
        `,
      },
      {
        path: "src/content/schemas/glossConventions.ts",
        content: `
          import fs from "node:fs";
          import path from "node:path";
          import { GLOSS_NOTE_CLASSES } from "./source.ts";
          export function isModalityClass(c: string, classes: readonly string[]) {
            return classes.includes(c) && GLOSS_NOTE_CLASSES.includes(c);
          }
          export function loadGlossConventions() {
            return fs.readFileSync(path.resolve("docs/editorial/GLOSS_CONVENTIONS.md"), "utf8");
          }
        `,
      },
      {
        path: "src/content/schemas/source.ts",
        content: `
          import { validateSpanAnchor } from "./spans.ts";
          import { loadRightsVocabulary } from "./rightsVocabulary.ts";
          export const GLOSS_NOTE_CLASSES = ["konjunktiv-i", "hedge"];
          export { validateSpanAnchor, loadRightsVocabulary };
        `,
      },
      {
        path: "src/content/schemas/spans.ts",
        content: `
          import crypto from "node:crypto";
          export function validateSpanAnchor(text: string) {
            return crypto.createHash("sha256").update(text).digest("hex");
          }
        `,
      },
      {
        path: "src/content/schemas/rightsVocabulary.ts",
        content: `
          import { readFileSync } from "node:fs";
          import path from "node:path";
          export function loadRightsVocabulary() {
            return readFileSync(path.join(process.cwd(), "docs", "rights-vocabulary.yaml"), "utf8");
          }
        `,
      },
    ];

    it("rejects the historical defect: a client component reaching a filesystem-backed schema module", () => {
      const violations = checkSchemaLayerBoundaries(HISTORICAL_DEFECT);

      const entry = violations.filter((v) => v.kind === "node-builtin-in-client-reachable-schema");
      expect(entry.length).toBe(1);
      expect(entry[0]?.file).toBe("src/content/schemas/glossConventions.ts");
      expect(entry[0]?.builtins).toContain("node:fs");
      expect(entry[0]?.chain).toContain("src/reader/faces/GlossFace.tsx");
      expect(entry[0]?.message).toContain("Client Component context");
      expect(entry[0]?.repair).toContain(".pure.ts");
    });

    it("reports the schema entry module, not only the leaf that holds the builtin", () => {
      // The pre-existing check names spans.ts and rightsVocabulary.ts. Neither
      // is the module that needs splitting: glossConventions.ts is what the
      // component reached for, and that is what this rule has to name.
      const leaves = checkClientBoundaries(HISTORICAL_DEFECT)
        .filter((v) => v.kind === "node-builtin-in-client-component")
        .map((v) => v.file);
      expect(leaves).toContain("src/content/schemas/spans.ts");
      expect(leaves).toContain("src/content/schemas/rightsVocabulary.ts");

      const named = checkSchemaLayerBoundaries(HISTORICAL_DEFECT).map((v) => v.file);
      expect(named).toContain("src/content/schemas/glossConventions.ts");
    });

    it("rejects a .pure.ts module that reaches a Node builtin with no client component in the tree", () => {
      // The regression the reachability checks cannot see. Nothing here is a
      // Client Component and there is no App Router entry at all, so the trap
      // is armed and silent until some future component walks into it.
      const files: SourceFileRecord[] = [
        {
          path: "src/content/schemas/glossConventions.pure.ts",
          content: `
            import { GLOSS_NOTE_CLASSES } from "./source.pure.ts";
            export function isModalityClass(c: string, classes: readonly string[]) {
              return classes.includes(c) && GLOSS_NOTE_CLASSES.includes(c);
            }
          `,
        },
        {
          path: "src/content/schemas/source.pure.ts",
          content: `
            import crypto from "node:crypto";
            export const GLOSS_NOTE_CLASSES = ["konjunktiv-i"];
            export function digest(t: string) {
              return crypto.createHash("sha256").update(t).digest("hex");
            }
          `,
        },
      ];

      // The pre-existing reachability checks see nothing: no client root exists.
      expect(checkClientBoundaries(files)).toEqual([]);

      const violations = checkSchemaLayerBoundaries(files);
      const purity = violations.filter((v) => v.kind === "node-builtin-in-pure-schema-module");
      expect(purity.map((v) => v.file).sort()).toEqual([
        "src/content/schemas/glossConventions.pure.ts",
        "src/content/schemas/source.pure.ts",
      ]);
      const transitive = purity.find(
        (v) => v.file === "src/content/schemas/glossConventions.pure.ts",
      );
      expect(transitive?.offender).toBe("src/content/schemas/source.pure.ts");
      expect(transitive?.builtins).toEqual(["node:crypto"]);
      expect(transitive?.chain).toEqual([
        "src/content/schemas/glossConventions.pure.ts",
        "src/content/schemas/source.pure.ts",
      ]);
    });

    it("rejects a .pure.ts module that imports the server half of its own schema", () => {
      // The layering rule. source.ts carries no builtin in this fixture, so
      // the purity check alone would pass it and the separation would rot.
      const files: SourceFileRecord[] = [
        {
          path: "src/content/schemas/glossConventions.pure.ts",
          content: `
            import { GLOSS_NOTE_CLASSES } from "./source.ts";
            export const CLASSES = GLOSS_NOTE_CLASSES;
          `,
        },
        {
          path: "src/content/schemas/source.ts",
          content: `export const GLOSS_NOTE_CLASSES = ["konjunktiv-i"];`,
        },
      ];

      const violations = checkSchemaLayerBoundaries(files);
      expect(violations.length).toBe(1);
      expect(violations[0]?.kind).toBe("server-schema-import-in-pure-schema-module");
      expect(violations[0]?.file).toBe("src/content/schemas/glossConventions.pure.ts");
      expect(violations[0]?.offender).toBe("src/content/schemas/source.ts");
    });

    it("accepts the repaired shape: client component -> pure half, loader half left on the server", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/papers/[paper]/page.tsx",
          content: `
            import { getModalityClasses } from "../../content/schemas/glossConventions.ts";
            import { Toggle } from "../../reader/faces/Toggle.tsx";
            export default function Page() { return <Toggle classes={getModalityClasses()} />; }
          `,
        },
        {
          path: "src/reader/faces/Toggle.tsx",
          content: `
            "use client";
            import { useState } from "react";
            import { isModalityClass } from "../../content/schemas/glossConventions.pure.ts";
            export function Toggle({ classes }: { classes: readonly string[] }) {
              const [on, setOn] = useState(false);
              return <span onClick={() => setOn(!on)}>{String(isModalityClass("hedge", classes))}</span>;
            }
          `,
        },
        {
          path: "src/content/schemas/glossConventions.pure.ts",
          content: `
            import { GLOSS_NOTE_CLASSES } from "./source.pure.ts";
            export function isModalityClass(c: string, classes: readonly string[]) {
              return classes.includes(c) && GLOSS_NOTE_CLASSES.includes(c);
            }
          `,
        },
        {
          path: "src/content/schemas/source.pure.ts",
          content: `export const GLOSS_NOTE_CLASSES = ["konjunktiv-i", "hedge"];`,
        },
        {
          path: "src/content/schemas/glossConventions.ts",
          content: `
            import fs from "node:fs";
            export { isModalityClass } from "./glossConventions.pure.ts";
            export function getModalityClasses() {
              return fs.readFileSync("docs/editorial/GLOSS_CONVENTIONS.md", "utf8").split("\n");
            }
          `,
        },
      ];

      expect(checkSchemaLayerBoundaries(files)).toEqual([]);
      expect(checkClientBoundaries(files)).toEqual([]);
    });

    it("does not fire on a type-only import of a filesystem-backed schema module", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/reader/faces/Face.tsx",
          content: `
            "use client";
            import type { GlossUnit } from "../../content/schemas/source.ts";
            export function Face({ unit }: { unit: GlossUnit }) { return <p>{unit.sentenceId}</p>; }
          `,
        },
        {
          path: "src/content/schemas/source.ts",
          content: `
            import fs from "node:fs";
            export type GlossUnit = { sentenceId: string };
            export function load() { return fs.readFileSync("x", "utf8"); }
          `,
        },
      ];

      expect(checkSchemaLayerBoundaries(files)).toEqual([]);
    });

    it("leaves server-only schema loaders alone when no client component reaches them", () => {
      const files: SourceFileRecord[] = [
        {
          path: "src/app/page.tsx",
          content: `
            import { load } from "../content/schemas/rightsVocabulary.ts";
            export default function Page() { return <p>{load()}</p>; }
          `,
        },
        {
          path: "src/content/schemas/rightsVocabulary.ts",
          content: `
            import { readFileSync } from "node:fs";
            export function load() { return readFileSync("docs/rights-vocabulary.yaml", "utf8"); }
          `,
        },
      ];

      expect(checkSchemaLayerBoundaries(files)).toEqual([]);
    });

    it("recognises the client-safe suffix only inside the schema layer", () => {
      expect(isClientSafeSchemaModule("src/content/schemas/source.pure.ts")).toBe(true);
      expect(isClientSafeSchemaModule("src/content/schemas/nested/x.pure.ts")).toBe(true);
      expect(isClientSafeSchemaModule("src/content/schemas/source.ts")).toBe(false);
      expect(isClientSafeSchemaModule("src/reader/faces/x.pure.ts")).toBe(false);
    });
  });

  describe("Clean Repository & Live Working Tree", () => {
    it("passes with zero violations on all source files in the live repository tree", () => {
      const files = collectAppRouterSourceFiles(process.cwd());
      expect(files.length).toBeGreaterThan(50);
      const violations = checkClientBoundaries(files);
      if (violations.length > 0) {
        console.error("Live tree violations:", JSON.stringify(violations, null, 2));
      }
      expect(violations).toEqual([]);
    });

    it("passes the schema layer standing rule on the live repository tree", () => {
      const files = collectAppRouterSourceFiles(process.cwd());
      const violations = checkSchemaLayerBoundaries(files);
      if (violations.length > 0) {
        console.error("Live tree schema violations:", JSON.stringify(violations, null, 2));
      }
      expect(violations).toEqual([]);
    });

    it("holds src/content/schemas/glossConventions.pure.ts and source.pure.ts to the pure contract", () => {
      // Named explicitly: these two are the split am-bwnf produced, and the
      // rule above is vacuous for them if they are ever renamed away.
      const files = collectAppRouterSourceFiles(process.cwd());
      const paths = files.map((f) => f.path);
      expect(paths).toContain("src/content/schemas/glossConventions.pure.ts");
      expect(paths).toContain("src/content/schemas/source.pure.ts");
      expect(checkSchemaLayerBoundaries(files)).toEqual([]);
    });

    it("passes with exit code 0 via runClientBoundaryGateCli", () => {
      const exitCode = runClientBoundaryGateCli(process.cwd());
      expect(exitCode).toBe(0);
    });
  });
});
