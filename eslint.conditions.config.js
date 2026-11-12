// D7S A197: a Plan holds several conditions per role, so a literal index into stops, targets, stopBasis or
// targetBasis reads "the" Stop by position. Merged into every non-exempt no-restricted-syntax entry under src/
// (ESLint replaces a rule's options when a later entry sets it again), the way expirationComparisonSelectors is.
// A computed non-literal index (stopBasis[i]) is a walk over conditions and passes.
const names = 'stops|targets|stopBasis|targetBasis';

export const conditionIndexSelectors = [
  {
    selector: `MemberExpression[computed=true][property.type='Literal']:matches([object.property.name=/^(${names})$/], [object.name=/^(${names})$/])`,
    message:
      'condition-index: a Plan holds several conditions; use every condition, or headlineBasisOf / measurementOf from Trade Analysis (A197), never a literal index into stops, targets, stopBasis or targetBasis.',
  },
];
