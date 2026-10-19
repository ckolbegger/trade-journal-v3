// The navigation map: every destination and the installed capabilities it requires. A route is
// offered only when all its capabilities are installed (AC-CAP-001).
export interface RouteDefinition {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly requires: readonly string[];
  // Shown in primary navigation (as opposed to reached from another screen).
  readonly navigation: boolean;
  // Offered while Recovery Only (reads only).
  readonly readOnly: boolean;
}

export const ROUTES = [
  {
    id: 'trades',
    path: '/',
    label: 'Trades',
    requires: ['TradeViewsAndReporting.browseTrades'],
    navigation: true,
    readOnly: true,
  },
  {
    id: 'trade-detail',
    path: '/trades/:tradeId',
    label: 'Trade',
    requires: ['TradeViewsAndReporting.getTradeDetail', 'Journal.query'],
    navigation: false,
    readOnly: true,
  },
  {
    id: 'new-plan',
    path: '/plans/new',
    label: 'New Plan',
    requires: [
      'TradeWorkflows.confirmPlan',
      'ReferenceCatalog.query',
      'ReferenceCatalog.resolve',
      'Journal.getDefinitions',
    ],
    navigation: true,
    readOnly: false,
  },
  {
    id: 'accounts',
    path: '/accounts',
    label: 'Accounts',
    requires: ['ReferenceCatalog.query', 'ReferenceCatalog.save'],
    navigation: true,
    readOnly: true,
  },
  {
    id: 'about',
    path: '/about',
    label: 'About',
    requires: ['Workspace.getStatus', 'Workspace.requestDurability'],
    navigation: true,
    readOnly: true,
  },
  {
    // First run: time zone, then Institution and Account onboarding.
    id: 'start',
    path: '/start',
    label: 'Get started',
    requires: ['Workspace.initialize', 'Workspace.getStatus', 'ReferenceCatalog.save'],
    navigation: false,
    readOnly: false,
  },
] as const satisfies readonly RouteDefinition[];
