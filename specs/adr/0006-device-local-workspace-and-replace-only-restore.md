# Device-local Workspace and replace-only Restore

Status: accepted

The required product has one trader and one device-local Workspace. It has no application login, hosted journal-data backend, automatic synchronization, or multi-device conflict model. Brokerage Accounts remain domain records. Portability and recovery use one versioned, self-contained full backup.

Restore is validation-first and replace-only. It never merges, appends, or selectively imports. Supported older input may migrate forward, but malformed, inconsistent, lossy, or newer-unsupported input changes nothing. Applying a prepared Restore atomically replaces every authoritative section after explicit confirmation and a safety-backup choice.

This boundary keeps local privacy and offline reliability tractable while preserving deliberate portability. Restoring one backup to two devices creates independent copies rather than a synchronization relationship.
