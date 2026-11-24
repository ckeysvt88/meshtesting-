import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fleet,phones,readinessState,sanitizeReadiness,taskKey,digest,validation} from '../readiness-model.js';
import {guide,archiveLocations} from '../readiness-guide.js';
import {clean,trials,backup,kinds,csv,parseCSV} from '../domain.js';

const verified='2026-11-24T10:00:00.000Z',now=Date.parse('2026-11-24T12:00:00.000Z'),hash='a'.repeat(64);
const done=(n,scope)=>({id:taskKey(n,scope),kind:'task',status:'done',verified,evidence:'Synthetic test record',steps:guide[n-1].steps.map((_,i)=>i)});
const fleetRows=fleet.flatMap(d=>{
 const app={kind:'firmware',device:d.id,model:d.model,revision:'R1',source:'https://example.com/release',provenance:'test fixture',version:'2.7',expected:hash,actual:hash};
 return [
 {id:d.id,kind:'device',firmware:'2.7',revision:'R1',screens:true,links:true,exported:true,identity:true},
 {...app,id:d.id+'-forward',protocol:'meshcore',role:d.id==='cs01'?'Repeater':'Bluetooth Companion'},
 {...app,id:d.id+'-erase',protocol:'meshcore',role:'Erase image'},
 {...app,id:d.id+'-back',protocol:'meshtastic',role:'Application firmware',erase:'No erase required',instructions:'Test fixture'}
 ];
});
const completeRecords=[...fleetRows,...phones.flatMap(d=>[done(1,d.id),done(2,d.id)]),...fleet.flatMap(d=>[done(4,d.id),done(5,d.id),done(7,d.id)]),done(3),done(6),done(8),done(9),done(10),
 ...archiveLocations.map((location,i)=>({id:'archive:'+i,kind:'archive',location,evidence:'Fixture',verified})),
 ...validation.map(([key])=>({id:'validation:'+(['rollback','restore','returned'].includes(key)?'meshtastic':'meshcore')+':'+key,kind:'validation',outcome:'pass',evidence:'Fixture',verified}))];
const files=fleetRows.filter(r=>r.kind==='firmware').map(r=>r.id);
const compute=(records=completeRecords,fileIds=files,logs=[])=>readinessState(records,fileIds,logs,trials,guide,now);
test('readiness maturity depends on required records, local bytes, separate devices and dates',()=>{
 assert.equal(compute([],[]).level,0);
 assert.equal(compute(completeRecords,[]).level,0);
 assert.equal(compute(completeRecords,files.filter(x=>x!=='cs01-erase')).level,0);
 assert.equal(compute(completeRecords.filter(r=>r.id!=='dk88-back')).level,1);
 assert.equal(compute(completeRecords.map(r=>r.id==='dk88'?{...r,identity:false}:r)).level,1);
 assert.equal(compute(completeRecords.map(r=>r.id===taskKey(7,'cs01')?{...r,status:'na'}:r)).level,2);
 assert.equal(compute(completeRecords.map(r=>r.id===taskKey(7,'cs01')?{...r,verified:'2025-05-01'}:r)).level,2);
 assert.equal(compute(completeRecords.filter(r=>r.id!=='validation:meshtastic:restore')).level,3);
 assert.equal(compute().level,4);
});
test('field proof needs controlled offline evidence from the same protocol in both directions',()=>{
 const base={name:'Synthetic test record',time:verified,type:'message',session:'test',pair:'1',anchor:'clay',site:'cary',sent:1,received:1,rf:true,control:true,path:'direct',human:'yes',internet:'offline'};
 const forward={...clean('logs',{...base,protocol:'meshcore'}),anchorName:'Clayton',siteName:'Cary'};
 const reverse={...forward,direction:'reverse'};
 assert.equal(compute(completeRecords,files,[forward,{...reverse,protocol:'meshtastic'}]).level,4);
 assert.equal(compute(completeRecords,files,[forward,{...reverse,internet:'assisted'}]).level,4);
 assert.equal(compute(completeRecords,files,[forward,reverse]).level,5);
});
test('Web Crypto matches reference SHA-256 and a metadata restore clears verification claims',async()=>{
 const bytes=new Blob(['test fixture']);
 assert.equal(await digest(bytes),createHash('sha256').update('test fixture').digest('hex'));
 const r=sanitizeReadiness({...fleetRows.find(x=>x.kind==='firmware'),actual:hash,privateKey:'do not retain'},true);
 assert.equal(r.actual,'');
 assert.ok(!('privateKey' in r));
 const original=Object.fromEntries(kinds.filter(k=>k!=='readiness').map(k=>[k,[]]));
 assert.deepEqual(backup({schema:1,...original}).readiness,[]);
});
test('MeshCore observations retain their own path metadata through CSV and exclude Meshtastic hops',()=>{
 const row=clean('logs',{name:'Fixture',protocol:'meshcore',hops:3,routeDetails:'test path',testDistance:1.23,dataSource:'manual entry',internet:'offline',mqtt:'on',antenna:'Stock',sent:4,received:3,acks:2});
 const [copy]=parseCSV(csv([row]));
 assert.equal(copy.hops,null);assert.equal(copy.mqtt,'na');assert.equal(copy.routeDetails,'test path');assert.equal(copy.testDistance,1.23);assert.equal(copy.dataSource,'manual entry');assert.equal(copy.acks,2);
});
