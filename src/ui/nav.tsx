import { NavLink } from 'react-router'

const navItems: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/trades', label: 'Trades' },
  { to: '/plan', label: 'New Plan' },
  { to: '/review', label: 'Daily Review' },
  { to: '/journal', label: 'Journal' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
]

function linkClass({ isActive }: { isActive: boolean }) {
  return [
    'rounded-md px-3 py-1.5 block',
    isActive
      ? 'bg-card font-medium text-ink'
      : 'text-muted hover:text-ink',
  ].join(' ')
}

/** Wide layout: fixed left sidebar. Hidden below the md breakpoint. */
export function SideNav() {
  return (
    <nav
      aria-label="Main menu"
      data-shell="side-nav"
      className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-60 md:flex-col md:gap-1 md:border-r md:border-line md:bg-card md:p-4"
    >
      <p className="mb-4 px-3 text-lg font-semibold">Trade Journal</p>
      {navItems.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Narrow layout: fixed bottom navigation. Hidden from the md breakpoint up. */
export function BottomNav() {
  return (
    <nav
      aria-label="Main menu"
      data-shell="bottom-nav"
      className="fixed inset-x-0 bottom-0 flex justify-between border-t border-line bg-card px-1 pb-1 pt-1.5 md:hidden"
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            [
              'flex flex-col items-center rounded-md px-2 py-1 text-[11px]',
              isActive ? 'font-semibold text-ink' : 'text-muted',
            ].join(' ')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
