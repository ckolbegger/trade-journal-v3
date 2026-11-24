import { INSTALLED_CAPABILITIES } from './capabilities'

export function declaredCapabilities(): string[] {
  return ['Institutions & Accounts', 'Workspace']
}

export function navigationFor(): string[] {
  return declaredCapabilities()
}

export function hasCapability(name: string): boolean {
  return INSTALLED_CAPABILITIES.some(c => c.includes(name))
}
