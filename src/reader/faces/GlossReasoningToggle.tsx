"use client";

/** Only the control hydrates. Source text, glossary validation and math rendering
 * stay on the server. Native :checked CSS also makes the control work without JS. */
export function GlossReasoningToggle({ initiallyChecked = false }: { initiallyChecked?: boolean }) {
  return (
    <label className="reasoning-toggle-label">
      <input
        type="checkbox"
        data-toggle-reasoning="true"
        defaultChecked={initiallyChecked}
        onChange={(event) => {
          const face = event.currentTarget.closest<HTMLElement>(".gloss-face");
          if (face) face.dataset.reasoningWords = event.currentTarget.checked ? "on" : "off";
        }}
        className="reasoning-toggle-checkbox"
      />
      <span className="toggle-text">Show the reasoning words</span>
    </label>
  );
}
