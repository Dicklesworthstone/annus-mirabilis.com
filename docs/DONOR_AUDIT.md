# Donor and Numerical Owner Audit

**Audit Date:** 2026-09-15  
**Auditor:** LilacCanyon (`antigravity`, model `gemini-3.8-flash-high`)  
**Status:** In Progress (Sections 1 & 2 drafted incrementally per coordinator directive)  
**Owning Bead:** `am-gov-donor-audit-0wa`

---

## 1. Identity

### 1.1 Architecture Donor: classic-patents.com

- **Repository URL:** `https://github.com/Dicklesworthstone/classic-patents.com`
- **Local Checkout Path:** `/Users/jemanuel/projects/classic-patents.com`
- **Pinned Commit Hash:** `da11ff475902728fd8dd1d9db9f3af37c16ec8a5`
- **Commit Date:** `2026-09-05 19:35:02 -0400` (`2026-09-05T19:35:02-04:00`)
- **Commit Author:** Jeff Emanuel `<jeff141421@gmail.com>`
- **Commit Subject:** `feat(ui): enhance 2D/3D patent simulations, laboratory visualizers, and interactive timeline`
- **Revision Status:** Pinned revision is current `HEAD` of the local checkout (`git -C ~/projects/classic-patents.com rev-parse HEAD`).
- **Retrieval Method:** Local clone inspection via `git show`, `git ls-tree`, `git cat-file`.

### 1.2 Numerical Owner: FrankenSim

- **Repository URL:** `https://github.com/Dicklesworthstone/frankensim`
- **Local Checkout Path:** `/Users/jemanuel/projects/frankensim`
- **Pinned Commit Hash (Kickoff Pin):** `5bbbfae6f7de614422f6f97f5798a3e00f8ad813`
  - **Commit Date:** `2026-09-13 22:22:09 -0400` (`2026-09-13T22:22:09-04:00`)
  - **Commit Author:** Jeff Emanuel `<35050222+Dicklesworthstone@users.noreply.github.com>`
  - **Commit Subject:** `feat(conduction): differentiate cooling through temperature-dependent conductivity`
  - **Role:** The authoritative pinned revision that Annus Mirabilis builds and verifies against at kickoff.
- **Second Inspected Revision:** `88a4819abe7a361d278759aabec962604f87a00c`
  - **Commit Date:** `2026-09-14 09:07:46 -0400` (`2026-09-14T09:07:46-04:00`)
  - **Commit Author:** Jeff Emanuel `<35050222+Dicklesworthstone@users.noreply.github.com>`
  - **Commit Subject:** `feat(cli): schedule independent component powers across coupled thermal transients`
  - **Role:** Earlier planning inspection revision, documented for diff comparison and corroboration.
- **Ancestry Relationship:** Determined deterministically by command:
  - `git -C ~/projects/frankensim merge-base --is-ancestor 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 88a4819abe7a361d278759aabec962604f87a00c` exited `0` (TRUE).
  - `git -C ~/projects/frankensim merge-base --is-ancestor 88a4819abe7a361d278759aabec962604f87a00c 5bbbfae6f7de614422f6f97f5798a3e00f8ad813` exited `1` (FALSE).
  - **Verdict:** `5bbbfae6f7de614422f6f97f5798a3e00f8ad813` IS an ancestor of `88a4819abe7a361d278759aabec962604f87a00c`, proving that `88a4819abe7a361d278759aabec962604f87a00c` is the later revision.

---

## 2. Method and Limits

### 2.1 Inspection Scope & Limitations

This audit is **source and document inspection**, not an execution audit.
- **What was inspected:** Repository manifests (`package.json`, `Cargo.toml`, `rust-toolchain.toml`), source code files, documentation, test files, and git commit objects at the pinned revisions.
- **What was NOT executed:** Donor test suites (`bun test`), browser end-to-end tests (`playwright`), production builds (`next build`), donor WASM artifact builds (`cargo build --target wasm32-unknown-unknown`), and native simulation sliders were **NOT** executed.
- **Reporting Rule:** Reported catalog counts and code metrics represent documentation facts and static analysis at the inspected snapshot, trusted strictly from manifest declarations and executing code over prose.

