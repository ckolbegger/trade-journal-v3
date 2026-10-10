// Vitest global setup: provides an IndexedDB implementation in Node so
// persistence-layer unit tests can run without a browser (plan §1).
import 'fake-indexeddb/auto'
