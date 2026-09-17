/** Small initial-route controller; its only palette import is dynamic and user initiated. */
export function mountSearchLauncher(anchor: HTMLAnchorElement, status: HTMLElement): () => void {
  let disposed = false, loading = false;
  let closePalette: (() => void) | null = null;
  const controller = new AbortController();
  const events = { signal: controller.signal };
  async function open() {
    if (disposed || loading || closePalette) return;
    loading = true; status.textContent = "Opening search…";
    try {
      const { openCommandPalette } = await import("./CommandPalette.ts");
      if (disposed) return;
      closePalette = openCommandPalette({ onClose: () => { closePalette = null; } });
      status.textContent = "";
    } catch {
      if (!disposed) status.textContent = "Search could not open. The papers and outlines remain available.";
    } finally {
      loading = false;
    }
  }
  anchor.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); void open();
  }, events);
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey ||
        !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
    const target = event.target;
    if (target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select"))) return;
    if (document.querySelector("dialog[open]")) return;
    event.preventDefault(); void open();
  }, events);
  // Focus real content-id targets after native navigation, without stealing focus from
  // a reader control or dialog that has already restored its own state.
  const frame = requestAnimationFrame(() => {
    if (document.activeElement !== document.body || !window.location.hash ||
        window.location.hash.length > 512 || document.querySelector("dialog[open]")) return;
    try {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (!(target instanceof HTMLElement)) return;
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
        target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true, ...events });
      }
      target.focus({ preventScroll: true });
    } catch { /* A malformed URL fragment does not interfere with reading. */ }
  });
  return () => {
    disposed = true;
    controller.abort(); cancelAnimationFrame(frame);
    closePalette?.(); closePalette = null;
  };
}
