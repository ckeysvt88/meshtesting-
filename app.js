import {createReadiness} from './readiness-ui.js';
import {protocolName} from './readiness-model.js';
import {read,write} from './db.js';
import {clean,backup,csv,parseCSV,readCSV,distance,loss,fresnel,stats,trials,types,kinds} from './domain.js';
import {steps} from './guide.js';
import {overlay,drawMap} from './map.js';
const $=s=>document.querySelector(s);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nav={dashboard:'Home',guide:'Guide',field:'Field log',map:'Coverage map',analytics:'RF analytics',relay:'Relay planner',ready:'Readiness',devices:'Devices',data:'Data & help'};
const protocolChoices=[['meshtastic','Meshtastic'],['meshcore','MeshCore'],['unknown','Unclassified']];
const category={range:'Range survey',public:'Public mesh',message:'Two-way message',relay:'Relay test'};
let data={...Object.fromEntries(kinds.map(k=>[k,[]])),firmwareFiles:[]},editing=null,pending=null,installPrompt,step=0,timer,stopTime=0,mapFilter={};
const page=()=>Object.hasOwn(nav,location.hash.slice(1))?location.hash.slice(1):'dashboard';
const status=m=>$('#status').textContent=m;
const connected=()=>$('#connection').textContent=navigator.onLine?'Local workspace · Online':'Local workspace · Offline';
addEventListener('online',connected);addEventListener('offline',connected);connected();
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(page()==='data')render();});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>status('Offline setup failed. Reload online to retry.'));
const ordered=()=>[...data.logs].sort((a,b)=>b.time.localeCompare(a.time));
const point=(title,value)=>'<div class="panel"><span class="metric">'+safe(value)+'</span>'+safe(title)+'</div>';
const block=(title,html)=>'<section class="panel"><h2>'+safe(title)+'</h2>'+html+'</section>';
const intro=(title,description)=>'<h1>'+safe(title)+'</h1><p class="intro">'+safe(description)+'</p>';
const options=items=>items.map(([v,n])=>'<option value="'+safe(v)+'">'+safe(n)+'</option>').join('');
const input=(k,n,type='text',extra='')=>'<label>'+safe(n)+'<input name="'+k+'" type="'+type+'" '+extra+'></label>';
const select=(k,n,items)=>'<label>'+safe(n)+'<select name="'+k+'">'+options(items)+'</select></label>';
const check=(k,n)=>'<label class="check"><input name="'+k+'" type="checkbox">'+safe(n)+'</label>';
const number=(k,n,min,max,step='any')=>input(k,n,'number','min="'+min+'" max="'+max+'" step="'+step+'"');
const notes='<label>Notes<textarea name="notes" maxlength="1200"></textarea></label>';
const gps=number('lat','Latitude',-90,90)+number('lon','Longitude',-180,180);
const evidence='<label>Screenshot (PNG, JPEG or WebP, up to 2 MB)<input type="file" name="attachment" accept="image/png,image/jpeg,image/webp"></label>';
const radioProtocol=r=>r.protocol||'meshtastic';
const ids=sites=>[['','Select a saved site'],...sites.map(x=>[x.id,x.name])];
const getSite=id=>data.sites.find(s=>s.id===id);
const complete=id=>data.checks.some(x=>x.id===id&&x.done);
const counts=()=>({
 surveyed:new Set(data.logs.filter(r=>r.type==='range').map(r=>r.site||[r.lat,r.lon].join(',')+(r.lat===null?r.name:''))).size,
 heard:data.logs.filter(r=>r.type==='range'&&r.rf&&r.received>0).length,
 failed:data.logs.filter(r=>r.type==='range'&&r.received===0).length,
 passed:trials(data.logs).filter(a=>a.pass).length
});
const pct=n=>n==null?'—':(n*100).toFixed(1)+'%';
const format=(n,unit='')=>Number.isFinite(n)?n.toFixed(1)+unit:'—';
const phases=[
 {title:'Get the radios ready',description:'Check the settings and confirm the radios can talk at home.',first:0,last:4},
 {title:'Run your first range test',description:'Set up CS01 and CK88, then log a successful reception or a miss.',first:5,last:8},
 {title:'Review your coverage',description:'See your saved stops and decide where to test next.'}
];
const firstUnfinished=()=>steps.findIndex(([id],i)=>i<9&&!complete(id));
const resumeStep=()=>{const i=steps.findIndex(([id])=>!complete(id));return i<0?steps.length-1:i;};
const phaseIndex=i=>phases.findIndex(p=>i>=p.first&&i<=p.last);
function dashboard(){
 const next=firstUnfinished(),done=steps.slice(0,9).filter(([id])=>complete(id)).length;
 const last=ordered()[0],phase=next<0?2:phaseIndex(next);
 const headline=done===0?'Start with your radios':next<0?'See what your test found':steps[next][1];
 const lead=done===0?'First, connect your iPhone to CK88 in the Meshtastic app. The guide walks you through that connection and the steps for your first range test.':next<0?'Open the map to review your saved stops. When you want to test whether a message can make it both ways, return to the guide.':phases[phase].description;
 const action=done===0?'Start radio setup':next<0?'View coverage map':'Continue where I left off';
 return '<section class="panel hero"><div class="eyebrow">Your first range test</div><h1>'+safe(headline)+'</h1><p>'+safe(lead)+'</p>'+
 '<div class="actions"><a class="button primary" href="'+(next<0?'#map':'#guide')+'">'+action+' <span aria-hidden="true">→</span></a></div>'+
 (done?'<div class="progress-label">'+done+' of 9 steps complete</div><progress max="9" value="'+done+'" aria-label="First range test progress"></progress>':'')+'</section>'+
 '<section class="roadmap"><h2>How it works</h2><ol>'+phases.map((p,i)=>'<li '+(i===phase?'aria-current="step"':'')+'><span class="phase-number" aria-hidden="true">'+(i<phase?'✓':i+1)+'</span><div><h3>'+p.title+'</h3><p>'+p.description+'</p></div></li>').join('')+'</ol></section>'+
 readinessUI.home()+(last?block('Latest saved observation','<p><strong>'+safe(last.name)+'</strong> · '+safe(category[last.type])+'</p><a href="#field">Open field log</a>'):'');
}
function guide(){
 const [id,title,instruction,expect,trouble]=steps[step];
 const phase=phaseIndex(step), current=phases[phase], done=complete(id);
 const destination={survey:['#field','Open the field log'],messages:['#field','Open the field log'],public:['#field','Open the field log'],relay:['#relay','Open the relay planner']}[id];
 const nextLabel=id==='inventory'?'CK88 is connected':step===8?'Finish first test':step===steps.length-1?'Finish guide':'Complete and continue';
 return '<div class="guide-heading"><a class="backlink" href="#dashboard">← Home</a><p class="eyebrow">'+(current?current.title:'Further testing')+'</p><h1>'+safe(title)+'</h1>'+
 '<div class="progress-label">'+(current?'Step '+(step-current.first+1)+' of '+(current.last-current.first+1)+' in this phase':'Step '+(step-8)+' of '+(steps.length-9))+'</div>'+
 (current?'<progress max="9" value="'+steps.slice(0,9).filter(([key])=>complete(key)).length+'" aria-label="First range test progress"></progress>':'')+'</div>'+
 '<section class="panel guide-card"><h2>What to do</h2>'+(Array.isArray(instruction)?'<ol class="guide-instructions">'+instruction.map(item=>'<li>'+safe(item)+'</li>').join('')+'</ol>':'<p>'+safe(instruction)+'</p>')+
 (destination?'<a class="button contextual" href="'+destination[0]+'">'+destination[1]+' <span aria-hidden="true">→</span></a>':'')+
 '<div class="expect"><h3>How you’ll know it worked</h3><p>'+safe(expect)+'</p></div><details><summary>If you get stuck</summary><p>'+safe(trouble)+'</p></details></section>'+
 '<div class="actions guide-actions">'+(step>0?'<button data-step="'+(step-1)+'">Back</button>':'')+
 (done?'<button class="primary" data-advance>Continue <span aria-hidden="true">→</span></button><button class="quiet" data-complete="'+id+'">Mark as unfinished</button>':'<button class="primary" data-complete="'+id+'">'+nextLabel+' <span aria-hidden="true">→</span></button>')+'</div>'+
 '<details class="all-steps"><summary>See all guide steps</summary><ol>'+steps.map(([key,t],i)=>'<li><button data-step="'+i+'" '+(i===step?'aria-current="step"':'')+'>'+safe(t)+(complete(key)?' <span>✓</span>':'')+'</button></li>').join('')+'</ol></details>';
}
function records(kind,rows){
 return rows.length?'<div class="list">'+rows.map(r=>'<details class="record"><summary>'+safe(r.name)+(kind==='logs'?' · '+safe(protocolName(radioProtocol(r)))+' · '+safe(category[r.type])+(r.received===null?'':' · '+r.received+' received'):'')+'</summary>'+
 '<p>'+safe(r.time?new Date(r.time).toLocaleString():'')+(r.lat!=null?' · '+r.lat.toFixed(5)+', '+r.lon.toFixed(5):'')+'</p>'+
 '<p>'+safe(r.notes)+'</p>'+(r.image?'<img class="evidence" src="'+safe(r.image)+'" alt="Supporting field screenshot">':'')+
 '<div class="actions"><button data-edit="'+kind+'" data-id="'+safe(r.id)+'">Edit</button><button class="danger" data-delete="'+kind+'" data-id="'+safe(r.id)+'">Delete</button></div></details>').join('')+'</div>':'<p class="muted">No records yet.</p>';
}
function field(){
 const form='<form data-form="logs"><div class="grid">'+input('name','Stop or test name','text','required maxlength="100"')+
 select('protocol','Protocol',protocolChoices)+select('type','Test type',types.map(t=>[t,category[t]]))+
 number('received','Unique packets or texts received',0,100000,1)+number('sent','Known transmissions',1,100000,1)+'</div>'+
 '<p class="hint">Enter 0 if none arrived. Leave transmissions blank if you do not know how many were sent.</p>'+
 '<div class="tool-row"><div class="actions"><button type="button" data-gps>Use GPS</button><output id="gps-result" aria-live="polite">Location optional</output></div>'+
 '<details data-location><summary>Enter or review coordinates</summary><div class="grid">'+gps+'</div></details>'+
 '<details data-timer><summary>Use the optional observation timer</summary><div class="actions timer-tools"><label>Observation timer (minutes)<input id="minutes" type="number" min="1" max="60" value="3"></label><button type="button" id="start">Start timer</button><button type="button" id="stop">Stop timer</button><output id="clock"></output></div></details></div>'+
 check('rf','I verified isolation on participating radios and phones for this observation')+
 '<details><summary>Session, signal and route details</summary><div class="grid">'+input('session','Session name')+input('pair','Trial ID or message identifier')+
 input('time','Observation start (local time)','datetime-local')+
 select('anchor','First endpoint (such as CS01)',ids(data.sites))+select('site','Second endpoint',ids(data.sites))+
 select('direction','Direction',[['forward','First → second'],['reverse','Second → first']])+select('path','Observed path',[['unknown','Unknown'],['direct','Direct'],['relayed','Relayed']])+
 number('rssi','RSSI (dBm)',-200,0)+number('snr','SNR (dB)',-60,60)+number('hops','Hops',0,15,1)+
 select('vehicle','Vehicle placement',[['','Unknown'],['Inside','Inside'],['Outside','Outside']])+input('height','Antenna height (include unit)')+input('orientation','Antenna orientation')+'</div>'+
 check('control','I controlled every relay on the tested path, or confirmed the path was direct')+'</details>'+
  '<details><summary>Message delivery and public nodes</summary><div class="grid">'+input('sender','Sending radio')+input('recipient','Receiving radio')+
 select('ack','Recipient radio acknowledgment',[['','Unknown'],['yes','Yes'],['no','No']])+select('human','Human read the actual received text',[['','Unknown'],['yes','Yes'],['no','No']])+
 select('reply','Human reply received',[['','Unknown'],['yes','Yes'],['no','No']])+input('route','Relay dependency or path description')+
 input('node','Public node ID')+input('trace','Traceroute result')+number('battery','Battery (%)',0,100)+number('delay','Delivery delay (seconds)',0,86400)+input('weather','Weather')+'</div></details>'+

 '<details><summary>Protocol, antenna and observation provenance</summary><div class="grid">'+
 input('firmware','Firmware version')+input('radio','Radio configuration / preset')+input('antenna','Antenna model / stock or upgraded')+
 number('mhz','Frequency (MHz)',100,10000)+number('gain','Advertised gain (dBi)',-50,100)+number('vswr','Measured VSWR',1,100)+
 number('testDistance','Measured test distance (km)',0,5000)+number('acks','Acknowledgements received',0,100000,1)+input('repeaters','Reachable repeaters')+input('environment','Environment')+input('routeDetails','Protocol-specific route details')+
 select('internet','Internet connection',[['unknown','Unknown'],['offline','Offline, verified'],['online','Online'],['assisted','Internet-assisted']])+
 select('mqtt','Meshtastic MQTT',[['unknown','Unknown'],['off','Off, verified'],['on','On'],['na','Not applicable']])+
 select('origin','Observation class',[['manual','Manual measured observation'],['imported','Imported measurement'],['position','Imported position only'],['modeled','Theoretical estimate']])+input('dataSource','Observation source or instrument')+'</div></details>'+
 '<details><summary>Notes and screenshot</summary>'+notes+evidence+'</details>'+
 '<div class="actions"><button class="primary">Save observation</button>'+(editing?'<button type="button" data-cancel>Cancel edit</button>':'')+'</div></form>';
 return intro('Field log','At each parked stop, count fresh packets in the native radio app and enter the result here.')+
 (firstUnfinished()>=0?'<p class="hint"><a href="#guide">Return to the guided test</a></p>':'')+
 block(editing?'Edit observation':'Log a stop',form)+block('Saved observations',records('logs',ordered()));
}
const profileFields={device:'Hardware model',firmware:'Firmware version',role:'Device role',region:'LoRa region',preset:'Modem preset',slot:'Frequency slot',frequency:'Frequency override',channel:'Channel label (omit keys)',mqtt:'MQTT enabled / off',proxy:'MQTT Client Proxy',bridge:'Channel uplink/downlink',position:'GPS and positioning',range:'Range Test settings',antenna:'Antenna and feed line',height:'Antenna height'};
function devices(){
 const mismatches=['region','preset','slot','frequency','channel'].filter(k=>new Set(data.profiles.filter(r=>radioProtocol(r)==='meshtastic').map(r=>(r[k]||'').toLowerCase()).filter(Boolean)).size>1);
 return intro('Device inventory','Record actual settings for CS01, CK88 and DK88. Mesh Field Lab compares your entries and keeps radio changes in the native applications.')+
 (mismatches.length?block('Verify these differences','<p class="danger">'+safe(mismatches.map(k=>profileFields[k]).join(', '))+'</p>'):'')+
 block(editing?'Edit radio profile':'Add radio profile','<form data-form="profiles"><div class="grid">'+input('name','Node name','text','required')+select('protocol','Protocol',protocolChoices.slice(0,2))+Object.entries(profileFields).map(([k,n])=>input(k,n)).join('')+'</div>'+notes+'<div class="actions"><button class="primary">Save radio</button>'+(editing?'<button type="button" data-cancel>Cancel edit</button>':'')+'</div></form>')+
 block('Saved radios',records('profiles',data.profiles));
}
function relay(){
 return intro('Relay planner','Save CS01 as an anchor and family endpoints as destinations. Candidate sites stay provisional until both RF legs, the complete route and practical hosting are verified.')+
 block(editing?'Edit site':'Add site','<form data-form="sites"><div class="grid">'+input('name','Site name','text','required')+
 select('type','Site type',[['anchor','Anchor'],['destination','Destination'],['relay','Candidate relay']])+gps+
 Object.entries({height:'Antenna height',gain:'Antenna gain (dBi)',cable:'Cable loss (dB)',margin:'Predicted link margin (dB)',model:'Prediction tool and assumptions',extension:'Expected onward extension',access:'Permission and access status',power:'Solar exposure or power plan',mount:'Mounting feasibility',obstruction:'Obstructions and terrain'}).map(([k,n])=>input(k,n)).join('')+
 '</div><div class="actions"><button type="button" data-gps>Use GPS</button></div>'+notes+evidence+'<div class="actions"><button class="primary">Save site</button>'+(editing?'<button type="button" data-cancel>Cancel edit</button>':'')+'</div></form>')+
 block('Candidate comparison','<p>Measured leg counts use both directions with human confirmation and controlled paths. Record access, sun and mount before selecting a pilot.</p><div class="table"><table><thead><tr><th>Candidate</th><th>Controlled legs</th><th>Predicted margin</th><th>Access / power / mount</th><th>Next test</th></tr></thead><tbody>'+data.sites.filter(s=>s.type==='relay').map(s=>{
  const legs=trials(data.logs).filter(t=>t.pass&&t.rows.every(r=>r.control&&r.type==='relay')&&[t.rows[0].anchor,t.rows[0].site].includes(s.id));
  const peers=[...new Set(legs.map(t=>{const r=t.rows[0];return r.anchor===s.id?r.site:r.anchor}))];
  const home=peers.some(id=>getSite(id)?.type==='anchor'),onward=peers.some(id=>getSite(id)?.type==='destination');
  const next=home&&onward?(s.access&&s.power&&s.mount?'Run a controlled end-to-end trial':'Verify access, power and mounting'):home?'Test the onward leg':'Test the link back to the anchor';
  return '<tr><td>'+safe(s.name)+'</td><td>'+safe(peers.map(id=>getSite(id)?.name||'Deleted site').join(', ')||'Untested')+'</td><td>'+safe(s.margin||'—')+'</td><td>'+safe([s.access,s.power,s.mount].filter(Boolean).join(' / ')||'Unrecorded')+'</td><td>'+safe(next)+'</td></tr>';
 }).join('')+'</tbody></table></div>')+block('Saved sites',records('sites',data.sites));
}
function mapped(){
 return intro('Coverage map','Explore the local coordinate map. Pan and zoom, then select two markers to measure straight-line distance. The map works offline and sends no map-view requests.')+
 (!data.logs.some(r=>r.lat!==null)?block('Add your first stop','<p>Capture a location in the field log to see your first point here.</p><a href="#field">Open field log</a>'):'')+
 block('Field observations','<form id="map-filter"><div class="grid">'+select('protocol','Coverage layer',[['','All protocol layers'],...protocolChoices])+select('rfClass','Observation class',[['','All measurement classes'],['direct','RF direct'],['relayed','RF relayed'],['assisted','Internet-assisted'],['context','Unknown or context only']])+select('type','Test type',[['','All tests'],...types.map(k=>[k,category[k]])])+input('session','Session contains')+
 input('device','Source or destination contains')+input('antenna','Antenna contains')+input('firmware','Firmware contains')+input('radio','Radio configuration contains')+input('location','Location contains')+input('from','From date','date')+input('to','Through date','date')+select('path','Observed path',[['','All paths'],['direct','Direct'],['relayed','Relayed'],['unknown','Unknown']])+
 number('rssi','Minimum RSSI (dBm)',-200,0)+number('snr','Minimum SNR (dB)',-60,60)+select('size','Marker size',[['','Fixed'],['rssi','RSSI'],['snr','SNR']])+'</div><button>Apply filters</button></form>'+
 '<div id="map-host"><div class="actions map-tools">'+[['in','Zoom in'],['out','Zoom out'],['fit','Fit points'],['left','Left'],['up','Up'],['down','Down'],['right','Right']].map(([k,n])=>'<button data-map="'+k+'">'+n+'</button>').join('')+
 '</div><svg class="map" viewBox="0 0 600 300" role="group" aria-label="Local coverage plot"></svg><div class="legend">Marker labels identify protocol and evidence class. Reference overlays may contain predictions.</div><output aria-live="polite">Select a marker to inspect it.</output></div>')+
 block('Planning overlays','<p>Purple overlays are reference geometry or predictions. Use <a href="https://site.meshtastic.org/" rel="noreferrer" target="_blank">Meshtastic Site Planner</a> separately for terrain and line-of-sight analysis.</p><a href="#data">Import a KML, GPX or GeoJSON file</a>'+records('overlays',data.overlays).replace(/<button data-edit="overlays"[^>]*>Edit<\/button>/g,''));
}
const matches=(filter,value)=>!filter||String(value||'').toLowerCase().includes(filter.toLowerCase());
const evidenceClass=r=>r.internet==='assisted'?'assisted':r.rf&&r.path!=='unknown'?r.path:'context';
function filtered(){
 const f=mapFilter;
 return data.logs.filter(r=>r.lat!==null&&r.origin!=='modeled'&&(!f.protocol||radioProtocol(r)===f.protocol)&&(!f.rfClass||evidenceClass(r)===f.rfClass)&&
 matches(f.device,[r.sender,r.recipient].join(' '))&&matches(f.antenna,r.antenna)&&matches(f.firmware,r.firmware)&&matches(f.radio,r.radio)&&matches(f.location,[r.name,getSite(r.site)?.name].join(' '))&&(!f.type||r.type===f.type)&&(!f.path||r.path===f.path)&&(!f.session||r.session.toLowerCase().includes(f.session.toLowerCase()))&&
 (!f.from||r.time&&localTime(new Date(r.time)).slice(0,10)>=f.from)&&(!f.to||r.time&&localTime(new Date(r.time)).slice(0,10)<=f.to)&&
 (f.rssi==null||f.rssi===''||r.rssi!==null&&r.rssi>=Number(f.rssi))&&(f.snr==null||f.snr===''||r.snr!==null&&r.snr>=Number(f.snr)));
}
function mountMap(){
 const evidence=new Set(trials(data.logs).filter(t=>t.pass).flatMap(t=>t.rows.map(r=>r.id)));
 drawMap($('#map-host'),[...data.sites.filter(r=>r.lat!==null),...filtered()],data.overlays,r=>{
  const log=types.includes(r.type),result=r.received===null?'no count':r.received+' received',value=r[mapFilter.size];
  return {color:!log?'#f2c26a':evidenceClass(r)==='assisted'?'#edb94b':r.origin==='position'?'#b8c7bf':radioProtocol(r)==='meshcore'?(r.received===0?'#f493aa':'#b9a6ff'):evidence.has(r.id)?'#86d6fc':r.received>0?'#b9f17e':r.received===0?'#fc9b83':'#b8c7bf',
   radius:mapFilter.size&&Number.isFinite(value)?4+Math.max(0,Math.min(8,(value+(mapFilter.size==='rssi'?135:20))/8)):7,
   label:r.name+' · '+(log?[protocolName(radioProtocol(r)),result,evidenceClass(r),r.origin||'manual','RSSI '+format(r.rssi,' dBm'),'SNR '+format(r.snr,' dB')].join(' · '):r.type)};
 });
}
function groups(rows,key){
 const buckets=new Map();
 for(const row of rows){const k=key(row);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(row);}
 return '<div class="table"><table><thead><tr><th>Group</th><th>Stops heard / counted</th><th>Received / sent</th><th>Packet rate</th></tr></thead><tbody>'+[...buckets.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,rs])=>{
  const s=stats(rs),withResult=rs.filter(r=>r.received!==null);
  return '<tr><td>'+safe(k)+'</td><td>'+withResult.filter(r=>r.received>0).length+' / '+withResult.length+'</td><td>'+s.received+' / '+s.sent+'</td><td>'+pct(s.rate)+'</td></tr>';
 }).join('')+'</tbody></table></div>';
}
function bins(rows,key,edges,unit){
 const lower=[-Infinity,...edges],upper=[...edges,Infinity],v=rows.map(r=>r[key]).filter(Number.isFinite);
 return '<div class="bars">'+lower.map((x,i)=>{const n=v.filter(s=>s>=x&&s<upper[i]).length,label=i===0?'Below '+upper[i]:i===lower.length-1?x+' or above':x+' to <'+upper[i];return '<div><span>'+safe(label+' '+unit)+'</span><progress max="'+Math.max(1,v.length)+'" value="'+n+'" aria-label="'+safe(label)+'"></progress><span>'+n+'</span></div>';}).join('')+'</div>';
}
function routeComparison(rows){
 const buckets=new Map();
 for(const r of rows.filter(x=>x.session&&(x.site||x.antenna)&&x.path!=='unknown')){
  const site=getSite(r.site)?.name||r.name,key=JSON.stringify([r.session,site,r.path]);
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(r);
 }
 const summary=rows=>{
  if(!rows.length)return 'No matched observations';
  const s=stats(rows),counted=rows.filter(r=>Number.isInteger(r.sent)&&Number.isInteger(r.acks));
  const sent=counted.reduce((n,r)=>n+r.sent,0);
  return [s.received+'/'+s.sent+' counted packets',pct(s.rate)+' delivery',format(s.rssi,' dBm'),format(s.snr,' dB'),sent?pct(counted.reduce((n,r)=>n+r.acks,0)/sent)+' ACK':'ACK unknown'].join(' · ');
 };
 return '<p>Use the same session and named stop or saved endpoint for both protocols. Compare matched path classes and use the same test conditions for antenna trials.</p><div class="actions"><button data-export="comparison">Export comparison observations</button></div><div class="table"><table><thead><tr><th>Session / stop / path</th><th>Meshtastic</th><th>MeshCore</th></tr></thead><tbody>'+[...buckets].map(([key,group])=>'<tr><td>'+safe(JSON.parse(key).join(' · '))+'</td>'+['meshtastic','meshcore'].map(p=>{
  const protocolRows=group.filter(r=>radioProtocol(r)===p),antennas=[...new Set(protocolRows.map(r=>r.antenna).filter(Boolean))];
  return '<td>'+safe(summary(protocolRows))+antennas.map(a=>'<p><strong>'+safe(a)+'</strong><br>'+safe(summary(protocolRows.filter(r=>r.antenna===a)))+'</p>').join('')+'</td>';
 }).join('')+'</tr>').join('')+'</tbody></table></div>';
}
function analytics(){
 const all=data.logs.filter(r=>r.type==='range'&&r.rf&&r.origin!=='modeled'&&r.origin!=='position'),rows=all.filter(r=>radioProtocol(r)==='meshtastic'),s=stats(rows),pairs=trials(data.logs).filter(t=>t.rows[0].type==='message'),successes=pairs.filter(t=>t.pass).length;
 const anchor=r=>getSite(r.anchor)||data.sites.find(x=>x.type==='anchor');
 const km=r=>distance(anchor(r),r.lat===null?getSite(r.site):r);
 const sector=r=>{const a=anchor(r),b=r.lat===null?getSite(r.site):r;if(!a||!b||a.lat===null||b.lat===null||km(r)===0)return 'Unknown';const rad=Math.PI/180,dl=(b.lon-a.lon)*rad,angle=(Math.atan2(Math.sin(dl)*Math.cos(b.lat*rad),Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos(dl))/rad+360)%360;return ['N','NE','E','SE','S','SW','W','NW'][Math.round(angle/45)%8];};
 return intro('RF analytics','These reception summaries use observations marked RF-isolated by the operator. Counts describe sampled stops and conditions. A single packet or a small sample provides limited evidence.')+
 '<div class="grid">'+point('Counted packet reception',pct(s.rate))+point('Known transmissions',s.sent)+point('Median RSSI',format(s.rssi,' dBm'))+point('Median SNR',format(s.snr,' dB'))+point('Two-way trials passed',successes+' / '+pairs.length)+'</div>'+
 block('Protocol and antenna comparisons',routeComparison(all))+
 block('Meshtastic signal distributions', '<h3>RSSI</h3>'+bins(rows,'rssi',[-120,-105,-90,-75],'dBm')+'<h3>SNR</h3>'+bins(rows,'snr',[-15,-5,5,10],'dB'))+
 block('Compare Meshtastic surveyed stops','<p>Unknown expected counts are excluded from packet rate. Relayed signal values can describe the last hop.</p>'+
 [['Distance from anchor',r=>{const d=km(r);return d===null?'Unknown':(Math.floor(d/2)*2)+'–'+(Math.floor(d/2)*2+2)+' km';}],['Direction from anchor',sector],['Vehicle placement',r=>r.vehicle||'Unknown'],['Antenna height',r=>r.height||'Unknown'],['Test date',r=>r.time?localTime(new Date(r.time)).slice(0,10):'Unknown'],['Location consistency',r=>getSite(r.site)?.name||r.name]].map(([n,k])=>'<details><summary>'+safe(n)+'</summary>'+groups(rows,k)+'</details>').join(''))+
 block('Measured gaps','<ul>'+rows.filter(r=>r.received===0).map(r=>'<li>'+safe(r.name)+' · '+format(km(r),' km')+'</li>').join('')+'</ul><p>A missed stop is specific to the logged test conditions.</p>')+
 block('Free-space calculator','<p>Ideal free-space path loss and midpoint first Fresnel radius. Terrain, clutter, foliage, antenna gains and system losses require separate analysis.</p><form id="rf"><div class="grid">'+number('km','Path distance (km)',.001,5000)+number('mhz','Actual frequency (MHz)',1,100000)+'</div><button>Calculate</button></form><p><output id="rf-output" aria-live="polite"></output></p>');
}
function readiness(){
 const results=trials(data.logs).filter(t=>t.rows[0].type==='message'&&radioProtocol(t.rows[0])==='meshtastic');
 return intro('Emergency readiness','Verify the Clayton–Cary family route in both directions under controlled conditions. Use current evidence and agree on a fallback for missed check-ins.')+
 '<div class="grid">'+point('Radios recorded',data.profiles.length)+point('RF-isolated stops heard',counts().heard)+point('Controlled two-way trials',results.filter(t=>t.pass&&t.rows.every(r=>r.control)).length)+'</div>'+
 block('Family destinations',data.sites.filter(s=>s.type==='destination').map(site=>{
  const records=results.filter(t=>{const r=t.rows[0];return (r.site===site.id&&getSite(r.anchor)?.type==='anchor')||(r.anchor===site.id&&getSite(r.site)?.type==='anchor');});
  const passed=records.filter(t=>t.pass&&t.rows.every(r=>r.control)),days=[...new Set(passed.filter(t=>t.rows.every(r=>r.time)).map(t=>t.rows.map(r=>r.time).sort().at(-1).slice(0,10)))].sort();
  const age=days.length?(Date.now()-Date.parse(days.at(-1)))/86400000:Infinity;
  const recent=records.filter(t=>t.rows.some(r=>r.time)).sort((a,b)=>b.rows.map(r=>r.time).sort().at(-1).localeCompare(a.rows.map(r=>r.time).sort().at(-1)))[0];
  const regressed=recent&&(!recent.pass||!recent.rows.every(r=>r.control));
  const relayed=records.some(t=>t.rows.some(r=>r.path==='relayed')),unknown=records.some(t=>t.rows.some(r=>!r.control||r.path==='unknown'));
  return '<p><strong>'+safe(site.name)+'</strong> · '+(regressed?'Latest trial failed or incomplete · retest due':days.length>=2?(age>30?'Retest due':'Repeat controlled evidence on file'):(days.length?'One controlled test date':'Awaiting controlled end-to-end test'))+' · '+passed.length+' controlled passes / '+records.length+' recorded RF-isolated trials'+(relayed?' · Relay observed':'')+(unknown?' · Path or internet dependency unresolved for some trials':'')+'</p>';
 }).join('')||'<p>Save an anchor and a family destination in Relay Planner to track route evidence.</p>')+
 block('Family check-in drill','<ol><li>Agree on endpoints, a test time, a short identifier and a fallback before leaving.</li><li>Confirm every participating radio is charged and MQTT isolation is checked. Note all known relay and power dependencies.</li><li>Send the numbered message and have the other person read it and reply with the same identifier. Record both directions, even if either failed.</li><li>Repeat on different days, after equipment changes and at least every 30 days for this dashboard’s retest indicator.</li><li>When a check-in is missed, follow your prearranged contact plan.</li></ol>');
}
function dataHelp(){
 return intro('Data & help','Browser storage can be cleared or evicted. Keep a manual JSON backup in a place you control. Exports can contain exact locations and screenshots.')+
 block('Back up or restore','<div class="actions"><button data-export="json">Export JSON backup</button><button data-export="csv">Export observations CSV</button><button data-clear class="danger">Delete all project data</button></div>'+
 '<label>Choose a backup, packet CSV or map overlay<input id="import" type="file" accept=".json,.csv,.geojson,.gpx,.kml"></label>'+
 '<p class="muted">JSON restores the entire project. CSV imports add observations and skip detected duplicates. GPX, KML and GeoJSON are reference overlays. CSV preview lets you choose how to interpret incoming data.</p><div id="preview"></div>')+
 block('Install and work offline','<p>On iPhone, open this page in Safari, tap Share, select Add to Home Screen, and open the installed app while online once. On desktop, use your browser’s install action when available. The app, records and coordinate map work offline after the local cache is ready.</p>'+
 (installPrompt?'<button data-install>Install Mesh Field Lab</button>':'')+'<p><output id="worker"></output></p>')+
 block('Radio and data limits','<p>Use the native MeshCore or Meshtastic app for Bluetooth and radio settings. Log measurements manually, or import supported CSV fields. The PWA does not listen to radios or run a background radio logger. The iOS Position Log can supply position context. It does not establish packet counts or delivery.</p><p>No analytics or external tile requests are configured. When you follow an external link, that site handles your request. The coordinate map stays local.</p>')+
 block('Glossary','<dl><dt>LoRa</dt><dd>Radio modulation used for the over-the-air Meshtastic link.</dd><dt>MQTT</dt><dd>An internet messaging bridge that can join separate meshes.</dd><dt>RSSI and SNR</dt><dd>Received signal level in dBm and signal-to-noise ratio in dB.</dd><dt>Hop and traceroute</dt><dd>A relay forwarding step and a diagnostic that can report forward and return paths.</dd><dt>Line of sight and Fresnel clearance</dt><dd>The direct path and surrounding volume where obstacles affect the signal.</dd><dt>Packet reception</dt><dd>An observed packet. A recipient acknowledgment and a human reply are distinct evidence.</dd></dl><a href="https://meshtastic.org/docs/" target="_blank" rel="noreferrer">Official Meshtastic documentation</a>');
}
const views={dashboard,guide,field,map:mapped,analytics,relay,ready:()=>readinessUI.view(readiness),devices,data:dataHelp};
function localTime(d=new Date()){
 return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function fill(form,record){
 for(const [key,value] of Object.entries(record||{})){
  const el=form.elements.namedItem(key);
  if(!el||el.type==='file')continue;
  if(el.type==='checkbox')el.checked=Boolean(value);
  else el.value=key==='time'&&value?localTime(new Date(value)):value??'';
 }
}
function render(){
 const current=page();
 const links=keys=>keys.map(k=>'<a href="#'+k+'" '+(k===current?'aria-current="page"':'')+'>'+nav[k]+'</a>').join('');
 const primary=['dashboard','guide','field','map','ready'];
 $('#nav').innerHTML='<div class="main-nav">'+links(primary)+'</div><details class="more-nav"><summary>More tools</summary><div>'+links(Object.keys(nav).filter(k=>!primary.includes(k)))+'</div></details>';
 $('#view').innerHTML=views[current]();
 const form=$('[data-form]');
 if(form&&editing){fill(form,data[editing.kind].find(r=>r.id===editing.id));if(editing.kind==='logs')form.querySelectorAll('details').forEach(d=>{d.open=!d.matches('[data-timer]');});}
 if(current==='field'){
  if(!editing){form.elements.time.value=localTime();form.elements.session.value=data.drafts.find(r=>r.id==='session')?.value||'';}
  form.querySelector('[name=type]').addEventListener('change',event=>{if(['message','relay'].includes(event.target.value)){form.querySelectorAll('details').forEach(d=>{if(!d.matches('[data-timer], [data-location]'))d.open=true;});}});
  const syncProtocol=()=>{form.elements.hops.disabled=form.elements.protocol.value!=='meshtastic';form.elements.mqtt.disabled=form.elements.protocol.value==='meshcore';};
  form.elements.protocol.addEventListener('change',syncProtocol);syncProtocol();
  updateTimer();
 }
 if(current==='map'){fill($('#map-filter'),mapFilter);mountMap();}
 if(current==='data'&&'serviceWorker' in navigator){
  $('#worker').textContent=navigator.serviceWorker.controller?'Offline cache is active.':'Offline cache is preparing. Reload after your first online visit.';
 }
}
function updateTimer(){
 const el=$('#clock');
 if(!el)return;
 const left=Math.max(0,Math.ceil((stopTime-Date.now())/1000));
 el.textContent=!stopTime?'Timer idle':left?Math.floor(left/60)+':'+String(left%60).padStart(2,'0')+' remaining':'Observation window ended. Enter your counts manually.';
 if(!left)clearInterval(timer);
}
function download(name,type,content){
 const a=document.createElement('a'),url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type}));
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function imageFile(file){
 if(!file||!file.size)return Promise.resolve(null);
 if(file.size>2000000||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP under 2 MB.');
 return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
}
async function persist(items,options){
 await write(items,options);data=await read();
}
const readinessUI=createReadiness({safe,block,options,download,status,persist,render,data:()=>data});
async function save(form){
 const kind=form.dataset.form,raw=Object.fromEntries(new FormData(form));
 if(editing?.kind===kind){raw.id=editing.id;raw.image=data[kind].find(r=>r.id===raw.id)?.image;}
 if(kind==='logs'&&raw.time)raw.time=new Date(raw.time).toISOString();
 if(kind==='logs'&&raw.anchor&&raw.site&&raw.anchor===raw.site)throw Error('Choose different endpoints.');
 const image=raw.attachment?await imageFile(raw.attachment):null;
 if(image)raw.image=image;
 const row=clean(kind,raw),items={[kind]:[row]};
 if(kind==='logs'){
  items.drafts=[{id:'session',value:row.session}];
  stopTime=0;clearInterval(timer);
 }
 await persist(items);
 editing=null;render();status(kind==='logs'?'Observation saved. You can log another stop or open the coverage map.':'Saved locally.');
}
function dedupe(rows){
 const key=r=>csv([{...r,id:null}]);
 const keys=new Set(data.logs.map(key)),ids=new Set(data.logs.map(r=>r.id)),out=[];
 for(const r of rows){const k=key(r);if(ids.has(r.id)||keys.has(k))continue;out.push(r);ids.add(r.id);keys.add(k);}
 return out;
}
function showPreview(){
 const target=$('#preview');
 if(!target||!pending)return;
 if(pending.k==='csv'){
  const {heads}=readCSV(pending.source);
  target.innerHTML='<form id="csv-preview"><div class="grid">'+select('mode','CSV format',[['auto','Detect Mesh Field Lab or packet CSV'],['packet','Packet CSV'],['position','iOS Position Log / positions']])+
  select('protocol','Protocol of external CSV',[['','Unknown'],...protocolChoices.slice(0,2)]) +Object.entries({name:'Name or sender',time:'Timestamp (ISO with offset)',lat:'Receiver latitude',lon:'Receiver longitude',rssi:'RSSI (dBm)',snr:'SNR (dB)',notes:'Payload or notes'}).map(([k,n])=>select(k,n,[['','Auto'],...heads.map(h=>[h,h])])).join('')+'</div><button>Preview import</button></form><div id="csv-results"></div>';
  previewCSV();
 }else{
  const message=pending.k==='backup'?'Replace this workspace with '+pending.value.logs.length+' observations, '+pending.value.sites.length+' sites and '+pending.value.profiles.length+' radios? Local firmware attachments will need to be reattached.':'Add reference overlay '+pending.value.name+' ('+pending.value.paths.length+' shapes)?';
  target.innerHTML='<p>'+safe(message)+'</p><button class="primary" data-apply>Confirm import</button>';
 }
}
function previewCSV(){
 const target=$('#csv-results'),form=$('#csv-preview');
 try{
  const map=Object.fromEntries(new FormData(form)),rows=parseCSV(pending.source,map.mode,map),unique=dedupe(rows);
  pending.rows=unique;
  target.innerHTML='<p>'+unique.length+' new rows · '+(rows.length-unique.length)+' duplicate rows skipped</p><div class="table"><table><thead><tr><th>Name</th><th>Source time</th><th>Received</th><th>Coordinates</th></tr></thead><tbody>'+
  unique.slice(0,5).map(r=>'<tr><td>'+safe(r.name)+'</td><td>'+safe(r.time||'Unknown')+'</td><td>'+safe(r.received??'Unknown')+'</td><td>'+safe(r.lat===null?'—':r.lat+', '+r.lon)+'</td></tr>').join('')+'</tbody></table></div>'+(unique.length?'<button class="primary" data-apply>Save these observations</button>':'');
 }catch(e){pending.rows=null;target.textContent=e.message;}
}
async function openImport(file){
 if(file.size>30_000_000)throw Error('Choose an input file under 30 MB.');
 const source=await file.text(),name=file.name;
 if(/\.csv$/i.test(name))pending={k:'csv',source};
 else if(/\.json$/i.test(name)&&!(/\.geojson$/i.test(name))){
  const value=JSON.parse(source);pending=value.schema!==undefined?{k:'backup',value:backup(value)}:{k:'overlay',value:overlay(name,source)};
 }else pending={k:'overlay',value:overlay(name,source)};
 if(page()==='data')showPreview();
}
function geolocate(button){
 if(!navigator.geolocation){status('GPS is unavailable. Enter coordinates manually.');return;}
 const form=button.closest('form');button.disabled=true;status('Waiting for location permission or GPS…');
 navigator.geolocation.getCurrentPosition(p=>{
  button.disabled=false;if(!form.isConnected)return;
  form.elements.lat.value=p.coords.latitude.toFixed(6);form.elements.lon.value=p.coords.longitude.toFixed(6);
  if(form.querySelector('#gps-result'))form.querySelector('#gps-result').textContent='Location saved to this form';
  status('Coordinates captured locally · estimated accuracy '+Math.round(p.coords.accuracy)+' m.');
 },()=>{button.disabled=false;if(form.isConnected)status('GPS did not return a fix. Check permissions or enter coordinates manually.');},{enableHighAccuracy:true,timeout:15000});
}
$('#view').addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 const d=b.dataset;
 try{
  if(Object.keys(d).some(k=>k.startsWith('r')&&k!=='role')){await readinessUI.click(b);return;}
  if(d.gps!==undefined)geolocate(b);
  if(d.step!==undefined){step=Number(d.step);await persist({drafts:[{id:'step',value:String(step)}]});render();$('[aria-current="step"]')?.focus();}
  if(d.complete||d.advance!==undefined){
   b.disabled=true;
   try{
    if(d.complete&&complete(d.complete)){
     await persist({checks:[{id:d.complete,done:false}]});render();$('[data-complete]')?.focus();
    }else{
     const next=Math.min(step+1,steps.length-1);
     await persist({...(d.complete?{checks:[{id:d.complete,done:true}]}:{}),drafts:[{id:'step',value:String(next)}]});
     if(step===8||step===steps.length-1)location.hash='#dashboard';
     else{step=next;render();$('#content').focus();}
    }
   }finally{b.disabled=false;}
  }
  if(d.edit){editing={kind:d.edit,id:d.id};render();$('[name="name"]')?.focus();}
  if(d.cancel!==undefined){editing=null;render();}
  if(d.delete&&confirm('Delete this record?')){await persist({},{del:[d.delete,d.id]});editing=null;render();status('Record deleted.');}
  if(d.clear!==undefined&&confirm('Delete every observation, site, profile, overlay and readiness record, local firmware copy and guide step from this browser?')){
   await persist({},{replace:true});step=0;pending=null;render();status('Local project data deleted.');
  }
  if(d.export==='json')download('mesh-field-lab-backup.json','application/json',JSON.stringify({schema:2,...Object.fromEntries(kinds.map(k=>[k,k==='readiness'?data[k].map(({actual,...row})=>row):data[k]]))}));
  if(d.export==='comparison')download('protocol-comparison-observations.csv','text/csv',csv(ordered().filter(r=>r.rf&&r.session&&(r.site||r.antenna)&&r.path!=='unknown')));
  if(d.export==='csv')download('mesh-field-lab-observations.csv','text/csv',csv(ordered()));
  if(d.apply!==undefined&&pending){
   const preview=pending;
   if(preview.k==='backup'){await persist(preview.value,{replace:true});step=Math.min(steps.length-1,Math.max(0,Number(data.drafts.find(x=>x.id==='step')?.value)||0));}
   if(preview.k==='overlay')await persist({overlays:[preview.value]});
   if(preview.k==='csv'&&preview.rows)await persist({logs:dedupe(preview.rows)});
   pending=null;render();status('Import saved locally.');
  }
  if(d.install!==undefined&&installPrompt){await installPrompt.prompt();installPrompt=null;render();}
  if(b.id==='start'){
   const minutes=Number($('#minutes').value);
   if(minutes<1||minutes>60||!Number.isFinite(minutes))throw Error('Choose an observation window from 1 to 60 minutes.');
   const now=new Date();$('[name="time"]').value=localTime(now);stopTime=Date.now()+minutes*60000;
   clearInterval(timer);timer=setInterval(updateTimer,250);updateTimer();
  }
  if(b.id==='stop'){stopTime=0;clearInterval(timer);updateTimer();}
 }catch(error){status(error.message);}
});
$('#view').addEventListener('submit',async e=>{
 e.preventDefault();
 const form=e.target,button=form.querySelector('button:not([type="button"])');
 try{
  if(form.dataset.rForm){if(button)button.disabled=true;await readinessUI.submit(form,e.submitter);return;}
  if(form.dataset.form){if(button)button.disabled=true;await save(form);}
  if(form.id==='map-filter'){mapFilter=Object.fromEntries(new FormData(form));mountMap();}
  if(form.id==='csv-preview')previewCSV();
  if(form.id==='rf'){
   const v=new FormData(form),km=Number(v.get('km')),mhz=Number(v.get('mhz'));
   $('#rf-output').textContent=km&&mhz?'Path loss '+format(loss(km,mhz),' dB')+' · midpoint radius '+format(fresnel(km,mhz),' m')+' · 60% radius '+format(.6*fresnel(km,mhz),' m'):'Enter both distance and frequency.';
  }
 }catch(error){status(error.message);}finally{if(button)button.disabled=false;}
});
$('#view').addEventListener('change',async e=>{
 if(e.target.dataset.rValidation!==undefined||e.target.dataset.rImport!==undefined||e.target.dataset.rCheck!==undefined||e.target.form?.dataset.rForm){try{await readinessUI.change(e.target);}catch(error){status(error.message);}return;}
 if(e.target.id!=='import'||!e.target.files.length)return;
 pending=null;$('#preview').replaceChildren();status('');
 try{await openImport(e.target.files[0]);}catch(error){status(error.message);}
});
addEventListener('hashchange',()=>{
 if(location.hash==='#content')return;
 editing=null;pending=null;if(page()==='guide')step=resumeStep();status('');render();$('#content').focus();
});
try{
 data=await read();
 step=resumeStep();
 render();
}catch(error){status('Local storage unavailable: '+error.message);}
