import test from 'node:test';
import assert from 'node:assert/strict';
import {clean,backup,csv,parseCSV,distance,loss,fresnel,stats,trials,kinds} from '../domain.js';
test('valid coordinates and counts',()=>{
 assert.throws(()=>clean('logs',{name:'x',lat:1}),/latitude/);
 assert.throws(()=>clean('logs',{name:'x',sent:2,received:3}),/between/);
 assert.throws(()=>clean('logs',{name:'x',sent:2,received:1.2}),/Invalid/);
 assert.equal(clean('logs',{name:'x',lat:0,lon:0,received:0}).received,0);
});
test('RF calculations in km, MHz, metres and dB',()=>{
 assert.ok(Math.abs(distance({lat:0,lon:0},{lat:0,lon:1})-111.195)<.002);
 assert.ok(Math.abs(loss(1,915)-91.67)<.02);
 assert.ok(Math.abs(fresnel(1,915)-9.05)<.02);
 assert.equal(loss(0,915),null);
});
test('packet rate excludes unknown windows',()=>{
 const a=stats([{sent:3,received:2,rssi:-110},{sent:1,received:0,rssi:-90},{sent:null,received:22}]);
 assert.equal(a.rate,.5);assert.equal(a.rssi,-100);
});
test('trials require both directions and a human receipt',()=>{
 const a={type:'message',anchor:'a',site:'b',pair:'p',session:'s',rf:true,sent:1,received:1,human:'yes'};
 assert.equal(trials([{...a,direction:'forward'}])[0].pass,false);
 assert.equal(trials([{...a,direction:'forward'},{...a,direction:'reverse',human:'no'}])[0].pass,false);
 assert.equal(trials([{...a,direction:'forward'},{...a,direction:'reverse'}])[0].pass,true);
});
test('CSV escapes cells, preserves a logged miss and keeps imported data unverified',()=>{
 const row=clean('logs',{name:'=1+1',notes:'line 1\n"two"',lat:0,lon:0,sent:4,received:0});
 assert.deepEqual(parseCSV(csv([row]))[0],row);
 const packet=parseCSV('from,rx lat,rx long,snr,payload\nCS01,35,-78,-8,seq 7')[0];
 assert.equal(packet.lat,35);assert.equal(packet.lon,-78);assert.equal(packet.sent,null);assert.equal(packet.rf,false);
 const position=parseCSV('latitude,longitude\n35,-78','position')[0];
 assert.equal(position.received,null);assert.equal(position.time,'');
 assert.throws(()=>parseCSV('from,payload\n"open'),/Unclosed/);
});
test('backup validates and restores',()=>{
 const blank={schema:1,...Object.fromEntries(kinds.map(k=>[k,[]]))};
 assert.deepEqual(backup(blank),blank);
 assert.throws(()=>backup({...blank,logs:[{name:'a',id:'x'},{name:'b',id:'x'}]}),/duplicate/);
 assert.throws(()=>backup({...blank,schema:2}),/version/);
});
