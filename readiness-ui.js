import {guide,sources,reviewed,archiveLocations,folders,migrationChecks,migrationQuick,inventory,equipmentCategories,candidates,antennaSteps} from './readiness-guide.js';
import {fleet,phases,levels,taskKey,firmwareRoles,targetRoles,hasFirmware,expired,validation,readinessState,sanitizeReadiness,protocolName,digest} from './readiness-model.js';
import {readFirmware,storeFirmware} from './db.js';
import {trials} from './domain.js';

const tabs={overview:'Overview',preparation:'Preparation',firmware:'Firmware Vault',backups:'Device Backups',archive:'Offline Archive',migration:'Migration',validation:'Validation',equipment:'Equipment'};
const definitions=['Dependent on online downloads','Required firmware, applications and utilities are staged','Configurations and exact rollback firmware are backed up','Files, apps and safe bootloader access were verified offline','Offline MeshCore migration and Meshtastic recovery passed','Communications passed at the intended operating locations'];
const deviceFields={name:'Node name',model:'Hardware model',revision:'Hardware revision',firmware:'Installed firmware',longName:'Long name',shortName:'Short name',role:'Role',region:'Region',preset:'Modem preset',slot:'Frequency slot',frequency:'Frequency / override',tx:'Transmit power',hop:'Hop limit',channels:'Channel labels and order',gps:'GPS and position',bluetooth:'Bluetooth options',power:'Power settings',security:'Security and admin metadata',mqtt:'MQTT status and bridge policy',modules:'Enabled modules',antenna:'Antenna and feed line',issues:'Active issues'};
const firmwareFields={model:'Exact hardware model',revision:'Hardware revision',version:'Firmware version',filename:'Filename',source:'Official HTTPS source URL',expected:'Reference SHA-256',provenance:'Digest source (publisher or local baseline)',bootloader:'Required bootloader',erase:'Exact erase filename or enter No erase required',rollback:'Rollback reference',instructions:'Offline installation instructions location'};
const equipmentFields={name:'Item',price:'Price / quote date',protocol:'Protocols',battery:'Battery capacity',processor:'Processor',chipset:'LoRa chipset',frequency:'Frequency / SKU',connector:'Connector',replaceable:'Replaceable antenna',gps:'GPS',display:'Display',standalone:'Standalone messaging',phone:'Phone dependency',weather:'Weather resistance',install:'Offline install',recovery:'Recovery difficulty',source:'Vendor HTTPS URL',pros:'Pros',cons:'Cons / open questions',purchase:'Purchase status',location:'Storage location',notes:'Notes'};
const kitLinks='<div class="actions"><a class="button" href="./kits/SenseCAP-X1-Offline-Kit-STARTER.zip" download>X1 starter ZIP</a><a class="button" href="./kits/SenseCAP-P1-Pro-Offline-Kit-STARTER.zip" download>P1-Pro starter ZIP</a></div>';
const statuses={active:'In progress',done:'Completed',blocked:'Blocked',na:'Not applicable'};
const protocolOptions=[['meshtastic','Meshtastic'],['meshcore','MeshCore']];
const dateValue=value=>value?.slice(0,10)||'';
const dateLabel=value=>value?new Date(value).toLocaleDateString(undefined,{timeZone:'UTC'}):'Never';
const csvCell=v=>'"'+String(v??'').replace(/^(?=[\s]*[=+@-]|[\t\r\n])/,"'").replaceAll('"','""')+'"';
const reportCSV=(columns,rows)=>[columns.map(csvCell).join(','),...rows.map(row=>columns.map(key=>csvCell(row[key])).join(','))].join('\r\n');

