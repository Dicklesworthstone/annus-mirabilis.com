/**
 * Obstacle-copy banned phrasings for am-read-passage-actions-vbe. Self-diagnosis,
 * level declarations, and judgment of the reader are refused here. Persona and
 * level phrases already live in content/editorial/voice-rules.yaml; this list
 * is the extra obstacle-menu set, kept beside the components until the voice-lint
 * bead absorbs it. Not a second lint engine: callers scan fixture copy with both.
 */
export const BANNED_OBSTACLE_PHRASES: readonly string[] = Object.freeze([
  "learning disability",
  "you should already know",
  "too basic for you",
  "if you were better at math",
  "admit you are stuck",
  "what kind of learner",
  "your weakness",
]);

export function findBannedObstaclePhrases(text: string): readonly string[] {
  const lower = text.toLowerCase();
  return BANNED_OBSTACLE_PHRASES.filter((phrase) => lower.includes(phrase));
}
