// D08P A216: the cockpit's components take plain props, so sharing them later is a move, not a rewrite (handoff
// section 5.5, condition 1). Only an adapter (`<name>.props.ts`, and its test) may import a view's types or a coordinator.
// No other entry sets no-restricted-imports, so this one is not replaced by a later one.
const message = (what) =>
  `cockpit-import: ${what} is imported only by a *.props.ts adapter (A216); the cockpit's components take plain props, so import their props type instead.`;

export const cockpitImportRules = {
  files: ['src/ui/cockpit/**/*.{ts,tsx}'],
  ignores: ['src/ui/cockpit/**/*.props.ts', 'src/ui/cockpit/**/*.props.test.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['**/app/types*'], message: message('app/types') },
          { group: ['**/coordinators/**'], message: message('a coordinator') },
        ],
      },
    ],
  },
};
