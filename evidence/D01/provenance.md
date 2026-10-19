# D1 provenance

Exact versions used by each evidence run. These are provenance, never a support allowlist.

| Run | Date | Node.js | npm | Operating system | Browser engines |
|---|---|---|---|---|---|
| T1.1 toolchain verification | 2026-10-18 | v26.12.0 (Homebrew) | 11.20.0 | macOS 26.6.2 (25G83), arm64 | none used |
| T1.2 engine capability smoke | 2026-10-18 | v26.12.0 (Homebrew) | 11.20.0 | macOS 26.6.2 (25G83), arm64 | Chromium 153.0.8010.12 (Playwright 1.63.0 headless shell, revision 1243) |
| T1.19 capacity measurement | 2026-10-19 | v26.12.0 (Homebrew) | 11.20.0 | macOS 26.6.2 (25G83), arm64 | Chromium 153.0.8010.12 (Playwright 1.63.0 headless shell) |
| T1.29 browser suite (B1.1–B1.15) | 2026-10-19 | v26.12.0 (Homebrew) | 11.20.0 | macOS 26.6.2 (25G83), arm64 | Chromium 153.0.8010.12 (Playwright 1.63.0, full Chromium build, `channel: chromium`, new headless). B1.3 drives the same binary as a spawned process with default features (SQLite IndexedDB backend) so it can be killed; the other cases use Playwright's launch flags (LevelDB IndexedDB backend). |
