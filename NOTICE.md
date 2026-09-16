# NOTICE

Attribution for files extracted from donor projects that cannot carry a
source-code comment block (JSON, plain text, and other non-commentable
formats). TypeScript, TSX, JavaScript, and CSS files carry their own header
comment instead; see `docs/DONOR_AUDIT.md` section 9 for the template and
policy. Every entry below also has a row in `docs/DONOR_AUDIT.md` section 11.

## classic-patents.com

- **Source repository:** https://github.com/Dicklesworthstone/classic-patents.com
- **Pinned commit:** `da11ff475902728fd8dd1d9db9f3af37c16ec8a5`
- **License:** MIT License (with OpenAI/Anthropic Rider). Preserved unmodified at `/LICENSE`.

| File | Donor source path | Modifications |
|---|---|---|
| `scripts/fixtures/deployment-target/corrupt-project.txt` | `scripts/fixtures/deployment-target/corrupt-project.txt` | None; the invalid-JSON fixture content is unchanged. |
| `scripts/fixtures/deployment-target/wrong-project.json` | `scripts/fixtures/deployment-target/wrong-project.json` | `projectName` changed from the donor's `classic-patents.com` to a neutral `wrong-project`, since a donor identity string may not appear in this repository outside an attribution comment (docs/DONOR_AUDIT.md section 10). `projectId` and `orgId` changed to distinct placeholder values for the same reason. |
| `docs/PAPER_E2E_HARNESS.md` | `docs/PATENT_E2E_HARNESS.md` | Adapted for papers instead of patents; replaced the patent-catalogue "what a scenario proves" section with the harness's current infrastructure-only status and the new vertical-slice journey contract. This attribution is repeated inline in the document's own body, since Markdown prose is more visible there than a hidden comment. |
