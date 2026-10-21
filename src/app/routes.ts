// The navigation map: every destination and the installed capabilities it requires. A route is
// offered only when all its capabilities are installed (AC-CAP-001).
export interface RouteDefinition {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly requires: readonly string[];
  // The variants of required operations this destination presents, such as the lifecycles a list
  // or Detail shows. Every one must be installed, like the operations themselves.
  readonly variants?: Readonly<Record<string, readonly string[]>>;
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
    // The Open (default) and Planned tabs (D2 A32).
    requires: ['TradeViewsAndReporting.browseTrades'],
    variants: { 'TradeViewsAndReporting.browseTrades': ['Open', 'Planned'] },
    navigation: true,
    readOnly: true,
  },
  {
    id: 'trade-detail',
    path: '/trades/:tradeId',
    label: 'Trade',
    requires: ['TradeViewsAndReporting.getTradeDetail', 'Journal.query'],
    variants: { 'TradeViewsAndReporting.getTradeDetail': ['Planned', 'Open'] },
    navigation: false,
    readOnly: true,
  },
  {
    // "Record entry" on Planned and Open Trade Detail: one Position Change with its Position Change
    // Reflection, completed or declined (D2 A33).
    id: 'record-entry',
    path: '/trades/:tradeId/record-entry',
    label: 'Record entry',
    requires: ['TradeWorkflows.recordPositionChange', 'TradeViewsAndReporting.getTradeDetail', 'Journal.getDefinitions'],
    variants: {
      'TradeWorkflows.recordPositionChange': ['Opening', 'Increase', 'Stock', 'SingleTrade', 'Complete', 'Decline'],
    },
    navigation: false,
    readOnly: false,
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

// Whether a destination is offered: all its operations, and every variant it presents, are installed.
export function isRouteInstalled(route: RouteDefinition, operations: Readonly<Record<string, readonly string[]>>): boolean {
  return (
    route.requires.every((op) => op in operations) &&
    Object.entries(route.variants ?? {}).every(([op, variants]) => variants.every((v) => operations[op]?.includes(v)))
  );
}
