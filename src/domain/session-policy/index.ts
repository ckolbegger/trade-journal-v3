import { createSessionPolicy } from './policy.ts';
import { NYSE_TABLE } from './table.ts';

export { createSessionPolicy } from './policy.ts';
export type * from './types.ts';

// The release's built-in policy. A test policy is built with createSessionPolicy.
export const nyseSessionPolicy = createSessionPolicy({
  id: 'nyse',
  revision: 1,
  coverage: { first: '2024-01-01', last: '2028-12-31' },
  table: NYSE_TABLE,
});
