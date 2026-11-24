export const protocolName = protocol => protocol === 'meshcore' ? 'MeshCore' : protocol === 'unknown' ? 'Unclassified' : 'Meshtastic';
export const fleet = [
 {id:'ck88',name:'CK88',model:'SenseCAP MeshTracker X1',protocol:'meshtastic',required:true},
 {id:'dk88',name:'DK88',model:'SenseCAP MeshTracker X1',protocol:'meshtastic',required:true},
 {id:'cs01',name:'CS01',model:'SenseCAP Solar Node P1-Pro',protocol:'meshtastic',required:true}
];
export const phones = [{id:'iphone-own',name:'My iPhone'},{id:'iphone-wife',name:'My wife’s iPhone'}];
export const levels = ['Unprepared','Software Ready','Recovery Ready','Offline Ready','Operationally Ready','Field Proven'];
export const phases = ['Prepare both iPhones','Collect firmware and software','Protect the existing network','Verify software and hardware','Build the permanent archive','Rehearse and validate'];
export const taskScopes = [phones,phones,null,fleet,fleet,null,fleet,null,null,null];
export const targetRoles = {
 'SenseCAP MeshTracker X1':['Bluetooth Companion','USB Companion','Repeater','Room Server','Erase image','Bootloader'],
 'SenseCAP Solar Node P1-Pro':['Bluetooth Companion','USB Companion','Repeater','Room Server','Erase image','Bootloader'],
 'Wio Tracker L1 Pro':['Bluetooth Companion','Erase image'],
 'Elecrow ThinkNode M1':['Bluetooth Companion','USB Companion','Repeater','Room Server'],
 'Heltec V4':['Bluetooth Companion','USB Companion','Repeater','Room Server'],
 'LILYGO T-Deck Plus':['Standalone client']
};
export const hashPattern = /^[a-f0-9]{64}$/i;
const words = (value, length=220) => typeof value==='string' ? value.trim().slice(0,length) : '';
const date = value => typeof value==='string' && /^\d{4}-\d\d-\d\d/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : '';
const pick = (raw, keys) => Object.fromEntries(keys.split(' ').map(key=>[key,words(raw[key],key==='notes'||key==='evidence'?1200:220)]));
const url = value => {
 try {const parsed=new URL(value);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash?parsed.href:'';} catch{return '';}
};
export const taskKey = (n,scope='lab') => 'task:'+n+':'+scope;
export const hasFirmware = (row, files) => Boolean(files.has(row.id) && hashPattern.test(row.actual) && row.expected===row.actual);
export const expired = (value,days,now=Date.now()) => !date(value)||Date.parse(value)>now||now-Date.parse(value)>days*86400000;
export async function digest(file) {
 if(file.size>32*1024*1024)throw Error('Choose a firmware file up to 32 MiB. Keep larger release bundles on your external drive.');
 if(!file.size)throw Error('The selected file is empty.');
 const bytes=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
 return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
}
export const firmwareRoles = (model, protocol) => protocol==='meshtastic'?['Application firmware','Erase image']:protocol==='meshcore'?targetRoles[model]||[]:[];
export function sanitizeReadiness(raw, restoring=false){
 if(!raw||typeof raw!=='object')throw Error('Invalid readiness record.');
 const id=words(raw.id,80), kind=raw.kind;
 if(!id)throw Error('Missing readiness record ID.');
 const base={id,kind};
 if(kind==='cursor')return {...base,tab:words(raw.tab,24),task:words(raw.task,80),step:Math.max(0,Math.min(40,Number(raw.step)||0))};
 if(kind==='task'){
  if(!/^task:(?:[1-9]|10):[\w-]+$/.test(id))throw Error('Invalid task ID.');
  return {...base,status:['done','blocked','na','active'].includes(raw.status)?raw.status:'active',steps:Array.from({length:40},(_,i)=>Number.isInteger(raw.steps?.[i])?raw.steps[i]:null).filter(i=>i>=0&&i<40&&i!==null),...pick(raw,'notes evidence reason'),verified:date(raw.verified)};
 }
 if(kind==='device')return {...base,...pick(raw,'name model revision protocol firmware longName shortName role region preset slot frequency tx hop channels gps bluetooth power security mqtt modules antenna issues'),links:raw.links===true,screens:raw.screens===true,exported:raw.exported===true,identity:raw.identity===true,communication:date(raw.communication),restored:date(raw.restored),history:Array.isArray(raw.history)?raw.history.slice(-25).map(v=>({time:date(v.time),event:words(v.event)})):[]};
 if(kind==='firmware'){
  const fields=pick(raw,'model revision device protocol role version filename bootloader erase rollback instructions provenance');
  if(!firmwareRoles(fields.model,fields.protocol).includes(fields.role))throw Error('Choose a supported role for this hardware and protocol.');
  return {...base,...fields,source:url(raw.source),release:date(raw.release),size:Math.max(0,Number(raw.size)||0),expected:hashPattern.test(raw.expected)?raw.expected.toLowerCase():'',actual:!restoring&&hashPattern.test(raw.actual)?raw.actual.toLowerCase():'',downloaded:raw.downloaded===true,result:raw.result==='passed'?'passed':'',tested:date(raw.tested)};
 }
 if(kind==='equipment')return {...base,...pick(raw,'name category protocol price battery processor chipset frequency connector replaceable gps display standalone phone weather install recovery pros cons purchase location notes'),source:url(raw.source),quantity:Math.max(0,Math.min(999,Math.trunc(Number(raw.quantity)||0))),available:raw.available===true,tested:date(raw.tested)};
 if(kind==='validation')return {...base,...pick(raw,'protocol outcome evidence session'),verified:date(raw.verified)};
 if(kind==='archive')return {...base,...pick(raw,'location evidence'),verified:date(raw.verified)};
 throw Error('Unknown readiness record type.');
}
export const validation = [
 ['direct','Direct delivery','At a parked bench, switch both phones to airplane mode then turn Bluetooth back on. With compatible radios online locally, send D01 and reply D01. Verify each person reads the original text and record both directions.','Both phones display the actual text and each endpoint receives the reply.'],
 ['ack','Radio acknowledgements','Send an individually addressed message A01. Wait for the app’s delivery indicator, then separately ask the other person to read the text. Record whether both indicators arrived.','Recipient acknowledgement and verified human receipt are recorded separately.'],
 ['private','Private communications','Create a fresh private test channel in the native app. Share the invitation privately with the other phone. Send P01 and reply. Repeat with a third test client that has no invitation if available.','Both authorized phones read the message. Record the third-client result if tested.'],
 ['discover','Repeater discovery','At the bench, start one confirmed repeater and a companion. Send a zero-hop advert from the repeater console. On the companion, open Contacts/Repeaters and inspect the new entry.','The expected repeater name and public identifier agree with bench records.'],
 ['admin','Repeater administration','Open the discovered repeater in the companion app. Authenticate with the password saved outside this dashboard. Request status and compare the reply with USB serial.','Authorized read-only status returns from the intended repeater.'],
 ['relay','Repeater routing','At parked endpoints where the direct test fails repeatedly, send ten numbered messages each way with the repeater on. Repeat with it off only if yours and safe to access. Record the path displayed and any other repeaters.','Messages reach the endpoints with demonstrated dependence on the planned repeater. Uncontrolled alternate paths stay unverified.'],
 ['offline','No internet','Disable cellular and Wi-Fi on both phones and the test laptop. Re-enable Bluetooth. Confirm an internet page fails, then send an addressed message each way.','Each person reads the other’s message while all participating clients are offline.'],
 ['mqtt','No MQTT','On each participating Meshtastic radio inspect Module Configuration → MQTT and relevant channel uplink/downlink. Record original settings and disable bridging for the test. Recheck afterwards. For MeshCore use an RF-only session and mark MQTT inapplicable.','The test logs show RF isolation and no internet bridge used.'],
 ['battery','Battery operation','Unplug bench USB power and run the agreed messaging window on battery. Record start/end readings and any shutdown.','Both endpoints receive messages throughout the planned battery window.'],
 ['solar','Solar endurance','With the enclosure safely installed and sealed, log battery at the same time each day for the planned endurance window. Include overnight and low-sun conditions and send a check-in each day.','Recorded minimum reserve and delivery meet the threshold and duration agreed before the test.'],
 ['restart','Restart and retention','Restart one unit at a time using its normal power control. Reconnect the native app or serial console. Read back name, role and regional settings, then retry a message.','Configuration persists and the device resumes communications.'],
 ['range','Progressive range','Save an anchor in Relay Planner. From safe parked stops, repeat the same numbered packet count, antenna orientation and settings. Log both misses and successes.','Each stop has coordinates or a named site, a time, total sent and received, and path classification.'],
 ['cary','Clayton–Cary drill','Agree on a time, powered fallback and identifiers. Save Clayton as an anchor and Cary as a destination. Log both directions under one session and trial ID with radio isolation, path and human readback.','Both directions meet the planned delivery target with the same protocol and controlled route.'],
 ['rollback','Meshtastic rollback','On the spare or selected unit, use the board/version-specific return procedure saved with the matching application and any required erase. Reopen Meshtastic and read the firmware version.','Radio boots the intended known-good build and can connect locally.'],
 ['restore','Configuration restore','Restore the selected radio from its own secure export. Check channel order, identity and admin compatibility through appropriate private checks; restore omitted credentials separately.','Saved settings match the radio and required credentials work.'],
 ['returned','Post-rollback communications','Repeat the two-direction test with a still-Meshtastic peer and no internet. Test the family channel and confirm the pre-test MQTT and power policy afterward.','Both humans read and reply and expected settings are restored.']
];
export function readinessState(records,fileIds,logs,trials,guide,now=Date.now()){
 const byId=new Map(records.map(record=>[record.id,record]));
 const files=new Set(fileIds);
 const status=(task,target)=>byId.get(taskKey(task,target));
 const scopes=n=>[4,5,7].includes(n)
  ?[...fleet,...records.filter(r=>r.kind==='device'&&!fleet.some(d=>d.id===r.id))]
  :taskScopes[n-1]||[{id:'lab',name:''}];
 const instructions=(task,n,scope)=>n===7&&!scope.required?[
  'Find the exact board and revision in the manufacturer’s recovery instructions. Save the firmware-mode and exit procedure offline.',
  'Connect just this radio with a known data cable. Follow the documented button or USB sequence and record the exact drive or device identifier.',
  'Leave the bootloader untouched. Follow the original recovery guide to exit and confirm the original firmware, settings and local communications.'
 ]:task.steps;
 const tasks=guide.flatMap((task,i)=>scopes(i+1).map(scope=>({...task,steps:instructions(task,i+1,scope),n:i+1,scope,record:status(i+1,scope.id)})));
 const complete=(n,id='lab')=>{
  const r=status(n,id);
  return Boolean(r?.status==='done'&&r.evidence&&tasks.find(t=>t.n===n&&t.scope.id===id)?.steps.every((_,i)=>r.steps?.includes(i))&&!expired(r.verified,guide[n-1].interval||365,now));
 };
 const verified=records.filter(r=>r.kind==='firmware'&&hasFirmware(r,files));
 const firmware=(d,protocol,role)=> {
  const profile=byId.get(d.id);
  return verified.some(r=>r.device===d.id&&r.model===d.model&&r.protocol===protocol&&r.role===role&&r.version&&r.source&&r.provenance&&profile?.revision&&r.revision===profile.revision&&(protocol!=='meshtastic'||role!=='Application firmware'||r.version===profile.firmware));
 };
 const migrationRole=d=>d.id==='cs01'?'Repeater':'Bluetooth Companion';
 const hasRollback=d=>firmware(d,'meshtastic','Application firmware')&&verified.some(r=>{
  const profile=byId.get(d.id);
  if(r.device!==d.id||r.revision!==profile?.revision||r.protocol!=='meshtastic'||r.role!=='Application firmware'||r.version!==profile?.firmware||!r.instructions.trim())return false;
  return /^no erase required$/i.test(r.erase)||verified.some(e=>e.device===d.id&&e.model===d.model&&e.revision===r.revision&&e.protocol==='meshtastic'&&e.role==='Erase image'&&e.filename&&e.filename===r.erase);
 });
 const hasForward=d=>firmware(d,'meshcore',migrationRole(d))&&verified.some(r=>r.device===d.id&&r.model===d.model&&r.revision===byId.get(d.id)?.revision&&r.protocol==='meshcore'&&r.role==='Erase image'&&r.source&&r.provenance);
 const prepared=fleet.filter(d=>{
  const r=byId.get(d.id);
  return complete(4,d.id)&&complete(5,d.id)&&hasRollback(d)&&r?.screens&&r.links&&r.exported&&r.identity;
 });
 const checkValidation=(key,p='meshcore')=>{
  const r=byId.get('validation:'+p+':'+key);
  return r?.outcome==='pass'&&r.evidence&&!expired(r.verified,30,now);
 };
 const siteTrials=trials(logs).filter(t=>t.pass&&t.rows.every(r=>r.control&&r.internet==='offline'&&r.path!=='unknown'&&r.origin!=='modeled'&&r.origin!=='position'&&!expired(r.time,30,now)));
 const hasRoute=p=>siteTrials.some(t=>{
  const r=t.rows[0];
  const left=r.anchorName||'',right=r.siteName||'';
  return (r.protocol||'meshtastic')===p&&[left,right].some(n=>/clayton/i.test(n))&&[left,right].some(n=>/cary/i.test(n));
 });
 const gates=[
  [[phones.every(d=>complete(1,d.id)),'Install required applications on both iPhones'],[complete(3),'Build and check the offline firmware kits'],[complete(6),'Verify software and offline installers on Windows'],[fleet.every(hasForward),'Attach matching, checksum-matched MeshCore firmware and erase files for every target']],
  [[prepared.length===fleet.length,'Confirm all four backup checks and attach the installed-version rollback firmware for each radio']],
  [[phones.every(d=>complete(2,d.id)),'Test both iPhones without internet'],[fleet.every(d=>complete(7,d.id)),'Verify safe bootloader access separately for each radio'],[complete(8)&&['Windows laptop','External SSD or USB drive','My iPhone','My wife’s iPhone','Printed instructions'].every(name=>records.some(r=>r.kind==='archive'&&r.location===name&&r.evidence&&!expired(r.verified,90,now))),'Open and verify each archive copy without internet']],
  [[complete(9),'Run a controlled offline MeshCore migration'],[complete(10),'Complete validation and restoration'],[['direct','ack','private','discover','admin','relay','offline','battery','restart','range'].every(k=>checkValidation(k))&&['rollback','restore','returned'].every(k=>checkValidation(k,'meshtastic')),'Record passing offline MeshCore and Meshtastic recovery tests']],
  [[hasRoute('meshcore')&&checkValidation('cary'),'Verify a recent, controlled offline MeshCore Clayton–Cary trial in Field Log']]
 ];
 let level=0;
 while(level<gates.length&&gates[level].every(([pass])=>pass))level++;
 const next=tasks.find(t=>!complete(t.n,t.scope.id)&&!['blocked','na'].includes(t.record?.status));
 const done=tasks.filter(t=>complete(t.n,t.scope.id)).length;
 return {level,label:levels[level],gates,blockers:gates[level]?.filter(([ok])=>!ok).map(([,message])=>message)||[],tasks,done,next,prepared:prepared.length,verified:verified.length,meshtasticRoute:hasRoute('meshtastic'),meshcoreRoute:hasRoute('meshcore'),last:records.map(r=>r.verified||r.tested||'').sort().at(-1)||'',complete};
}
