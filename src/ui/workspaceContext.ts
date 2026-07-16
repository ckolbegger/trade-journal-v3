import { createContext, useContext } from 'react'
import type { Workspace } from '@/workspace/workspace'

export const WorkspaceContext = createContext<Workspace | null>(null)

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error('Workspace not provided')
  return workspace
}
