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
  collectAppRouterSourceFiles,
  detectClientHookUsages,
  extractRuntimeImportSpecifiers,
  hasUseClientDirective,
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

    it("passes with exit code 0 via runClientBoundaryGateCli", () => {
      const exitCode = runClientBoundaryGateCli(process.cwd());
      expect(exitCode).toBe(0);
    });
  });
});