### 2.2 Executed Checks and Command Log

The following deterministic commands were executed in the local environment to establish audit facts:

1. **Commit Resolution & Commit Date Verification:**
   - Command: `git -C /Users/jemanuel/projects/classic-patents.com cat-file -e da11ff475902728fd8dd1d9db9f3af37c16ec8a5^{commit}`
   - Result: Exit 0.
   - Command: `git -C /Users/jemanuel/projects/classic-patents.com log -1 --format="commit %H%ndate: %ci (%cI)%nauthor: %an <%ae>%nsubject: %s" da11ff475902728fd8dd1d9db9f3af37c16ec8a5`
   - Result: Exit 0. Output confirmed commit date `2026-09-05 19:35:02 -0400`.
   - Command: `git -C /Users/jemanuel/projects/frankensim cat-file -e 5bbbfae6f7de614422f6f97f5798a3e00f8ad813^{commit}`
   - Result: Exit 0.
   - Command: `git -C /Users/jemanuel/projects/frankensim log -1 --format="commit %H%ndate: %ci (%cI)%nauthor: %an <%ae>%nsubject: %s" 5bbbfae6f7de614422f6f97f5798a3e00f8ad813`
   - Result: Exit 0. Output confirmed commit date `2026-09-13 22:22:09 -0400`.
   - Command: `git -C /Users/jemanuel/projects/frankensim cat-file -e 88a4819abe7a361d278759aabec962604f87a00c^{commit}`
   - Result: Exit 0.
   - Command: `git -C /Users/jemanuel/projects/frankensim log -1 --format="commit %H%ndate: %ci (%cI)%nauthor: %an <%ae>%nsubject: %s" 88a4819abe7a361d278759aabec962604f87a00c`
   - Result: Exit 0. Output confirmed commit date `2026-09-14 09:07:46 -0400`.

2. **FrankenSim Ancestry Verification:**
   - Command: `git -C /Users/jemanuel/projects/frankensim merge-base --is-ancestor 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 88a4819abe7a361d278759aabec962604f87a00c`
   - Result: Exit 0 (5bbbfae IS ancestor of 88a4819).
   - Command: `git -C /Users/jemanuel/projects/frankensim merge-base --is-ancestor 88a4819abe7a361d278759aabec962604f87a00c 5bbbfae6f7de614422f6f97f5798a3e00f8ad813`
   - Result: Exit 1 (88a4819 IS NOT ancestor of 5bbbfae).

3. **FrankenSim Inter-Revision Log & Diff Stat:**
   - Command: `git -C /Users/jemanuel/projects/frankensim log --oneline 5bbbfae6f7de614422f6f97f5798a3e00f8ad813..88a4819abe7a361d278759aabec962604f87a00c`
   - Result: 3 commits (`88a4819a`, `f12c84cd`, `268f2399`).
   - Command: `git -C /Users/jemanuel/projects/frankensim diff --stat 5bbbfae6f7de614422f6f97f5798a3e00f8ad813 88a4819abe7a361d278759aabec962604f87a00c -- crates/fs-wasm crates/fs-rand crates/fs-qty crates/fs-sparse crates/fs-demo-physics-wasm`
   - Result: Empty diff stat (0 files changed across those 5 key crates between 5bbbfae and 88a4819).

4. **Donor LICENSE SHA-256 Check:**
   - Command: `git -C /Users/jemanuel/projects/classic-patents.com show da11ff475902728fd8dd1d9db9f3af37c16ec8a5:LICENSE | shasum -a 256`
   - Result: `32a82e0a5754e72e51fae44b65a936c831c07376f21c90f5fb9e76897fcc3509  -`

5. **Reuse Seam Path Existence Verification:**
   - Method: Enumerated all 39 reuse and harness paths from §2.3 and verified against `git ls-tree -r --name-only da11ff475902728fd8dd1d9db9f3af37c16ec8a5`.
   - Result: 100% of tested paths confirmed present at the pinned revision.
