import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import assert from 'node:assert/strict';
const out = new URL('./',import.meta.url).pathname;
const observations=[]; const consoles=[]; const profiles='/private/tmp/d02-critic01-keyboard03';
const write=async(name,data)=>fs.writeFile(out+name,JSON.stringify(data,null,2));
let context;
async function launch(offline=false){
 context=await chromium.launchPersistentContext(profiles,{channel:'chrome',headless:true,viewport:{width:1440,height:1050},offline});
 await context.addInitScript(()=>{
  window.criticTrace=[];window.criticFault='';
  const transact=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(...args){
   const tx=transact.apply(this,args); const rec={event:'entry',db:this.name,stores:[...tx.objectStoreNames],mode:tx.mode,time:performance.now()};window.criticTrace.push(rec);
   tx.addEventListener('complete',()=>window.criticTrace.push({...rec,event:'complete',time:performance.now()}));
   tx.addEventListener('abort',()=>window.criticTrace.push({...rec,event:'abort',time:performance.now()}));
   return tx;
  };
  const match=Cache.prototype.match;
  Cache.prototype.match=async function(...args){if(window.criticFault==='inventory')throw new Error('Critic isolated inventory boundary');return match.apply(this,args)};
  const getAll=IDBObjectStore.prototype.getAll;
  IDBObjectStore.prototype.getAll=function(...args){if(window.criticFault==='list'&&this.name==='lifecycle')throw new Error('Critic isolated list boundary');return getAll.apply(this,args)};
  const estimate=navigator.storage.estimate.bind(navigator.storage);
  navigator.storage.estimate=async()=>{if(window.criticBarrier)await new Promise(r=>window.releaseCriticBarrier=r);return estimate()};
  new MutationObserver(()=>{const t=document.body?.innerText??'';for(const phrase of ['Initial Position Change saved.','Journal Debt settled.'])if(t.includes(phrase)&&!window.criticTrace.some(e=>e.event===phrase))window.criticTrace.push({event:phrase,time:performance.now()});}).observe(document,{subtree:true,childList:true});
 });
 context.on('page',bind);for(const p of context.pages())bind(p);
 return context.pages()[0]??await context.newPage();
}
function bind(p){p.on('console',m=>consoles.push({type:m.type(),text:m.text()}));p.on('pageerror',e=>consoles.push({type:'pageerror',text:e.message}));}
async function shot(p,name){await p.screenshot({path:out+name+'.png',fullPage:true});await fs.writeFile(out+name+'.txt',await p.locator('body').innerText());}
async function obs(name,detail){observations.push({name,time:new Date().toISOString(),...detail});await write('focus-observations.json',observations);}
async function snapshot(p,name){const value=await p.evaluate(async()=>{const names=await indexedDB.databases();const db=await new Promise((res,rej)=>{const r=indexedDB.open(names.find(n=>n.name&&!n.name.includes('workbox'))?.name);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});const tx=db.transaction(['roots','versions','lifecycle'],'readonly');const data=await Promise.all(['roots','versions','lifecycle'].map(s=>new Promise((res,rej)=>{const r=tx.objectStore(s).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})));db.close();return {databases:names,roots:data[0],versions:data[1],lifecycle:data[2]};});await write(name+'.json',value);return value;}
async function click(p,name){await p.getByRole('button',{name,exact:true}).click();}
async function plan(p,symbol){await click(p,'New Plan');for(const [name,value] of [['Stock symbol',symbol],['Quantity (shares)','100'],['Intended entry (USD)','50'],['Stop (underlying price, USD)','45'],['Target (underlying price, USD)','60'],['Why this trade, why now?','Critic independent thesis'],['What would invalidate the thesis?','Below original stop']])await p.getByLabel(name,{exact:true}).fill(value);await click(p,'Confirm Plan');await p.getByRole('heading',{name:symbol+' · Planned',exact:true}).waitFor();}
async function opening(p,kind='Complete'){await click(p,'Record initial Position Change');await p.getByLabel('Execution 1 quantity (shares)',{exact:true}).fill('40');await p.getByLabel('Execution 1 price (USD)',{exact:true}).fill('49');await p.getByLabel('Execution 1 fee (USD)',{exact:true}).fill('1');await click(p,'Add Execution');await p.getByLabel('Execution 2 quantity (shares)',{exact:true}).fill('60');await p.getByLabel('Execution 2 price (USD)',{exact:true}).fill('51');await p.getByLabel('Execution 2 fee (USD)',{exact:true}).fill('2');await p.getByRole('radio',{name:kind==='Complete'?'Complete reflection now':kind==='Defer'?'Defer reflection as Journal Debt':'Decline reflection',exact:true}).check();if(kind==='Complete')await reflection(p);}
async function reflection(p){await p.getByRole('radio',{name:'As Planned',exact:true}).check();await p.getByRole('radio',{name:'Calm',exact:true}).check();await p.getByRole('combobox',{name:/^Decision confidence/}).selectOption('4');await p.getByRole('textbox',{name:/^Note/}).fill('Independent critic reflection');}
const keys=[];
async function tabTo(p,loc){await loc.waitFor();for(let i=0;i<140;i++){if(await loc.evaluate(e=>e===document.activeElement)){keys.push({name:await loc.getAttribute('aria-label')??await loc.textContent(),tag:await loc.evaluate(e=>e.tagName)});return;}await p.keyboard.press('Tab');}throw Error('Keyboard target not reached: '+await loc.count());}
async function keyClick(p,name){const l=p.getByRole('button',{name,exact:true});await tabTo(p,l);await p.keyboard.press('Enter');}
async function keyFill(p,name,value){const l=p.getByRole('textbox',{name:typeof name==='string'?new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')):name});await tabTo(p,l);await p.keyboard.press('Meta+A');await p.keyboard.type(value);}
async function keyRadio(p,name){const l=p.getByRole('radio',{name,exact:true});const group=l.locator('xpath=ancestor::fieldset[1]');const checked=group.getByRole('radio',{checked:true});await tabTo(p,await checked.count()?checked:group.getByRole('radio').first());for(let i=0;i<20;i++){if(await l.isChecked())return;await p.keyboard.press('ArrowRight');}throw Error('Radio cannot select '+name);}
async function keySelect(p,name,n){const l=p.getByRole('combobox',{name:new RegExp('^'+name)});await tabTo(p,l);await p.keyboard.type(String(n));await p.keyboard.press('Tab');assert.equal(await l.inputValue(),String(n));}
async function keyPlan(p,symbol){await keyClick(p,'New Plan');for(const [label,v] of [['Stock symbol',symbol],['Quantity (shares)','100'],['Intended entry (USD)','50'],['Stop (underlying price, USD)','45'],['Target (underlying price, USD)','60'],['Why this trade, why now?','Keyboard thesis'],['What would invalidate the thesis?','Keyboard invalidation']])await keyFill(p,label,v);await keyClick(p,'Confirm Plan');await p.getByRole('heading',{name:symbol+' · Planned',exact:true}).waitFor();}
async function keyAnswers(p){await keyRadio(p,'As Planned');await keyRadio(p,'Calm');await keySelect(p,'Decision confidence',4);await keyFill(p,/^Note/,'Keyboard retained reflection');}
async function keyOpen(p,kind){await keyClick(p,'Record initial Position Change');for(const [l,v] of [['Execution 1 quantity (shares)','40'],['Execution 1 price (USD)','49'],['Execution 1 fee (USD)','1']])await keyFill(p,l,v);await keyClick(p,'Add Execution');for(const [l,v] of [['Execution 2 quantity (shares)','60'],['Execution 2 price (USD)','51'],['Execution 2 fee (USD)','2']])await keyFill(p,l,v);await keyRadio(p,kind==='Complete'?'Complete reflection now':kind==='Defer'?'Defer reflection as Journal Debt':'Decline reflection');if(kind==='Complete')await keyAnswers(p);await keyClick(p,'Save initial Position Change');await p.getByRole('heading',{name:/ · Open$/}).waitFor();}
try{const p=await launch();await p.goto('http://localhost:5174');await p.getByRole('heading',{name:'Trades',exact:true}).waitFor();await keyPlan(p,'KBFOCUS');await keyClick(p,'Record initial Position Change');await keyRadio(p,'Complete reflection now');await keyAnswers(p);for(const width of [390,1440]){await p.setViewportSize({width,height:1000});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.waitForTimeout(200);const text=p.getByRole('textbox',{name:/^Note/});await tabTo(p,text);await p.waitForTimeout(100);await p.screenshot({path:out+'focus-'+width+'-settled.png'});await write('focus-'+width+'-settled.json',await p.evaluate(()=>({active:document.activeElement?.outerHTML,rect:document.activeElement?.getBoundingClientRect().toJSON(),nav:document.querySelector('nav')?.getBoundingClientRect().toJSON(),scrollWidth:document.documentElement.scrollWidth,width:innerWidth,groups:[...document.querySelectorAll('fieldset')].map(e=>e.querySelector('legend')?.textContent)})));}await keyClick(p,'Cancel');}finally{await context?.close()}
