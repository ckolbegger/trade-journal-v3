import type { StorageBinding } from '@/storage/storage-binding'
import { ListRegistry } from '../list-registry'
import type { Account, Institution } from './types'

// The system of record for Trades. This slice implements only the account
// registries onboarding needs; later slices add lifecycle operations on the
// same instance without reshaping it.

export class TradeBook {
  readonly registries: {
    institutions: ListRegistry<Institution>
    accounts: ListRegistry<Account>
  }

  constructor(binding: StorageBinding) {
    this.registries = {
      institutions: new ListRegistry<Institution>(binding, 'institutions'),
      accounts: new ListRegistry<Account>(binding, 'accounts', async (account) => {
        const institution = await binding.get<Institution>('institutions', account.institutionId)
        if (!institution) {
          throw new Error(`Account references unknown institution ${account.institutionId}`)
        }
      }),
    }
  }
}
