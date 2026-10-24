import { writeFileSync, mkdirSync } from 'node:fs';
import { build } from 'vite';
import { releaseId } from './release.ts';
mkdirSync('.cache/d1-source', { recursive: true });
writeFileSync('.cache/d1-source/native-entry.ts', `
import { Store, Runtime } from './src/infrastructure/storage';
import { BrowserHost } from './src/infrastructure/browser-host';
import { Workspace } from './src/application/workspace';
import { ReferenceCatalog } from './src/domain/reference-catalog';
import { TradeWorkflows } from './src/application/trade-workflows';
window.d2Legacy = { async createAt(name) {
  const store = new Store(name); const runtime = new Runtime(store, new BrowserHost());
  try {
    const opened = await new Workspace(runtime).initialize({openingInstant:'2026-10-17T20:00:00Z',timeZone:'America/New_York'});
    if(opened.status!=='Opened')throw new Error('Legacy init '+opened.status);
    const catalog = new ReferenceCatalog(store,runtime);
    const institution=await catalog.save({kind:'Institution',label:'Historical broker',generation:opened.root.generation,expectedCatalogRevision:opened.root.catalogRevision});
    if(institution.status!=='Saved')throw new Error('Legacy Institution');
    const account=await catalog.save({kind:'Account',label:'Trading',parentId:institution.record.id,generation:opened.root.generation,expectedCatalogRevision:institution.catalogRevision});
    if(account.status!=='Saved')throw new Error('Legacy Account');
    const confirmed=await new TradeWorkflows(runtime,()=>'2026-10-18T20:00:00Z').confirmPlan({generation:opened.root.generation,expectedCatalogRevision:account.catalogRevision,definitionRevision:'plan-reflection-v1',accountId:account.record.id,strategyId:'long-stock',economicTime:'2026-10-17T20:00:00Z',plan:{instrument:{kind:'Stock',symbol:'XYZ',currency:'USD'},quantity:'100',entry:'50',stop:'45',target:'60'},reflection:{thesis:'Historical thesis',invalidation:'Historical invalidation'}});
    if(confirmed.status!=='Confirmed')throw new Error('Legacy Plan');
    return { root:await store.roots.get('active'),confirmed,versions:await store.versions.toArray(),lifecycle:await store.lifecycle.toArray() };
  } finally {store.close();}
} };
`);
await build({ configFile: false, define: { __RELEASE_ID__: JSON.stringify(releaseId) }, build: { lib: { entry: '.cache/d1-source/native-entry.ts', formats: ['iife'], name: 'D2LegacyFixture', fileName: () => 'legacy.js' }, outDir: '.cache/d2-legacy-native', emptyOutDir: true } });
