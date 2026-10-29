// Dependency direction from the design overview's "who may call whom" table (D1 A17).
// Paths match "src/<layer>/" anywhere, so the violation fixtures in tools/dep-fixtures/ are
// judged by the same rules as the application.
const layer = (name) => `(^|/)src/${name}/`;

export default {
  forbidden: [
    {
      name: 'ui-only-through-facade',
      comment: 'The UI calls only the application facade (D1 section 2).',
      severity: 'error',
      from: { path: layer('ui') },
      to: {
        path: [
          layer('modules'),
          layer('coordinators'),
          layer('persistence'),
          layer('domain/trade-analysis'),
          layer('domain/performance-analysis'),
        ],
      },
    },
    {
      name: 'fact-modules-never-call-coordinators',
      severity: 'error',
      from: { path: layer('modules') },
      to: { path: [layer('coordinators'), layer('ui'), layer('app')] },
    },
    {
      name: 'reference-catalog-calls-no-fact-module',
      comment: 'Reference Catalog never calls Journal or Trade Record.',
      severity: 'error',
      from: { path: layer('modules/reference-catalog') },
      to: { path: [layer('modules/journal'), layer('modules/trade-record'), layer('modules/market-data')] },
    },
    {
      name: 'trade-record-calls-no-fact-module',
      severity: 'error',
      from: { path: layer('modules/trade-record') },
      to: { path: [layer('modules/journal'), layer('modules/reference-catalog'), layer('modules/market-data')] },
    },
    {
      name: 'market-data-knows-no-trades',
      comment: 'Market Data never discovers Trades or interprets Positions.',
      severity: 'error',
      from: { path: layer('modules/market-data') },
      to: {
        path: [
          layer('modules/trade-record'),
          layer('modules/journal'),
          layer('modules/reference-catalog'),
          layer('domain/trade-analysis'),
        ],
      },
    },
    {
      name: 'journal-calls-no-market-data',
      severity: 'error',
      from: { path: layer('modules/journal') },
      to: { path: layer('modules/market-data') },
    },
    {
      name: 'domain-is-pure',
      comment: 'Pure analysis and values import nothing outside src/domain.',
      severity: 'error',
      from: { path: layer('domain') },
      to: {
        path: [
          layer('modules'),
          layer('coordinators'),
          layer('persistence'),
          layer('delivery'),
          layer('ui'),
          layer('app'),
          layer('sw'),
        ],
      },
    },
    {
      name: 'trade-analysis-never-sees-session-policy',
      comment: 'Trade Analysis takes dates and instants, never a calendar (D4 A39).',
      severity: 'error',
      from: { path: layer('domain/trade-analysis') },
      to: { path: layer('domain/session-policy') },
    },
    {
      name: 'daily-review-never-sees-session-policy',
      comment: 'Daily Review gets sessions from Market Data, never the policy (D4 A39).',
      severity: 'error',
      from: { path: layer('coordinators/daily-review') },
      to: { path: layer('domain/session-policy') },
    },
    {
      name: 'trade-analysis-never-calls-performance-analysis',
      severity: 'error',
      from: { path: layer('domain/trade-analysis') },
      to: { path: layer('domain/performance-analysis') },
    },
    {
      name: 'persistence-is-internal',
      severity: 'error',
      from: { path: layer('persistence') },
      to: { path: [layer('modules'), layer('coordinators'), layer('ui'), layer('app')] },
    },
    {
      name: 'coordinators-never-call-ui',
      severity: 'error',
      from: { path: layer('coordinators') },
      to: { path: [layer('ui'), layer('app')] },
    },
    {
      name: 'service-worker-is-standalone',
      severity: 'error',
      from: { path: layer('sw') },
      to: { path: [layer('ui'), layer('app'), layer('modules'), layer('coordinators'), layer('persistence')] },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
