/** An honest reading floor: 200 words per minute, rounded up to half a minute. */
export const WORDS_PER_MINUTE = 200;
export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(0.5, Math.ceil((words / WORDS_PER_MINUTE) * 2) / 2);
}
