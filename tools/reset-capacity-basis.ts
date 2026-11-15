// npm run measure:capacity:reset-basis [engine...]: re-measures D7's capacity figures and rewrites src/delivery/capacity-basis.json,
// and nothing else (D8 T8.19-F1, decision 114). A schema-changing deliverable runs it (decision 18).
import { resetCapacityBasis } from './capacity/measure-basis.ts';

await resetCapacityBasis(process.argv.slice(2));
