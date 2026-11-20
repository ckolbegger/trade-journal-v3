// Retro D9B-2: a relative import names its file with the extension. tsconfig's allowImportingTsExtensions makes
// the extension optional for typecheck, but code loaded under Node (tools, scripts) fails without it
// (ERR_MODULE_NOT_FOUND), so the convention is the explicit extension everywhere.
const knownExtension = /\.(?:[cm]?[jt]sx?|json|css|svg|png|jpe?g|html|md|csv|txt)$/;
const isRelative = (value) => value === '.' || value === '..' || value.startsWith('./') || value.startsWith('../');

const requireExtension = {
  meta: { type: 'problem', schema: [], messages: { missing: "Relative import '{{ value }}' needs its file extension (for a directory, '/index.ts')." } },
  create(context) {
    const check = (node, source) => {
      if (source === null || source === undefined) return;
      let value;
      if (source.type === 'Literal') value = source.value;
      else if (source.type === 'TemplateLiteral' && source.expressions.length === 0) value = source.quasis[0].value.cooked;
      if (typeof value !== 'string' || !isRelative(value)) return;
      if (knownExtension.test(value.split('?')[0])) return;
      context.report({ node, messageId: 'missing', data: { value } });
    };
    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
    };
  },
};

export const importExtensionRuleId = 'imports/require-extension';
export const importExtensionRules = {
  files: ['**/*.{ts,tsx}'],
  plugins: { imports: { rules: { 'require-extension': requireExtension } } },
  rules: { [importExtensionRuleId]: 'error' },
};
