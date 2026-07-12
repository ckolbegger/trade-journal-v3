import { useState } from 'react'
import { AddendumForm } from './AddendumForm'
import { btnSecondary } from '../styles'
import type { Entry } from '@/books/journal/types'

// "Add addendum" on any displayed entry — timeline and Trade detail alike
// share this affordance and the form it opens (S2.3). There is deliberately
// no sibling "Edit" affordance anywhere: growth happens by addendum only.

export function AddAddendum({ entry, onAdded }: { entry: Entry; onAdded: () => void }) {
  const [open, setOpen] = useState(false)

  if (open) {
    return (
      <AddendumForm
        parent={entry}
        onSaved={() => {
          setOpen(false)
          onAdded()
        }}
        onCancel={() => setOpen(false)}
      />
    )
  }

  return (
    <button type="button" className={btnSecondary} onClick={() => setOpen(true)}>
      Add addendum
    </button>
  )
}
