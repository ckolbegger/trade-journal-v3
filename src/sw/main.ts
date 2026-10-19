import { RELEASE_ID } from '../delivery/release-identity.ts';

// Service-worker entry. Staging, serving, and activation arrive in T1.8.
(self as unknown as { tjReleaseId: string }).tjReleaseId = RELEASE_ID;
