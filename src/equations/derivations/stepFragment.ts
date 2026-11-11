/** A fragment addresses a published step, independently of a reader's detail preference. */
export function derivationStepFromHash(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  try {
    const id = decodeURIComponent(hash.slice(1));
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Open enclosing native disclosures before scrolling or moving keyboard focus to the step. */
export function revealDerivationStep(target: HTMLElement): void {
  let ancestor = target.parentElement;
  while (ancestor) {
    if (ancestor.tagName === "DETAILS") (ancestor as HTMLDetailsElement).open = true;
    ancestor = ancestor.parentElement;
  }
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start", behavior: "instant" });
}