export function createReadiness(api){
 const {safe,block,options,download,status,persist,render,data}=api;
 let device='',firmware='',equipment='',printMode='',validationProtocol='meshcore',unlocked=false;
 const records=()=>data().readiness;
 const get=id=>records().find(r=>r.id===id);
 const items=kind=>records().filter(r=>r.kind===kind);
 const devices=()=>[...fleet.map(d=>({...d,...get(d.id)})),...items('device').filter(d=>!fleet.some(f=>f.id===d.id))];
 const model=()=>readinessState(records(),data().firmwareFiles.map(f=>f.id),data().logs.map(r=>({...r,anchorName:data().sites.find(s=>s.id===r.anchor)?.name,siteName:data().sites.find(s=>s.id===r.site)?.name})),trials,guide);
 const cursor=()=>get('readiness-cursor')||{tab:'overview',task:'',step:0};
 const set=async raw=>persist({readiness:[sanitizeReadiness(raw)]});
 const setCursor=patch=>set({id:'readiness-cursor',kind:'cursor',...cursor(),...patch});
 const link=(tab,label)=>'<button type="button" data-r-tab="'+tab+'">'+safe(label)+'</button>';
 const readDate=(name,label,v)=>'<label>'+safe(label)+'<input name="'+name+'" type="date" value="'+safe(dateValue(v))+'"></label>';
 const field=(key,label,v,type='text')=>'<label>'+safe(label)+'<input name="'+key+'" type="'+type+'" '+(type==='number'?'min="0" ':'')+'value="'+safe(v??'')+'"></label>';
 const select=(key,label,choices,value)=>'<label>'+safe(label)+'<select name="'+key+'">'+choices.map(([id,name])=>'<option value="'+safe(id)+'" '+(value===id?'selected':'')+'>'+safe(name)+'</option>').join('')+'</select></label>';
 const check=(name,label,value)=>'<label class="check"><input type="checkbox" name="'+name+'" '+(value?'checked':'')+'>'+safe(label)+'</label>';
 const area=(name,label,value)=>'<label>'+safe(label)+'<textarea name="'+name+'" maxlength="1200">'+safe(value)+'</textarea></label>';
 const fields=(defs,row)=>Object.entries(defs).filter(([k])=>k!=='model'&&k!=='notes').map(([k,n])=>field(k,n,row[k],k==='source'?'url':'text')).join('');
 const links=keys=>'<p class="muted">Sources reviewed '+reviewed+'. Open online or use your saved copy.</p><ul>'+keys.map(key=>'<li><a href="'+sources[key][1]+'" target="_blank" rel="noreferrer">'+safe(sources[key][0])+'</a></li>').join('')+'</ul>';
 const actions=html=>'<div class="actions">'+html+'</div>';
 const taskButton=(t,label)=>'<button type="button" class="primary" data-r-task="'+taskKey(t.n,t.scope.id)+'">'+safe(label)+'</button>';
 const tag=p=>'<span class="protocol '+(p==='meshcore'?'meshcore':'meshtastic')+'">'+protocolName(p)+'</span>';
 const listing=(headers,rows)=>'<div class="table"><table><thead><tr>'+headers.map(h=>'<th>'+safe(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(cols=>'<tr>'+cols.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 function home(){
  const s=model();
  return block('Emergency communications readiness','<p><strong>'+safe(s.label)+'</strong> · '+Math.round(100*s.done/s.tasks.length)+'% of tasks verified · '+s.prepared+'/'+fleet.length+' radios prepared · '+s.verified+' verified firmware files</p><p>'+safe(s.next?'Next: '+s.next.title+(s.next.scope.name?' · '+s.next.scope.name:''):'Review the remaining readiness prerequisites.')+'</p><p class="muted">'+s.blockers.length+' outstanding prerequisites for the next level</p><div class="actions"><button class="primary" type="button" data-r-resume>'+(s.done?'Resume preparation':'Start preparation')+'</button><button type="button" data-r-tab="overview">Readiness overview</button></div>');
 }
 function overview(s){
  const underway=s.tasks.find(t=>taskKey(t.n,t.scope.id)===cursor().task&&!s.complete(t.n,t.scope.id)&&!['blocked','na'].includes(t.record?.status))||s.next;
  return '<section class="panel hero"><p class="eyebrow">Preparation readiness · Level '+s.level+' of 5</p><h2>'+safe(s.label)+'</h2><p>'+safe(definitions[s.level])+'</p><p class="progress-label">'+s.done+' of '+s.tasks.length+' task records verified</p><progress max="'+s.tasks.length+'" value="'+s.done+'"></progress>'+actions(underway?taskButton(underway,(s.done||underway.record?'Resume: ':'Start: ')+underway.title):link('preparation','Review preparation'))+'</section>'+
  block('Next prerequisites',s.blockers.length?'<ul>'+s.blockers.map(b=>'<li>'+safe(b)+'</li>').join('')+'</ul>':'<p>All readiness gates currently pass.</p>')+
  block('Operational network evidence','<p>'+tag('meshtastic')+' '+(s.meshtasticRoute?'Recent controlled Clayton–Cary pass':'Clayton–Cary unverified')+'</p><p>'+tag('meshcore')+' '+(s.meshcoreRoute?'Recent controlled Clayton–Cary pass':'Clayton–Cary unverified')+'</p><p>'+s.prepared+' of '+fleet.length+' radios prepared · '+s.verified+' matching local firmware files · Last verification '+dateLabel(s.last)+'</p>'+actions(link('validation','Open validation')+'<button type="button" data-r-report="summary">Download readiness summary</button>'))+
  '<details class="panel"><summary>Readiness levels and verification rules</summary><ol start="0">'+levels.map((l,i)=>'<li><strong>'+safe(l)+'</strong> · '+safe(definitions[i])+'</li>').join('')+'</ol><p>Each level requires the previous level. Completed assignments require dated evidence and all listed steps. Blocked, skipped and expired assignments do not pass a critical gate.</p></details>';
 }
 function preparation(s){
  const current=s.tasks.find(t=>taskKey(t.n,t.scope.id)===cursor().task)||s.next||s.tasks[0];
  return taskPanel(current,s)+phases.map((p,i)=>{
   const group=s.tasks.filter(t=>t.phase===i),done=group.filter(t=>s.complete(t.n,t.scope.id)).length;
   return '<details class="panel" '+(current.phase===i?'open':'')+'><summary>'+safe(p)+' · '+done+'/'+group.length+'</summary><ul class="readiness-list">'+group.map(t=>{
    const id=taskKey(t.n,t.scope.id);
    const label=t.record?.status==='done'&&!s.complete(t.n,t.scope.id)?'Reverify':statuses[t.record?.status]||'Upcoming';
    return '<li><button type="button" data-r-task="'+id+'" '+(current===t?'aria-current="step"':'')+'>'+safe(t.title)+(t.scope.name?' · '+safe(t.scope.name):'')+'</button><span class="task-state '+safe(t.record?.status||'')+'">'+safe(label)+'</span></li>';
   }).join('')+'</ul></details>';
  }).join('')+actions('<button type="button" data-r-report="tasks">Download work list CSV</button>');
 }
 function taskPanel(t,s){
  const key=taskKey(t.n,t.scope.id),r=t.record||{status:'active',steps:[]};
  const index=Math.min(t.steps.length-1,cursor().task===key?cursor().step:0);
  const missionLocked=t.n===9&&s.level<3;
  const checkSteps=t.steps.map((description,i)=>{
   const shown=i===index;
   return '<details '+(shown?'open':'')+' data-r-step="'+i+'"><summary>'+String(i+1)+'. '+(r.steps.includes(i)?'Done':'Step instructions')+'</summary><p>'+safe(description)+'</p>'+
    '<label class="check"><input data-r-check="'+i+'" type="checkbox" '+(r.steps.includes(i)?'checked':'')+' '+(missionLocked?'disabled':'')+'> Step completed</label></details>';
  }).join('');
  return '<section class="panel read-task"><p class="eyebrow">Task '+t.n+' of 10'+(t.scope.name?' · '+safe(t.scope.name):'')+'</p><h2>'+safe(t.title)+'</h2><p>'+safe(t.purpose)+'</p>'+
  '<p class="read-warning">'+safe(t.warning)+'</p><details><summary>Equipment, prerequisites and troubleshooting</summary><p><strong>Equipment</strong> '+safe(t.kit)+'</p><p><strong>Estimated time</strong> '+safe(t.time)+'</p><p><strong>Before you start</strong> '+safe(t.needs)+'</p><p>'+safe(t.trouble)+'</p>'+links(t.refs)+'</details>'+
  (t.n===3?kitLinks:'')+(t.n===4?actions(link('backups','Open Device Backups')):'')+(t.n===5?actions(link('firmware','Open Firmware Vault')):'')+(t.n===8?actions(link('archive','Open archive copies')):'')+(t.n===9?actions(link('migration','Open migration preflight')):'')+(t.n===10?actions(link('validation','Open validation tests')):'')+
  '<form data-r-form="task" data-id="'+key+'">'+(missionLocked?'<p>Complete Offline Ready to open the controlled migration steps.</p>':t.n===9&&!unlocked?'<p>Complete the migration preflight to open the flashing steps.</p>':checkSteps)+
  '<div class="expect"><h3>How to tell it worked</h3><p>'+safe(t.expected)+'</p></div>'+
  area('notes','Notes (no credentials)',r.notes)+area('evidence','Evidence label or test result (no secrets)',r.evidence)+
  field('reason','Why blocked or not applicable?',r.reason)+
  '<p class="muted">Reverify every '+t.interval+' days. Last completed '+dateLabel(r.verified)+'.</p>'+
  actions('<button type="submit" value="done" class="primary">Mark verified</button><button type="submit" value="active">'+(r.status==='done'?'Reopen task':'Save notes')+'</button><button type="submit" value="blocked">Mark blocked</button><button type="submit" value="na">Not applicable</button>')+'</form></section>';
 }
 function vault(){
  const files=new Set(data().firmwareFiles.map(f=>f.id)),r=get(firmware)||{};
  const models=[...new Set([...devices().map(d=>d.model),...Object.keys(targetRoles)])].filter(Boolean);
  const chosen=r.model||devices().find(d=>d.id===r.device)?.model||models[0];
  return block('Firmware Vault','<p>Reference entries, downloaded files, attached browser copies, matching hashes and hardware passes have separate indicators. A locally established hash checks later integrity. It does not authenticate the original download.</p>'+
   listing(['Device / file','File and verification status','Actions'],items('firmware').map(f=>[
    safe(devices().find(d=>d.id===f.device)?.name||f.model)+' · '+tag(f.protocol)+'<br>'+safe(f.role+' · '+(f.filename||'Manifest only'))+(f.source?'<br><a href="'+safe(f.source)+'" target="_blank" rel="noreferrer">Download source</a>':''),
    safe([f.downloaded?'Downloaded':'Listed',files.has(f.id)?'Local copy available':'No local copy',f.actual&&f.expected&&f.actual!==f.expected?'SHA-256 mismatch':hasFirmware(f,files)?'SHA-256 matches':f.actual?'SHA-256 computed':'Hash not checked',f.result==='passed'?'Hardware pass '+dateLabel(f.tested):'Hardware untested'].join(' · ')),
    '<button data-r-select="firmware" data-id="'+safe(f.id)+'">Edit</button> '+(files.has(f.id)?'<button data-r-file="'+safe(f.id)+'">Save file</button> ':'')+'<button data-r-delete="'+safe(f.id)+'">Remove</button>'
   ]))+actions('<button data-r-select="firmware">New record</button><button data-r-report="firmware">Export firmware CSV</button>')+
   '<label>Import JSON manifest (metadata only)<input type="file" data-r-import="firmware" accept=".json"></label><details><summary>Firmware sources and preparation ZIPs</summary>'+kitLinks+links(['flasher','releases','mtrelease','mtflash'])+'</details>')+
  block(r.id?'Edit firmware record':'Add firmware record','<form data-r-form="firmware" data-id="'+safe(r.id||'')+'"><div class="grid">'+
   select('device','Associated device',[['','Unassigned'],...devices().map(d=>[d.id,d.name])],r.device)+
   select('model','Hardware model',models.map(m=>[m,m]),chosen)+
   select('protocol','Protocol',protocolOptions,r.protocol||'meshcore')+
   select('role','Supported firmware role',firmwareRoles(chosen,r.protocol||'meshcore').map(x=>[x,x]),r.role)+fields(firmwareFields,r)+
   readDate('release','Release date',r.release)+readDate('tested','Last hardware test',r.tested)+
   field('size','File size (bytes)',r.size||'','number')+
   '</div>'+check('downloaded','Downloaded to my own archive',r.downloaded)+check('passed','Tested and known-good on this hardware',r.result==='passed')+
   '<label>Attach firmware bytes (UF2, BIN, HEX or firmware ZIP, up to 32 MiB)<input name="binary" type="file" accept=".uf2,.bin,.hex,.zip"></label>'+
   '<p class="hint">Choose publisher firmware only. Keep sensitive configuration files on your own protected storage. Browser copies can be evicted and are excluded from JSON exports.</p>'+
   (r.actual?'<p>Actual SHA-256 <code class="long-code">'+safe(r.actual)+'</code></p>':'')+actions('<button class="primary">Save firmware record</button>')+'</form>');
 }
 function backups(s){
  const radios=devices(),r=radios.find(d=>d.id===device)||(device==='new'?{}:radios[0]);
  const firmwareRows=items('firmware'),fileIds=new Set(data().firmwareFiles.map(f=>f.id));
  return block('Radio recovery status','<p>Start with CK88. Save configuration files, channel QR codes and credentials on protected storage. Record metadata only here.</p>'+
   listing(['Radio','Installed firmware','Backup / rollback / bootloader','Last communications / restore'],radios.map(d=>{
    const rollback=firmwareRows.some(f=>f.device===d.id&&f.model===d.model&&f.revision&&f.revision===d.revision&&f.version&&f.version===d.firmware&&f.protocol==='meshtastic'&&f.role==='Application firmware'&&hasFirmware(f,fileIds));
    return ['<button data-r-select="device" data-id="'+safe(d.id)+'">'+safe(d.name)+'</button> '+tag(d.protocol),safe(d.firmware||'Read from device'),
     [d.screens,d.links,d.exported,d.identity].filter(Boolean).length+'/4 backups · '+(rollback?'Rollback staged':'Rollback missing')+' · '+(s.complete(7,d.id)?'Bootloader verified':'Bootloader pending')+(d.issues?'<br>'+safe(d.issues):''),
     dateLabel(d.communication)+' / '+dateLabel(d.restored)];
   }))+actions('<button data-r-select="device" data-id="new">Add device</button><button data-r-report="devices">Export device CSV</button><button data-r-report="backup-metadata">Export backup metadata JSON</button>')+
   '<label>Import backup metadata JSON<input type="file" data-r-import="device" accept=".json"></label>')+
  block(r.id?'Recovery record · '+r.name:'Add a recovery record','<form data-r-form="device" data-id="'+safe(r.id||'')+'"><div class="grid">'+field('model',deviceFields.model,r.model)+
   select('protocol','Current protocol',protocolOptions,r.protocol||'meshtastic')+fields(deviceFields,r)+readDate('communication','Last communication test',r.communication)+readDate('restored','Last restoration test',r.restored)+'</div>'+
   check('screens','Screenshots saved securely',r.screens)+check('links','Channel backup saved securely',r.links)+check('exported','Full configuration export saved securely',r.exported)+check('identity','Identity and admin recovery plan verified privately',r.identity)+
   actions('<button class="primary">Save backup metadata</button>')+'</form>'+
   (r.id?actions([4,5,7].map((n,i)=>'<button type="button" data-r-task="'+taskKey(n,r.id)+'">'+['Backup steps','Rollback steps','Bootloader steps'][i]+'</button>').join('')):'')+
   (r.history?.length?'<details><summary>History</summary><ul>'+r.history.slice().reverse().map(h=>'<li>'+dateLabel(h.time)+' · '+safe(h.event)+'</li>').join('')+'</ul></details>':''));
 }
 function archive(){
  return block('Permanent offline archive','<ol>'+folders.map((f,i)=>'<li>'+String(i+1).padStart(2,'0')+' - '+safe(f)+'</li>').join('')+'</ol><p>Keep a protected location for private configurations and a separate copy outside iOS browser storage. iOS may evict local browser data. The local coordinate map and preparation guide run from the app cache after an initial online load.</p>'+actions('<button data-r-storage>Check local storage</button><button data-r-report="archive">Export archive verification</button>')+'<output data-r-storage-result></output>')+
   block('Open each copy offline',archiveLocations.map((name,i)=>{
    const id='archive:'+i,r=get(id)||{};
    return '<details><summary>'+safe(name)+' · '+(r.verified&&!expired(r.verified,90)?'Verified '+dateLabel(r.verified):'To verify')+'</summary><form data-r-form="archive" data-id="'+id+'"><input type="hidden" name="location" value="'+safe(name)+'">'+readDate('verified','Offline check date',r.verified)+area('evidence','Files opened or paper copy checked',r.evidence)+actions('<button class="primary">Save copy check</button>')+'</form></details>';
   }).join(''));
 }
 function printable(){
  const quick='<ol>'+migrationQuick.map(x=>'<li>'+safe(x)+'</li>').join('')+'</ol>';
  const beginner=[7,8,9].map(i=>'<section><h2>'+safe(guide[i].title)+'</h2><p>'+safe(guide[i].warning)+'</p><ol>'+guide[i].steps.map(x=>'<li>'+safe(x)+'</li>').join('')+'</ol><p>'+safe(guide[i].expected)+'</p></section>').join('');
  return '<article class="read-print"><h1>Emergency communications · '+(printMode==='quick'?'Quick reference':'Beginner walkthrough')+'</h1><p>Prepared for CK88, DK88 and CS01. Source review '+reviewed+'. Stop before erasing if a verified recovery file, backup, bench setup or alternate communications method is missing. Fill in exact file versions and alternate contact method before printing.</p><p>Alternate contact: ____________________ · Archive location: ____________________</p>'+quick+(printMode==='full'?beginner:'')+
  '<h2>Device references</h2><ul>'+devices().map(d=>'<li>'+safe(d.name)+' · '+safe(d.model)+' · Installed '+safe(d.firmware||'________')+' · Revision '+safe(d.revision||'________')+'</li>').join('')+'</ul><h2>Saved firmware references</h2><ul>'+items('firmware').map(f=>'<li>'+safe([f.model,f.role,f.version,f.filename,f.expected,f.erase,f.instructions].filter(Boolean).join(' · '))+'</li>').join('')+'</ul></article>';
 }
 function migration(s){
  return block('Controlled migration preflight','<p class="read-warning"><strong>Erasing deletes settings.</strong> Use a spare first. Keep your working Meshtastic radios available and use bench power. Wait until you can safely reach CS01.</p>'+
   '<p>'+tag('meshtastic')+' '+tag('meshcore')+' The protocols cannot exchange LoRa messages with each other.</p>'+
   (s.level<3?'<p>Reach Offline Ready to enable guided flashing steps. Current level: '+safe(s.label)+'.</p>':
   '<form data-r-form="preflight">'+migrationChecks.map((label,i)=>'<label class="check"><input type="checkbox" name="confirm'+i+'" required>'+safe(label)+'</label>').join('')+actions('<button class="primary">Open controlled migration steps</button>')+'</form>')+
   '<p>Print after completing preflight and annotating the exact asset filenames and recovery plan. Save with the device guides.</p>'+actions('<button data-r-print="quick">Print quick reference</button><button data-r-print="full">Print beginner walkthrough</button>')+
   '<details><summary>Board and regional references</summary>'+links(['x1','solar','commands','flasher','fcc'])+'</details>')+
   (unlocked?block('Bench sequence',printable()):'');
 }
 function validate(){
  return block('Validation results','<p>Perform the tests on hardware and enter real observations. A pass requires a dated result and evidence. Use Field Log for measured packets and Coverage Map for saved locations.</p>'+actions('<a class="button" href="#field">Open Field Log</a><a class="button" href="#map">Open Coverage Map</a><button data-r-report="validation">Export validation CSV</button>')+
   '<label>Validation protocol<select data-r-validation>'+options(protocolOptions.map(([id,label])=>[id,label])).replace('value="'+validationProtocol+'"','value="'+validationProtocol+'" selected')+'</select></label>')+
   validation.map(([key,title,how,result])=>{
    const id='validation:'+validationProtocol+':'+key,r=get(id)||{};
    return '<details class="panel"><summary>'+safe(title)+' · '+safe(r.outcome?(r.outcome==='pass'&&expired(r.verified,30)?'Reverify':({pass:'Passed',fail:'Failed',blocked:'Blocked',na:'Not applicable'}[r.outcome]||'Upcoming')):'Upcoming')+'</summary><p>'+safe(how)+'</p><div class="expect"><strong>Pass criteria</strong><p>'+safe(result)+'</p></div>'+
     '<form data-r-form="validation" data-id="'+id+'">'+select('outcome','Outcome',[['','Choose outcome'],['pass','Pass'],['fail','Fail'],['blocked','Blocked'],['na','Not applicable']],r.outcome)+
     readDate('verified','Test date',r.verified)+field('session','Field Log session',r.session)+area('evidence','Test result, measurement or reason',r.evidence)+actions('<button class="primary">Save test outcome</button>')+'</form></details>';
   }).join('');
 }
 function equipmentView(){
  const starter=[...inventory.map((name,i)=>({id:'equipment:stock:'+i,name,quantity:0,category:'Owned equipment',notes:name==='USB-C data cable'?'Target: two independently verified data cables.':''})),
   ...candidates.map(([name,source,notes],i)=>({id:'equipment:candidate:'+i,name,source,notes,category:'Candidate devices',purchase:'Considering'})),
   ...['Gizont 17 cm flexible 915 MHz whip','Muzi Works 17 cm whip','Seeed Studio 915 MHz long-range antenna','External vehicle-mounted 915 MHz antenna'].map((name,i)=>({id:'equipment:antenna:'+i,name,category:'Antennas',purchase:'Research candidate',notes:'Verify connector, regional SKU, antenna sweep and authorization before use.'}))];
  Object.assign(starter.find(r=>r.name==='Wio Tracker L1 Pro'),{protocol:'MeshCore BLE / Meshtastic by firmware',battery:'2000 mAh on listed L1 Pro SKU',processor:'nRF52840',chipset:'SX1262',frequency:'862–930 MHz hardware; select US SKU',connector:'I-PEX board socket; confirm fitted bulkhead',replaceable:'Via correct pigtail',gps:'L76K',display:'1.3 in OLED',standalone:'Verify exact firmware',phone:'Phone for MeshCore BLE Companion',install:'Seeed-documented UF2 procedure',recovery:'USB data cable and reset control'});
  Object.assign(starter.find(r=>r.name==='Seeed Studio 915 MHz long-range antenna'),{frequency:'902–928 MHz',connector:'Standard SMA male',source:sources.wioAntenna[1],notes:'Seeed SKU 318020389 · 2.6 dBi advertised · 195 mm · 50-ohm system. Requires matching SMA jack, not RP-SMA.'});
  Object.assign(starter.find(r=>r.name==='RAK WisMesh Pocket V2'),{protocol:'Meshtastic preinstalled; verify MeshCore board target',battery:'3200 mAh',processor:'RAK4630 module',frequency:'8xx/9xx MHz vendor listing',connector:'SMA per V2 listing',replaceable:'External antenna',gps:'GNSS',display:'1.3 in OLED',install:'Exact Meshtastic target documented as RAK4631 UF2'});
  Object.assign(starter.find(r=>r.name==='LILYGO T-Deck Plus'),{protocol:'MeshCore standalone (Ripple)',standalone:'Yes, on documented MeshCore standalone build',phone:'None for standalone messaging',frequency:'915 MHz variant listed',display:'Touchscreen and keyboard',price:'$70.99 vendor listing, check US variant/stock',gps:'L76K or u-blox selected at purchase',connector:'External-antenna SKU differs',cons:'Confirm stock and offline installer for selected variant'});
  const entries=items('equipment'),all=[...starter.map(d=>get(d.id)||d),...entries.filter(e=>!starter.some(d=>d.id===e.id))],r=all.find(x=>x.id===equipment)||{};
  const comparisons=all.filter(x=>x.category==='Candidate devices'||x.category==='Antennas');
  return block('Equipment and purchasing plan','<p>Click an item to record observed specifications, quote, storage or test details.</p>'+actions('<button data-r-select="equipment">Add equipment</button><button data-r-report="equipment">Export equipment CSV</button>')+
   equipmentCategories.map((category,i)=>'<details '+(i===0?'open':'')+'><summary>'+safe(category)+' · '+all.filter(e=>e.category===category).length+'</summary><ul class="readiness-list">'+all.filter(e=>e.category===category).map(e=>'<li><button data-r-select="equipment" data-id="'+safe(e.id)+'">'+safe(e.name)+'</button><span>'+safe(e.purchase||(e.available?'Available · '+e.quantity:'Check availability'))+'</span></li>').join('')+'</ul></details>').join(''))+
   block('Edit equipment','<form data-r-form="equipment" data-id="'+safe(r.id||'')+'"><div class="grid">'+
    select('category','Category',equipmentCategories.map(x=>[x,x]),r.category)+fields(equipmentFields,r)+field('quantity','Quantity',r.quantity??0,'number')+readDate('tested','Last test date',r.tested)+'</div>'+check('available','Available and accounted for',r.available)+area('notes','Notes / verification',r.notes)+actions('<button class="primary">Save equipment</button>')+'</form>')+
   '<details class="panel"><summary>Compare purchasing candidates</summary>'+listing(['Candidate','Price / protocol / band','Antenna and standalone','Battery / MCU / RF','Recovery and purchase'],comparisons.map(e=>[(e.source?'<a href="'+safe(e.source)+'" rel="noreferrer" target="_blank">'+safe(e.name)+'</a>':safe(e.name))+'<p>'+safe(e.notes)+'</p>',safe([e.price,e.protocol,e.frequency].filter(Boolean).join(' · ')||'Verify'),safe([e.connector,e.replaceable,e.standalone,e.phone,e.display,e.gps].filter(Boolean).join(' · ')||'Verify'),safe([e.battery,e.processor,e.chipset,e.weather].filter(Boolean).join(' · ')||'Verify'),safe([e.install,e.recovery,e.purchase,e.pros,e.cons].filter(Boolean).join(' · '))]))+'</details>'+
   block('Wio Tracker L1 Pro antenna project','<p class="read-warning">Always power off before disconnecting an antenna. Do not transmit into an open or mismatched antenna connection.</p>'+
   '<figure class="connector-example"><div><strong>SMA plug</strong><span aria-label="Center pin">●</span><small>Center pin</small></div><div><strong>RP-SMA plug</strong><span aria-label="Center socket">○</span><small>Center socket</small></div><figcaption>Illustrative center contacts on the internally threaded plug. Confirm the actual mating jack and vendor revision.</figcaption></figure>'+
   '<ol>'+antennaSteps.map(x=>'<li>'+safe(x)+'</li>').join('')+'</ol>'+actions('<a class="button" href="#field">Log an antenna trial</a><a class="button" href="#analytics">Compare in RF analytics</a><button data-r-report="antenna">Export antenna trial CSV</button>')+links(['wio','wioProduct','wioIntro','wioAntenna','fcc','fccAntennas']));
 }
 function view(legacy){
  const s=model(),tab=Object.hasOwn(tabs,cursor().tab)?cursor().tab:'overview';
  const title=tab==='overview'?'Emergency readiness':tabs[tab];
  const views={overview:()=>overview(s)+'<details class="panel"><summary>Family route evidence</summary>'+legacy()+'</details>',preparation:()=>preparation(s),firmware:vault,backups:()=>backups(s),archive,migration:()=>migration(s),validation:validate,equipment:equipmentView};
  return '<h1>'+safe(title)+'</h1><nav class="readiness-nav" aria-label="Readiness workspace">'+Object.entries(tabs).map(([id,label])=>'<button type="button" data-r-tab="'+id+'" '+(tab===id?'aria-current="page"':'')+'>'+safe(label)+'</button>').join('')+'</nav>'+views[tab]();
 }
 function report(id){
  const s=model();
  const group={firmware:'firmware',devices:'device',equipment:'equipment',archive:'archive',validation:'validation'}[id];
  if(id==='backup-metadata'){download('device-backup-metadata.json','application/json',JSON.stringify({records:items('device')},null,2));return;}
  if(id==='summary'){download('emergency-readiness-summary.json','application/json',JSON.stringify({level:s.level,name:s.label,completed:s.done,total:s.tasks.length,blockers:s.blockers,last:s.last,meshtasticRoute:s.meshtasticRoute,meshcoreRoute:s.meshcoreRoute,verifiedFirmware:s.verified,devicesPrepared:s.prepared},null,2));return;}
  let rows=group?items(group):s.tasks.map(t=>({task:t.title,device:t.scope.name,phase:phases[t.phase],status:s.complete(t.n,t.scope.id)?'verified':t.record?.status==='done'?'reverify':t.record?.status||'upcoming',evidence:t.record?.evidence,verified:t.record?.verified,reason:t.record?.reason}));
  if(id==='antenna')rows=data().logs.filter(r=>r.antenna).map(({image,...row})=>row);
  if(id==='equipment')rows=[...rows,...candidates.filter(([name])=>!rows.some(r=>r.name===name)).map(([name,source,notes])=>({name,source,notes,category:'Candidate devices',purchase:'Considering'}))];
  const columns=[...new Set(rows.flatMap(Object.keys))].filter(k=>!['history','id','kind'].includes(k));
  download(id+'-report.csv','text/csv',reportCSV(columns.length?columns:['status'],rows));
 }
 async function navigate(tab,patch={}){
  await setCursor({tab,...patch});
  if(location.hash!=='#ready')location.hash='#ready';
  else {render();document.querySelector('#content').focus();window.scrollTo(0,0);}
 }
 async function click(button){
  const d=button.dataset;
  if(d.rTab){await navigate(d.rTab);return;}
  if(d.rTask){await navigate('preparation',cursor().task===d.rTask?{}:{task:d.rTask,step:0});return;}
  if(d.rResume!==undefined){
   const s=model(),current=s.tasks.find(t=>taskKey(t.n,t.scope.id)===cursor().task&& !s.complete(t.n,t.scope.id)&&!['blocked','na'].includes(t.record?.status));
   await navigate('preparation',current?{}:s.next?{task:taskKey(s.next.n,s.next.scope.id),step:0}:{});
   return;
  }
  if(d.rSelect){if(d.rSelect==='device')device=d.id||'';if(d.rSelect==='firmware')firmware=d.id||'';if(d.rSelect==='equipment')equipment=d.id||'';render();document.querySelector('[data-r-form="'+d.rSelect+'"]')?.scrollIntoView({block:'start'});return;}
  if(d.rDelete&&confirm('Remove this firmware record and its local file?')){await persist({},{del:[['readiness',d.rDelete],['firmwareFiles',d.rDelete]]});firmware='';render();return;}
  if(d.rFile){const file=await readFirmware(d.rFile);if(!file)throw Error('The firmware copy is unavailable. Reattach it from the archive.');download(file.name,file.type,file.blob);return;}
  if(d.rReport){report(d.rReport);return;}
  if(d.rPrint){
   printMode=d.rPrint;const host=document.createElement('div');host.id='emergency-print';host.innerHTML=printable();document.body.append(host);
   try{window.print();}finally{host.remove();printMode='';}
  }
  if(d.rStorage!==undefined){
   const estimate=await navigator.storage?.estimate?.();
   document.querySelector('[data-r-storage-result]').textContent=estimate?'Browser origin uses '+Math.round(estimate.usage/1024/1024)+' MiB of about '+Math.round(estimate.quota/1024/1024)+' MiB. Keep verified copies on external storage.':'This browser does not report its storage quota.';
  }
 }
 const taskForm=(form,previous)=>{
  const values=Object.fromEntries(new FormData(form));
  const checked=[...form.querySelectorAll('[data-r-check]:checked')].map(i=>Number(i.dataset.rCheck));
  return {...previous,...values,id:form.dataset.id,kind:'task',steps:form.querySelector('[data-r-check]')?checked:previous?.steps||[],status:previous?.status||'active'};
 };
 async function submit(form,submitter){
  const kind=form.dataset.rForm,id=form.dataset.id||crypto.randomUUID(),old=get(id);
  const raw={...Object.fromEntries(new FormData(form)),id,kind};
  if(kind==='preflight'){
   if(model().level<3||migrationChecks.some((_,i)=>!raw['confirm'+i]))throw Error('Finish the offline prerequisites and confirm each preflight item.');
   unlocked=true;await navigate('preparation',{task:taskKey(9),step:0});return;
  }
  if(kind==='task'){
   const r=taskForm(form,old),mode=submitter?.value||'active',n=Number(id.split(':')[1]);
   if(mode==='done'&&((n===9&&!unlocked)||r.steps.length!==model().tasks.find(t=>taskKey(t.n,t.scope.id)===id)?.steps.length||!r.evidence.trim()))throw Error('Complete each step and enter non-secret evidence before verifying.');
   if((mode==='blocked'||mode==='na')&&!r.reason.trim())throw Error('Add a reason before changing this task status.');
   r.status=mode;
   r.verified=mode==='done'?new Date().toISOString():old?.verified;
   await set(r);render();status('Task status saved locally.');return;
  }
  if(kind==='firmware'){
   const file=raw.binary,existing=await readFirmware(id);
   raw.actual=old?.actual;
   raw.downloaded=raw.downloaded==='on';
   raw.result=raw.passed==='on'?'passed':'';
   if(raw.result&&!raw.tested)throw Error('Enter the hardware test date.');
   if(raw.expected&&!/^[a-f0-9]{64}$/i.test(raw.expected.trim()))throw Error('Enter a 64-character SHA-256 digest.');
   raw.expected=raw.expected.trim();
   if(raw.expected&&(!raw.source||!raw.provenance.trim()))throw Error('Record the official source and digest provenance before verifying.');
   if(!raw.version.trim()||!raw.revision.trim())throw Error('Enter the exact hardware revision and firmware version.');
   if(raw.source&&!sanitizeReadiness({...raw,source:raw.source}).source)throw Error('Use a public HTTPS source URL without query strings or credentials.');
   if(file?.size){
    if(!/\.(uf2|bin|hex|zip)$/i.test(file.name))throw Error('Choose a publisher firmware file.');
    raw.actual=await digest(file);raw.filename=file.name;raw.size=file.size;raw.downloaded=true;
    if(old?.actual&&old.actual!==raw.actual){raw.result='';raw.tested='';}
   }else if(existing){raw.filename=existing.name;raw.size=existing.blob.size;}
   const result=sanitizeReadiness(raw);
   if(file?.size){await storeFirmware(result,file);await persist({});}else await set(result);
   firmware=id;
  }
  if(kind==='device'){
   if(!raw.name.trim()||!raw.model.trim())throw Error('Enter a node name and hardware model.');
   if(fleet.some(d=>d.id===id&&d.model!==raw.model.trim()))throw Error('Use the original hardware model for this fleet ID. Add an independent record for new hardware.');
   for(const key of ['screens','links','exported','identity'])raw[key]=raw[key]==='on';
   raw.history=[...(old?.history||[]),{time:new Date().toISOString(),event:'Backup metadata updated'}];
   await set(raw);device=id;
  }
  if(kind==='equipment'){if(!raw.name.trim())throw Error('Enter an item name.');raw.available=raw.available==='on';await set(raw);equipment=id;}
  if(kind==='archive'||kind==='validation'){
   if(kind==='validation'){if(!raw.outcome)throw Error('Choose a validation outcome.');raw.protocol=validationProtocol;}
   if(!raw.evidence.trim()||!raw.verified||Date.parse(raw.verified)>Date.now())throw Error('Enter dated evidence and use today or a past date.');
   await set(raw);
  }
  render();status('Saved locally.');
 }
 async function change(target){
  if(target.dataset.rValidation!==undefined){validationProtocol=target.value;render();return;}
  if(target.dataset.rImport!==undefined&&target.files.length){
   const file=target.files[0];
   if(file.size>2000000)throw Error('Choose a metadata JSON file under 2 MB.');
   const obj=JSON.parse(await file.text()),kind=target.dataset.rImport;
   const input=Array.isArray(obj)?obj:obj.records||obj.assets;
   if(!Array.isArray(input)||!input.length||input.length>500)throw Error('Use a metadata export or starter manifest with 1–500 records.');
   const imports=input.map(r=>{
    if(kind==='device'&&r.kind!=='device')throw Error('Use a device-backup metadata export.');
    if(r.path&&kind==='firmware'){
     const model=obj.kitName==='SenseCAP-X1'?'SenseCAP MeshTracker X1':obj.kitName==='SenseCAP-P1-Pro'?'SenseCAP Solar Node P1-Pro':'';
     if(!model||!r.path.startsWith('firmware/'))return null;
     const role=r.path.includes('/erase/')?'Erase image':r.path.includes('/recovery/')?'Bootloader':r.path.includes('_usb-')?'USB Companion':model.includes('X1')?'Bluetooth Companion':'Repeater';
     r={model,role,protocol:'meshcore',filename:r.path.split('/').at(-1),version:r.path.match(/v\d+\.\d+\.\d+/)?.[0]||'',source:r.url,expected:r.sha256,provenance:'See release for digest provenance'};
    }
    const id=kind==='device'?r.id:crypto.randomUUID();
    if(kind==='device'&&fleet.some(d=>d.id===id&&d.model!==r.model))throw Error('Imported model does not match fleet ID.');
    return sanitizeReadiness({...r,id,kind},true);
   }).filter(Boolean);
   if(!imports.length)throw Error('No supported firmware entries found.');
   if(confirm('Import '+imports.length+' non-secret metadata records?')){await persist({readiness:imports});render();status('Metadata imported. Reattach and verify any firmware bytes separately.');}
   return;
  }
  if(target.matches('[data-r-check]')){
   const form=target.form,old=get(form.dataset.id),r=taskForm(form,old);
   const n=Number(target.dataset.rCheck),next=n+1,details=target.closest('details');
   if(r.status==='done')r.status='active';
   await set(r);
   if(target.checked&&form.querySelector('[data-r-step="'+next+'"]')){
    details.open=false;const nextStep=form.querySelector('[data-r-step="'+next+'"]');nextStep.open=true;
    await setCursor({step:next});
    nextStep.querySelector('summary').focus();
   }else await setCursor({step:n});
   return;
  }
  const form=target.form;
  if(form?.dataset.rForm==='task'&&['notes','evidence','reason'].includes(target.name)){await set(taskForm(form,get(form.dataset.id)));return;}
  if(form?.dataset.rForm==='firmware'&&['device','model','protocol'].includes(target.name)){
   const controls=form.elements;
   if(target.name==='device'){
    const assigned=devices().find(d=>d.id===target.value);
    if(assigned){controls.model.value=assigned.model;controls.revision.value=assigned.revision||'';}
   }
   controls.role.innerHTML=options(firmwareRoles(controls.model.value,controls.protocol.value).map(x=>[x,x]));
  }
 }
 return {view,home,click,submit,change};
}
