// A stack with an initialized Workspace, one Institution and Account, and the seeded Long Stock
// Strategy and Plan Reflection definition, built through public operations only.
import { createMutationGuard } from '../../src/coordinators/mutation-guard.ts';
import { createTradeWorkflows } from '../../src/coordinators/trade-workflows/index.ts';
import { createWorkspace } from '../../src/coordinators/workspace/index.ts';
import { testStack } from './stack.ts';

export async function onboardedStack(...args: Parameters<typeof testStack>) {
  const stack = await testStack(...args);
  const workspace = createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId });
  const guard = createMutationGuard(stack.session);
  const tradeWorkflows = createTradeWorkflows({ ...stack, guard });
  await workspace.initialize({ timeZone: 'America/New_York' });
  const institution = await stack.catalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
  if (institution.kind !== 'Saved') throw new Error('institution not saved');
  const account = await stack.catalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label: 'Roth IRA' });
  if (account.kind !== 'Saved') throw new Error('account not saved');
  const strategies = await stack.catalog.query({ family: 'Strategy' });
  if (strategies.kind !== 'Page') throw new Error('no strategies');
  const definition = await stack.journal.getDefinitions({ latestFor: 'entry-type.plan-reflection' });
  if (definition.kind !== 'Found') throw new Error('no definition');
  return {
    ...stack,
    workspace,
    guard,
    tradeWorkflows,
    institution: institution.record,
    account: account.record,
    strategy: strategies.items[0]!,
    definition: definition.definition,
  };
}
