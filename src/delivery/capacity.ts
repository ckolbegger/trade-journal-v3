import basis from './capacity-basis.json';
import type { CapacityRequirement } from './readiness.ts';

// The readiness capacity requirement: quota ≥ 3 × M for the mature projection M (decision 18).
export const CAPACITY_REQUIREMENT: CapacityRequirement = {
  projectedWorkspaceBytes: basis.projectedWorkspaceBytes,
  requiredQuotaBytes: basis.requiredQuotaBytes,
};
