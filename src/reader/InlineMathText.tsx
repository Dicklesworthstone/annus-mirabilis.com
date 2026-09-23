import { hasInlineMath, splitInlineMath } from "../content/inlineMath.ts";
import { renderInlineLatex } from "../equations/render/inlineKatex.ts";

/**
 * A paragraph's or a step's text with its `\( … \)` mathematics typeset. The words stay React
 * text, escaped as ever; only KaTeX's own output (strict, no trusted commands) is set as HTML.
 * Text with no inline mathematics renders exactly as it did.
 */
export function InlineMathText({ text }: { text: string }) {
  if (!hasInlineMath(text)) return text;
  return (
    <>
      {splitInlineMath(text).map((segment) =>
        segment.kind === "text" ? (
          segment.value
        ) : (
          <span
            key={segment.start}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: static KaTeX output of a validated record, rendered with trust: false; the surrounding words stay escaped React text.
            dangerouslySetInnerHTML={{ __html: renderInlineLatex(segment.value) }}
          />
        ),
      )}
    </>
  );
}
