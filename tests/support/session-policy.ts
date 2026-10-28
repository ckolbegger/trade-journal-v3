// A plain session-policy identity for persistence tests: persistence never imports the policy
// itself (D4 A39), so a test passes the same shape a release would.
export const TEST_SESSION_POLICY = {
  id: 'test-policy',
  revision: 7,
  digest: 'digest-of-test-policy',
  coverage: { first: '2024-01-01', last: '2028-12-31' },
} as const;
