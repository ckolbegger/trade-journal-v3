# BUG-001 commit publication

The trader authorized commit and push on 2026-10-25 after local implementation,
independent acceptance, final qualification and approved live activation completed.
The verification JSON records the pre-commit verification state; Git history is
the authority for subsequent commit/push delivery.

Temporary `.playwright-artifacts-*` directories are kept locally and excluded from
Git. Their exact contents are preserved losslessly in `raw-playwright-artifacts.tar.gz`;
`raw-playwright-artifacts-manifest.json` records every original path, size and SHA-256.
Extract from this directory to restore those relative paths. Public reports,
screenshots, trace.zip files, source snapshots, gate results and failed critic logs
remain directly available. No live user screenshot or journal values were added.
