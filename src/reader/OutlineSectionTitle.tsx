/*
  A section's outline link names its place and its subject, "§4 · dilute radiation and the volume
  law", in two parts. On a phone the outline shows the place alone, as a row of chips (reader.css):
  measured on BUILD 24 at 390, the ten full titles stood as ten 48px rows, 480px, between the
  reading controls and the paper's first sentence. The link's accessible name is the whole title
  (aria-label), so a reader who hears the chip hears the subject too. PaperPage and PaperReader
  (Brownian) both draw their outline with it.
*/
export function OutlineSectionTitle({ title }: { title: string }) {
  const cut = title.indexOf(" · ");
  if (cut === -1) return <span className="outline-section-mark">{title}</span>;
  return (
    <>
      <span className="outline-section-mark">{title.slice(0, cut)}</span>
      <span className="outline-section-name">{title.slice(cut)}</span>
    </>
  );
}
