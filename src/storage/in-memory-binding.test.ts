import { describe } from 'vitest'
import { InMemoryBinding } from './in-memory-binding'
import { storageBindingContract } from '../../tests/contracts/storage-binding.contract'

describe('InMemoryBinding', () => {
  storageBindingContract(() => new InMemoryBinding())
})
