/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/components/ui/LatexRenderer.tsx
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Restricted KaTeX trust callback to reject \href, \url, \includegraphics, \htmlClass, \htmlId, \htmlStyle, \htmlData (am-scaf-extract-ui-components-c31 requirement 5).
 * - Added pure renderLatexToHtmlAndMathml helper throwing MalformedLatexError to fail closed on malformed mathematics.
 * - Retained TextWithLatex and HudText with accessible fallback and no raw TeX leakage.
 */

"use client";

import type { TrustContext } from "katex";
import katex from "katex";
import React, { useMemo } from "react";

export class MalformedLatexError extends Error {
  readonly math: string;

  constructor(math: string, detail: string) {
    super(`Malformed LaTeX notation refused: ${detail}`);
    this.name = "MalformedLatexError";
    this.math = math;
  }
}

export interface LatexRendererProps {
  readonly math: string;
  readonly block?: boolean;
  readonly className?: string;
}

const FORBIDDEN_TRUST_COMMANDS = new Set([
  "\\href",
  "\\url",
  "\\includegraphics",
  "\\htmlClass",
  "\\htmlId",
  "\\htmlStyle",
  "\\htmlData",
]);

/**
 * Trust callback strictly enforcing requirement 5:
 * Allows no \href, \url, \includegraphics, \htmlClass, \htmlId, \htmlStyle, or \htmlData.
 */
export function trustInteractiveTokenMarkup(context: TrustContext): boolean {
  if (FORBIDDEN_TRUST_COMMANDS.has(context.command)) {
    return false;
  }
  return false;
}

/**
 * Pure render helper producing HTML and MathML. Throws MalformedLatexError on parse failure.
 */
export function renderLatexToHtmlAndMathml(
  math: string,
  options?: { displayMode?: boolean },
): string {
  if (!math?.trim()) return "";
  try {
    return katex.renderToString(math, {
      displayMode: options?.displayMode ?? false,
      throwOnError: true,
      output: "htmlAndMathml",
      trust: (context) => {
        const trusted = trustInteractiveTokenMarkup(context);
        if (!trusted) {
          throw new Error(`Untrusted command: ${context.command}`);
        }
        return true;
      },
      strict: "error",
    });
  } catch (err: unknown) {
    throw new MalformedLatexError(math, err instanceof Error ? err.message : String(err));
  }
}

export function LatexRenderer({ math, block = false, className = "" }: LatexRendererProps) {
  const html = useMemo(() => {
    if (!math) return "";
    try {
      return renderLatexToHtmlAndMathml(math, { displayMode: block });
    } catch {
      return null;
    }
  }, [math, block]);

  if (!html) {
    return (
      <span
        role="status"
        aria-label="Mathematical notation unavailable"
        className={`latex-container inline-block rounded border border-amber-500/50 bg-amber-100/70 px-2 py-1 font-sans text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 ${className}`}
      >
        Mathematical notation unavailable
      </span>
    );
  }

  return (
    <span
      className={`latex-container inline-block ${className}`}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX serializes the formula; trust is strictly restricted above.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * TextWithLatex parses a mixed text string containing $inline$ and $$block$$ math delimiters
 * and renders both text and mathematical formulas seamlessly.
 */
export function TextWithLatex({
  text,
  className = "",
}: {
  readonly text: string;
  readonly className?: string;
}) {
  const elements = useMemo(() => {
    if (!text) return null;

    // Match $$block$$ or $inline$
    const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);

    const seen = new Map<string, number>();
    return parts.map((part) => {
      const n = (seen.get(part) ?? 0) + 1;
      seen.set(part, n);
      const key = `${n}:${part.slice(0, 48)}`;
      if (part.startsWith("$$") && part.endsWith("$$")) {
        const formula = part.slice(2, -2);
        return (
          <span key={key} className="block overflow-x-auto">
            <LatexRenderer math={formula} block={true} />
          </span>
        );
      }
      if (part.startsWith("$") && part.endsWith("$")) {
        const formula = part.slice(1, -1);
        return <LatexRenderer key={key} math={formula} block={false} />;
      }
      return <React.Fragment key={key}>{part}</React.Fragment>;
    });
  }, [text]);

  return <span className={className}>{elements}</span>;
}

/** HUD/slider copy that may contain $inline$ TeX. */
export function HudText({
  text,
  className = "",
}: {
  readonly text: string;
  readonly className?: string;
}) {
  return <TextWithLatex text={text} className={className} />;
}
